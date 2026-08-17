"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

// Mavzu (yorug'/tungi) endi butun ilova bo'ylab bitta manbadan o'qiladi.
// Ilgari u Navbar ichidagi lokal `useState(false)` edi: mobil chekma menyuga
// almashtirgich qo'yilsa ikki joydagi holat rassinxron bo'lardi, hamda sahifa
// yangilanganda tungi rejim yo'qolib ketardi.
//
// Yondashuv `components/shared/Language.tsx` bilan bir xil — localStorage
// tashqi manba sifatida, `useSyncExternalStore` orqali. SSR'da doim "light"
// qaytadi, shuning uchun server va klient birinchi renderda mos keladi.

const KEY = "tizimli:theme";
type Theme = "light" | "dark";
const DEFAULT: Theme = "light";

const listeners = new Set<() => void>();

function normalize(v: string | null): Theme {
  return v === "dark" ? "dark" : DEFAULT;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): Theme {
  try {
    return normalize(localStorage.getItem(KEY));
  } catch {
    return DEFAULT;
  }
}

function getServerSnapshot(): Theme {
  return DEFAULT;
}

export function setTheme(next: Theme): void {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // localStorage o'chirilgan bo'lsa ham ilova ishlayversin.
  }
  for (const cb of listeners) cb();
}

/** Joriy mavzu (tungi rejimmi) va uni almashtirish funksiyasi. */
export function useTheme(): [boolean, () => void] {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isDark = theme === "dark";

  // `<html>` ga klass qo'yish — DOM bilan sinxronlash. Bu setState emas,
  // shuning uchun `react-hooks/set-state-in-effect` qoidasi buzilmaydi.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const toggle = useCallback(() => {
    setTheme(getSnapshot() === "dark" ? "light" : "dark");
  }, []);

  return [isDark, toggle];
}
