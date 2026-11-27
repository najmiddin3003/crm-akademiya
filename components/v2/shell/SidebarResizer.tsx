"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { useT } from "@/components/shared/Language";
import {
  clampSidebarWidth,
  saveSidebarWidth,
  sidebarZoom,
  SIDEBAR_W_DEFAULT,
  SIDEBAR_W_MAX,
  SIDEBAR_W_MIN,
} from "@/lib/sidebarWidth";

// Yon menyu enini o'zgartirish tutqichi (lib/sidebarWidth.ts izohi) — menyuning
// o'ng chegarasi ustida 12px lik ko'rinmas tasma, ustiga kelganda chiziq yonadi.
// Surish paytida React qayta chizmaydi: en va `--sb-zoom` to'g'ridan-to'g'ri
// aside'ga yoziladi, qo'yib yuborilganda holatga va cookie'ga saqlanadi.
// Klaviatura: ← → (Shift bilan katta qadam), Home/End — eng tor/keng, Enter — asl en.

/** Aside uchun boshlang'ich uslub: en + ichki masshtab (SidebarV2 → `zoom: var(--sb-zoom)`). */
export function sidebarStyle(w: number): CSSProperties {
  return { width: w, ["--sb-zoom" as string]: sidebarZoom(w) } as CSSProperties;
}

function applyWidth(el: HTMLElement | null, w: number) {
  if (!el) return;
  el.style.width = `${w}px`;
  el.style.setProperty("--sb-zoom", String(sidebarZoom(w)));
}

/** Surish davomida butun sahifada «⇔» kursor va matn belgilanmasin (sichqoncha tasmadan chiqsa ham). */
function setDragCursor(on: boolean) {
  const s = document.documentElement.style;
  s.cursor = on ? "col-resize" : "";
  s.userSelect = on ? "none" : "";
}

export default function SidebarResizer({
  asideRef,
  width,
  onChange,
}: {
  asideRef: RefObject<HTMLElement | null>;
  width: number;
  onChange: (w: number) => void;
}) {
  const { t } = useT();
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startX: number; startW: number; w: number } | null>(null);

  // Surish o'rtasida komponent yo'qolsa (menyu yig'ilsa) kursor qotib qolmasin.
  useEffect(() => () => setDragCursor(false), []);

  const commit = (w: number) => {
    const v = clampSidebarWidth(w);
    applyWidth(asideRef.current, v);
    onChange(v);
    saveSidebarWidth(v);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startW: width, w: width };
    setDragging(true);
    setDragCursor(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.w = clampSidebarWidth(d.startW + e.clientX - d.startX);
    applyWidth(asideRef.current, d.w);
  };

  const end = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    setDragCursor(false);
    if (d.w !== width) commit(d.w);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 32 : 8;
    const next =
      e.key === "ArrowLeft" ? width - step
      : e.key === "ArrowRight" ? width + step
      : e.key === "Home" ? SIDEBAR_W_MIN
      : e.key === "End" ? SIDEBAR_W_MAX
      : e.key === "Enter" ? SIDEBAR_W_DEFAULT
      : null;
    if (next == null) return;
    e.preventDefault();
    commit(next);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t("Menyu enini o'zgartirish")}
      aria-valuemin={SIDEBAR_W_MIN}
      aria-valuemax={SIDEBAR_W_MAX}
      aria-valuenow={width}
      tabIndex={0}
      title={t("Suring — menyu eni o'zgaradi. Ikki marta bosing — asl holiga")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onDoubleClick={() => commit(SIDEBAR_W_DEFAULT)}
      onKeyDown={onKeyDown}
      className="group absolute inset-y-0 -right-1.5 z-20 w-3 cursor-col-resize touch-none select-none outline-none"
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors ${
          dragging ? "bg-v2-brand" : "bg-transparent group-hover:bg-v2-brand/50 group-focus-visible:bg-v2-brand"
        }`}
      />
    </div>
  );
}
