"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_LANG, htmlLang, normalizeLang, translate, type Lang, type TParams } from "@/lib/i18n";

// Navbardagi til tanlovi butun ilova bo'ylab ishlashi kerak: har bir
// komponent `useT()` orqali matnni shu tilda oladi, sana tanlagichlar
// oy/kun nomlarini ham. Ilgari til faqat Navbar ichidagi lokal `useState`
// edi va boshqa komponentlar uni ko'ra olmasdi.
//
// TIL QURILMAGA BOG'LANGAN (18.09.2026 qarori): localStorage — manba,
// cookie — uning NUSXASI, serverga birinchi chizish uchun (app/layout.tsx
// cookie'ni o'qib `LangProvider` ga beradi, `<html lang>` ham shundan).
// Ikkalasi birga yoziladi; ajralib qolsa (masalan localStorage tozalangan)
// localStorage → cookie → sukut tartibida o'qiladi.
//
// React Context o'rniga `useSyncExternalStore` ishlatilgan: til tashqi
// manbada (localStorage) va effekt ichida setState kerak emas. Server
// snapshot'i CONTEXT'dan olinadi (cookie qiymati) — gidratatsiya
// serverdagi HTML bilan bir xil tilda bo'ladi, keyin (kerak bo'lsa)
// localStorage qiymatiga o'tadi.
//
// TIL ALMASHGANDA SAHIFA YANGILANMAYDI: matn faqat klient komponentlarda,
// ular store'ga obuna — `setLang` hammasini shu zahoti qayta chizadi.

const KEY = "tizimli:lang";
const COOKIE = "tizimli_lang";
/** Bir yil — til tanlovi "unutilib" qolmasin. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const listeners = new Set<() => void>();

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
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
    const stored = localStorage.getItem(KEY);
    if (stored) return normalizeLang(stored);
  } catch {
    // localStorage o'chirilgan bo'lsa ham ilova ishlayversin.
  }
  return normalizeLang(readCookie());
}

export function setLang(next: Lang): void {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // localStorage o'chirilgan bo'lsa ham ilova ishlayversin.
  }
  try {
    document.cookie = `${COOKIE}=${encodeURIComponent(next)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    document.documentElement.lang = htmlLang(next);
  } catch {
    // cookie yozilmasa faqat birinchi chizish o'zbekcha bo'ladi — jiddiy emas.
  }
  for (const cb of listeners) cb();
}

/** Serverdagi birinchi chizish tili — app/layout.tsx cookie'dan beradi. */
const InitialLangContext = createContext<Lang>(DEFAULT_LANG);

export function LangProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  return <InitialLangContext.Provider value={initial}>{children}</InitialLangContext.Provider>;
}

/** Joriy til va uni o'zgartirish funksiyasi. */
export function useLang(): [Lang, (next: Lang) => void] {
  const initial = useContext(InitialLangContext);
  const lang = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  const set = useCallback((next: Lang) => setLang(next), []);
  return [lang, set];
}

/**
 * Tarjima funksiyasi — komponentlarda MATN SHU ORQALI chiqadi:
 *
 *   const { t } = useT();
 *   <button>{t("Saqlash")}</button>
 *   t("{n} ta o'quvchi", { n: count })
 *
 * Kalit — o'zbekcha manba matn (lib/i18n.ts izohi). `t` tilga bog'liq:
 * til almashsa uni ishlatgan komponent qayta chiziladi.
 */
export function useT(): { t: (key: string, params?: TParams) => string; lang: Lang } {
  const [lang] = useLang();
  const t = useCallback((key: string, params?: TParams) => translate(lang, key, params), [lang]);
  return { t, lang };
}
