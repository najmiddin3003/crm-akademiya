// Moliya → Pul oqimi. Har oy uchun kategoriya bo'yicha kirim/chiqim shakli
// (components/finance/CashFlowStatementPage.tsx haqiqiy `transactions`
// kolleksiyasidan hisoblaydi).
export interface MonthlyFlow {
  month: number;
  income: Record<string, number>;
  expense: Record<string, number>;
}
