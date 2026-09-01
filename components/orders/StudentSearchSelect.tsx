"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CONTROL_CLS, ROW_CLS_TIGHT, RowChevron, RowLabel } from "@/components/orders/FormRow";

export interface StudentSearchSelectProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  /** Ro'yxat ichidagi qidiruv maydonining matni. Berilmasa `placeholder`
   * ishlatiladi (o'quvchi tanlashda ikkalasi ham "O'quvchini qidirish"). */
  searchPlaceholder?: string;
  error?: boolean;
  /** "boxed" (default) = AddOrderModal drawer style (stacked label + bordered
   * field). "row" = the compact /orders-list/add page style (inline label
   * left, value+chevron right, bottom border only). "compact" = boxed'ning
   * pastroq (h-9) varianti — Topshiriq oynasidagi maydonlarga mos. */
  variant?: "boxed" | "row" | "compact";
  /** Ro'yxatdagi qatorga qo'shimcha satr (masalan telefon / lavozim). */
  subtitleOf?: (name: string) => ReactNode;
  /** Qatorning o'ng chekkasi (masalan balans / oylik). */
  trailingOf?: (name: string) => ReactNode;
  /**
   * Tanlab bo'lmaydigan variantlar (masalan boshqa kassaga allaqachon
   * biriktirilgan moderator). Ro'yxatda hira ko'rinadi, kursor "no-drop"
   * bo'ladi va bosilmaydi — yashirib qo'ymaymiz, chunki nega yo'qligini
   * tushunish qiyin bo'lardi.
   */
  disabledOptions?: string[];
  /** Hira variant ustida ko'rinadigan izoh (title). */
  disabledHint?: string;
  /**
   * Bir vaqtda ko'rsatiladigan maksimal qator. Ro'yxat uzun bo'lsa (masalan
   * tizimdagi barcha odamlar) hammasini DOM'ga chizish shart emas — qolganini
   * qidiruv orqali topiladi.
   *
   * STANDART 50. Ilgari standart qiymat "cheklovsiz" edi va 19 ta
   * chaqiruvchidan faqat BITTASI limit berardi — qolgan hammasi 6 732
   * o'quvchini bitta renderda DOM'ga chizardi: har qator ~7 element, ya'ni
   * ~67 000 tugun, va qidiruv oynasidagi HAR BOSISHDA qaytadan. Ro'yxat 50
   * dan uzun bo'lsa pastda "Yana N ta — qidiruvdan foydalaning" chiqadi,
   * qidiruv esa BUTUN ro'yxat bo'yicha ketadi, ya'ni yozuv "yo'qolmaydi".
   */
  limit?: number;
}

export default function StudentSearchSelect({
  label,
  required,
  value,
  onChange,
  options,
  placeholder = "O'quvchini qidirish",
  searchPlaceholder,
  error,
  variant = "boxed",
  subtitleOf,
  trailingOf,
  disabledOptions,
  disabledHint,
  limit = 50,
}: StudentSearchSelectProps) {
  const isDisabled = (name: string) => Boolean(disabledOptions?.includes(name));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  // Qidiruv nom bo'yicha ham, qatorning kichik satri bo'yicha ham ishlaydi
  // (u yerda odatda TELEFON raqam turadi). Raqam kiritilsa faqat raqamlar
  // solishtiriladi — "+998 90 469 51 20" ni "904695120" deb ham topsa bo'ladi.
  //
  // Qidiruv BUTUN ro'yxat bo'yicha ketadi; `limit` faqat ekranga chiziladigan
  // qatorlarga tegishli, shu bois qidirilgan yozuv doim topiladi.
  const haystackOf = (name: string): string => {
    const sub = subtitleOf?.(name);
    return typeof sub === "string" || typeof sub === "number" ? `${name} ${sub}` : name;
  };
  const q = query.trim().toLowerCase();
  const qDigits = query.replace(/\D/g, "");
  // Ro'yxat YOPIQ bo'lsa filtrlash umuman bajarilmaydi. Ilgari u render
  // tanasida shartsiz turardi, ya'ni ota drawer'dagi har qanday o'zgarish
  // (summa yozish, sana tanlash) 6 732 ta variantni qaytadan skanerlardi.
  const filtered = useMemo(() => {
    if (!open) return [];
    return options.filter((o) => {
      if (!q) return true;
      const hay = haystackOf(o);
      if (hay.toLowerCase().includes(q)) return true;
      return qDigits.length >= 3 && hay.replace(/\D/g, "").includes(qDigits);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options, q, qDigits, subtitleOf]);
  const shown = limit && filtered.length > limit ? filtered.slice(0, limit) : filtered;
  const hidden = filtered.length - shown.length;

  const dropdown = open && (
    <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-card shadow-xl overflow-hidden">
      <div className="relative border-b border-border">
        <svg className="icon icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          <use href="#i-search" />
        </svg>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder ?? placeholder}
          className="w-full h-9 pl-9 pr-3 text-sm bg-transparent focus:outline-none"
        />
      </div>
      <div className="max-h-56 overflow-y-auto">
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setQuery("");
              setOpen(false);
            }}
            className="block w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary"
          >
            Tozalash
          </button>
        )}
        {filtered.length === 0 ? (
          <div className="px-3 py-3 text-sm text-muted-foreground">Topilmadi</div>
        ) : (
          shown.map((name, i) => (
            <button
              key={`${name}-${i}`}
              type="button"
              disabled={isDisabled(name)}
              title={isDisabled(name) ? disabledHint : undefined}
              style={isDisabled(name) ? { cursor: "no-drop" } : undefined}
              onClick={() => {
                if (isDisabled(name)) return;
                onChange(name);
                setQuery("");
                setOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-sm ${
                isDisabled(name)
                  ? "opacity-40"
                  : `hover:bg-secondary ${value === name ? "bg-primary/10 font-medium text-primary" : ""}`
              }`}
            >
              {subtitleOf || trailingOf ? (
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{name}</span>
                    {subtitleOf && (
                      <span className="block text-[11.5px] text-muted-foreground truncate">{subtitleOf(name)}</span>
                    )}
                  </span>
                  {trailingOf && <span className="shrink-0 text-[12px] tabular-nums">{trailingOf(name)}</span>}
                </span>
              ) : (
                name
              )}
            </button>
          ))
        )}
        {hidden > 0 && (
          <div className="border-t border-border px-3 py-2 text-[11.5px] text-muted-foreground">
            Yana {hidden} ta — qidiruvdan foydalaning
          </div>
        )}
      </div>
    </div>
  );

  if (variant === "row") {
    // /orders-list/add sahifasidagi qator — o'lchamlari FormRow bilan bir xil
    // (referens: akademiya.edutizim.uz/orders/add).
    return (
      <div ref={ref} className={ROW_CLS_TIGHT}>
        <RowLabel label={label} required={required} />
        <div className={CONTROL_CLS}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            style={{ paddingLeft: 11, paddingRight: 29 }}
            className={`block h-8 w-full rounded-md border-0 bg-secondary text-left text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${error ? "ring-2 ring-red-400" : ""}`}
          >
            <span className={`block truncate ${value ? "" : "text-muted-foreground"}`}>{value || placeholder}</span>
          </button>
          <RowChevron />
          {dropdown}
        </div>
      </div>
    );
  }

  const compact = variant === "compact";
  return (
    <div ref={ref} className="relative">
      {/* Yorliq BO'SH bo'lsa element umuman chizilmaydi.
          Ilgari u har doim chizilardi: matni yo'q `<label>` ichida qator
          qutisi hosil bo'lmaydi, ya'ni balandligi 0 — LEKIN `mb-1` (4px)
          o'z joyida qolardi. Natijada filtrlar qatorida bu tanlov yonidagi
          `h-9` selectlardan aynan 4px pastda turardi. */}
      {label && (
        <label className={compact ? "text-xs font-medium text-muted-foreground mb-1 block" : "block text-[13px] font-medium mb-1.5"}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full px-3 rounded-lg border text-sm flex items-center justify-between text-left focus:outline-none focus:ring-2 ${compact ? "h-9 bg-background focus:ring-blue-500" : "h-11 bg-secondary/30 focus:ring-primary/40"} ${error ? "border-red-400 ring-2 ring-red-400" : "border-border"}`}
      >
        <span className={value ? "" : "text-muted-foreground"}>{value || placeholder}</span>
        <svg className="icon icon-sm text-muted-foreground shrink-0">
          <use href="#i-chevron-down" />
        </svg>
      </button>
      {dropdown}
    </div>
  );
}
