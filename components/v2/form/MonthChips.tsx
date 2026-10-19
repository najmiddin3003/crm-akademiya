"use client";

import { useRef, useState, type RefObject } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/components/shared/Language";
import FloatingPanel from "@/components/v2/ui/FloatingPanel";
import { Chip, fieldCls, type FieldState } from "./fields";

// YANGI VERSIYA: «QAYSI OY UCHUN» — chiplar (rasm «To'lov qabul qilish»:
// «✓ Oktabr · joriy», «Noyabr», «Dekabr», «Boshqa oy ⌄»). «Boshqa oy» — yil +
// 12 oy paneli. `MonthField` — o'sha panel oddiy maydon ko'rinishida (kirim
// qatorlaridagi «Oy»). Qiymat — "YYYY-MM".

export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  return monthKeyOf(new Date(y, m - 1 + delta, 1));
}

/** Yil + 12 oy paneli. Ochilganda yaratiladi — yil tanlangan oydan boshlanadi. */
function MonthGrid({
  anchorRef,
  value,
  currentKey,
  isDisabled,
  onPick,
  onClose,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  value: string;
  currentKey: string;
  isDisabled?: (key: string) => boolean;
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  const { t, months } = useT();
  const [year, setYear] = useState(() => Number(value.slice(0, 4)) || new Date().getFullYear());
  return (
    <FloatingPanel open anchorRef={anchorRef} onClose={onClose} width={272} role="dialog" ariaLabel={t("Oyni tanlang")}>
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            aria-label={t("Oldingi yil")}
            className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-hover hover:text-v2-text"
          >
            <ChevronLeft className="size-4" strokeWidth={1.75} />
          </button>
          <span className="text-v2-body font-semibold tabular-nums text-v2-text">{year}</span>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            aria-label={t("Keyingi yil")}
            className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-hover hover:text-v2-text"
          >
            <ChevronRight className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {months.map((name, i) => {
            const key = `${year}-${String(i + 1).padStart(2, "0")}`;
            const on = key === value;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                disabled={isDisabled?.(key) ?? false}
                onClick={() => onPick(key)}
                className={`h-9 truncate rounded-v2-md px-1 text-v2-small transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  on ? "bg-v2-brand font-semibold text-v2-on-brand" : key === currentKey ? "font-semibold text-v2-brand-text hover:bg-v2-hover" : "text-v2-text hover:bg-v2-hover"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
    </FloatingPanel>
  );
}

export default function MonthChips({
  value,
  onChange,
  keys,
  currentKey,
  isDisabled,
}: {
  value: string;
  onChange: (key: string) => void;
  /** Chip bo'lib turadigan oylar, tartibi bilan. */
  keys: string[];
  /** Joriy oy — yonida «· joriy». */
  currentKey: string;
  /** Tanlab bo'lmaydigan oy (masalan kelajak oy oyligi). */
  isDisabled?: (key: string) => boolean;
}) {
  const { t, months } = useT();
  const [open, setOpen] = useState(false);
  const otherRef = useRef<HTMLButtonElement>(null);
  const title = (key: string) => months[Number(key.slice(5, 7)) - 1] ?? key;
  const otherOn = !keys.includes(value);

  return (
    <div className="flex flex-wrap gap-2">
      {keys.map((key) => (
        <Chip key={key} on={value === key} onClick={() => onChange(key)} disabled={isDisabled?.(key)}>
          {title(key)}
          {key === currentKey && <span className="font-normal opacity-80">· {t("joriy")}</span>}
        </Chip>
      ))}
      <Chip ref={otherRef} on={otherOn} onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}>
        {otherOn ? `${title(value)} ${value.slice(0, 4)}` : t("Boshqa oy")}
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
      </Chip>
      {open && (
        <MonthGrid
          anchorRef={otherRef}
          value={value}
          currentKey={currentKey}
          isDisabled={isDisabled}
          onClose={() => setOpen(false)}
          onPick={(key) => {
            onChange(key);
            setOpen(false);
            otherRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

/** Oy maydoni — «📅 Oktabr 2026 ⌄» (kirim qatorlarida). */
export function MonthField({
  value,
  onChange,
  state = "default",
  ariaLabel,
}: {
  value: string;
  onChange: (key: string) => void;
  state?: FieldState;
  ariaLabel?: string;
}) {
  const { t, months } = useT();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const currentKey = monthKeyOf(new Date());
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ?? t("Oyni tanlang")}
        className={fieldCls(state, `flex items-center gap-2 text-left ${open ? "border-v2-brand shadow-v2-focus" : ""}`)}
      >
        <CalendarDays className="size-4 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />
        <span className="min-w-0 flex-1 truncate tabular-nums">
          {months[Number(value.slice(5, 7)) - 1] ?? value} {value.slice(0, 4)}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
      </button>
      {open && (
        <MonthGrid
          anchorRef={btnRef}
          value={value}
          currentKey={currentKey}
          onClose={() => setOpen(false)}
          onPick={(key) => {
            onChange(key);
            setOpen(false);
            btnRef.current?.focus();
          }}
        />
      )}
    </>
  );
}
