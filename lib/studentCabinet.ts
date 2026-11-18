import type { Db, Document } from "mongodb";
import { cameStatus, groupWeekdays, toIsoDate } from "@/lib/attendance";
import { monthlyPriceFor, type PricedCourse } from "@/lib/coursePrice";
import { isPaidBy, membershipSpan, monthBounds, NOT_STARTED_STATUS, paidMatch, paidOwnerOf, type MembershipSpan } from "@/lib/debtors";
import { GAM } from "@/lib/gamification/db";
import { groupRanking, monthRange } from "@/lib/gamification/ranking";
import { toGamGroup } from "@/lib/gamification/scope";
import { loadSettings } from "@/lib/gamification/settings";
import { fitsAudience, itemTitle, type ShopItem } from "@/lib/gamification/shop";
import { gradeOf, toifaOf } from "@/lib/gamification/students";
import { GROUP_MEMBERSHIPS, groupEndIso, groupStartIso, isoDateOrNull, lessonDaysBetween, type GroupMembership } from "@/lib/groupMembership";
import { ARCHIVED_GROUPS_COLLECTION, groupLabel, type Group } from "@/lib/groups";
import { GROUPLESS_GROUP_ID, type GroupExam } from "@/lib/imtihon";
import { receiptBranchOf } from "@/lib/managementBranches";
import { pupilEntryMatch } from "@/lib/pupilEntries";
import { pupilFullName, type Pupil } from "@/lib/pupilsData";
import { cleanReceiptProfile } from "@/lib/receiptProfile";
import { entryPaidAmount, isStudentRefundEntry, type TransactionEntry } from "@/lib/transactionEntries";
import { uzDateIso, uzTimeHm } from "@/lib/uzTime";
import type {
  CabinetAttendance,
  CabinetCoins,
  CabinetDebt,
  CabinetDebtPart,
  CabinetGroup,
  CabinetLesson,
  CabinetMark,
  CabinetMonthCell,
  CabinetMonthRow,
  CabinetMonths,
  CabinetPayment,
  CabinetAttendanceMonth,
  CabinetResult,
  StudentCabinet,
} from "@/lib/studentCabinetTypes";

// O'QUVCHI KABINETI (v2, 28-qism) — POST /api/student-web/me javobidagi `cabinet`.
// Shakl va maydonlar ma'nosi — lib/studentCabinetTypes.ts.
//
// FAQAT O'QIYDI. O'quvchi `student_bot_users` dagi bog'lanishdan keladi (marshrut),
// bu yerda hech qanday so'rov qiymati qabul qilinmaydi.
//
// PUL — xodimlardagi «Qarzdorlar» hisoboti (lib/debtors.ts → computeDebtors) bilan
// BITTA QOIDA: a'zolik oralig'i chegaralari (`membershipSpan`), to'langan yozuvlar sharti
// (`paidMatch`) va to'lov egasi (`paidOwnerOf`/`isPaidBy`) o'sha fayldan olinadi —
// shu sabab `debt.balance` hisobotdagi shu o'quvchining `debt` iga aynan teng
// (o'quvchining hamma guruhi bitta filial qamrovida bo'lsa; bir nechta filialda
// o'qisa hisobot har filialni alohida ko'rsatadi, kabinet esa jamini).
//
// OYLAR JADVALI. To'lov yozuvida guruh YO'Q (`group` bazada doim bo'sh), faqat
// «qaysi oy uchun» (`periodMonth`; yo'q bo'lsa sananing oyi). Taqsimot:
//   1) har oy uchun shu oyga yozilgan to'lovlar shu oyning guruh hisoblarini
//      guruh id tartibida yopadi;
//   2) ortib qolgan pul (oldindan to'langan, ortiqcha, qaytarim — manfiy) bitta
//      yig'indi bo'lib eng eski yopilmagan katakchalarni yopadi (manfiy bo'lsa —
//      eng yangi yopilganlarni ochadi).
// Natijada katakchalardagi qoldiqlar yig'indisi = max(0, balance).

/** To'lovlar tarixidagi ko'pi bilan nechta yozuv. */
const PAYMENTS_LIMIT = 200;
/** Sarhisob natijalari — ko'pi bilan. */
const RESULTS_LIMIT = 24;
/** Darslar oynasi bugundan necha kun oldinga. */
const LESSONS_AHEAD_DAYS = 21;

type GroupDoc = Group & { branchId?: number | null; archivedAt?: string | null };

const YM = /^\d{4}-\d{2}$/;

function isoParts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m || 1, d || 1];
}

/** ISO kunga n kun (mahalliy taqvim — lib/groupMembership.ts → lessonDaysBetween bilan bir xil). */
function addDays(iso: string, n: number): string {
  const [y, m, d] = isoParts(iso);
  return toIsoDate(new Date(y, m - 1, d + n));
}

function weekdayOf(iso: string): number {
  const [y, m, d] = isoParts(iso);
  return new Date(y, m - 1, d).getDay();
}

/** "2026-10" + n oy. */
function shiftMonth(ym: string, n: number): string {
  const [y, m] = isoParts(ym);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

const maxIso = (a: string, b: string | null) => (b !== null && b > a ? b : a);
const minIso = (a: string, b: string | null) => (b !== null && b < a ? b : a);

/** «15:00 - 17:00» → {start:"15:00", end:"17:00"}; tanilmasa bo'sh. */
function parseTime(raw: unknown): { start: string; end: string } {
  const hm = [...String(raw ?? "").matchAll(/(\d{1,2})[:.](\d{2})/g)].map((m) => `${m[1].padStart(2, "0")}:${m[2]}`);
  return { start: hm[0] ?? "", end: hm[1] ?? "" };
}

/** Kartalardagi nom: «Ingliz tili · 2-bosqich»; bosqich yo'q — «Matematika (13-guruh)». */
function groupTitle(g: Pick<Group, "id" | "name" | "course" | "level">): string {
  const course = String(g.course ?? "").trim();
  const level = String(g.level ?? "").trim();
  return course && level ? `${course} · ${level}` : groupLabel(g);
}

/** Davomat holati → kabinet belgisi (qiymatlar lib/attendance.ts → AttendanceStatus bilan bir xil); tanilmasa null. */
function markOf(status: unknown): CabinetMark | null {
  switch (status) {
    case "keldi":
    case "kechikdi":
    case "birinchi":
    case "sababli":
    case "sababsiz":
      return status;
    default:
      return null;
  }
}

/** To'lov qaysi oy uchun: `periodMonth`, bo'lmasa sananing oyi. */
function periodOf(e: { periodMonth?: unknown; date?: unknown }): string {
  const pm = typeof e.periodMonth === "string" ? e.periodMonth : "";
  return YM.test(pm) ? pm : String(e.date ?? "").slice(0, 7);
}

/** To'langan yozuvning hisob uchun kerakli qismi. */
interface PaidRow {
  pupilId?: unknown;
  studentName?: unknown;
  amount?: number;
  discountSom?: number;
  periodMonth?: string;
  date?: string;
  txType?: string;
}

interface Cell {
  groupId: number;
  month: string;
  charge: number;
  covered: number;
}

/** Oylar jadvali taqsimoti (fayl boshidagi izoh). Qaytaradi: yopib bo'lmagan manfiy qoldiq (to'langan jami manfiy bo'lsa). */
function allocate(cells: Cell[], paidByMonth: Map<string, number>): number {
  const ordered = [...cells].sort((a, b) => a.month.localeCompare(b.month) || a.groupId - b.groupId);
  const byMonth = new Map<string, Cell[]>();
  for (const c of ordered) {
    const list = byMonth.get(c.month);
    if (list) list.push(c);
    else byMonth.set(c.month, [c]);
  }
  const months = [...new Set([...byMonth.keys(), ...paidByMonth.keys()])].sort();
  let surplus = 0;
  for (const mo of months) {
    let avail = paidByMonth.get(mo) ?? 0;
    if (avail > 0) {
      for (const c of byMonth.get(mo) ?? []) {
        const take = Math.min(c.charge - c.covered, avail);
        if (take > 0) {
          c.covered += take;
          avail -= take;
        }
        if (avail <= 0) break;
      }
    }
    surplus += avail;
  }
  if (surplus > 0) {
    for (const c of ordered) {
      const take = Math.min(c.charge - c.covered, surplus);
      if (take > 0) {
        c.covered += take;
        surplus -= take;
      }
      if (surplus <= 0) break;
    }
    return 0;
  }
  let need = -surplus;
  for (let i = ordered.length - 1; i >= 0 && need > 0; i--) {
    const back = Math.min(ordered[i].covered, need);
    ordered[i].covered -= back;
    need -= back;
  }
  return need;
}

function cellState(charge: number, covered: number): CabinetMonthCell["state"] {
  if (charge <= 0) return "none";
  if (covered >= charge) return "paid";
  return covered > 0 ? "partial" : "debt";
}

/**
 * Tangalar — gamifikatsiya o'chiq bo'lsa null. Hamma so'rov BIRDANIGA yuboriladi (sozlama ham):
 * kabinet bitta tarmoq aylanishida ochilsin. FAQAT O'QISH: istak sovg'asi katalogdan to'g'ridan-to'g'ri
 * o'qiladi — `listItems`/`pupilShopInfo` katalog bo'sh bo'lsa «chegirma» yozuvini YARATADI.
 * Istak qoidasi pupilShopInfo bilan bir xil: qo'shilish tartibida birinchisi, o'chirilmagan va
 * o'quvchi toifasiga mos sovg'a; `ready` — balans narxdan kam emas.
 */
async function loadCoins(db: Db, pupil: Pupil, month: string): Promise<CabinetCoins | null> {
  const pupilId = pupil.id;
  const [settings, wallet, earned, wishes, items, ranks] = await Promise.all([
    loadSettings(db),
    db.collection(GAM.wallets).findOne({ pupilId }, { projection: { _id: 0, balance: 1 } }),
    db
      .collection(GAM.tx)
      .aggregate<{ s: number }>([
        // «Shu oyda olingan»: faol, musbat, xarid emas (tarixdagi «+» filtri bilan bir xil).
        { $match: { pupilId, status: "active", type: { $ne: "shop" }, amount: { $gt: 0 }, date: monthRange(month) } },
        { $group: { _id: null, s: { $sum: "$amount" } } },
      ])
      .toArray(),
    db.collection(GAM.wishlist).find({ pupilId }, { projection: { _id: 0, itemId: 1 } }).sort({ addedAt: 1 }).toArray(),
    db
      .collection<ShopItem>(GAM.shopItems)
      .find({ deletedAt: null }, { projection: { _id: 0, id: 1, name: 1, kind: 1, discountPercent: 1, priceCoins: 1, audience: 1 } })
      .toArray(),
    // Guruh reytingi (joriy oy) — o'quvchi a'zo bo'lgan faol guruhlar.
    db
      .collection<GroupDoc>("groups")
      .find({ studentIds: pupilId, status: "active" }, { projection: { _id: 0, id: 1, name: 1, course: 1, level: 1, teacher: 1, branchId: 1, studentIds: 1, status: 1 } })
      .toArray()
      .then((gs) =>
        Promise.all(
          gs.map(async (g) => {
            const rk = await groupRanking(db, toGamGroup(g), month);
            const me = rk.find((r) => r.pupilId === pupilId);
            // Hali tanga olmagan bo'lsa o'rin ko'rsatilmaydi — hammasi 0 da «1-o'rin» chalg'itardi.
            return me && me.points > 0 ? { groupId: g.id, title: groupTitle(g), rank: me.rank, total: rk.length } : null;
          }),
        ),
      ),
  ]);
  if (!settings.enabled || !settings.startDate) return null;

  let bestRank: CabinetCoins["bestRank"] = null;
  for (const r of ranks) if (r && (!bestRank || r.rank < bestRank.rank)) bestRank = r;
  const balance = Number(wallet?.balance) || 0;
  const toifa = toifaOf(gradeOf(pupil), pupil.category, settings.kidsMaxGrade);
  let wish: CabinetCoins["wish"] = null;
  for (const w of wishes) {
    const it = items.find((i) => i.id === Number(w.itemId));
    if (!it || !fitsAudience(it.audience, toifa)) continue;
    wish = { title: itemTitle(it), price: it.priceCoins, ready: balance >= it.priceCoins };
    break;
  }
  return { balance, monthEarned: Number(earned[0]?.s) || 0, bestRank, wish };
}

async function loadResults(db: Db, pupilId: number): Promise<CabinetResult[]> {
  const exams = (await db
    .collection("group_exams")
    .find(
      { "students.pupilId": pupilId, archived: { $ne: true } },
      { projection: { _id: 0, id: 1, date: 1, month: 1, course: 1, level: 1, groupId: 1, groupName: 1, groupLabel: 1, total: 1, students: 1, avgPct: 1, teacher: 1, branchId: 1 } },
    )
    .sort({ date: -1, id: -1 })
    .limit(RESULTS_LIMIT)
    .toArray()) as unknown as GroupExam[];
  const out: CabinetResult[] = [];
  for (const e of exams) {
    const students = Array.isArray(e.students) ? e.students : [];
    const me = students.find((s) => Number(s.pupilId) === pupilId);
    if (!me) continue;
    const mine = Number(me.correct) || 0;
    const course = String(e.course ?? "").trim();
    const level = String(e.level ?? "").trim();
    const title =
      Number(e.groupId) === GROUPLESS_GROUP_ID
        ? course || String(e.groupLabel ?? "")
        : course && level
          ? `${course} · ${level}`
          : String(e.groupLabel ?? "") || course;
    out.push({
      examId: Number(e.id),
      date: String(e.date ?? ""),
      month: YM.test(String(e.month ?? "")) ? String(e.month) : String(e.date ?? "").slice(0, 7),
      title,
      course,
      correct: mine,
      total: Number(e.total) || 0,
      pct: Math.round(Number(me.pct) || 0),
      groupAvg: Math.round(Number(e.avgPct) || 0),
      // Teng natija — teng o'rin (1, 2, 2, 4).
      rank: 1 + students.filter((s) => (Number(s.correct) || 0) > mine).length,
      participants: students.length,
      groupId: Number(e.groupId) || 0,
      teacher: String(e.teacher ?? ""),
      branchAvg: null,
    });
  }
  // Filial o'rtachasi (44-qism): shu oy + shu fan + shu filialdagi barcha Sarhisob natijalari (o'quvchilar foizi o'rtachasi).
  const keys = [...new Map(exams.map((e) => [`${e.branchId}|${e.month}|${e.course}`, e])).values()];
  if (keys.length) {
    const peers = (await db
      .collection("group_exams")
      .find(
        { archived: { $ne: true }, $or: keys.map((e) => ({ branchId: e.branchId, month: e.month, course: e.course })) },
        { projection: { _id: 0, branchId: 1, month: 1, course: 1, students: 1 } },
      )
      .toArray()) as unknown as GroupExam[];
    const avg = new Map<string, number>();
    for (const k of keys) {
      const key = `${k.branchId}|${k.month}|${k.course}`;
      const pcts = peers
        .filter((x) => `${x.branchId}|${x.month}|${x.course}` === key)
        .flatMap((x) => (Array.isArray(x.students) ? x.students : []).map((st) => Number(st.pct) || 0));
      if (pcts.length) avg.set(key, Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length));
    }
    exams.forEach((e) => {
      const r = out.find((x) => x.examId === Number(e.id));
      if (r) r.branchAvg = avg.get(`${e.branchId}|${e.month}|${e.course}`) ?? null;
    });
  }
  return out;
}

/** 44-qism: oxirgi 5 oy davomati (joriy oy bilan) — Darslar → Davomat → «Oylar bo'yicha». */
async function loadAttendanceHistory(db: Db, pupilId: number, current: string): Promise<CabinetAttendanceMonth[]> {
  const months = [-4, -3, -2, -1, 0].map((n) => shiftMonth(current, n));
  const rows = await db
    .collection("attendance")
    .find({ pupilId, date: { $gte: `${months[0]}-01`, $lte: `${current}-31` } }, { projection: { _id: 0, date: 1, status: 1 } })
    .toArray();
  return months.map((month) => {
    let came = 0;
    let excused = 0;
    let missed = 0;
    for (const r of rows) {
      if (!String(r.date ?? "").startsWith(month)) continue;
      const m = markOf(r.status);
      if (m === null) continue;
      if (cameStatus(m)) came += 1;
      else if (m === "sababli") excused += 1;
      else if (m === "sababsiz") missed += 1;
    }
    const total = came + excused + missed;
    return { month, came, excused, missed, total, percent: total ? Math.round((came / total) * 100) : null };
  });
}

/**
 * Bitta o'quvchining yangi kabineti. `now` — sinov uchun (sukut: hozir, Toshkent).
 */
export async function buildStudentCabinet(db: Db, pupil: Pupil, now: Date = new Date()): Promise<StudentCabinet> {
  const today = uzDateIso(now);
  const nowHm = uzTimeHm(now);
  const current = today.slice(0, 7);
  const nextMonth = shiftMonth(current, 1);
  const list = [-4, -3, -2, -1, 0, 1].map((n) => shiftMonth(current, n));
  const lessonsFrom = `${shiftMonth(current, -1)}-01`;
  const lessonsTo = addDays(today, LESSONS_AHEAD_DAYS);
  const curBounds = monthBounds(current);
  const name = pupilFullName(pupil).trim();
  const ref = { id: pupil.id, name };
  const branchId = Number((pupil as { branchId?: unknown }).branchId) || 1;
  const ownList = { $and: [pupilEntryMatch(ref), { $or: [{ txType: "payIn" }, { txType: "payOut", studentRefund: true }] }] };

  // Tangalar — boshqa hisobga bog'liq emas, birinchi bo'lib boshlanadi (`.catch` darhol: keyin kutiladi).
  const coinsP = loadCoins(db, pupil, current).catch((e) => {
    console.error("[student-cabinet] coins", e);
    return null;
  });

  const [memberships, currentDocs, courses, paidRows, entryRows, entryCount, marks, branchDoc, profileDoc, results] = await Promise.all([
    db
      .collection<GroupMembership>(GROUP_MEMBERSHIPS)
      .find({ pupilId: pupil.id }, { projection: { _id: 0, groupId: 1, joinedAt: 1, leftAt: 1 } })
      .toArray(),
    db.collection<GroupDoc>("groups").find({ studentIds: pupil.id }, { projection: { _id: 0 } }).toArray(),
    db.collection<PricedCourse>("offline_courses").find({}, { projection: { _id: 0, name: 1, branches: 1, levels: 1 } }).toArray(),
    // To'langan — computeDebtors bilan bir xil shart, shu o'quvchiga kesilgan; egasi pastda
    // `isPaidBy` bilan aniqlanadi (hisobotdagi bog'lash qoidasi).
    db
      .collection("transaction_entries")
      .find<PaidRow>(
        { $and: [paidMatch(null, today), pupilEntryMatch(ref)] },
        { projection: { _id: 0, pupilId: 1, studentName: 1, amount: 1, discountSom: 1, periodMonth: 1, date: 1, txType: 1 } },
      )
      .toArray(),
    db
      .collection("transaction_entries")
      .find(ownList, {
        projection: { _id: 0, id: 1, date: 1, time: 1, amount: 1, discountSom: 1, paymentType: 1, periodMonth: 1, cashboxId: 1, status: 1, txType: 1, studentRefund: 1 },
      })
      .sort({ date: -1, time: -1, id: -1 })
      .limit(PAYMENTS_LIMIT)
      .toArray() as unknown as Promise<(TransactionEntry & { cashboxId?: number; periodMonth?: string; status?: string })[]>,
    db.collection("transaction_entries").countDocuments(ownList),
    db
      .collection("attendance")
      .find(
        { pupilId: pupil.id, date: { $gte: lessonsFrom, $lte: maxIso(lessonsTo, curBounds.to) } },
        { projection: { _id: 0, groupId: 1, date: 1, status: 1, reason: 1, grade: 1 } },
      )
      .toArray(),
    db.collection("branches").findOne({ id: branchId }, { projection: { _id: 0, name: 1, location: 1, address: 1, phone: 1 } }),
    db.collection("center_profile").findOne({ key: "main" }, { projection: { _id: 0, receipt: 1 } }),
    loadResults(db, pupil.id),
  ]);
  const attendanceHistory = await loadAttendanceHistory(db, pupil.id, current).catch(() => []);

  // Hozirgi guruhlar (arxivlangani — yo'q). Kassa nomlari kutmasdan boshlanadi.
  const currentGroups = currentDocs.filter((g) => (g.status || "") !== "archive").sort((a, b) => a.id - b.id);
  const cashboxIds = [...new Set(entryRows.map((e) => Number(e.cashboxId)).filter(Number.isFinite))];
  // `.catch` SHU YERDA: va'da keyinroq kutiladi — oraliqda rad etilsa «unhandled rejection» bo'lmasin.
  const cashboxesP = cashboxIds.length
    ? db
        .collection("cashboxes")
        .find({ id: { $in: cashboxIds } }, { projection: { _id: 0, id: 1, name: 1 } })
        .toArray()
        .catch(() => [])
    : Promise.resolve([]);

  // ── Guruh hujjatlari: hozirgilar + a'zolik tarixidagilar (+ davomatdagi eski guruhlar nomi uchun).
  const groupById = new Map<number, GroupDoc>(currentDocs.map((g) => [g.id, g]));
  const extraIds = [...new Set([...memberships.map((m) => m.groupId), ...marks.map((m) => Number(m.groupId))])].filter(
    (id) => Number.isFinite(id) && !groupById.has(id),
  );
  // Arxiv kolleksiyasi — faqat NOM uchun (hisobga kirmaydi: computeDebtors ham faqat `groups` ni ko'radi).
  const archivedById = new Map<number, GroupDoc>();
  if (extraIds.length) {
    const [more, old] = await Promise.all([
      db.collection<GroupDoc>("groups").find({ id: { $in: extraIds } }, { projection: { _id: 0, studentIds: 0 } }).toArray(),
      db.collection<GroupDoc>(ARCHIVED_GROUPS_COLLECTION).find({ id: { $in: extraIds } }, { projection: { _id: 0, studentIds: 0 } }).toArray(),
    ]);
    for (const g of more) groupById.set(g.id, g);
    for (const g of old) archivedById.set(g.id, g);
  }

  const priceByGroup = new Map<number, number | null>();
  const monthlyOf = (g: GroupDoc): number | null => {
    if (!priceByGroup.has(g.id)) priceByGroup.set(g.id, monthlyPriceFor(g, courses));
    return priceByGroup.get(g.id) ?? null;
  };

  // ── Hisob: a'zolik oraliqlari (computeDebtors bilan bir xil chegaralar).
  const spans: { g: GroupDoc; span: MembershipSpan }[] = [];
  for (const m of memberships) {
    const g = groupById.get(m.groupId);
    if (!g) continue;
    const span = membershipSpan(g, m, pupil, today, monthlyOf(g));
    if (span) spans.push({ g, span });
  }
  const incomplete = spans.some((s) => s.span.issues.length > 0);

  const cellByKey = new Map<string, Cell>();
  const addCharge = (groupId: number, month: string, amount: number) => {
    const key = `${month}|${groupId}`;
    const c = cellByKey.get(key);
    if (c) c.charge += amount;
    else cellByKey.set(key, { groupId, month, charge: amount, covered: 0 });
  };
  const expectedByGroup = new Map<number, number>();
  const next = monthBounds(nextMonth);
  for (const { g, span } of spans) {
    const { ok, start, end, bound, lessonPrice } = span;
    if (!ok || start === null || lessonPrice === null) continue;
    // Oylarga bo'lish — computeDebtors → addMonthCharges bilan bir xil.
    for (let mk = start.slice(0, 7); start <= end && mk <= end.slice(0, 7); mk = shiftMonth(mk, 1)) {
      const b = monthBounds(mk);
      const n = lessonDaysBetween(g.day, maxIso(b.from, start), minIso(b.to, end)).count;
      if (n > 0) addCharge(g.id, mk, n * lessonPrice);
    }
    // Kelgusi oy — oyning hamma dars kunlari a'zolik/guruh chegarasi ichida
    // (computeDebtors → oy jamlanmasi bilan bir xil).
    const inNext = lessonDaysBetween(g.day, maxIso(next.from, start), minIso(next.to, bound)).count;
    if (inNext > 0) expectedByGroup.set(g.id, (expectedByGroup.get(g.id) ?? 0) + inNext * lessonPrice);
  }
  const cells = [...cellByKey.values()];
  const charged = cells.reduce((s, c) => s + c.charge, 0);

  // ── To'langan (hisob sanasigacha) — oylar bo'yicha.
  const paidByMonth = new Map<string, number>();
  let paidTotal = 0;
  let paidCount = 0;
  let paidSince: string | null = null;
  for (const e of paidRows) {
    if (!isPaidBy(paidOwnerOf(e.pupilId, e.studentName), pupil)) continue;
    const v = entryPaidAmount(e);
    paidTotal += v;
    const mo = periodOf(e);
    paidByMonth.set(mo, (paidByMonth.get(mo) ?? 0) + v);
    if (e.txType === "payIn") {
      paidCount += 1;
      const d = String(e.date ?? "");
      if (d && (paidSince === null || d < paidSince)) paidSince = d;
    }
  }
  const balance = charged - paidTotal;
  const excess = allocate(cells, paidByMonth);

  // ── Oylar jadvali.
  const rowIds = new Set<number>(currentGroups.map((g) => g.id));
  for (const c of cells) if (c.charge > 0 && c.month >= list[0] && c.month <= current) rowIds.add(c.groupId);
  const rows: CabinetMonthRow[] = [...rowIds]
    .sort((a, b) => a - b)
    .map((gid) => {
      const g = groupById.get(gid);
      const monthlyPrice = g ? monthlyOf(g) : null;
      return {
        groupId: gid,
        title: g ? groupTitle(g) : `#${gid}`,
        course: String(g?.course ?? ""),
        monthlyPrice,
        cells: list.map((month): CabinetMonthCell => {
          if (month === nextMonth) {
            const expected = expectedByGroup.get(gid) ?? 0;
            return { month, state: expected > 0 ? "future" : "none", charge: 0, covered: 0, remaining: 0, expected };
          }
          const c = cellByKey.get(`${month}|${gid}`);
          const charge = c?.charge ?? 0;
          const covered = c?.covered ?? 0;
          return { month, state: cellState(charge, covered), charge, covered, remaining: Math.max(0, charge - covered), expected: 0 };
        }),
      };
    });
  const remainingByMonth = list.map((_, i) => rows.reduce((s, r) => s + r.cells[i].remaining, 0));
  const olderRemaining = cells.filter((c) => c.month < list[0]).reduce((s, c) => s + Math.max(0, c.charge - c.covered), 0) + excess;
  const months: CabinetMonths = { list, current, rows, remainingByMonth, olderRemaining };

  // ── Qarz guruhlar bo'yicha (hamma oylar, jadvaldan oldingilari ham).
  const partByGroup = new Map<number, CabinetDebtPart>();
  for (const c of [...cells].sort((a, b) => a.month.localeCompare(b.month))) {
    const rem = Math.max(0, c.charge - c.covered);
    if (rem <= 0) continue;
    const g = groupById.get(c.groupId);
    const part = partByGroup.get(c.groupId);
    if (part) {
      part.remaining += rem;
      part.charged += c.charge;
    } else {
      partByGroup.set(c.groupId, {
        groupId: c.groupId,
        title: g ? groupTitle(g) : `#${c.groupId}`,
        course: String(g?.course ?? ""),
        remaining: rem,
        since: c.month,
        charged: c.charge,
      });
    }
  }
  const debt: CabinetDebt = {
    asOf: today,
    balance,
    total: Math.max(0, balance),
    advance: Math.max(0, -balance),
    parts: [...partByGroup.values()].sort((a, b) => b.remaining - a.remaining || a.groupId - b.groupId),
    incomplete,
  };

  // ── Guruhlar (hozirgi a'zolik).
  const openJoined = new Map<number, string | null>();
  for (const m of memberships) {
    if (isoDateOrNull(m.leftAt) !== null) continue;
    const j = isoDateOrNull(m.joinedAt);
    const prev = openJoined.get(m.groupId);
    if (prev === undefined || (j !== null && (prev === null || j > prev))) openJoined.set(m.groupId, j);
  }
  const groups: CabinetGroup[] = currentGroups.map((g) => {
    const t = parseTime(g.time);
    return {
      id: g.id,
      title: groupTitle(g),
      label: groupLabel(g),
      course: String(g.course ?? ""),
      level: String(g.level ?? ""),
      teacher: String(g.teacher ?? ""),
      room: String(g.room ?? ""),
      day: String(g.day ?? ""),
      weekdays: groupWeekdays(g.day),
      start: t.start,
      end: t.end,
      monthlyPrice: monthlyOf(g),
      status: String(g.status ?? ""),
      joinedAt: openJoined.get(g.id) ?? null,
    };
  });

  // ── Darslar: hozirgi guruhlar jadvali (a'zolik/guruh oynasi ichida) + oynadagi davomat belgilari.
  const markByKey = new Map<string, Document>();
  for (const mk of marks) {
    const d = String(mk.date ?? "");
    if (d >= lessonsFrom && d <= lessonsTo) markByKey.set(`${Number(mk.groupId)}|${d}`, mk);
  }
  const lessonOf = (g: GroupDoc | undefined, groupId: number, date: string): CabinetLesson => {
    const t = parseTime(g?.time);
    const mk = markByKey.get(`${groupId}|${date}`);
    const mark = mk ? markOf(mk.status) : null;
    const grade = Number(mk?.grade);
    return {
      date,
      weekday: weekdayOf(date),
      groupId,
      title: g ? groupTitle(g) : `#${groupId}`,
      course: String(g?.course ?? ""),
      start: t.start,
      end: t.end,
      room: String(g?.room ?? ""),
      teacher: String(g?.teacher ?? ""),
      mark,
      reason: mk && typeof mk.reason === "string" && mk.reason.trim() ? mk.reason.trim() : null,
      grade: Number.isInteger(grade) && grade >= 1 && grade <= 5 ? grade : null,
    };
  };
  const items: CabinetLesson[] = [];
  const seen = new Set<string>();
  for (const g of currentGroups) {
    const status = g.status || "";
    if (status === NOT_STARTED_STATUS || status === "frozen") continue;
    const weekdays = groupWeekdays(g.day);
    if (weekdays.length === 0) continue;
    // Oynalar: shu guruhdagi a'zoliklar; a'zolik yozuvi yo'q bo'lsa — guruh muddati.
    const own = memberships.filter((m) => m.groupId === g.id);
    const windows: { from: string; to: string }[] = own.length
      ? own.map((m) => {
          const s = membershipSpan(g, m, pupil, lessonsTo, null);
          return { from: maxIso(lessonsFrom, s?.start ?? null), to: minIso(lessonsTo, s?.bound ?? null) };
        })
      : [{ from: maxIso(lessonsFrom, groupStartIso(g)), to: minIso(lessonsTo, groupEndIso(g)) }];
    for (const w of windows) {
      for (let d = w.from; d <= w.to; d = addDays(d, 1)) {
        if (!weekdays.includes(weekdayOf(d))) continue;
        const key = `${g.id}|${d}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(lessonOf(g, g.id, d));
      }
    }
  }
  // Jadvalga tushmagan belgilar (ko'chirilgan dars, chiqib ketgan guruh).
  for (const key of markByKey.keys()) {
    if (seen.has(key)) continue;
    const [gidRaw, date] = key.split("|");
    const gid = Number(gidRaw);
    if (markOf(markByKey.get(key)?.status) === null) continue;
    seen.add(key);
    items.push(lessonOf(groupById.get(gid) ?? archivedById.get(gid), gid, date));
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.groupId - b.groupId);
  const upcoming = items.find((l) => l.date > today || (l.date === today && l.start !== "" && l.start > nowHm)) ?? null;

  // ── Joriy oy davomati.
  let came = 0;
  let excused = 0;
  let missed = 0;
  for (const mk of marks) {
    const d = String(mk.date ?? "");
    if (d < curBounds.from || d > curBounds.to) continue;
    const m = markOf(mk.status);
    if (m === null) continue;
    if (cameStatus(m)) came += 1;
    else if (m === "sababli") excused += 1;
    else if (m === "sababsiz") missed += 1;
  }
  const marked = came + excused + missed;
  const attendance: CabinetAttendance = {
    month: current,
    came,
    excused,
    missed,
    total: marked,
    percent: marked > 0 ? Math.round((came / marked) * 100) : null,
  };

  // ── To'lov tarixi (bekor qilinganlar ham — belgisi bilan).
  const cashboxName = new Map<number, string>();
  for (const b of await cashboxesP) cashboxName.set(Number(b.id), String(b.name ?? ""));
  const payments: CabinetPayment[] = entryRows.map((e) => ({
    id: Number(e.id),
    date: String(e.date ?? ""),
    time: String(e.time ?? "").slice(0, 5),
    amount: Number(e.amount) || 0,
    discount: Number(e.discountSom) || 0,
    paymentType: String(e.paymentType ?? ""),
    periodMonth: periodOf(e),
    cashbox: cashboxName.get(Number(e.cashboxId)) ?? "",
    cancelled: e.status === "cancelled",
    refund: isStudentRefundEntry(e),
  }));

  const coins = await coinsP;

  const branch = receiptBranchOf(branchDoc);
  return {
    today,
    now: nowHm,
    firstName: String(pupil.firstName ?? "").trim() || name,
    branch,
    receipt: { profile: cleanReceiptProfile(profileDoc?.receipt), branch },
    groups,
    lessons: { from: lessonsFrom, to: lessonsTo, items },
    upcoming,
    debt,
    months,
    nextMonth: {
      month: nextMonth,
      expected: [...expectedByGroup.values()].reduce((s, v) => s + v, 0),
      groups: [...expectedByGroup.values()].filter((v) => v > 0).length,
    },
    paid: { total: paidTotal, count: paidCount, since: paidSince },
    payments,
    paymentsTotal: entryCount,
    attendance,
    coins,
    results,
    attendanceHistory,
  };
}
