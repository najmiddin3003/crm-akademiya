import CompetitionPage from "@/components/gamification/competition/CompetitionPage";
import CompetitionV2 from "@/components/v2/gamification/CompetitionV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Gamifikatsiya → Guruhlar musobaqasi (TZ 5.6). Hamma xodimga ochiq
// (lib/permissions.ts → ALWAYS_ALLOWED_PATHS): filiallar doirasi serverda.
//
// YANGI VERSIYA (17.11.2026, 33-qism): components/v2/gamification/CompetitionV2.tsx; `?classic=1` — eski.
export default async function GamificationCompetitionRoute({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <CompetitionV2 />;
  return <CompetitionPage />;
}
