import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AppShell from "@/components/shared/AppShell";
import SpeedFab from "@/components/tezlik/SpeedFab";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import { gamificationEnabled } from "@/lib/gamification/settings";
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

  // IKKINCHI QATLAM. Birlamchi majburlash `proxy.ts` da — u klient
  // navigatsiyasini ham ko'radi, bu layout esa KO'RMAYDI (Next.js
  // "Partial Rendering": umumiy layout o'tishlarda qayta ishga
  // tushmaydi). Bu yerdagi tekshiruv KESHSIZ, ya'ni rol o'zgarishi
  // proxy'ning 10 soniyalik keshini kutmasdan kuchga kiradi.
  //
  // FAIL-CLOSED: sarlavha yetib kelmasa tekshirib bo'lmaydi degani va
  // sahifa OCHIQ QOLDIRILMAYDI. Ilgari bu yerda `if (pathname && …)`
  // turardi — sarlavha yo'qolgan har qanday holatda qo'riqchi jimgina
  // o'tkazib yuborilardi. Proxy matcher'i barcha sahifalarni qamraydi,
  // ya'ni normal ishda sarlavha DOIM bo'ladi.
  const pathname = (await headers()).get(PATHNAME_HEADER);
  if (!pathname || !isPathAllowed(pathname, user.permissions)) {
    redirect(firstAllowedPath(user.permissions));
  }

  // Modulga bog'langan bo'limlar (sidebar `feature`) — hozir faqat
  // Gamifikatsiya: modul o'chiq bo'lsa bo'lim faqat adminga ko'rinadi.
  const gamOn = await gamificationEnabled(await ensureIndexes());

  // Navbardagi profil menyusi uchun HAQIQIY foydalanuvchi. Serverdan
  // uzatiladi — alohida so'rov ham, "avval noto'g'ri ism ko'rinib, keyin
  // to'g'rilanishi" ham bo'lmaydi. Parol/sessiya kabi maydonlar berilmaydi.
  return (
    <AppShell
      permissions={user.permissions}
      user={{ fullName: user.fullName, phone: user.phone }}
      // Sidebar'dagi `adminOnly` bo'limlar uchun. Bu FAQAT ko'rinish —
      // sahifaning o'zi ham qaytadan tekshiradi (lib/adminOnly.ts).
      isAdmin={user.role === "admin"}
      features={{ gamification: gamOn }}
    >
      {children}
      {/* Suzuvchi robot — tezlik sinovi (components/tezlik/SpeedFab.tsx) */}
      <SpeedFab />
    </AppShell>
  );
}
