// O'quv bo'limi → Onlayn kurs. MongoDB `online_courses` kolleksiyasi.
//
// Ilgari bu turlar OnlineCoursesProvider.tsx ichida edi va kurslar faqat
// xotirada yashardi (sahifa yangilansa yo'qolardi). Endi kurs yaratish
// g'ilofchisi (wizard) rasm/video yuklaydi — yuklangan fayl manzili
// yo'qolib qolmasligi uchun kurslar bazaga ko'chirildi; turlar esa server
// route'lari ham ishlata olishi uchun shu yerga chiqarildi
// (lib/eduCategories.ts bilan bir xil uslub).

export interface CourseSection {
  name: string;
  outcome: string;
}

export interface OnlineCourse {
  id: number;
  name: string;
  description: string;
  what: string;
  price: number;
  free: boolean;
  published: boolean;
  sections: CourseSection[];
  /** Muqova: 'cosmic' | 'gifts' | 'three' | 'icons' yoki yuklangan rasm URL'i. */
  cover?: string;
  /** Reklama videosi (Cloudinary URL). */
  video?: string;
  language?: string;
  level?: string;
  categoryId?: number | null;
  /** 2-bosqich: "Kursingizda o'quvchilar nimani o'rganadilar?" */
  learn?: string;
  /** 2-bosqich: "Kursga kirish uchun qanday talablar yoki old shartlar mavjud?" */
  requirements?: string;
  /** 2-bosqich: "Bu kurs kim uchun?" */
  audience?: string;
}

/** G'ilofchi yuboradigan maydonlar — `id` va `published` serverda hal qilinadi. */
export type NewCourseValues = Omit<OnlineCourse, "id" | "published">;

/**
 * Klientdan kelgan tanani oq ro'yxat bo'yicha filtrlaydi — `id` va
 * `published` bu yerdan o'tmaydi (ularni server o'zi qo'yadi).
 * Faqat kelgan maydonlar qaytadi, shuning uchun PATCH uchun ham yaraydi.
 */
export function pickCourseFields(body: Record<string, unknown>): Partial<NewCourseValues> {
  const out: Partial<NewCourseValues> = {};
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);

  if (str(body.name) !== undefined) out.name = String(body.name).trim();
  if (str(body.description) !== undefined) out.description = String(body.description);
  if (str(body.what) !== undefined) out.what = String(body.what);
  if (str(body.language) !== undefined) out.language = String(body.language);
  if (str(body.level) !== undefined) out.level = String(body.level);
  if (str(body.learn) !== undefined) out.learn = String(body.learn);
  if (str(body.requirements) !== undefined) out.requirements = String(body.requirements);
  if (str(body.audience) !== undefined) out.audience = String(body.audience);
  if (str(body.cover) !== undefined) out.cover = String(body.cover);
  if (str(body.video) !== undefined) out.video = String(body.video);

  // Number.isFinite — `1e999` JSON'da Infinity bo'lib keladi va bazaga
  // yozilgach javobda `null` bo'lib qaytadi (id tekshiruvlari ham shunday).
  if (typeof body.price === "number" && Number.isFinite(body.price)) {
    out.price = Math.max(0, Math.trunc(body.price));
  }
  if (typeof body.free === "boolean") out.free = body.free;

  if (body.categoryId === null) out.categoryId = null;
  else if (typeof body.categoryId === "number") out.categoryId = body.categoryId;

  if (Array.isArray(body.sections)) {
    out.sections = (body.sections as unknown[])
      .filter((s): s is { name: unknown; outcome: unknown } => Boolean(s) && typeof s === "object")
      .map((s) => ({ name: String(s.name ?? "").trim(), outcome: String(s.outcome ?? "").trim() }))
      .filter((s) => s.name && s.outcome);
  }

  return out;
}

export const COURSE_LANGUAGES = ["Uzbek", "Русский", "English"];

// Referensdagi ro'yxat (akademiya.edutizim.uz/online-course/add) — ataylab
// aralash tilda, o'sha yerdagidek.
export const COURSE_LEVELS = ["Boshlang'ich", "Medium", "Advanced", "All"];
