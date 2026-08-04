"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ONLINE_COURSES } from "@/constants/onlineCourses";

// O'quv bo'limi → Onlayn kurs uchun umumiy holat. Manbada (crm-akademiya)
// bu butunlay xotirada (localStorage'siz) — reload'da ONLINE_COURSES qayta
// boshlanadi; shu xatti-harakat shu holicha saqlandi (Oflayn kurslar'dan
// farqli o'laroq, bu yerda haqiqiy backend yo'q — manbaning o'zida ham yo'q).
// List/Wizard/Detail sahifalari orasida holatni saqlab turish uchun bitta
// Context, app/(app)/online-courses/layout.tsx'da o'raladi.

export interface CourseSection {
  name: string;
  outcome: string;
}
export interface OnlineCourse {
  id: number;
  name: string;
  description: string;
  what: string;
  price: number;
  free: boolean;
  published: boolean;
  sections: CourseSection[];
  cover?: string;
}
export type NewCourseValues = Omit<OnlineCourse, "id" | "published" | "cover">;

interface OnlineCoursesContextValue {
  courses: OnlineCourse[];
  getCourse: (id: number) => OnlineCourse | undefined;
  addCourse: (values: NewCourseValues) => void;
  updateCourse: (id: number, values: NewCourseValues) => void;
  deleteCourse: (id: number) => void;
  togglePublish: (id: number) => void;
}

const OnlineCoursesContext = createContext<OnlineCoursesContextValue | null>(null);

export function OnlineCoursesProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<OnlineCourse[]>(() => ONLINE_COURSES as OnlineCourse[]);

  const getCourse = useCallback((id: number) => courses.find((c) => c.id === id), [courses]);

  // Manbadagi ocwSaveAndNext() bilan bir xil: g'ilofchi (wizard) 4-bosqichni
  // yakunlaganda kurs har doim published:true bo'lib saqlanadi ("Aktivlash").
  const addCourse = useCallback((values: NewCourseValues) => {
    setCourses((prev) => {
      const newId = (prev[0]?.id ?? 0) + 1;
      return [{ id: newId, ...values, published: true }, ...prev];
    });
  }, []);

  const updateCourse = useCallback((id: number, values: NewCourseValues) => {
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, ...values, published: true } : c)));
  }, []);

  const deleteCourse = useCallback((id: number) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const togglePublish = useCallback((id: number) => {
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, published: !c.published } : c)));
  }, []);

  return (
    <OnlineCoursesContext.Provider value={{ courses, getCourse, addCourse, updateCourse, deleteCourse, togglePublish }}>
      {children}
    </OnlineCoursesContext.Provider>
  );
}

export function useOnlineCourses(): OnlineCoursesContextValue {
  const ctx = useContext(OnlineCoursesContext);
  if (!ctx) throw new Error("useOnlineCourses must be used within OnlineCoursesProvider");
  return ctx;
}
