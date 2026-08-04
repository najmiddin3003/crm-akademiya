// Moliya → Rejalashtirilgan xarajatlar. MongoDB `planned_expenses`
// kolleksiyasi — takrorlanadigan (rejalashtirilgan) xarajatlar ro'yxati.
export interface PlannedExpense {
  id: number;
  name: string;
  amount: number;
  type: string; // "Kunlik" | "Haftalik" | "Oylik" | "Yillik"
  status: string; // "Faol" | "Nofaol"
  startDate: string | null; // "YYYY-MM-DD"
  endDate: string | null;
}
