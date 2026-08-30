"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AreaChart, ArrowDown, ArrowUp, BarChart3 } from "lucide-react";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import DonutChart from "@/components/ui/DonutChart";
import { SpinnerBlock } from "@/components/ui/Spinner";
import DailyAreaChart, { type DailyPoint } from "@/components/finance/reports/DailyAreaChart";
import BreakdownBars from "@/components/finance/reports/BreakdownBars";
import { CHART_COLORS } from "@/constants/financeAnalytics";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useTransactionTypes, transactionTypeNames } from "@/hooks/useTransactionTypes";
import type { Transaction } from "@/lib/transactions";
import type { Cashbox } from "@/lib/cashboxes";
import { loadTransactionsCached } from "@/lib/transactionsClient";

// Moliya → Moliya hisobotlari (sidebar: Moliya > Moliya hisobotlari, href
// /finance-reports). Bir xil /api/transactions'dan (Moliya analitikasi bilan
// bir xil manba — [[project_crm_akademiya_conversion]]) hisoblangan, batafsilroq
// hisobot: Kirim/Chiqim/Qoldiq statistika kartalari (davr solishtirmasi bilan),
// kunlik maydon grafigi, "Tranzaksiya bo'yicha" umumiy donut, va Kirim/Chiqim
// uchun alohida "Tranzaksiya turi"/"To'lov usuli" taqsimoti panellari. Sof
// hisobot — add/edit/delete yo'q. "Kassa" va "To'lov turi" filtrlari REAL
// (har bir tranzaksiyada shu maydonlar bor).
//
// ILGARI "Tranzaksiya turi" taqsimotidagi kategoriyalar `constants/
// transactions.js` dagi qattiq yozilgan INCOME_CATS/EXPENSE_CATS ro'yxatidan
// olinardi — u demo generator uchun yozilgan ro'yxat edi va admin
// "Tranzaksiya turi" sahifasida qo'shgan yangi tur bu hisobotga hech qachon
// tushmasdi. Endi ro'yxat /api/transaction-types dan (useTransactionTypes),
// ya'ni Kassalar oynalari bilan bir xil manba.
//
// TUZATILDI — SAHIFA O'ZINI O'ZI INKOR QILARDI: taqsimotlar faqat hozir
// ro'yxatda turgan tranzaksiya turlari (va to'lov turlari) bo'yicha
// yig'ilardi, yuqoridagi Kirim/Chiqim/Qoldiq kartalari esa BARCHA
// tranzaksiyani qo'shardi. Admin turni o'chirsa yoki nomini o'zgartirsa,
// o'sha pul donut va ustunlardan tushib qolardi — donut markazidagi jami
// o'zi turgan kartadan kichik chiqardi. Endi ikkalasi ham bir xil
// to'plamni o'qiydi: ro'yxatda yo'q kategoriya/usul "Boshqa" qatorida.

function fmtUZS(n: number): string {
  return Math.round(n).toLocaleString("ru-RU") + " UZS";
}
// Ro'yxatda yo'q kategoriya/to'lov usuli shu nom ostida yig'iladi. Agar
// aynan shu nomli haqiqiy tur mavjud bo'lsa — nom aniqlashtiriladi, ikki
// xil pul bir qatorda aralashib ketmasin.
function otherLabel(known: string[]): string {
  return known.includes("Boshqa") ? "Boshqa (ro'yxatda yo'q)" : "Boshqa";
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

/**
 * Kirim / chiqim / qoldiq — BITTA o'tishda.
 *
 * Ilgari bu funksiya komponent tanasida turardi. Modul darajasiga
 * ko'chirildi, chunki komponent ichida e'lon qilingan funksiya har renderda
 * YANGI bo'ladi va uni useMemo bog'liqligiga qo'shish memoizatsiyani bekor
 * qilardi.
 *
 * amount === 0 ikkala tarafga ham qo'shilmaydi — eski filter juftligi
 * ("> 0" va "< 0") bilan bir xil.
 */
function totals(rows: Transaction[]) {
  let income = 0;
  let expense = 0;
  for (const t of rows) {
    if (t.amount > 0) income += t.amount;
    else expense -= t.amount;
  }
  return { income, expense, net: income - expense };
}

// Ro'yxatdagi turlar avvalgi tartibda, ulardan tashqarisi oxirida bitta
// "Boshqa" qatorida — hech bir tranzaksiya tashlanmaydi, shuning uchun
// yig'indi yuqoridagi karta bilan mos tushadi.
function categoryBreakdown(rows: Transaction[], cats: string[], positive: boolean) {
  const map: Record<string, number> = {};
  for (const t of rows) {
    if (positive ? t.amount <= 0 : t.amount >= 0) continue;
    map[t.category] = (map[t.category] || 0) + Math.abs(t.amount);
  }
  const known = new Set(cats);
  const other = Object.entries(map).reduce((s, [c, v]) => (known.has(c) ? s : s + v), 0);
  const out = cats.map((c) => ({ label: c, amount: map[c] || 0 })).filter((r) => r.amount > 0);
  if (other > 0) out.push({ label: otherLabel(cats), amount: other });
  return out;
}

// Bir xil sabab: Sozlamalardan o'chirilgan to'lov turidagi pul ham
// "To'lov usuli" taqsimotidan tushib qolmasligi kerak.
function methodBreakdown(rows: Transaction[], positive: boolean, methods: { key: string; name: string }[]) {
  const map: Record<string, number> = {};
  for (const t of rows) {
    if (positive ? t.amount <= 0 : t.amount >= 0) continue;
    map[t.method] = (map[t.method] || 0) + Math.abs(t.amount);
  }
  const known = new Set(methods.map((m) => m.key));
  const other = Object.entries(map).reduce((s, [k, v]) => (known.has(k) ? s : s + v), 0);
  const out = methods.map((m) => ({ label: m.name, amount: map[m.key] || 0 })).filter((r) => r.amount > 0);
  if (other > 0) out.push({ label: otherLabel(methods.map((m) => m.name)), amount: other });
  return out;
}

const toSlices = (rows: { label: string; amount: number }[], offset = 0) =>
  rows.map((r, i) => ({ label: r.label, value: r.amount, color: CHART_COLORS[(i + offset) % CHART_COLORS.length] }));

export default function FinanceReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => monthToDateRange());
  const [cashboxId, setCashboxId] = useState("");
  const [method, setMethod] = useState("");
  const [donutFlow, setDonutFlow] = useState<"income" | "expense">("income");
  // To'lov turlari Sozlamalar → Moliya → To'lov turlaridan. Taqsimotda
  // barchasi (eski summalar ko'rinsin), filtrda faqat faollari.
  const { methods: paymentMethods, active: activeMethods } = usePaymentMethods();
  // Kategoriyalar Moliya → Tranzaksiya turi sahifasidagi haqiqiy ro'yxatdan.
  const { types } = useTransactionTypes();
  const incomeCats = useMemo(() => transactionTypeNames(types, "kirim"), [types]);
  const expenseCats = useMemo(() => transactionTypeNames(types, "chiqim"), [types]);
  const [chartVariant, setChartVariant] = useState<"area" | "bar">("area");
  const [kirimMode, setKirimMode] = useState<"category" | "method">("category");
  const [chiqimMode, setChiqimMode] = useState<"category" | "method">("category");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadTransactionsCached()
        .then((transactions) => ({ ok: true, transactions }))
        .catch(() => ({ ok: false, transactions: [] })),
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

  const curTotals = useMemo(() => totals(current), [current]);
  const prevTotals = useMemo(() => totals(previous), [previous]);

  function pctDelta(cur: number, prev: number): number | null {
    if (prev === 0) return cur === 0 ? null : 100;
    return ((cur - prev) / Math.abs(prev)) * 100;
  }

  const dailyPoints: DailyPoint[] = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    const days = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000) + 1;
    // BITTA o'tishda sana -> {kirim, chiqim}. Ilgari HAR KUN uchun butun
    // ro'yxat qaytadan filtrlanardi (current.filter(t => t.date === iso),
    // ustiga yana ikkita filter), ya'ni O(kun x tranzaksiya). Bir yillik
    // oraliqda 21 921 qatorli to'plamda bu ~8 million solishtirish edi.
    const byDay = new Map<string, { income: number; expense: number }>();
    for (const t of current) {
      let b = byDay.get(t.date);
      if (!b) { b = { income: 0, expense: 0 }; byDay.set(t.date, b); }
      if (t.amount > 0) b.income += t.amount;
      else b.expense -= t.amount;
    }
    return Array.from({ length: Math.max(days, 0) }, (_, i) => {
      const d = addDays(dateRange.start as Date, i);
      const iso = toIso(d);
      const b = byDay.get(iso);
      const p = (n: number) => String(n).padStart(2, "0");
      return { date: iso, label: `${p(d.getDate())}.${p(d.getMonth() + 1)}`, income: b?.income ?? 0, expense: b?.expense ?? 0 };
    });
  }, [current, dateRange]);


  // Quyidagilar ilgari render TANASIDA hisoblanardi — ya'ni HAR renderda,
  // jumladan sof ko'rinish holatlari o'zgarganda ham (eksport menyusi,
  // diagramma turi, kirim/chiqim rejimi) `current` bo'ylab besh-yetti marta
  // to'liq yurardi. Endi ular faqat ma'lumot yoki tegishli rejim
  // o'zgarganda qayta hisoblanadi.
  const incomeByCat = useMemo(() => categoryBreakdown(current, incomeCats, true), [current, incomeCats]);
  const expenseByCat = useMemo(() => categoryBreakdown(current, expenseCats, false), [current, expenseCats]);
  const incomeByMethod = useMemo(() => methodBreakdown(current, true, paymentMethods), [current, paymentMethods]);
  const expenseByMethod = useMemo(() => methodBreakdown(current, false, paymentMethods), [current, paymentMethods]);

  const kirimRows = kirimMode === "category" ? incomeByCat : incomeByMethod;
  const chiqimRows = chiqimMode === "category" ? expenseByCat : expenseByMethod;

  const flowDonutRows = donutFlow === "income" ? incomeByCat : expenseByCat;
  const flowDonutSlices = useMemo(() => toSlices(flowDonutRows), [flowDonutRows]);
  const flowDonutTotal = flowDonutSlices.reduce((s, x) => s + x.value, 0);

  const kirimStatSlices = useMemo(() => toSlices(incomeByCat), [incomeByCat]);
  const chiqimStatSlices = useMemo(() => toSlices(expenseByCat, 1), [expenseByCat]);

  if (loading) {
    return <div className="p-5"><SpinnerBlock /></div>;
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
