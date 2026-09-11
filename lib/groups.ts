// Guruh (Groups) umumiy tipi — API route'lari va klient komponentlar bo'lishadi.
// MongoDB `groups` kolleksiyasi.
/**
 * Guruhning ODAM O'QIYDIGAN nomi.
 *
 * NEGA KERAK: `name` bazada odatda shunchaki RAQAM ("13") — u
 * guruhning tartib raqami, nomi emas. O'quvchiga "Guruh: 13" deb
 * ko'rsatilsa bu hech narsa anglatmaydi; mazmunni `course` beradi.
 *
 * Shu bois ikkalasi birlashtiriladi: "Matematika (13-guruh)".
 * Biri bo'lmasa ikkinchisi yolg'iz chiqadi, ikkalasi ham bo'lmasa —
 * id (bo'sh satr qaytarilmaydi, aks holda ro'yxatda teshik qolardi).
 */
export function groupLabel(g: Pick<Group, "id" | "name" | "course">): string {
  const num = (g.name || "").trim();
  const course = (g.course || "").trim();
  if (course && num) return `${course} (${num}-guruh)`;
  if (course) return course;
  if (num) return `${num}-guruh`;
  return `#${g.id}`;
}

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

/**
 * Eski (tugagan) guruhlar ARXIVI — alohida MongoDB kolleksiyasi.
 *
 * 11.09.2026, yangi o'quv mavsumi: `groups` dagi barcha 110 ta guruh
 * (3 filial, 1 592 ta o'quvchi a'zoligi bilan) butunlay shu yerga
 * ko'chirildi — scripts/archive-groups.mjs. Ilova ularni KO'RSATMAYDI,
 * kerak bo'lganda qo'lda yoki skript bilan qaraladi. Hujjat shakli
 * `groups` bilan bir xil, ustiga `archivedAt` qo'shilgan.
 *
 * `id` ketma-ketligi IKKALA kolleksiya bo'yicha global (lib/groupIds.ts):
 * yangi guruh arxivdagi eng katta id'dan keyingi raqamni oladi. Aks holda
 * bo'shagan `groups` da birinchi yangi guruh id=1 olib, arxivdagi
 * 1-guruh bilan chalkashar, arxivni qaytarishda esa `unique` indeks
 * bilan to'qnashar edi.
 */
export const ARCHIVED_GROUPS_COLLECTION = "arxivTugaganGuruhlarimiz";
