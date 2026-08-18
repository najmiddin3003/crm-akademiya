"use client";

import { useSyncExternalStore } from "react";

// Foydalanuvchi tizim sozlamalarida animatsiyani kamaytirishni yoqqanmi.
// Yondashuv `components/shared/Theme.tsx` bilan bir xil — tashqi manba
// (matchMedia) `useSyncExternalStore` orqali o'qiladi. Effekt ichida
// setState qilinmaydi, ya'ni `react-hooks/set-state-in-effect` buzilmaydi.
//
// SSR'da doim `false` qaytadi (server foydalanuvchi sozlamasini bilmaydi) —
// bu xavfsiz standart: animatsiya bor deb chizamiz, klientda kerak bo'lsa
// birinchi renderdayoq o'chadi.

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
