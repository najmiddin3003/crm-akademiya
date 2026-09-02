"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// Navbardagi filial tanlovining KLIENT tomoni.
//
// Tanlovning o'zi cookie'da va kesish SERVERDA bo'ladi (lib/branchScope.ts).
// Bu kontekst navbar qaysi filiallarni ko'rsatishini biladi va tanlovni
// almashtiradi.
//
// ALMASHTIRGANDA SAHIFA TO'LIQ QAYTA YUKLANADI (`location.reload()`).
//
// NIMA UCHUN aynan shunday, "aqlliroq" yo'l emas: sahifalar ma'lumotni
// klientdan oladi va HAR BIRI o'zicha so'raydi — kimdir `useStudents`,
// kimdir `PupilsContext`, kimdir to'g'ridan-to'g'ri `fetch("/api/groups")`
// ni `useEffect(..., [])` ichida. Har biriga "filial o'zgardi" signalini
// ulash mumkin edi, lekin bittasini o'tkazib yuborish yetadi: o'sha
// sahifa BOSHQA FILIAL ma'lumotini ko'rsatib turaveradi va buni hech kim
// sezmaydi. Filial almashtirish — kuniga bir-ikki marta qilinadigan,
// butun ekranni o'zgartiradigan amal; bir soniyalik qayta yuklash uning
// evaziga arziydi va hech qanday teshik qoldirmaydi.
//
// `router.refresh()` bu yerda YORDAM BERMAYDI: u Server Component'larni
// qayta quradi, ma'lumot esa klientdan olinadi.

export interface BranchOption {
  id: number;
  name: string;
}

interface BranchValue {
  /** Tanlangan filial yoki `null` — "Barcha filiallar" (faqat admin). */
  branchId: number | null;
  branches: BranchOption[];
  isAdmin: boolean;
  loading: boolean;
  /** Tanlovni almashtiradi va sahifani qayta yuklaydi. */
  select: (id: number | null) => Promise<void>;
}

const EMPTY: BranchValue = {
  branchId: null,
  branches: [],
  isAdmin: false,
  loading: true,
  select: async () => {},
};

const Ctx = createContext<BranchValue>(EMPTY);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branchId, setBranchId] = useState<number | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/branch")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.ok) return;
        setBranchId(d.branchId ?? null);
        setBranches(d.branches ?? []);
        setIsAdmin(!!d.isAdmin);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const select = useCallback(async (id: number | null) => {
    const res = await fetch("/api/branch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId: id }),
    });
    const d = await res.json().catch(() => null);
    // Server RAD ETSA sahifa qayta yuklanmaydi — interfeys yolg'on
    // ko'rsatmasin (masalan xodim "Barcha filiallar" ni tanlamoqchi bo'lsa).
    if (!d?.ok) return;
    window.location.reload();
  }, []);

  const value = useMemo<BranchValue>(
    () => ({ branchId, branches, isAdmin, loading, select }),
    [branchId, branches, isAdmin, loading, select],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBranch(): BranchValue {
  return useContext(Ctx);
}
