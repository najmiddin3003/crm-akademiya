import { groupWeekdays, type AttendanceStatus } from "@/lib/attendance";
import {
  markCame,
  monthBoundsOf,
  shiftMonthKey,
  type ProfileEntry,
  type ProfileGroup,
  type ProfileMark,
  type PupilProfilePayload,
} from "@/lib/pupilProfile";

// YANGI VERSIYA — O'QUVCHI SAHIFASINING HISOBLARI (sof funksiyalar, React'siz):
// to'lovni guruhga bog'lash, «Oylar bo'yicha» jadvali, qarzdorlik, oylik to'lov,
// davomat statistikasi va keyingi dars. Ma'lumot — GET /api/pupils/:id/profile.
//
// QARZ QOIDASI (rasm «O'quvchi sahifasi · To'lovlar», 23.10.2026; SAVOLLAR 149):
// har oy uchun to'lanadigan summa — guruhning OYLIK narxi (oy o'rtasida qo'shilgan/
// chiqqan bo'lsa darslar ulushi, serverda); qarz = joriy oygacha (shu oy ham) shu
// summalar − shu oylar uchun to'langan (`periodMonth`). Kelgusi oy — reja, qarzga
// kirmaydi; kelgusi oy uchun oldindan to'langani ham joriy qarzni kamaytirmaydi.
// Qarz SOF — Qarzdorlar hisobotidagi (lib/debtors.ts, 20.09.2026 kelishuvi) kabi
// «hisoblangan − to'langan»: bir oyda ortiqcha to'langani (masalan oy o'rtasida
// qo'shilib, oyni to'liq to'lagan) boshqa oy qarzidan ayriladi. Jadvalda esa har oy
// o'z to'lovi bilan turadi — farq `offset` (ortiqcha to'lov) bo'lib alohida
// ko'rsatiladi: debt = max(0, monthDebtSum − offset). Hisobotdan farqi: u bugungacha
// o'tgan darslarni sanaydi, bu yerda joriy oy butunligicha.
//
// NARXI NOMA'LUM GURUH (kursga narx kiritilmagan — issue "price"): uning oylari
// hisoblanmaydi va unga yozilgan to'lov ham qarzga qarshi qo'yilmaydi (nimaga
// qarshi — noma'lum); aks holda to'lov «oldindan to'langan» bo'lib ko'rinardi.
// Bunday holat `incomplete` — sahifa «hisob to'liq emas» deb ochiq aytadi.

const norm = (s: string) => (s || "").trim().toLowerCase();

/** Hisobga kiradigan yozuv — bekor qilinmagan. */
export const isActiveEntry = (e: ProfileEntry) => e.status !== "cancelled";

/** Hisob yuritiladigan guruhlar — oylari bor yoki hozir a'zo. */
function billableGroups(groups: ProfileGroup[]): ProfileGroup[] {
  return groups.filter((g) => g.months.length > 0 || g.current);
}

/**
 * To'lov qaysi guruh uchun. Kirim yozuvida guruh yozilmaydi (lib/cashboxAdjust.ts →
 * `group: ""`), faqat ustoz (`teacherName`) — o'quvchining guruhlaridan USTOZI shu
 * bo'lgan YAGONA guruh; o'quvchining bitta guruhi bo'lsa — o'sha. Aniqlab bo'lmasa — null.
 */
export function entryGroupId(e: ProfileEntry, groups: ProfileGroup[]): number | null {
  const list = billableGroups(groups);
  if (list.length === 1) return list[0].id;
  const t = norm(e.teacherName);
  if (!t) return null;
  const byTeacher = list.filter((g) => norm(g.teacher) === t);
  return byTeacher.length === 1 ? byTeacher[0].id : null;
}

export type CellState = "paid" | "partial" | "debt" | "future" | "none" | "noprice";

export interface MonthCell {
  month: string;
  /** To'lanadigan summa; narx noma'lum — null. */
  expected: number | null;
  paid: number;
  /** Qolgan qarz (≥ 0). */
  remaining: number;
  /** Shu oy uchun ortiqcha to'langan (paid − expected, ≥ 0). */
  extra: number;
  /** Shu oyda a'zolik ichidagi darslar / oyning hamma darslari (qisman oy izohi uchun). */
  lessons: number;
  fullLessons: number;
  state: CellState;
}

export interface LedgerRow {
  group: ProfileGroup;
  cells: Record<string, MonthCell>;
}

export interface Ledger {
  curMonth: string;
  /** Jadvalda ko'rinadigan oylar (oxirgi 5 ta + kelgusi). */
  months: string[];
  rows: LedgerRow[];
  /** Guruhga bog'lab bo'lmagan va qarzga taqsimlanmay qolgan to'lov (oy bo'yicha). */
  unassigned: Record<string, number>;
  /** Oy bo'yicha qolgan qarz (joriy oygacha). */
  monthDebt: Record<string, number>;
  /** Σ monthDebt — oyma-oy qarzlar yig'indisi (joriy oygacha). */
  monthDebtSum: number;
  /**
   * Oyma-oy qarzdan ayriladigan to'lov (joriy oygacha): boshqa oylarda ortiqcha
   * to'langani, guruhga bog'lanmagani, narxi yo'q oy uchun to'langani.
   * debt = max(0, monthDebtSum − offset).
   */
  offset: number;
  /** Jami qarz (joriy oygacha); manfiy bo'lmaydi. */
  debt: number;
  /** Oldindan to'langan (joriy oygacha to'langani hisobdan ko'p bo'lsa). */
  credit: number;
  /** Ko'rinadigan oylardan oldingi qarz. */
  olderDebt: number;
  /** Qarzi bor guruhlar soni (joriy oygacha). */
  debtGroups: number;
  /** Joriy oyning qarzi (barcha guruhlar). */
  curDebt: number;
  /** Hozirgi guruhlarning oylik narxlari. */
  feeParts: number[];
  monthlyFee: number;
  /** Bekor qilinmagan to'lovlar (qaytarimlar ayrilgan). */
  totalPaid: number;
  paymentsCount: number;
  /** Birinchi to'lov oyi ("YYYY-MM"); to'lov yo'q — null. */
  firstPaidMonth: string | null;
  /** Hisob umuman yuritilmaydimi (to'lanadigan oy yo'q). */
  empty: boolean;
  /** Narxi ma'lum, hisob yuritiladigan guruhlar soni. */
  priced: number;
  /** Hisob to'liq emas — muammoli guruh bor (narx, boshlanish sanasi yoki jadval yo'q). */
  incomplete: boolean;
  /** Muammoli guruhlar (hozirgi yoki hisob oylari bo'lganlar). */
  issueGroups: ProfileGroup[];
  /** Narxi noma'lum guruhlarga yozilgan to'lov (hisobga kirmagan, joriy oygacha). */
  unpricedPaid: number;
}

export function buildLedger(groups: ProfileGroup[], entries: ProfileEntry[], asOf: string): Ledger {
  const curMonth = asOf.slice(0, 7);
  const nextMonth = shiftMonthKey(curMonth, 1);
  const active = entries.filter(isActiveEntry);
  const billable = billableGroups(groups);

  // To'langan — guruh × oy (bog'lanmaganlari `0` kalitida).
  const paidBy = new Map<number, Map<string, number>>();
  const add = (gid: number, mk: string, v: number) => {
    let m = paidBy.get(gid);
    if (!m) paidBy.set(gid, (m = new Map()));
    m.set(mk, (m.get(mk) ?? 0) + v);
  };
  for (const e of active) add(entryGroupId(e, groups) ?? 0, e.periodMonth, e.paid);

  // Ko'rinadigan oylar: eng erta oy (guruh yoki to'lov), lekin ko'pi bilan 5 ta oxirgi + kelgusi.
  const firsts = [
    ...billable.map((g) => g.months[0]?.month).filter((x): x is string => !!x),
    ...active.map((e) => e.periodMonth),
  ].filter((x) => x <= nextMonth);
  const earliest = firsts.length ? firsts.reduce((a, b) => (b < a ? b : a)) : curMonth;
  const from = earliest > shiftMonthKey(curMonth, -4) ? earliest : shiftMonthKey(curMonth, -4);
  const months: string[] = [];
  for (let mk = from > curMonth ? curMonth : from; mk <= nextMonth; mk = shiftMonthKey(mk, 1)) months.push(mk);

  // Qatorlar (hamma oylar bo'yicha — qarz ko'rinmaydigan oylarda ham sanaladi).
  const rows: LedgerRow[] = billable.map((g) => {
    const cells: Record<string, MonthCell> = {};
    for (const m of g.months) {
      const paid = paidBy.get(g.id)?.get(m.month) ?? 0;
      cells[m.month] = { month: m.month, expected: m.expected, paid, remaining: 0, extra: 0, lessons: m.lessons, fullLessons: m.fullLessons, state: "none" };
    }
    return { group: g, cells };
  });

  // Bog'lanmagan to'lov — o'sha oyda qarzi bor guruhlarga (tartib bo'yicha) taqsimlanadi.
  const unassigned: Record<string, number> = {};
  for (const [mk, v] of paidBy.get(0) ?? []) {
    let left = v;
    for (const r of rows) {
      if (left <= 0) break;
      const c = r.cells[mk];
      if (!c || c.expected === null) continue;
      const need = c.expected - c.paid;
      if (need <= 0) continue;
      const take = Math.min(need, left);
      c.paid += take;
      left -= take;
    }
    if (left !== 0) unassigned[mk] = left;
  }

  // Holatlar.
  let charged = 0;
  const groupHasDebt = new Set<number>();
  const monthDebt: Record<string, number> = {};
  for (const r of rows) {
    for (const c of Object.values(r.cells)) {
      const due = c.month <= curMonth;
      if (c.expected === null) {
        c.state = c.paid > 0 ? "paid" : "noprice";
        continue;
      }
      c.remaining = Math.max(0, c.expected - c.paid);
      c.extra = Math.max(0, c.paid - c.expected);
      if (due) charged += c.expected;
      if (c.paid >= c.expected) c.state = "paid";
      else if (!due) c.state = "future";
      else if (c.paid > 0) c.state = "partial";
      else c.state = "debt";
      if (due && c.remaining > 0) {
        groupHasDebt.add(r.group.id);
        monthDebt[c.month] = (monthDebt[c.month] ?? 0) + c.remaining;
      }
    }
  }
  // Bog'lanmagan ortiqcha to'lov shu oy qarzidan ayriladi (taqsimlab bo'lmagani — boshqa oy qarzi).
  for (const [mk, v] of Object.entries(unassigned)) {
    if (mk <= curMonth && monthDebt[mk]) monthDebt[mk] = Math.max(0, monthDebt[mk] - v);
  }

  // Joriy oygacha to'langan — narxi noma'lum guruhga yozilgani (yoki bog'lanmagan, lekin
  // narxi ma'lum guruh umuman yo'q) hisobga kirmaydi (yuqoridagi izoh).
  const pricedIds = new Set(billable.filter((g) => g.monthlyPrice !== null).map((g) => g.id));
  let paidDue = 0;
  let unpricedPaid = 0;
  for (const e of active) {
    if (e.periodMonth > curMonth) continue;
    const gid = entryGroupId(e, groups);
    const counts = gid === null ? pricedIds.size > 0 : pricedIds.has(gid);
    if (counts) paidDue += e.paid;
    else unpricedPaid += e.paid;
  }
  const balance = charged - paidDue;
  const issueGroups = groups.filter((g) => g.issues.length > 0 && (g.current || g.months.some((m) => m.month <= curMonth)));
  const debt = Math.max(0, balance);
  const credit = Math.max(0, -balance);
  const dueMonths = Object.keys(monthDebt).filter((m) => m <= curMonth);
  const monthDebtSum = dueMonths.reduce((s, m) => s + (monthDebt[m] ?? 0), 0);
  const olderDebt = dueMonths.filter((m) => m < months[0]).reduce((s, m) => s + (monthDebt[m] ?? 0), 0);

  const currentGroups = groups.filter((g) => g.current && g.status !== "archive");
  const feeParts = currentGroups.map((g) => g.monthlyPrice).filter((x): x is number => x !== null);
  const payIns = active.filter((e) => e.txType === "payIn");

  return {
    curMonth,
    months,
    rows,
    unassigned,
    monthDebt,
    monthDebtSum,
    offset: Math.max(0, monthDebtSum - balance),
    debt,
    credit,
    olderDebt,
    debtGroups: groupHasDebt.size,
    curDebt: monthDebt[curMonth] ?? 0,
    feeParts,
    monthlyFee: feeParts.reduce((s, x) => s + x, 0),
    totalPaid: active.reduce((s, e) => s + e.paid, 0),
    paymentsCount: payIns.length,
    firstPaidMonth: payIns.length ? payIns.map((e) => e.date.slice(0, 7)).reduce((a, b) => (b < a ? b : a)) : null,
    empty: rows.every((r) => Object.keys(r.cells).length === 0),
    priced: pricedIds.size,
    incomplete: issueGroups.length > 0,
    issueGroups,
    unpricedPaid,
  };
}

/** Qarzi bor oylar (joriy oygacha), eskisi birinchi. */
export function debtMonthsOf(ledger: Ledger): string[] {
  return Object.keys(ledger.monthDebt)
    .filter((m) => m <= ledger.curMonth && (ledger.monthDebt[m] ?? 0) > 0)
    .sort();
}

/** «To'lash» uchun birinchi qarz katagi: eng eski qarzli oy, guruhlar tartibida. */
export function firstDebtCell(ledger: Ledger): { groupId: number; month: string; amount: number } | null {
  for (const m of debtMonthsOf(ledger)) {
    for (const r of ledger.rows) {
      const c = r.cells[m];
      if (c && c.remaining > 0 && (c.state === "debt" || c.state === "partial")) return { groupId: r.group.id, month: m, amount: c.remaining };
    }
  }
  return null;
}

/** Oy bo'yicha jamlangan holat (Umumiy → «To'lovlar» qatori): qarz > qisman > kelgusi > to'langan. */
export function monthSummaryState(ledger: Ledger, month: string): CellState {
  const states = ledger.rows.map((r) => r.cells[month]?.state).filter((s): s is CellState => !!s && s !== "none");
  if (states.length === 0) return "none";
  if (states.includes("debt")) return "debt";
  if (states.includes("partial")) return "partial";
  if (states.includes("future")) return "future";
  if (states.includes("noprice")) return "noprice";
  return "paid";
}

// ── Davomat ──────────────────────────────────────────────────────────

/** "YYYY-MM-DD" → mahalliy Date. */
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Guruhning shu oydagi dars kunlari — o'quvchining a'zoligi chegarasida. Yig'ilayotgan guruhda bo'sh. */
export function lessonDaysOf(g: ProfileGroup, month: string): string[] {
  if (g.status === "gathering" || g.startIso === null) return [];
  const weekdays = groupWeekdays(g.day);
  if (weekdays.length === 0) return [];
  const mb = monthBoundsOf(month);
  const from = g.startIso > mb.from ? g.startIso : mb.from;
  const to = g.boundIso !== null && g.boundIso < mb.to ? g.boundIso : mb.to;
  const out: string[] = [];
  for (let d = isoToDate(from), end = isoToDate(to); d <= end; d.setDate(d.getDate() + 1)) {
    if (weekdays.includes(d.getDay())) out.push(dateToIso(d));
  }
  return out;
}

export interface MarkStats {
  came: number;
  absent: number;
  excused: number;
  total: number;
  /** keldi ÷ belgilangan darslar; belgi yo'q — null. */
  pct: number | null;
}

export function markStats(marks: ProfileMark[]): MarkStats {
  let came = 0;
  let absent = 0;
  let excused = 0;
  for (const m of marks) {
    if (markCame(m.status)) came += 1;
    else if (m.status === "sababli") excused += 1;
    else absent += 1;
  }
  const total = came + absent + excused;
  return { came, absent, excused, total, pct: total ? Math.round((came / total) * 100) : null };
}

export const marksOfMonth = (marks: ProfileMark[], month: string, groupId?: number | null) =>
  marks.filter((m) => m.date.startsWith(month) && (groupId == null || m.groupId === groupId));

export interface LessonCell {
  key: string;
  date: string;
  /** Boshlanish soati "HH:MM" yoki "". */
  time: string;
  groupId: number;
  group: ProfileGroup | null;
  /** Belgi; o'tgan, lekin belgilanmagan dars — "unmarked"; hali bo'lmagan — "planned". */
  status: AttendanceStatus | "unmarked" | "planned";
  mark?: ProfileMark;
}

/**
 * Oyning darslari: guruh jadvali (a'zolik chegarasida) + qo'yilgan belgilar (jadvaldan
 * tashqari kun bo'lsa ham). Bugungi dars soati o'tmagan bo'lsa — «rejada».
 */
export function lessonsOfMonth(data: Pick<PupilProfilePayload, "groups" | "marks" | "asOf" | "nowHm">, month: string, groupId?: number | null): LessonCell[] {
  const byKey = new Map<string, LessonCell>();
  const gmap = new Map(data.groups.map((g) => [g.id, g]));
  for (const g of data.groups) {
    if (groupId != null && g.id !== groupId) continue;
    const hm = startHm(g.time);
    for (const d of lessonDaysOf(g, month)) {
      const past = d < data.asOf || (d === data.asOf && !!hm && hm <= data.nowHm);
      const key = `${g.id}:${d}`;
      byKey.set(key, { key, date: d, time: hm, groupId: g.id, group: g, status: past ? "unmarked" : "planned" });
    }
  }
  for (const m of marksOfMonth(data.marks, month, groupId)) {
    const g = gmap.get(m.groupId) ?? null;
    const key = `${m.groupId}:${m.date}`;
    byKey.set(key, { key, date: m.date, time: g ? startHm(g.time) : "", groupId: m.groupId, group: g, status: m.status, mark: m });
  }
  return [...byKey.values()].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) || a.groupId - b.groupId);
}

/** Dars boshlanish soati: "16:00 - 18:00" → "16:00"; bo'lmasa "". */
export function startHm(time: string): string {
  const m = /(\d{1,2}):(\d{2})/.exec(time || "");
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

export interface NextLesson {
  date: string;
  time: string;
  group: ProfileGroup;
}

/** Hozirgi guruhlarning eng yaqin darsi (bugun — soati o'tmagan bo'lsa), 21 kun ichida. */
export function nextLessonOf(groups: ProfileGroup[], asOf: string, nowHm: string): NextLesson | null {
  let best: NextLesson | null = null;
  for (const g of groups) {
    if (!g.current || g.status !== "active" || g.startIso === null) continue;
    const weekdays = groupWeekdays(g.day);
    if (weekdays.length === 0) continue;
    const hm = startHm(g.time);
    for (let i = 0, d = isoToDate(asOf); i < 21; i += 1, d.setDate(d.getDate() + 1)) {
      const iso = dateToIso(d);
      if (iso < g.startIso) continue;
      if (g.boundIso !== null && iso > g.boundIso) break;
      if (!weekdays.includes(d.getDay())) continue;
      if (iso === asOf && hm && hm <= nowHm) continue;
      if (!best || iso < best.date || (iso === best.date && hm < best.time)) best = { date: iso, time: hm, group: g };
      break;
    }
  }
  return best;
}
