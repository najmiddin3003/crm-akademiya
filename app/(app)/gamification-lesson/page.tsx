import LessonPage from "@/components/gamification/lesson/LessonPage";

// Gamifikatsiya → Tanga berish (TZ 5.1). Sahifa HAMMA xodimga ochiq
// (lib/permissions.ts → ALWAYS_ALLOWED_PATHS): kim nima qila olishi TZ 3
// rollari bo'yicha server tomonda kesiladi (lib/gamification/lesson.ts).
export default function GamificationLessonRoute() {
  return <LessonPage />;
}
