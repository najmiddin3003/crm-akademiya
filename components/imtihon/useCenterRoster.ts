"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadPupilsCached } from "@/hooks/useStudents";
import type { Pupil } from "@/lib/pupilsData";
import type { StudentRow } from "@/lib/studentsData";

// GURUHSIZ RO'YXAT — eski (GroupExamDrawer) va yangi (v2/imtihon/ExamEntryV2) panel uchun bitta manba
// (qoidalari va sof yordamchilari examRoster.ts da): filialning faol o'quvchilari, ro'yxatda yo'q ism
// uchun butun bazadan qidiruv va uzun ro'yxatni tez chizish.

/** Filialning (hovuzi bilan) faol o'quvchilari — id/ism/telefon, `?light=1&status=Aktiv` (30 s kesh). */
export function useActivePupils(enabled: boolean): { list: Pupil[] | null; error: boolean; retry: () => void } {
  const [state, setState] = useState<{ list: Pupil[] | null; error: boolean }>({ list: null, error: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadPupilsCached({ light: true, status: "Aktiv" })
      .then((list) => {
        if (!cancelled) setState({ list: list as unknown as Pupil[], error: false });
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ list: s.list, error: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, attempt]);
  const retry = useCallback(() => {
    setState((s) => ({ ...s, error: false }));
    setAttempt((n) => n + 1);
  }, []);
  return { ...state, retry };
}

/**
 * Faollar orasida topilmagan ism — butun filial bazasidan (arxivdagi, muzlatilgan ham):
 * /api/search/students (navbardagi qidiruv bilan bir xil qamrov), 2 harfdan, 300 ms kechikish bilan.
 */
export function useOutsideSearch(query: string, enabled: boolean): { rows: StudentRow[]; loading: boolean } {
  const q = query.trim();
  const on = enabled && q.length >= 2;
  const [res, setRes] = useState<{ q: string; rows: StudentRow[] } | null>(null);
  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/search/students?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setRes({ q, rows: d?.ok ? (d.students as StudentRow[]) : [] });
        })
        .catch(() => {
          if (!cancelled) setRes({ q, rows: [] });
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [on, q]);
  const fresh = on && res !== null && res.q === q;
  return { rows: fresh ? res.rows : [], loading: on && !fresh };
}

/**
 * Uzun jadval — Akademiya'da ~5 000 faol o'quvchi: hammasini chizish har harf bosilganda sezilarli
 * qotirardi. Faqat ko'rinib turgan qatorlar (± `overscan`) chiziladi, qolgani yuqori/pastki bo'sh
 * oraliq (`padTop`/`padBottom` balandlikdagi qatorlar). Jadval o'z aylantiriladigan qutisida
 * (`setBox`), sarlavhasi `sticky`. Qator balandligi birinchi chizilgan qatordan o'lchanadi
 * (`measureRow`), sarlavhaniki — `measureHead`.
 */
export function useVirtualRows(count: number, estimate: number, overscan = 10) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [headH, setHeadH] = useState(0);
  const [rowH, setRowH] = useState(estimate);
  const [view, setView] = useState({ top: 0, height: 640 });

  const sync = useCallback(() => {
    const el = boxRef.current;
    if (!el) return;
    const next = { top: el.scrollTop, height: el.clientHeight };
    setView((v) => (v.top === next.top && v.height === next.height ? v : next));
  }, []);

  // Ro'yxat uzunligi o'zgarsa (qidiruv, filtr) quti balandligi ham o'zgaradi: ResizeObserver buni
  // keyingi kadrda aytadi, kadr chizilmaydigan (yashirin) oynada esa umuman aytmaydi — chizilgan
  // zahoti o'lchab qo'yiladi.
  useEffect(() => {
    sync();
  }, [count, sync]);

  /** Aylantiriladigan quti — o'lchami o'zgarsa (oyna, panel) ko'rinadigan oraliq qayta hisoblanadi. */
  const setBox = useCallback(
    (el: HTMLDivElement | null) => {
      boxRef.current = el;
      roRef.current?.disconnect();
      roRef.current = null;
      if (!el) return;
      // ResizeObserver kuzatish boshlanganda ham bir marta chaqiradi — boshlang'ich o'lcham shundan.
      const ro = new ResizeObserver(() => sync());
      ro.observe(el);
      roRef.current = ro;
    },
    [sync],
  );

  const measureRow = useCallback((el: HTMLTableRowElement | null) => {
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    if (h > 0) setRowH((cur) => (Math.abs(cur - h) > 0.5 ? h : cur));
  }, []);

  const measureHead = useCallback((el: HTMLTableSectionElement | null) => {
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    setHeadH((cur) => (Math.abs(cur - h) > 0.5 ? h : cur));
  }, []);

  const first = Math.max(0, Math.min(count, Math.floor(Math.max(0, view.top - headH) / rowH) - overscan));
  const last = Math.min(count, Math.ceil((view.top + view.height) / rowH) + overscan);

  /** `i`-qator to'liq ko'rinsin (sarlavha ostida qolmasin) — Enter/↑↓ bilan yurganda. */
  const scrollToIndex = useCallback(
    (i: number) => {
      const el = boxRef.current;
      if (!el) return;
      const top = headH + i * rowH;
      if (top < el.scrollTop + headH) el.scrollTop = top - headH;
      else if (top + rowH > el.scrollTop + el.clientHeight) el.scrollTop = top + rowH - el.clientHeight;
      sync();
    },
    [headH, rowH, sync],
  );

  /** Filtr yoki qidiruv o'zgarganda — ro'yxat boshiga. */
  const scrollToTop = useCallback(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = 0;
    sync();
  }, [sync]);

  return {
    setBox,
    /** Qutining `onScroll` i. */
    onScroll: sync,
    measureRow,
    measureHead,
    first,
    last: Math.max(first, last),
    padTop: first * rowH,
    padBottom: Math.max(0, (count - Math.max(first, last)) * rowH),
    scrollToIndex,
    scrollToTop,
  };
}
