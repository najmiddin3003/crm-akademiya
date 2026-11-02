import type { Db, ObjectId } from "mongodb";
import type { CurrentUser } from "@/lib/auth";
import { APPROVAL_FIELD } from "@/lib/adminApproval";
import { normalizePhone } from "@/lib/eskiz";

// XODIM LAVOZIMI O'ZGARSA — HISOB ROLI HAM ERGASHADI (02.11.2026).
//
// NEGA KERAK: admin huquqi faqat `users.role === "admin"` dan (lib/adminOnly.ts,
// lib/rolePermissions.ts dagi bypass). Bu maydon esa hisob yaratilganda lavozimdan BIR
// MARTA yozilardi (lib/hrEmployeeCreate.ts, app/api/temp-staff/invite) va keyin hech
// qayerda yangilanmasdi. Temuriylar'da (02.11.2026) admin xodimning lavozimi «Moderator»
// qilindi — u to'liq admin bo'lib qolaverdi. Teskarisi ham ishlamasdi: moderatorni
// «Administrator» qilish admin huquqini bermasdi.
//
// Ikkala tahrir yo'li (PATCH /api/hr-employees/:id va /api/temp-staff/:id) shu yerdan:
//   1) `checkLavozimChange` — hech narsa yozilmasdan OLDIN; rad etilsa xodim yozuvi ham
//      o'zgarmaydi;
//   2) `applyLavozimChange` — boshqa tekshiruvlar o'tgach, xodim yozuvidan OLDIN. Tartib
//      ataylab: oraliqda xato chiqsa rol yangi, lavozim eski qoladi va qayta saqlash
//      ikkalasini tenglashtiradi. Teskari tartibda lavozim yangi, rol eski qolardi —
//      qayta saqlash esa «lavozim o'zgarmadi» deb rolga umuman tegmasdi.
//
// QOIDALAR:
//   • faqat lavozim HAQIQATAN o'zgarganda — tahrir oynasi uni har safar qayta yuboradi,
//     ism yoki telefonni tuzatish hisob roliga tegmasin (bazada lavozimi rolidan farq
//     qiladigan eski hisoblar jimgina o'zgarib ketmasin);
//   • administrator lavozimini berish ham, olish ham — faqat admin. Aks holda Xodimlar
//     bo'limiga kira oladigan har kim o'zini admin qilib olardi;
//   • o'zini administratorlikdan chiqarish yo'q — buni boshqa admin qiladi (DELETE dagi
//     «o'z hisobingizni o'chirib bo'lmaydi» bilan bir fikr: bitta bosishda o'zini admin
//     sahifalaridan uzib qo'yish);
//   • oxirgi faol adminni chiqarish yo'q — markaz adminsiz qolardi.
//
// QACHON KUCHGA KIRADI: sahifalar va `requireAdmin` rolni har so'rovda bazadan o'qiydi —
// darhol. /api/* bo'lim ruxsatlari (proxy) va filial qamrovi 10 soniya keshlanadi
// (lib/rolePermissions.ts, lib/branchScope.ts) — o'sha qism ko'pi bilan shuncha kechikadi.

export const ADMIN_ROLE = "admin";

/** Lavozim → hisob roli. Hisob yaratilgandagi qoida bilan bir xil: bo'sh → "employee". */
export function accountRoleOf(turi: unknown): string {
  const t = typeof turi === "string" ? turi.trim() : "";
  return t || "employee";
}

/** So'rovdagi lavozim bazadagidan HAQIQATAN farq qiladimi (chetdagi probel farq emas). */
export function lavozimChanged(current: unknown, next: unknown): boolean {
  return typeof next === "string" && next.trim() !== String(current ?? "").trim();
}

export type LavozimCheck =
  | { ok: true; role: string; accountIds: ObjectId[] }
  | { ok: false; status: 403 | 409; error: string };

/**
 * Xodimga bog'langan hisoblar: `hrEmployeeId` bo'yicha yoki ESKI telefon bo'yicha
 * (importda qo'shilgan xodimda bog'lanish bo'lmasligi mumkin). Telefon bo'yicha faqat
 * hech kimga bog'lanmagan hisob olinadi — boshqa xodimning hisobi qo'shilib ketmasin;
 * bo'sh telefon shartga umuman qo'shilmaydi (`{phone: ""}` begona hisobga tushardi).
 */
async function linkedAccounts(db: Db, empId: number, phone: unknown) {
  const p = normalizePhone(String(phone ?? ""));
  const filter = p ? { $or: [{ hrEmployeeId: empId }, { phone: p, hrEmployeeId: null }] } : { hrEmployeeId: empId };
  return db.collection("users").find(filter, { projection: { _id: 1, role: 1 } }).toArray();
}

/**
 * Lavozim o'zgarishini hisob roli nuqtai nazaridan tekshiradi.
 *
 * `admin` — so'rov egasi, agar u admin bo'lsa (`requireAdmin()` natijasi), aks holda
 * `null`. `phone` va `fromTuri` — xodim yozuvining SO'ROVDAN OLDINGI qiymatlari.
 */
export async function checkLavozimChange(
  db: Db,
  input: {
    empId: number;
    phone: unknown;
    fromTuri: unknown;
    toTuri: unknown;
    admin: Pick<CurrentUser, "id" | "hrEmployeeId"> | null;
  },
): Promise<LavozimCheck> {
  const role = accountRoleOf(input.toTuri);
  const accounts = await linkedAccounts(db, input.empId, input.phone);
  const adminIds = accounts.filter((a) => a.role === ADMIN_ROLE).map((a) => a._id);

  // Lavozimning o'zi ham hisobga olinadi, faqat hisob roli emas: hisobsiz xodimga
  // «Administrator» yozilsa, keyingi taklif (temp-staff/invite) admin hisob yaratadi.
  const touchesAdmin = role === ADMIN_ROLE || accountRoleOf(input.fromTuri) === ADMIN_ROLE || adminIds.length > 0;
  if (touchesAdmin && !input.admin) {
    return { ok: false, status: 403, error: "Administrator lavozimini faqat administrator berishi yoki olishi mumkin" };
  }

  if (role !== ADMIN_ROLE && adminIds.length > 0) {
    const me = input.admin;
    const self = me !== null && (me.hrEmployeeId === input.empId || accounts.some((a) => String(a._id) === me.id));
    if (self) {
      return { ok: false, status: 409, error: "O'zingizni administratorlikdan chiqara olmaysiz — buni boshqa administrator qilsin" };
    }
    // Kira oladigan admin: faol va tasdiq kutmayotgan (lib/adminApproval.ts).
    const another = await db.collection("users").findOne(
      { role: ADMIN_ROLE, status: "active", [APPROVAL_FIELD]: { $nin: ["pending", "rejected"] }, _id: { $nin: adminIds } },
      { projection: { _id: 1 } },
    );
    if (!another) {
      return { ok: false, status: 409, error: "Bu markazdagi oxirgi faol administrator — avval boshqa xodimni administrator qiling" };
    }
  }

  return { ok: true, role, accountIds: accounts.filter((a) => a.role !== role).map((a) => a._id) };
}

/** Tekshiruvdan o'tgan o'zgarishni hisob(lar)ga yozadi; yangilangan hisoblar soni. */
export async function applyLavozimChange(db: Db, check: { role: string; accountIds: ObjectId[] }): Promise<number> {
  if (check.accountIds.length === 0) return 0;
  const res = await db.collection("users").updateMany({ _id: { $in: check.accountIds } }, { $set: { role: check.role } });
  return res.modifiedCount;
}
