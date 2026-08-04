// Boshqaruv → Rollar (sidebar: Boshqaruv > Rollar, href /management-rollar).
// MongoDB `roles` kolleksiyasi.
//
// "Xodimlar" ustuni saqlanmaydi — u har safar `hr_employees`dan hisoblanadi
// (rol nomi xodimning `turi` yorlig'iga to'g'ri kelsa). Saqlangan son vaqt
// o'tishi bilan haqiqatdan uzilib qolardi.
export interface Role {
  id: number;
  name: string;
  description: string; // Izoh
}
