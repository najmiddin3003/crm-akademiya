import StaffProfileTg from "@/components/employees/StaffProfileTg";

// XODIM PROFILI — TELEGRAM MINI APP (28.09.2026): xodimlar botidagi
// «👤 Profilim» tugmasi shu manzilni ochadi (lib/staffBot/keyboards.ts).
// Xodim o'z profilini saytdagidek, faqat ko'rish rejimida ko'radi. Kirish —
// Telegram `initData` imzosi (app/api/xodim/*), CRM sessiyasi kerak emas.
export const metadata = {
  title: "Profilim",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <main className="min-h-screen bg-background">
      <StaffProfileTg />
    </main>
  );
}
