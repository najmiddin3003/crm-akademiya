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

/**
 * Kurs tafsilotidagi "Kitoblar"/"Mavzular" tablarining yozuvi. Ikkalasi bir
 * xil shaklda: `extra` kitoblarda muallif, mavzularda qisqa izoh sifatida
 * ko'rsatiladi. Kurs hujjatining ichida saqlanadi (levels kabi) —
 * app/api/offline-courses/[id]/lists/route.ts.
 */
export interface CourseListItem {
  id: number;
  name: string;
  extra: string;
}

export type CourseListKind = "books" | "topics";

export interface OfflineCourse {
  id: number;
  name: string;
  color: string;
  branches: CourseBranch[];
  levels: CourseLevel[];
  /** "Kitoblar" tabi. Eski yozuvlarda yo'q — shuning uchun ixtiyoriy. */
  books?: CourseListItem[];
  /** "Mavzular" tabi. */
  topics?: CourseListItem[];
  /**
   * Kategoriya — «Chet tillari», «Fanlar» kabi (lib/courseCategories.ts,
   * 20.10.2026). Yo'q yoki "" — kategoriyasiz.
   */
  category?: string;
  /**
   * Holat — `false` bo'lsa yangi lid/guruh/xodim oynalaridagi «Kursni tanlang»
   * ro'yxatida chiqmaydi. Maydon yo'q eski yozuv — faol (courseIsActive).
   */
  active?: boolean;
}

export type CourseInput = Pick<OfflineCourse, "name" | "color" | "branches">;
export type LevelInput = Pick<CourseLevel, "name" | "color" | "branches">;

/** Kursning bir qismini yangilash (yangi «Sozlamalar → Kurslar» sahifasi). */
export type CoursePatch = Partial<Pick<OfflineCourse, "name" | "color" | "branches" | "category" | "active">>;

/** Nom o'zgarganda qayerlarda yangilangani (app/api/offline-courses/[id] → `renamed`). */
export interface CourseRenameInfo {
  moved: Record<string, number>;
  total: number;
}

/** Yangi sahifa uchun batafsil natija — xato matni va nom ko'chirilgani bilan. */
export type CourseSaveResult =
  | { ok: true; course: OfflineCourse; renamed?: CourseRenameInfo }
  | { ok: false; error: string };

interface OfflineCoursesContextValue {
  courses: OfflineCourse[];
  loading: boolean;
  getCourse: (id: number) => OfflineCourse | undefined;
  addCourse: (data: CourseInput) => Promise<boolean>;
  updateCourse: (id: number, data: CourseInput) => Promise<boolean>;
  deleteCourse: (id: number) => Promise<boolean>;
  /** Yangi sahifa: kurs yaratish (kategoriya/holat bilan) — xato matnini qaytaradi. */
  createCourse: (data: CoursePatch & { name: string }) => Promise<CourseSaveResult>;
  /** Yangi sahifa: kursning bir qismini yangilash — xato matni va `renamed` bilan. */
  patchCourse: (id: number, patch: CoursePatch) => Promise<CourseSaveResult>;
  /** Yangi sahifa: o'chirish — guruhda ishlatilgan kurs 409 bilan qaytadi (xato matni va guruhlar soni bilan). */
  removeCourse: (id: number) => Promise<{ ok: true } | { ok: false; error: string; groups?: number }>;
  addLevel: (courseId: number, data: LevelInput) => Promise<boolean>;
  updateLevel: (courseId: number, levelId: number, data: LevelInput) => Promise<boolean>;
  deleteLevel: (courseId: number, levelId: number) => Promise<boolean>;
  /** "Kitoblar"/"Mavzular" ro'yxatiga yozuv qo'shadi. */
  addListItem: (courseId: number, kind: CourseListKind, data: { name: string; extra: string }) => Promise<boolean>;
  deleteListItem: (courseId: number, kind: CourseListKind, itemId: number) => Promise<boolean>;
  /** Import qilingandan keyin ro'yxatni bazadan qayta o'qish. */
  reload: () => Promise<void>;
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

  const createCourse = useCallback(async (data: CoursePatch & { name: string }): Promise<CourseSaveResult> => {
    const d = await postJson("/api/offline-courses", "POST", { color: "#000000", branches: [], ...data });
    if (!d.ok) return { ok: false, error: String(d.error || "Saqlanmadi") };
    setCourses((prev) => [...prev, d.course as OfflineCourse]);
    return { ok: true, course: d.course as OfflineCourse };
  }, []);

  const patchCourse = useCallback(async (id: number, patch: CoursePatch): Promise<CourseSaveResult> => {
    const d = await postJson(`/api/offline-courses/${id}`, "PATCH", patch);
    if (!d.ok) return { ok: false, error: String(d.error || "Saqlanmadi") };
    setCourses((prev) => prev.map((c) => (c.id === id ? (d.course as OfflineCourse) : c)));
    return { ok: true, course: d.course as OfflineCourse, renamed: d.renamed as CourseRenameInfo | undefined };
  }, []);

  const removeCourse = useCallback(async (id: number): Promise<{ ok: true } | { ok: false; error: string; groups?: number }> => {
    const d = await postJson(`/api/offline-courses/${id}`, "DELETE");
    if (!d.ok) return { ok: false, error: String(d.error || "O'chirishda xatolik yuz berdi"), groups: typeof d.groups === "number" ? d.groups : undefined };
    setCourses((prev) => prev.filter((c) => c.id !== id));
    return { ok: true };
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

  const addListItem = useCallback(
    async (courseId: number, kind: CourseListKind, data: { name: string; extra: string }) => {
      const d = await postJson(`/api/offline-courses/${courseId}/lists?kind=${kind}`, "POST", data);
      if (!d.ok) return false;
      setCourses((prev) =>
        prev.map((c) => (c.id === courseId ? { ...c, [kind]: [...(c[kind] ?? []), d.item as CourseListItem] } : c)),
      );
      return true;
    },
    [],
  );

  const deleteListItem = useCallback(async (courseId: number, kind: CourseListKind, itemId: number) => {
    const d = await postJson(`/api/offline-courses/${courseId}/lists?kind=${kind}&itemId=${itemId}`, "DELETE");
    if (!d.ok) return false;
    setCourses((prev) =>
      prev.map((c) => (c.id === courseId ? { ...c, [kind]: (c[kind] ?? []).filter((x) => x.id !== itemId) } : c)),
    );
    return true;
  }, []);

  // Ommaviy import bir so'rovda ko'p kurs yaratadi — mahalliy holatni
  // qo'shib-qo'yish o'rniga bazadan qayta o'qigan xavfsizroq.
  const reload = useCallback(async () => {
    const d = await fetch("/api/offline-courses").then((r) => r.json()).catch(() => null);
    if (d?.ok) setCourses(d.courses as OfflineCourse[]);
  }, []);

  const value = useMemo<OfflineCoursesContextValue>(
    () => ({
      courses, loading, getCourse, addCourse, updateCourse, deleteCourse, createCourse, patchCourse, removeCourse,
      addLevel, updateLevel, deleteLevel, addListItem, deleteListItem, reload,
    }),
    [
      courses, loading, getCourse, addCourse, updateCourse, deleteCourse, createCourse, patchCourse, removeCourse,
      addLevel, updateLevel, deleteLevel, addListItem, deleteListItem, reload,
    ],
  );

  return <OfflineCoursesContext.Provider value={value}>{children}</OfflineCoursesContext.Provider>;
}

export function useOfflineCourses(): OfflineCoursesContextValue {
  const ctx = useContext(OfflineCoursesContext);
  if (!ctx) throw new Error("useOfflineCourses must be used within OfflineCoursesProvider");
  return ctx;
}
