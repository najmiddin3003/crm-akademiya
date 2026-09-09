import { getCurrentUser, type CurrentUser } from "@/lib/auth";

// FAQAT ADMIN uchun ochiq sahifa/route'lar shu yerdan tekshiriladi.
//
// NEGA BO'LIM RUXSATI YETMAYDI: `lib/permissions.ts` semantikasi bo'yicha
// `permissions === null` — "cheklov yo'q", ya'ni ro'yxati sozlanmagan HAR
// QANDAY rol (va bu sukut holat) yangi sahifani ko'raverardi. "Faqat admin"
// ni o'sha daraxt bilan ifodalab bo'lmaydi — u "qaysi bo'limlar ochiq"
// degan savolga javob beradi, "kim admin" degan savolga emas.
//
// Admin belgisi — `users.role === "admin"`. Aynan shu qoida
// lib/currentEmployee.ts va lib/rolePermissions.ts dagi bypass bilan bir xil,
// ya'ni loyihada adminlik BITTA joydan aniqlanadi.

/**
 * Admin bo'lsa — foydalanuvchining o'zi, aks holda `null`.
 *
 * Foydalanuvchi QAYTARILADI (oddiy `boolean` emas): o'chirish amallari
 * "bu men emasmi?" degan tekshiruvni shu ma'lumotsiz qila olmasdi.
 */
export async function requireAdmin(): Promise<CurrentUser | null> {
  const me = await getCurrentUser();
  return me?.role === "admin" ? me : null;
}
