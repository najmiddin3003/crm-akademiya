"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Columns3, GripVertical, Lock } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { panelTriggerCls } from "./buttons";
import type { ColumnDef, ColumnPrefs, RowDensity } from "./columnPrefs";
import FloatingPanel from "./FloatingPanel";
import V2Checkbox from "./V2Checkbox";

// YANGI VERSIYA: «USTUNLAR» TUGMASI VA OYNASI (design/v2/DESIGN.md → «Ustunlar
// oynasi»; rasm «Guruhlar · Ustunlar», 18.10.2026). Har ro'yxat sahifasida bir
// xil: tepada «Ustunlar» + «Standartga qaytarish»; «Ko'rinib turadi · N» —
// qulflangan ustun (qulf + «doim»), qolganlari surib tartiblanadi (⠿) va
// katakcha bilan yashiriladi; «Yashirilgan · N» — katakcha bilan qaytariladi;
// pastda «Qator zichligi»: Ixcham / Keng. Holat — ./columnPrefs.ts.
//
// SURISH: ⠿ ni bosib torting (sichqoncha yoki barmoq) — ustun boshqalarning
// o'rtasidan o'tganda joyi almashadi, jadval ham shu zahoti yangilanadi.
// Klaviaturada: ⠿ ga fokus qilib ↑ / ↓.

const ROW = "mx-2 flex items-center gap-2.5 rounded-v2-md px-2";

function ColumnsPanel<C extends ColumnDef>({ prefs }: { prefs: ColumnPrefs<C> }) {
  const { t } = useT();
  const listRef = useRef<HTMLDivElement>(null);
  const [dragKey, setDragKey] = useState<C["key"] | null>(null);
  // Qo'yib yuborilgandan keyingi «click» — bosilgan va qo'yilgan joyning umumiy
  // ajdodiga (qatorning o'ziga) tushadi va katakchani almashtirib, ustunni
  // yashirib qo'yardi (sinovda topildi). Surishdan keyingi bitta bosish yutiladi.
  const swallowClick = useRef(false);
  const visibleCount = prefs.locked.length + prefs.shown.length;

  function focusHandle(key: C["key"]) {
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-handle="${key}"]`)?.focus());
  }

  function startDrag(e: ReactPointerEvent<HTMLButtonElement>, key: C["key"]) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.focus();
    setDragKey(key);
    const onMove = (ev: PointerEvent) => {
      const items = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-col]") ?? [])];
      // Ko'chirilayotgandan boshqa bandlar ichida o'rtasi kursordan yuqorida
      // qolganlari soni — yangi o'rin (prefs.move ham shunday sanaydi).
      const index = items.filter((el) => {
        if (el.dataset.col === key) return false;
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2 < ev.clientY;
      }).length;
      prefs.move(key, index);
    };
    const onEnd = () => {
      setDragKey(null);
      swallowClick.current = true;
      // «click» kelmasa (masalan ko'rsatkich oynadan chiqib qo'yilsa) — keyingi oddiy bosish yutilmasin.
      setTimeout(() => {
        swallowClick.current = false;
      }, 0);
      document.body.style.removeProperty("cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
    // Kursor tutqichdan chiqib ketsa ham «ushlab turgan qo'l» qolsin.
    document.body.style.setProperty("cursor", "grabbing");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  }

  function onHandleKey(e: KeyboardEvent<HTMLButtonElement>, key: C["key"], index: number) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    prefs.move(key, index + (e.key === "ArrowUp" ? -1 : 1));
    focusHandle(key);
  }

  const densityBtn = (d: RowDensity, label: string) => {
    const on = prefs.density === d;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => prefs.setDensity(d)}
        className={`h-7 rounded-[6px] px-3 text-v2-small transition-colors ${
          on ? "bg-v2-surface font-semibold text-v2-text shadow-v2-sm ring-1 ring-v2-border" : "text-v2-text-2 hover:text-v2-text"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-1 pt-3">
        <h3 className="text-v2-body font-semibold text-v2-text">{t("Ustunlar")}</h3>
        <button type="button" onClick={prefs.reset} className="rounded-v2-sm text-v2-small font-semibold text-v2-brand-text underline-offset-2 hover:underline">
          {t("Standartga qaytarish")}
        </button>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto pb-1 ${dragKey ? "select-none" : ""}`}>
        <div className="px-4 pb-1 pt-2 text-v2-caption text-v2-text-3">
          {t("Ko'rinib turadi")} · {visibleCount}
        </div>
        {prefs.locked.map((c) => (
          <div key={c.key} className={`${ROW} h-[34px]`}>
            <Lock className="size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-v2-body font-semibold text-v2-text">{t(c.label)}</span>
            <span className="shrink-0 text-v2-caption text-v2-text-3">{t("doim")}</span>
          </div>
        ))}
        <div ref={listRef}>
          {prefs.shown.map((c, i) => {
            const dragging = dragKey === c.key;
            // <label> EMAS: ichida ikkita «yorliqlanadigan» element (⠿ tugmasi va
            // katakcha) — label birinchisiga, ya'ni tugmaga bog'lanib qolardi.
            // Qator bosilsa katakcha almashadi; ⠿ va katakchaning o'z ishi bor.
            return (
              <div
                key={c.key}
                data-col={c.key}
                onClick={(e) => {
                  if (swallowClick.current) {
                    swallowClick.current = false;
                    return;
                  }
                  if (!(e.target as HTMLElement).closest("button, input")) prefs.toggle(c.key);
                }}
                className={`${ROW} h-[34px] cursor-pointer ${dragging ? "relative z-10 bg-v2-surface shadow-v2-md ring-1 ring-v2-border-strong" : "hover:bg-v2-hover"}`}
              >
                <button
                  type="button"
                  data-handle={c.key}
                  onPointerDown={(e) => startDrag(e, c.key)}
                  onKeyDown={(e) => onHandleKey(e, c.key, i)}
                  title={t("Surib tartiblang (↑ ↓)")}
                  aria-label={t("{col} — o'rnini o'zgartirish", { col: t(c.label) })}
                  className={`-ml-1 inline-flex size-5 shrink-0 touch-none items-center justify-center rounded-v2-sm text-v2-text-3 hover:text-v2-text-2 focus-visible:outline-none focus-visible:shadow-v2-focus ${
                    dragging ? "cursor-grabbing" : "cursor-grab"
                  }`}
                >
                  <GripVertical className="size-3.5" strokeWidth={1.75} aria-hidden />
                </button>
                <span className="min-w-0 flex-1 truncate text-v2-body text-v2-text">{t(c.label)}</span>
                <V2Checkbox checked onChange={() => prefs.toggle(c.key)} label={t("{col} — yashirish", { col: t(c.label) })} />
              </div>
            );
          })}
        </div>

        {prefs.hidden.length > 0 && (
          <>
            <div className="mx-4 my-1.5 h-px bg-v2-border" role="separator" />
            <div className="px-4 pb-1 pt-1 text-v2-caption text-v2-text-3">
              {t("Yashirilgan")} · {prefs.hidden.length}
            </div>
            {prefs.hidden.map((c) => (
              <label key={c.key} className={`${ROW} h-8 cursor-pointer hover:bg-v2-hover`}>
                <span className="-ml-1 size-5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-v2-body text-v2-text-2">{t(c.label)}</span>
                <V2Checkbox checked={false} onChange={() => prefs.toggle(c.key)} label={t("{col} — ko'rsatish", { col: t(c.label) })} />
              </label>
            ))}
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-v2-border px-4 py-2.5">
        <span className="text-v2-small text-v2-text-2">{t("Qator zichligi")}</span>
        <div role="radiogroup" aria-label={t("Qator zichligi")} className="inline-flex items-center gap-0.5 rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
          {densityBtn("compact", t("Ixcham"))}
          {densityBtn("wide", t("Keng"))}
        </div>
      </div>
    </>
  );
}

/** «Ustunlar» tugmasi + oyna. `prefs` — `useColumnPrefs(...)` natijasi. */
export default function ColumnsControl<C extends ColumnDef>({ prefs }: { prefs: ColumnPrefs<C> }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={btnRef} type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} className={panelTriggerCls(open)}>
        <Columns3 className="size-4" strokeWidth={1.75} aria-hidden />
        {t("Ustunlar")}
      </button>
      <FloatingPanel open={open} anchorRef={btnRef} onClose={() => setOpen(false)} align="end" width={296} maxHeight={640} role="dialog" ariaLabel={t("Ustunlar")}>
        <ColumnsPanel prefs={prefs} />
      </FloatingPanel>
    </>
  );
}
