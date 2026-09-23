import { Suspense } from "react";
import StaffTasksPage from "@/components/staff-tasks/StaffTasksPage";
import "./tasks.css";

// Topshiriqlar — xodim topshiriqlari (components/staff-tasks). Sahifa HAMMA
// xodimga ochiq (lib/permissions.ts → SELF_SERVICE_PATHS): ichida kim nimani
// ko'rishi server tomonda kesiladi (lib/staffTasksServer.ts).
// useSearchParams() Suspense chegarasini talab qiladi (`?tab=`, `?open=`).
export default function TasksRoute() {
  return (
    <Suspense fallback={null}>
      <StaffTasksPage />
    </Suspense>
  );
}
