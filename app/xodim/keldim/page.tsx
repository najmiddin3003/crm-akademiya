import StaffCheckinTg from "@/components/employees/StaffCheckinTg";

// «ISHGA KELDIM» — TELEGRAM MINI APP (28.09.2026): xodimlar botidagi
// «📷 Ishga keldim» (va yoqilganda «🏁 Ishdan ketdim», `?k=out`) tugmasi
// shu manzilni ochadi. 31.10.2026 dan QR yo'q: yuz (Face ID yoqilgan bo'lsa)
// va joylashuv tekshiriladi, filial joylashuvdan aniqlanadi
// (lib/attendanceCheck.ts). Kirish — `initData` (app/api/xodim).
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
