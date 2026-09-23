import type { Db } from "mongodb";
import type { Group } from "@/lib/groups";

// To'lov qaysi o'qituvchining oyligiga tegishli ekanini aniqlash.
//
// Zanjir: o'quvchi ismi → guruh (studentIds orqali pupils'ga bog'langan)
// → guruhning o'qituvchisi. Guruhlarga o'qituvchi biriktirilmagan bo'lsa
// bo'sh qaytadi — bunday holda Kirim oynasida o'qituvchi qo'lda
// tanlanishi kerak.

function nameKey(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

/**
 * O'quvchi ismidan uning ustozini topadi.
 * Topilmasa null — o'ylab topilgan qiymat qaytarilmaydi.
 */
export async function findTeacherOfStudent(db: Db, studentName: string): Promise<string | null> {
  const key = nameKey(studentName);
  if (!key) return null;

  // O'quvchini pupils'dan topamiz ("Ism Familiya" ko'rinishida saqlanmaydi,
  // shuning uchun ikki maydonni birlashtiramiz).
  //
  // ISM TAKRORLANSA — null. Ilgari bu yerda `find()` BIRINCHI mos
  // kelganini olardi, ya'ni ismdosh ikki o'quvchidan har doim bittasining
  // ustozi qaytardi va to'lov foizi BEGONA ustozning oyligiga tushib
  // ketardi. Endi chaqiruvchi o'quvchining id'sini bersin
  // (findTeacherOfPupil) yoki oynada ustozni qo'lda tanlasin — taxmin
  // qilinmaydi.
  const pupils = await db.collection("pupils").find({}, { projection: { id: 1, firstName: 1, lastName: 1 } }).toArray();
  const hits = pupils.filter((p) => nameKey(`${p.firstName ?? ""} ${p.lastName ?? ""}`) === key);
  if (hits.length !== 1) return null;

  return findTeacherOfPupil(db, hits[0].id as number);
}

/**
 * O'quvchi ID'si bo'yicha uning ustozi — yuqoridagining ishonchli yo'li.
 * Ismdoshlar aralashmaydi, chunki guruh a'zoligi `studentIds` da aynan
 * ID bo'yicha yuritiladi.
 */
export async function findTeacherOfPupil(db: Db, pupilId: number): Promise<string | null> {
  if (!Number.isFinite(pupilId)) return null;
  const groups = await db
    .collection<Group>("groups")
    .find({ studentIds: pupilId })
    .toArray();
  // O'qituvchisi ko'rsatilgan birinchi guruh.
  const group = groups.find((g) => String(g.teacher ?? "").trim() !== "");
  return group ? String(group.teacher).trim() : null;
}

/** Kategoriya xodimning o'z oyligiga tegishlimi ("Hodimga avans"/"oylik"). */
export function isEmployeePayoutCategory(category: unknown): boolean {
  return /avans|oylik/i.test(String(category ?? ""));
}
