"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang, useT } from "@/components/shared/Language";
import type { DateRange } from "@/components/ui/DateRangePicker";
import { Segmented } from "@/components/v2/form/fields";
import V2DateRange, { rangeLabel } from "@/components/v2/ui/V2DateRange";
import V2Select from "@/components/v2/ui/V2Select";
import { Panel } from "@/components/v2/reports/report35";
import { ErrorBanner, KpiStrip, NoteLine } from "@/components/v2/reports/reportUi";
import { PageHead, PageShell } from "@/components/v2/students/lists/listKit";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { transactionTypeNames, useTransactionTypes } from "@/hooks/useTransactionTypes";
import type { CashboxName } from "@/lib/cashboxes";
import { fetchJson } from "@/lib/fetchJson";
import {
  finIsoDay,
  finMonthToDate,
  reportAbsMap,
  reportCategoryBreakdown,
  reportDailyPoints,
  reportMethodBreakdown,
  reportPctDelta,
  reportPrevRange,
  reportTotals,
  type CatRow,
  type DayRow,
  type MethodRow,
  type SignRow,
} from "./finReportsCalc";
import FinDailyChart from "./finReportsDailyChart";
import { FinDelta, FinShareRows, FinSkeletonRows, finNum } from "./finReportsKit";

// YANGI VERSIYA — MOLIYA → «MOLIYA HISOBOTLARI» (/finance-reports, 28-qism moliya-A, rasmsiz —
// qo'shni v2 moliya va hisobot sahifalari uslubida). Eski sahifa
// (components/finance/FinanceReportsPage.tsx) bilan BIR XIL so'rovlar va hisob
// (./finReportsCalc.ts → report*):
//
//   1. sarlavha; filtrlar — davr (sukut — oy boshidan bugungacha), Kassa, To'lov turi (faqat faollari);
//   2. ko'rsatkichlar (bitta karta): Kirim · Chiqim · Qoldiq — oldingi teng davrga nisbatan
//      o'zgarish (bitta kasr, eski kartadagidek) va kunlik kichik grafik;
//   3. «Kirim va chiqim · kunma-kun» — ustunli grafik yoki jadval (./finReportsDailyChart.tsx);
//   4. Kirim va Chiqim kartalari — «Tranzaksiya turi | To'lov usuli» taqsimoti (ro'yxatda yo'q
//      tur/usul — «Boshqa» qatorida, jami yuqoridagi karta bilan teng).
// Eski «Tranzaksiya bo'yicha» donut kartasi alohida chizilmaydi — u 4-banddagi «Tranzaksiya
// turi» taqsimotining aynan o'zi edi.
//
// Ma'lumot — /api/transactions/summary: day,sign · category,sign · method,sign · sign (oldingi
// davr). Javob o'z so'rov kaliti bilan saqlanadi: filtr o'zgarsa eski raqamlar CHIZILMAYDI
// (skelet), xato bo'lsa — faqat xato qatori (nol bilan to'ldirilgan raqamlar ko'rinmasin).

const EMPTY: never[] = [];

export default function FinanceReportsV2() {
  const { t } = useT();
  const [lang] = useLang();
  const [dateRange, setDateRange] = useState<DateRange>(() => finMonthToDate());
  const [cashboxId, setCashboxId] = useState("");
  const [method, setMethod] = useState("");
  const [chartView, setChartView] = useState<"chart" | "table">("chart");
  const [kirimMode, setKirimMode] = useState<"category" | "method">("category");
  const [chiqimMode, setChiqimMode] = useState<"category" | "method">("category");
  // To'lov turlari: taqsimotda hammasi (eski summalar ko'rinsin), filtrda faqat faollari.
  const { methods: paymentMethods, active: activeMethods } = usePaymentMethods();
  const { types } = useTransactionTypes();
  const incomeCats = useMemo(() => transactionTypeNames(types, "kirim"), [types]);
  const expenseCats = useMemo(() => transactionTypeNames(types, "chiqim"), [types]);

  const [cashboxes, setCashboxes] = useState<CashboxName[]>([]);
  useEffect(() => {
    fetch("/api/cashboxes?names=1")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setCashboxes(d.cashboxes);
      })
      .catch(() => {});
  }, []);

  /* ---- So'rovlar (eski sahifadagi to'rttasi) ---- */
  const startIso = dateRange.start ? finIsoDay(dateRange.start) : "0000-01-01";
  const endIso = dateRange.end ? finIsoDay(dateRange.end) : "9999-12-31";
  const prevRange = useMemo(() => reportPrevRange(dateRange), [dateRange]);
  const queryKey = [dateRange.start ? startIso : "", dateRange.end ? endIso : "", cashboxId, method, prevRange ? prevRange.from + ".." + prevRange.to : ""].join("|");

  const [data, setData] = useState<{ key: string; dayRows: DayRow[]; catRows: CatRow[]; methodRows: MethodRow[]; prevRows: SignRow[] } | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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
    if (prevRange) {
      prevQs.set("from", prevRange.from);
      prevQs.set("to", prevRange.to);
    }
    Promise.all([
      fetchJson<{ rows: DayRow[] }>(q("day,sign")),
      fetchJson<{ rows: CatRow[] }>(q("category,sign")),
      fetchJson<{ rows: MethodRow[] }>(q("method,sign")),
      prevRange ? fetchJson<{ rows: SignRow[] }>("/api/transactions/summary?" + prevQs.toString()) : Promise.resolve({ rows: [] as SignRow[] }),
    ])
      .then(([d, c, m, p]) => {
        if (cancelled) return;
        setData({ key: queryKey, dayRows: d.rows, catRows: c.rows, methodRows: m.rows, prevRows: p.rows });
        setError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, reloadKey]);

  const fresh = data && data.key === queryKey ? data : null;
  const dayRows = fresh?.dayRows ?? EMPTY;
  const catRows = fresh?.catRows ?? EMPTY;
  const methodRows = fresh?.methodRows ?? EMPTY;
  const prevRows = fresh?.prevRows ?? EMPTY;
  const loading = !fresh && !error;

  /* ---- Hisob ---- */
  const cur = useMemo(() => reportTotals(dayRows), [dayRows]);
  const prev = useMemo(() => reportTotals(prevRows), [prevRows]);
  const dailyPoints = useMemo(() => reportDailyPoints(dayRows, dateRange), [dayRows, dateRange]);
  const incomeByCat = useMemo(() => reportCategoryBreakdown(reportAbsMap(catRows, "category", true), incomeCats), [catRows, incomeCats]);
  const expenseByCat = useMemo(() => reportCategoryBreakdown(reportAbsMap(catRows, "category", false), expenseCats), [catRows, expenseCats]);
  const incomeByMethod = useMemo(() => reportMethodBreakdown(reportAbsMap(methodRows, "method", true), paymentMethods), [methodRows, paymentMethods]);
  const expenseByMethod = useMemo(() => reportMethodBreakdown(reportAbsMap(methodRows, "method", false), paymentMethods), [methodRows, paymentMethods]);
  const kirimRows = kirimMode === "category" ? incomeByCat : incomeByMethod;
  const chiqimRows = chiqimMode === "category" ? expenseByCat : expenseByMethod;

  // Kichik grafiklar: kunlik kirim, kunlik chiqim, qoldiq yig'ilishi.
  const sparks = useMemo(() => {
    const net: number[] = [];
    let run = 0;
    for (const p of dailyPoints) {
      run += p.income - p.expense;
      net.push(run);
    }
    return { income: dailyPoints.map((p) => p.income), expense: dailyPoints.map((p) => p.expense), net };
  }, [dailyPoints]);

  /* ---- Yozuvlar ---- */
  const cashboxName = cashboxes.find((c) => String(c.id) === cashboxId)?.name ?? "";
  const methodName = activeMethods.find((m) => m.key === method)?.name ?? "";
  const scope = [cashboxName || t("barcha kassalar"), methodName].filter(Boolean).join(" · ");
  const period = rangeLabel(dateRange, lang, t);
  const vs = prevRange ? (prevRange.days === 1 ? t("oldingi kunga nisbatan") : t("oldingi {n} kunga nisbatan", { n: prevRange.days })) : "";
  const delta = (c: number, p: number, goodUp: boolean) => (prevRange ? <FinDelta value={reportPctDelta(c, p)} goodUp={goodUp} vs={vs} /> : undefined);

  const modeOptions = [
    { value: "category", label: t("Tranzaksiya turi") },
    { value: "method", label: t("To'lov usuli") },
  ];
  const panelSub = (rows: { amount: number }[]) => (loading ? " " : `${t("Jami")}: ${finNum(rows.reduce((s, r) => s + r.amount, 0))} ${t("so'm")}`);

  return (
    <PageShell flow>
      <PageHead title={t("Moliya hisobotlari")} subtitle={`${t("Kirim, chiqim va qoldiq — kunma-kun va turlar bo'yicha")} · ${scope}`} />

      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-2">
        <V2DateRange value={dateRange} onChange={setDateRange} align="start" />
        <V2Select
          variant="value"
          label={t("Kassa")}
          value={cashboxId}
          onChange={setCashboxId}
          options={[{ value: "", label: "Barchasi" }, ...cashboxes.map((c) => ({ value: String(c.id), label: c.name, hint: c.archived ? t("arxiv") : undefined }))]}
          clearable={false}
        />
        <V2Select
          variant="value"
          label={t("To'lov turi")}
          value={method}
          onChange={setMethod}
          options={[{ value: "", label: "Barchasi" }, ...activeMethods.map((m) => ({ value: m.key, label: m.name }))]}
          searchable={false}
          clearable={false}
        />
      </div>

      {error ? (
        <ErrorBanner
          message="Moliya hisobotini yuklab bo'lmadi — raqamlar ko'rsatilmaydi."
          onRetry={() => {
            setError(false);
            setReloadKey((k) => k + 1);
          }}
        />
      ) : (
        <>
          <KpiStrip
            loading={loading}
            cells={[
              { key: "i", label: t("Kirim"), value: finNum(cur.income), unit: t("so'm"), sub: delta(cur.income, prev.income, true), spark: sparks.income },
              { key: "e", label: t("Chiqim"), value: finNum(cur.expense), unit: t("so'm"), sub: delta(cur.expense, prev.expense, false), spark: sparks.expense },
              {
                key: "n",
                label: t("Qoldiq"),
                value: finNum(cur.net),
                unit: t("so'm"),
                tone: cur.net < 0 ? "danger" : undefined,
                sub: delta(cur.net, prev.net, true),
                spark: sparks.net,
              },
            ]}
          />

          <FinDailyChart points={dailyPoints} loading={loading} view={chartView} onView={setChartView} subtitle={`${period} · ${t("so'm")}`} />

          <div className="grid grid-cols-1 gap-4 min-[64rem]:grid-cols-2">
            <Panel
              title={t("Kirim")}
              sub={panelSub(kirimRows)}
              right={
                <div className="w-full min-[30rem]:w-[272px]">
                  <Segmented value={kirimMode} onChange={(v) => setKirimMode(v as "category" | "method")} label={t("Kirim taqsimoti")} options={modeOptions} />
                </div>
              }
            >
              {loading ? <FinSkeletonRows /> : <FinShareRows rows={kirimRows} tone="income" empty={t("Bu davrda kirim yo'q")} />}
            </Panel>
            <Panel
              title={t("Chiqim")}
              sub={panelSub(chiqimRows)}
              right={
                <div className="w-full min-[30rem]:w-[272px]">
                  <Segmented value={chiqimMode} onChange={(v) => setChiqimMode(v as "category" | "method")} label={t("Chiqim taqsimoti")} options={modeOptions} />
                </div>
              }
            >
              {loading ? <FinSkeletonRows /> : <FinShareRows rows={chiqimRows} tone="expense" empty={t("Bu davrda chiqim yo'q")} />}
            </Panel>
          </div>

          <div className="flex flex-col gap-1">
            {prevRange && <NoteLine>{t("O'zgarish — shu uzunlikdagi oldingi davrga nisbatan ({from} – {to}).", { from: prevRange.from.split("-").reverse().join("."), to: prevRange.to.split("-").reverse().join(".") })}</NoteLine>}
            <NoteLine>{t("Ro'yxatda yo'q (o'chirilgan yoki nomi o'zgargan) tur va to'lov usullari «Boshqa» qatorida — taqsimot jami yuqoridagi summaga teng.")}</NoteLine>
          </div>
        </>
      )}
    </PageShell>
  );
}
