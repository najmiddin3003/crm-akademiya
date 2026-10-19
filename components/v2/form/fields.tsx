"use client";

import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { AlertCircle, AlertTriangle, Check } from "lucide-react";
import MoneyInput from "@/components/ui/MoneyInput";
import { useT } from "@/components/shared/Language";

// YANGI VERSIYA: FORMA MAYDONLARI (rasmlar «Formalar — qoidalar», «To'lov qabul
// qilish», «Kassa amali», «Yangi o'quvchi», 19.10.2026).
//
//   • yorliq maydon TEPASIDA (`small`, o'rtacha qalin); majburiy bo'lmagani —
//     «(ixtiyoriy)» (`text-3`);
//   • maydon h-10, chegara `border-field`, fokusda brend chegara + halqa;
//   • XATO — saqlatmaydi: qizil chegara + ostida ikonka bilan xabar; maydondan
//     chiqqanda ko'rsatiladi (yozib turganda emas) — qachon ko'rsatish chaqiruvchida;
//   • OGOHLANTIRISH — to'xtatmaydi: sariq chegara + ostida sariq blok;
//   • pul summasi katta shriftda, «so'm» bilan, raqamlar 3 xonadan bo'linadi.

export type FieldState = "default" | "error" | "warning";

/** Maydon klasslari (input, tanlov tugmasi). */
export function fieldCls(state: FieldState = "default", extra = ""): string {
  const border =
    state === "error"
      ? "border-v2-danger focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--v2-danger)_18%,transparent)]"
      : state === "warning"
        ? "border-v2-warning focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--v2-warning)_18%,transparent)]"
        : "border-v2-border-field focus:border-v2-brand focus:shadow-v2-focus";
  return `h-10 w-full rounded-v2-md border bg-v2-surface! px-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:outline-none disabled:cursor-not-allowed disabled:bg-v2-surface-2! disabled:text-v2-text-3 ${border} ${extra}`;
}

export function FieldLabel({ children, optional, htmlFor, className = "" }: { children: ReactNode; optional?: boolean; htmlFor?: string; className?: string }) {
  const { t } = useT();
  return (
    <label htmlFor={htmlFor} className={`mb-1.5 block text-v2-small font-medium text-v2-text ${className}`}>
      {children}
      {optional && <span className="font-normal text-v2-text-3"> ({t("ixtiyoriy")})</span>}
    </label>
  );
}

/** Xato xabari — maydon ostida, ikonka bilan. */
export function FieldError({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-v2-caption font-normal text-v2-danger">
      <AlertCircle className="mt-px size-3.5 shrink-0" strokeWidth={2} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** Ogohlantirish — saqlashni to'xtatmaydi (masalan takroriy telefon). */
export function FieldWarning({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1.5 flex items-start gap-2 rounded-v2-md bg-v2-warning-bg px-3 py-2 text-v2-caption font-normal text-v2-text">
      <AlertTriangle className="mt-px size-3.5 shrink-0 text-v2-warning" strokeWidth={2} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-v2-caption font-normal text-v2-text-3">{children}</p>;
}

/** Yorliq + maydon + (xato | ogohlantirish | izoh). */
export function Field({
  label,
  optional,
  htmlFor,
  error,
  warning,
  hint,
  className = "",
  children,
}: {
  label?: ReactNode;
  optional?: boolean;
  htmlFor?: string;
  error?: ReactNode;
  warning?: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      {label && (
        <FieldLabel optional={optional} htmlFor={htmlFor}>
          {label}
        </FieldLabel>
      )}
      {children}
      {error ? <FieldError>{error}</FieldError> : warning ? <FieldWarning>{warning}</FieldWarning> : hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}

/** Bo'lim sarlavhasi («Shaxsiy ma'lumotlar», «O'qish»). */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="mb-3 text-v2-caption text-v2-text-3">{children}</div>;
}

export function TextInput({ state = "default", className = "", ref, ...rest }: InputHTMLAttributes<HTMLInputElement> & { state?: FieldState; ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} {...rest} className={fieldCls(state, className)} />;
}

/**
 * Pul summasi — katta shrift, o'ngda «so'm». Qiymat — faqat raqamlar satri
 * (ui/MoneyInput bilan bir xil: kursor 3 xonali bo'linishda joyida qoladi).
 */
export function MoneyField({
  value,
  onChange,
  state = "default",
  id,
  placeholder = "0",
  onBlur,
  disabled,
  autoFocus,
  readOnly,
  compact = false,
  ariaLabel,
}: {
  value: string;
  onChange: (digits: string) => void;
  state?: FieldState;
  id?: string;
  placeholder?: string;
  onBlur?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  readOnly?: boolean;
  /** Oddiy balandlik (qatorlarda) — katta shriftsiz. */
  compact?: boolean;
  ariaLabel?: string;
}) {
  const { t } = useT();
  return (
    <div className="relative">
      <MoneyInput
        id={id}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        readOnly={readOnly}
        autoFocus={autoFocus}
        data-autofocus={autoFocus ? "" : undefined}
        aria-label={ariaLabel}
        inputMode="numeric"
        placeholder={placeholder}
        className={fieldCls(state, `${compact ? "pr-12 font-medium" : "h-12 pr-14 text-[20px] font-semibold"} tabular-nums ${readOnly ? "bg-v2-surface-2!" : ""}`)}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-v2-small text-v2-text-3">{t("so'm")}</span>
    </div>
  );
}

/** "931915358" → "93 191 53 58" */
export function formatLocalPhone(digits: string): string {
  const d = digits.slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
}

/** Telefon: chapda «+998» bo'lagi, o'ngda 9 raqam («93 191 53 58»). */
export function PhoneField({
  value,
  onChange,
  onBlur,
  state = "default",
  id,
}: {
  value: string;
  onChange: (digits: string) => void;
  onBlur?: () => void;
  state?: FieldState;
  id?: string;
}) {
  const ring =
    state === "error"
      ? "border-v2-danger focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--v2-danger)_18%,transparent)]"
      : state === "warning"
        ? "border-v2-warning focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--v2-warning)_18%,transparent)]"
        : "border-v2-border-field focus-within:border-v2-brand focus-within:shadow-v2-focus";
  return (
    <div className={`flex h-10 overflow-hidden rounded-v2-md border bg-v2-surface transition-[border-color,box-shadow] ${ring}`}>
      <span className="flex shrink-0 items-center border-r border-v2-border bg-v2-surface-2 px-3 text-v2-body tabular-nums text-v2-text-2">+998</span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        value={formatLocalPhone(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 9))}
        onBlur={onBlur}
        placeholder="94 408 57 97"
        className="min-w-0 flex-1 bg-transparent! px-3 text-v2-body tabular-nums text-v2-text placeholder:text-v2-text-3 focus:outline-none"
      />
    </div>
  );
}

export interface SegmentOption {
  value: string;
  label: string;
  /** Rangli nuqta klassi (masalan `bg-v2-success`). */
  dot?: string;
  icon?: ReactNode;
  disabled?: boolean;
  title?: string;
}

/**
 * Segment (to'lov turi, «Kirim / Chiqim / Ko'chirish»): konteyner `surface-2`,
 * faol bo'lak oq + chegara + `shadow-v2-sm`. Klaviatura: ← → (radiogroup).
 */
export function Segmented({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: string;
  onChange: (v: string) => void;
  options: SegmentOption[];
  label: string;
  size?: "md" | "lg";
}) {
  const name = useId();
  const h = size === "lg" ? "h-10" : "h-9";
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-v2-md border border-v2-border bg-v2-surface-2 p-1">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value || name + i}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            title={o.title}
            tabIndex={on || (!value && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const enabled = options.filter((x) => !x.disabled);
              const idx = enabled.findIndex((x) => x.value === value);
              const next = enabled[(idx + (e.key === "ArrowRight" ? 1 : enabled.length - 1)) % enabled.length];
              if (next) onChange(next.value);
            }}
            className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[6px] px-1.5 text-v2-small sm:gap-2 sm:px-2 transition-colors focus-visible:shadow-v2-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${h} ${
              on ? "border border-v2-border bg-v2-surface font-semibold text-v2-text shadow-v2-sm" : "border border-transparent text-v2-text-2 hover:text-v2-text"
            }`}
          >
            {o.icon}
            {o.dot && <span className={`size-2 shrink-0 rounded-full ${o.dot}`} aria-hidden />}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Chip — oy, kategoriya: tanlangani brend fon + chegara + ✓. */
export function Chip({
  on,
  onClick,
  children,
  title,
  ref,
  ...rest
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
  ref?: Ref<HTMLButtonElement>;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children" | "type" | "className">) {
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={on}
      title={title}
      onClick={onClick}
      {...rest}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-v2-full border px-3 text-v2-small transition-colors focus-visible:shadow-v2-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? "border-v2-brand bg-v2-brand-bg font-semibold text-v2-brand-text" : "border-v2-border-strong bg-v2-surface text-v2-text hover:bg-v2-surface-2"
      }`}
    >
      {on && <Check className="size-3.5" strokeWidth={2.25} aria-hidden />}
      {children}
    </button>
  );
}

/** To'lov turi kaliti → nuqta rangi (rasmdagidek: naqd yashil, plastik binafsha, terminal ko'k, inkassa sariq). */
export function methodDot(key: string): string {
  const k = key.toLowerCase();
  if (k === "naqd" || k.startsWith("naqd")) return "bg-v2-success";
  if (k === "plastik" || k.includes("karta")) return "bg-v2-violet";
  if (k.includes("terminal")) return "bg-v2-info";
  if (k.includes("inkass")) return "bg-v2-warning";
  return "bg-v2-brand";
}
