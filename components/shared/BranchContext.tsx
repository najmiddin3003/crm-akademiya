"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// Navbardagi filial tanlovining KLIENT tomoni.
//
// Tanlovning o'zi cookie'da va kesish serverda bo'ladi (lib/branchScope.ts).
// Bu kontekst ikki narsa uchun kerak:
//   1) navbar qaysi filiallarni ko'rsatishini bilishi,
//   2) tanlov o'zgarganda sahifadagi ma'lumot QAYTA SO'RALISHI.
//
// Ikkinchisi uchun `version` bor: u har almashtirishda ortadi va
// ma'lumot yuklaydigan komponentlar uni `useEffect` bog'liqligiga qo'shib,
// so'rovni takrorlaydi. Butun sahifani `router.refresh()` bilan qayta
// qurish ham mumkin edi, lekin sahifalar ma'lumotni klientdan oladi —
// refresh ularga umuman ta'sir qilmaydi.

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
  /** Har almashtirishda ortadi — ma'lumotni qayta so'rash uchun. */
  version: number;
  select: (id: number | null) => Promise<void>;
}

const EMPTY: BranchValue = {
  branchId: null,
  branches: [],
  isAdmin: false,
  loading: true,
  version: 0,
  select: async () => {},
};

const Ctx = createContext<BranchValue>(EMPTY);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branchId, setBranchId] = useState<number | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

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
    // Server RAD ETSA holat o'zgarmaydi — interfeys yolg'on ko'rsatmasin.
    if (!d?.ok) return;
    setBranchId(d.branchId ?? null);
    setVersion((v) => v + 1);
  }, []);

  const value = useMemo<BranchValue>(
    () => ({ branchId, branches, isAdmin, loading, version, select }),
    [branchId, branches, isAdmin, loading, version, select],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBranch(): BranchValue {
  return useContext(Ctx);
}

/**
 * Faqat "qayta so'rash" signali kerak bo'lgan joylar uchun.
 *
 * `useEffect` bog'liqliklariga shuni qo'shish yetarli:
 *   useEffect(() => { …fetch… }, [branchVersion]);
 */
export function useBranchVersion(): number {
  return useContext(Ctx).version;
}
