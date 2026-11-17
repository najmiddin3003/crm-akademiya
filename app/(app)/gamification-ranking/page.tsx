import RankingPage from "@/components/gamification/ranking/RankingPage";
import RankingGroupV2 from "@/components/v2/gamification/RankingGroupV2";
import RankingV2 from "@/components/v2/gamification/RankingV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Gamifikatsiya → Reyting (TZ 5.2). Hamma xodimga ochiq (lib/permissions.ts →
// ALWAYS_ALLOWED_PATHS): guruhlar doirasi TZ 3 bo'yicha serverda kesiladi.
//
// YANGI VERSIYA:
//   • 17.11.2026, 33-qism — guruh ichidagi reyting (components/v2/gamification/RankingGroupV2.tsx,
//     `?groupId=`);
//   • 24.10.2026, 11-qism — filial bo'yicha oylik / umumiy ro'yxat (RankingV2.tsx) — endi `?scope=branch`.
// `?classic=1` — eski guruh reytingi.
export default async function GamificationRankingRoute({
  searchParams,
}: {
  searchParams: Promise<{ classic?: string; scope?: string; groupId?: string }>;
}) {
  const { classic, scope, groupId } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") {
    if (scope === "branch") return <RankingV2 />;
    const gid = Number(groupId);
    return <RankingGroupV2 initialGroupId={Number.isFinite(gid) && gid > 0 ? gid : null} />;
  }
  return <RankingPage />;
}
