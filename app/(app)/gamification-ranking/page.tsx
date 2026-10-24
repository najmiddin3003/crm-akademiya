import RankingPage from "@/components/gamification/ranking/RankingPage";
import RankingV2 from "@/components/v2/gamification/RankingV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Gamifikatsiya → Reyting (TZ 5.2). Hamma xodimga ochiq (lib/permissions.ts →
// ALWAYS_ALLOWED_PATHS): guruhlar doirasi TZ 3 bo'yicha serverda kesiladi.
//
// YANGI VERSIYA (24.10.2026, 11-qism): filial bo'yicha oylik / umumiy reyting
// (components/v2/gamification/RankingV2.tsx); `?classic=1` — eski guruh reytingi.
export default async function GamificationRankingRoute({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <RankingV2 />;
  return <RankingPage />;
}
