"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Download, Minus, RotateCw } from "lucide-react";
import { useBranch } from "@/components/shared/BranchContext";
import { useLang, useT, type TFn } from "@/components/shared/Language";
import { dateRangePresets, type DateRange } from "@/components/ui/DateRangePicker";
import V2DateRange, { rangeLabel, rangePresetKey, v2PresetLabel } from "@/components/v2/ui/V2DateRange";
import V2Select, { type V2SelectOption } from "@/components/v2/ui/V2Select";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { compareRange, lastMonths, monthlyMoney, moneyTotals, pctChange, type CompareMode, type DayRange, type FunnelStats, type SummaryRow } from "@/lib/financeAnalytics";
import type { CashboxName } from "@/lib/cashboxes";
import { fetchJson } from "@/lib/fetchJson";
import type { Lang } from "@/lib/i18n";
import { uzDateIso } from "@/lib/uzTime";
import AnalyticsCashChart, { type MonthPoint } from "./AnalyticsCashChart";
import AnalyticsLeadFunnel from "./AnalyticsLeadFunnel";
import AnalyticsReportModal from "./AnalyticsReportModal";
import { fmtSom } from "./analyticsShared";

// YANGI VERSIYA — MOLIYA ANALITIKASI (6-qism, rasmlar «Moliya analitikasi · namuna
// ma'lumot», «Hisobotni yuklab olish», yorug'/qorong'i, 20.10.2026):
//
//   1. sarlavha: «Moliya analitikasi» + «Pul qayerdan kelib, qayerga ketyapti va lidlar
//      qanchalik o'quvchiga aylanyapti»;
//   2. filtrlar BITTA qatorda (hammasini qamraydi): davr («Shu oy · 1–20-oktyabr»),
//      «Solishtirish: o'tgan oy», «Filial: Barchasi», «Kassa: Barchasi»; o'ngda
//      «Hisobot yuklab olish» (./AnalyticsReportModal.tsx);
//   3. ko'rsatkichlar: Tushum · Chiqim · Sof foyda · Lid → o'quvchi — har biri
//      solishtirish davriga nisbatan o'zgarish bilan (o'q + foiz; chiqim ko'paysa —
//      qizil, tushum/foyda/konversiya ko'paysa — yashil);
//   4. «Kirim va chiqim · oyma-oy» — oxirgi 6 oy (./AnalyticsCashChart.tsx);
//   5. «Lid → o'quvchi» — bosqichlar va manbalar (./AnalyticsLeadFunnel.tsx).
//
// Ma'lumot: /api/transactions/summary (kassa bo'yicha guruhlangan — filial va kassa
// tanlovi shu yerda qo'llanadi, qayta so'ralmaydi), /api/cashboxes?names=1 (kassa →
// filial), /api/analytics/leads. Hisob qoidalari — lib/financeAnalytics.ts. Eski
// sahifaning Kalendar / Journal / Pul oqimi tablari bu dizaynda yo'q — eski versiyada
// qoladi (design/v2/SAVOLLAR.md 99–110).

type LeadsResp = { period: FunnelStats; compare: { total: number; joined: number } | null };

const monthPreset = (): DateRange => dateRangePresets().find((p) => p.key === "month")?.range() ?? { start: null, end: null };

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function dateOf(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function monthEnd(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return isoOf(new Date(y, m, 0));
}

/** «1–12-sentyabr» → «1–12-sentyabrga nisbatan» (yil bilan — «… 2025-yilga nisbatan»). */
function vsText(r: DayRange, lang: Lang, t: TFn): string {
  const label = rangeLabel({ start: dateOf(r.from), end: dateOf(r.to) }, lang, t);
  return /\d$/.test(label) ? t("{period}-yilga nisbatan", { period: label }) : t("{period}ga nisbatan", { period: label });
}

/** O'zgarish qatori: o'q + foiz (rang — yo'nalish × «ko'payishi yaxshimi»), ostida nimaga nisbatan. */
function Delta({ value, goodUp, suffix, vs, noBase }: { value: number | null; goodUp: boolean; suffix: string; vs: string; noBase: string }) {
  if (value === null) return <span className="text-v2-text-3">{noBase}</span>;
  const r = Math.round(value);
  const flat = r === 0;
  const good = flat ? null : r > 0 === goodUp;
  const Icon = flat ? Minus : r > 0 ? ArrowUp : ArrowDown;
  const tone = good === null ? "text-v2-text-2" : good ? "text-v2-success" : "text-v2-danger";
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      <span className={`inline-flex items-center gap-0.5 font-semibold ${tone}`}>
        <Icon className="size-3.5" strokeWidth={2.25} aria-hidden />
        {Math.abs(r)}
        {suffix}
      </span>
      <span className="text-v2-text-2">{vs}</span>
    </span>
  );
}

function Kpi({ label, children, delta }: { label: string; children: ReactNode; delta?: ReactNode }) {
  return (
    <div className="min-w-0 bg-v2-surface px-5 py-4">
      <div className="text-v2-small text-v2-text-2">{label}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">{children}</div>
      {delta && <div className="mt-1.5 text-v2-caption">{delta}</div>}
    </div>
  );
}

export default function FinanceAnalyticsV2() {
  const { t, months } = useT();
  const [lang] = useLang();
  const branch = useBranch();

  /* ---- Filtrlar ---- */
  const [range, setRange] = useState<DateRange>(monthPreset);
  const [compare, setCompare] = useState<CompareMode>("prevMonth");
  const [branchId, setBranchId] = useState("");
  const [cashboxId, setCashboxId] = useState("");
  const [cashView, setCashView] = useState<"chart" | "table">("chart");
  const [leadView, setLeadView] = useState<"chart" | "table">("chart");
  const [reportOpen, setReportOpen] = useState(false);

  const today = uzDateIso();
  const from = range.start ? isoOf(range.start) : today;
  const rawTo = range.start ? isoOf(range.end ?? range.start) : today;
  // Kelajak kunlar sanalmaydi — solishtirish ham shuncha kun bilan («1–12» ↔ «1–12»).
  const to = rawTo > today ? (from > today ? from : today) : rawTo;
  const period: DayRange = useMemo(() => ({ from, to }), [from, to]);
  const cmp = useMemo(() => compareRange(period, compare), [period, compare]);
  const monthsList = useMemo(() => lastMonths(to, 6), [to]);
  const chartFrom = `${monthsList[0]}-01`;
  const chartTo = monthEnd(to) > today ? today : monthEnd(to);
  const partialDay = to.slice(0, 7) === today.slice(0, 7) && chartTo === today ? Number(today.slice(8)) : null;

  /* ---- Kassalar (filial bo'yicha) ---- */
  const [cashboxes, setCashboxes] = useState<CashboxName[] | null>(null);
  useEffect(() => {
    let off = false;
    fetchJson<{ cashboxes: CashboxName[] }>("/api/cashboxes?names=1")
      .then((d) => {
        if (!off) setCashboxes(d.cashboxes);
      })
      .catch(() => {
        if (!off) setCashboxes([]);
      });
    return () => {
      off = true;
    };
  }, []);
  const chosenCashbox = cashboxes?.find((c) => String(c.id) === cashboxId) ?? null;
  const cbSet = useMemo<Set<number> | null>(() => {
    if (cashboxId) return new Set([Number(cashboxId)]);
    if (branchId) return new Set((cashboxes ?? []).filter((c) => c.branchId === Number(branchId)).map((c) => c.id));
    return null;
  }, [cashboxId, branchId, cashboxes]);
  // Lidlarda kassa yo'q — kassa tanlansa uning filiali.
  const leadBranch = branchId || (chosenCashbox?.branchId ? String(chosenCashbox.branchId) : "");

  /* ---- Pul: joriy, solishtirish, 6 oy ---- */
  const [money, setMoney] = useState<{ key: string; cur: SummaryRow[]; prev: SummaryRow[] | null; chart: SummaryRow[] } | null>(null);
  const [moneyError, setMoneyError] = useState(false);
  const [reload, setReload] = useState(0);
  const moneyKey = `${period.from}|${period.to}|${cmp?.from ?? ""}|${cmp?.to ?? ""}|${chartFrom}|${chartTo}|${reload}`;
  useEffect(() => {
    let off = false;
    const q = (o: Record<string, string>) => new URLSearchParams(o).toString();
    const sum = (r: DayRange, groupBy: string) => fetchJson<{ rows: SummaryRow[] }>(`/api/transactions/summary?${q({ groupBy, from: r.from, to: r.to })}`).then((d) => d.rows);
    Promise.all([
      sum(period, "sign,category,cashbox"),
      cmp ? sum(cmp, "sign,category,cashbox") : Promise.resolve(null),
      sum({ from: chartFrom, to: chartTo }, "month,sign,category,cashbox"),
    ])
      .then(([cur, prev, chart]) => {
        if (off) return;
        setMoney({ key: moneyKey, cur, prev, chart });
        setMoneyError(false);
      })
      .catch(() => {
        if (!off) setMoneyError(true);
      });
    return () => {
      off = true;
    };
  }, [moneyKey, period, cmp, chartFrom, chartTo]);

  /* ---- Lidlar ---- */
  const [leads, setLeads] = useState<{ key: string; data: LeadsResp } | null>(null);
  const [leadsError, setLeadsError] = useState(false);
  const leadsKey = `${period.from}|${period.to}|${cmp?.from ?? ""}|${cmp?.to ?? ""}|${leadBranch}|${reload}`;
  useEffect(() => {
    let off = false;
    const qs = new URLSearchParams({ from: period.from, to: period.to });
    if (cmp) {
      qs.set("cfrom", cmp.from);
      qs.set("cto", cmp.to);
    }
    if (leadBranch) qs.set("branchId", leadBranch);
    fetchJson<{ ok: true } & LeadsResp>(`/api/analytics/leads?${qs}`)
      .then((d) => {
        if (off) return;
        setLeads({ key: leadsKey, data: { period: d.period, compare: d.compare } });
        setLeadsError(false);
      })
      .catch(() => {
        if (!off) setLeadsError(true);
      });
    return () => {
      off = true;
    };
  }, [leadsKey, period, cmp, leadBranch]);

  /* ---- Hisoblar ---- */
  const moneyReady = !!money && (!branchId || cashboxes !== null);
  const cur = moneyReady ? moneyTotals(money.cur, cbSet) : null;
  const prev = moneyReady && money.prev ? moneyTotals(money.prev, cbSet) : null;
  const points: MonthPoint[] = useMemo(() => {
    if (!moneyReady) return monthsList.map((key) => ({ key, totals: { income: 0, expense: 0, net: 0 }, hasData: false }));
    const totals = monthlyMoney(money.chart, monthsList, cbSet);
    const has = new Set(money.chart.filter((r) => !cbSet || cbSet.has(Number(r.cashbox))).map((r) => r.month));
    return monthsList.map((key, i) => ({ key, totals: totals[i], hasData: has.has(key) }));
  }, [moneyReady, money, monthsList, cbSet]);
  const moneyStale = !!money && money.key !== moneyKey;
  const lead = leads?.data.period ?? null;
  const leadStale = !!leads && leads.key !== leadsKey;
  const conv = lead && lead.total ? (lead.joined / lead.total) * 100 : null;
  const prevConv = leads?.data.compare && leads.data.compare.total ? (leads.data.compare.joined / leads.data.compare.total) * 100 : null;

  /* ---- Yozuvlar ---- */
  const presetKey = rangePresetKey(range);
  const preset = presetKey ? dateRangePresets().find((p) => p.key === presetKey) : undefined;
  const effLabel = rangeLabel({ start: dateOf(from), end: dateOf(to) }, lang, t);
  const rangeText = preset && presetKey !== "today" && presetKey !== "yesterday" ? `${t(v2PresetLabel(preset))} · ${effLabel}` : effLabel;
  const periodWord = preset && presetKey !== "today" && presetKey !== "yesterday" ? t(v2PresetLabel(preset)) : effLabel;
  const branchName = (id: string) => branch.branches.find((b) => String(b.id) === id)?.name ?? "";
  const moneyScope = chosenCashbox ? chosenCashbox.name : branchId ? branchName(branchId) : t("Barcha filiallar");
  const leadScope = leadBranch ? branchName(leadBranch) : t("Barcha filiallar");
  const vs = cmp ? vsText(cmp, lang, t) : "";
  const noBase = cmp ? t("solishtirish davrida ma'lumot yo'q") : "";
  const curMonthName = (months[Number(today.slice(5, 7)) - 1] ?? "").toLowerCase();
  const chartSubtitle = [moneyScope, t("mln so'm"), partialDay ? t("{month} hali davom etmoqda ({n} kun)", { month: curMonthName, n: partialDay }) : ""].filter(Boolean).join(" · ");
  const leadSubtitle = lead
    ? `${leadBranch ? `${leadScope} · ` : ""}${t("{period} kelgan {n} ta lid qayerga yetib bordi va qaysi manba yaxshi ishladi", { period: periodWord, n: lead.total })}`
    : t("Lidlar qayerga yetib bordi va qaysi manba yaxshi ishladi");

  /* ---- Tanlovlar ---- */
  const compareOptions: V2SelectOption[] = [
    { value: "prevMonth", label: "o'tgan oy" },
    { value: "prevYear", label: "o'tgan yil" },
    { value: "prevPeriod", label: "oldingi davr" },
    { value: "none", label: "solishtirmaslik" },
  ];
  const branchOptions: V2SelectOption[] = [{ value: "", label: "Barchasi" }, ...branch.branches.map((b) => ({ value: String(b.id), label: b.name }))];
  const cashboxOptions: V2SelectOption[] = [
    { value: "", label: "Barchasi" },
    ...(cashboxes ?? [])
      .filter((c) => !branchId || c.branchId === Number(branchId))
      .map((c) => ({ value: String(c.id), label: c.name, hint: c.archived ? t("arxiv") : c.isPrimary ? t("bosh kassa") : undefined })),
  ];

  const errorBox = (onRetry: () => void) => (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-v2-lg border border-v2-danger/30 bg-v2-danger-bg px-4 py-3 text-v2-small text-v2-text">
      <span>{t("Ma'lumotni olib bo'lmadi. Internet aloqasini tekshirib, qayta urinib ko'ring.")}</span>
      <button type="button" onClick={onRetry} className={`${secondaryBtn} h-8`}>
        <RotateCw className="size-4" strokeWidth={1.75} aria-hidden />
        {t("Qayta urinish")}
      </button>
    </div>
  );

  const som = (n: number | undefined) => (
    <>
      <span className="text-[22px] font-semibold leading-8 text-v2-text">{n === undefined ? "—" : fmtSom(n)}</span>
      <span className="text-v2-small text-v2-text-2">{t("so'm")}</span>
    </>
  );

  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5">
      {/* 1. Sarlavha */}
      <div className="min-w-0">
        <h1 className="text-v2-page text-v2-text">{t("Moliya analitikasi")}</h1>
        <p className="mt-0.5 text-v2-small text-v2-text-2">{t("Pul qayerdan kelib, qayerga ketyapti va lidlar qanchalik o'quvchiga aylanyapti")}</p>
      </div>

      {/* 2. Filtrlar — hammasini qamraydi */}
      <div className="flex flex-wrap items-center gap-2">
        <V2DateRange value={range} onChange={setRange} align="start" allowAll={false} label={rangeText} />
        <V2Select variant="value" label="Solishtirish" value={compare} onChange={(v) => setCompare(v as CompareMode)} options={compareOptions} searchable={false} clearable={false} />
        <V2Select
          variant="value"
          label="Filial"
          value={branchId}
          onChange={(v) => {
            setBranchId(v);
            // Boshqa filialning kassasi tanlangan bo'lib qolmasin.
            const cb = cashboxes?.find((c) => String(c.id) === cashboxId);
            if (v && cb && cb.branchId !== Number(v)) setCashboxId("");
          }}
          options={branchOptions}
          searchable={false}
          clearable={false}
        />
        <V2Select variant="value" label="Kassa" value={cashboxId} onChange={setCashboxId} options={cashboxOptions} clearable={false} />
        <button type="button" onClick={() => setReportOpen(true)} className={`${secondaryBtn} ml-auto`}>
          <Download className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Hisobot yuklab olish")}
        </button>
      </div>

      {(moneyError || leadsError) && errorBox(() => setReload((n) => n + 1))}

      {/* 3. Ko'rsatkichlar */}
      <div className={`grid grid-cols-1 gap-px overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border shadow-v2-sm min-[40rem]:grid-cols-2 min-[80rem]:grid-cols-4 ${moneyStale || leadStale ? "[&>div]:opacity-70" : ""}`}>
        <Kpi label={t("Tushum")} delta={cur && cmp ? <Delta value={prev ? pctChange(cur.income, prev.income) : null} goodUp suffix="%" vs={vs} noBase={noBase} /> : undefined}>
          {som(cur?.income)}
        </Kpi>
        <Kpi label={t("Chiqim")} delta={cur && cmp ? <Delta value={prev ? pctChange(cur.expense, prev.expense) : null} goodUp={false} suffix="%" vs={vs} noBase={noBase} /> : undefined}>
          {som(cur?.expense)}
        </Kpi>
        <Kpi label={t("Sof foyda")} delta={cur && cmp ? <Delta value={prev ? pctChange(cur.net, prev.net) : null} goodUp suffix="%" vs={vs} noBase={noBase} /> : undefined}>
          <span className={`text-[22px] font-semibold leading-8 ${cur && cur.net < 0 ? "text-v2-danger" : "text-v2-text"}`}>{cur ? fmtSom(cur.net) : "—"}</span>
          <span className="text-v2-small text-v2-text-2">{t("so'm")}</span>
        </Kpi>
        <Kpi
          label={t("Lid → o'quvchi")}
          delta={lead && cmp ? <Delta value={conv !== null && prevConv !== null ? conv - prevConv : null} goodUp suffix={` ${t("p.p.")}`} vs={vs} noBase={noBase} /> : undefined}
        >
          <span className="text-[22px] font-semibold leading-8 text-v2-text">{conv === null ? (lead ? "0%" : "—") : `${Math.round(conv)}%`}</span>
          {lead && (
            <span className="text-v2-small tabular-nums text-v2-text-2">
              · {lead.joined} / {lead.total}
            </span>
          )}
        </Kpi>
      </div>

      {/* 4. Kirim va chiqim */}
      <AnalyticsCashChart points={points} partialDay={partialDay} subtitle={chartSubtitle} view={cashView} onView={setCashView} loading={!moneyReady} stale={moneyStale} />

      {/* 5. Lid → o'quvchi */}
      <AnalyticsLeadFunnel stats={lead} subtitle={leadSubtitle} view={leadView} onView={setLeadView} stale={leadStale} />

      {reportOpen && (
        <AnalyticsReportModal
          pageRange={period}
          pagePresetKey={presetKey}
          compare={compare}
          cbSet={cbSet}
          cashboxes={cashboxes ?? []}
          leadBranch={leadBranch}
          scopeLabel={moneyScope}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}
