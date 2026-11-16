import type { Db, Document } from "mongodb";
import { withBranch, withPupilBranch, type BranchScope } from "@/lib/branchScope";
import { computeDebtors, monthBounds } from "@/lib/debtors";
import type { DebtorRow } from "@/lib/debtorsTypes";
import { monthlyPriceFor, type PricedCourse } from "@/lib/coursePrice";
import { GROUP_MEMBERSHIPS, isoDateOrNull, type GroupMembership } from "@/lib/groupMembership";
import { pupilFullName, pupilStatusOf, type Pupil } from "@/lib/pupilsData";
import { studentBotUsername } from "@/lib/studentBot/api";
import { loadStudentBotConfig } from "@/lib/studentBot/config";
import { BOT_USERS, type StudentBotUser } from "@/lib/studentBot/users";
import type { ListGroup, MonthPayState, StudentListRow, StudentListsPayload } from "@/lib/studentListsTypes";

// O'QUVCHILAR BO'LIMI RO'YXATLARI (yangi versiya, 30-qism) — server.
//
// Oltita sahifa (Yangi / Aktiv / Arxiv o'quvchilar, Obunasi tugaydiganlar, Ota-ona, Manzillar)
// bitta yig'ma javobdan o'z qatorlarini tanlaydi (lib/studentListsTypes.ts). Bu yerda faqat
// BOR manbalar o'qiladi, hech narsa o'ylab topilmaydi:
//
//   • pul — lib/debtors.ts (Qarzdorlar hisoboti bilan BITTA qoida): bugungi holat va oy
//     oxiridagi holat (joriy oyning qolgan darslari ham hisobga). Oy oxirida qarz yo'q —
//     «To'langan»; oldingi oydan qarz — «Qarzdor · N oy»; faqat joriy oy ochiq — to'lov kuni
//     kelmagan bo'lsa «To'lov kuni», o'tgan bo'lsa «Qarzdor».
//   • TO'LOV KUNI — bazada alohida maydon yo'q (SAVOLLAR 394, 411): o'quvchi kartasidagi
//     «To'lov sanasi» (`paymentDate`) kuni, u bo'lmasa birinchi a'zolik boshlangan kun.
//   • guruhlar — `group_memberships` (ochiq va yopilgan a'zoliklar);
//   • ota-ona kabineti — o'quvchilar boti (`student_bot_users`, «parent» bog'lanishi);
//     taklif yuborilgan kun — `pupils.parentInvitedAt` (Ota-ona → «Kabinetga taklif»);
//   • taklif — lidlardagi «Referal bergan o'quvchi» (`orders.referralPupilId`);
//   • eslatma — `sms_messages` (joriy oyda o'quvchi yoki ota-ona raqamiga ketgan SMS).

type GroupDoc = {
  id: number;
  name?: string;
  course?: string;
  level?: string;
  teacher?: string;
  branchId?: number | null;
};

/** Yaxlitlash qoldig'i (so'm): bundan kichik qarz «yo'q» hisoblanadi. */
const ROUNDING_SLACK = 1000;

const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v)).trim();
const d9 = (v: unknown) => s(v).replace(/\D/g, "").slice(-9);

/** "dd.MM.yyyy | HH:mm" yoki "YYYY-MM-DD…" → "YYYY-MM-DD"; o'qilmasa null. */
function isoOf(v: unknown): string | null {
  const t = s(v);
  const iso = isoDateOrNull(t);
  if (iso) return iso;
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(t);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Joriy oyda to'lov kuni: `day` (1–31) oy uzunligiga qisiladi. */
function dueIn(month: string, day: number): string {
  const { to } = monthBounds(month);
  const last = Number(to.slice(8, 10));
  return `${month}-${String(Math.min(Math.max(day, 1), last)).padStart(2, "0")}`;
}

export async function buildStudentLists(db: Db, scope: BranchScope, asOf: string): Promise<StudentListsPayload> {
  const month = asOf.slice(0, 7);
  const monthEnd = monthBounds(month).to;

  const [pupilDocs, groups, courses, today, atMonthEnd] = await Promise.all([
    db
      .collection<Pupil>("pupils")
      .find(withPupilBranch({}, scope), {
        projection: {
          _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, status: 1, statusChangedAt: 1, statusReason: 1,
          source: 1, createdAt: 1, paymentDate: 1,
          fatherName: 1, fatherPhone: 1, fatherWork: 1, motherName: 1, motherPhone: 1, motherWork: 1,
          address: 1, addresses: 1, mahalla: 1, addressLandmark: 1, housing: 1, parentInvitedAt: 1,
        },
      })
      .toArray(),
    db
      .collection<GroupDoc>("groups")
      .find(withBranch({}, scope), { projection: { _id: 0, id: 1, name: 1, course: 1, level: 1, teacher: 1, branchId: 1 } })
      .toArray(),
    db.collection<PricedCourse>("offline_courses").find({}, { projection: { _id: 0, name: 1, branches: 1, levels: 1 } }).toArray(),
    computeDebtors(db, scope, asOf),
    computeDebtors(db, scope, monthEnd),
  ]);

  const ids = pupilDocs.map((p) => p.id);
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const priceByGroup = new Map<number, number | null>();
  const priceOf = (g: GroupDoc) => {
    if (!priceByGroup.has(g.id)) priceByGroup.set(g.id, monthlyPriceFor(g, courses));
    return priceByGroup.get(g.id) ?? null;
  };

  const phonesOf = (p: Pupil) => [p.phone, p.fatherPhone, p.motherPhone].map(d9).filter((x) => x.length === 9);
  const allPhones = [...new Set(pupilDocs.flatMap(phonesOf))];

  const [memberships, leadsOfPupils, referralLeads, botUsers, smsRows] = await Promise.all([
    db
      .collection<GroupMembership>(GROUP_MEMBERSHIPS)
      .find({ pupilId: { $in: ids }, groupId: { $in: groups.map((g) => g.id) } }, { projection: { _id: 0, groupId: 1, pupilId: 1, joinedAt: 1, leftAt: 1 } })
      .toArray(),
    db
      .collection("orders")
      .find({ pupilId: { $in: ids } }, { projection: { _id: 0, pupilId: 1, firstLesson: 1, referral: 1 } })
      .toArray(),
    db
      .collection("orders")
      .find({ referralPupilId: { $in: ids } }, { projection: { _id: 0, referralPupilId: 1, pupilId: 1 } })
      .toArray(),
    db
      .collection<StudentBotUser>(BOT_USERS)
      .find({ "links.pupilId": { $in: ids } }, { projection: { _id: 0, links: 1, linkedAt: 1 } })
      .toArray(),
    // Faqat joriy oy (sana indeksli maydon) — raqamga moslash JS'da: 6 000+ o'quvchining
    // uchtadan raqami bilan `$regex` so'rovi juda og'ir bo'lardi.
    allPhones.length
      ? db
          .collection("sms_messages")
          .find({ date: { $gte: `${month}-01`, $lte: monthEnd } }, { projection: { _id: 0, phone: 1, date: 1, moderator: 1 } })
          .toArray()
      : Promise.resolve([] as Document[]),
  ]);

  const debtNow = new Map<number, DebtorRow>(today.rows.map((r) => [r.id, r]));
  const debtEnd = new Map<number, DebtorRow>(atMonthEnd.rows.map((r) => [r.id, r]));

  // A'zoliklar → ochiq guruhlar va oxirgi yopilgani.
  const memByPupil = new Map<number, GroupMembership[]>();
  for (const m of memberships) {
    const list = memByPupil.get(m.pupilId) ?? [];
    list.push(m);
    memByPupil.set(m.pupilId, list);
  }
  const toListGroup = (m: GroupMembership): ListGroup | null => {
    const g = groupById.get(m.groupId);
    if (!g) return null;
    return {
      id: g.id,
      name: s(g.name) || String(g.id),
      course: s(g.course),
      level: s(g.level),
      teacher: s(g.teacher),
      joinedAt: isoDateOrNull(m.joinedAt),
      leftAt: isoDateOrNull(m.leftAt),
      monthlyPrice: priceOf(g),
    };
  };

  const firstLesson = new Set<number>();
  const referredBy = new Map<number, string>();
  for (const o of leadsOfPupils) {
    const pid = Number(o.pupilId);
    if (s(o.firstLesson)) firstLesson.add(pid);
    if (s(o.referral) && !referredBy.has(pid)) referredBy.set(pid, s(o.referral));
  }
  const referred = new Map<number, { n: number; paid: number }>();
  for (const o of referralLeads) {
    const rid = Number(o.referralPupilId);
    const cur = referred.get(rid) ?? { n: 0, paid: 0 };
    cur.n += 1;
    const lead = Number(o.pupilId);
    if (Number.isFinite(lead) && (debtNow.get(lead)?.paid ?? 0) > 0) cur.paid += 1;
    referred.set(rid, cur);
  }
  const cabinetIn = new Map<number, string>();
  for (const u of botUsers) {
    const at = isoOf(u.linkedAt) ?? "";
    for (const l of u.links ?? []) {
      if (l.role !== "parent") continue;
      const prev = cabinetIn.get(l.pupilId);
      if (prev === undefined || (at && at < prev)) cabinetIn.set(l.pupilId, at);
    }
  }
  const smsByPhone = new Map<string, { date: string; by: string }>();
  for (const m of smsRows) {
    const k = d9(m.phone);
    const prev = smsByPhone.get(k);
    if (!prev || s(m.date) > prev.date) smsByPhone.set(k, { date: s(m.date), by: s(m.moderator) });
  }

  const rows: StudentListRow[] = pupilDocs.map((p) => {
    const mems = memByPupil.get(p.id) ?? [];
    const open = mems.filter((m) => !isoDateOrNull(m.leftAt)).map(toListGroup).filter((g): g is ListGroup => g !== null);
    const closed = mems
      .filter((m) => isoDateOrNull(m.leftAt))
      .sort((a, b) => String(b.leftAt).localeCompare(String(a.leftAt)))
      .map(toListGroup)
      .filter((g): g is ListGroup => g !== null);
    const joins = mems.map((m) => isoDateOrNull(m.joinedAt)).filter((d): d is string => d !== null).sort();
    const firstJoinedAt = joins[0] ?? null;

    const now = debtNow.get(p.id);
    const end = debtEnd.get(p.id);
    const prices = open.map((g) => g.monthlyPrice);
    const monthlyTotal = prices.length && prices.every((x) => x !== null) ? prices.reduce<number>((a, b) => a + (b ?? 0), 0) : null;

    const payDay = Number((isoDateOrNull(p.paymentDate) ?? "").slice(8, 10)) || Number((firstJoinedAt ?? "").slice(8, 10)) || 1;
    const dueDate = open.length ? dueIn(month, payDay) : null;
    let monthState: MonthPayState = "none";
    if (open.length && end) {
      // Dars narxi butun so'mga yaxlitlanadi (SAVOLLAR 396) — oylik to'liq to'langanda ham bir necha
      // so'm «qarz» qoladi; shunday qoldiq holatni o'zgartirmaydi.
      const unpaidFrom = (now?.debt ?? 0) > ROUNDING_SLACK ? (now?.unpaid?.from ?? null) : null;
      if (end.debt <= ROUNDING_SLACK) monthState = "paid";
      else if (unpaidFrom && unpaidFrom < month) monthState = "debt";
      else if (dueDate && asOf < dueDate) monthState = "due";
      else monthState = "debt";
    }

    const invited = isoOf((p as Pupil & { parentInvitedAt?: string }).parentInvitedAt);
    const cabinet = cabinetIn.has(p.id) ? "in" : invited ? "invited" : "none";
    const sms = phonesOf(p)
      .map((ph) => smsByPhone.get(ph))
      .filter((x): x is { date: string; by: string } => Boolean(x))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const ref = referred.get(p.id);
    const ext = p as Pupil & { mahalla?: string; addressLandmark?: string; housing?: string };
    const firstAddress = (p.addresses ?? []).find((a) => s(a.name))?.name ?? "";

    return {
      id: p.id,
      name: pupilFullName(p),
      phone: s(p.phone),
      status: pupilStatusOf(p),
      statusChangedAt: s(p.statusChangedAt),
      statusReason: s(p.statusReason),
      source: s(p.source),
      createdAt: s(p.createdAt),
      groups: open,
      lastGroup: closed[0] ?? null,
      firstJoinedAt,
      fromFirstLesson: firstLesson.has(p.id),
      paid: now?.paid ?? end?.paid ?? 0,
      debt: now?.debt ?? 0,
      debtMonthEnd: end?.debt ?? 0,
      unpaid: now?.unpaid ?? null,
      monthlyTotal,
      monthState,
      dueDate,
      lastPaymentDate: now?.lastPayment?.date ?? null,
      fatherName: s(p.fatherName),
      fatherPhone: s(p.fatherPhone),
      fatherWork: s(p.fatherWork),
      motherName: s(p.motherName),
      motherPhone: s(p.motherPhone),
      motherWork: s(p.motherWork),
      cabinet,
      cabinetAt: cabinet === "in" ? cabinetIn.get(p.id) || null : invited,
      referred: ref?.n ?? 0,
      referredPaid: ref?.paid ?? 0,
      referredBy: referredBy.get(p.id) ?? "",
      lastSmsAt: sms?.date ?? null,
      lastSmsBy: sms?.by ?? "",
      address: s(p.address) || s(firstAddress),
      mahalla: s(ext.mahalla),
      landmark: s(ext.addressLandmark),
      housing: s(ext.housing),
    };
  });

  // Ota-ona kabineti havolasi (o'quvchilar boti) — «Kabinetga taklif» SMS'i uchun; bot sozlanmagan — bo'sh.
  const bot = await studentBotUsername(loadStudentBotConfig()).catch(() => "");
  return { ok: true, asOf, rows, botLink: bot ? `https://t.me/${bot}` : "" };
}
