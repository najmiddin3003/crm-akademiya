// Boshqaruv → Filiallar (sidebar: Boshqaruv > Filiallar, href
// /management-filiallar). MongoDB `branches` kolleksiyasi.
//
// Nazorat → "Filiallar holati" (lib/branches.ts) bilan aralashtirmang: u
// filiallar bo'yicha METRIKA hisoboti, bu esa filiallarning o'zini
// boshqaradigan ro'yxat (qo'shish/tahrirlash/o'chirish).
export interface ManagementBranch {
  id: number;
  name: string;
  location: string; // o'ngda ko'rinadigan manzil/shahar — bo'sh bo'lishi mumkin
}
