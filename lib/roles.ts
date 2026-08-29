import type { Db } from "mongodb";

// Boshqaruv → Rollar (sidebar: Boshqaruv > Rollar, href /management-rollar).
// MongoDB `roles` kolleksiyasi.
//
// IKKI XIL ROL BOR:
//
//   O'RNATILGAN — `teacher` va `moderator`. Ular `key` maydoni bilan
//   belgilangan va `hr_employees.turi` ga BOG'LANGAN: xodimning lavozimi
//   o'zgarishi bilan uning ruxsatlari ham o'zgaradi. Bu ikkisi doim
//   mavjud (ensureRoles), nomi o'zgarmaydi va o'chirilmaydi.
//
//   QO'LDA QO'SHILGAN — `key` maydoni YO'Q. Nomi, izohi va ruxsatlari
//   erkin tahrirlanadi, o'chirsa ham bo'ladi.
//
// `turi` o'rnatilgan kalitlardan biri bo'lmasa (masalan `admin`, yoki
// import qilingan xodimdagi bo'sh qiymat) — cheklov qo'llanmaydi.

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
  /**
   * O'rnatilgan rolning lavozim kaliti — `hr_employees.turi` bilan bir xil
   * alifbo. Qo'lda qo'shilgan rollarda bu maydon YO'Q.
   */
  key?: RoleKey;
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

/** Keyingi bo'sh `id`. Rollar ro'yxati kichik, shu sabab oddiy usul. */
export async function nextRoleId(db: Db): Promise<number> {
  const last = await db.collection("roles").find({}).sort({ id: -1 }).limit(1).toArray();
  return (last[0]?.id ?? 0) + 1;
}

/**
 * O'rnatilgan rollar borligiga kafolat beradi va BARCHA rollarni qaytaradi
 * (avval o'rnatilganlar, keyin qo'lda qo'shilganlar `id` bo'yicha).
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

    await col.insertOne({
      id: await nextRoleId(db),
      key,
      name: ROLE_KEY_LABELS[key],
      description: "",
      permissions: null,
    });
  }

  const rows = await col.find({}).sort({ id: 1 }).toArray();
  const strip = (row: Record<string, unknown>) => {
    const { _id, ...rest } = row;
    void _id;
    return rest as unknown as Role;
  };
  // Tartib: avval o'rnatilganlar ROLE_KEYS bo'yicha (jadval qatorlari
  // sakrab turmasin), keyin qo'lda qo'shilganlar.
  const builtIn = ROLE_KEYS.map((key) => strip(rows.find((r) => r.key === key)!));
  const custom = rows.filter((r) => !isRoleKey(r.key)).map(strip);
  return [...builtIn, ...custom];
}
