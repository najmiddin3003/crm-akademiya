"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// Oflayn kurslar uchun yagona klient-tomon do'koni (store) — endi MongoDB
// backend'iga (/api/offline-courses) ulangan. Provider
// app/(app)/offline-courses/layout.tsx da o'ralgani uchun ro'yxat ↔ qo'shish ↔
// detail ↔ daraja sahifalari orasida holat saqlanadi va bitta marta yuklanadi.
// CRUD amallari API'ga so'rov yuboradi, muvaffaqiyatда lokal holatni yangilaydi
// va boolean (muvaffaqiyat) qaytaradi — chaqiruvchi shunga qarab toast ko'rsatadi.

export interface CourseBranch {
  id: number;
  name: string;
  enabled: boolean;
  price: number;
}

export interface LevelBranch {
  id: number;
  name: string;
  enabled: boolean;
  summa: number;
}

export interface CourseLevel {
  id: number;
  name: string;
  color: string;
  branches: LevelBranch[];
}

export interface OfflineCourse {
  id: number;
  name: string;
  color: string;
  branches: CourseBranch[];
  levels: CourseLevel[];
}

export type CourseInput = Pick<OfflineCourse, "name" | "color" | "branches">;
export type LevelInput = Pick<CourseLevel, "name" | "color" | "branches">;

interface OfflineCoursesContextValue {
  courses: OfflineCourse[];
  loading: boolean;
  getCourse: (id: number) => OfflineCourse | undefined;
  addCourse: (data: CourseInput) => Promise<boolean>;
  updateCourse: (id: number, data: CourseInput) => Promise<boolean>;
  deleteCourse: (id: number) => Promise<boolean>;
  addLevel: (courseId: number, data: LevelInput) => Promise<boolean>;
  updateLevel: (courseId: number, levelId: number, data: LevelInput) => Promise<boolean>;
  deleteLevel: (courseId: number, levelId: number) => Promise<boolean>;
}

const OfflineCoursesContext = createContext<OfflineCoursesContextValue | null>(null);

async function postJson(url: string, method: string, body?: unknown) {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return await res.json();
  } catch {
    return { ok: false };
  }
}

export function OfflineCoursesProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<OfflineCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/offline-courses")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.ok) setCourses(data.courses);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const getCourse = useCallback((id: number) => courses.find((c) => c.id === id), [courses]);

  const addCourse = useCallback(async (data: CourseInput) => {
    const d = await postJson("/api/offline-courses", "POST", data);
    if (!d.ok) return false;
    setCourses((prev) => [...prev, d.course as OfflineCourse]);
    return true;
  }, []);

  const updateCourse = useCallback(async (id: number, data: CourseInput) => {
    const d = await postJson(`/api/offline-courses/${id}`, "PATCH", data);
    if (!d.ok) return false;
    setCourses((prev) => prev.map((c) => (c.id === id ? (d.course as OfflineCourse) : c)));
    return true;
  }, []);

  const deleteCourse = useCallback(async (id: number) => {
    const d = await postJson(`/api/offline-courses/${id}`, "DELETE");
    if (!d.ok) return false;
    setCourses((prev) => prev.filter((c) => c.id !== id));
    return true;
  }, []);

  const addLevel = useCallback(async (courseId: number, data: LevelInput) => {
    const d = await postJson(`/api/offline-courses/${courseId}/levels`, "POST", data);
    if (!d.ok) return false;
    setCourses((prev) => prev.map((c) => (c.id === courseId ? { ...c, levels: [...c.levels, d.level as CourseLevel] } : c)));
    return true;
  }, []);

  const updateLevel = useCallback(async (courseId: number, levelId: number, data: LevelInput) => {
    const d = await postJson(`/api/offline-courses/${courseId}/levels/${levelId}`, "PATCH", data);
    if (!d.ok) return false;
    setCourses((prev) =>
      prev.map((c) => (c.id === courseId ? { ...c, levels: c.levels.map((l) => (l.id === levelId ? (d.level as CourseLevel) : l)) } : c)),
    );
    return true;
  }, []);

  const deleteLevel = useCallback(async (courseId: number, levelId: number) => {
    const d = await postJson(`/api/offline-courses/${courseId}/levels/${levelId}`, "DELETE");
    if (!d.ok) return false;
    setCourses((prev) => prev.map((c) => (c.id === courseId ? { ...c, levels: c.levels.filter((l) => l.id !== levelId) } : c)));
    return true;
  }, []);

  const value = useMemo<OfflineCoursesContextValue>(
    () => ({ courses, loading, getCourse, addCourse, updateCourse, deleteCourse, addLevel, updateLevel, deleteLevel }),
    [courses, loading, getCourse, addCourse, updateCourse, deleteCourse, addLevel, updateLevel, deleteLevel],
  );

  return <OfflineCoursesContext.Provider value={value}>{children}</OfflineCoursesContext.Provider>;
}

export function useOfflineCourses(): OfflineCoursesContextValue {
  const ctx = useContext(OfflineCoursesContext);
  if (!ctx) throw new Error("useOfflineCourses must be used within OfflineCoursesProvider");
  return ctx;
}
