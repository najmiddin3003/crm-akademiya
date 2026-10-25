"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, FileSpreadsheet, FileText, Info, Loader2, RefreshCw } from "lucide-react";
import Link from "@/components/ui/Link";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { REPORT_GROUPS, type ReportDef } from "@/lib/reportsCatalog";
import ReportPdfDialog, { type PdfToggle } from "./ReportPdfDialog";
import { downloadXlsx, type ExportDoc } from "./reportExport";

// HISOBOTLAR (15-qism) — sahifa qolipi va umumiy bo'laklar (rasmlar «Kelgan va ketgan»,
// «Qarzdorlar», 25.10.2026):
//   • yo'l: «Hisobotlar › O'quvchilar oqimi › Kelgan va ketgan»;
//   • sarlavha, izoh («guruh · …»), o'ngda «Excel» va «PDF» (PDF — ./ReportPdfDialog);
//   • filtrlar qatori (chapda tanlovlar, o'ngda — `filtersEnd`);
//   • ko'rsatkichlar kartasi (bitta karta, ustunlar chiziq bilan), jadval, izoh.

/* ───────────────────────── Sahifa ───────────────────────── */

export function ReportShell({
  report,
  subtitle,
  filters,
  filtersEnd,
  getDoc,
  exportReady,
  pdfToggles,
  children,
}: {
  report: ReportDef;
  /** «barcha filiallar» / «qarzi bor o'quvchilar, eng kattasi tepada» (sukut — ro'yxatdagi). */
  subtitle?: string;
  filters: ReactNode;
  filtersEnd?: ReactNode;
  /** Eksport hujjati (Excel va PDF uchun bitta). */
  getDoc: () => ExportDoc | null;
  exportReady: boolean;
  pdfToggles?: PdfToggle[];
  children: ReactNode;
}) {
  const { t } = useT();
  const { showError } = useToast();
  const group = REPORT_GROUPS.find((g) => g.key === report.group);
  const [pdfDoc, setPdfDoc] = useState<ExportDoc | null>(null);
  const [xlsxBusy, setXlsxBusy] = useState(false);

  async function excel() {
    const doc = getDoc();
    if (!doc) return;
    setXlsxBusy(true);
    try {
      await downloadXlsx(doc);
    } catch {
      showError("Excel faylini yasab bo'lmadi");
    } finally {
      setXlsxBusy(false);
    }
  }

  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <nav aria-label={t("Yo'l")} className="mb-1 flex flex-wrap items-center gap-1 text-v2-small text-v2-text-2">
            <Link href="/reports" className="rounded-v2-sm hover:text-v2-text hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus">
              {t("Hisobotlar")}
            </Link>
            <ChevronRight className="size-3.5 text-v2-text-3" strokeWidth={1.75} aria-hidden />
            <span>{group ? t(group.label) : ""}</span>
            <ChevronRight className="size-3.5 text-v2-text-3" strokeWidth={1.75} aria-hidden />
            <span className="font-medium text-v2-text" aria-current="page">
              {t(report.title)}
            </span>
          </nav>
          <h1 className="text-v2-page text-v2-text">{t(report.title)}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {group ? t(group.label) : ""} · {subtitle ?? t(report.subtitle)}
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button type="button" onClick={() => void excel()} disabled={!exportReady || xlsxBusy} className={`${secondaryBtn} disabled:opacity-50`}>
            {xlsxBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="size-4 text-v2-success" strokeWidth={1.75} aria-hidden />}
            Excel
          </button>
          <button
            type="button"
            onClick={() => {
              const doc = getDoc();
              if (doc) setPdfDoc(doc);
            }}
            disabled={!exportReady}
            className={`${secondaryBtn} disabled:opacity-50`}
          >
            <FileText className="size-4 text-v2-danger" strokeWidth={1.75} aria-hidden />
            PDF
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">{filters}</div>
        {filtersEnd && <div className="ml-auto">{filtersEnd}</div>}
      </div>

      {children}

      {pdfDoc && <ReportPdfDialog doc={pdfDoc} reportTitle={t(report.title)} toggles={pdfToggles} onClose={() => setPdfDoc(null)} />}
    </div>
  );
}

/* ───────────────────────── Ko'rsatkichlar ───────────────────────── */

export interface KpiCell {
  key: string;
  label: string;
  /** Asosiy son (formatlangan). `null` — noma'lum («—»). */
  value: string | null;
  /** Son yonidagi kichik birlik («so'm», «o'quvchi»). */
  unit?: string;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: "danger" | "success";
  spark?: number[];
}

export function KpiStrip({ cells, loading }: { cells: KpiCell[]; loading: boolean }) {
  const cols = cells.length >= 4 ? "lg:grid-cols-4" : cells.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";
  return (
    <section className={`grid overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border shadow-v2-sm sm:grid-cols-2 ${cols} gap-px`}>
      {cells.map((c) => (
        // Ikki ustunli (planshet) to'rda toq oxirgi katak butun qatorni egallaydi — bo'sh joy kulrang bo'lib qolmasin.
        <div key={c.key} className="relative min-w-0 bg-v2-surface px-4 py-3.5 sm:max-lg:[&:last-child:nth-child(odd)]:col-span-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-v2-small text-v2-text-2">
              {c.icon}
              <span className="truncate">{c.label}</span>
            </div>
            {loading ? (
              <div className="mt-2 h-6 w-24 rounded bg-v2-skeleton" aria-hidden />
            ) : (
              <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
                <span className={`text-[24px] font-semibold leading-8 tabular-nums ${c.tone === "danger" ? "text-v2-danger" : c.tone === "success" ? "text-v2-success" : "text-v2-text"}`}>{c.value ?? "—"}</span>
                {c.unit && c.value !== null && <span className="text-v2-body text-v2-text-2">{c.unit}</span>}
              </div>
            )}
            {c.sub && <div className="mt-0.5 truncate text-v2-caption font-normal text-v2-text-2">{loading ? " " : c.sub}</div>}
          </div>
          {/* Kichik grafik — yuqori o'ngda (rasmdagidek), izoh butun kenglikda qoladi. */}
          {c.spark && c.spark.length > 1 && !loading && (
            <span className="absolute right-4 top-5">
              <Sparkline values={c.spark} />
            </span>
          )}
        </div>
      ))}
    </section>
  );
}

/** Kichik chiziqli grafik (oxirgi nuqta — doira). */
export function Sparkline({ values }: { values: number[] }) {
  const w = 88;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 6) + 3, h - 4 - ((v - min) / span) * (h - 8)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      <path d={d} fill="none" stroke="var(--v2-series-1)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.75} />
      <circle cx={lx} cy={ly} r={3} fill="var(--v2-series-1)" />
    </svg>
  );
}

/* ───────────────────────── Jadval ───────────────────────── */

export interface TableCol<R> {
  key: string;
  label: ReactNode;
  align?: "left" | "right";
  /** `th` / `td` ga qo'shimcha klass (eni). */
  className?: string;
  render: (row: R) => ReactNode;
}

export function ReportTable<R>({
  cols,
  rows,
  rowKey,
  total,
  loading,
  empty,
  minWidth = 640,
  caption,
}: {
  cols: TableCol<R>[];
  rows: R[];
  rowKey: (row: R) => string | number;
  /** Jami qatori (katak tartibi — `cols` bo'yicha). */
  total?: ReactNode[];
  loading: boolean;
  empty: ReactNode;
  minWidth?: number;
  caption?: string;
}) {
  const th = (c: TableCol<R>) => `h-9 px-4 text-v2-caption font-medium text-v2-text-2 ${c.align === "right" ? "text-right" : "text-left"} ${c.className ?? ""}`;
  const td = (c: TableCol<R>) => `px-4 py-2.5 align-middle ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.className ?? ""}`;
  return (
    <section className="relative overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
      {/* `relative` — ichidagi `sr-only` (absolute) yozuvlar aylantirish qutisidan chiqib, telefonda sahifani kengaytirmasin. */}
      <div className="relative overflow-x-auto">
        <table className="w-full border-collapse text-v2-body" style={{ minWidth }}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-v2-border bg-v2-surface-2">
              {cols.map((c) => (
                <th key={c.key} scope="col" className={th(c)}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className="border-b border-v2-border last:border-b-0" aria-hidden>
                  {cols.map((c) => (
                    <td key={c.key} className={td(c)}>
                      <span className={`inline-block h-3 rounded bg-v2-skeleton ${c.align === "right" ? "w-14" : "w-28"}`} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="px-4 py-10 text-center text-v2-small text-v2-text-2">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={rowKey(r)} className="border-b border-v2-border last:border-b-0">
                  {cols.map((c) => (
                    <td key={c.key} className={td(c)}>
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {total && !loading && rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-v2-border bg-v2-surface-2 font-semibold">
                {cols.map((c, i) => (
                  <td key={c.key} className={td(c)}>
                    {total[i] ?? null}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

/* ───────────────────────── Holatlar ───────────────────────── */

export function NoteLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-v2-caption font-normal text-v2-text-2">
      <Info className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useT();
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-v2-lg border border-v2-danger/30 bg-v2-danger-bg px-4 py-3 text-v2-small text-v2-danger">
      <span className="flex items-center gap-2">
        <Info className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
        {t(message)}
      </span>
      <button type="button" onClick={onRetry} className={`${secondaryBtn} h-8`}>
        <RefreshCw className="size-3.5" strokeWidth={1.75} aria-hidden />
        {t("Qayta urinish")}
      </button>
    </div>
  );
}

/** Raqam katagi: «+13» qalin, manfiy — qizil. */
export function SignedNum({ value, text }: { value: number | null; text: string }) {
  if (value === null) return <span className="text-v2-text-3">—</span>;
  return <span className={`font-semibold tabular-nums ${value < 0 ? "text-v2-danger" : "text-v2-text"}`}>{text}</span>;
}
