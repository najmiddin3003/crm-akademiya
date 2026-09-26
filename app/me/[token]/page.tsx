import StudentGame from "@/components/gamification/student/StudentGame";

// O'QUVCHI SAHIFASI — SHAXSIY HAVOLA (TZ 5.8): `/me/{token}`, parolsiz.
// CRM layout'idan tashqarida (sessiya yo'q, CRM menyusi ko'rinmaydi).
// Kim ekanini server token bo'yicha aniqlaydi (app/api/me/[token]); havola
// faqat shu o'quvchining sahifasini ochadi va faqat istak qo'shadi.
// Qidiruv tizimlariga berilmaydi — shaxsiy havola.
export const metadata = {
  title: "Mening sahifam",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="min-h-screen bg-background">
      <StudentGame source={{ kind: "token", token }} />
    </main>
  );
}
