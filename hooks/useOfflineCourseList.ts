"use client";

import { useEffect, useState } from "react";
import type { OfflineCourse } from "@/components/offline-courses/OfflineCoursesProvider";

// Oflayn kurslarni OfflineCoursesProvider'dan TASHQARIDA o'qish uchun yengil
// hook (/api/offline-courses). Provider faqat /offline-courses yo'nalishiga
// o'ralgan, ammo kurs ro'yxati boshqa sahifalarda ham kerak bo'ladi —
// masalan buyurtma detalidagi fan nomini kurs sahifasiga bog'lash uchun.
export function useOfflineCourseList() {
  const [courses, setCourses] = useState<OfflineCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/offline-courses")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setCourses(d.courses); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { courses, loading };
}
