"use client";

import { useMemo, useSyncExternalStore } from "react";

// YANGI VERSIYA: JADVAL USTUNLARI SOZLAMASI — «Ustunlar» oynasi
// (./ColumnsControl.tsx, design/v2/DESIGN.md → «Ustunlar oynasi»). Har ro'yxat
// o'z kaliti bilan saqlaydi: qaysi ustunlar ko'rinadi, QAYSI TARTIBDA va
// qator zichligi (Ixcham / Keng).
//
// HAR FOYDALANUVCHINING BRAUZERIDA (design/v2/SAVOLLAR.md, 23-savol taxmini).
// localStorage ishlamasa (yashirin oyna) — shu sahifa ochiq turguncha
// xotirada. Serverda doim sukut — `useSyncExternalStore` birinchi chizishni
// server bilan bir xil qiladi, keyin brauzerdagisiga o'tadi.
//
// Saqlanadigan shakl: `{"cols":["groups","teacher"],"density":"compact"}` —
// `cols` faqat ko'rinadigan (qulflanmagan) ustunlar, ko'rinish tartibida.
// Eski shakl — oddiy massiv (O'quvchilar ro'yxati 18.10.2026 gacha) — ham
// o'qiladi: tartib o'sha, zichlik sukut.

export type RowDensity = "compact" | "wide";

export interface ColumnDef<K extends string = string> {
  key: K;
  label: string;
  /** Sukut bo'yicha ko'rinadimi. */
  on: boolean;
  /** Doim ko'rinadi va doim birinchi — o'chirib ham, surib ham bo'lmaydi («Guruh nomi», «O'quvchi»). */
  locked?: boolean;
  align?: "right";
}

export interface ColumnPrefs<C extends ColumnDef = ColumnDef> {
  /** Qulflangan ustunlar (sahifa ularni o'zi chizadi — doim boshida). */
  locked: C[];
  /** Ko'rinadigan, qulflanmagan ustunlar — foydalanuvchi tartibida. */
  shown: C[];
  /** Yashirilganlar — ta'rifdagi tartibda. */
  hidden: C[];
  density: RowDensity;
  /** Sukutdagidekmi (ustunlar, tartib va zichlik). */
  isDefault: boolean;
  isVisible: (key: C["key"]) => boolean;
  toggle: (key: C["key"]) => void;
  /** Ko'rinadigan ustunni `shown` dagi `index` o'ringa ko'chiradi. */
  move: (key: C["key"], index: number) => void;
  setDensity: (d: RowDensity) => void;
  reset: () => void;
}

const EVENT = "v2-column-prefs";
const DEFAULT_DENSITY: RowDensity = "compact";

/** localStorage yozilmasa (yashirin oyna) — shu yerda turadi. */
const memory = new Map<string, string>();

function subscribe(cb: () => void): () => void {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? "";
  } catch {
    return memory.get(key) ?? "";
  }
}

function write(key: string, value: string | null): void {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // localStorage yopiq — `memory` yetadi
  }
  window.dispatchEvent(new Event(EVENT));
}

interface Parsed {
  cols: string[];
  density: RowDensity;
}

function parse(raw: string, valid: ReadonlySet<string>, defaults: string[]): Parsed {
  const fallback: Parsed = { cols: defaults, density: DEFAULT_DENSITY };
  if (!raw) return fallback;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fallback; // buzilgan yozuv — sukutga qaytamiz
  }
  const pick = (list: unknown): string[] | null =>
    Array.isArray(list) ? [...new Set(list.filter((k): k is string => typeof k === "string" && valid.has(k)))] : null;
  if (Array.isArray(data)) return { cols: pick(data) ?? defaults, density: DEFAULT_DENSITY };
  if (data && typeof data === "object") {
    const o = data as { cols?: unknown; density?: unknown };
    return { cols: pick(o.cols) ?? defaults, density: o.density === "wide" ? "wide" : DEFAULT_DENSITY };
  }
  return fallback;
}

/**
 * `columns` — modul darajasidagi o'zgarmas massiv bo'lsin (har chizishda
 * yangisi berilsa hisob qayta-qayta bajariladi).
 */
export function useColumnPrefs<C extends ColumnDef>(storageKey: string, columns: readonly C[]): ColumnPrefs<C> {
  const raw = useSyncExternalStore(subscribe, () => read(storageKey), () => "");

  const meta = useMemo(() => {
    const movable = columns.filter((c) => !c.locked);
    return {
      locked: columns.filter((c) => c.locked),
      movable,
      byKey: new Map<string, C>(movable.map((c) => [c.key, c])),
      valid: new Set<string>(movable.map((c) => c.key)),
      defaults: movable.filter((c) => c.on).map((c) => c.key as string),
    };
  }, [columns]);

  const state = useMemo(() => parse(raw, meta.valid, meta.defaults), [raw, meta]);

  return useMemo(() => {
    const { locked, movable, byKey, valid, defaults } = meta;
    const visible = new Set<string>(state.cols);
    const shown = state.cols.map((k) => byKey.get(k)).filter((c): c is C => Boolean(c));
    const hidden = movable.filter((c) => !visible.has(c.key));
    const isDefault = state.density === DEFAULT_DENSITY && state.cols.join("|") === defaults.join("|");

    // O'zgartirishlar HAR SAFAR saqlangan qiymatdan hisoblanadi, yopilgan
    // `state` dan emas: surish paytida `move` ketma-ket chaqiriladi va React
    // qayta chizishga ulgurmagan bo'lishi mumkin (eski holat ustiga yozilmasin).
    const current = () => parse(read(storageKey), valid, defaults);
    const save = (cols: string[], density: RowDensity) => write(storageKey, JSON.stringify({ cols, density }));

    return {
      locked,
      shown,
      hidden,
      density: state.density,
      isDefault,
      isVisible: (key: C["key"]) => locked.some((c) => c.key === key) || visible.has(key),
      toggle: (key: C["key"]) => {
        if (!valid.has(key)) return; // qulflangan yoki noma'lum
        const now = current();
        // Yoqilgan ustun ro'yxat OXIRIGA qo'shiladi — o'chirilsa yashirilganlarga qaytadi.
        save(now.cols.includes(key) ? now.cols.filter((k) => k !== key) : [...now.cols, key], now.density);
      },
      move: (key: C["key"], index: number) => {
        const now = current();
        const from = now.cols.indexOf(key);
        if (from < 0) return;
        const to = Math.max(0, Math.min(now.cols.length - 1, index));
        if (to === from) return;
        const next = [...now.cols];
        next.splice(from, 1);
        next.splice(to, 0, key);
        save(next, now.density);
      },
      setDensity: (d: RowDensity) => {
        const now = current();
        if (d !== now.density) save(now.cols, d);
      },
      reset: () => write(storageKey, null),
    };
  }, [storageKey, meta, state]);
}

/**
 * Qator zichligi → jadval klasslari. Balandlik `<tr>` da (jadvalda u eng
 * kichik balandlik): bir qatorli katak ham rasmdagidek ~52 px bo'ladi, ikki
 * qatorli (ism + telefon) katak o'z ichki chekinishi bilan o'sadi.
 */
export const DENSITY_ROW: Record<RowDensity, string> = {
  compact: "h-[52px]",
  wide: "h-16",
};
export const DENSITY_CELL: Record<RowDensity, string> = {
  compact: "py-2.5",
  wide: "py-3.5",
};
