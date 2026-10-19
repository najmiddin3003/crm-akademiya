"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Loader2, Search } from "lucide-react";
import { useT } from "@/components/shared/Language";
import FloatingPanel from "@/components/v2/ui/FloatingPanel";
import type { StudentRow } from "@/lib/studentsData";
import { fieldCls } from "./fields";

// YANGI VERSIYA: O'QUVCHINI QIDIRISH (forma maydoni) — ism yoki telefon bo'yicha,
// SERVERDA (/api/search/students — navbardagi qidiruv; filial qamrovi o'sha
// yerda). Butun ro'yxat (6 700+ o'quvchi) brauzerga tashilmaydi.
//
// Klaviatura: ↑↓ yurish, Enter tanlash (forma saqlanmaydi — `data-enter-ignore`),
// Esc ro'yxatni yopadi.

function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return p.slice(0, 2).map((x) => x.charAt(0).toUpperCase()).join("") || "?";
}

/** 9 raqam → «93 657 37 00»; boshqasi — o'zicha. */
export function studentPhoneLabel(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  const local = d.length === 12 && d.startsWith("998") ? d.slice(3) : d;
  if (local.length !== 9) return raw || "";
  return `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
}

export default function StudentSearchField({
  onPick,
  invalid = false,
  autoFocus = false,
  placeholder,
  trailing,
  footer,
}: {
  onPick: (s: StudentRow) => void;
  invalid?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  /** Qator o'ngidagi izoh (masalan balans). */
  trailing?: (s: StudentRow) => ReactNode;
  /** Ro'yxat ostidagi qator (masalan «Yangi o'quvchi qo'shish»). */
  footer?: ReactNode;
}) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ q: string; items: StudentRow[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const query = q.trim();

  useEffect(() => {
    if (query.length < 2) return;
    let alive = true;
    const id = window.setTimeout(() => {
      fetch(`/api/search/students?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          setResult({ q: query, items: d?.ok ? (d.students as StudentRow[]) : [] });
          setActive(0);
        })
        .catch(() => {
          if (alive) setResult({ q: query, items: [] });
        });
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [query]);

  const ready = query.length >= 2 && result?.q === query;
  const busy = query.length >= 2 && !ready;
  const shown = ready ? result!.items : [];

  const pick = (s: StudentRow) => {
    setOpen(false);
    onPick(s);
  };

  return (
    <div data-enter-ignore="">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
        <input
          ref={inputRef}
          data-autofocus={autoFocus ? "" : undefined}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(e.target.value.trim().length >= 2);
          }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onKeyDown={(e) => {
            if (!open || shown.length === 0) return;
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a + (e.key === "ArrowDown" ? 1 : shown.length - 1)) % shown.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              const s = shown[active];
              if (s) pick(s);
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={t("O'quvchi")}
          placeholder={placeholder ?? t("Ism yoki telefon bo'yicha qidiring…")}
          className={fieldCls(invalid ? "error" : "default", "pl-9")}
        />
        {busy && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-v2-text-3" strokeWidth={2} aria-hidden />}
      </div>
      <FloatingPanel open={open && query.length >= 2} anchorRef={inputRef} onClose={() => setOpen(false)} maxHeight={320} role="listbox" id={listId} ariaLabel={t("O'quvchi")}>
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {busy && <div className="px-3 py-5 text-center text-v2-small text-v2-text-3">{t("Qidirilmoqda…")}</div>}
          {ready && shown.length === 0 && <div className="px-3 py-5 text-center text-v2-small text-v2-text-3">{t("O'quvchi topilmadi")}</div>}
          {shown.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(s)}
              className={`flex w-full items-center gap-3 rounded-v2-md px-2.5 py-2 text-left ${i === active ? "bg-v2-surface-2" : ""}`}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-full bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2" aria-hidden>
                {initialsOf(s.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-v2-small font-semibold text-v2-text">{s.name}</span>
                <span className="block truncate text-v2-caption font-normal tabular-nums text-v2-text-3">
                  {[studentPhoneLabel(s.phone) || "—", s.status !== "Aktiv" ? t(s.status) : ""].filter(Boolean).join(" · ")}
                </span>
              </span>
              {trailing && <span className="shrink-0 text-v2-caption tabular-nums">{trailing(s)}</span>}
            </button>
          ))}
        </div>
        {footer && <div className="shrink-0 border-t border-v2-border px-3 py-2 text-v2-caption text-v2-text-3">{footer}</div>}
      </FloatingPanel>
    </div>
  );
}
