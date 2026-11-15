"use client";

import { useCallback, useSyncExternalStore } from "react";
import { STUDENT_UI_KEY, type StudentUiChoice } from "@/lib/studentCabinetTypes";

// O'QUVCHI KABINETI: QURILMADAGI TANLOVLAR (brauzer xotirasi, localStorage).
//
//   • Ko'rinish — yangi (v2) yoki eski kabinet. Sukut — yangi; «Eski ko'rinish»
//     tanlansa shu qurilmada eslab qolinadi.
//   • Mavzu — yorug'/qorong'i. Qo'lda tanlanmagan bo'lsa Telegram mavzusi
//     (colorScheme) olinadi; tanlangan bo'lsa — o'sha ustun.
//
// Xodimlar mavzusi (`tizimli:theme`, components/shared/Theme.tsx) bilan
// ATAYIN aralashtirilmaydi: bitta telefonda xodim ham, o'quvchi ham bo'lishi
// mumkin va biri ikkinchisining tanlovini o'zgartirmasin.
//
// localStorage yopiq bo'lsa (yashirin oyna, Telegram cheklovi) — xato emas:
// sukut qiymat ishlaydi, tanlov shunchaki eslab qolinmaydi.

export const STUDENT_THEME_KEY = "tizimli_student_theme";
export type StudentTheme = "light" | "dark";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Saqlanmasa ham joriy oynada tanlov ishlaydi.
  }
}

// ── Ko'rinish (yangi / eski) ─────────────────────────────────────────

const uiListeners = new Set<() => void>();
// Xotira yopiq bo'lsa ham tanlov joriy oynada ishlasin — oxirgi tanlov shu yerda.
let uiMemory: StudentUiChoice | null = null;

function uiSubscribe(cb: () => void): () => void {
  uiListeners.add(cb);
  return () => {
    uiListeners.delete(cb);
  };
}

function uiSnapshot(): StudentUiChoice {
  if (uiMemory) return uiMemory;
  return read(STUDENT_UI_KEY) === "old" ? "old" : "new";
}

/** Kabinet ko'rinishi (sukut — yangi) va uni o'zgartirish. */
export function useStudentUi(): [StudentUiChoice, (next: StudentUiChoice) => void] {
  const ui = useSyncExternalStore(uiSubscribe, uiSnapshot, () => "new" as const);
  const set = useCallback((next: StudentUiChoice) => {
    uiMemory = next;
    write(STUDENT_UI_KEY, next);
    for (const cb of uiListeners) cb();
    window.scrollTo({ top: 0 });
  }, []);
  return [ui, set];
}

// ── Mavzu ────────────────────────────────────────────────────────────

/** Qo'lda tanlangan mavzu; tanlanmagan — null (Telegram mavzusi ishlaydi). */
export function storedStudentTheme(): StudentTheme | null {
  const v = read(STUDENT_THEME_KEY);
  return v === "dark" || v === "light" ? v : null;
}

/** `<html class="dark">` — v2 tokenlari ham, eski kabinet ham shuni o'qiydi. */
export function applyStudentTheme(dark: boolean): void {
  document.documentElement.classList.toggle("dark", dark);
}

/** Menyudan tanlash: eslab qoladi va darhol qo'llaydi. */
export function chooseStudentTheme(theme: StudentTheme): void {
  write(STUDENT_THEME_KEY, theme);
  applyStudentTheme(theme === "dark");
}

function darkSubscribe(cb: () => void): () => void {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

/** Hozir qorong'i mavzumi — `<html>` klassidan (kim qo'ygan bo'lsa ham). */
export function useHtmlDark(): boolean {
  return useSyncExternalStore(
    darkSubscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}
