import StaffCheckinTg from "@/components/employees/StaffCheckinTg";

// «ISHGA KELDIM» — TELEGRAM MINI APP (28.09.2026): xodimlar botidagi
// «📷 Ishga keldim» (va yoqilganda «🏁 Ishdan ketdim», `?k=out`) tugmasi
// shu manzilni ochadi — Telegram'ning QR skaneri bilan filial ekranidagi
// kodni o'qiydi (lib/attendanceQr.ts). Kirish — `initData` (app/api/xodim).
export const metadata = {
  title: "Ishga keldim",
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ k?: string | string[] }> }) {
  const { k } = await searchParams;
  return (
    <main className="min-h-screen bg-background">
      <StaffCheckinTg kind={k === "out" ? "out" : "in"} />
    </main>
  );
}
