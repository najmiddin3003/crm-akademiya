"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Download, FileText, Gift, Info, ShieldAlert } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import type { DateRange } from "@/components/ui/DateRangePicker";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import V2DateRange from "@/components/v2/ui/V2DateRange";
import V2Select from "@/components/v2/ui/V2Select";
import { panelTriggerCls } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { Meter, Panel } from "@/components/v2/reports/report35";
import { ErrorBanner, NoteLine } from "@/components/v2/reports/reportUi";
import { PageHead, PageShell } from "@/components/v2/students/lists/listKit";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import type { Bonus } from "@/lib/bonuses";
import type { CashboxName } from "@/lib/cashboxes";
import { fetchJson } from "@/lib/fetchJson";
import type { Penalty } from "@/lib/penalties";
import type { TransactionType } from "@/lib/transactionTypes";
import { cashflowRows, finIsoDay, finMonthToDate, type CashflowCatRow, type CashflowSlice, type CashflowTab } from "./finReportsCalc";
import { FIN_TH, finNum, finShare } from "./finReportsKit";

// YANGI VERSIYA — MOLIYA → «KIRIM CHIQIM» (/finance-cashflow, 28-qism moliya-A, rasmsiz —
// qo'shni v2 moliya sahifalari uslubida). Eski sahifa (components/finance/FinanceAnalyticsPage.tsx)
// bilan BIR XIL ma'lumot va hisob (./finReportsCalc.ts → cashflowRows):
//
//   1. sarlavha + o'ngda «Yuklab olish» (Excel / CSV — eski fayl bilan aynan bir xil);
//   2. filtrlar: davr (sukut — oy boshidan bugungacha, «Barcha sanalar» bor), Kassa, To'lov turi
//      (to'lov turi faqat Kirim/Chiqimga ta'sir qiladi — bonus/jarimada bunday maydon yo'q);
//   3. to'rt katak — Kirim · Chiqim · Bonus · Jarima: har birida davr summasi; bosilgani
//      pastdagi jadvalni almashtiradi (eski 4 tab o'rnida, tanlangani `brand-bg`);
//   4. «… turlari bo'yicha» — jadval: №, tur, ulush chizig'i, summa; «Jami» qatori. Eski donut
//      diagramma o'rnida ulush chizig'i (v2'da 8 rangli toifali palitra yo'q).
//
// Ma'lumot: /api/transactions/summary?groupBy=category,sign (kirim/chiqim — serverda yig'iladi),
// /api/bonuses, /api/penalties (sana va kassa bo'yicha shu yerda), /api/transaction-types,
// /api/cashboxes?names=1. Ruxsat — eski sahifadagidek route va API darajasida.

type TabDef = { key: CashflowTab; label: string; icon: ComponentType<{ className?: string; strokeWidth?: number }>; iconCls: string };

const TABS: TabDef[] = [
  { key: "kirim", label: "Kirim", icon: ArrowDownLeft, iconCls: "bg-v2-success-bg text-v2-success" },
  { key: "chiqim", label: "Chiqim", icon: ArrowUpRight, iconCls: "bg-v2-danger-bg text-v2-danger" },
  { key: "bonus", label: "Bonus", icon: Gift, iconCls: "bg-v2-violet-bg text-v2-violet" },
  { key: "jarima", label: "Jarima", icon: ShieldAlert, iconCls: "bg-v2-warning-bg text-v2-warning" },
];

export default function FinanceCashflowV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  // To'lov turi filtri — Sozlamalar → Moliya → To'lov turlari (eski sahifadagidek hammasi).
  const { methods: paymentMethods } = usePaymentMethods();
  const [tab, setTab] = useState<CashflowTab>("kirim");
  const [dateRange, setDateRange] = useState<DateRange>(() => finMonthToDate());
  const [cashboxId, setCashboxId] = useState("");
  const [payType, setPayType] = useState("");

  const [cashboxes, setCashboxes] = useState<CashboxName[]>([]);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [incomeCats, setIncomeCats] = useState<string[]>([]);
  const [expenseCats, setExpenseCats] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/cashboxes?names=1").then((r) => r.json()).then((d) => { if (d.ok) setCashboxes(d.cashboxes); }).catch(() => {});
    fetch("/api/bonuses").then((r) => r.json()).then((d) => { if (d.ok) setBonuses(d.bonuses); }).catch(() => {});
    fetch("/api/penalties").then((r) => r.json()).then((d) => { if (d.ok) setPenalties(d.penalties); }).catch(() => {});
    fetch("/api/transaction-types")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        const all = d.types as TransactionType[];
        setIncomeCats(Array.from(new Set(all.filter((tv) => tv.mainType === "kirim").map((tv) => tv.name))));
        setExpenseCats(Array.from(new Set(all.filter((tv) => tv.mainType === "chiqim").map((tv) => tv.name))));
      })
      .catch(() => {});
  }, []);

  /* ---- Kirim/Chiqim yig'indisi — serverdan (eski sahifadagi so'rov) ---- */
  const qs = new URLSearchParams({ groupBy: "category,sign" });
  if (dateRange.start) qs.set("from", finIsoDay(dateRange.start));
  if (dateRange.end) qs.set("to", finIsoDay(dateRange.end));
  if (cashboxId) qs.set("cashboxId", cashboxId);
  if (payType) qs.set("method", payType);
  const [reloadKey, setReloadKey] = useState(0);
  const query = qs.toString();
  const sumKey = `${query}#${reloadKey}`;
  const [sum, setSum] = useState<{ key: string; rows: CashflowCatRow[] } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchJson<{ rows: CashflowCatRow[] }>(`/api/transactions/summary?${query}`)
      .then((d) => {
        if (cancelled) return;
        setSum({ key: sumKey, rows: d.rows });
        setFailedKey(null);
      })
      .catch(() => {
        if (!cancelled) setFailedKey(sumKey);
      });
    return () => {
      cancelled = true;
    };
  }, [query, sumKey]);
  const error = failedKey === sumKey;
  const loading = !sum && !error;
  // Filtr o'zgarganda eski raqamlar yangisi kelguncha XIRA turadi (eski sahifada ham
  // oldingi raqamlar shu paytgacha turardi) — sakramaydi.
  const stale = !!sum && sum.key !== sumKey && !error;

  /* ---- Hisob ---- */
  const selectedCashboxId = cashboxId ? Number(cashboxId) : null;
  const catRows = useMemo(() => sum?.rows ?? [], [sum]);
  const byTab = useMemo(() => {
    const d = { catRows, incomeCats, expenseCats, bonuses, penalties, dateRange, cashboxId: selectedCashboxId };
    return {
      kirim: cashflowRows("kirim", d),
      chiqim: cashflowRows("chiqim", d),
      bonus: cashflowRows("bonus", d),
      jarima: cashflowRows("jarima", d),
    } satisfies Record<CashflowTab, CashflowSlice[]>;
  }, [catRows, incomeCats, expenseCats, bonuses, penalties, dateRange, selectedCashboxId]);
  const totalOf = (k: CashflowTab) => byTab[k].reduce((s, x) => s + x.value, 0);

  const slices = byTab[tab];
  const total = totalOf(tab);
  const shown = useMemo(() => slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value), [slices]);
  const zeroCount = slices.length - shown.length;
  const moneyTab = tab === "kirim" || tab === "chiqim";
  const tabDef = TABS.find((x) => x.key === tab) ?? TABS[0];

  /* ---- Yozuvlar ---- */
  const cashboxName = cashboxes.find((c) => String(c.id) === cashboxId)?.name ?? "";
  const scope = cashboxName || t("barcha kassalar");
  const panelTitle: Record<CashflowTab, string> = {
    kirim: t("Kirim turlari bo'yicha"),
    chiqim: t("Chiqim turlari bo'yicha"),
    bonus: t("Bonus turlari bo'yicha"),
    jarima: t("Jarima turlari bo'yicha"),
  };

  /* ---- Eksport — eski sahifadagi fayl bilan aynan bir xil (barcha turlar, ro'yxat tartibida) ---- */
  function exportCsv() {
    try {
      const rowsOut = [["Turlari", "Summa"].join(","), ...slices.map((s) => [`"${s.label.replace(/"/g, '""')}"`, s.value].join(","))];
      const blob = new Blob([rowsOut.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${tab}-${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess(t("CSV fayl yuklab olindi"));
    } catch {
      showError(t("CSV faylni yuklab bo'lmadi"));
    }
  }
  async function exportExcel() {
    try {
      // xlsx faqat bosilganda yuklanadi (boshlang'ich to'plamga kirmasin).
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(slices.map((s) => ({ Turlari: s.label, Summa: s.value })));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, tabDef.label);
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `${tab}-${date}.xlsx`);
      showSuccess(t("Excel fayl yuklab olindi"));
    } catch {
      showError(t("Excel faylni yuklab bo'lmadi"));
    }
  }
  const exportItems: ActionMenuEntry[] = [
    { key: "h", heading: t("{tab} · {n} ta tur", { tab: t(tabDef.label), n: slices.length }) },
    { key: "xls", label: t("Excel fayl"), hint: "XLSX", icon: Download, onSelect: () => void exportExcel() },
    { key: "csv", label: t("CSV fayl"), hint: "CSV", icon: FileText, onSelect: exportCsv },
  ];

  return (
    <PageShell flow>
      <PageHead
        title={t("Kirim chiqim")}
        subtitle={`${t("Pul qaysi turlarga tushdi va qaysi turlarga sarflandi")} · ${scope}`}
        actions={
          <ActionMenu items={exportItems} label={t("Yuklab olish")} width={232}>
            {(trigger, open) => (
              <button type="button" {...trigger} className={panelTriggerCls(open)}>
                <Download className="size-4 text-v2-text-2" strokeWidth={1.75} aria-hidden />
                {t("Yuklab olish")}
                <ChevronDown className={`size-4 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
              </button>
            )}
          </ActionMenu>
        }
      />

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
          value={payType}
          onChange={setPayType}
          options={[{ value: "", label: "Barchasi" }, ...paymentMethods.map((m) => ({ value: m.key, label: m.name }))]}
          searchable={false}
          clearable={false}
        />
      </div>

      {/* Kataklar — tab vazifasini ham bajaradi */}
      <div role="tablist" aria-label={t("Bo'lim")} className="grid grid-cols-2 gap-px overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border shadow-v2-sm min-[64rem]:grid-cols-4">
        {TABS.map((x) => {
          const on = x.key === tab;
          const Icon = x.icon;
          const money = x.key === "kirim" || x.key === "chiqim";
          const skeleton = money && loading;
          const unknown = money && error;
          const top = byTab[x.key].reduce<CashflowSlice | null>((best, s) => (s.value > 0 && (!best || s.value > best.value) ? s : best), null);
          return (
            <button
              key={x.key}
              type="button"
              role="tab"
              id={`fc-tab-${x.key}`}
              aria-selected={on}
              aria-controls="fc-panel"
              onClick={() => setTab(x.key)}
              className={`relative min-w-0 px-4 py-3.5 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--v2-brand)] ${
                on ? "bg-v2-brand-bg" : "bg-v2-surface hover:bg-v2-surface-2"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`inline-flex size-6 shrink-0 items-center justify-center rounded-v2-sm ${x.iconCls}`}>
                  <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className={`truncate text-v2-small ${on ? "font-semibold text-v2-brand-text" : "text-v2-text-2"}`}>{t(x.label)}</span>
              </span>
              {skeleton ? (
                <span className="mt-2 block h-6 w-28 rounded bg-v2-skeleton" aria-hidden />
              ) : (
                <span className={`mt-1 flex flex-wrap items-baseline gap-x-1.5 ${money && stale ? "opacity-60" : ""}`}>
                  <span className="whitespace-nowrap text-[18px] font-semibold leading-7 tabular-nums text-v2-text sm:text-[22px] sm:leading-8">{unknown ? "—" : finNum(totalOf(x.key))}</span>
                  {!unknown && <span className="text-v2-small text-v2-text-2">{t("so'm")}</span>}
                </span>
              )}
              <span className="mt-0.5 block truncate text-v2-caption font-normal text-v2-text-2">
                {skeleton ? " " : unknown ? t("yuklanmadi") : top ? t("eng kattasi — {name}", { name: t(top.label) }) : t("bu davrda yozuv yo'q")}
              </span>
              {on && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-v2-brand" aria-hidden />}
            </button>
          );
        })}
      </div>

      {/* Turlar bo'yicha */}
      <div role="tabpanel" id="fc-panel" aria-labelledby={`fc-tab-${tab}`} className="flex min-w-0 flex-col gap-2">
        {moneyTab && error ? (
          <ErrorBanner message="Ma'lumotni olib bo'lmadi. Internet aloqasini tekshirib, qayta urinib ko'ring." onRetry={() => setReloadKey((k) => k + 1)} />
        ) : (
          <Panel
            title={panelTitle[tab]}
            sub={`${t("Summalar so'mda")} · ${scope}`}
            right={
              !(moneyTab && loading) && shown.length > 0 ? (
                <span className="rounded-v2-full bg-v2-surface-2 px-2.5 py-0.5 text-v2-caption text-v2-text-2">{t("{n} ta tur", { n: shown.length })}</span>
              ) : undefined
            }
          >
            <div className={`relative max-h-[70vh] overflow-auto border-t border-v2-border transition-opacity ${moneyTab && stale ? "opacity-60" : ""}`}>
              <table className="w-full border-collapse text-v2-body">
                <caption className="sr-only">{panelTitle[tab]}</caption>
                <thead>
                  <tr>
                    <th scope="col" className={`${FIN_TH} w-12 text-left`}>
                      №
                    </th>
                    <th scope="col" className={`${FIN_TH} text-left`}>
                      {t("Tur")}
                    </th>
                    <th scope="col" className={`${FIN_TH} hidden w-[34%] text-left sm:table-cell`}>
                      {t("Ulushi")}
                    </th>
                    <th scope="col" className={`${FIN_TH} text-right`}>
                      {t("Summa")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {moneyTab && loading ? (
                    Array.from({ length: 5 }, (_, i) => (
                      <tr key={i} className="border-b border-v2-border last:border-b-0" aria-hidden>
                        <td className="px-4 py-3">
                          <span className="inline-block h-3 w-4 rounded bg-v2-skeleton" />
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block h-3 w-36 rounded bg-v2-skeleton" />
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <span className="block h-1.5 w-full rounded-full bg-v2-skeleton" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-block h-3 w-24 rounded bg-v2-skeleton" />
                        </td>
                      </tr>
                    ))
                  ) : shown.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center">
                        <div className="text-v2-body font-medium text-v2-text">{t("Ma'lumot topilmadi")}</div>
                        <div className="mt-0.5 text-v2-small text-v2-text-2">{t("Bu davrda shu bo'lim bo'yicha yozuv yo'q — davr yoki kassani o'zgartirib ko'ring.")}</div>
                      </td>
                    </tr>
                  ) : (
                    shown.map((s, i) => (
                      <tr key={s.label} className={`border-b border-v2-border ${ROW_TINT.hover}`}>
                        <td className="px-4 py-2.5 tabular-nums text-v2-text-3">{i + 1}</td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-v2-text [overflow-wrap:anywhere]">{t(s.label)}</div>
                          <div className="text-v2-caption font-normal tabular-nums text-v2-text-2 sm:hidden">{finShare(s.value, total)}</div>
                        </td>
                        <td className="hidden px-4 py-2.5 sm:table-cell">
                          <span className="flex items-center gap-3">
                            <Meter pct={(s.value / (total || 1)) * 100} tone={tab === "chiqim" ? "bg-v2-series-2" : "bg-v2-series-1"} />
                            <span className="w-12 shrink-0 text-right text-v2-caption font-normal tabular-nums text-v2-text-2">{finShare(s.value, total)}</span>
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-v2-text">{finNum(s.value)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {!(moneyTab && loading) && shown.length > 0 && (
                  <tfoot>
                    <tr className="bg-v2-surface-2 font-semibold">
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-v2-text">{t("Jami")}</td>
                      <td className="hidden px-4 py-3 text-v2-caption text-v2-text-2 sm:table-cell">100%</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-v2-text">
                        {finNum(total)} <span className="text-v2-small font-normal text-v2-text-2">{t("so'm")}</span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Panel>
        )}

        <div className="flex flex-col gap-1">
          {!(moneyTab && (loading || error)) && zeroCount > 0 && shown.length > 0 && <NoteLine>{t("Yana {n} ta turda bu davrda summa yo'q.", { n: zeroCount })}</NoteLine>}
          {moneyTab && <NoteLine>{t("Faqat «Tranzaksiya turi» ro'yxatidagi turlar ko'rsatiladi.")}</NoteLine>}
          {tab === "jarima" && <NoteLine>{t("Bekor qilingan jarimalar hisobga olinmaydi.")}</NoteLine>}
          {!moneyTab && payType && (
            <p className="flex items-start gap-1.5 text-v2-caption font-normal text-v2-text-2">
              <Info className="mt-px size-3.5 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
              <span>{t("To'lov turi filtri bonus va jarimaga ta'sir qilmaydi — bu yozuvlarda to'lov turi yo'q.")}</span>
            </p>
          )}
        </div>
      </div>
    </PageShell>
  );
}
