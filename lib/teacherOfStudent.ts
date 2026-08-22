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
  const pupils = await db.collection("pupils").find({}, { projection: { id: 1, firstName: 1, lastName: 1 } }).toArray();
  const pupil = pupils.find((p) => nameKey(`${p.firstName ?? ""} ${p.lastName ?? ""}`) === key);
  if (!pupil) return null;

  const groups = await db
    .collection<Group>("groups")
    .find({ studentIds: pupil.id as number })
    .toArray();
  // O'qituvchisi ko'rsatilgan birinchi guruh.
  const group = groups.find((g) => String(g.teacher ?? "").trim() !== "");
  return group ? String(group.teacher).trim() : null;
}

/** Kategoriya xodimning o'z oyligiga tegishlimi ("Hodimga avans"/"oylik"). */
export function isEmployeePayoutCategory(category: unknown): boolean {
  return /avans|oylik/i.test(String(category ?? ""));
}
