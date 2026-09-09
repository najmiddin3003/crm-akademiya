import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminOnly";
import TempStaffPage from "@/components/temp/TempStaffPage";

// "Vaqtinchalik tugma" — VAQTINCHA turadigan admin vositasi.
//
// NIMA UCHUN BOR: xodim qo'shilganda telefon raqamiga faollashtirish SMS'i
// ketadi, va o'sha raqam BAND bo'lib qoladi (`users` hujjati). Xodimni
// Boshqaruv → Xodimlar dan o'chirish `users` ni tegmasdan qoldiradi, ya'ni
// bir marta ishlatilgan raqam bilan qayta test qilib bo'lmasdi. Bu sahifa
// to'rtala filial xodimini bir ro'yxatda ko'rsatadi va O'CHIRISHNI to'liq
// bajaradi (izlari bilan) — SMS oqimini o'z raqami bilan qayta-qayta
// sinash uchun.
//
// QO'RIQCHI SHU YERDA: `/vaqtinchalik` ruxsatlar daraxtida yo'q (u yerda
// "faqat admin" degan tushuncha umuman yo'q — lib/adminOnly.ts izohiga
// qarang), shu bois proxy uni faqat cheklovi BOR rollardan to'sadi.
// Cheklovsiz rol uchun yagona to'siq — mana shu tekshiruv. Sahifa
// komponenti navigatsiyada HAR SAFAR qayta ishga tushadi (layoutdan
// farqli), ya'ni klient tomondagi <Link> ham buni chetlab o'ta olmaydi.
export default async function Page() {
  if (!(await requireAdmin())) redirect("/home");
  return <TempStaffPage />;
}
