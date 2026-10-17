"use client";

import { useMemo, useSyncExternalStore } from "react";

// YANGI O'QUVCHILAR RO'YXATI — «Ustunlar» tanlovi (design/v2/DESIGN.md →
// «Sahifa qolipi — ro'yxat»). «O'quvchi» (avatar + ism + telefon), belgilash
// va «⋯» doim bor; qolganini xodim o'zi yoqadi/o'chiradi.
//
// Tanlov HAR FOYDALANUVCHINING BRAUZERIDA saqlanadi (design/v2/SAVOLLAR.md,
// 23-savol taxmini). localStorage ishlamasa (yashirin oyna) — shu sahifa
// ochiq turguncha xotirada. Serverda doim sukut — `useSyncExternalStore`
// birinchi chizishni server bilan bir xil qiladi, keyin brauzerdagisiga o'tadi.
//
// Eski sahifadagi «To'lov sanasi», «Taklif qilganlari», «Ilovani yuklab olish
// sanasi», «Shartnoma», «Kelmagan davri» bu yerda YO'Q: o'quvchi modelida
// ularning maydoni yo'q, eski jadvalda ham doim «—» turardi (SAVOLLAR 30).

export type StudentColumnKey =
  | "id"
  | "groups"
  | "teacher"
  | "balance"
  | "coin"
  | "status"
  | "source"
  | "moderator"
  | "category"
  | "createdAt";

export type StudentSortKey = "name" | "balance" | "coin" | "createdAt";

export interface StudentColumn {
  key: StudentColumnKey;
  label: string;
  /** Sukut bo'yicha ko'rinadimi. */
  on: boolean;
  /** Saralash kaliti — sarlavha bosilsa shu bo'yicha. */
  sort?: StudentSortKey;
  align?: "right";
}

/**
 * Jadvaldagi tartib — «Ustunlar» ro'yxatida ham shu tartib. 18.10.2026 dagi
 * «O'quvchi · Tezkor panel» rasmida jadval boshi ko'rindi: O'quvchi → Guruh
 * (kurs, fan rangidagi nuqta bilan) → O'qituvchi. Shu sabab «Guruh» kursni
 * ko'rsatadi (alohida «Kurs» ustuni ortiqcha bo'ldi), ID va Manba esa sukutda
 * o'chiq — 1366 px noutbukda jadval aylantirishsiz sig'sin.
 */
export const STUDENT_COLUMNS: StudentColumn[] = [
  { key: "groups", label: "Guruh", on: true },
  { key: "teacher", label: "O'qituvchi", on: true },
  { key: "balance", label: "Balans", on: true, sort: "balance", align: "right" },
  { key: "coin", label: "Tanga", on: true, sort: "coin", align: "right" },
  { key: "status", label: "Holati", on: true },
  { key: "createdAt", label: "Qo'shilgan", on: true, sort: "createdAt" },
  { key: "id", label: "ID", on: false },
  { key: "source", label: "Manba", on: false },
  { key: "moderator", label: "Moderator", on: false },
  { key: "category", label: "Kategoriya", on: false },
];

/** «2» — 18.10.2026 da sukut o'zgardi (Guruh/O'qituvchi): eski tanlov hammada yangi sukutga qaytsin. */
const KEY = "v2:students-list:columns:2";
const EVENT = "v2-students-columns";
const VALID = new Set<string>(STUDENT_COLUMNS.map((c) => c.key));
const DEFAULT_ON = STUDENT_COLUMNS.filter((c) => c.on).map((c) => c.key);

/** localStorage yozilmasa (yashirin oyna) — shu yerda turadi. */
let memory: string | null = null;

function subscribe(cb: () => void): () => void {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? memory ?? "";
  } catch {
    return memory ?? "";
  }
}

function readServer(): string {
  return "";
}

function parse(raw: string): StudentColumnKey[] {
  if (!raw) return DEFAULT_ON;
  try {
    const list = JSON.parse(raw);
    if (Array.isArray(list)) return list.filter((k): k is StudentColumnKey => typeof k === "string" && VALID.has(k));
  } catch {
    // buzilgan yozuv — sukutga qaytamiz
  }
  return DEFAULT_ON;
}

/** `null` — sukutga qaytarish. */
function write(keys: StudentColumnKey[] | null): void {
  memory = keys ? JSON.stringify(keys) : null;
  try {
    if (memory) localStorage.setItem(KEY, memory);
    else localStorage.removeItem(KEY);
  } catch {
    // localStorage yopiq — `memory` yetadi
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useStudentColumns() {
  const raw = useSyncExternalStore(subscribe, read, readServer);
  const visible = useMemo(() => new Set(parse(raw)), [raw]);
  const isDefault = raw === "" || [...visible].sort().join() === [...DEFAULT_ON].sort().join();

  function toggle(key: StudentColumnKey) {
    const next = new Set(visible);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    // Tartib — jadvaldagidek.
    write(STUDENT_COLUMNS.map((c) => c.key).filter((k) => next.has(k)));
  }

  return { visible, isDefault, toggle, reset: () => write(null) };
}
