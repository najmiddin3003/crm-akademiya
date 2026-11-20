import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminOnly";
import TempStaffPage from "@/components/temp/TempStaffPage";
import TempStaffV2 from "@/components/v2/temp/TempStaffV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

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
//
// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — yangi dizayndagi sahifa
// (components/v2/temp/TempStaffV2.tsx, 55-qism, 20.11.2026). Eski versiyada — TempStaffPage
// o'zgarmadi. API (/api/temp-staff) va admin qo'riqchisi ikkalasida bitta; versiya qo'riqchidan
// KEYIN, serverda tanlanadi — miltillashsiz.
export default async function Page() {
  if (!(await requireAdmin())) redirect("/home");
  return (await currentUiVersion()) === "v2" ? <TempStaffV2 /> : <TempStaffPage />;
}
