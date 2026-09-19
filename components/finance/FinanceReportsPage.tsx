"use client";

import { useEffect, useMemo, useState } from "react";
import { AreaChart, ArrowDown, ArrowUp, BarChart3 } from "lucide-react";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import DonutChart from "@/components/ui/DonutChart";
import { SpinnerBlock } from "@/components/ui/Spinner";
import DailyAreaChart, { type DailyPoint } from "@/components/finance/reports/DailyAreaChart";
import BreakdownBars from "@/components/finance/reports/BreakdownBars";
import { CHART_COLORS } from "@/constants/financeAnalytics";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useTransactionTypes, transactionTypeNames } from "@/hooks/useTransactionTypes";
import type { CashboxName } from "@/lib/cashboxes";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { fetchJson } from "@/lib/fetchJson";
import Select from "@/components/ui/Select";
import { useT } from "@/components/shared/Language";

// Yig'indi SERVERDA — /api/transactions/summary. Ilgari bu sahifa butun
// `transactions` kolleksiyasini yuklab (21 921 qator, 3.72 MB) hamma
// kartani, grafikni va taqsimotni brauzerda hisoblardi.
//
// TO'RTTA so'rov, chunki ular BOSHQA-BOSHQA kesimlar:
//   day,sign      -> kunlik grafik VA yuqoridagi Kirim/Chiqim/Qoldiq
//   category,sign -> "Tranzaksiya turi" taqsimoti
//   method,sign   -> "To'lov usuli" taqsimoti
//   sign          -> OLDINGI davr (foiz o'zgarishi uchun)
type Sign = "pos" | "neg" | "zero";
type DayRow = { day: string; sign: Sign; amount: number };
type CatRow = { category: string; sign: Sign; amount: number };
type MethodRow = { method: string; sign: Sign; amount: number };
type SignRow = { sign: Sign; amount: number };
// Bo'sh massiv MODUL DARAJASIDA: `?? []` har renderda YANGI massiv yasaydi
// va uni bog'liqlik sifatida ishlatadigan useMemo har safar qayta hisoblanadi.
const EMPTY: never[] = [];

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
 * ("> 0" va "< 0") bilan bir xil. Server ishorani UCH qiymatli qaytaradi
 * (pos/neg/zero), shu bois "zero" shu yerda ataylab e'tiborsiz qoladi.
 */
function totals(rows: SignRow[]) {
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (r.sign === "pos") income += r.amount;
    else if (r.sign === "neg") expense -= r.amount; // amount manfiy -> chiqim ortadi
  }
  return { income, expense, net: income - expense };
}

/** Bitta ishora bo'yicha "kalit -> mutlaq summa" xaritasi. */
function absMap(
  rows: { sign: Sign; amount: number; category?: string; method?: string }[],
  field: "category" | "method",
  positive: boolean,
): Record<string, number> {
  const map: Record<string, number> = {};
  const want = positive ? "pos" : "neg";
  for (const r of rows) {
    if (r.sign !== want) continue;
    const k = r[field];
    if (k === undefined) continue;
    map[k] = (map[k] || 0) + Math.abs(r.amount);
  }
  return map;
}

// Ro'yxatdagi turlar avvalgi tartibda, ulardan tashqarisi oxirida bitta
// "Boshqa" qatorida — hech bir tranzaksiya tashlanmaydi, shuning uchun
// yig'indi yuqoridagi karta bilan mos tushadi.
function categoryBreakdown(map: Record<string, number>, cats: string[]) {
  const known = new Set(cats);
  const other = Object.entries(map).reduce((s, [c, v]) => (known.has(c) ? s : s + v), 0);
  const out = cats.map((c) => ({ label: c, amount: map[c] || 0 })).filter((r) => r.amount > 0);
  if (other > 0) out.push({ label: otherLabel(cats), amount: other });
  return out;
}

// Bir xil sabab: Sozlamalardan o'chirilgan to'lov turidagi pul ham
// "To'lov usuli" taqsimotidan tushib qolmasligi kerak.
function methodBreakdown(map: Record<string, number>, methods: { key: string; name: string }[]) {
  const known = new Set(methods.map((m) => m.key));
  const other = Object.entries(map).reduce((s, [k, v]) => (known.has(k) ? s : s + v), 0);
  const out = methods.map((m) => ({ label: m.name, amount: map[m.key] || 0 })).filter((r) => r.amount > 0);
  if (other > 0) out.push({ label: otherLabel(methods.map((m) => m.name)), amount: other });
  return out;
}

const toSlices = (rows: { label: string; amount: number }[], offset = 0) =>
  rows.map((r, i) => ({ label: r.label, value: r.amount, color: CHART_COLORS[(i + offset) % CHART_COLORS.length] }));

export default function FinanceReportsPage() {
  const { t } = useT();
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

  const [cashboxes, setCashboxes] = useState<CashboxName[]>([]);
  // So'rov EFFEKT ICHIDA turadi va `reloadKey` bilan qayta ishga tushadi.
  // Ilgari bu yer `load` nomli useCallback edi va "Qayta urinish" tugmasi
  // uni TO'G'RIDAN-TO'G'RI chaqirardi — o'shanda funksiya qaytargan
  // `cancelled` tozalagichi TASHLAB YUBORILARDI (uni faqat React chaqira
  // oladi). Natijada kechikkan javob yangisini bosib ketishi mumkin edi.
  //
  // Ma'lumot O'Z SO'ROV KALITI bilan saqlanadi. Kalit mos kelmasa u eski
  // hisoblanadi va CHIZILMAYDI — aks holda yangi filtr tanlangani bilan
  // ekranda eski filtr raqamlari turardi.
  const [data, setData] = useState<{
    key: string;
    dayRows: DayRow[];
    catRows: CatRow[];
    methodRows: MethodRow[];
    prevRows: SignRow[];
  } | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    fetch("/api/cashboxes?names=1")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setCashboxes(d.cashboxes); })
      .catch(() => {});
  }, []);

  const startIso = dateRange.start ? toIso(dateRange.start) : "0000-01-01";
  const endIso = dateRange.end ? toIso(dateRange.end) : "9999-12-31";

  // OLDINGI davr — joriy oraliq bilan bir xil uzunlikda, undan darhol
  // oldin. Hisob-kitob ilgarigidek, faqat endi server so'roviga aylanadi.
  const prevRange = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return null;
    const days = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000) + 1;
    const prevEnd = addDays(dateRange.start, -1);
    const prevStart = addDays(prevEnd, -(days - 1));
    return { from: toIso(prevStart), to: toIso(prevEnd) };
  }, [dateRange]);

  // Ko'rinayotgan holatni bir qatorga jamlaydigan kalit.
  const queryKey = [
    dateRange.start ? startIso : "",
    dateRange.end ? endIso : "",
    cashboxId,
    method,
    prevRange ? prevRange.from + ".." + prevRange.to : "",
  ].join("|");

  useEffect(() => {
    let cancelled = false;
    const base = new URLSearchParams();
    if (dateRange.start) base.set("from", startIso);
    if (dateRange.end) base.set("to", endIso);
    if (cashboxId) base.set("cashboxId", cashboxId);
    if (method) base.set("method", method);
    const q = (groupBy: string) => {
      const p = new URLSearchParams(base);
      p.set("groupBy", groupBy);
      return "/api/transactions/summary?" + p.toString();
    };
    const prevQs = new URLSearchParams({ groupBy: "sign" });
    if (cashboxId) prevQs.set("cashboxId", cashboxId);
    if (method) prevQs.set("method", method);
    if (prevRange) { prevQs.set("from", prevRange.from); prevQs.set("to", prevRange.to); }

    Promise.all([
      fetchJson<{ rows: DayRow[] }>(q("day,sign")),
      fetchJson<{ rows: CatRow[] }>(q("category,sign")),
      fetchJson<{ rows: MethodRow[] }>(q("method,sign")),
      prevRange
        ? fetchJson<{ rows: SignRow[] }>("/api/transactions/summary?" + prevQs.toString())
        : Promise.resolve({ rows: [] as SignRow[] }),
    ])
      .then(([d, c, m, p]) => {
        if (cancelled) return;
        setData({ key: queryKey, dayRows: d.rows, catRows: c.rows, methodRows: m.rows, prevRows: p.rows });
        setError(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Nol bilan to'ldirilgan kartalar va bo'sh grafik CHIZILMASIN.
        setData(null);
        setError(true);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, reloadKey]);

  const fresh = data && data.key === queryKey ? data : null;
  const dayRows = fresh?.dayRows ?? EMPTY;
  const catRows = fresh?.catRows ?? EMPTY;
  const methodRows = fresh?.methodRows ?? EMPTY;
  const prevRows = fresh?.prevRows ?? EMPTY;
  const loading = !fresh && !error;

  const curTotals = useMemo(() => totals(dayRows), [dayRows]);
  const prevTotals = useMemo(() => totals(prevRows), [prevRows]);

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
    for (const r of dayRows) {
      let b = byDay.get(r.day);
      if (!b) { b = { income: 0, expense: 0 }; byDay.set(r.day, b); }
      if (r.sign === "pos") b.income += r.amount;
      else if (r.sign === "neg") b.expense -= r.amount;
    }
    return Array.from({ length: Math.max(days, 0) }, (_, i) => {
      const d = addDays(dateRange.start as Date, i);
      const iso = toIso(d);
      const b = byDay.get(iso);
      const p = (n: number) => String(n).padStart(2, "0");
      return { date: iso, label: `${p(d.getDate())}.${p(d.getMonth() + 1)}`, income: b?.income ?? 0, expense: b?.expense ?? 0 };
    });
  }, [dayRows, dateRange]);


  // Quyidagilar ilgari render TANASIDA hisoblanardi — ya'ni HAR renderda,
  // jumladan sof ko'rinish holatlari o'zgarganda ham (eksport menyusi,
  // diagramma turi, kirim/chiqim rejimi) `current` bo'ylab besh-yetti marta
  // to'liq yurardi. Endi ular faqat ma'lumot yoki tegishli rejim
  // o'zgarganda qayta hisoblanadi.
  const incomeByCat = useMemo(() => categoryBreakdown(absMap(catRows, "category", true), incomeCats), [catRows, incomeCats]);
  const expenseByCat = useMemo(() => categoryBreakdown(absMap(catRows, "category", false), expenseCats), [catRows, expenseCats]);
  const incomeByMethod = useMemo(() => methodBreakdown(absMap(methodRows, "method", true), paymentMethods), [methodRows, paymentMethods]);
  const expenseByMethod = useMemo(() => methodBreakdown(absMap(methodRows, "method", false), paymentMethods), [methodRows, paymentMethods]);

  const kirimRows = kirimMode === "category" ? incomeByCat : incomeByMethod;
  const chiqimRows = chiqimMode === "category" ? expenseByCat : expenseByMethod;

  const flowDonutRows = donutFlow === "income" ? incomeByCat : expenseByCat;
  const flowDonutSlices = useMemo(() => toSlices(flowDonutRows), [flowDonutRows]);
  const flowDonutTotal = flowDonutSlices.reduce((s, x) => s + x.value, 0);

  const kirimStatSlices = useMemo(() => toSlices(incomeByCat), [incomeByCat]);
  const chiqimStatSlices = useMemo(() => toSlices(expenseByCat, 1), [expenseByCat]);

  if (error) {
    return (
      <div className="p-5">
        <ErrorBanner
          message="Moliya hisobotini yuklab bo'lmadi — raqamlar ko'rsatilmaydi."
          onRetry={() => { setError(false); setReloadKey((k) => k + 1); }}
        />
      </div>
    );
  }
  if (loading) {
    return <div className="p-5"><SpinnerBlock /></div>;
  }

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <DateRangePicker value={dateRange} onChange={setDateRange} className="w-52" />
        <Select value={cashboxId} onChange={(v) => setCashboxId(v)} options={cashboxes.map((c) => ({ value: String(c.id), label: c.name }))} placeholder={t("Kassa")} clearable size="sm" />
        <Select value={method} onChange={(v) => setMethod(v)} options={activeMethods.map((m) => ({ value: m.key, label: m.name }))} placeholder={t("To'lov turi")} clearable size="sm" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label={t("Kirim")} value={curTotals.income} delta={pctDelta(curTotals.income, prevTotals.income)} slices={kirimStatSlices} />
        <StatCard label={t("Chiqim")} value={curTotals.expense} delta={pctDelta(curTotals.expense, prevTotals.expense)} slices={chiqimStatSlices} />
        <StatCard label={t("Qoldiq")} value={curTotals.net} delta={pctDelta(curTotals.net, prevTotals.net)} slices={[{ label: t("Qoldiq"), value: Math.max(curTotals.net, 0), color: CHART_COLORS[0] }]} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[14px] font-semibold">{t("Grafik")}</div>
            <div className="inline-flex items-center rounded-lg border border-border p-1">
              <button
                onClick={() => setChartVariant("area")}
                className={`h-7 w-7 inline-flex items-center justify-center rounded-md ${chartVariant === "area" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
                title={t("Chiziqli ko'rinish")}
              >
                <AreaChart className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartVariant("bar")}
                className={`h-7 w-7 inline-flex items-center justify-center rounded-md ${chartVariant === "bar" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
                title={t("Ustunli ko'rinish")}
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <DailyAreaChart points={dailyPoints} variant={chartVariant} />
          <div className="flex items-center justify-center gap-4 mt-2 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />{t("Kirim")}</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />{t("Chiqim")}</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-[14px] font-semibold mb-3">{t("Tranzaksiya bo'yicha")}</div>
          <div className="inline-flex items-center rounded-lg border border-border p-1 mb-4">
            <button onClick={() => setDonutFlow("income")} className={`h-8 px-3 rounded-md text-[13px] font-medium ${donutFlow === "income" ? "bg-primary text-white" : "text-muted-foreground"}`}>{t("Kirim")}</button>
            <button onClick={() => setDonutFlow("expense")} className={`h-8 px-3 rounded-md text-[13px] font-medium ${donutFlow === "expense" ? "bg-primary text-white" : "text-muted-foreground"}`}>{t("Chiqim")}</button>
          </div>
          <div className="flex justify-center">
            <DonutChart slices={flowDonutSlices} centerLabel={fmtUZS(flowDonutTotal)} />
          </div>
          <div className="mt-4 space-y-1.5">
            {flowDonutSlices.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-[13px]">
                <span className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />{t(s.label)}</span>
                <span className="tabular-nums font-medium">{fmtUZS(s.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[14px] font-semibold">{t("Kirim")}</div>
            <div className="inline-flex items-center rounded-lg border border-border p-1">
              <button onClick={() => setKirimMode("category")} className={`h-7 px-3 rounded-md text-[12px] font-medium ${kirimMode === "category" ? "bg-primary text-white" : "text-muted-foreground"}`}>{t("Tranzaksiya turi")}</button>
              <button onClick={() => setKirimMode("method")} className={`h-7 px-3 rounded-md text-[12px] font-medium ${kirimMode === "method" ? "bg-primary text-white" : "text-muted-foreground"}`}>{t("To'lov usuli")}</button>
            </div>
          </div>
          <BreakdownBars rows={kirimRows} tone="green" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[14px] font-semibold">{t("Chiqim")}</div>
            <div className="inline-flex items-center rounded-lg border border-border p-1">
              <button onClick={() => setChiqimMode("category")} className={`h-7 px-3 rounded-md text-[12px] font-medium ${chiqimMode === "category" ? "bg-primary text-white" : "text-muted-foreground"}`}>{t("Tranzaksiya turi")}</button>
              <button onClick={() => setChiqimMode("method")} className={`h-7 px-3 rounded-md text-[12px] font-medium ${chiqimMode === "method" ? "bg-primary text-white" : "text-muted-foreground"}`}>{t("To'lov usuli")}</button>
            </div>
          </div>
          <BreakdownBars rows={chiqimRows} tone="red" />
        </div>
      </div>
    </div>
  );
}
