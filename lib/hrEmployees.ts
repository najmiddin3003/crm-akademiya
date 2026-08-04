// Boshqaruv → Xodimlar (edutizim dizayni) uchun umumiy tip. API route'lari va
// klient komponentlar (ro'yxat, qo'shish modali, profil) shuni bo'lishadi.
// MongoDB `hr_employees` kolleksiyasi — invite oqimidagi `employees`dan ALOHIDA.
export interface HrEmployee {
  id: number;
  name: string;
  gender: string; // "male" | "female"
  aktivOq: number;
  groups: number;
  turi: string; // "teacher" | "moderator" | "admin"
  filial: string;
  phone: string;
  kurs: string;
  created: string;
  lastActive: string;
  archReason: string;
  archDate: string; // "Sana" ustuni — arxivlash sababi qayd etilgan sana
  email?: string;
}
