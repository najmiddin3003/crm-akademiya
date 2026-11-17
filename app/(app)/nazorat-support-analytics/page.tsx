import NazoratSupportAnalyticsPage from "@/components/nazorat/NazoratSupportAnalyticsPage";
import SupportLessonsV2 from "@/components/v2/nazorat/SupportLessonsV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Nazorat → Support. YANGI VERSIYA (17.11.2026, 34-qism): «Support darslari» — dars ochish, yozilish,
// navbat va davomat (components/v2/nazorat/SupportLessonsV2.tsx); `?classic=1` — eski analitika ro'yxati.
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <SupportLessonsV2 />;
  return <NazoratSupportAnalyticsPage />;
}
