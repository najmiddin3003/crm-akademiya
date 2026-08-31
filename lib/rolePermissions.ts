import { ObjectId, type Db } from "mongodb";
import { normalizePhone } from "./eskiz";
import { ensureIndexes } from "./mongodb";
import { readPermissions } from "./permissions";
import { isRoleKey } from "./roles";

// Rol → ruxsatlar zanjirini yechish. Ikki chaqiruvchisi bor:
//   • lib/auth.ts   — sahifalar uchun, KESHSIZ (rol o'zgarishi darhol ta'sir qiladi)
//   • proxy.ts      — /api/* uchun, QISQA KESHLI (pastdagi izohga qarang)

/**
 * Login hisobini xodimlar ro'yxatidagi yozuv bilan TELEFON orqali bog'laydi.
 *
 * `hr_employees.phone` "94 155 88 55" ko'rinishida, `users.phone` esa
 * normallashtirilgan holda saqlanadi — shu bois solishtirish Mongo
 * so'rovida emas, JS tarafida bo'ladi (scripts/seed-admin.js dagi bilan
 * aynan bir xil usul).
 */
async function findEmployeeIdByPhone(db: Db, phone: unknown): Promise<number | null> {
  if (typeof phone !== "string" || !phone) return null;
  const roster = await db.collection("hr_employees").find({}, { projection: { id: 1, phone: 1 } }).toArray();
  const hit = roster.find((e) => typeof e.phone === "string" && normalizePhone(e.phone) === phone);
  return typeof hit?.id === "number" ? hit.id : null;
}

export interface UserForPermissions {
  _id: ObjectId;
  phone?: unknown;
  hrEmployeeId?: unknown;
  /** `users.role` — faqat "admin" bypass uchun (pastdagi izohga qarang). */
  role?: unknown;
}

/**
 * Foydalanuvchining ruxsatlarini yechadi:
 *   users.hrEmployeeId → hr_employees → (istisno bo'lsa u, aks holda
 *                          turi → roles(key).permissions)
 *
 * Odatda ruxsat LAVOZIMGA bog'langan: barcha o'qituvchilar bitta ro'yxatni,
 * barcha moderatorlar boshqasini ko'radi (lib/roles.ts). Bitta xodimga
 * alohida ro'yxat berilgan bo'lsa (`hr_employees.permissions`), U USTUN
 * turadi va lavozim sozlamasi umuman qaralmaydi.
 *
 * Zanjirning istalgan bo'g'ini uzilsa `null` — ya'ni cheklovsiz —
 * qaytadi:
 *   • xodim yozuvi topilmadi,
 *   • `turi` `teacher`/`moderator` emas (masalan `admin` yoki import
 *     qilingan xodimdagi bo'sh qiymat),
 *   • rol yozuvida ruxsatlar belgilanmagan.
 * Bu ATAYLAB: cheklov faqat admin rolga ro'yxat berganda paydo bo'ladi.
 */
export async function resolvePermissions(db: Db, user: UserForPermissions): Promise<string[] | null> {
  // ADMIN LAVOZIM ZANJIRIDAN O'TMAYDI.
  //
  // NEGA KERAK: ruxsat `users.role` ga emas, xodimning LAVOZIMIGA
  // (`hr_employees.turi` -> `roles.key`) qarab beriladi. Admin hisobi ham
  // xodimlar ro'yxatidagi yozuvga bog'langan va uning lavozimi bor. Ya'ni
  // "Moderator" roliga cheklov qo'yilishi bilan ADMIN HAM o'sha cheklovga
  // tushadi — va agar ro'yxatga Rollar sahifasi kiritilmagan bo'lsa, u
  // cheklovni orqaga qaytara olmaydi. Tizimga faqat bazadan kirib
  // tuzatish qolardi.
  //
  // Shu sabab bu tekshiruv rollarga cheklov QO'YISHDAN OLDIN turishi shart.
  if (user.role === "admin") return null;

  let empId = Number(user.hrEmployeeId);

  // `users.hrEmployeeId` faqat "Xodim qo'shish" modali yaratgan hisoblarda
  // bor. Skript bilan seed qilingan yoki xodimlar ro'yxati IMPORT
  // QILINISHIDAN OLDIN yaratilgan hisoblarda u yo'q — bunday
  // foydalanuvchiga rol biriktirilsa ham u hech qachon ishlamasdi. Telefon
  // bo'yicha topamiz va bog'lanishni hujjatga yozib qo'yamiz, shunda
  // qidiruv bir marta bo'ladi.
  if (!Number.isFinite(empId)) {
    const found = await findEmployeeIdByPhone(db, user.phone);
    if (found === null) return null;
    empId = found;
    await db.collection("users").updateOne({ _id: user._id }, { $set: { hrEmployeeId: empId } });
  }

  const emp = await db.collection("hr_employees").findOne(
    { id: empId },
    { projection: { turi: 1, permissions: 1 } },
  );
  if (!emp) return null;

  // Xodim kesimidagi istisno — lavozimdan USTUN.
  if (Array.isArray(emp.permissions)) return readPermissions(emp.permissions);

  if (!isRoleKey(emp.turi)) return null;

  const role = await db.collection("roles").findOne({ key: emp.turi }, { projection: { permissions: 1 } });
  if (!role) return null;
  return readPermissions(role.permissions);
}

// ── /api/* uchun keshlangan yo'l ─────────────────────────────────────────

export interface SessionAccess {
  /** Hisob faol va qurilma sessiyasi uzilmagan. */
  active: boolean;
  /** `null` — cheklov yo'q. */
  permissions: string[] | null;
}

/**
 * Kesh MUDDATI. Bitta sahifa ochilishi o'nlab API so'rovi yuboradi va
 * ularning har biri uchun uchta Atlas so'rovi (users → hr_employees →
 * roles) qo'shilsa, kechikish sezilarli bo'lardi.
 *
 * Bahosi: rol o'zgarishi yoki qurilmani uzish `/api/*` ga shuncha
 * kechikish bilan yetadi. SAHIFALAR uchun kesh YO'Q — u yerda cheklov
 * darhol kuchga kiradi, ya'ni foydalanuvchi taqiqlangan ekranni ko'rmaydi.
 */
const TTL_MS = 10_000;

const cache = new Map<string, { at: number; value: SessionAccess }>();

/**
 * Sessiya egasining holati va ruxsatlari.
 *
 * `status !== "active"` yoki qurilma sessiyasi o'chirilgan bo'lsa
 * `active: false` qaytadi — proxy buni 401 ga aylantiradi. Ilgari API
 * route'lari bunday tekshiruvni UMUMAN qilmasdi: bloklangan xodimning
 * cookie'si amal qilib turgan ekan, ular unga javob beraverardi.
 */
export async function accessForSession(uid: string, sid?: string): Promise<SessionAccess> {
  const key = `${uid}:${sid ?? ""}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.value;

  const value = await loadAccess(uid, sid);
  cache.set(key, { at: now, value });
  // Kesh cheksiz o'smasin — muddati o'tganlarni vaqti-vaqti bilan tozalaymiz.
  if (cache.size > 500) {
    for (const [k, v] of cache) if (now - v.at >= TTL_MS) cache.delete(k);
  }
  return value;
}

async function loadAccess(uid: string, sid?: string): Promise<SessionAccess> {
  if (!ObjectId.isValid(uid)) return { active: false, permissions: null };

  const db = await ensureIndexes();
  const user = await db.collection("users").findOne(
    { _id: new ObjectId(uid) },
    // `role` ham kerak — yuqoridagi admin bypass /api/* yo'lida ham
    // ishlashi uchun (bu yerda o'qilmasa, u faqat sahifalarda ishlardi).
    { projection: { status: 1, phone: 1, hrEmployeeId: 1, role: 1 } },
  );
  if (!user || user.status !== "active") return { active: false, permissions: null };

  // `sid` yo'q eski cookie'lar amal qilaveradi (lib/session.ts izohiga qarang).
  if (sid) {
    const live = await db.collection("user_sessions").findOne({ sid }, { projection: { _id: 1 } });
    if (!live) return { active: false, permissions: null };
  }

  return { active: true, permissions: await resolvePermissions(db, user as UserForPermissions) };
}
