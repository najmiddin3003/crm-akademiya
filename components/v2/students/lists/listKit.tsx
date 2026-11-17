"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Info, Search, Users } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import V2Select from "@/components/v2/ui/V2Select";
import V2DateField from "@/components/v2/form/V2DateField";
import type { ListGroup, StudentListRow } from "@/lib/studentListsTypes";

// O'QUVCHILAR BO'LIMI (yangi versiya, 30-qism) — oltita ro'yxat sahifasining umumiy qismlari:
// sarlavha, qidiruv, xulosa qatori, holat «tabletkalari», jadval
// kataklari (o'quvchi, guruh), belgilar va formatlash. Sahifa qolipi — O'quvchilar ro'yxati
// (components/v2/students/StudentsListV2.tsx, design/v2/DESIGN.md → «Sahifa qolipi — ro'yxat»).

/* ---------------- Formatlash ---------------- */

export function fmtNum(n: number): string {
  const v = Math.abs(Math.round(n)).toLocaleString("ru-RU").replace(/,/g, " ");
  return n < 0 ? `−${v}` : v;
}

/** "947655525" / "998947655525" → "94 765 55 25". */
export function fmtPhone(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  const local = d.length === 12 && d.startsWith("998") ? d.slice(3) : d;
  if (local.length !== 9) return raw || "";
  return `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];

/** "2026-10-05" → "05.10.2026". */
export function dmy(iso: string | null | undefined): string {
  if (!iso || iso.length < 10) return "";
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}

/** "2026-10-14" → "14-oktabr". */
export function dayMonth(iso: string | null | undefined): string {
  if (!iso || iso.length < 10) return "";
  return `${Number(iso.slice(8, 10))}-${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ""}`;
}

/** "2026-10-14" → "14-okt". */
export function dayMonthShort(iso: string | null | undefined): string {
  if (!iso || iso.length < 10) return "";
  return `${Number(iso.slice(8, 10))}-${MONTHS_SHORT[Number(iso.slice(5, 7)) - 1] ?? ""}`;
}

/** "2026-10" → "oktabr". */
export function monthName(ym: string): string {
  return MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym;
}

/** "2026-09".."2026-10" → "sentabr – oktabr" (bir oy — o'zi). */
export function monthRange(from: string, to: string): string {
  return from === to ? monthName(from) : `${monthName(from)} – ${monthName(to)}`;
}

/** Ism, telefon (raqamlari) yoki ID bo'yicha moslik. */
export function matchQuery(q: string, ...fields: (string | number | null | undefined)[]): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const text = fields.map((f) => String(f ?? "")).join(" ").toLowerCase();
  if (text.includes(query)) return true;
  const digits = query.replace(/\D/g, "");
  return digits.length >= 3 && text.replace(/\D/g, "").includes(digits);
}

/* ---------------- Sahifa qismlari ---------------- */

/**
 * Sahifa ramkasi. Sukut — ≥1024 px da ekran balandligiga qotadi (jadval kartada ichidan aylanadi).
 * `flow` — bir nechta bo'limli uzun sahifa (Tanga berish, Kunlik topshiruv): sahifa o'zi aylanadi.
 */
export function PageShell({ children, flow = false }: { children: ReactNode; flow?: boolean }) {
  return (
    <div data-ui="v2" className={`relative flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5 ${flow ? "" : "lg:h-full lg:min-h-0"}`}>
      {children}
    </div>
  );
}

export function PageHead({ title, subtitle, actions }: { title: string; subtitle: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-v2-page text-v2-text">{title}</h1>
        <p className="mt-0.5 text-v2-small text-v2-text-2">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Tepadagi izoh qatori (`info` — ko'k, rasm «Yangi o'quvchilar»). */
export function NoticeBar({ icon: Icon = Info, children, action }: { icon?: typeof Info; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-v2-md bg-v2-info-bg px-3 py-2 text-v2-small text-v2-text">
      <Icon className="size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, width = 260 }: { value: string; onChange: (v: string) => void; placeholder: string; width?: number }) {
  return (
    <div className="relative w-full sm:w-auto" style={{ minWidth: Math.min(width, 260) }}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        style={{ width }}
        className="h-9 max-w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none max-sm:w-full!"
      />
    </div>
  );
}

/** Xulosa qatori: «114 ta aktiv o'quvchi • Qarzdorlik … • Haqdorlik …». */
export function SummaryLine({ items }: { items: ReactNode[] }) {
  const list = items.filter(Boolean);
  return (
    <div className="-mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-v2-small text-v2-text-2">
      {list.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 && <span aria-hidden>•</span>}
          {it}
        </span>
      ))}
    </div>
  );
}

export function B({ children, tone }: { children: ReactNode; tone?: "danger" | "success" }) {
  return <b className={`font-semibold tabular-nums ${tone === "danger" ? "text-v2-danger" : tone === "success" ? "text-v2-success" : "text-v2-text"}`}>{children}</b>;
}

/** Holat «tabletkalari»: «Hammasi 114», «Oktabr to'langan 46» … (tanlangani brend). */
export function SegmentPills<K extends string>({ items, value, onChange }: { items: { key: K; label: string; count: number }[]; value: K; onChange: (k: K) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist">
      {items.map((it) => {
        const on = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(it.key)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-v2-full border px-3 text-v2-small font-medium transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
              on ? "border-v2-brand bg-v2-brand-bg text-v2-brand-text" : "border-v2-border-strong bg-v2-surface text-v2-text hover:bg-v2-surface-2"
            }`}
          >
            {it.label}
            <span className={`tabular-nums ${on ? "" : "text-v2-text-3"}`}>{it.count}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Jadval ---------------- */

export const TH =
  "sticky top-0 z-10 whitespace-nowrap bg-v2-surface-2 px-2.5 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";

export function SortHead<K extends string>({ label, k, sort, onSort, align }: { label: string; k: K; sort: { key: K; dir: "asc" | "desc" }; onSort: (k: K) => void; align?: "right" }) {
  const { t } = useT();
  const on = sort.key === k;
  const Icon = on && sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      aria-label={t("{col} bo'yicha saralash", { col: label })}
      className={`group/sort inline-flex items-center gap-1 rounded-v2-sm hover:text-v2-text ${on ? "font-semibold text-v2-text" : ""} ${align === "right" ? "flex-row-reverse" : ""}`}
    >
      {label}
      <Icon className={`size-3.5 ${on ? "" : "opacity-0 group-hover/sort:opacity-60"}`} strokeWidth={2} aria-hidden />
    </button>
  );
}

export function TableCard({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
      <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
        <table className="w-full border-collapse text-v2-body">{children}</table>
      </div>
      {footer}
    </div>
  );
}

export function SkeletonRows({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={`sk${i}`} className="border-b border-v2-border" aria-hidden>
          <td className="py-3 pl-4 pr-2"><div className="size-4 rounded-[4px] bg-v2-skeleton" /></td>
          <td className="px-2.5 py-3">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-v2-full bg-v2-skeleton" />
              <div className="space-y-1.5">
                <div className="h-3 w-32 rounded bg-v2-skeleton" />
                <div className="h-2.5 w-20 rounded bg-v2-skeleton" />
              </div>
            </div>
          </td>
          {Array.from({ length: Math.max(0, cols - 2) }, (_, j) => (
            <td key={j} className="px-2.5 py-3"><div className="h-3 w-20 rounded bg-v2-skeleton" /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function EmptyRow({ cols, title, hint, action }: { cols: number; title: string; hint?: string; action?: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="p-6">
        <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
            <Users className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="text-v2-section text-v2-text">{title}</div>
          {hint && <p className="max-w-md text-v2-small text-v2-text-2">{hint}</p>}
          {action}
        </div>
      </td>
    </tr>
  );
}

/** Oddiy pastki qator: «1–4 / 4 ta» + o'ngda sahifa o'lchami va strelkalar (rasmdagi «10 qator»). */
export function SimplePager({
  total,
  page,
  pageSize,
  onPage,
  onPageSize,
  note,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
  note?: ReactNode;
}) {
  const { t } = useT();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const arrow =
    "inline-flex size-8 items-center justify-center rounded-v2-md border border-v2-border-strong bg-v2-surface text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-v2-border px-4 py-2.5 text-v2-small text-v2-text-2">
      <span className="tabular-nums">
        <b className="font-semibold text-v2-text">{from}–{to}</b> / {total} {t("ta")}
      </span>
      {note && <span className="text-v2-text-3">· {note}</span>}
      <div className="ml-auto flex items-center gap-2">
        <div className="w-[118px]">
          <V2Select
            label={t("Sahifadagi qatorlar")}
            value={String(pageSize)}
            onChange={(v) => v && onPageSize(Number(v))}
            options={[10, 25, 50, 100].map((n) => ({ value: String(n), label: t("{n} qator", { n }) }))}
            searchable={false}
            clearable={false}
          />
        </div>
        {pages > 1 && (
          <>
            <button type="button" className={arrow} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t("Oldingi")} title={t("Oldingi")}>
              <ChevronLeft className="size-4" strokeWidth={1.75} />
            </button>
            <button type="button" className={arrow} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={t("Keyingi")} title={t("Keyingi")}>
              <ChevronRight className="size-4" strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Kataklar ---------------- */

export function Avatar({ name }: { name: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-full border border-v2-border bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2" aria-hidden>
      {initialsOf(name)}
    </span>
  );
}

/** Avatar + ism (profilga havola) + ikkinchi qator (telefon yoki «ota-ona: …»). */
export function PersonCell({ id, name, sub }: { id?: number; name: string; sub: ReactNode }) {
  return (
    <div className="flex min-w-[190px] items-center gap-3">
      <Avatar name={name} />
      <span className="min-w-0">
        {id !== undefined ? (
          <Link href={`/student-edit/${id}`} className="block truncate font-semibold text-v2-text underline-offset-2 hover:text-v2-brand-text hover:underline">
            {name}
          </Link>
        ) : (
          <span className="block truncate font-semibold text-v2-text">{name}</span>
        )}
        <span className="block truncate text-v2-small tabular-nums text-v2-text-3">{sub}</span>
      </span>
    </div>
  );
}

/** «● Ingliz tili · 1-bosqich» + ostida o'qituvchi (+N guruh). */
export function GroupCell({ groups, extra }: { groups: ListGroup[]; extra?: ReactNode }) {
  const { t } = useT();
  const g = groups[0];
  if (!g) return <span className="text-v2-text-3">—</span>;
  const title = [g.course || g.name, g.level].filter(Boolean).join(" · ");
  return (
    <div className="min-w-[150px]" title={groups.map((x) => [x.name, x.course, x.level].filter(Boolean).join(" · ")).join("\n")}>
      <span className="flex items-center gap-1.5">
        <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />
        <span className="truncate text-v2-text">{title}</span>
      </span>
      <span className="block truncate pl-3.5 text-v2-small text-v2-text-3">
        {g.teacher || t("o'qituvchisiz")}
        {groups.length > 1 && ` · +${groups.length - 1} ${t("guruh")}`}
        {extra}
      </span>
    </div>
  );
}

export type BadgeTone = "success" | "danger" | "warning" | "info" | "neutral";

const BADGE: Record<BadgeTone, { box: string; dot: string }> = {
  success: { box: "bg-v2-success-bg text-v2-success", dot: "bg-v2-success" },
  danger: { box: "bg-v2-danger-bg text-v2-danger", dot: "bg-v2-danger" },
  warning: { box: "bg-v2-warning-bg text-v2-warning", dot: "bg-v2-warning" },
  info: { box: "bg-v2-info-bg text-v2-info", dot: "bg-v2-info" },
  neutral: { box: "bg-v2-surface-2 text-v2-text-2", dot: "bg-v2-text-3" },
};

export function Badge({ tone, children, title }: { tone: BadgeTone; children: ReactNode; title?: string }) {
  const c = BADGE[tone];
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-v2-full px-2 py-0.5 text-v2-caption ${c.box}`}>
      <span className={`size-1.5 shrink-0 rounded-full ${c.dot}`} aria-hidden />
      {children}
    </span>
  );
}

/** Ota-ona kabineti belgisi: «Kirgan», «Taklif ketdi» / «Taklif · 3-okt», «Kirmagan». */
export function CabinetBadge({ row, withDate = false }: { row: Pick<StudentListRow, "cabinet" | "cabinetAt">; withDate?: boolean }) {
  const { t } = useT();
  const when = (iso: string | null, today = false) => (today ? t("bugun") : dayMonthShort(iso));
  const isToday = row.cabinetAt === todayIso();
  if (row.cabinet === "in") return <Badge tone="success">{withDate && row.cabinetAt ? `${t("Kirgan")} · ${when(row.cabinetAt, isToday)}` : t("Kirgan")}</Badge>;
  if (row.cabinet === "invited") return <Badge tone="info">{withDate && row.cabinetAt ? `${t("Taklif")} · ${when(row.cabinetAt, isToday)}` : t("Taklif ketdi")}</Badge>;
  return <Badge tone="neutral">{t("Kirmagan")}</Badge>;
}

/** Bugun (brauzer, Toshkent vaqti bilan yaqin) — "YYYY-MM-DD". */
export function todayIso(): string {
  const d = new Date(Date.now() + 5 * 3600_000);
  return d.toISOString().slice(0, 10);
}

/** CSV fayl (Excel ham ochadi) — UTF-8 BOM bilan. */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------- Sana maydoni (ISO) ---------------- */

/** "YYYY-MM-DD" ↔ V2DateField (mahalliy Date) — yangi oynalardagi sana maydonlari uchun. */
export function IsoDateField({ value, onChange, id }: { value: string; onChange: (iso: string) => void; id?: string }) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10))) : null;
  return (
    <V2DateField
      id={id}
      value={d}
      onChange={(x) => onChange(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`)}
    />
  );
}
