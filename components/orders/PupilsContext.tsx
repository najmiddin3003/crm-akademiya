"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { NewPupilValues, Pupil, PupilListItem } from "@/lib/pupilsData";
import { invalidateStudents, loadPupilsCached } from "@/hooks/useStudents";

// Shared pupils store for the orders-list route segment (mounted alongside
// OrdersContext by app/(app)/orders-list/layout.tsx), backed by MongoDB via
// /api/pupils. Both the AddOrderModal drawer (list view) and AddOrderPage
// (Kanban "Qo'shish" full page) read through this so "O'quvchi"/"Referal
// bergan o'quvchi" show real students — not the static demo constants/index.js
// STUDENTS list — and a pupil created via one surface is immediately
// searchable on the other.

/**
 * Buyurtma paneli ro'yxati — asosiy to'plam USTIGA `birthDate`.
 * OrderDetailPage kartada yoshni ko'rsatadi, shu bois u so'raladi.
 */
export type OrderPupil = PupilListItem & Pick<Pupil, "birthDate">;

interface PupilsContextValue {
  pupils: OrderPupil[];
  loading: boolean;
  createPupil: (values: NewPupilValues) => Promise<Pupil | null>;
  /**
   * Ism -> "+998 XX XXX XX XX". Topilmasa bo'sh satr.
   *
   * NEGA KONTEKSTDA: `StudentSearchSelect` telefon bo'yicha qidirishni
   * FAQAT `subtitleOf` berilgan bo'lsa qila oladi — uning `haystackOf`
   * funksiyasi ism bilan ost-satrni birga qidiradi va raqam kiritilganda
   * ikkalasidan ham raqam bo'lmagan belgilarni tashlab solishtiradi
   * ("94 155 88 55" ni "941558855" deb ham topadi). Ost-satr berilmasa
   * qidiruv faqat ism bo'yicha ishlaydi.
   *
   * Xarita bir marta, provider'da tuziladi: uni "O'quvchi",
   * "Referal bergan o'quvchi" (AddOrderModal) va AddOrderPage'dagi
   * referal maydoni — uchalasi ham ishlatadi.
   */
  phoneOf: (name: string) => string;
}

const PupilsContext = createContext<PupilsContextValue | null>(null);

export function PupilsProvider({ children }: { children: ReactNode }) {
  // `birthDate` — buyurtma kartasidagi yosh uchun (OrderDetailPage).
  // Standart to'plamda yo'q, shu bois ataylab so'raymiz.
  const [pupils, setPupils] = useState<OrderPupil[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadPupilsCached<"birthDate">({ extra: ["birthDate"] })
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

  // Bir xil ismli o'quvchilar bor (bazada 500 dan ortiq ism takrorlanadi),
  // shu bois BIRINCHISI yutadi — hooks/useStudents.ts dagi `byName` bilan
  // bir xil qoida.
  const phoneByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of pupils) {
      const k = `${p.firstName} ${p.lastName}`.trim().toLowerCase();
      if (!m.has(k) && p.phone) m.set(k, `+998 ${p.phone}`);
    }
    return m;
  }, [pupils]);
  const phoneOf = useCallback(
    (name: string) => phoneByName.get(name.trim().toLowerCase()) ?? "",
    [phoneByName],
  );

  const value = useMemo(
    () => ({ pupils, loading, createPupil, phoneOf }),
    [pupils, loading, createPupil, phoneOf],
  );

  return <PupilsContext.Provider value={value}>{children}</PupilsContext.Provider>;
}

export function usePupils(): PupilsContextValue {
  const ctx = useContext(PupilsContext);
  if (!ctx) throw new Error("usePupils must be used within PupilsProvider");
  return ctx;
}
