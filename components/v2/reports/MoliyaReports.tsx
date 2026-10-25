"use client";

import { useMemo, useState } from "react";
import { useBranch } from "@/components/shared/BranchContext";
import { useLang, useT } from "@/components/shared/Language";
import { Segmented } from "@/components/v2/form/fields";
import { fmtMln } from "@/components/v2/finance/analyticsShared";
import V2Select from "@/components/v2/ui/V2Select";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { branchBuildingLabel } from "@/lib/branchPools";
import type { CashboxName } from "@/lib/cashboxes";
import { addMoney, emptyMoney, isReversal, moneyTotals, monthlyMoney, type MoneyTotals, type SummaryRow } from "@/lib/financeAnalytics";
import type { ReportDef } from "@/lib/reportsCatalog";
import ReportBarChart, { type ChartPoint } from "./ReportBarChart";
import { CENTER_NAME, DOC_FOOTER, useReportData, useReportFmt, useToday } from "./reportHooks";
import { fileSafe, fmtNum, monthEnd, monthRangeLabel, monthsBetween, shiftMonth, type MonthRange } from "./reportFormat";
import type { ExportDoc } from "./reportExport";
import { ErrorBanner, KpiStrip, NoteLine, ReportShell, ReportTable, SignedNum, type TableCol } from "./reportUi";
import V2MonthRange from "./V2MonthRange";

// YANGI VERSIYA — HISOBOTLAR → MOLIYA: «Kirim va chiqim» va «To'lov turlari» (katalog
// kartalari, 25.10.2026; batafsil rasm yo'q — «Kelgan va ketgan» qolipida). Raqamlar Moliya
// analitikasi bilan BIR hisob: /api/transactions/summary + lib/financeAnalytics.ts
// (bekor qilish yozuvi — teskari amal). Filial — kassa filiali (bino), Kassa — tanlov.

const REV_SUFFIX = /\s*\(bekor qilindi\)\s*$/;
const baseCategory = (c: string | undefined) => (c || "").replace(REV_SUFFIX, "").trim() || "—";
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");

/** Oylar oralig'i, filial va kassa — ikkala moliya hisobotida bir xil. */
function useMoneyFilters() {
  const today = useToday();
  const cur = today.slice(0, 7);
  const branch = useBranch();
  const { t } = useT();
  const [range, setRange] = useState<MonthRange>({ from: shiftMonth(cur, -5), to: cur });
  const [branchId, setBranchId] = useState("");
  const [cashboxId, setCashboxId] = useState("");
  const from = `${range.from}-01`;
  const to = monthEnd(range.to) > today ? today : monthEnd(range.to);
  const cash = useReportData<{ cashboxes: CashboxName[] }>("/api/cashboxes?names=1");
  const cashboxes = useMemo(() => cash.data?.cashboxes ?? [], [cash.data]);
  const cbSet = useMemo<Set<number> | null>(() => {
    if (cashboxId) return new Set([Number(cashboxId)]);
    if (branchId) return new Set(cashboxes.filter((c) => c.branchId === Number(branchId)).map((c) => c.id));
    return null;
  }, [cashboxId, branchId, cashboxes]);
  const word = (n: number) => t("{n}-bino", { n });
  const branchOptions = branch.branches.map((b) => ({ value: String(b.id), label: branchBuildingLabel(b, word) }));
  const cashboxOptions = cashboxes
    .filter((c) => !branchId || c.branchId === Number(branchId))
    .map((c) => ({ value: String(c.id), label: c.name, hint: c.archived ? t("arxiv") : undefined }));
  const scopeName = cashboxId
    ? (cashboxes.find((c) => String(c.id) === cashboxId)?.name ?? "")
    : branchId
      ? (branchOptions.find((b) => b.value === branchId)?.label ?? "")
      : t("Barcha filiallar");
  const months = monthsBetween(range.from, range.to > cur ? cur : range.to);
  return { today, cur, range, setRange, branchId, setBranchId, cashboxId, setCashboxId, from, to, cash, cashboxes, cbSet, branchOptions, cashboxOptions, scopeName, months };
}

function MoneyFilters({ s }: { s: ReturnType<typeof useMoneyFilters> }) {
  const { t } = useT();
  return (
    <>
      <V2MonthRange value={s.range} onChange={s.setRange} max={s.cur} />
      <V2Select
        variant="value"
        label={t("Filial")}
        emptyLabel="Barchasi"
        value={s.branchId}
        onChange={(v) => {
          s.setBranchId(v);
          s.setCashboxId("");
        }}
        options={s.branchOptions}
        searchable={false}
      />
      <V2Select variant="value" label={t("Kassa")} emptyLabel="Barchasi" value={s.cashboxId} onChange={s.setCashboxId} options={s.cashboxOptions} />
    </>
  );
}

/* ───────────────────────── Kirim va chiqim ───────────────────────── */

type KcView = "months" | "cashboxes" | "categories";

export function KirimChiqimReport({ report, author }: { report: ReportDef; author: string }) {
  const { t } = useT();
  const [lang] = useLang();
  const f = useReportFmt();
  const s = useMoneyFilters();
  const [view, setView] = useState<KcView>("months");
  const sum = useReportData<{ rows: SummaryRow[] }>(`/api/transactions/summary?${new URLSearchParams({ groupBy: "month,sign,category,cashbox", from: s.from, to: s.to })}`);
  const ready = !!sum.data && !!s.cash.data;
  const rows = useMemo(() => sum.data?.rows ?? [], [sum.data]);

  const monthly = useMemo(() => monthlyMoney(rows, s.months, s.cbSet), [rows, s.months, s.cbSet]);
  const totals = useMemo(() => moneyTotals(rows, s.cbSet), [rows, s.cbSet]);
  const byCashbox = useMemo(() => {
    const by = new Map<number, MoneyTotals>();
    for (const r of rows) {
      const id = Number(r.cashbox);
      if (s.cbSet && !s.cbSet.has(id)) continue;
      let m = by.get(id);
      if (!m) by.set(id, (m = emptyMoney()));
      addMoney(m, r);
    }
    return [...by.entries()]
      .map(([id, m]) => ({ id, name: s.cashboxes.find((c) => c.id === id)?.name ?? `#${id}`, ...m }))
      .filter((x) => x.income || x.expense)
      .sort((a, b) => b.income + b.expense - (a.income + a.expense));
  }, [rows, s.cbSet, s.cashboxes]);
  const expenseCats = useMemo(() => {
    const by = new Map<string, number>();
    for (const r of rows) {
      if (s.cbSet && !s.cbSet.has(Number(r.cashbox))) continue;
      const a = r.amount;
      if (!a) continue;
      const rev = isReversal(r.category);
      // addMoney qoidasi: manfiy oddiy yozuv — chiqim; musbat bekor qilish — chiqimni kamaytiradi.
      if (a < 0 && !rev) by.set(baseCategory(r.category), (by.get(baseCategory(r.category)) ?? 0) - a);
      else if (a > 0 && rev) by.set(baseCategory(r.category), (by.get(baseCategory(r.category)) ?? 0) - a);
    }
    return [...by.entries()].map(([name, amount]) => ({ name, amount })).filter((x) => Math.round(x.amount) !== 0).sort((a, b) => b.amount - a.amount);
  }, [rows, s.cbSet]);
  const top = expenseCats[0] ?? null;
  const partial = s.months.length > 0 && s.months[s.months.length - 1] === s.cur && s.to < monthEnd(s.cur);

  const points: ChartPoint[] = s.months.map((m, i) => ({
    key: m,
    tick: `${f.monthShort(m)}${partial && i === s.months.length - 1 ? "*" : ""}`,
    title: f.monthTitle(m),
    values: [monthly[i]?.income ?? 0, monthly[i]?.expense ?? 0],
    partial: partial && i === s.months.length - 1,
    extra: { value: fmtNum(monthly[i]?.net ?? 0), label: t("sof foyda, so'm"), tone: (monthly[i]?.net ?? 0) < 0 ? "danger" : undefined },
  }));
  const mlnLabel = (v: number) => (v === 0 ? "0" : fmtMln(v, lang).replace(/[,.]0$/, ""));
  const monthLabel = (m: string, i: number) => (partial && i === s.months.length - 1 ? f.partialMonth(m, s.to) : f.monthName(m));

  type MonthRow = { key: string; label: string } & MoneyTotals;
  const monthRows: MonthRow[] = s.months.map((m, i) => ({ key: m, label: monthLabel(m, i), ...(monthly[i] ?? emptyMoney()) }));
  const moneyCols = <R extends MoneyTotals>(first: TableCol<R>): TableCol<R>[] => [
    first,
    { key: "i", label: t("Kirim, so'm"), align: "right", render: (r) => fmtNum(r.income) },
    { key: "e", label: t("Chiqim, so'm"), align: "right", render: (r) => fmtNum(r.expense) },
    { key: "n", label: t("Sof foyda, so'm"), align: "right", render: (r) => <SignedNum value={r.net} text={fmtNum(r.net)} /> },
  ];
  const totalCells = [t("Jami"), fmtNum(totals.income), fmtNum(totals.expense), <SignedNum key="n" value={totals.net} text={fmtNum(totals.net)} />];

  function getDoc(): ExportDoc | null {
    if (!ready) return null;
    const money = (label: string) => [{ label }, { label: t("Kirim, so'm"), numeric: true }, { label: t("Chiqim, so'm"), numeric: true }, { label: t("Sof foyda, so'm"), numeric: true }];
    return {
      title: t("{name} hisoboti", { name: t(report.title) }),
      fileBase: `${fileSafe(t(report.title))}-${s.to}`,
      center: t(CENTER_NAME),
      branchLabel: s.scopeName,
      dateLabel: f.fullDate(s.today),
      author,
      filters: [monthRangeLabel(s.range, lang), s.scopeName].join(" · "),
      kpis: [
        { label: t("Kirim"), value: `${fmtNum(totals.income)} ${t("so'm")}` },
        { label: t("Chiqim"), value: `${fmtNum(totals.expense)} ${t("so'm")}` },
        { label: t("Sof foyda"), value: `${fmtNum(totals.net)} ${t("so'm")}` },
      ],
      sections: [
        { title: t("Oylar bo'yicha"), columns: money(t("Oy")), rows: monthRows.map((r) => [r.label, r.income, r.expense, r.net]), total: [t("Jami"), totals.income, totals.expense, totals.net] },
        { title: t("Kassalar bo'yicha"), columns: money(t("Kassa")), rows: byCashbox.map((r) => [r.name, r.income, r.expense, r.net]) },
        {
          title: t("Xarajat toifalari"),
          columns: [{ label: t("Toifa") }, { label: t("Summa, so'm"), numeric: true }, { label: t("Ulush") }],
          rows: expenseCats.map((c) => [c.name, c.amount, pct(c.amount, totals.expense)]),
          total: [t("Jami"), totals.expense, "100%"],
        },
      ],
      notes: [t("Moliya analitikasi bilan bir xil hisob: bekor qilingan amal teskari yozuv bilan ayriladi.")],
      footer: DOC_FOOTER,
    };
  }

  const loading = !ready && !sum.error;
  return (
    <ReportShell
      report={report}
      subtitle={s.scopeName}
      getDoc={getDoc}
      exportReady={ready && !sum.stale}
      filters={<MoneyFilters s={s} />}
      filtersEnd={
        <div className="w-[400px] max-w-full">
          <Segmented
            value={view}
            onChange={(v) => setView(v as KcView)}
            label={t("Jadval")}
            options={[
              { value: "months", label: t("Oylar") },
              { value: "cashboxes", label: t("Kassalar") },
              { value: "categories", label: t("Xarajat toifalari") },
            ]}
          />
        </div>
      }
    >
      {(sum.error || s.cash.error) && <ErrorBanner message="Hisobot yuklanmadi" onRetry={() => (sum.error ? sum.reload() : s.cash.reload())} />}
      <div className={sum.stale ? "opacity-60 transition-opacity" : ""}>
        <KpiStrip
          loading={loading}
          cells={[
            { key: "i", label: t("Kirim"), value: fmtNum(totals.income), unit: t("so'm"), sub: monthRangeLabel(s.range, lang) },
            { key: "e", label: t("Chiqim"), value: fmtNum(totals.expense), unit: t("so'm"), sub: s.scopeName },
            { key: "n", label: t("Sof foyda"), value: fmtNum(totals.net), unit: t("so'm"), tone: totals.net < 0 ? "danger" : undefined, sub: t("kirim − chiqim") },
            { key: "t", label: t("Eng katta xarajat"), value: top ? fmtNum(top.amount) : null, unit: t("so'm"), sub: top ? `${top.name} · ${pct(top.amount, totals.expense)}` : t("xarajat yo'q") },
          ]}
        />
      </div>
      <ReportBarChart
        title={t("Oyma-oy")}
        subtitle={[t("mln so'm"), partial ? t("* {month} hali tugamagan", { month: f.monthLower(s.cur) }) : ""].filter(Boolean).join(" · ")}
        series={[t("Kirim"), t("Chiqim")]}
        points={points}
        format={mlnLabel}
        loading={loading}
        stale={sum.stale}
        emptyText={t("Bu davrda kirim yoki chiqim yo'q")}
      />
      <div className={sum.stale ? "opacity-60 transition-opacity" : ""}>
        {view === "months" ? (
          <ReportTable cols={moneyCols<MonthRow>({ key: "m", label: t("Oy"), render: (r) => r.label })} rows={monthRows} rowKey={(r) => r.key} loading={loading} empty={t("Bu davrda yozuv yo'q")} total={totalCells} minWidth={560} />
        ) : view === "cashboxes" ? (
          <ReportTable
            cols={moneyCols<(typeof byCashbox)[number]>({ key: "c", label: t("Kassa"), render: (r) => <span className="font-medium text-v2-text">{r.name}</span> })}
            rows={byCashbox}
            rowKey={(r) => r.id}
            loading={loading}
            empty={t("Bu davrda yozuv yo'q")}
            total={totalCells}
            minWidth={560}
          />
        ) : (
          <ReportTable
            cols={[
              { key: "c", label: t("Toifa"), render: (r) => <span className="font-medium text-v2-text">{r.name}</span> },
              { key: "a", label: t("Summa, so'm"), align: "right", render: (r) => fmtNum(r.amount) },
              { key: "p", label: t("Ulush"), align: "right", render: (r) => <span className="text-v2-text-2">{pct(r.amount, totals.expense)}</span> },
            ]}
            rows={expenseCats}
            rowKey={(r) => r.name}
            loading={loading}
            empty={t("Bu davrda xarajat yo'q")}
            total={[t("Jami"), fmtNum(totals.expense), "100%"]}
            minWidth={480}
          />
        )}
      </div>
      <NoteLine>{t("Moliya analitikasi bilan bir xil hisob: bekor qilingan amal teskari yozuv bilan ayriladi.")}</NoteLine>
    </ReportShell>
  );
}

/* ───────────────────────── To'lov turlari ───────────────────────── */

type TtView = "types" | "months";

export function TolovTurlariReport({ report, author }: { report: ReportDef; author: string }) {
  const { t } = useT();
  const [lang] = useLang();
  const f = useReportFmt();
  const s = useMoneyFilters();
  const { methods } = usePaymentMethods();
  const [view, setView] = useState<TtView>("types");
  const sum = useReportData<{ rows: SummaryRow[] }>(`/api/transactions/summary?${new URLSearchParams({ groupBy: "month,method,sign,category,cashbox", from: s.from, to: s.to })}`);
  const ready = !!sum.data && !!s.cash.data;
  const rows = useMemo(() => sum.data?.rows ?? [], [sum.data]);
  const nameOf = (key: string) => methods.find((m) => m.key === key)?.name ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : t("Ko'rsatilmagan"));

  // Faqat tushum (kirim tomoni): addMoney qoidasi, to'lov turi bo'yicha.
  const { byMethod, byMonth, total } = useMemo(() => {
    const per = new Map<string, MoneyTotals>();
    const perMonth = new Map<string, Map<string, MoneyTotals>>();
    for (const r of rows) {
      if (s.cbSet && !s.cbSet.has(Number(r.cashbox))) continue;
      const key = r.method || "";
      let m = per.get(key);
      if (!m) per.set(key, (m = emptyMoney()));
      addMoney(m, r);
      if (r.month) {
        let mm = perMonth.get(r.month);
        if (!mm) perMonth.set(r.month, (mm = new Map()));
        let x = mm.get(key);
        if (!x) mm.set(key, (x = emptyMoney()));
        addMoney(x, r);
      }
    }
    const list = [...per.entries()].map(([key, m]) => ({ key, income: m.income })).filter((x) => Math.round(x.income) !== 0).sort((a, b) => b.income - a.income);
    return { byMethod: list, byMonth: perMonth, total: list.reduce((a, x) => a + x.income, 0) };
  }, [rows, s.cbSet]);

  const methodKeys = byMethod.map((m) => m.key);
  const partial = s.months.length > 0 && s.months[s.months.length - 1] === s.cur && s.to < monthEnd(s.cur);
  const monthLabel = (m: string, i: number) => (partial && i === s.months.length - 1 ? f.partialMonth(m, s.to) : f.monthName(m));
  const incomeOf = (month: string, key: string) => byMonth.get(month)?.get(key)?.income ?? 0;

  function getDoc(): ExportDoc | null {
    if (!ready) return null;
    return {
      title: t("{name} hisoboti", { name: t(report.title) }),
      fileBase: `${fileSafe(t(report.title))}-${s.to}`,
      center: t(CENTER_NAME),
      branchLabel: s.scopeName,
      dateLabel: f.fullDate(s.today),
      author,
      filters: [monthRangeLabel(s.range, lang), s.scopeName].join(" · "),
      kpis: [{ label: t("Jami tushum"), value: `${fmtNum(total)} ${t("so'm")}` }, ...byMethod.slice(0, 3).map((m) => ({ label: nameOf(m.key), value: pct(m.income, total) }))],
      sections: [
        {
          title: t("To'lov turlari"),
          columns: [{ label: t("To'lov turi") }, { label: t("Summa, so'm"), numeric: true }, { label: t("Ulush") }],
          rows: byMethod.map((m) => [nameOf(m.key), m.income, pct(m.income, total)]),
          total: [t("Jami"), total, "100%"],
        },
        {
          title: t("Oylar bo'yicha"),
          columns: [{ label: t("Oy") }, ...methodKeys.map((k) => ({ label: nameOf(k), numeric: true })), { label: t("Jami"), numeric: true }],
          rows: s.months.map((m, i) => [monthLabel(m, i), ...methodKeys.map((k) => incomeOf(m, k)), methodKeys.reduce((a, k) => a + incomeOf(m, k), 0)]),
          total: [t("Jami"), ...byMethod.map((m) => m.income), total],
        },
      ],
      notes: [t("Faqat tushum (kirim) hisoblanadi; bekor qilingan to'lovlar ayrilgan.")],
      footer: DOC_FOOTER,
    };
  }

  const loading = !ready && !sum.error;
  type MonthRow = { key: string; label: string };
  return (
    <ReportShell
      report={report}
      subtitle={s.scopeName}
      getDoc={getDoc}
      exportReady={ready && !sum.stale}
      filters={<MoneyFilters s={s} />}
      filtersEnd={
        <div className="w-[240px] max-w-full">
          <Segmented
            value={view}
            onChange={(v) => setView(v as TtView)}
            label={t("Jadval")}
            options={[
              { value: "types", label: t("Turlar") },
              { value: "months", label: t("Oylar") },
            ]}
          />
        </div>
      }
    >
      {(sum.error || s.cash.error) && <ErrorBanner message="Hisobot yuklanmadi" onRetry={() => (sum.error ? sum.reload() : s.cash.reload())} />}
      <div className={sum.stale ? "opacity-60 transition-opacity" : ""}>
        <KpiStrip
          loading={loading}
          cells={[
            { key: "all", label: t("Jami tushum"), value: fmtNum(total), unit: t("so'm"), sub: monthRangeLabel(s.range, lang) },
            ...[0, 1, 2].map((i) => {
              const m = byMethod[i];
              return { key: `m${i}`, label: m ? nameOf(m.key) : "—", value: m ? pct(m.income, total) : null, sub: m ? `${fmtNum(m.income)} ${t("so'm")}` : undefined };
            }),
          ]}
        />
      </div>

      {/* Ulushlar — gorizontal chiziqlar */}
      <section className={`rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm ${sum.stale ? "opacity-60" : ""}`} aria-label={t("Ulushlar")}>
        <h2 className="text-v2-section text-v2-text">{t("Ulushlar")}</h2>
        <p className="mt-0.5 text-v2-small text-v2-text-2">{t("tushum qaysi to'lov turida kelgani")}</p>
        {loading ? (
          <div className="mt-4 space-y-3" aria-hidden>
            {[80, 50, 30].map((w) => (
              <div key={w} className="h-3 rounded bg-v2-skeleton" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : byMethod.length === 0 ? (
          <p className="mt-4 text-v2-small text-v2-text-2">{t("Bu davrda tushum yo'q")}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {byMethod.map((m) => (
              <li key={m.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
                <span className="truncate text-v2-body text-v2-text">{nameOf(m.key)}</span>
                <span className="h-2 overflow-hidden rounded-full bg-v2-hover" aria-hidden>
                  <span className="block h-full rounded-full bg-v2-series-1" style={{ width: `${Math.max(2, (m.income / (total || 1)) * 100)}%` }} />
                </span>
                <span className="whitespace-nowrap text-right text-v2-small tabular-nums text-v2-text-2">
                  <b className="font-semibold text-v2-text">{pct(m.income, total)}</b> · {fmtNum(m.income)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={sum.stale ? "opacity-60 transition-opacity" : ""}>
        {view === "types" ? (
          <ReportTable
            cols={[
              { key: "n", label: t("To'lov turi"), render: (m) => <span className="font-medium text-v2-text">{nameOf(m.key)}</span> },
              { key: "a", label: t("Summa, so'm"), align: "right", render: (m) => fmtNum(m.income) },
              { key: "p", label: t("Ulush"), align: "right", render: (m) => <span className="text-v2-text-2">{pct(m.income, total)}</span> },
            ]}
            rows={byMethod}
            rowKey={(m) => m.key || "—"}
            loading={loading}
            empty={t("Bu davrda tushum yo'q")}
            total={[t("Jami"), fmtNum(total), "100%"]}
            minWidth={480}
          />
        ) : (
          <ReportTable<MonthRow>
            cols={[
              { key: "m", label: t("Oy"), render: (r) => r.label },
              ...methodKeys.map((k) => ({ key: `k:${k}`, label: nameOf(k), align: "right" as const, render: (r: MonthRow) => fmtNum(incomeOf(r.key, k)) })),
              { key: "sum", label: t("Jami"), align: "right", render: (r) => <span className="font-semibold text-v2-text">{fmtNum(methodKeys.reduce((a, k) => a + incomeOf(r.key, k), 0))}</span> },
            ]}
            rows={s.months.map((m, i) => ({ key: m, label: monthLabel(m, i) }))}
            rowKey={(r) => r.key}
            loading={loading}
            empty={t("Bu davrda tushum yo'q")}
            total={[t("Jami"), ...byMethod.map((m) => fmtNum(m.income)), fmtNum(total)]}
            minWidth={Math.max(480, 160 + methodKeys.length * 130)}
          />
        )}
      </div>
      <NoteLine>{t("Faqat tushum (kirim) hisoblanadi; bekor qilingan to'lovlar ayrilgan.")}</NoteLine>
    </ReportShell>
  );
}
