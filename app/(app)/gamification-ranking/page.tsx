import RankingPage from "@/components/gamification/ranking/RankingPage";

// Gamifikatsiya → Reyting (TZ 5.2). Hamma xodimga ochiq (lib/permissions.ts →
// ALWAYS_ALLOWED_PATHS): guruhlar doirasi TZ 3 bo'yicha serverda kesiladi.
export default function GamificationRankingRoute() {
  return <RankingPage />;
}
