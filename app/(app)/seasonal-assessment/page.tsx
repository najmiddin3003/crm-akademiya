import SeasonalAssessmentsPage from "@/components/seasonalAssessment/SeasonalAssessmentsPage";
import SeasonGradesV2 from "@/components/v2/academic/SeasonGradesV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// O'quv bo'limi → Mavsumiy baholash. YANGI VERSIYA (17.11.2026, 36-qism): chorak bo'yicha mezonli baholash, guruh
// holati, muddat, ota-onalarga yuborish (components/v2/academic/SeasonGradesV2.tsx); `?classic=1` — eski sahifa.
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <SeasonGradesV2 />;
  return <SeasonalAssessmentsPage />;
}
