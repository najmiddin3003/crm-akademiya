"use client";

import { useMemo, useSyncExternalStore } from "react";

// KASSA SUMMASINI YASHIRISH — har kartochkada o'z «ko'z» tugmasi (rasm
// «Kassalar», 18.10.2026: bitta kassa ochiq, uchtasi «•••••• so'm»). Eski
// sahifadagi bitta umumiy tugma o'rniga. Tanlov shu brauzerda saqlanadi
// (yashirin oynada — sahifa ochiq turguncha xotirada); sukut — ko'rinadi.

const KEY = "v2:cash:hidden";
const EVENT = "v2-cash-hidden";
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

function write(ids: number[]): void {
  memory = JSON.stringify(ids);
  try {
    localStorage.setItem(KEY, memory);
  } catch {
    // localStorage yopiq — `memory` yetadi
  }
  window.dispatchEvent(new Event(EVENT));
}

function parse(raw: string): number[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((n): n is number => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

export function useHiddenBalances() {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  const hidden = useMemo(() => new Set(parse(raw)), [raw]);
  return {
    isHidden: (id: number) => hidden.has(id),
    toggle: (id: number) => {
      const now = new Set(parse(read()));
      if (now.has(id)) now.delete(id);
      else now.add(id);
      write([...now]);
    },
  };
}
