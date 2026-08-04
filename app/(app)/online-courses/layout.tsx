"use client";

import { OnlineCoursesProvider } from "@/components/online-courses/OnlineCoursesProvider";

// O'quv bo'limi → Onlayn kurs bo'limining barcha sahifalari shu layout
// ostida — Provider shu yerda o'ralgani uchun ro'yxat ↔ qo'shish ↔ detail
// sahifalari orasida navigatsiya qilinganda holat saqlanib qoladi.
export default function OnlineCoursesLayout({ children }: { children: React.ReactNode }) {
  return <OnlineCoursesProvider>{children}</OnlineCoursesProvider>;
}
