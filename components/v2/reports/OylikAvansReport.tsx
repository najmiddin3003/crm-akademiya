"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Building2, ChevronDown, TriangleAlert } from "lucide-react";
import Link from "@/components/ui/Link";
import { useBranch } from "@/components/shared/BranchContext";
import { useT, type TFn } from "@/components/shared/Language";
import { Segmented } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { branchBuildingLabel } from "@/lib/branchPools";
import type { Lang } from "@/lib/i18n";
import type { PayrollReportMonth, PayrollReportRow } from "@/lib/reportPayroll";
import type { ReportDef } from "@/lib/reportsCatalog";
import type { SalaryType } from "@/lib/salary";
import { CENTER_NAME, DOC_FOOTER, useReportData, useReportFmt, useToday } from "./reportHooks";
import { fileSafe, fmtNum, initialsOf, monthRangeLabel, shiftMonth, type MonthRange } from "./reportFormat";
import type { Cell, ExportColumn, ExportDoc, ExportSection } from "./reportExport";
import { ErrorBanner, KpiStrip, NoteLine, ReportShell, type KpiCell } from "./reportUi";
import V2MonthRange from "./V2MonthRange";

// YANGI VERSIYA — HISOBOTLAR → XODIMLAR VA OYLIK → «OYLIK VA AVANS» (26-qism, rasmlar 41–44,
// 13.11.2026). YOPILGAN oylar, har xodim bo'yicha; joriy oy — Moliya → Oylik chiqarish.
//   • BITTA OY (41/42): Jami oylik · Jami avans · To'langan · Qolgan oylik; jadval filial (bino)
//     bo'yicha guruhlangan, ochib-yopiladi; «Hisoblash usuli» filtri.
//   • BIR NECHA OY (43/44): oylar — ustun; o'ngda ko'rsatkich (Jami oylik / Jami avans / Qolgan
//     oylik), oxirida «N oyda» va birinchi oyga nisbatan %.
// Raqamlar Oylik chiqarish sahifasining o'zi (GET /api/reports/payroll → lib/reportPayroll.ts →
// buildPayrollRows). «Jami oylik» — oklad + ulush (bonus/jarimasiz), rasmdagi formula bo'yicha.

type Resp = {
  ok: true;
  branch: "all" | number;
  from: string;
  to: string;
  minMonth: string;
  maxMonth: string;
  closedThrough: string | null;
  branches: { id: number; name: string }[];
  months: PayrollReportMonth[];
};

type Method = "" | SalaryType;
type Metric = "base" | "avans" | "due";

/** Bir guruh (filial) yoki butun ro'yxat yig'indisi — bitta oy. */
interface Totals {
  n: number;
  configured: number;
  base: number;
  avans: number;
  paid: number;
  carry: number;
  bonus: number;
  jarima: number;
  tax: number;
  payout: number;
  debt: number;
}

function totalsOf(rows: readonly PayrollReportRow[]): Totals {
  const s: Totals = { n: rows.length, configured: 0, base: 0, avans: 0, paid: 0, carry: 0, bonus: 0, jarima: 0, tax: 0, payout: 0, debt: 0 };
  for (const r of rows) {
    s.avans += r.avans;
    s.paid += r.paid;
    s.carry += r.carry;
    s.bonus += r.bonus;
    s.jarima += r.jarima;
    if (!r.configured) continue;
    s.configured += 1;
    s.base += r.base ?? 0;
    s.tax += r.tax ?? 0;
    s.payout += r.payout ?? 0;
    s.debt += r.debt ?? 0;
  }
  return s;
}

/** Ko'rsatkich qiymati: qatorda — o'zi; yig'indida «Qolgan» — kassadan chiqadigani (Oylik chiqarish kartasi). */
const rowMetric = (r: PayrollReportRow | undefined, m: Metric): number | null => (!r ? null : m === "base" ? r.base : m === "avans" ? r.avans : r.due);
const totalMetric = (s: Totals, m: Metric): number => (m === "base" ? s.base : m === "avans" ? s.avans : s.payout);

/** «+9,8%» (o'zbekcha vergul bilan). */
function fmtPct(v: number, lang: Lang): string {
  const abs = Math.abs(v);
  const txt = (abs >= 100 ? abs.toFixed(0) : abs.toFixed(1)).replace(".", lang === "en" ? "." : ",");
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${txt}%`;
}
const pctOf = (cur: number | null, base: number | null): number | null => (cur === null || base === null || base === 0 ? null : ((cur - base) / Math.abs(base)) * 100);

function tagOf(r: PayrollReportRow, t: TFn): string {
  if (!r.configured) return t("Sozlanmagan");
  const income = t("tushum {amount}", { amount: fmtNum(r.collected) });
  const tag =
    r.salaryType === "mixed"
      ? `${t("Oklad + {percent}%", { percent: r.percent })} · ${income}`
      : r.salaryType === "foiz"
        ? `${t("Foiz {percent}%", { percent: r.percent })} · ${income}`
        : `${t("Oklad")} · ${fmtNum(r.fixedSalary)}`;
  return r.archived ? `${tag} · ${t("arxivda")}` : tag;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/* ───────────────────────── Katak bo'laklari ───────────────────────── */

const muted = (v: ReactNode) => <span className="tabular-nums text-v2-text-3">{v}</span>;
function money(v: number | null, cls = "text-v2-text"): ReactNode {
  if (v === null) return muted("—");
  if (Math.round(v) === 0) return muted("0");
  return <span className={`tabular-nums ${cls}`}>{fmtNum(v)}</span>;
}
const plus = (v: number) => (Math.round(v) > 0 ? <span className="font-medium tabular-nums text-v2-success">+{fmtNum(v)}</span> : muted("0"));
const minus = (v: number | null) => (v === null ? muted("—") : Math.round(v) > 0 ? <span className="font-medium tabular-nums text-v2-danger">−{fmtNum(v)}</span> : muted("0"));

const TH = "h-9 whitespace-nowrap px-3 text-v2-caption font-medium text-v2-text-2";
const TD = "whitespace-nowrap px-3 py-2.5 align-middle";
/** Birinchi ustun yopishqoq — telefonda raqamlar surilganda ism ko'rinib tursin. */
const FIRST = "sticky left-0 z-[1] min-w-[220px] max-w-[300px]";

function GroupCell({ label, count, open, onToggle, t }: { label: string; count: number; open: boolean; onToggle: () => void; t: TFn }) {
  return (
    <td className={`${FIRST} bg-v2-surface-2 px-3 py-2`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full min-w-0 items-center gap-2 rounded-v2-sm text-left focus-visible:outline-none focus-visible:shadow-v2-focus"
      >
        <ChevronDown className={`size-4 shrink-0 text-v2-text-3 transition-transform ${open ? "" : "-rotate-90"}`} strokeWidth={1.75} aria-hidden />
        <span className="flex size-7 shrink-0 items-center justify-center rounded-v2-md border border-v2-border bg-v2-surface text-v2-text-2" aria-hidden>
          <Building2 className="size-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-v2-text">{label}</span>
          <span className="block text-v2-caption font-normal text-v2-text-2">{t("{n} xodim", { n: count })}</span>
        </span>
      </button>
    </td>
  );
}

function PersonCell({ name, tag }: { name: string; tag: string }) {
  return (
    <td className={`${FIRST} bg-v2-surface py-2.5 pl-9 pr-3`}>
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2" aria-hidden>
          {initialsOf(name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-v2-text">{name}</span>
          <span className="block truncate text-v2-caption font-normal text-v2-text-3" title={tag}>
            {tag}
          </span>
        </span>
      </span>
    </td>
  );
}

function TableFrame({ children, minWidth, stale }: { children: ReactNode; minWidth: number; stale: boolean }) {
  return (
    <section className={`relative overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm transition-opacity ${stale ? "opacity-60" : ""}`}>
      <div className="relative overflow-x-auto">
        <table className="w-full border-collapse text-v2-body" style={{ minWidth }}>
          {children}
        </table>
      </div>
    </section>
  );
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <tbody>
      {Array.from({ length: 6 }, (_, i) => (
        <tr key={i} className="border-b border-v2-border last:border-b-0" aria-hidden>
          {Array.from({ length: cols }, (_, j) => (
            <td key={j} className={`${TD} ${j ? "text-right" : ""}`}>
              <span className={`inline-block h-3 rounded bg-v2-skeleton ${j ? "w-14" : "w-36"}`} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

/* ───────────────────────── Hisobot ───────────────────────── */

export default function OylikAvansReport({ report, author, initialRange }: { report: ReportDef; author: string; initialRange?: MonthRange }) {
  const { t, lang } = useT();
  const f = useReportFmt();
  const today = useToday();
  const branchCtx = useBranch();
  const lastClosed = shiftMonth(today.slice(0, 7), -1);

  const [range, setRange] = useState<MonthRange>(() => initialRange ?? { from: lastClosed, to: lastClosed });
  const [branch, setBranch] = useState("");
  const [method, setMethod] = useState<Method>("");
  const [metric, setMetric] = useState<Metric>("base");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());

  const url = `/api/reports/payroll?${new URLSearchParams({ from: range.from, to: range.to, ...(branch ? { branch } : {}) })}`;
  const q = useReportData<Resp>(url);
  const data = q.data;
  const months = useMemo(() => data?.months ?? [], [data]);
  const ready = !!data && !q.loading;
  const multi = data ? months.length > 1 : range.from !== range.to;
  const maxMonth = data?.maxMonth ?? lastClosed;

  const word = (n: number) => t("{n}-bino", { n });
  const branchList = branchCtx.branches.length ? branchCtx.branches : (data?.branches ?? []);
  const branchOptions = branchList.map((b) => ({ value: String(b.id), label: branchBuildingLabel(b, word) }));
  const branchLabel = (id: number | null) => {
    if (id === null) return t("Oylik filiali ko'rsatilmagan");
    const b = branchList.find((x) => x.id === id) ?? data?.branches.find((x) => x.id === id);
    return b ? branchBuildingLabel(b, word) : `#${id}`;
  };
  const scopeLabel = branch ? branchLabel(Number(branch)) : t("Barcha filiallar");
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Filtrlangan qatorlar va filial guruhlari (bitta oy). Ko'p oyda «Hisoblash usuli» yo'q (rasm 43).
  const single = !multi ? (months[0] ?? null) : null;
  const singleRows = useMemo(() => (single ? single.rows.filter((r) => !method || (r.configured && r.salaryType === method)) : []), [single, method]);
  const groupsOf = <R extends { branchId: number | null; name: string }>(rows: readonly R[]) => {
    const by = new Map<string, { key: string; branchId: number | null; rows: R[] }>();
    for (const r of rows) {
      const key = r.branchId === null ? "none" : String(r.branchId);
      let g = by.get(key);
      if (!g) by.set(key, (g = { key, branchId: r.branchId, rows: [] }));
      g.rows.push(r);
    }
    return [...by.values()]
      .map((g) => ({ ...g, rows: [...g.rows].sort(byName) }))
      .sort((a, b) => (a.branchId ?? Number.MAX_SAFE_INTEGER) - (b.branchId ?? Number.MAX_SAFE_INTEGER));
  };

  const subtitle = (
    <>
      {t("yopilgan oylar, har xodim bo'yicha")} · {t("joriy oy")} —{" "}
      <Link href="/finance-payroll" className="rounded-v2-sm text-v2-brand-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus">
        {t("Moliya → Oylik chiqarish")}
      </Link>
    </>
  );

  const filters = (
    <>
      <V2MonthRange value={range} onChange={setRange} max={maxMonth} />
      <V2Select variant="value" label={t("Filial")} emptyLabel="Barchasi" value={branch} onChange={setBranch} options={branchOptions} searchable={false} />
      {!multi && (
        <V2Select
          variant="value"
          label={t("Hisoblash usuli")}
          emptyLabel="Hammasi"
          value={method}
          onChange={(v) => setMethod(v as Method)}
          options={[
            { value: "fixed", label: "Oklad" },
            { value: "foiz", label: "Foiz" },
            { value: "mixed", label: "Oklad + foiz" },
          ]}
          searchable={false}
        />
      )}
    </>
  );
  const filtersEnd = multi ? (
    // Segmented tugmalari teng (flex-1) — kenglik berilmasa «Qolgan oylik» kesiladi.
    <div className="w-[360px] max-w-full">
      <Segmented
        label={t("Ko'rsatkich")}
        value={metric}
        onChange={(v) => setMetric(v as Metric)}
        options={[
          { value: "base", label: t("Jami oylik") },
          { value: "avans", label: t("Jami avans") },
          { value: "due", label: t("Qolgan oylik") },
        ]}
      />
    </div>
  ) : (
    <span className="hidden text-v2-small text-v2-text-2 sm:inline">{t("Bir necha oy tanlansa — oylar ustun bo'ladi")}</span>
  );

  // Umumiy izohlar: tanlangan oraliq oylik hisobi boshlanishidan oldin; yopilgan (nol-yopish) oy.
  const clampNote =
    data && range.from < data.minMonth ? t("Oylik hisobi {month} dan boshlanadi — undan oldingi oylar hisobotda yo'q.", { month: f.monthTitle(data.minMonth) }) : null;
  const closedMonths = months.filter((m) => m.closed).map((m) => f.monthName(m.month));
  const closedNote = closedMonths.length
    ? t("{months} — yopilgan oy (nol-yopish): oylik eski hisobda hal qilingan, «Qolgan oylik» 0.", { months: closedMonths.join(", ") })
    : null;

  const view = multi
    ? renderMulti()
    : renderSingle();

  return (
    <ReportShell report={report} subtitle={subtitle} filters={filters} filtersEnd={filtersEnd} getDoc={view.getDoc} exportReady={ready && months.length > 0}>
      {q.error ? (
        <ErrorBanner message="Hisobotni yuklab bo'lmadi" onRetry={q.reload} />
      ) : (
        <>
          <KpiStrip loading={!ready} cells={view.kpis} />
          {view.table}
          {ready && view.notes.map((n, i) => <NoteLine key={i}>{n}</NoteLine>)}
        </>
      )}
    </ReportShell>
  );

  /* ─────────── Bitta oy (rasm 41/42) ─────────── */
  function renderSingle(): { kpis: KpiCell[]; table: ReactNode; notes: string[]; getDoc: () => ExportDoc | null } {
    const m = single;
    const tot = totalsOf(singleRows);
    const showTax = tot.tax > 0;
    const next = m ? shiftMonth(m.month, 1) : "";
    const groups = groupsOf(singleRows);
    const cols = 8 + (showTax ? 1 : 0);

    const kpis: KpiCell[] = [
      { key: "base", label: t("Jami oylik"), value: m ? fmtNum(tot.base) : null, unit: t("so'm"), sub: t("{n} xodim · oklad + ulush", { n: tot.configured }) },
      { key: "avans", label: t("Jami avans"), value: m ? fmtNum(tot.avans) : null, unit: t("so'm"), sub: t("oy davomida berilgan") },
      {
        key: "paid",
        label: t("To'langan"),
        value: m ? fmtNum(tot.paid) : null,
        unit: t("so'm"),
        sub: m?.lastPaidDate ? t("{date} · Oylik chiqarishda", { date: f.dayMonth(m.lastPaidDate) }) : t("oylik berilmagan"),
      },
      {
        key: "due",
        label: t("Qolgan oylik"),
        value: m ? fmtNum(tot.payout) : null,
        unit: t("so'm"),
        sub: !m ? undefined : m.closed ? (
          t("yopilgan oy — qoldiq yo'q")
        ) : tot.payout === 0 && tot.debt === 0 ? (
          t("hammasi berilgan")
        ) : (
          <span className="inline-flex max-w-full items-center gap-1 text-v2-warning">
            <TriangleAlert className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="truncate">
              {t("{month}ga izoh bilan o'tdi", { month: f.monthLower(next) })}
              {tot.debt > 0 ? ` · ${t("xodim qarzi: {qarzdorlik}", { qarzdorlik: fmtNum(tot.debt) })}` : ""}
            </span>
          </span>
        ),
      },
    ];

    const numCells = (s: Totals | PayrollReportRow, strong: boolean) => {
      const w = strong ? "font-semibold" : "";
      return (
        <>
          <td className={`${TD} text-right ${w}`}>{money(s.base, strong ? "text-v2-text" : "font-semibold text-v2-text")}</td>
          <td className={`${TD} text-right ${w}`}>{money(s.avans, s.avans > 0 && !strong ? "text-v2-warning" : "text-v2-text")}</td>
          <td className={`${TD} text-right ${w}`}>{money(s.paid)}</td>
          <td className={`${TD} text-right ${w}`}>{money(s.carry, s.carry < 0 ? "text-v2-warning" : "text-v2-text")}</td>
          <td className={`${TD} text-right ${w}`}>{plus(s.bonus)}</td>
          <td className={`${TD} text-right ${w}`}>{minus(s.jarima)}</td>
          {showTax && <td className={`${TD} text-right ${w}`}>{minus(s.tax)}</td>}
        </>
      );
    };
    const dueCell = (r: PayrollReportRow) => (
      <td className={`${TD} text-right`}>
        {r.due === null ? (
          muted("—")
        ) : (
          <>
            <span className={`font-semibold tabular-nums ${r.due < 0 ? "text-v2-danger" : Math.round(r.due) === 0 ? "text-v2-text-3" : "text-v2-text"}`}>{fmtNum(r.due)}</span>
            {m && !m.closed && Math.round(r.due) !== 0 && (
              <span className="block text-v2-caption font-normal text-v2-warning">{t("→ {month}ga o'tdi", { month: f.monthLower(next) })}</span>
            )}
          </>
        )}
      </td>
    );
    const sumDueCell = (s: Totals) => (
      <td className={`${TD} text-right`}>
        <span className="font-semibold tabular-nums text-v2-text">{fmtNum(s.payout)}</span>
        {s.debt > 0 && <span className="block text-v2-caption font-normal text-v2-danger">{t("xodim qarzi: {qarzdorlik}", { qarzdorlik: fmtNum(s.debt) })}</span>}
      </td>
    );

    const head = (
      <thead>
        <tr className="border-b border-v2-border bg-v2-surface-2">
          <th scope="col" className={`${TH} ${FIRST} bg-v2-surface-2 text-left`}>
            {t("Xodim")}
          </th>
          {[t("Jami oylik"), t("Jami avans"), t("To'langan"), t("O'tgan oydan"), t("Bonus"), t("Jarima"), ...(showTax ? [t("Soliq")] : []), t("Qolgan oylik")].map((l) => (
            <th key={l} scope="col" className={`${TH} text-right`}>
              {l}
            </th>
          ))}
        </tr>
      </thead>
    );

    const table = (
      <TableFrame minWidth={showTax ? 1080 : 980} stale={q.stale}>
        {head}
        {!ready ? (
          <SkeletonRows cols={cols} />
        ) : !m || singleRows.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={cols} className="px-4 py-10 text-center text-v2-small text-v2-text-2">
                {!m ? t("Yopilgan oy yo'q — joriy oy Moliya → Oylik chiqarishda") : method ? t("Bu hisoblash usulida xodim yo'q") : t("Bu filialda oylik ro'yxatida xodim yo'q")}
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody>
            {groups.map((g) => {
              const open = !collapsed.has(g.key);
              const gs = totalsOf(g.rows);
              return (
                <Fragment key={g.key}>
                  <tr className="border-b border-v2-border bg-v2-surface-2">
                    <GroupCell label={branchLabel(g.branchId)} count={g.rows.length} open={open} onToggle={() => toggle(g.key)} t={t} />
                    {numCells(gs, true)}
                    {sumDueCell(gs)}
                  </tr>
                  {open &&
                    g.rows.map((r) => (
                      <tr key={r.id} className="border-b border-v2-border bg-v2-surface">
                        <PersonCell name={r.name} tag={tagOf(r, t)} />
                        {numCells(r, false)}
                        {dueCell(r)}
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        )}
        {ready && m && singleRows.length > 0 && (
          <tfoot>
            <tr className="border-t border-v2-border bg-v2-surface-2">
              <td className={`${TD} ${FIRST} bg-v2-surface-2 font-semibold text-v2-text`}>{t("Jami · {n} xodim", { n: tot.n })}</td>
              {numCells(tot, true)}
              {sumDueCell(tot)}
            </tr>
          </tfoot>
        )}
      </TableFrame>
    );

    const notes: string[] = [];
    if (m) {
      notes.push(
        showTax
          ? t("Qolgan oylik = jami oylik − avans − to'langan + o'tgan oydan + bonus − jarima − soliq. Keyingi oyga o'tgani Oylik chiqarishda «O'tgan oydan» ustunida chiqadi.")
          : t("Qolgan oylik = jami oylik − avans − to'langan + o'tgan oydan + bonus − jarima. Keyingi oyga o'tgani Oylik chiqarishda «O'tgan oydan» ustunida chiqadi."),
      );
      const given = tot.avans + tot.paid;
      if (branch || method) {
        // Bitta filial yoki usul — «Kirim va chiqim» kassa filiali bo'yicha, solishtirib bo'lmaydi.
        notes.push(t("Avans + to'langan = {amount} so'm — shu xodimlarga, qaysi kassadan berilganidan qat'i nazar.", { amount: fmtNum(given) }));
      } else {
        notes.push(
          Math.round(given) === Math.round(m.cashflow)
            ? t("Avans + to'langan = {amount} so'm — «Kirim va chiqim» hisobotidagi {month} «Avans» va «Oylik» chiqimlari bilan bir xil.", { amount: fmtNum(given), month: f.monthLower(m.month) })
            : t(
                "Avans + to'langan = {amount} so'm. «Kirim va chiqim»da {month} «Avans» va «Oylik» chiqimlari — {cash} so'm: u pulni berilgan sanasi bo'yicha sanaydi, bu hisobot — qaysi oy hisobiga va qaysi xodimga yozilgani bo'yicha.",
                { amount: fmtNum(given), month: f.monthLower(m.month), cash: fmtNum(m.cashflow) },
              ),
        );
      }
      notes.push(t("«Jami oylik» — oklad va ulush; Oylik chiqarish sahifasidagi «Jami oylik» bunga bonus va jarimani ham qo'shadi."));
    }
    if (closedNote) notes.push(closedNote);
    if (clampNote) notes.push(clampNote);

    function getDoc(): ExportDoc | null {
      if (!ready || !m) return null;
      const columns: ExportColumn[] = [
        { label: t("Xodim") },
        { label: t("Hisoblash") },
        { label: t("Jami oylik"), numeric: true },
        { label: t("Jami avans"), numeric: true },
        { label: t("To'langan"), numeric: true },
        { label: t("O'tgan oydan"), numeric: true },
        { label: t("Bonus"), numeric: true },
        { label: t("Jarima"), numeric: true },
        ...(showTax ? [{ label: t("Soliq"), numeric: true }] : []),
        { label: t("Qolgan oylik"), numeric: true },
      ];
      const line = (label: string, extra: string, s: Totals | PayrollReportRow, due: number | null): Cell[] => [
        label,
        extra,
        s.base,
        s.avans,
        s.paid,
        s.carry,
        s.bonus,
        s.jarima,
        ...(showTax ? [s.tax] : []),
        due,
      ];
      const sections: ExportSection[] = groups.map((g) => {
        const gs = totalsOf(g.rows);
        return {
          title: `${branchLabel(g.branchId)} · ${t("{n} xodim", { n: g.rows.length })}`,
          columns,
          rows: g.rows.map((r) => line(r.name, tagOf(r, t), r, r.due)),
          total: line(t("Jami"), "", gs, gs.payout),
        };
      });
      if (groups.length > 1) {
        sections.push({
          title: t("Filiallar bo'yicha"),
          columns: [{ label: t("Filial") }, ...columns.slice(1)],
          rows: groups.map((g) => {
            const gs = totalsOf(g.rows);
            return line(branchLabel(g.branchId), t("{n} xodim", { n: g.rows.length }), gs, gs.payout);
          }),
          total: line(t("Jami · {n} xodim", { n: tot.n }), "", tot, tot.payout),
        });
      }
      return {
        title: t("{name} hisoboti", { name: t(report.title) }),
        fileBase: `${fileSafe(t(report.title))}-${m.month}`,
        center: t(CENTER_NAME),
        branchLabel: scopeLabel,
        dateLabel: f.fullDate(today),
        author,
        filters: [f.monthTitle(m.month), scopeLabel, method ? t(method === "fixed" ? "Oklad" : method === "foiz" ? "Foiz" : "Oklad + foiz") : t("Hammasi")].join(" · "),
        kpis: [
          { label: t("Jami oylik"), value: `${fmtNum(tot.base)} ${t("so'm")}` },
          { label: t("Jami avans"), value: `${fmtNum(tot.avans)} ${t("so'm")}` },
          { label: t("To'langan"), value: `${fmtNum(tot.paid)} ${t("so'm")}` },
          { label: t("Qolgan oylik"), value: `${fmtNum(tot.payout)} ${t("so'm")}` },
        ],
        sections,
        notes,
        footer: DOC_FOOTER,
      };
    }

    return { kpis, table, notes, getDoc };
  }

  /* ─────────── Bir necha oy (rasm 43/44) ─────────── */
  function renderMulti(): { kpis: KpiCell[]; table: ReactNode; notes: string[]; getDoc: () => ExportDoc | null } {
    const keys = months.map((m) => m.month);
    const first = keys[0] ?? range.from;
    const last = keys[keys.length - 1] ?? range.to;
    const n = keys.length || 1;
    const multiYear = first.slice(0, 4) !== last.slice(0, 4);
    const colTitle = (mk: string) => (multiYear ? `${f.monthShort(mk)} ${mk.slice(2, 4)}` : f.monthName(mk));
    const monthTotals = months.map((m) => totalsOf(m.rows));

    // Xodim × oy. Ism, filial va yorliq — xodim bor eng oxirgi oydan.
    type Person = { id: number; name: string; branchId: number | null; tag: string; by: Map<string, PayrollReportRow> };
    const people = new Map<number, Person>();
    for (const m of months) {
      for (const r of m.rows) {
        let p = people.get(r.id);
        if (!p) people.set(r.id, (p = { id: r.id, name: r.name, branchId: r.branchId, tag: "", by: new Map() }));
        p.by.set(m.month, r);
        p.name = r.name;
        p.branchId = r.branchId;
        p.tag = tagOf(r, t);
      }
    }
    const groups = groupsOf([...people.values()]);
    const agg = (vals: (number | null)[]): number | null => {
      if (metric === "due") return vals[vals.length - 1] ?? null;
      const xs = vals.filter((v): v is number => v !== null);
      return xs.length ? xs.reduce((s, v) => s + v, 0) : null;
    };
    const personVals = (p: Person) => keys.map((k) => rowMetric(p.by.get(k), metric));
    const groupVals = (ps: readonly Person[]) => keys.map((k) => totalMetric(totalsOf(ps.map((p) => p.by.get(k)).filter((r): r is PayrollReportRow => !!r)), metric));
    const allVals = monthTotals.map((s) => totalMetric(s, metric));

    const baseBy = monthTotals.map((s) => s.base);
    const sumBase = baseBy.reduce((s, v) => s + v, 0);
    const lastBase = baseBy[baseBy.length - 1] ?? 0;
    const prevBase = baseBy.length > 1 ? baseBy[baseBy.length - 2] : null;
    const lastPct = pctOf(lastBase, prevBase);
    const givenBy = monthTotals.map((s) => s.avans + s.paid);
    const lastTotals = monthTotals[monthTotals.length - 1];

    const kpis: KpiCell[] = [
      {
        key: "base",
        label: t("Jami oylik · {n} oy", { n }),
        value: data ? fmtNum(sumBase) : null,
        unit: t("so'm"),
        sub: `${f.monthLower(first)} – ${f.monthLower(last)} · ${t("oklad + ulush")}`,
        spark: baseBy.length > 1 ? baseBy : undefined,
      },
      {
        key: "last",
        label: f.monthName(last),
        value: data ? fmtNum(lastBase) : null,
        unit: t("so'm"),
        sub: prevBase === null ? t("jami oylik") : `${t("{month}ga nisbatan", { month: f.monthLower(keys[keys.length - 2]) })} ${lastPct === null ? "—" : fmtPct(lastPct, lang)}`,
      },
      { key: "given", label: t("Kassadan chiqqan"), value: data ? fmtNum(givenBy.reduce((s, v) => s + v, 0)) : null, unit: t("so'm"), sub: t("avans + to'langan · {n} oy", { n }) },
      { key: "left", label: t("Oy oxirida qolgan"), value: data && lastTotals ? fmtNum(lastTotals.payout) : null, unit: t("so'm"), sub: `${f.monthLower(last)} · ${scopeLabel}` },
    ];

    const aggTitle = metric === "due" ? t("Oxirgi oyda") : t("{n} oyda", { n });
    const pctTitle = t("{month}ga nisbatan", { month: f.monthName(first) });
    const cols = 1 + keys.length + 2;
    const valCell = (v: number | null, strong: boolean) => (
      <td className={`${TD} text-right ${strong ? "font-semibold" : ""}`}>{money(v, v !== null && v < 0 ? "text-v2-danger" : "text-v2-text")}</td>
    );
    const tailCells = (vals: (number | null)[], strong: boolean) => {
      const a = agg(vals);
      const p = pctOf(vals[vals.length - 1] ?? null, vals[0] ?? null);
      return (
        <>
          <td className={`${TD} text-right font-semibold`}>{money(a)}</td>
          <td className={`${TD} text-right ${strong ? "font-semibold" : ""}`}>{p === null ? muted("—") : <span className="tabular-nums text-v2-text-2">{fmtPct(p, lang)}</span>}</td>
        </>
      );
    };

    const table = (
      <TableFrame minWidth={Math.max(720, 360 + keys.length * 130)} stale={q.stale}>
        <thead>
          <tr className="border-b border-v2-border bg-v2-surface-2">
            <th scope="col" className={`${TH} ${FIRST} bg-v2-surface-2 text-left`}>
              {t("Xodim")}
            </th>
            {keys.map((k) => (
              <th key={k} scope="col" className={`${TH} text-right`}>
                {colTitle(k)}
              </th>
            ))}
            <th scope="col" className={`${TH} text-right`}>
              {aggTitle}
            </th>
            <th scope="col" className={`${TH} text-right`}>
              {pctTitle}
            </th>
          </tr>
        </thead>
        {!ready ? (
          <SkeletonRows cols={cols} />
        ) : people.size === 0 ? (
          <tbody>
            <tr>
              <td colSpan={cols} className="px-4 py-10 text-center text-v2-small text-v2-text-2">
                {t("Bu filialda oylik ro'yxatida xodim yo'q")}
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody>
            {groups.map((g) => {
              const open = !collapsed.has(g.key);
              const gv = groupVals(g.rows);
              return (
                <Fragment key={g.key}>
                  <tr className="border-b border-v2-border bg-v2-surface-2">
                    <GroupCell label={branchLabel(g.branchId)} count={g.rows.length} open={open} onToggle={() => toggle(g.key)} t={t} />
                    {gv.map((v, i) => (
                      <Fragment key={keys[i]}>{valCell(v, true)}</Fragment>
                    ))}
                    {tailCells(gv, true)}
                  </tr>
                  {open &&
                    g.rows.map((p) => {
                      const pv = personVals(p);
                      return (
                        <tr key={p.id} className="border-b border-v2-border bg-v2-surface">
                          <PersonCell name={p.name} tag={p.tag} />
                          {pv.map((v, i) => (
                            <Fragment key={keys[i]}>{valCell(v, false)}</Fragment>
                          ))}
                          {tailCells(pv, false)}
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        )}
        {ready && people.size > 0 && (
          <tfoot>
            <tr className="border-t border-v2-border bg-v2-surface-2">
              <td className={`${TD} ${FIRST} bg-v2-surface-2 font-semibold text-v2-text`}>{t("Jami · {n} xodim", { n: people.size })}</td>
              {allVals.map((v, i) => (
                <Fragment key={keys[i]}>{valCell(v, true)}</Fragment>
              ))}
              {tailCells(allVals, true)}
            </tr>
          </tfoot>
        )}
      </TableFrame>
    );

    const notes: string[] = [t("Har oy — yopilgan oy yakuni. Ko'rsatkich almashtirilsa, jadval shu ustunlar bilan qayta chiqadi.")];
    if (metric === "due") {
      notes.push(t("«Qolgan oylik» oylar bo'yicha qo'shilmaydi — har oy qoldig'i keyingi oyga o'tadi; shuning uchun yakuniy ustun — oxirgi oy qoldig'i, jami qatorlarda — kassadan chiqadigan qism."));
    }
    if (months.length) {
      const list = months.map((m, i) => `${f.monthLower(m.month)} ${fmtNum(givenBy[i])}`).join(" · ");
      const same = months.every((m, i) => Math.round(m.cashflow) === Math.round(givenBy[i]));
      notes.push(
        branch
          ? t("Kassadan chiqqan oylik va avans oylar bo'yicha: {list} — shu xodimlarga, qaysi kassadan berilganidan qat'i nazar.", { list })
          : same
          ? t("Kassadan chiqqan oylik va avans oylar bo'yicha: {list} — «Kirim va chiqim» bilan bir xil.", { list })
          : t("Kassadan chiqqan oylik va avans oylar bo'yicha (qaysi oy hisobiga yozilgani): {list}. «Kirim va chiqim»da (berilgan sanasi bo'yicha): {cash}.", {
              list,
              cash: months.map((m) => `${f.monthLower(m.month)} ${fmtNum(m.cashflow)}`).join(" · "),
            }),
      );
    }
    if (closedNote) notes.push(closedNote);
    if (clampNote) notes.push(clampNote);

    function getDoc(): ExportDoc | null {
      if (!ready || months.length === 0) return null;
      const columns: ExportColumn[] = [{ label: t("Xodim") }, ...keys.map((k) => ({ label: colTitle(k), numeric: true })), { label: aggTitle, numeric: true }, { label: pctTitle }];
      const pctCell = (vals: (number | null)[]): Cell => {
        const p = pctOf(vals[vals.length - 1] ?? null, vals[0] ?? null);
        return p === null ? null : fmtPct(p, lang);
      };
      const line = (label: string, vals: (number | null)[]): Cell[] => [label, ...vals, agg(vals), pctCell(vals)];
      const sections: ExportSection[] = groups.map((g) => ({
        title: `${branchLabel(g.branchId)} · ${t("{n} xodim", { n: g.rows.length })}`,
        columns,
        rows: g.rows.map((p) => line(p.name, personVals(p))),
        total: line(t("Jami"), groupVals(g.rows)),
      }));
      if (groups.length > 1) {
        sections.push({
          title: t("Filiallar bo'yicha"),
          columns: [{ label: t("Filial") }, ...columns.slice(1)],
          rows: groups.map((g) => line(branchLabel(g.branchId), groupVals(g.rows))),
          total: line(t("Jami · {n} xodim", { n: people.size }), allVals),
        });
      }
      const metricLabel = metric === "base" ? t("Jami oylik") : metric === "avans" ? t("Jami avans") : t("Qolgan oylik");
      return {
        title: t("{name} hisoboti", { name: t(report.title) }),
        fileBase: `${fileSafe(t(report.title))}-${first}-${last}`,
        center: t(CENTER_NAME),
        branchLabel: scopeLabel,
        dateLabel: f.fullDate(today),
        author,
        filters: [monthRangeLabel({ from: first, to: last }, lang), scopeLabel, metricLabel].join(" · "),
        kpis: kpis.map((k) => ({ label: k.label, value: k.value === null ? "—" : `${k.value} ${t("so'm")}` })),
        sections,
        notes,
        footer: DOC_FOOTER,
      };
    }

    return { kpis, table, notes, getDoc };
  }
}
