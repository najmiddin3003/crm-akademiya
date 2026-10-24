"use client";

import { useCallback } from "react";
import {
  Backpack,
  BadgePercent,
  BatteryMedium,
  BookOpen,
  Candy,
  Clapperboard,
  Coffee,
  Coins,
  Gamepad2,
  Gift,
  Headphones,
  Notebook,
  Pencil,
  Puzzle,
  Ruler,
  Shirt,
  Smartphone,
  Sparkles,
  Sticker,
  Ticket,
  Usb,
  Watch,
} from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { toUz } from "@/lib/uzTime";

// YANGI VERSIYA — GAMIFIKATSIYA BO'LAKLARI (11-qism: Reyting, Do'kon, Tanga qoidalari,
// 24.10.2026): sovg'a ikonkasi (rasmdagi chiziqli ikonkalar — nom bo'yicha), tanga
// qiymati, Toshkent vaqti, eski oynalar uchun toast moslagichi.

type IconKey =
  | "notebook"
  | "pen"
  | "shirt"
  | "cup"
  | "book"
  | "battery"
  | "bag"
  | "headphones"
  | "sticker"
  | "watch"
  | "usb"
  | "candy"
  | "film"
  | "ticket"
  | "game"
  | "puzzle"
  | "ruler"
  | "phone"
  | "percent"
  | "sparkles"
  | "gift";

/** Sovg'a nomi → chiziqli ikonka (rasm: bloknot, ruchka, sovg'a, futbolka, krujka, kitob, powerbank). */
const ICON_RULES: [RegExp, IconKey][] = [
  [/bloknot|daftar|notebook|planner/, "notebook"],
  [/ruchka|qalam|marker|pen\b/, "pen"],
  [/futbolka|mayka|t-?shirt|xudi|kiyim|kofta/, "shirt"],
  [/krujka|termos|stakan|chashka|kofe|choy|cup|mug/, "cup"],
  [/kitob|lug'at|lugat|book|ensiklopediya/, "book"],
  [/powerbank|power bank|quvvat|batareya|zaryad/, "battery"],
  [/ryukzak|sumka|bag|portfel/, "bag"],
  [/quloqchin|naushnik|headphone|airpods/, "headphones"],
  [/stiker|nakleyka|sticker/, "sticker"],
  [/soat|watch/, "watch"],
  [/fleshka|usb/, "usb"],
  [/shokolad|konfet|shirinlik|candy/, "candy"],
  [/kino|film|teatr/, "film"],
  [/chipta|bilet|ticket|ekskursiya|sayohat/, "ticket"],
  [/o'yin|oyin|game|playstation/, "game"],
  [/pazl|puzzle|kubik/, "puzzle"],
  [/chizg'ich|chizgich|lineyka|ruler/, "ruler"],
  [/telefon|g'ilof|chexol|phone/, "phone"],
];

export function giftIconKey(name: string, kind: string): IconKey {
  if (kind === "discount") return "percent";
  const s = name.toLowerCase().replace(/[ʻʼ`‘’]/g, "'");
  for (const [re, key] of ICON_RULES) if (re.test(s)) return key;
  return kind === "service" ? "sparkles" : "gift";
}

/** Sovg'aning chiziqli ikonkasi (nom bo'yicha). */
export function GiftIcon({ name, kind, className, strokeWidth = 1.75 }: { name: string; kind: string; className?: string; strokeWidth?: number }) {
  const p = { className, strokeWidth, "aria-hidden": true as const };
  switch (giftIconKey(name, kind)) {
    case "notebook":
      return <Notebook {...p} />;
    case "pen":
      return <Pencil {...p} />;
    case "shirt":
      return <Shirt {...p} />;
    case "cup":
      return <Coffee {...p} />;
    case "book":
      return <BookOpen {...p} />;
    case "battery":
      return <BatteryMedium {...p} />;
    case "bag":
      return <Backpack {...p} />;
    case "headphones":
      return <Headphones {...p} />;
    case "sticker":
      return <Sticker {...p} />;
    case "watch":
      return <Watch {...p} />;
    case "usb":
      return <Usb {...p} />;
    case "candy":
      return <Candy {...p} />;
    case "film":
      return <Clapperboard {...p} />;
    case "ticket":
      return <Ticket {...p} />;
    case "game":
      return <Gamepad2 {...p} />;
    case "puzzle":
      return <Puzzle {...p} />;
    case "ruler":
      return <Ruler {...p} />;
    case "phone":
      return <Smartphone {...p} />;
    case "percent":
      return <BadgePercent {...p} />;
    case "sparkles":
      return <Sparkles {...p} />;
    default:
      return <Gift {...p} />;
  }
}

/** Jadval qatoridagi kichik sovg'a belgisi (32 px): rasm bo'lsa — rasm, aks holda ikonka. */
export function GiftThumb({ name, kind, imageUrl, size = "sm" }: { name: string; kind: string; imageUrl?: string | null; size?: "sm" | "md" }) {
  const box = size === "md" ? "size-10" : "size-8";
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="" className={`${box} shrink-0 rounded-v2-md border border-v2-border object-cover`} />;
  }
  return (
    <span className={`inline-flex ${box} shrink-0 items-center justify-center rounded-v2-md bg-v2-brand-bg text-v2-brand-text`} aria-hidden>
      <GiftIcon name={name} kind={kind} className={size === "md" ? "size-5" : "size-4"} />
    </span>
  );
}

/** «🪙 25» — tanga ikonka + qalin son. */
export function CoinValue({ n, className = "" }: { n: number | string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <Coins className="size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
      <b className="font-semibold text-v2-text">{n}</b>
    </span>
  );
}

/** ISO vaqt (UTC) yoki "YYYY-MM-DD" → Toshkent kuni va soati ("" — noma'lum). */
export function uzParts(s: string | null | undefined): { iso: string; hm: string } {
  const v = String(s ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return { iso: v, hm: "" };
  const d = new Date(v);
  if (!v || Number.isNaN(d.getTime())) return { iso: "", hm: "" };
  const u = toUz(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return { iso: `${u.getFullYear()}-${p(u.getMonth() + 1)}-${p(u.getDate())}`, hm: `${p(u.getHours())}:${p(u.getMinutes())}` };
}

/** Eski gamifikatsiya oynalari (ProfileModal …) kutadigan toast — yangi versiya toastiga. */
export function useGamToastV2() {
  const { t, lang } = useT();
  const { showError, showToast } = useToast();
  // «Ortga» lug'atda "Back" (navigatsiya) — bu yerda ma'nosi «bekor qilish».
  const undoLabel = lang === "en" ? "Undo" : t("Ortga");
  return useCallback(
    (text: string, opts?: { error?: boolean; undo?: () => Promise<void> | void }) => {
      if (opts?.error) {
        showError(text);
        return;
      }
      const undo = opts?.undo;
      showToast({ tone: "success", title: text, action: undo ? { label: undoLabel, onClick: () => void undo() } : undefined });
    },
    [showError, showToast, undoLabel],
  );
}
