import CompetitionPage from "@/components/gamification/competition/CompetitionPage";

// Gamifikatsiya → Guruhlar musobaqasi (TZ 5.6). Hamma xodimga ochiq
// (lib/permissions.ts → ALWAYS_ALLOWED_PATHS): filiallar doirasi serverda.
export default function GamificationCompetitionRoute() {
  return <CompetitionPage />;
}
