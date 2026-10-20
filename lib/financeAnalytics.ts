import { HOLAT_STEPS, holatOf, type HolatSource, type LeadHolat, type LeadHolatEvent } from "@/lib/leadHolat";

// MOLIYA ANALITIKASI (yangi versiya, 6-qism — rasmlar «Moliya analitikasi»,
// «Hisobotni yuklab olish», 20.10.2026) — HISOBLAR. Bu fayl `mongodb` ni import
// qilmaydi: mijoz (components/v2/finance/FinanceAnalyticsV2.tsx) ham, server
// (app/api/analytics/leads/route.ts) ham o'qiydi.
//
// PUL — MongoDB `transactions` (Kassalar sahifasidagi Kirim/Chiqim, oylik
// chiqarish; ko'chirma YO'Q — lib/transactionLog.ts), yig'indi serverda
// (/api/transactions/summary). Eski «Pul oqimi» / P&L dagidek: musbat — tushum,
// manfiy — chiqim. BITTA FARQ: bekor qilingan amal («… (bekor qilindi)» — teskari
// yozuv, app/api/transaction-entries/[id]/cancel) o'z TOMONIDAN ayriladi: bekor
// qilingan to'lov tushumni kamaytiradi, chiqimga qo'shilmaydi. Sof foyda ikkala
// usulda ham bir xil (design/v2/SAVOLLAR.md, 100).
//
// LIDLAR — `orders`: davrda KELGAN lid (`created`) qaysi bosqichga yetib bordi.
// «Yetib bordi» — hozirgi holat yoki tarixda bo'lgan eng yuqori bosqich (rad
// etilgan lid rad etilgunicha yetgan bosqichda sanaladi; bekor qilingan o'zgarish
// sanalmaydi; tashlab o'tilgan bosqich — o'tilgan hisoblanadi).

/* ───────────────────────── Sana ───────────────────────── */

/** Kun oralig'i, ikkala chet ham kiradi ("YYYY-MM-DD"). */
export interface DayRange {
  from: string;
  to: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

function fmt(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  return fmt(y, m, d + n);
}

/** Oy oxirimi ("2026-09-30" → true). */
export function isMonthEnd(iso: string): boolean {
  const [y, m, d] = parts(iso);
  return d === daysInMonth(y, m);
}

/** Oyni surish — kun saqlanadi, oyda yo'q bo'lsa oxirgi kun ("03-31" −1 → "02-28"). */
export function shiftMonths(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return fmt(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export function rangeDays(r: DayRange): number {
  return Math.round((Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86_400_000) + 1;
}

export type CompareMode = "prevMonth" | "prevYear" | "prevPeriod" | "none";

/**
 * Solishtiriladigan davr. «O'tgan oy» — xuddi shu kunlar bir oy oldin (1–12-oktyabr →
 * 1–12-sentyabr; butun oy → butun oldingi oy); «O'tgan yil» — 12 oy oldin; «Oldingi
 * davr» — shuncha kun, darhol oldin.
 */
export function compareRange(r: DayRange, mode: CompareMode): DayRange | null {
  if (!ISO.test(r.from) || !ISO.test(r.to) || mode === "none") return null;
  if (mode === "prevPeriod") {
    const to = addDays(r.from, -1);
    return { from: addDays(to, -(rangeDays(r) - 1)), to };
  }
  const n = mode === "prevMonth" ? -1 : -12;
  const from = shiftMonths(r.from, n);
  const shifted = shiftMonths(r.to, n);
  if (isMonthEnd(r.to)) {
    const [y, m] = parts(shifted);
    return { from, to: fmt(y, m, daysInMonth(y, m)) };
  }
  return { from, to: shifted };
}

/** Oxirgi `n` oy, `endIso` oyi bilan tugaydi: ["2026-05", …, "2026-10"]. */
export function lastMonths(endIso: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(shiftMonths(`${endIso.slice(0, 7)}-01`, -i).slice(0, 7));
  return out;
}

/** O'zgarish foizi; oldingi qiymat 0 bo'lsa — null (foiz ma'nosiz). */
export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/* ───────────────────────── Pul ───────────────────────── */

/** /api/transactions/summary qatori (groupBy ga qarab maydonlar bor-yo'q). */
export interface SummaryRow {
  month?: string;
  day?: string;
  category?: string;
  method?: string;
  sign?: "pos" | "neg" | "zero";
  cashbox?: number;
  amount: number;
}

export interface MoneyTotals {
  income: number;
  expense: number;
  net: number;
}

/** Bekor qilish yozuvi (teskari amal) — toifa oxirida «(bekor qilindi)». */
export function isReversal(category: string | undefined): boolean {
  return /\(bekor qilindi\)\s*$/.test(category || "");
}

export function emptyMoney(): MoneyTotals {
  return { income: 0, expense: 0, net: 0 };
}

/** Bitta qatorni yig'indiga qo'shadi (yuqoridagi qoida). Nol — hech qaerga. */
export function addMoney(t: MoneyTotals, r: Pick<SummaryRow, "amount" | "category">): void {
  const a = r.amount;
  if (!a) return;
  const rev = isReversal(r.category);
  if (a > 0) {
    if (rev) t.expense -= a;
    else t.income += a;
  } else if (rev) t.income += a;
  else t.expense -= a;
  t.net = t.income - t.expense;
}

/** Qatorlar yig'indisi — `cashboxes` berilsa faqat o'sha kassalar. */
export function moneyTotals(rows: SummaryRow[], cashboxes: ReadonlySet<number> | null): MoneyTotals {
  const t = emptyMoney();
  for (const r of rows) {
    if (cashboxes && !cashboxes.has(Number(r.cashbox))) continue;
    addMoney(t, r);
  }
  return t;
}

/** Oyma-oy yig'indi (`months` — "YYYY-MM"; ma'lumotsiz oy — nol). */
export function monthlyMoney(rows: SummaryRow[], months: string[], cashboxes: ReadonlySet<number> | null): MoneyTotals[] {
  const by = new Map(months.map((m) => [m, emptyMoney()]));
  for (const r of rows) {
    if (cashboxes && !cashboxes.has(Number(r.cashbox))) continue;
    const cell = r.month ? by.get(r.month) : undefined;
    if (cell) addMoney(cell, r);
  }
  return months.map((m) => by.get(m) as MoneyTotals);
}

/* ───────────────────────── Lidlar ───────────────────────── */

/** Bosqich hisobi o'qiydigan lid maydonlari. */
export interface LeadLike extends HolatSource {
  created?: string;
  source?: string;
  branchId?: number | null;
  holatTarix?: Pick<LeadHolatEvent, "kind" | "holat" | "from">[];
}

/** "19.10.2026 | 14:50" → "2026-10-19"; o'qilmasa "". */
export function createdIso(created: string | undefined): string {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(created || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/**
 * Lid yetib borgan eng yuqori bosqich (0 — Yangi … 3 — Guruhga qo'shildi): hozirgi
 * holat, tarixdagi o'tishlar (bekor qilinganlari chiqariladi) va eski lidning
 * maydonlari (birinchi darsi bor → 2, guruhi bor → 3).
 */
export function reachedStep(o: LeadLike): number {
  let best = 0;
  const bump = (h: LeadHolat | undefined | null) => {
    if (!h) return;
    const i = HOLAT_STEPS.indexOf(h);
    if (i > best) best = i;
  };
  bump(holatOf(o));
  const applied: LeadHolat[] = [];
  for (const e of o.holatTarix ?? []) {
    if (e.kind === "undo") {
      applied.pop();
      continue;
    }
    if (e.kind !== "holat" && e.kind !== "telegram") continue;
    // O'zgarishdan OLDINGI holat — lid unga yetib kelgan edi.
    bump(e.from);
    if (e.holat) applied.push(e.holat);
  }
  for (const h of applied) bump(h);
  if ((o.firstLesson || "").trim()) bump("sinov");
  if (o.groupId) bump("guruh");
  return best;
}

export interface SourceStat {
  source: string;
  total: number;
  /** O'quvchi bo'ldi (guruhga qo'shilgan). */
  joined: number;
}

export interface FunnelStats {
  total: number;
  /** Har bosqichga YETGAN lidlar: [Lidlar, Bog'lanildi, Birinchi dars, Guruhga qo'shildi]. */
  reached: [number, number, number, number];
  joined: number;
  /** Manba bo'yicha, ko'pidan kamiga. */
  sources: SourceStat[];
}

export function funnelOf(leads: LeadLike[]): FunnelStats {
  const reached: [number, number, number, number] = [0, 0, 0, 0];
  const bySource = new Map<string, SourceStat>();
  for (const o of leads) {
    const r = reachedStep(o);
    for (let i = 0; i <= r; i++) reached[i]++;
    const key = (o.source || "").trim() || "—";
    const s = bySource.get(key) ?? { source: key, total: 0, joined: 0 };
    s.total++;
    if (r >= 3) s.joined++;
    bySource.set(key, s);
  }
  // Manbasi yozilmaganlar («—») — doim oxirida.
  const sources = [...bySource.values()].sort(
    (a, b) => Number(a.source === "—") - Number(b.source === "—") || b.total - a.total || b.joined - a.joined || a.source.localeCompare(b.source),
  );
  return { total: leads.length, reached, joined: reached[3], sources };
}

/** Lid KELGAN sana bo'yicha oraliqda (`created`, Toshkent). */
export function leadInRange(o: LeadLike, r: DayRange): boolean {
  const d = createdIso(o.created);
  return !!d && d >= r.from && d <= r.to;
}
