"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { Loader2, Search } from "lucide-react";
import { useT } from "@/components/shared/Language";
import type { StudentRow } from "@/lib/studentsData";

// ESKI VERSIYA: O'QUVCHINI QIDIRISH — Imtihon → «Natija qo'shish» → guruhsiz ro'yxat (01.11.2026).
// Ism yoki telefon bo'yicha SERVERDA (/api/search/students — navbardagi qidiruv; filial qamrovi
// o'sha yerda), yangi versiyadagi components/v2/form/StudentSearchField bilan bir xil manba: butun
// ro'yxat (6 700+ o'quvchi) brauzerga tashilmaydi. Tanlangach maydon tozalanadi — keyingi
// o'quvchini darhol qidirsa bo'ladi.
//
// Klaviatura: ↑↓ yurish, Enter tanlash (forma saqlanmaydi — `data-enter-ignore`), Esc yopadi.

/** 9 raqam → «93 657 37 00»; boshqasi — o'zicha. */
function phoneLabel(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  const local = d.length === 12 && d.startsWith("998") ? d.slice(3) : d;
  if (local.length !== 9) return raw || "";
  return `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
}

export default function PupilSearchInput({
  onPick,
  note,
  inputRef: givenRef,
  placeholder,
}: {
  onPick: (s: StudentRow) => void;
  /** Qator o'ngidagi izoh (masalan «ro'yxatda»). */
  note?: (s: StudentRow) => ReactNode;
  /** Maydonning o'zi — tashqaridan fokus qaytarish uchun. */
  inputRef?: RefObject<HTMLInputElement | null>;
  placeholder?: string;
}) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ q: string; items: StudentRow[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const ownRef = useRef<HTMLInputElement>(null);
  const inputRef = givenRef ?? ownRef;
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

  // Tashqariga bosilsa — yopiladi (StudentSearchSelect dagi usul).
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const ready = query.length >= 2 && result?.q === query;
  const busy = query.length >= 2 && !ready;
  const shown = ready ? result!.items : [];

  function pick(s: StudentRow) {
    setOpen(false);
    setQ("");
    onPick(s);
  }

  return (
    <div ref={boxRef} className="relative" data-enter-ignore="">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(e.target.value.trim().length >= 2);
        }}
        onFocus={() => query.length >= 2 && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            return;
          }
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
        autoComplete="off"
        placeholder={placeholder ?? t("Ism yoki telefon bo'yicha qidiring…")}
        className="w-full h-10 rounded-lg border border-border bg-card pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      {busy && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />}
      {open && query.length >= 2 && (
        <div id={listId} role="listbox" aria-label={t("O'quvchi")} className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          <div className="max-h-64 overflow-y-auto py-1">
            {busy && <div className="px-3 py-3 text-sm text-muted-foreground">{t("Qidirilmoqda…")}</div>}
            {ready && shown.length === 0 && <div className="px-3 py-3 text-sm text-muted-foreground">{t("O'quvchi topilmadi")}</div>}
            {shown.map((s, i) => {
              const extra = note?.(s);
              return (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(s)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left ${i === active ? "bg-secondary" : ""}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{s.name}</span>
                    <span className="block truncate text-[12px] tabular-nums text-muted-foreground">
                      {[phoneLabel(s.phone) || "—", s.status !== "Aktiv" ? t(s.status) : ""].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {extra ? <span className="shrink-0 text-[11px] text-muted-foreground">{extra}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
