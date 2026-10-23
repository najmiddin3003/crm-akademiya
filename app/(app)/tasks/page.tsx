import { Suspense } from "react";
import StaffTasksPage from "@/components/staff-tasks/StaffTasksPage";
import TasksRouteV2 from "@/components/v2/tasks/TasksRouteV2";
import { currentUiVersion } from "@/lib/uiVersionServer";
import "./tasks.css";

// Topshiriqlar — xodim topshiriqlari (components/staff-tasks). Sahifa HAMMA
// xodimga ochiq (lib/permissions.ts → SELF_SERVICE_PATHS): ichida kim nimani
// ko'rishi server tomonda kesiladi (lib/staffTasksServer.ts).
// useSearchParams() Suspense chegarasini talab qiladi (`?tab=`, `?open=`).
//
// Yangi versiyada (cookie `tizimli_ui`) — yangi dizayndagi ro'yxat
// (components/v2/tasks/TasksV2.tsx, 23.10.2026); ikkalasi bitta yadrodan
// (components/staff-tasks/useStaffTasksCore.ts). tasks.css ikkalasiga ham kerak:
// batafsil panel hozircha eski ko'rinishda.
export default async function TasksRoute() {
  const v2 = (await currentUiVersion()) === "v2";
  return <Suspense fallback={null}>{v2 ? <TasksRouteV2 /> : <StaffTasksPage />}</Suspense>;
}
