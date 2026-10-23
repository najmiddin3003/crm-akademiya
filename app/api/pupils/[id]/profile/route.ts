import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, withPupilBranch } from "@/lib/branchScope";
import { pupilEntryMatch, pupilNameOfDoc } from "@/lib/pupilEntries";
import { pupilStatusOf, type Pupil } from "@/lib/pupilsData";
import { groupLabel, type Group } from "@/lib/groups";
import { ATTENDANCE_OPTIONS, groupWeekdays, type AttendanceStatus } from "@/lib/attendance";
import { monthlyPriceFor } from "@/lib/debtors";
import type { DebtIssue } from "@/lib/debtorsTypes";
import { GROUP_MEMBERSHIPS, groupEndIso, groupStartIso, isoDateOrNull, lessonDaysBetween, type GroupMembership } from "@/lib/groupMembership";
import { entryPaidAmount } from "@/lib/transactionEntries";
import { LEGACY_COLLECTION } from "@/lib/legacyEntries";
import { GAM } from "@/lib/gamification/db";
import { uzDateIso, uzTimeHm } from "@/lib/uzTime";
import {
  monthBoundsOf,
  shiftMonthKey,
  type ProfileEntry,
  type ProfileGroup,
  type ProfileMark,
  type ProfileMonth,
  type PupilProfilePayload,
} from "@/lib/pupilProfile";

// GET /api/pupils/:id/profile — YANGI VERSIYADAGI O'QUVCHI SAHIFASI uchun hamma narsa
// bitta so'rovda (components/v2/students/profile/*, 23.10.2026):
//
//   • o'quvchi (parolsiz, faqat ko'rsatiladigan maydonlar) — JORIY FILIAL qamrovida
//     (`/api/pupils/:id` bilan bir xil qoida: boshqa filialniki — 404);
//   • guruhlari — hozirgi (groups.studentIds) va a'zolik tarixidagilar
//     (group_memberships, chiqqanlari ham); har biriga OYLIK narx (lib/debtors.ts →
//     monthlyPriceFor — Qarzdorlar hisoboti bilan bir xil manba) va oylar: a'zolik
//     boshlangan oydan KEYINGI oygacha har oy uchun darslar soni va to'lanadigan summa
//     (to'liq oy — oylik narx, qisman oy — darslar ulushi; lib/pupilProfile.ts →
//     ProfileMonth). Yig'ilayotgan (gathering) guruh sanalmaydi — darslari boshlanmagan;
//   • to'lovlari — o'quvchining kirimlari va unga qaytarimlar (lib/pupilEntries.ts →
//     pupilEntryMatch: pupilId, belgilanmagan eskilari ism bo'yicha), bekor
//     qilinganlari ham (ko'rsatish uchun, hisobga kirmaydi); kassa nomi bilan;
//   • davomat belgilari (oxirgi ~7 oy) va har biriga kim belgilagani
//     (attendance_history dagi oxirgi yozuv);
//   • tanga (gamifikatsiya hamyoni), eski tizim arxividagi to'lovlar soni.
//
// Ruxsat: lib/apiPermissions.generated.ts — `/students-list` (o'quvchi profili bilan
// bir xil; generator yurgizilmadi, qo'lda).

const notLoggedIn = () => NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

type GroupDoc = Group & { branchId?: number | null; archivedAt?: string | null; startDate?: string | null; endDate?: string | null };

interface PricedCourse {
  name: string;
  branches?: { id: number; enabled: boolean; price: number }[];
  levels?: { name: string; branches?: { id: number; enabled: boolean; summa: number }[] }[];
}

const MARK_STATUSES = new Set<string>(ATTENDANCE_OPTIONS.map((o) => o.key));
const isMarkStatus = (v: unknown): v is AttendanceStatus => typeof v === "string" && MARK_STATUSES.has(v);

const minIso = (a: string, b: string | null) => (b !== null && b < a ? b : a);
const maxIso = (a: string, b: string | null) => (b !== null && b > a ? b : a);
const str = (v: unknown) => (v == null ? "" : String(v));

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });

  const scope = await getBranchScope();
  if (!scope) return notLoggedIn();
  const db = await ensureIndexes();

  const pupil = (await db.collection("pupils").findOne(withPupilBranch({ id }, scope), {
    projection: {
      _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, extraPhone: 1, birthDate: 1, category: 1, source: 1,
      moderator: 1, createdAt: 1, status: 1, statusChangedAt: 1, statusReason: 1, branchId: 1,
      fatherName: 1, fatherPhone: 1, motherName: 1, motherPhone: 1,
    },
  })) as (Pupil & { branchId?: number | null }) | null;
  if (!pupil) return NextResponse.json({ ok: false, error: "O'quvchi topilmadi" }, { status: 404 });

  const asOf = uzDateIso();
  const curMonth = asOf.slice(0, 7);
  const lastMonth = shiftMonthKey(curMonth, 1);
  const marksFrom = `${shiftMonthKey(curMonth, -6)}-01`;
  const name = pupilNameOfDoc(pupil);
  const status = pupilStatusOf(pupil);

  // 1) A'zoliklar va guruhlar (hozirgilari + tarixdagilar).
  const memberships = (await db
    .collection<GroupMembership>(GROUP_MEMBERSHIPS)
    .find({ pupilId: id }, { projection: { _id: 0, groupId: 1, joinedAt: 1, leftAt: 1 } })
    .toArray()) as Pick<GroupMembership, "groupId" | "joinedAt" | "leftAt">[];
  const memberIds = [...new Set(memberships.map((m) => m.groupId))];

  const [groups, courses, entryDocs, legacyCount, markDocs, historyDocs, wallet] = await Promise.all([
    db
      .collection<GroupDoc>("groups")
      .find(
        { $or: [{ id: { $in: memberIds } }, { studentIds: id }] },
        {
          projection: {
            _id: 0, id: 1, name: 1, course: 1, level: 1, teacher: 1, room: 1, day: 1, time: 1, status: 1,
            branchId: 1, startDate: 1, endDate: 1, period: 1, archivedAt: 1, studentIds: 1,
          },
        },
      )
      .toArray(),
    db
      .collection<PricedCourse>("offline_courses")
      .find({}, { projection: { _id: 0, name: 1, branches: 1, levels: 1 } })
      .toArray(),
    db
      .collection("transaction_entries")
      .find(
        {
          $and: [
            { $or: [{ txType: "payIn" }, { txType: "payOut", studentRefund: true }] },
            pupilEntryMatch({ id, name }),
          ],
        },
        {
          projection: {
            _id: 0, id: 1, date: 1, time: 1, amount: 1, discountSom: 1, txType: 1, txName: 1, paymentType: 1,
            paymentMethodKey: 1, periodMonth: 1, teacherName: 1, cashboxId: 1, status: 1, studentRefund: 1, note: 1,
          },
        },
      )
      .sort({ date: -1, time: -1, id: -1 })
      .limit(600)
      .toArray(),
    db.collection(LEGACY_COLLECTION).countDocuments({ pupilId: id }),
    db
      .collection("attendance")
      .find({ pupilId: id, date: { $gte: marksFrom } }, { projection: { _id: 0, groupId: 1, date: 1, status: 1, reason: 1, note: 1 } })
      .toArray(),
    db
      .collection("attendance_history")
      .find({ pupilId: id, date: { $gte: marksFrom } }, { projection: { _id: 0, id: 1, groupId: 1, date: 1, author: 1, createdAt: 1 } })
      .sort({ id: -1 })
      .toArray(),
    db.collection(GAM.wallets).findOne({ pupilId: id }, { projection: { _id: 0, balance: 1 } }),
  ]);

  // 2) Guruh bo'yicha oylar (yuqoridagi izoh). Bir guruhda bir necha a'zolik oralig'i
  //    bo'lishi mumkin (chiqarilib, qayta qo'shilgan) — darslari qo'shiladi.
  const frozenAt = status === "Muzlatilgan" ? isoDateOrNull(pupil.statusChangedAt) : null;
  const profileGroups: ProfileGroup[] = [];
  for (const g of groups) {
    const current = (g.studentIds ?? []).includes(id);
    let intervals = memberships.filter((m) => m.groupId === g.id);
    // Guruhda bor, lekin a'zolik yozuvi yo'q (eski) — guruh boshidan ochiq oraliq.
    if (intervals.length === 0 && current) intervals = [{ groupId: g.id, joinedAt: null, leftAt: null }];
    if (intervals.length === 0) continue;

    const monthlyPrice = monthlyPriceFor(g, courses);
    const issues: DebtIssue[] = [];
    if (monthlyPrice === null) issues.push("price");
    if (groupWeekdays(g.day).length === 0) issues.push("schedule");

    const groupStart = groupStartIso(g);
    const joinedList = intervals.map((m) => isoDateOrNull(m.joinedAt)).filter((d): d is string => d !== null);
    const joinedAt = joinedList.length ? joinedList.reduce((a, b) => (b < a ? b : a)) : null;
    const leftList = intervals.map((m) => isoDateOrNull(m.leftAt));
    const open = leftList.some((d) => d === null);
    const leftAt = current || open ? null : (leftList.filter((d): d is string => d !== null).reduce((a, b) => (b > a ? b : a), "") || null);

    const gathering = (g.status || "") === "gathering";
    const byMonth = new Map<string, number>();
    let startIso: string | null = null;
    let boundIso: string | null = null;
    // Ochiq oraliq (chegarasiz) bo'lsa umumiy chegara ham yo'q — yopiq eski oraliq uni bosib qolmasin.
    let openEnded = false;
    for (const m of intervals) {
      const joined = isoDateOrNull(m.joinedAt);
      const start = joined !== null ? maxIso(joined, groupStart) : groupStart;
      if (start === null) {
        if (!issues.includes("start")) issues.push("start");
        continue;
      }
      if (startIso === null || start < startIso) startIso = start;
      const bounds: (string | null)[] = [isoDateOrNull(m.leftAt), groupEndIso(g), frozenAt];
      if ((g.status || "") === "archive") bounds.push(isoDateOrNull(g.archivedAt));
      let bound: string | null = null;
      for (const b of bounds) if (b !== null) bound = bound === null ? b : minIso(bound, b);
      if (bound === null) openEnded = true;
      else if (boundIso === null || bound > boundIso) boundIso = bound;
      if (gathering) continue;
      // Hisob boshlangan oydan kelgusi oygacha.
      for (let mk = start.slice(0, 7); mk <= lastMonth; mk = shiftMonthKey(mk, 1)) {
        const mb = monthBoundsOf(mk);
        const from = maxIso(mb.from, start);
        const to = minIso(mb.to, bound);
        if (from > to) continue;
        const n = lessonDaysBetween(g.day, from, to).count;
        byMonth.set(mk, (byMonth.get(mk) ?? 0) + n);
      }
    }

    const months: ProfileMonth[] = [...byMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([mk, lessons]) => {
        const mb = monthBoundsOf(mk);
        const fullLessons = lessonDaysBetween(g.day, mb.from, mb.to).count;
        const share = fullLessons > 0 ? Math.min(1, lessons / fullLessons) : 0;
        return { month: mk, lessons, fullLessons, expected: monthlyPrice === null || fullLessons === 0 ? null : Math.round(monthlyPrice * share) };
      })
      .filter((m) => m.lessons > 0);

    profileGroups.push({
      id: g.id,
      name: str(g.name),
      course: str(g.course),
      level: str(g.level),
      teacher: str(g.teacher),
      room: str(g.room),
      day: str(g.day),
      time: str(g.time),
      status: str(g.status),
      label: groupLabel(g),
      monthlyPrice,
      current,
      joinedAt,
      leftAt,
      startIso,
      boundIso: openEnded ? null : boundIso,
      issues,
      months,
    });
  }
  // Hozirgilari birinchi, keyin qo'shilgan sana bo'yicha.
  profileGroups.sort((a, b) => Number(b.current) - Number(a.current) || (a.joinedAt ?? "").localeCompare(b.joinedAt ?? "") || a.label.localeCompare(b.label));

  // 3) To'lovlar + kassa nomlari.
  const cashboxIds = [...new Set(entryDocs.map((e) => Number(e.cashboxId)).filter((n) => Number.isFinite(n)))];
  const cashboxDocs = cashboxIds.length
    ? await db.collection("cashboxes").find({ id: { $in: cashboxIds } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray()
    : [];
  const cashboxName = new Map(cashboxDocs.map((c) => [Number(c.id), str(c.name)]));
  const entries: ProfileEntry[] = entryDocs.map((e) => ({
    id: Number(e.id),
    date: str(e.date),
    time: str(e.time),
    amount: Number(e.amount) || 0,
    paid: entryPaidAmount({ amount: e.amount, discountSom: e.discountSom }),
    txType: str(e.txType),
    txName: str(e.txName),
    paymentType: str(e.paymentType),
    paymentMethodKey: str(e.paymentMethodKey),
    periodMonth: /^\d{4}-\d{2}$/.test(str(e.periodMonth)) ? str(e.periodMonth) : str(e.date).slice(0, 7),
    teacherName: str(e.teacherName),
    cashboxId: Number(e.cashboxId) || 0,
    cashboxName: cashboxName.get(Number(e.cashboxId)) ?? "",
    status: str(e.status),
    studentRefund: e.studentRefund === true,
    note: str(e.note),
  }));

  // 4) Davomat + kim va qachon belgilagani (har (guruh, kun) uchun oxirgi tarix yozuvi).
  const authorOf = new Map<string, { author: string; at: string }>();
  for (const h of historyDocs) {
    const key = `${h.groupId}:${h.date}`;
    if (!authorOf.has(key)) authorOf.set(key, { author: str(h.author), at: str(h.createdAt) });
  }
  const marks: ProfileMark[] = markDocs
    .filter((m) => isMarkStatus(m.status))
    .map((m) => ({
      groupId: Number(m.groupId),
      date: str(m.date),
      status: m.status as AttendanceStatus,
      reason: str(m.reason),
      note: str(m.note),
      author: authorOf.get(`${m.groupId}:${m.date}`)?.author ?? "",
      markedAt: authorOf.get(`${m.groupId}:${m.date}`)?.at ?? "",
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const payload: PupilProfilePayload = {
    ok: true,
    asOf,
    nowHm: uzTimeHm(),
    pupil: {
      id,
      firstName: str(pupil.firstName),
      lastName: str(pupil.lastName),
      phone: str(pupil.phone),
      extraPhone: str(pupil.extraPhone),
      birthDate: str(pupil.birthDate),
      category: str(pupil.category),
      source: str(pupil.source),
      moderator: str(pupil.moderator),
      createdAt: str(pupil.createdAt),
      status,
      statusChangedAt: str(pupil.statusChangedAt),
      statusReason: str(pupil.statusReason),
      // `Number(null)` = 0 — filialsiz yozuv 0 bo'lib qolmasin.
      branchId: Number(pupil.branchId) > 0 ? Number(pupil.branchId) : null,
      fatherName: str(pupil.fatherName),
      fatherPhone: str(pupil.fatherPhone),
      motherName: str(pupil.motherName),
      motherPhone: str(pupil.motherPhone),
    },
    coins: Number(wallet?.balance) || 0,
    groups: profileGroups,
    entries,
    legacyCount,
    marks,
  };
  return NextResponse.json(payload);
}
