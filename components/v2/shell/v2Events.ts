"use client";

import type { Pupil } from "@/lib/pupilsData";

// YANGI VERSIYA: QOBIQ HODISALARI. «+ Yangi» dan ochilgan forma (qobiqda,
// ./CreateContext.tsx) sahifadan TASHQARIDA turadi — sahifa ma'lumoti
// (O'quvchilar ro'yxati, kassalar, balanslar) o'zi yangilanishi uchun shu
// hodisalarni tinglaydi. Sahifaning o'z oynalari callback bilan ishlaydi.

const PUPIL_CREATED = "v2:pupil-created";
const MONEY_CHANGED = "v2:money-changed";

export function emitPupilCreated(pupil: Pupil, groupId: number | null): void {
  window.dispatchEvent(new CustomEvent(PUPIL_CREATED, { detail: { pupil, groupId } }));
}

export function onPupilCreated(cb: (pupil: Pupil, groupId: number | null) => void): () => void {
  const h = (e: Event) => {
    const d = (e as CustomEvent<{ pupil: Pupil; groupId: number | null }>).detail;
    if (d?.pupil) cb(d.pupil, d.groupId);
  };
  window.addEventListener(PUPIL_CREATED, h);
  return () => window.removeEventListener(PUPIL_CREATED, h);
}

/** Kassada pul harakati bo'ldi (to'lov, kirim, chiqim, ko'chirma). */
export function emitMoneyChanged(): void {
  window.dispatchEvent(new Event(MONEY_CHANGED));
}

export function onMoneyChanged(cb: () => void): () => void {
  window.addEventListener(MONEY_CHANGED, cb);
  return () => window.removeEventListener(MONEY_CHANGED, cb);
}
