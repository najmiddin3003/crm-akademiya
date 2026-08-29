import type { Db } from "mongodb";

// Boshqaruv → Rollar (sidebar: Boshqaruv > Rollar, href /management-rollar).
// MongoDB `roles` kolleksiyasi.
//
// ROLLAR SONI QAT'IY: faqat `teacher` va `moderator`. Ruxsat XODIMGA emas,
// LAVOZIMGA beriladi — ya'ni barcha o'qituvchilar bitta ro'yxatni, barcha
// moderatorlar boshqasini ko'radi. Bitta xodimga alohida ruxsat ochib
// bo'lmaydi, bu ataylab shunday.
//
// Bog'lanish: `hr_employees.turi` → `roles.key`. Xodimning lavozimi
// o'zgarishi bilan uning ruxsatlari ham o'zgaradi, boshqa hech narsa
// qilish kerak emas.
//
// `turi` boshqa qiymat bo'lsa (masalan `admin`, yoki import qilingan
// xodimdagi bo'sh qiymat) — cheklov qo'llanmaydi.

export const ROLE_KEYS = ["teacher", "moderator"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

/** Ko'rinadigan nom. constants/employees.js dagi ROLE_LABELS bilan bir xil. */
export const ROLE_KEY_LABELS: Record<RoleKey, string> = {
  teacher: "O'qituvchi",
  moderator: "Moderator",
};

export function isRoleKey(value: unknown): value is RoleKey {
  return typeof value === "string" && (ROLE_KEYS as readonly string[]).includes(value);
}

export interface Role {
  id: number;
  /** Lavozim kaliti — `hr_employees.turi` bilan bir xil alifbo. */
  key: RoleKey;
  name: string;
  description: string; // Izoh
  /**
   * Shu lavozimdagi xodimlar KO'RA OLADIGAN bo'limlar — sahifa
   * pathname'lari ro'yxati (lib/permissions.ts dagi kalitlar).
   *
   *   null yoki maydon yo'q → cheklov yo'q, hamma bo'lim ochiq
   *   [...]                 → aynan shu bo'limlar
   */
  permissions?: string[] | null;
}

/**
 * Ikkala rol hujjati borligiga kafolat beradi va ularni qaytaradi.
 *
 * Rollarni foydalanuvchi qo'shmaydi/o'chirmaydi — ular tizimning qat'iy
 * qismi. Shu sabab yozuvlar shu yerda, birinchi so'rovdayoq yaratiladi.
 *
 * MIGRATSIYA: `key` maydoni keyin qo'shilgan. Undan oldin nomi bo'yicha
 * yaratilgan yozuv bo'lsa (masalan qo'lda kiritilgan "teacher"), yangisini
 * yaratish o'rniga o'shanga `key` yoziladi — aks holda bir xil rol ikki
 * marta paydo bo'lib, ruxsatlar qaysi biridan olinishi noaniq bo'lardi.
 */
export async function ensureRoles(db: Db): Promise<Role[]> {
  const col = db.collection("roles");

  for (const key of ROLE_KEYS) {
    if (await col.findOne({ key }, { projection: { _id: 1 } })) continue;

    const legacy = await col.findOne(
      { key: { $exists: false }, name: { $regex: `^${key}$`, $options: "i" } },
      { projection: { _id: 1 } },
    );
    if (legacy) {
      await col.updateOne({ _id: legacy._id }, { $set: { key, name: ROLE_KEY_LABELS[key] } });
      continue;
    }

    const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
    await col.insertOne({
      id: (last[0]?.id ?? 0) + 1,
      key,
      name: ROLE_KEY_LABELS[key],
      description: "",
      permissions: null,
    });
  }

  const rows = await col.find({ key: { $in: [...ROLE_KEYS] } }).toArray();
  // Tartib ROLE_KEYS dagidek bo'lsin — jadval qatorlari sakrab turmasin.
  return ROLE_KEYS.map((key) => {
    const row = rows.find((r) => r.key === key)!;
    const { _id, ...rest } = row;
    void _id;
    return rest as unknown as Role;
  });
}
