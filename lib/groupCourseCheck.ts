import type { Db } from "mongodb";
import { findCourseByName, courseLevelNames } from "@/lib/courseLevels";

// Guruhning kursi va bosqichi — SERVER tekshiruvi (POST/PATCH /api/groups).
// Qoida lib/courseLevels.ts da (modal bilan bir xil): kurs Oflayn kurslar
// ro'yxatida bo'lishi, bosqich (berilgan bo'lsa) o'sha kursning
// bosqichlaridan biri bo'lishi kerak. Modal faqat shu variantlarni
// ko'rsatadi, lekin so'rov to'g'ridan-to'g'ri kelsa ham bazaga begona
// kurs/bosqich tushmasin.
//
// Muvaffaqiyatda KANONIK nomlar qaytadi (kurs hujjatidagi yozilishi):
// "ingliz tili" / "ielts / cefr tayyorlov" deb kelsa ham bazaga "Ingliz
// tili" / "IELTS / CEFR tayyorlov" yoziladi — jadval filtrlari va
// hisobotlar aynan satr bo'yicha guruhlaydi.

export type GroupCourseCheck =
  | { ok: true; course: string; level: string }
  | { ok: false; error: string; field: "course" | "level" };

export async function checkGroupCourse(db: Db, course: string, level: string): Promise<GroupCourseCheck> {
  const courses = await db
    .collection("offline_courses")
    .find({})
    .project<{ name: string; levels?: { name: string }[] }>({ _id: 0, name: 1, "levels.name": 1 })
    .toArray();
  const found = findCourseByName(courses, course);
  if (!found) return { ok: false, error: `«${course}» kursi Oflayn kurslar ro'yxatida yo'q`, field: "course" };
  if (!level.trim()) return { ok: true, course: found.name, level: "" };

  const names = courseLevelNames(found);
  const key = level.trim().toLowerCase();
  const canonical = names.find((n) => n.toLowerCase() === key);
  if (!canonical) {
    return {
      ok: false,
      error: names.length
        ? `«${level}» bosqichi ${found.name} kursida yo'q (bor: ${names.join(", ")})`
        : `${found.name} kursida bosqich yo'q — avval kurs sahifasida qo'shing`,
      field: "level",
    };
  }
  return { ok: true, course: found.name, level: canonical };
}
