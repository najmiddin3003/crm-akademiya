"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { NewPupilValues, Pupil } from "@/lib/pupilsData";
import { invalidateStudents, loadPupilsCached } from "@/hooks/useStudents";

// Shared pupils store for the orders-list route segment (mounted alongside
// OrdersContext by app/(app)/orders-list/layout.tsx), backed by MongoDB via
// /api/pupils. Both the AddOrderModal drawer (list view) and AddOrderPage
// (Kanban "Qo'shish" full page) read through this so "O'quvchi"/"Referal
// bergan o'quvchi" show real students — not the static demo constants/index.js
// STUDENTS list — and a pupil created via one surface is immediately
// searchable on the other.

interface PupilsContextValue {
  pupils: Pupil[];
  loading: boolean;
  createPupil: (values: NewPupilValues) => Promise<Pupil | null>;
}

const PupilsContext = createContext<PupilsContextValue | null>(null);

export function PupilsProvider({ children }: { children: ReactNode }) {
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadPupilsCached()
      .then((list) => {
        if (!cancelled) setPupils(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const createPupil = useCallback(async (values: NewPupilValues) => {
    try {
      const res = await fetch("/api/pupils", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!data.ok) return null;
      invalidateStudents(); // ro'yxat o'zgardi -> umumiy kesh bekor
      setPupils((prev) => [data.pupil as Pupil, ...prev]);
      return data.pupil as Pupil;
    } catch {
      // Tarmoq xatoligi — reject o'rniga null qaytarib, chaqiruvchi
      // tomondagi await/toast doim ishlashini ta'minlaymiz.
      return null;
    }
  }, []);

  return <PupilsContext.Provider value={{ pupils, loading, createPupil }}>{children}</PupilsContext.Provider>;
}

export function usePupils(): PupilsContextValue {
  const ctx = useContext(PupilsContext);
  if (!ctx) throw new Error("usePupils must be used within PupilsProvider");
  return ctx;
}
