// BOSH SAHIFA ("/home") — Dars jadvali.
//
// NEGA GroupSchedulePage: ilgari bu yerda `components/schedule/SchedulePage`
// turardi va u BAZAGA UMUMAN ULANMAGAN — barcha sonlar, xonalar, o'qituvchi
// ismlari va darslar `constants/schedule.js` ga qo'lda yozib qo'yilgan demo
// seed edi (faylning o'zida "Backend yo'q — statik seed" deb yozilgan).
// Ya'ni tizimga kirgan har bir xodim bosh sahifada TO'QILGAN raqamlarni
// ko'rardi: "Aktiv o'quvchilar 972" (bazada 4 365), "Guruhlar 89"
// (bazada 91), "Arxiv 4" (bazada 2 456), xonalar 201-208 (bazada 210-228).
// Endi bosh sahifa /groups-schedule bilan BITTA komponentni ko'rsatadi —
// guruhlar, xonalar va o'qituvchilar bazadan keladi.
//
// RUXSAT: "/home" ALWAYS_ALLOWED_PATHS ichida, ya'ni ROLDAN QAT'I NAZAR
// ochiq (usiz proxy.ts dagi qorovul uni hammaga yopib, yo'naltirish
// halqasiga tushirardi — sidebar daraxtida "/home" bandi yo'q). Lekin
// jadvalning O'ZI "Dars jadvali" (/groups-schedule) ruxsatiga bog'langan.
// Shu bois bu yerda ruxsat ALOHIDA tekshiriladi: aks holda bosh sahifa
// o'sha bo'lim yopiq bo'lgan xodimga uni orqa eshikdan ochib berardi.
import { getCurrentUser } from "@/lib/auth";
import { isPathAllowed } from "@/lib/permissions";
import GroupSchedulePage from "@/components/groups/GroupSchedulePage";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user && isPathAllowed("/groups-schedule", user.permissions)) {
    return <GroupSchedulePage />;
  }

  // "Dars jadvali" yopiq xodim uchun — bo'sh, lekin tushunarli bosh sahifa.
  // Yo'naltirish emas: `firstAllowedPath()` ham "/home" ni qaytaradi, ya'ni
  // bu yerdan boshqa joyga yuborish cheksiz halqa hosil qilardi.
  const name = (user?.fullName || "").trim();
  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
      <div className="rounded-xl border border-border bg-card px-6 py-14 text-center">
        <h1 className="text-lg font-semibold tracking-tight">
          Xush kelibsiz{name ? `, ${name}` : ""}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Chap tomondagi menyudan kerakli bo&apos;limni tanlang.
        </p>
      </div>
    </div>
  );
}
