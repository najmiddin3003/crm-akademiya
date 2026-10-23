"use client";

import { useSearchParams } from "next/navigation";
import StaffTasksPage from "@/components/staff-tasks/StaffTasksPage";
import TasksV2 from "./TasksV2";

// YANGI VERSIYADA /tasks: ro'yxat — yangi dizayn (TasksV2); Jarimalar, Statistika,
// Sozlamalar (`?tab=fines|stats|settings`) — rasmi kelmagan, eski sahifa o'z tablari
// bilan (uning «Topshiriqlar» tabi `/tasks` ga, ya'ni yana yangi ro'yxatga olib keladi).
export default function TasksRouteV2() {
  const tab = useSearchParams().get("tab");
  return tab && tab !== "list" ? <StaffTasksPage /> : <TasksV2 />;
}
