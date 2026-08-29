import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AppShell from "@/components/shared/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { firstAllowedPath, isPathAllowed, PATHNAME_HEADER } from "@/lib/permissions";

// Sidebar+Navbar faqat shu guruhdagi (haqiqiy CRM) sahifalarga o'raladi.
// (auth) sahifalari — login/register — bu qobiqsiz, to'liq ekranli.
//
// Har bir sahifaga o'tishda foydalanuvchi holati DB'dan qayta o'qiladi —
// admin sessiya davomida muzlatsa/bloklasa/o'chirsa, foydalanuvchi 30 kunlik
// cookie muddatini kutmasdan keyingi navigatsiyada chiqarib yuboriladi.
//
// SHU YERDA bo'lim ruxsatlari ham tekshiriladi (Boshqaruv → Rollar). Bu
// tekshiruv sidebar'ni filtrlashdan MUSTAQIL: sidebar'da havola ko'rinmasa
// ham, manzilni brauzerga qo'lda yozib kirib bo'lmaydi. Tekshiruv proxy'da
// emas, aynan shu yerda — chunki javob DB'dan keladi va rol o'zgarishi
// darhol kuchga kirishi kerak.
export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/api/auth/force-logout");
  }

  // Pathname'ni proxy.ts qo'yadi. Sarlavha bo'lmasa (masalan proxy matcher'i
  // tegmagan so'rov) tekshirib bo'lmaydi — bunday holatda sahifa ochiq
  // qoladi, aks holda butun ilova qulflanib qolardi.
  const pathname = (await headers()).get(PATHNAME_HEADER);
  if (pathname && !isPathAllowed(pathname, user.permissions)) {
    redirect(firstAllowedPath(user.permissions));
  }

  return <AppShell permissions={user.permissions}>{children}</AppShell>;
}
