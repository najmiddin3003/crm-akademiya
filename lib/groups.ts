// Guruh (Groups) umumiy tipi — API route'lari va klient komponentlar bo'lishadi.
// MongoDB `groups` kolleksiyasi.
export interface Group {
  id: number;
  name: string; // odatda id ning stringi; qo'shish modalida kiritilishi mumkin
  course: string;
  level: string;
  day: string;
  time: string;
  period: string;
  periodExpired: boolean;
  students: number;
  teacher: string;
  room: string;
  telegram: string | null;
  status: string;
  highlighted: boolean; // bugun davomat qilinmagan → sariq
  eduType?: string; // Ta'lim turi: "Oflayn" | "Onlayn"
  assistant?: string; // Yordamchi o'qituvchi
  startDate?: string;
  endDate?: string;
  studentIds?: number[]; // guruhga qo'shilgan o'quvchilar (pupils.id)
}
