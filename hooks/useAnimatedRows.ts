"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

// FILTRLASH ANIMATSIYASI — ro'yxat o'zgarganda qatorlar sakrab emas,
// yumshoq almashsin (foydalanuvchi talabi, 23.09.2026):
//   • yangi qator  — pastdan suzib kiradi (`stk-row-enter`, zinapoyali);
//   • ketayotgani  — joyida so'nadi (`stk-row-exit`), EXIT_MS dan keyin
//                    DOM'dan olinadi;
//   • qolganlari   — eski joyidan yangisiga siljiydi (FLIP: avval o'lchab,
//                    teskari siljitib, Web Animations bilan qaytaramiz).
//
// Ketayotgan qatorni ushlab turish uchun ro'yxat HOLATDA saqlanadi va
// yangi `items` kelganda render paytida birlashtiriladi — React'ning
// "oldingi props'dan hosil holat" qolipi (effektda setState emas).

export type RowPhase = "enter" | "idle" | "exit";

export interface AnimatedRow<T> {
  key: number;
  item: T;
  phase: RowPhase;
  /** Kirish zinapoyasi uchun tartib (animation-delay). */
  order: number;
}

interface State<T> {
  items: T[];
  signature: string;
  rows: AnimatedRow<T>[];
}

export const ROW_EXIT_MS = 170;

function merge<T>(prev: State<T>, items: T[], keyOf: (item: T) => number, signature: string): State<T> {
  // Zinapoya faqat filtr o'zgarganda (yoki birinchi to'lganda) — oddiy
  // ma'lumot yangilanishida qatorlar bittalab "sakrab" chiqmasin.
  const stagger = prev.signature !== signature || prev.rows.length === 0;
  const nextKeys = new Set(items.map(keyOf));
  const live = prev.rows.filter((r) => r.phase !== "exit");
  const liveKeys = new Set(live.map((r) => r.key));
  let n = 0;
  const rows: AnimatedRow<T>[] = items.map((item) => {
    const key = keyOf(item);
    if (liveKeys.has(key)) return { key, item, phase: "idle", order: 0 };
    return { key, item, phase: "enter", order: stagger ? n++ : 0 };
  });
  live.forEach((r, i) => {
    if (nextKeys.has(r.key)) return;
    rows.splice(Math.min(i, rows.length), 0, { ...r, phase: "exit", order: 0 });
  });
  return { items, signature, rows };
}

export function useAnimatedRows<T>(items: T[], keyOf: (item: T) => number, signature: string): AnimatedRow<T>[] {
  // Birinchi chizishda ham qatorlar kirish animatsiyasi bilan chiqadi
  // (masalan tabga qaytilganda).
  const [state, setState] = useState<State<T>>(() => merge({ items: [], signature, rows: [] }, items, keyOf, signature));
  if (state.items !== items) {
    setState(merge(state, items, keyOf, signature));
  }
  const rows = state.rows;

  const hasExit = rows.some((r) => r.phase === "exit");
  useEffect(() => {
    if (!hasExit) return;
    const id = window.setTimeout(() => {
      setState((s) => ({ ...s, rows: s.rows.filter((r) => r.phase !== "exit") }));
    }, ROW_EXIT_MS);
    return () => window.clearTimeout(id);
  }, [hasExit, rows]);

  return rows;
}

/**
 * FLIP: qolgan qatorlarni eski joyidan yangi joyiga siljitadi.
 *
 * Joy `offsetTop` bilan o'lchanadi, getBoundingClientRect bilan EMAS: u
 * transformni hisobga olmaydi. Aks holda kirish animatsiyasi o'rtasida
 * (qator hali 10 px pastda) yozib olingan joy keyingi filtrda soxta
 * "siljish" berardi. Scroll ham ta'sir qilmaydi — o'lchov jadvalga nisbatan.
 */
export function useFlipRows<T>(rows: AnimatedRow<T>[], bodyRef: RefObject<HTMLElement | null>, els: RefObject<Map<number, HTMLElement>>) {
  const tops = useRef(new Map<number, number>());
  const last = useRef<AnimatedRow<T>[] | null>(null);
  useLayoutEffect(() => {
    if (!bodyRef.current) return;
    const next = new Map<number, number>();
    els.current.forEach((el, key) => next.set(key, el.offsetTop));
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (last.current && last.current !== rows && !reduced) {
      const phase = new Map(rows.map((r) => [r.key, r.phase]));
      next.forEach((top, key) => {
        const prev = tops.current.get(key);
        const el = els.current.get(key);
        if (prev === undefined || !el || phase.get(key) !== "idle") return;
        const dy = prev - top;
        if (Math.abs(dy) < 1) return;
        el.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], {
          duration: 280,
          easing: "cubic-bezier(.2,.8,.2,1)",
        });
      });
    }
    tops.current = next;
    last.current = rows;
  }, [rows, bodyRef, els]);
}
