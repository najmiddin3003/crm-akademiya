"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AreaChart, ArrowDown, ArrowUp, BarChart3 } from "lucide-react";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import DonutChart from "@/components/ui/DonutChart";
import DailyAreaChart, { type DailyPoint } from "@/components/finance/reports/DailyAreaChart";
import BreakdownBars from "@/components/finance/reports/BreakdownBars";
import { CHART_COLORS } from "@/constants/financeAnalytics";
import { INCOME_CATS, EXPENSE_CATS } from "@/constants/transactions";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import type { Transaction } from "@/lib/transactions";
import type { Cashbox } from "@/lib/cashboxes";

// Moliya → Moliya hisobotlari (sidebar: Moliya > Moliya hisobotlari, href
// /finance-reports). Bir xil /api/transactions'dan (Moliya analitikasi bilan
// bir xil manba — [[project_crm_akademiya_conversion]]) hisoblangan, batafsilroq
// hisobot: Kirim/Chiqim/Qoldiq statistika kartalari (davr solishtirmasi bilan),
// kunlik maydon grafigi, "Tranzaksiya bo'yicha" umumiy donut, va Kirim/Chiqim
// uchun alohida "Tranzaksiya turi"/"To'lov usuli" taqsimoti panellari. Sof
// hisobot — add/edit/delete yo'q. "Kassa" va "To'lov turi" filtrlari REAL
// (har bir tranzaksiyada shu maydonlar bor).

function fmtUZS(n: number): string {
  return Math.round(n).toLocaleString("ru-RU") + " UZS";
}
function monthToDateRange(): DateRange {
  const now = new Date();
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
}
function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function StatCard({
  label,
  value,
  delta,
  slices,
}: {
  label: string;
  value: number;
  delta: number | null;
  slices: { label: string; value: number; color: string }[];
}) {
  const down = delta != null && delta < 0;
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3">
      <div>
        <div className="text-[13px] text-muted-foreground">{label}</div>
        <div className="text-[18px] font-bold tabular-nums mt-0.5">{fmtUZS(value)}</div>
        {delta != null && (
          <div className={`inline-flex items-center gap-1 text-[12px] font-medium mt-1 ${down ? "text-rose-600" : "text-emerald-600"}`}>
            {down ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
            {Math.abs(delta).toFixed(1)}%
          </div>
        )}
      </div>
      <DonutChart slices={slices} centerLabel="" size={64} showLabels={false} />
    </div>
  );
}

export default function FinanceReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => monthToDateRange());
  const [cashboxId, setCashboxId] = useState("");
  const [method, setMethod] = useState("");
  const [donutFlow, setDonutFlow] = useState<"income" | "expense">("income");
  // To'lov turlari Sozlamalar → Moliya → To'lov turlaridan. Taqsimotda
  // barchasi (eski summalar ko'rinsin), filtrda faqat faollari.
  const { methods: paymentMethods, active: activeMethods } = usePaymentMethods();
  const [chartVariant, setChartVariant] = useState<"area" | "bar">("area");
  const [kirimMode, setKirimMode] = useState<"category" | "method">("category");
  const [chiqimMode, setChiqimMode] = useState<"category" | "method">("category");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/transactions").then((r) => r.json()),
      fetch("/api/cashboxes").then((r) => r.json()),
    ])
      .then(([tx, cb]) => {
        if (cancelled) return;
        if (tx.ok) setTransactions(tx.transactions);
        if (cb.ok) setCashboxes(cb.cashboxes);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const startIso = dateRange.start ? toIso(dateRange.start) : "0000-01-01";
  const endIso = dateRange.end ? toIso(dateRange.end) : "9999-12-31";

  const matchesFilters = useCallback(
    (t: Transaction, dStart: string, dEnd: string) => {
      if (t.date < dStart || t.date > dEnd) return false;
      if (cashboxId && t.cashboxId !== Number(cashboxId)) return false;
      if (method && t.method !== method) return false;
      return true;
    },
    [cashboxId, method],
  );

  const current = useMemo(() => transactions.filter((t) => matchesFilters(t, startIso, endIso)), [transactions, startIso, endIso, matchesFilters]);

  const previous = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    const days = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000) + 1;
    const prevEnd = addDays(dateRange.start, -1);
    const prevStart = addDays(prevEnd, -(days - 1));
    return transactions.filter((t) => matchesFilters(t, toIso(prevStart), toIso(prevEnd)));
  }, [transactions, dateRange, matchesFilters]);

  function totals(rows: Transaction[]) {
    const income = rows.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expense = -rows.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
    return { income, expense, net: income - expense };
  }
  const curTotals = totals(current);
  const prevTotals = totals(previous);

  function pctDelta(cur: number, prev: number): number | null {
    if (prev === 0) return cur === 0 ? null : 100;
    return ((cur - prev) / Math.abs(prev)) * 100;
  }

  const dailyPoints: DailyPoint[] = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    const days = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000) + 1;
    return Array.from({ length: Math.max(days, 0) }, (_, i) => {
      const d = addDays(dateRange.start as Date, i);
      const iso = toIso(d);
      const dayTx = current.filter((t) => t.date === iso);
      const income = dayTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const expense = -dayTx.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
      const p = (n: number) => String(n).padStart(2, "0");
      return { date: iso, label: `${p(d.getDate())}.${p(d.getMonth() + 1)}`, income, expense };
    });
  }, [current, dateRange]);

  function categoryBreakdown(rows: Transaction[], cats: string[], positive: boolean) {
    const map: Record<string, number> = {};
    for (const t of rows) {
      if (positive ? t.amount <= 0 : t.amount >= 0) continue;
      map[t.category] = (map[t.category] || 0) + Math.abs(t.amount);
    }
    return cats.map((c) => ({ label: c, amount: map[c] || 0 })).filter((r) => r.amount > 0);
  }
  function methodBreakdown(rows: Transaction[], positive: boolean) {
    const map: Record<string, number> = {};
    for (const t of rows) {
      if (positive ? t.amount <= 0 : t.amount >= 0) continue;
      map[t.method] = (map[t.method] || 0) + Math.abs(t.amount);
    }
    return paymentMethods.map((m) => ({ label: m.name, amount: map[m.key] || 0 })).filter((r) => r.amount > 0);
  }

  const kirimRows = kirimMode === "category" ? categoryBreakdown(current, INCOME_CATS, true) : methodBreakdown(current, true);
  const chiqimRows = chiqimMode === "category" ? categoryBreakdown(current, EXPENSE_CATS, false) : methodBreakdown(current, false);

  const flowDonutRows = donutFlow === "income" ? categoryBreakdown(current, INCOME_CATS, true) : categoryBreakdown(current, EXPENSE_CATS, false);
  const flowDonutSlices = flowDonutRows.map((r, i) => ({ label: r.label, value: r.amount, color: CHART_COLORS[i % CHART_COLORS.length] }));
  const flowDonutTotal = flowDonutSlices.reduce((s, x) => s + x.value, 0);

  const kirimStatSlices = categoryBreakdown(current, INCOME_CATS, true).map((r, i) => ({ label: r.label, value: r.amount, color: CHART_COLORS[i % CHART_COLORS.length] }));
  const chiqimStatSlices = categoryBreakdown(current, EXPENSE_CATS, false).map((r, i) => ({ label: r.label, value: r.amount, color: CHART_COLORS[(i + 1) % CHART_COLORS.length] }));

  if (loading) {
    return <div className="p-5 text-center text-sm text-muted-foreground">Yuklanmoqda…</div>;
  }

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <DateRangePicker value={dateRange} onChange={setDateRange} className="w-52" />
        <div className="relative">
          <select value={cashboxId} onChange={(e) => setCashboxId(e.target.value)} className="h-9 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="">Kassa</option>
            {cashboxes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
        <div className="relative">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-9 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="">To&apos;lov turi</option>
            {activeMethods.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
          </select>
          <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Kirim" value={curTotals.income} delta={pctDelta(curTotals.income, prevTotals.income)} slices={kirimStatSlices} />
        <StatCard label="Chiqim" value={curTotals.expense} delta={pctDelta(curTotals.expense, prevTotals.expense)} slices={chiqimStatSlices} />
        <StatCard label="Qoldiq" value={curTotals.net} delta={pctDelta(curTotals.net, prevTotals.net)} slices={[{ label: "Qoldiq", value: Math.max(curTotals.net, 0), color: CHART_COLORS[0] }]} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[14px] font-semibold">Grafik</div>
            <div className="inline-flex items-center rounded-lg border border-border p-1">
              <button
                onClick={() => setChartVariant("area")}
                className={`h-7 w-7 inline-flex items-center justify-center rounded-md ${chartVariant === "area" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
                title="Chiziqli ko'rinish"
              >
                <AreaChart className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartVariant("bar")}
                className={`h-7 w-7 inline-flex items-center justify-center rounded-md ${chartVariant === "bar" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
                title="Ustunli ko'rinish"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <DailyAreaChart points={dailyPoints} variant={chartVariant} />
          <div className="flex items-center justify-center gap-4 mt-2 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Kirim</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />Chiqim</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-[14px] font-semibold mb-3">Tranzaksiya bo&apos;yicha</div>
          <div className="inline-flex items-center rounded-lg border border-border p-1 mb-4">
            <button onClick={() => setDonutFlow("income")} className={`h-8 px-3 rounded-md text-[13px] font-medium ${donutFlow === "income" ? "bg-primary text-white" : "text-muted-foreground"}`}>Kirim</button>
            <button onClick={() => setDonutFlow("expense")} className={`h-8 px-3 rounded-md text-[13px] font-medium ${donutFlow === "expense" ? "bg-primary text-white" : "text-muted-foreground"}`}>Chiqim</button>
          </div>
          <div className="flex justify-center">
            <DonutChart slices={flowDonutSlices} centerLabel={fmtUZS(flowDonutTotal)} />
          </div>
          <div className="mt-4 space-y-1.5">
            {flowDonutSlices.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-[13px]">
                <span className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />{s.label}</span>
                <span className="tabular-nums font-medium">{fmtUZS(s.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[14px] font-semibold">Kirim</div>
            <div className="inline-flex items-center rounded-lg border border-border p-1">
              <button onClick={() => setKirimMode("category")} className={`h-7 px-3 rounded-md text-[12px] font-medium ${kirimMode === "category" ? "bg-primary text-white" : "text-muted-foreground"}`}>Tranzaksiya turi</button>
              <button onClick={() => setKirimMode("method")} className={`h-7 px-3 rounded-md text-[12px] font-medium ${kirimMode === "method" ? "bg-primary text-white" : "text-muted-foreground"}`}>To&apos;lov usuli</button>
            </div>
          </div>
          <BreakdownBars rows={kirimRows} tone="green" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[14px] font-semibold">Chiqim</div>
            <div className="inline-flex items-center rounded-lg border border-border p-1">
              <button onClick={() => setChiqimMode("category")} className={`h-7 px-3 rounded-md text-[12px] font-medium ${chiqimMode === "category" ? "bg-primary text-white" : "text-muted-foreground"}`}>Tranzaksiya turi</button>
              <button onClick={() => setChiqimMode("method")} className={`h-7 px-3 rounded-md text-[12px] font-medium ${chiqimMode === "method" ? "bg-primary text-white" : "text-muted-foreground"}`}>To&apos;lov usuli</button>
            </div>
          </div>
          <BreakdownBars rows={chiqimRows} tone="red" />
        </div>
      </div>
    </div>
  );
}
