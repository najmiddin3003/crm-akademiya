"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import Link from "@/components/ui/Link";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { REPORT_GROUPS, type ReportGroupKey } from "@/lib/reportsCatalog";
import ReportPdfDialog from "./ReportPdfDialog";
import { downloadXlsx, type ExportDoc } from "./reportExport";

// YANGI VERSIYA — HISOBOTLAR: katalogda YO'Q, eski manzilida qoladigan hisobotlarning umumiy bo'laklari
// (51-qism, 20.11.2026: /reports-diff-payments, /reports-cancelled, /reports-cancelled-attend,
// /reports-served). Ko'rinish — /reports/<slug> hisobotlari bilan aynan bir xil (./reportUi.tsx →
// ReportShell): yo'l «Hisobotlar › guruh › nomi», sarlavha, izoh, o'ngda Excel / PDF, filtrlar qatori.
// ReportShell katalog yozuvini (`ReportDef`, slug bilan) kutadi — bu sahifalar katalogda yo'q, shuning
// uchun qolip shu yerda guruh, nom va izoh bilan qayta yig'ilgan (Excel/PDF — o'sha reportExport va
// ReportPdfDialog). Jadval — qotgan sarlavha bilan, kartaning ichida aylanadi (DESIGN.md → «Jadval»).

/* ───────────────────────── Sahifa ───────────────────────── */

export function ReportTableShell({
  group,
  title,
  subtitle,
  filters,
  filtersEnd,
  getDoc,
  exportReady,
  children,
}: {
  group: ReportGroupKey;
  /** Sarlavha (tarjima qilingan). */
  title: string;
  /** Izoh — oldiga guruh nomi qo'shiladi («Moliya · …»). */
  subtitle: ReactNode;
  filters: ReactNode;
  filtersEnd?: ReactNode;
  /** Excel va PDF uchun bitta hujjat. */
  getDoc: () => ExportDoc | null;
  exportReady: boolean;
  children: ReactNode;
}) {
  const { t } = useT();
  const { showError } = useToast();
  const g = REPORT_GROUPS.find((x) => x.key === group);
  const [pdfDoc, setPdfDoc] = useState<ExportDoc | null>(null);
  const [xlsxBusy, setXlsxBusy] = useState(false);

  async function excel() {
    const doc = getDoc();
    if (!doc) return;
    setXlsxBusy(true);
    try {
      await downloadXlsx(doc);
    } catch {
      showError(t("Excel faylini yasab bo'lmadi"));
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
            <span>{g ? t(g.label) : ""}</span>
            <ChevronRight className="size-3.5 text-v2-text-3" strokeWidth={1.75} aria-hidden />
            <span className="font-medium text-v2-text" aria-current="page">
              {title}
            </span>
          </nav>
          <h1 className="text-v2-page text-v2-text">{title}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {g ? `${t(g.label)} · ` : ""}
            {subtitle}
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

      {pdfDoc && <ReportPdfDialog doc={pdfDoc} reportTitle={title} onClose={() => setPdfDoc(null)} />}
    </div>
  );
}

/* ───────────────────────── Segment ───────────────────────── */

/** «Hammasi · 12 | Chegirma · 9 | Qo'shimcha · 3» — qo'shni hisobotlardagi segment bilan bir xil. */
export function ReportTableTabs({ items, value, onChange, label }: { items: { key: string; label: string }[]; value: string; onChange: (k: string) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex max-w-full flex-wrap rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="tab"
          aria-selected={value === it.key}
          onClick={() => onChange(it.key)}
          className={`h-8 rounded-[6px] px-3 text-v2-small font-semibold transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${value === it.key ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2 hover:text-v2-text"}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────── Belgi ───────────────────────── */

export type ReportTablePillTone = "violet" | "info" | "danger" | "warning" | "success" | "neutral";

const PILL: Record<ReportTablePillTone, string> = {
  violet: "bg-v2-violet-bg text-v2-violet",
  info: "bg-v2-info-bg text-v2-info",
  danger: "bg-v2-danger-bg text-v2-danger",
  warning: "bg-v2-warning-bg text-v2-warning",
  success: "bg-v2-success-bg text-v2-success",
  neutral: "bg-v2-surface-2 text-v2-text-2",
};

/** Turi tabletkasi (Chegirma va istisnolar hisobotidagidek). */
export function ReportTablePill({ tone, children }: { tone: ReportTablePillTone; children: ReactNode }) {
  return <span className={`inline-flex whitespace-nowrap rounded-v2-full px-2 py-0.5 text-v2-small font-semibold ${PILL[tone]}`}>{children}</span>;
}

/* ───────────────────────── Jadval ───────────────────────── */

export interface ReportTableGridCol<R> {
  key: string;
  label: ReactNode;
  align?: "left" | "right";
  /** `th` / `td` ga qo'shimcha klass (eni, telefonda yashirish). */
  className?: string;
  render: (row: R) => ReactNode;
}

const TH = "sticky top-0 z-10 h-9 whitespace-nowrap bg-v2-surface-2 px-4 text-v2-caption font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";

/**
 * Jadval kartasi: birinchi ustun «№» (sahifalashda davom etadi — eski jadvaldagidek), qotgan sarlavha,
 * quti ichida ikki tomonga aylanadi (telefonda sahifa kengaymaydi), pastda — sahifalash.
 */
export function ReportTableGrid<R>({
  cols,
  rows,
  rowKey,
  startIndex = 0,
  loading,
  empty,
  minWidth,
  caption,
  footer,
}: {
  cols: ReportTableGridCol<R>[];
  rows: R[];
  rowKey: (row: R) => string | number;
  /** Shu sahifadagi birinchi qatorning tartib raqami − 1. */
  startIndex?: number;
  loading: boolean;
  empty: ReactNode;
  minWidth: number;
  caption?: string;
  footer?: ReactNode;
}) {
  const th = (c: ReportTableGridCol<R>) => `${TH} ${c.align === "right" ? "text-right" : "text-left"} ${c.className ?? ""}`;
  const td = (c: ReportTableGridCol<R>) => `px-4 py-2.5 align-middle ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.className ?? ""}`;
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
      {/* `relative` — ichidagi `sr-only` yozuv aylantirish qutisidan chiqib, telefonda sahifani kengaytirmasin. */}
      <div className="relative max-h-[70vh] min-h-0 overflow-auto">
        <table className="w-full border-collapse text-v2-body" style={{ minWidth }}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              <th scope="col" className={`${TH} w-12 text-left`}>
                №
              </th>
              {cols.map((c) => (
                <th key={c.key} scope="col" className={th(c)}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i} className="border-b border-v2-border last:border-b-0" aria-hidden>
                  <td className="px-4 py-3">
                    <span className="inline-block h-3 w-5 rounded bg-v2-skeleton" />
                  </td>
                  {cols.map((c) => (
                    <td key={c.key} className={td(c)}>
                      <span className={`inline-block h-3 rounded bg-v2-skeleton ${c.align === "right" ? "w-14" : "w-28"}`} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length + 1} className="px-4 py-12 text-center text-v2-small text-v2-text-2">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={rowKey(r)} className={`border-b border-v2-border last:border-b-0 ${ROW_TINT.hover}`}>
                  <td className="px-4 py-2.5 text-v2-text-3 tabular-nums">{startIndex + i + 1}</td>
                  {cols.map((c) => (
                    <td key={c.key} className={td(c)}>
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer}
    </section>
  );
}

/** Bo'sh qiymat — «—» (DESIGN.md → «Jadval», 3-qoida). */
export function ReportTableDash() {
  return <span className="text-v2-text-3">—</span>;
}
