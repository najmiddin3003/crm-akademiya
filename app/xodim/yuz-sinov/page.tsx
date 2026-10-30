import FaceTestPage from "@/components/employees/FaceTestPage";

// FACE ID SINOVI (30.10.2026): telefon kamerasi, yuz aniqlash va ko'z
// yumish (jonlilik) shu qurilmada ishlaydimi — haqiqiy «Ishga keldim» dan
// oldin tekshirish uchun. Hech narsa serverga yuborilmaydi va saqlanmaydi:
// hammasi brauzer ichida (components/employees/FaceCapture.tsx).
// `?live=0` — jonliliksiz (faqat avtomatik sinov uchun).
export const metadata = {
  title: "Face ID sinovi",
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ live?: string | string[] }> }) {
  const { live } = await searchParams;
  return (
    <main className="min-h-screen bg-background">
      <FaceTestPage liveness={live !== "0"} />
    </main>
  );
}
