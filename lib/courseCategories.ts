// KURS KATEGORIYASI (20.10.2026, «Sozlamalar → O'quv → Kurslar» rasmi) — kurslarni
// guruhlash: «Chet tillari», «Fanlar», «Arab tili». `offline_courses.category` (satr,
// bo'sh — kategoriyasiz). Alohida kolleksiya EMAS: «Kategoriyalar» sahifasining dizayni
// hali kelmagan (design/v2/SAVOLLAR.md 111), ro'yxat kurslarda ishlatilganlardan va
// shu uchta taklifdan yig'iladi; yangisi kurs tahririda yozib qo'shiladi.
//
// O'quvchining narx kategoriyasi (`edu_categories`: «1-4- sinflar», «Chet tili bosqich
// 1/2» …) BOSHQA narsa — u o'quvchi kartasida, bu kursning o'zida.

/** Rasmdagi uchta kategoriya — ro'yxatda doim taklif qilinadi (ishlatilmagan bo'lsa ham). */
export const DEFAULT_COURSE_CATEGORIES = ["Chet tillari", "Fanlar", "Arab tili"] as const;

export const COURSE_CATEGORY_MAX = 40;

/** Chetdagi va ortiqcha probellar olinadi, uzunligi cheklanadi; bo'sh — kategoriyasiz. */
export function normalizeCourseCategory(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, COURSE_CATEGORY_MAX);
}

/** Kurs faolmi — maydon yo'q eski yozuvlar FAOL (20.10.2026 gacha holat bo'lmagan). */
export function courseIsActive(c: { active?: boolean | null }): boolean {
  return c.active !== false;
}

export type CategoryTone = "info" | "success" | "warning" | "violet" | "brand";

const FIXED_TONE: Record<string, CategoryTone> = {
  "chet tillari": "info",
  fanlar: "success",
  "arab tili": "warning",
};
const ROTATION: CategoryTone[] = ["violet", "brand", "info", "success", "warning"];

/**
 * Kategoriya rangi: rasmdagi uchtasi — o'z rangi (Chet tillari ko'k, Fanlar yashil,
 * Arab tili to'q sariq); qolganlari nomidan barqaror (har safar bir xil) tanlanadi.
 */
export function categoryTone(name: string): CategoryTone {
  const key = normalizeCourseCategory(name).toLowerCase();
  if (FIXED_TONE[key]) return FIXED_TONE[key];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ROTATION[h % ROTATION.length];
}
