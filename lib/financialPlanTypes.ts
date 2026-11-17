// MOLIYA → «MOLIYAVIY REJA» (32-qism) — klient va server uchun umumiy.
// Server: lib/financialPlan.ts; API: app/api/financial-plan (GET ?tab&month&branch).

export type PlanTab = "revenue" | "expense" | "flow" | "pnl";

export interface RevenueBranchRow {
  branchId: number;
  name: string;
  students: number;
  plan: number;
  received: number;
  overdue: number;
  debtors: number;
  pending: number;
}

export interface RevenueDebtor {
  id: number;
  name: string;
  groups: string;
  debt: number;
  months: number;
}

export interface RevenuePayload {
  ok: true;
  tab: "revenue";
  month: string;
  asOf: string;
  /** Oy tugaganmi (asOf = oy oxiri). */
  closed: boolean;
  totals: { plan: number; received: number; overdue: number; pending: number; expectedToDate: number; students: number; debtors: number };
  branches: RevenueBranchRow[];
  debtors: RevenueDebtor[];
  /** Narxi yoki boshlanish sanasi yo'q guruhlar soni — rejaga kirmagan. */
  issues: number;
}

export interface ExpenseRow {
  name: string;
  /** Rejalashtirilgan xarajatlardan (oylikka keltirilgan); rejada yo'q — null. */
  plan: number | null;
  /** «Oylik» / «Haftalik × 4» … */
  planNote: string;
  spent: number;
  count: number;
  lastDate: string | null;
}

export interface ExpensePayload {
  ok: true;
  tab: "expense";
  month: string;
  totals: { plan: number; spent: number; spentPlanned: number; left: number; unplanned: number; items: number };
  rows: ExpenseRow[];
}

export interface FlowWeek {
  label: string;
  from: string;
  to: string;
  start: number;
  inflow: number;
  outflow: number;
  end: number;
  forecast: boolean;
  /** Eng katta chiqimlar: «Ijara 4 500 000 (5-noyabr)». */
  notes: { name: string; amount: number; date: string }[];
}

export interface FlowPayload {
  ok: true;
  tab: "flow";
  month: string;
  today: string;
  opening: number;
  current: number;
  forecastEnd: number;
  lowest: { amount: number; date: string };
  weeks: FlowWeek[];
}

export interface PnlLine {
  key: string;
  label: string;
  values: number[];
  plan: number | null;
}

export interface PnlPayload {
  ok: true;
  tab: "pnl";
  months: string[];
  /** Oxirgi ustun joriy oy bo'lsa — rejasi ham bor. */
  current: string | null;
  income: PnlLine[];
  expense: PnlLine[];
  totals: { income: number[]; expense: number[]; profit: number[]; planIncome: number | null; planExpense: number | null };
}

export type PlanPayload = RevenuePayload | ExpensePayload | FlowPayload | PnlPayload;

export const PLAN_TABS: { key: PlanTab; label: string; short: string }[] = [
  { key: "revenue", label: "Tushum rejasi", short: "Tushum rejasi" },
  { key: "expense", label: "Xarajat rejasi", short: "Xarajat" },
  { key: "flow", label: "Pul oqimi", short: "Pul oqimi" },
  { key: "pnl", label: "Foyda va zarar", short: "Foyda" },
];
