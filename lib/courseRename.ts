import type { Db } from "mongodb";

// KURS NOMI O'ZGARGANDA — ESKI NOM YOZILGAN BOG'LANISHLAR YANGI NOMGA KO'CHADI (20.10.2026).
//
// NEGA KERAK: kursga bog'lanish ID bo'yicha emas, NOMI bo'yicha (bazada o'lchandi):
//   • guruh kursi — `groups.course` (85 guruhning hammasida): guruh oynasi kursni NOM
//     bo'yicha tekshiradi (lib/groupCourseCheck.ts), qarzdorlar hisoboti narxni nom
//     bo'yicha oladi (lib/debtors.ts), gamifikatsiya chegirmasi ham (discounts.ts);
//   • lid yo'nalishi — `orders.course` (492 lid);
//   • o'qituvchi fani — `hr_employees.kurs` (40 xodim);
//   • imtihonlar — `group_exams.course`, `monthly_exams.subject` (lib/imtihon.ts: fan =
//     kurs nomi).
// Ilgari kurs nomi o'zgartirilsa (eski Oflayn kurslar oynasi) bular eski nomda qolardi:
// guruh tahririda «kurs topilmadi», hisobotda narx 0. Yangi «Sozlamalar → Kurslar»
// sahifasi esa «Nom o'zgarsa, shu kursdagi barcha guruh va o'quvchilarda ham
// yangilanadi» deydi (rasm, 20.10.2026) — shu yerda bajariladi.
//
// TARIX TEGILMAYDI (lib/employeeRename.ts bilan bir xil tamoyil): arxivdagi guruhlar
// (`arxivTugaganGuruhlarimiz`), ishga arizalar (`cv_applications.subject` — nomzod o'zi
// yozgan), DTM imtihonlari (fan nomi kursnikiga TASODIFAN mos), lid holati tarixi.
// O'QUVCHI hujjatida kurs nomi YO'Q — o'quvchi kursga guruh va lid orqali bog'langan.
//
// Mos kelish — harf kattaligi va chetdagi probel FARQLANMAYDI. Bir xil nomli boshqa kurs
// bo'lsa nom o'zgarmaydi (chaqiruvchi 409 qaytaradi, pastdagi `courseNameTaken`) — aks
// holda ikki kursning bog'lanishlari aralashib ketardi.

export interface CourseRenameResult {
  /** "kolleksiya.maydon" → yangilangan hujjatlar soni (0 bo'lganlar yo'q). */
  moved: Record<string, number>;
  total: number;
}

export const COURSE_NAME_TARGETS: readonly { coll: string; field: string }[] = [
  { coll: "groups", field: "course" },
  { coll: "orders", field: "course" },
  { coll: "hr_employees", field: "kurs" },
  { coll: "group_exams", field: "course" },
  { coll: "monthly_exams", field: "subject" },
];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Nom bo'yicha qidiruv sharti: chetdagi probel va harf kattaligi farqlanmaydi. */
export function sameNameFilter(name: string) {
  return { $regex: `^\\s*${escapeRegex(name.trim())}\\s*$`, $options: "i" };
}

/** Shu nom boshqa kursda bormi (o'zi — `exceptId` — hisobga olinmaydi). */
export async function courseNameTaken(db: Db, name: string, exceptId?: number): Promise<boolean> {
  const filter: Record<string, unknown> = { name: sameNameFilter(name) };
  if (exceptId !== undefined) filter.id = { $ne: exceptId };
  return (await db.collection("offline_courses").countDocuments(filter, { limit: 1 })) > 0;
}

export async function syncCourseRename(db: Db, oldName: unknown, newName: unknown): Promise<CourseRenameResult> {
  const from = String(oldName ?? "").trim();
  const to = String(newName ?? "").trim();
  if (!from || !to || from === to) return { moved: {}, total: 0 };
  const same = sameNameFilter(from);
  const moved: Record<string, number> = {};
  let total = 0;
  for (const t of COURSE_NAME_TARGETS) {
    const r = await db.collection(t.coll).updateMany({ [t.field]: same }, { $set: { [t.field]: to } });
    if (r.modifiedCount > 0) {
      moved[`${t.coll}.${t.field}`] = r.modifiedCount;
      total += r.modifiedCount;
    }
  }
  return { moved, total };
}
