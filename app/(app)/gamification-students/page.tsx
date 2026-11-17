import StudentsPage from "@/components/gamification/students/StudentsPage";
import WalletsV2 from "@/components/v2/gamification/WalletsV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Gamifikatsiya → Hamyonlar (TZ 5.3; eski nomi «O'quvchilar»). Hamma xodimga ochiq
// (lib/permissions.ts → ALWAYS_ALLOWED_PATHS): kim kimni ko'rishi TZ 3
// bo'yicha serverda kesiladi (lib/gamification/students.ts).
//
// YANGI VERSIYA (17.11.2026, 33-qism): components/v2/gamification/WalletsV2.tsx; `?classic=1` — eski.
export default async function GamificationStudentsRoute({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <WalletsV2 />;
  return <StudentsPage />;
}
