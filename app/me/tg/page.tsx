import StudentGameTg from "@/components/gamification/student/StudentGameTg";

// O'QUVCHI SAHIFASI — TELEGRAM MINI APP (TZ 5.8): o'quvchilar botidagi
// «Mening sahifam» tugmasi shu manzilni ochadi. Kirish — Telegram `initData`
// imzosi (app/api/me/tg); o'quvchi token yoki telefon orqali bog'lanishdan
// topiladi, ota-onaning bir nechta farzandi bo'lsa tepada tanlov chiqadi.
export const metadata = {
  title: "Mening sahifam",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <main className="min-h-screen bg-background">
      <StudentGameTg />
    </main>
  );
}
