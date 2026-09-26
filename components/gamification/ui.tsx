"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLang, useT } from "@/components/shared/Language";

// Gamifikatsiya sahifalarining umumiy bo'laklari: tugma/maydon klasslari,
// maydon ostidagi xato, holat belgisi (chip) va «Ortga» tugmali xabar.

export const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60";
export const btnPrimary =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
export const btnDanger =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost =
  "inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50";
export const btnSm =
  "gm-tap inline-flex h-8 items-center justify-center rounded-lg border border-border bg-card px-2.5 text-[12.5px] font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40";
export const cardCls = "rounded-2xl border border-border bg-card p-4 md:p-5";

/** Maydon ostidagi xato (TZ 5.0) — matn chaqiruvchida o'girilgan. */
export function FieldError({ text }: { text: string }) {
  return text ? (
    <div role="alert" className="mt-1 text-[12px] font-medium text-rose-600">
      {text}
    </div>
  ) : null;
}

export type ChipTone = "g" | "a" | "r" | "m" | "b";
const CHIP: Record<ChipTone, string> = {
  g: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  a: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  r: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  m: "bg-secondary text-muted-foreground",
  b: "bg-primary/10 text-primary",
};

export function Chip({ tone = "m", children, title }: { tone?: ChipTone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${CHIP[tone]}`}>
      {children}
    </span>
  );
}

/** Ishorali son: +5 / −10 / 0 (minus — haqiqiy «−» belgisi). */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0";
}

export function Signed({ n }: { n: number }) {
  return <span className={n > 0 ? "gm-pos" : n < 0 ? "gm-neg" : "text-muted-foreground"}>{signed(n)}</span>;
}

/** "2026-09-26" → "26.09.2026" */
export function fmtDate(iso: string): string {
  return iso.length >= 10 ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : iso;
}

// ── Xabar va «Ortga» (TZ 5.0) ─────────────────────────────────────────
// «Ortga» tugmasi xabarda 8 soniya turadi va xato bosilgan amalni qaytaradi.
// Xabarlar ekran PASTIDA — umumiy toast (o'ng yuqori) jadval tugmalarini
// to'smasin va telefonda bosh barmoq yetsin.

interface GamToastItem {
  id: number;
  text: string;
  error: boolean;
  undo: (() => Promise<void> | void) | null;
}

const UNDO_MS = 8000;
const PLAIN_MS = 4000;
const noop = () => () => {};
/** Brauzerda true (SSR da false) — portal faqat mijozda (ui/Modal dagi usul). */
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

export function useGamToast(): [ReactNode, (text: string, opts?: { error?: boolean; undo?: () => Promise<void> | void }) => void] {
  const { t } = useT();
  const [lang] = useLang();
  const mounted = useMounted();
  // «Ortga» lug'atda "Back" (navigatsiya) — bu yerda ma'nosi "bekor qilish".
  const undoLabel = lang === "en" ? "Undo" : t("Ortga");
  const [items, setItems] = useState<GamToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    const tm = timers.current.get(id);
    if (tm) clearTimeout(tm);
    timers.current.delete(id);
  }, []);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((tm) => clearTimeout(tm));
  }, []);

  const show = useCallback(
    (text: string, opts?: { error?: boolean; undo?: () => Promise<void> | void }) => {
      const id = ++seq.current;
      // Yangi «Ortga» eskisini almashtiradi — ikki xil amalning tugmalari chalkashmasin.
      setItems((xs) => [...xs.filter((x) => !(opts?.undo && x.undo)).slice(-2), { id, text, error: !!opts?.error, undo: opts?.undo ?? null }]);
      timers.current.set(id, setTimeout(() => dismiss(id), opts?.undo ? UNDO_MS : PLAIN_MS));
    },
    [dismiss],
  );

  // `body` ga portal: xabar profil oynasi (ui/Modal, z 100) USTIDA ham
  // ko'rinsin va oyna panelidagi transform uni siljitib yubormasin.
  const node = !mounted ? null : createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[300] flex flex-col items-center gap-2 px-4"
    >
      {items.map((x) => (
        <div
          key={x.id}
          role={x.error ? "alert" : "status"}
          className={`pointer-events-auto flex w-full max-w-[560px] items-center gap-3 rounded-xl border px-4 py-2.5 text-[13.5px] shadow-2xl ${
            x.error ? "border-rose-500/50" : "border-border"
          }`}
          style={{ backgroundColor: "hsl(var(--card))" }}
        >
          <span className={`min-w-0 flex-1 ${x.error ? "text-rose-600 dark:text-rose-300" : ""}`}>{x.text}</span>
          {x.undo && (
            <button
              type="button"
              className="gm-tap shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-primary hover:bg-primary/10"
              onClick={() => {
                const fn = x.undo;
                dismiss(x.id);
                void fn?.();
              }}
            >
              {undoLabel}
            </button>
          )}
          <button
            type="button"
            aria-label={t("Yopish")}
            className="gm-tap shrink-0 rounded-lg px-2 py-1 text-muted-foreground hover:bg-secondary"
            onClick={() => dismiss(x.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
  return [node, show];
}

type TFn = (k: string, p?: Record<string, string | number>) => string;

/**
 * Amaldan keyingi xabarga qo'shimcha: daraja ko'tarilishi (TZ 4.2.6) va
 * yangi nishonlar (TZ 4.19) — «amalni bajargan xodimga».
 */
export function rewardText(
  t: TFn,
  name: string,
  res: { levelUp?: { name: string } | null; badges?: { name: string }[] | null },
): string {
  const parts: string[] = [];
  if (res.levelUp) parts.push(t("🎉 {name} «{level}» darajasiga ko'tarildi!", { name, level: t(res.levelUp.name) }));
  for (const b of res.badges ?? []) parts.push(t("🏅 {name}: «{badge}» nishoni!", { name, badge: t(b.name) }));
  return parts.join(" · ");
}

/** Xabar + mukofot qo'shimchasi (bo'lsa). */
export function withReward(t: TFn, msg: string, name: string, res: Parameters<typeof rewardText>[2]): string {
  const extra = rewardText(t, name, res);
  return extra ? `${msg} · ${extra}` : msg;
}
