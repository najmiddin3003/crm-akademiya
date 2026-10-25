"use client";

import { useEffect, useMemo, useState } from "react";
import { useBranch } from "@/components/shared/BranchContext";
import { useT } from "@/components/shared/Language";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { collapseBranchPools } from "@/lib/branchPools";
import { fetchJson } from "@/lib/fetchJson";
import { uzDateIso } from "@/lib/uzTime";

// HISOBOTLAR (15-qism) — umumiy hook'lar: ma'lumot yuklash, sana yozuvlari, filiallar.

/** Markaz nomi (PDF/Excel sarlavhasi) — ochiq anketadagi bilan bir xil. */
export const CENTER_NAME = "Akademiya o'quv markazi";
export const DOC_FOOTER = "Tizimli · tizimli24.uz";

export interface ReportData<T> {
  data: T | null;
  /** Birinchi yuklanish (ma'lumot hali yo'q). */
  loading: boolean;
  /** Yangi so'rov ketyapti — eski ma'lumot xira turadi. */
  stale: boolean;
  error: boolean;
  reload: () => void;
}

/** `url` o'zgarsa qayta so'raydi; eski javob kechikib kelsa — tashlanadi. `null` — so'ramaydi. */
export function useReportData<T>(url: string | null): ReportData<T> {
  const [got, setGot] = useState<{ key: string; data: T } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const key = url ? `${url}#${version}` : null;

  useEffect(() => {
    if (!url || !key) return;
    let off = false;
    fetchJson<T>(url, { cache: "no-store" })
      .then((d) => {
        if (off) return;
        setGot({ key, data: d });
        setFailed(null);
      })
      .catch(() => {
        if (!off) setFailed(key);
      });
    return () => {
      off = true;
    };
  }, [url, key]);

  const error = failed !== null && failed === key;
  return {
    data: got?.data ?? null,
    loading: !got && !error,
    stale: !!got && got.key !== key && !error,
    error,
    reload: () => setVersion((v) => v + 1),
  };
}

/** Sana yozuvlari (`useProfileFmt` ustiga): «25-oktabr 2026», «Sentabr 2026», «1–25-oktabr». */
export function useReportFmt() {
  const f = useProfileFmt();
  const { lang } = useT();
  return useMemo(() => {
    const day = (iso: string) => Number(iso.slice(8, 10));
    /** «25-oktabr 2026» (yil doim). */
    const fullDate = (iso: string) =>
      lang === "en" ? `${f.monthName(iso.slice(0, 7))} ${day(iso)}, ${iso.slice(0, 4)}` : `${day(iso)}-${f.monthLower(iso.slice(0, 7))} ${iso.slice(0, 4)}`;
    /** «Sentabr 2026». */
    const monthTitle = (mk: string) => `${f.monthName(mk)} ${mk.slice(0, 4)}`;
    /** Kunlar oralig'i: «1–25-oktabr», «20-sentabr – 25-oktabr». */
    const dayRange = (from: string, to: string) => {
      if (from === to) return f.dayMonth(from);
      if (from.slice(0, 7) === to.slice(0, 7)) {
        return lang === "en" ? `${f.monthName(to.slice(0, 7))} ${day(from)}–${day(to)}` : `${day(from)}–${f.dayMonth(to)}`;
      }
      return `${f.dayMonth(from)} – ${f.dayMonth(to)}`;
    };
    /** Davom etayotgan oy qatori: «Oktyabr · 1–25». */
    const partialMonth = (mk: string, to: string) => `${f.monthName(mk)} · 1–${day(to)}`;
    return { ...f, fullDate, monthTitle, dayRange, partialMonth };
  }, [f, lang]);
}

/** Bugun (Toshkent) — sahifa ochilganda bir marta. */
export function useToday(): string {
  const [today] = useState(() => uzDateIso());
  return today;
}

/** Filiallar (1+2 hovuzi bitta qator) — tanlov uchun. */
export function useBranchOptions(): { value: string; label: string }[] {
  const branch = useBranch();
  return useMemo(() => collapseBranchPools(branch.branches, branch.branchId).map((b) => ({ value: String(b.id), label: b.name })), [branch.branches, branch.branchId]);
}
