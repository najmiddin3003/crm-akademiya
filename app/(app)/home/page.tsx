// BOSH SAHIFA ("/home").
//
// Bu yerda BITTA sahifa emas, LAVOZIMGA QARAB tanlanadigan bosh ekran
// turadi:
//
//   moderator  -> Lidlar > Buyurtmalar ro'yxati (/orders-list)
//   qolganlar  -> Dars jadvali (/groups-schedule bilan bitta komponent)
//   ruxsat yo'q -> qisqa "Xush kelibsiz" ekrani
//
// NEGA MODERATORGA BOSHQA SAHIFA: "Moderator" rolida "Dars jadvali"
// ruxsati umuman yo'q (o'lchandi: rolda 18 ta bo'lim bor, /groups-schedule
// ular orasida emas). Ya'ni 9 ta moderatorning hammasi bosh sahifada bo'sh
// ekran ko'rardi. Ularning kundalik ishi buyurtmalar ro'yxatidan boshlanadi.
//
// NEGA GroupSchedulePage: ilgari bu yerda `components/schedule/SchedulePage`
// turardi va u BAZAGA UMUMAN ULANMAGAN — sonlar, xonalar, o'qituvchi
// ismlari va darslar `constants/schedule.js` dagi demo seeddan kelardi.
//
// STATISTIKA FAQAT SHU YERDA: `showStats` — referensdagi 12 ta KPI kartasi
// (akademiya.edutizim.uz/home) jadval ustida chiziladi. "Guruh > Dars
// jadvali" (/groups-schedule) o'sha komponentni proplarsiz ko'rsatadi, ya'ni
// unda kartalar yo'q (foydalanuvchi so'rovi). Kartalarning sonlari
// /api/home-stats dan keladi va HAR BIRI o'zi olib boradigan sahifa
// ruxsatiga qarab kesiladi (lib/homeStats.ts).
//
// RUXSAT: "/home" ALWAYS_ALLOWED_PATHS ichida, ya'ni ROLDAN QAT'I NAZAR
// ochiq (usiz proxy.ts dagi qorovul uni hammaga yopib, yo'naltirish
// halqasiga tushirardi — sidebar daraxtida "/home" bandi yo'q). Shu bois
// bu yerda ko'rsatiladigan HAR BIR mazmun uchun ruxsat ALOHIDA
// tekshiriladi: aks holda bosh sahifa yopiq bo'limni orqa eshikdan
// ochib berardi.
import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { isPathAllowed } from "@/lib/permissions";
import { ensureIndexes } from "@/lib/mongodb";
import GroupSchedulePage from "@/components/groups/GroupSchedulePage";

/** `hr_employees.turi` -> o'sha lavozimning bosh sahifasi. */
const HOME_BY_POSITION: Record<string, string> = {
  moderator: "/orders-list",
};

/**
 * Lavozimga biriktirilgan bosh sahifa, yoki `null` — umumiy bosh sahifa.
 *
 * `null` qaytishi mumkin bo'lgan uchta hol bor va uchalasi ham ATAYLAB:
 *
 *   • ADMIN. Admin hisobi ham xodimlar ro'yxatidagi yozuvga bog'langan va
 *     uning lavozimi bor — bazada `users.role: "admin"` -> hrEmployeeId 1
 *     -> `turi: "moderator"`. Istisnosiz admin moderator ekraniga tushib
 *     qolardi. Qoida lib/rolePermissions.ts dagi bypass bilan bir xil.
 *   • Hisob xodimlar ro'yxatiga bog'lanmagan.
 *   • Lavozim uchun manzil bor, LEKIN xodimda o'sha bo'lim ruxsati yo'q.
 *     Bunda yo'naltirish HALQA hosil qilardi: proxy uni qaytarib
 *     `firstAllowedPath()` ga, u esa yana "/home" ga yuboradi.
 */
async function positionHome(user: CurrentUser): Promise<string | null> {
  if (user.role === "admin" || user.hrEmployeeId === null) return null;

  const db = await ensureIndexes();
  const emp = await db
    .collection("hr_employees")
    .findOne({ id: user.hrEmployeeId }, { projection: { turi: 1 } });

  const target = HOME_BY_POSITION[String(emp?.turi ?? "")];
  if (!target) return null;

  return isPathAllowed(target, user.permissions) ? target : null;
}

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    const target = await positionHome(user);
    if (target) redirect(target);
  }

  if (user && isPathAllowed("/groups-schedule", user.permissions)) {
    return <GroupSchedulePage showStats />;
  }

  // Na lavozim manzili, na "Dars jadvali" ruxsati bor xodim uchun.
  // Yo'naltirish EMAS: `firstAllowedPath()` ham "/home" ni qaytaradi,
  // ya'ni bu yerdan boshqa joyga yuborish cheksiz halqa hosil qilardi.
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
