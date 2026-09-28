"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// Navigatsiya tarixi: har bir kirilgan (app) sahifasi bitta stackda saqlanadi
// va localStorage'ga yoziladi. "Orqaga" tugmasi shu stack bo'ylab bitta-bitta
// ortga qaytaradi. Sayt qayta ochilganda (login "/" ga tushib) eng oxirgi
// saqlangan sahifaga avtomatik o'tkazadi.
//
// Eslatma: auth tekshiruvi hali yo'q (backend qo'shilganda qilinadi) — hozircha
// "/" ga tushilganda shunchaki oxirgi sahifaga resume qilinadi.

const STORAGE_KEY = "crm_nav_stack";
const MAX_STACK = 50;
// Kirish sahifasi va OMMAVIY sahifalar (proxy.ts PUBLIC_PATHS bilan bir xil)
// navigatsiya tarixiga yozilmaydi. 19.09.2026 gacha faqat "/" chiqarilgan
// edi: /ariza (ish arizasi) ochilgan brauzerda keyin kirish sahifasi
// "oxirgi sahifa"ga — /ariza ga — qaytarib yuborar, login umuman
// ochilmas edi (chiqib ketgan xodim yoki nomzod bilan bir brauzer).
// "/sorovnoma", "/me" va "/xodim" (botlarning Mini App'lari) 28.09.2026 da
// qo'shildi: ular ham tarixga tushib, keyin kirish sahifasi CRM o'rniga
// o'sha yerga qaytarib yuborardi.
const PUBLIC_PREFIXES = ["/activate", "/ariza", "/oquvchi", "/tezlik", "/sorovnoma", "/me", "/xodim"];
const isAppPath = (p: string) => p !== "/" && !PUBLIC_PREFIXES.some((x) => p === x || p.startsWith(x + "/") || p.startsWith(x + "?"));

interface NavHistoryValue {
  canGoBack: boolean;
  goBack: () => void;
}

const NavHistoryContext = createContext<NavHistoryValue>({ canGoBack: false, goBack: () => {} });

export function useNavHistory() {
  return useContext(NavHistoryContext);
}

export default function NavigationHistoryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [stack, setStack] = useState<string[]>([]);
  const backInProgress = useRef(false);
  const didInit = useRef(false);

  // 1) Ilk yuklanish: saqlangan stackni o'qiymiz va agar login ("/") ga
  //    tushgan bo'lsak, lekin saqlangan (app) sahifa bor bo'lsa — o'sha yerga.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    let stored: string[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(raw)) stored = raw.filter((x) => typeof x === "string" && isAppPath(x));
    } catch {
      stored = [];
    }
    setStack(stored);

    const last = stored[stored.length - 1];
    if (pathname === "/" && last) {
      router.replace(last);
    }
  }, [pathname, router]);

  // 2) Har bir navigatsiyani kuzatib boramiz (faqat app sahifalari).
  useEffect(() => {
    if (!isAppPath(pathname)) return;
    setStack((prev) => {
      let next: string[];
      if (backInProgress.current) {
        backInProgress.current = false;
        next = prev.slice(0, -1);
        if (next[next.length - 1] !== pathname) next = [...next, pathname];
      } else if (prev[prev.length - 1] === pathname) {
        return prev;
      } else {
        next = [...prev, pathname];
      }
      if (next.length > MAX_STACK) next = next.slice(next.length - MAX_STACK);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* localStorage yo'q/bloklangan bo'lsa — jim o'tamiz */
      }
      return next;
    });
  }, [pathname]);

  const goBack = useCallback(() => {
    if (stack.length < 2) return;
    backInProgress.current = true;
    router.push(stack[stack.length - 2]);
  }, [stack, router]);

  return (
    <NavHistoryContext.Provider value={{ canGoBack: stack.length > 1, goBack }}>
      {children}
    </NavHistoryContext.Provider>
  );
}
