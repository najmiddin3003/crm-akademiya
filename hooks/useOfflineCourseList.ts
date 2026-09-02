"use client";

import { useSharedList } from "@/hooks/useSharedList";

import { useMemo } from "react";
import type { OfflineCourse } from "@/components/offline-courses/OfflineCoursesProvider";

// Oflayn kurslarni OfflineCoursesProvider'dan TASHQARIDA o'qish uchun yengil
// hook (/api/offline-courses). Provider faqat /offline-courses yo'nalishiga
// o'ralgan, ammo kurs ro'yxati boshqa sahifalarda ham kerak bo'ladi —
// masalan buyurtma detalidagi fan nomini kurs sahifasiga bog'lash uchun.
export function useOfflineCourseList() {
  // Takroriy so'rov dedup qilinadi — hooks/useSharedList.ts (10 ta faylda).
  const { items: courses, loading } = useSharedList<OfflineCourse>(
    "shared:offline-courses",
    "/api/offline-courses",
    (d) => (d as { courses?: OfflineCourse[] }).courses ?? [],
  );

  // Kurs TANLANADIGAN joylar uchun — ilgari ular constants'dagi bir-biriga
  // mos kelmaydigan uchta qattiq ro'yxatdan (GROUP_COURSES, COURSES,
  // EMP_COURSES) o'qir edi.
  const names = useMemo(() => courses.map((c) => c.name).filter(Boolean), [courses]);

  return { courses, names, loading };
}
