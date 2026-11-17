import LessonPage from "@/components/gamification/lesson/LessonPage";
import LessonV2 from "@/components/v2/gamification/LessonV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Gamifikatsiya → Tanga berish (TZ 5.1). Sahifa HAMMA xodimga ochiq
// (lib/permissions.ts → ALWAYS_ALLOWED_PATHS): kim nima qila olishi TZ 3
// rollari bo'yicha server tomonda kesiladi (lib/gamification/lesson.ts).
//
// YANGI VERSIYA (17.11.2026, 33-qism): components/v2/gamification/LessonV2.tsx
// (`?groupId=` — guruh); `?classic=1` — eski sahifa.
export default async function GamificationLessonRoute({ searchParams }: { searchParams: Promise<{ classic?: string; groupId?: string }> }) {
  const { classic, groupId } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") {
    const gid = Number(groupId);
    return <LessonV2 initialGroupId={Number.isFinite(gid) && gid > 0 ? gid : null} />;
  }
  return <LessonPage />;
}
