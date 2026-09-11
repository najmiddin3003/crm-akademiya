// Kurs → bosqichlar (daraja) bog'lanishi. Guruh modallari (klient) va
// POST/PATCH /api/groups (server) shu faylni bo'lishadi.
//
// 11.09.2026 gacha guruh modalidagi "Daraja" ro'yxati constants/groups.js
// dagi QATTIQ ro'yxat edi ("1-bosqich", "Kids 2"…) — Oflayn kurslar
// bo'limida har kursga yozilgan haqiqiy bosqichlar (`offline_courses.levels`:
// Ingliz tili → "Kichik guruh", "IELTS / CEFR tayyorlov"; Matematika →
// "5-8-sinflar", "Milliy sertifikat") u yerga umuman tushmasdi. Endi
// ro'yxat tanlangan kursning o'zidan olinadi.
//
// FILIAL BAYROG'I ATAYIN TEKSHIRILMAYDI: `levels[].branches[].enabled`
// eski importdan qolgan (nomlari ham eskirgan: "Akademiya 2-filial") va
// hozirgi 4 filial bilan mos kelmaydi — u narx uchun, bosqich mavjudligi
// uchun emas. Bosqich kursda bor ekan, har filialda tanlanadi.

/** Kurs hujjatining shu yerda kerak bo'ladigan qismi. */
export interface CourseWithLevels {
  name: string;
  levels?: { name: string }[];
}

const norm = (s: string) => s.trim().toLowerCase();

/** Nomi bo'yicha kurs (katta-kichik harf va chekka bo'shliq farq qilmaydi). */
export function findCourseByName<C extends CourseWithLevels>(courses: C[], name: string): C | undefined {
  const key = norm(name);
  return key ? courses.find((c) => norm(c.name) === key) : undefined;
}

/** Kursning bosqich nomlari (bo'sh nomlar tashlab ketiladi). */
export function courseLevelNames(course: CourseWithLevels | undefined): string[] {
  return (course?.levels ?? []).map((l) => (l.name || "").trim()).filter(Boolean);
}

/** `level` shu kursda bormi (kurs topilmasa — yo'q). */
export function hasCourseLevel(course: CourseWithLevels | undefined, level: string): boolean {
  const key = norm(level);
  return courseLevelNames(course).some((n) => norm(n) === key);
}

/**
 * Bosqich tanlovining birinchi qatori — modal uchun.
 *   kurs tanlanmagan → "Avval kursni tanlang"
 *   kursda bosqich yo'q → "Bu kursda bosqich yo'q"
 *   aks holda → "Bosqichsiz" (bosqich ixtiyoriy)
 */
export function levelPlaceholder(courseSelected: boolean, levelCount: number): string {
  if (!courseSelected) return "Avval kursni tanlang";
  if (levelCount === 0) return "Bu kursda bosqich yo'q";
  return "Bosqichsiz";
}
