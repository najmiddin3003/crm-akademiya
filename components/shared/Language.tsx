"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Lang } from "@/lib/i18n";

// Navbardagi til tanlovi butun ilova bo'ylab ishlashi kerak: sana
// tanlagichlardagi oy/kun nomlari ham o'sha tilda chiqadi. Ilgari til faqat
// Navbar ichidagi lokal `useState` edi va boshqa komponentlar uni ko'ra
// olmasdi.
//
// React Context o'rniga `useSyncExternalStore` ishlatilgan: til localStorage'da
// saqlanadi, ya'ni bu tashqi manba. Bu yondashuv SSR bilan ham to'g'ri ishlaydi
// (serverda doim "uz") va effekt ichida setState chaqirishni talab qilmaydi —
// aks holda `react-hooks/set-state-in-effect` qoidasi buziladi.

const KEY = "tizimli:lang";
const DEFAULT: Lang = "uz";

const listeners = new Set<() => void>();

function normalize(v: string | null): Lang {
  return v === "en" || v === "ru" ? v : DEFAULT;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  // Boshqa tabda o'zgarsa ham yangilanadi.
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

// Satr qaytaradi — qiymat bo'yicha solishtiriladi, shuning uchun har chaqiruvda
// yangi obyekt yaratilmaydi va cheksiz render bo'lmaydi.
function getSnapshot(): Lang {
  try {
    return normalize(localStorage.getItem(KEY));
  } catch {
    return DEFAULT;
  }
}

function getServerSnapshot(): Lang {
  return DEFAULT;
}

export function setLang(next: Lang): void {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // localStorage o'chirilgan bo'lsa ham ilova ishlayversin.
  }
  for (const cb of listeners) cb();
}

/** Joriy til va uni o'zgartirish funksiyasi. */
export function useLang(): [Lang, (next: Lang) => void] {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const set = useCallback((next: Lang) => setLang(next), []);
  return [lang, set];
}
