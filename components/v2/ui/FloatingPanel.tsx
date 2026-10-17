"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

// YANGI VERSIYA: OCHILADIGAN PANEL (tanlov ro'yxati, menyu, filtr oynasi).
//
// <body> GA PORTAL — jadval va karta `overflow: auto` ichida oddiy absolute
// panel kesilib qolardi (eski components/ui/Select.tsx izohi ham shu). Portal
// v2 qamrovidan (`[data-ui="v2"]`) TASHQARIDA, shuning uchun panelning o'zi
// `data-ui="v2"` oladi — aks holda --v2-* tokenlari bo'sh qolardi.
//
// Joylashuv: tugma ostida (joy yetmasa — ustida), chap yoki o'ng chetga
// tekislangan, ekrandan chiqmaydi; aylantirish/o'lcham o'zgarsa qayta
// hisoblanadi. Tashqariga bosish va Esc — yopadi (Esc modalga yetmaydi).
//
// ICHMA-ICH PANEL: «Yana filtrlar» oynasidagi tanlov ro'yxati ham shu panel —
// u ham <body> da, ya'ni tashqi oyna uchun «tashqarida». Shuning uchun ochiq
// panellar `stack` da ochilish tartibida turadi:
//   • o'zidan KEYIN ochilgan panel ichiga bosish yopmaydi (tashqi oyna
//     ro'yxatdan variant tanlanganda yopilib qolmasin), oldingisi ichiga
//     bosish esa yopadi (ro'yxat oynaning boshqa joyiga bosilganda yopilsin);
//   • Esc faqat ENG USTDAGI (oxirgi ochilgan) panelni yopadi.

export interface FloatingPanelProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  /** Tugmaning qaysi chetiga tekislanadi. */
  align?: "start" | "end";
  /** Eni: son (px) yoki "anchor" — tugma enidan kam emas. */
  width?: number | "anchor";
  /** Panelning eng katta balandligi (px) — joy hisobida ham shu. */
  maxHeight?: number;
  className?: string;
  role?: string;
  id?: string;
  ariaLabel?: string;
}

const GAP = 6;
const EDGE = 8;
/** Modal (100) va drawer (1001) ustida — eski Select bilan bir xil. */
const Z = 1200;

/** Ochiq panellar, ochilish tartibida (yuqoridagi izoh). */
const stack: { el: () => HTMLElement | null }[] = [];

export default function FloatingPanel({
  open,
  anchorRef,
  onClose,
  children,
  align = "start",
  width = "anchor",
  maxHeight = 360,
  className = "",
  role,
  id,
  ariaLabel,
}: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ position: "fixed", visibility: "hidden" });

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const a = anchorRef.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.min(width === "anchor" ? Math.max(r.width, 200) : width, vw - EDGE * 2);
      const left = align === "end" ? r.right - w : r.left;
      const below = vh - r.bottom - GAP - EDGE;
      const above = r.top - GAP - EDGE;
      const up = below < Math.min(maxHeight, 240) && above > below;
      const room = Math.max(120, Math.min(maxHeight, up ? above : below));
      setStyle({
        position: "fixed",
        left: Math.min(Math.max(EDGE, left), vw - w - EDGE),
        width: w,
        maxHeight: room,
        zIndex: Z,
        ...(up ? { bottom: vh - r.top + GAP } : { top: r.bottom + GAP }),
      });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchorRef, align, width, maxHeight]);

  useEffect(() => {
    if (!open) return;
    const me = { el: () => panelRef.current };
    stack.push(me);
    function onDown(e: MouseEvent) {
      const tv = e.target as Node;
      if (panelRef.current?.contains(tv) || anchorRef.current?.contains(tv)) return;
      // Mendan keyin ochilgan (ichma-ich) panel ichiga bosildi — tashqari emas.
      if (stack.slice(stack.indexOf(me) + 1).some((s) => s.el()?.contains(tv))) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || stack[stack.length - 1] !== me) return;
      e.stopPropagation();
      onClose();
      anchorRef.current?.focus();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      const i = stack.indexOf(me);
      if (i >= 0) stack.splice(i, 1);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panelRef}
      data-ui="v2"
      role={role}
      id={id}
      aria-label={ariaLabel}
      style={style}
      className={`ui-pop-in flex flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface font-v2 text-v2-text shadow-v2-md ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
