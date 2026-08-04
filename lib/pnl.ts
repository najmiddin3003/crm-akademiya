// Moliya → Moliya hisobotlari (P&L). Har oy uchun shakl (components/
// finance/PnlReportsPage.tsx haqiqiy `transactions` kolleksiyasidan
// hisoblaydi).
export interface PnlMonthRow {
  month: number;
  otherIncome: number;
  courseIncome: number;
  otherExpense: number;
}
