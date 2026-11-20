"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useT } from "@/components/shared/Language";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import V2Select from "@/components/v2/ui/V2Select";
import { SearchBox, matchQuery } from "@/components/v2/students/lists/listKit";
import type { ReportGroupKey } from "@/lib/reportsCatalog";
import { CENTER_NAME, DOC_FOOTER, useReportData, useReportFmt, useToday } from "./reportHooks";
import { fileSafe, fmtNum } from "./reportFormat";
import type { Cell, ExportDoc } from "./reportExport";
import { Meter } from "./report35";
import { ErrorBanner, KpiStrip, NoteLine, type KpiCell } from "./reportUi";
import { ReportTableGrid, ReportTableShell, ReportTableTabs, type ReportTableGridCol } from "./reportTableKit";

// YANGI VERSIYA — eski components/reports/ReportTablePage.tsx ning yangi dizayndagi juftligi (51-qism,
// 20.11.2026): o'sha /api/student-reports?kind=… dan o'qiydi, o'sha qatorlar, o'sha tartib (id bo'yicha),
// hisob yo'q — faqat ko'rinish. Qo'shimcha (faqat brauzerda, so'rovsiz): qidiruv, segment (masalan Turi),
// ustun qiymatlari bo'yicha tanlovlar, ko'rsatkichlar kartasi (jadvaldagi ustunlar yig'indisi/soni),
// «kim bo'yicha» qatori, Excel / PDF (qo'shni hisobotlar bilan bir xil eksport).
// Sahifalar — ./reportTablePages.tsx; eski versiya — components/reports/reportTableLegacy.tsx.

export interface ReportTableV2Column<T> {
  key: string;
  /** Sarlavha (tarjima qilingan). */
  label: string;
  align?: "left" | "right";
  className?: string;
  render: (row: T) => ReactNode;
  /** Excel/PDF katagi; berilmasa ustun eksportga kirmaydi. */
  cell?: (row: T) => Cell;
  /** Eksportda raqam (o'ngga, Excel'da son). */
  numeric?: boolean;
}

/** Filtrlar qatoridagi tanlov — variantlar shu ustunning qiymatlaridan («O'qituvchi: Hammasi ⌄»). */
export interface ReportTableV2Filter<T> {
  key: string;
  /** Tugmadagi nom (tarjima qilingan). */
  label: string;
  of: (row: T) => string;
}

/** «Kim bekor qildi» kabi gorizontal qator — bosilsa o'sha filtr tanlanadi (Chegirma va istisnolardagi «Kim ruxsat bergan»). */
export interface ReportTableV2Breakdown<T> {
  /** Bog'langan filtr kaliti (`filters` ichidan). */
  filter: string;
  title: string;
  /** Berilsa — har kishida summa ham (so'm). */
  amount?: (row: T) => number;
}

const SEG = "__segment";
const EMPTY: never[] = [];
/** Bazadagi eski yozuvda maydon bo'lmasligi mumkin — tanlov va sanoqda bo'sh satr. */
const str = (v: unknown) => String(v ?? "");

export default function ReportTableV2<T extends { id: number }>({
  kind,
  columns,
  minWidth = 900,
  emptyText,
  summary,
  group,
  title,
  subtitle,
  author,
  search,
  searchPlaceholder,
  segment,
  segmentLabel,
  filters = EMPTY,
  breakdown,
  kpis,
  notes,
}: {
  /** /api/student-reports?kind=… (eski sahifa bilan bir xil). */
  kind: string;
  columns: ReportTableV2Column<T>[];
  minWidth?: number;
  emptyText?: string;
  /** Jadval ustidagi ixtiyoriy jamlanma (eski `summary` bilan bir xil vazifa). */
  summary?: (rows: T[]) => ReactNode;
  group: ReportGroupKey;
  title: string;
  subtitle: string;
  /** PDF/Excel'dagi «kim tayyorlagani». */
  author: string;
  /** Qidiruv maydonlari; berilmasa qidiruv yo'q. */
  search?: (row: T) => (string | number | null | undefined)[];
  searchPlaceholder?: string;
  /** Segment qiymati (masalan Turi) — «Hammasi · N | … · n». Yorliq — `t(qiymat)`. */
  segment?: (row: T) => string;
  segmentLabel?: string;
  filters?: ReportTableV2Filter<T>[];
  breakdown?: ReportTableV2Breakdown<T>;
  /** Ko'rsatkichlar — joriy filtrdagi qatorlardan. */
  kpis?: (rows: T[]) => KpiCell[];
  notes?: ReactNode[];
}) {
  const { t } = useT();
  const f = useReportFmt();
  const today = useToday();
  const { data, loading, stale, error, reload } = useReportData<{ rows: T[] }>(`/api/student-reports?kind=${kind}`);
  const all = data?.rows ?? EMPTY;

  const [q, setQ] = useState("");
  const [seg, setSeg] = useState("");
  const [sel, setSel] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  /** `skip` — shu tanlovni hisobga olmay (segment sonlari va «kim bo'yicha» qatori o'zini filtrlamasin). */
  const matcher = useMemo(() => {
    const query = q.trim();
    return (r: T, skip?: string) => {
      if (skip !== SEG && seg && segment && str(segment(r)) !== seg) return false;
      for (const fl of filters) {
        if (fl.key === skip) continue;
        const v = sel[fl.key];
        if (v && str(fl.of(r)) !== v) return false;
      }
      return !query || !search || matchQuery(query, ...search(r));
    };
  }, [q, seg, segment, filters, sel, search]);

  const rows = useMemo(() => all.filter((r) => matcher(r)), [all, matcher]);

  const segItems = useMemo(() => {
    if (!segment) return [];
    const base = all.filter((r) => matcher(r, SEG));
    const counts = new Map<string, number>();
    for (const r of base) counts.set(str(segment(r)), (counts.get(str(segment(r))) ?? 0) + 1);
    return [
      { key: "", label: t("Hammasi · {n}", { n: base.length }) },
      ...[...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => ({ key: k, label: `${k ? t(k) : "—"} · ${n}` })),
    ];
  }, [all, matcher, segment, t]);

  const filterOptions = useMemo(
    () =>
      filters.map((fl) => {
        const counts = new Map<string, number>();
        for (const r of all) {
          const v = str(fl.of(r));
          if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
        }
        return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([v, n]) => ({ value: v, label: v, hint: String(n) }));
      }),
    [filters, all],
  );

  const breakdownRows = useMemo(() => {
    if (!breakdown) return [];
    const fl = filters.find((x) => x.key === breakdown.filter);
    if (!fl) return [];
    const map = new Map<string, { count: number; sum: number }>();
    for (const r of all) {
      if (!matcher(r, breakdown.filter)) continue;
      const k = str(fl.of(r));
      if (!k) continue;
      const cur = map.get(k) ?? { count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += breakdown.amount ? breakdown.amount(r) || 0 : 0;
      map.set(k, cur);
    }
    return [...map.entries()].map(([who, v]) => ({ who, ...v })).sort((a, b) => b.count - a.count || b.sum - a.sum || a.who.localeCompare(b.who));
  }, [breakdown, filters, all, matcher]);

  const kpiCells = useMemo(() => (kpis ? kpis(rows) : []), [kpis, rows]);

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = Math.min(page, pages);
  const start = (cur - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);

  const setFilter = (key: string, v: string) => {
    setSel((s) => ({ ...s, [key]: v }));
    setPage(1);
  };

  /* ---- Eksport ---- */
  const activeFilters = [
    seg ? `${segmentLabel ?? t("Turi")}: ${t(seg)}` : "",
    ...filters.map((fl) => (sel[fl.key] ? `${fl.label}: ${sel[fl.key]}` : "")),
    q.trim() ? `«${q.trim()}»` : "",
  ].filter(Boolean);

  function getDoc(): ExportDoc | null {
    if (!data) return null;
    const ex = columns.filter((c) => c.cell);
    return {
      title: t("{name} hisoboti", { name: title }),
      fileBase: `${fileSafe(title)}-${today}`,
      center: t(CENTER_NAME),
      branchLabel: t("Barcha filiallar"),
      dateLabel: f.fullDate(today),
      author,
      filters: activeFilters.length ? activeFilters.join(" · ") : t("Hammasi"),
      kpis: kpiCells.map((k) => ({ label: k.label, value: k.value === null ? "—" : k.unit ? `${k.value} ${k.unit}` : k.value })),
      sections: [
        {
          columns: ex.map((c) => ({ label: c.label, numeric: c.numeric })),
          rows: rows.map((r) => ex.map((c) => c.cell!(r))),
        },
      ],
      footer: DOC_FOOTER,
    };
  }

  const gridCols: ReportTableGridCol<T>[] = columns.map((c) => ({ key: c.key, label: c.label, align: c.align, className: c.className, render: c.render }));
  const filtered = activeFilters.length > 0;
  const maxCount = breakdownRows[0]?.count ?? 1;

  return (
    <ReportTableShell
      group={group}
      title={title}
      subtitle={subtitle}
      getDoc={getDoc}
      exportReady={!!data && !stale}
      filters={
        <>
          {search && (
            <SearchBox
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(1);
              }}
              placeholder={searchPlaceholder ?? t("Qidiruv")}
              width={240}
            />
          )}
          {filters.map((fl, i) => (
            <V2Select
              key={fl.key}
              variant="value"
              label={fl.label}
              value={sel[fl.key] ?? ""}
              onChange={(v) => setFilter(fl.key, v)}
              options={[{ value: "", label: "Hammasi" }, ...filterOptions[i]]}
              emptyLabel="Hammasi"
              clearable={false}
            />
          ))}
        </>
      }
      filtersEnd={segment && segItems.length > 2 ? <ReportTableTabs items={segItems} value={seg} onChange={(k) => { setSeg(k); setPage(1); }} label={segmentLabel ?? t("Turi")} /> : undefined}
    >
      {error && <ErrorBanner message="Hisobot yuklanmadi" onRetry={reload} />}

      {/* Yuklanmagan bo'lsa ko'rsatkichlar chizilmaydi — xato «0» bo'lib ko'rinmasin (lib/fetchJson.ts izohi). */}
      {kpis && !(error && !data) && (
        <div className={stale ? "opacity-60" : ""}>
          <KpiStrip loading={loading} cells={kpiCells} />
        </div>
      )}

      {breakdown && breakdownRows.length > 0 && (
        <section className="overflow-x-auto rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
          <div className="flex min-w-max divide-x divide-v2-border">
            <div className="flex w-44 shrink-0 flex-col justify-center bg-v2-surface-2 px-4 py-3">
              <div className="font-semibold text-v2-text">{breakdown.title}</div>
              <div className="text-v2-caption text-v2-text-2">{t("{n} ta", { n: breakdownRows.reduce((a, b) => a + b.count, 0) })}</div>
            </div>
            {breakdownRows.slice(0, 20).map((b) => {
              const on = sel[breakdown.filter] === b.who;
              return (
                <button
                  key={b.who}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(breakdown.filter, on ? "" : b.who)}
                  className={`flex w-56 flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-v2-hover focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--v2-brand)] ${on ? "bg-v2-brand-bg" : ""}`}
                >
                  <span className="truncate font-semibold text-v2-text">{b.who}</span>
                  <span className="flex justify-between gap-2 whitespace-nowrap text-v2-caption text-v2-text-2">
                    <span>{t("{n} ta", { n: b.count })}</span>
                    {breakdown.amount && <b className="tabular-nums text-v2-text">{fmtNum(b.sum)}</b>}
                  </span>
                  <Meter pct={(b.count / Math.max(1, maxCount)) * 100} tone="bg-v2-warning" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {summary && summary(rows)}

      <div className={stale ? "opacity-60" : ""}>
        <ReportTableGrid
          cols={gridCols}
          rows={slice}
          rowKey={(r) => r.id}
          startIndex={start}
          loading={loading}
          empty={error ? t("Hisobot yuklanmadi") : filtered && all.length > 0 ? t("Hech narsa topilmadi") : (emptyText ?? t("Ma'lumotlar topilmadi"))}
          minWidth={minWidth}
          caption={title}
          footer={
            !loading && rows.length > 0 ? (
              <V2Pagination
                totalItems={rows.length}
                page={cur}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(1);
                }}
              />
            ) : undefined
          }
        />
      </div>

      {notes && notes.length > 0 && (
        <div className="flex flex-col gap-1">
          {notes.map((n, i) => (
            <NoteLine key={i}>{n}</NoteLine>
          ))}
        </div>
      )}
    </ReportTableShell>
  );
}
