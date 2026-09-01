import { ObjectId } from "mongodb";
import type { Db } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";

/**
 * Joriy foydalanuvchi ORTIDAGI XODIM.
 *
 * NEGA ALOHIDA MODUL: kassa xodimga ISM bilan bog'langan
 * (`cashboxes.moderator` — `hr_employees.name` ning nusxasi, id emas), va
 * o'sha ismga borish uchun `users.hrEmployeeId → hr_employees.id →
 * hr_employees.name` zanjirini yechish kerak.
 *
 * `users.fullName` bilan solishtirib BO'LMAYDI: bazada admin hisobining
 * `fullName` i "Admin", uning `hrEmployeeId: 1` esa "Abdulloh
 * Raxmatullayev" ga olib boradi — ism bo'yicha solishtirilsa hech qaysi
 * kassa topilmasdi.
 */
export interface CurrentEmployee {
  /**
   * `users.role === "admin"` — cheklov QO'LLANMAYDI.
   * lib/rolePermissions.ts dagi bypass bilan bir xil qoida.
   */
  isAdmin: boolean;
  /** `hr_employees.name` — `cashboxes.moderator` AYNAN shu satr bilan solishtiriladi. */
  name: string | null;
  employeeId: number | null;
}

/** Foydalanuvchi kiritgan matnni $regex ichiga xavfsiz qo'yish uchun. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Ism bo'yicha solishtirish katta-kichik harfni FARQLAMAYDI.
 *
 * Kerak: `hr_employees` da bir odam ikki yozuvda uchraydi — id 42
 * "Najmiddin Turgunpolatov" va id 56 "Najmiddin turgunpolatov". Aynan
 * tenglikda ulardan biri kassasiz qolardi.
 */
export function nameEq(name: string) {
  return { $regex: `^${escapeRegex(name.trim())}$`, $options: "i" };
}

/**
 * Sessiyadagi foydalanuvchini xodim yozuviga bog'laydi.
 *
 * `null` — tizimga kirilmagan. `name: null` — hisob xodimlar ro'yxatiga
 * bog'lanmagan (bunday hisobga kassa ko'rsatilmaydi).
 */
export async function getCurrentEmployee(): Promise<CurrentEmployee | null> {
  const me = await getCurrentUser();
  if (!me) return null;
  if (me.role === "admin") return { isAdmin: true, name: null, employeeId: null };

  const db = await ensureIndexes();
  // `users.hrEmployeeId` yo'q eski hisoblar ham bo'lgan, lekin
  // lib/rolePermissions.ts:66-79 ularni telefon bo'yicha topib hujjatga
  // YOZIB QO'YADI — o'lchandi: hozir bog'lanmagan foydalanuvchi 0 ta.
  // Shu bois bu yerda telefon bo'yicha ikkinchi qidiruv takrorlanmaydi.
  const u = await db
    .collection("users")
    .findOne({ _id: new ObjectId(me.id) }, { projection: { hrEmployeeId: 1 } });
  const empId = Number(u?.hrEmployeeId);
  if (!Number.isFinite(empId)) return { isAdmin: false, name: null, employeeId: null };

  const emp = await db.collection("hr_employees").findOne({ id: empId }, { projection: { name: 1 } });
  return { isAdmin: false, name: (emp?.name ?? "").trim() || null, employeeId: empId };
}

/** Shu kassa xodimga biriktirilganmi (admin uchun chaqirilmaydi). */
export async function ownsCashbox(db: Db, name: string | null, cashboxId: number): Promise<boolean> {
  if (!name) return false;
  const c = await db
    .collection("cashboxes")
    .findOne({ id: cashboxId, moderator: nameEq(name) }, { projection: { _id: 1 } });
  return !!c;
}
