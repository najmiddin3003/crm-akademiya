"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { NewCourseValues, OnlineCourse } from "@/lib/onlineCourses";

// O'quv bo'limi → Onlayn kurs uchun umumiy holat, endi MongoDB backend'iga
// (/api/online-courses) ulangan — Oflayn kurslar provideri bilan bir xil
// qolip (OfflineCoursesProvider.tsx).
//
// Ilgari bu butunlay xotirada edi (manbadagidek) va sahifa yangilansa
// kurslar yo'qolardi. G'ilofchi endi kurs rasmi va reklama videosini
// haqiqatan Cloudinary'ga yuklaydi — yuklangan faylga ishora qiluvchi kurs
// yozuvi F5 dan keyin yo'qolib ketmasligi uchun bazaga ko'chirildi.
//
// CRUD amallari API'ga so'rov yuboradi va xato matnini (yoki muvaffaqiyatda
// `null`) qaytaradi — toast'ni chaqiruvchi ko'rsatadi (hooks/useTaskTypes.ts
// bilan bir xil kelishuv).

/**
 * Kursga biriktirilgan guruhlar (`groupIds`) lib/onlineCourses.ts dagi
 * `OnlineCourse` tipida e'lon qilinmagan — u fayl boshqa bo'limga tegishli.
 * Maydon "Kurs biriktirish" oynasi orqali yoziladi
 * (app/api/online-courses/[id]/bind/route.ts) va GET butun hujjatni
 * qaytargani uchun amalda keladi.
 */
export type BoundOnlineCourse = OnlineCourse & { groupIds?: number[] };

interface OnlineCoursesContextValue {
  courses: BoundOnlineCourse[];
  loading: boolean;
  getCourse: (id: number) => BoundOnlineCourse | undefined;
  addCourse: (values: NewCourseValues) => Promise<string | null>;
  updateCourse: (id: number, values: NewCourseValues) => Promise<string | null>;
  deleteCourse: (id: number) => Promise<string | null>;
  togglePublish: (id: number) => Promise<string | null>;
  /** "Kurs biriktirish" — guruhni yoki kategoriyani kursga biriktiradi. */
  bindCourse: (id: number, payload: { groupId?: number; categoryId?: number }) => Promise<string | null>;
  /** Biriktirishni bekor qiladi (groupId berilmasa — kategoriya). */
  unbindCourse: (id: number, groupId?: number) => Promise<string | null>;
}

const OnlineCoursesContext = createContext<OnlineCoursesContextValue | null>(null);

async function send(url: string, method: string, body?: unknown) {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return await res.json();
  } catch {
    return { ok: false, error: "Serverga ulanib bo'lmadi" };
  }
}

export function OnlineCoursesProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<BoundOnlineCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/online-courses")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) setCourses(d.courses);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const getCourse = useCallback((id: number) => courses.find((c) => c.id === id), [courses]);

  const addCourse = useCallback(async (values: NewCourseValues) => {
    const d = await send("/api/online-courses", "POST", values);
    if (!d.ok) return (d.error as string) || "Saqlashda xatolik";
    setCourses((prev) => [d.course as OnlineCourse, ...prev]);
    return null;
  }, []);

  const updateCourse = useCallback(async (id: number, values: NewCourseValues) => {
    // G'ilofchi 4-bosqichni yakunlaganda kurs har doim aktiv bo'lib saqlanadi
    // ("Aktivlash") — POST yo'lidagi qoida bilan bir xil. Shusiz muzlatilgan
    // kursni tahrirlab "Aktivlash" bosilsa ham u aktiv bo'lmasdi.
    const d = await send(`/api/online-courses/${id}`, "PATCH", { ...values, published: true });
    if (!d.ok) return (d.error as string) || "Saqlashda xatolik";
    setCourses((prev) => prev.map((c) => (c.id === id ? (d.course as OnlineCourse) : c)));
    return null;
  }, []);

  const deleteCourse = useCallback(async (id: number) => {
    const d = await send(`/api/online-courses/${id}`, "DELETE");
    if (!d.ok) return (d.error as string) || "O'chirishda xatolik";
    setCourses((prev) => prev.filter((c) => c.id !== id));
    return null;
  }, []);

  const togglePublish = useCallback(
    async (id: number) => {
      const current = courses.find((c) => c.id === id);
      if (!current) return "Kurs topilmadi";
      const d = await send(`/api/online-courses/${id}`, "PATCH", { published: !current.published });
      if (!d.ok) return (d.error as string) || "Saqlashda xatolik";
      setCourses((prev) => prev.map((c) => (c.id === id ? (d.course as OnlineCourse) : c)));
      return null;
    },
    [courses],
  );

  // Biriktirish server javobidagi to'liq kurs hujjati bilan yangilanadi —
  // shunda `groupIds`/`categoryId` darhol UI'da ko'rinadi va "biriktirildi"
  // degan xabar haqiqatan sodir bo'lgan ishga mos keladi.
  const bindCourse = useCallback(async (id: number, payload: { groupId?: number; categoryId?: number }) => {
    const d = await send(`/api/online-courses/${id}/bind`, "POST", payload);
    if (!d.ok) return (d.error as string) || "Biriktirib bo'lmadi";
    setCourses((prev) => prev.map((c) => (c.id === id ? (d.course as BoundOnlineCourse) : c)));
    return null;
  }, []);

  const unbindCourse = useCallback(async (id: number, groupId?: number) => {
    const qs = groupId === undefined ? "" : `?groupId=${groupId}`;
    const d = await send(`/api/online-courses/${id}/bind${qs}`, "DELETE");
    if (!d.ok) return (d.error as string) || "Biriktirishni bekor qilib bo'lmadi";
    setCourses((prev) => prev.map((c) => (c.id === id ? (d.course as BoundOnlineCourse) : c)));
    return null;
  }, []);

  const value = useMemo<OnlineCoursesContextValue>(
    () => ({ courses, loading, getCourse, addCourse, updateCourse, deleteCourse, togglePublish, bindCourse, unbindCourse }),
    [courses, loading, getCourse, addCourse, updateCourse, deleteCourse, togglePublish, bindCourse, unbindCourse],
  );

  return <OnlineCoursesContext.Provider value={value}>{children}</OnlineCoursesContext.Provider>;
}

export function useOnlineCourses(): OnlineCoursesContextValue {
  const ctx = useContext(OnlineCoursesContext);
  if (!ctx) throw new Error("useOnlineCourses must be used within OnlineCoursesProvider");
  return ctx;
}
