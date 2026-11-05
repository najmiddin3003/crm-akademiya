import StaffProfileTg from "@/components/employees/StaffProfileTg";

// XODIM PROFILI — TELEGRAM MINI APP (28.09.2026): xodimlar botidagi
// «👤 Profilim» tugmasi shu manzilni ochadi (lib/staffBot/keyboards.ts).
// Xodim o'z profilini saytdagidek, faqat ko'rish rejimida ko'radi. Kirish —
// Telegram `initData` imzosi (app/api/xodim/*), CRM sessiyasi kerak emas.
//
// `?guruh=ID` (05.11.2026) — «Davomatni boshlang» xabaridagi tugma: sahifa shu
// guruhning bugungi davomatini ochib keladi (lib/staffBot/dayReminders.ts).
export const metadata = {
  title: "Profilim",
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ guruh?: string | string[] }> }) {
  const { guruh } = await searchParams;
  const groupId = Number(Array.isArray(guruh) ? guruh[0] : guruh);
  return (
    <main className="min-h-screen bg-background">
      <StaffProfileTg guruh={Number.isInteger(groupId) && groupId > 0 ? groupId : null} />
    </main>
  );
}
