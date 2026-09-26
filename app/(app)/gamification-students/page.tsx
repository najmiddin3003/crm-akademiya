import StudentsPage from "@/components/gamification/students/StudentsPage";

// Gamifikatsiya → O'quvchilar (TZ 5.3). Hamma xodimga ochiq
// (lib/permissions.ts → ALWAYS_ALLOWED_PATHS): kim kimni ko'rishi TZ 3
// bo'yicha serverda kesiladi (lib/gamification/students.ts).
export default function GamificationStudentsRoute() {
  return <StudentsPage />;
}
