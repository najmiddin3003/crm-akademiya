"use client";

import { OfflineCoursesProvider } from "@/components/offline-courses/OfflineCoursesProvider";

// Oflayn kurslar bo'limining barcha sahifalari shu layout ostida. Provider shu
// yerda o'ralgani uchun ro'yxat ↔ qo'shish ↔ detail ↔ daraja sahifalari orasida
// navigatsiya qilinganda holat (kurslar/darajalar) saqlanib qoladi.
export default function OfflineCoursesLayout({ children }: { children: React.ReactNode }) {
  return <OfflineCoursesProvider>{children}</OfflineCoursesProvider>;
}
