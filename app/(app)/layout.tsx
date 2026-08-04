import { redirect } from "next/navigation";
import AppShell from "@/components/shared/AppShell";
import { getCurrentUser } from "@/lib/auth";

// Sidebar+Navbar faqat shu guruhdagi (haqiqiy CRM) sahifalarga o'raladi.
// (auth) sahifalari — login/register — bu qobiqsiz, to'liq ekranli.
//
// Har bir sahifaga o'tishda foydalanuvchi holati DB'dan qayta o'qiladi —
// admin sessiya davomida muzlatsa/bloklasa/o'chirsa, foydalanuvchi 30 kunlik
// cookie muddatini kutmasdan keyingi navigatsiyada chiqarib yuboriladi.
export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/api/auth/force-logout");
  }
  return <AppShell>{children}</AppShell>;
}
