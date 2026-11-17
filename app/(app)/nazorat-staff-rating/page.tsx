import NazoratStaffRatingPage from "@/components/nazorat/NazoratStaffRatingPage";
import TeacherRatingsV2 from "@/components/v2/nazorat/TeacherRatingsV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Nazorat → Xodimlar reytingi. YANGI VERSIYA (17.11.2026, 34-qism): «Ustozlar reytingi» — o'quvchilarning
// dars bahosi (components/v2/nazorat/TeacherRatingsV2.tsx); `?classic=1` — eski sahifa.
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <TeacherRatingsV2 />;
  return <NazoratStaffRatingPage />;
}
