"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { ErrorBanner, KpiStrip, NoteLine } from "@/components/v2/reports/reportUi";
import { PageHead, PageShell } from "@/components/v2/students/lists/listKit";
import { fetchJson } from "@/lib/fetchJson";
import { pnlLines, pnlYearData, type MonthCatRow, type PnlLineKey } from "./finReportsCalc";
import { FIN_STICKY_LEFT, FIN_TH, FIN_TH_CORNER, FIN_TH_TOTAL, FinMonthSelect, FinYearNav, finNum } from "./finReportsKit";

// YANGI VERSIYA — MOLIYA → «MOLIYA HISOBOTLARI (P&L)» (/finance-pnl, 28-qism moliya-A, rasmsiz —
// Moliyaviy reja → «Foyda va zarar» va Hisobotlar → «Kirim va chiqim» uslubida). Eski sahifa
// (components/finance/PnlReportsPage.tsx) bilan BIR XIL so'rov va hisob (./finReportsCalc.ts →
// pnlYearData, pnlLines):
//
//   1. sarlavha; o'ngda yil («‹ 2026 ›»), oy («Oy: Butun yil» — bitta oyga toraytiradi) va Excel
//      (eski fayl bilan aynan bir xil: ustunlar, qatorlar tartibi, nom);
//   2. ko'rsatkichlar: Jami daromad · Jami xarajat · Sof foyda · Eng yaxshi oy (butun yilda);
//   3. jadval: DAROMAD (Dars bo'yicha, Boshqa → Jami daromad), XARAJATLAR (Boshqa → Jami xarajat),
//      Sof foyda (`brand-bg`, manfiy — `danger`), Foyda ulushi; ustunlar — oylar + Jami. Joriy
//      yilning kelgusi oylari xira «—» (eksportda — eskidagidek 0). Chap ustun qotgan (telefonda).
//
// Ma'lumot — /api/transactions/summary?groupBy=month,category,sign (tanlangan yil).

const SECTION = "px-4 pt-4 pb-1.5 text-v2-caption font-semibold uppercase tracking-wide text-v2-text-3";

export default function PnlReportsV2() {
  const { t, months: monthNames } = useT();
  const { showSuccess, showError } = useToast();
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState<number | null>(null);
  const [xlsxBusy, setXlsxBusy] = useState(false);

  /* ---- So'rov (eski sahifadagi) ---- */
  const [reloadKey, setReloadKey] = useState(0);
  const reqKey = `${year}#${reloadKey}`;
  const [got, setGot] = useState<{ key: string; rows: MonthCatRow[] } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ groupBy: "month,category,sign", from: `${year}-01-01`, to: `${year}-12-31` });
    fetchJson<{ rows: MonthCatRow[] }>(`/api/transactions/summary?${qs}`)
      .then((d) => {
        if (cancelled) return;
        setGot({ key: reqKey, rows: d.rows });
        setFailedKey(null);
      })
      .catch(() => {
        if (!cancelled) setFailedKey(reqKey);
      });
    return () => {
      cancelled = true;
    };
  }, [year, reqKey]);
  const error = failedKey === reqKey;
  const loading = !got && !error;
  // Boshqa yil so'ralayotganda eski raqamlar xira turadi (eski sahifada ham yangisi kelguncha turardi).
  const stale = !!got && got.key !== reqKey && !error;

  /* ---- Hisob ---- */
  const yearData = useMemo(() => pnlYearData(got?.rows ?? []), [got]);
  const shownMonths = month ? yearData.filter((m) => m.month === month) : yearData;
  const monthLabels = month ? [monthNames[month - 1]] : monthNames;
  const lines = useMemo(() => pnlLines(shownMonths), [shownMonths]);
  const line = (k: PnlLineKey) => lines.find((l) => l.key === k) ?? { key: k, label: "", values: [] as number[] };
  const total = (k: PnlLineKey) => line(k).values.reduce((s, v) => s + v, 0);
  const incomeTotal = total("income");
  const expenseTotal = total("expense");
  const netTotal = total("net");
  const share = (net: number, inc: number) => (inc > 0 ? `${Math.round((net / inc) * 100)}%` : "—");
  // Kelajak oy (joriy yilda bugundan keyingi) — hali harakat bo'lishi mumkin emas.
  const isFuture = (m: number) => year > thisYear || (year === thisYear && m > thisMonth);
  const monthNet = (i: number) => yearData[i].otherIncome + yearData[i].courseIncome - yearData[i].otherExpense;
  const monthIncome = (i: number) => yearData[i].otherIncome + yearData[i].courseIncome;
  // Eng yaxshi oy — harakati bor oylar ichida sof foydasi eng kattasi (butun yil ko'rinishida).
  let best: number | null = null;
  if (!month) {
    for (let i = 0; i < yearData.length; i++) {
      if (monthIncome(i) === 0 && yearData[i].otherExpense === 0) continue;
      if (best === null || monthNet(i) > monthNet(best)) best = i;
    }
  }

  /* ---- Eksport — eski sahifadagi fayl bilan aynan bir xil ---- */
  async function exportExcel() {
    setXlsxBusy(true);
    try {
      const XLSX = await import("xlsx");
      const header = ["Kategoriya", ...monthLabels, ...(month ? [] : ["Jami"])];
      const data = lines.map((r) => {
        const sum = r.values.reduce((s, v) => s + v, 0);
        const row: Record<string, string | number> = { Kategoriya: t(r.label) };
        monthLabels.forEach((label, i) => {
          row[label] = r.values[i];
        });
        if (!month) row["Jami"] = sum;
        return row;
      });
      const worksheet = XLSX.utils.json_to_sheet(data, { header });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "P&L");
      XLSX.writeFile(workbook, `pnl-hisoboti-${year}${month ? `-${String(month).padStart(2, "0")}` : ""}.xlsx`);
      showSuccess(t("Excel fayl yuklab olindi"));
    } catch {
      showError(t("Excel faylni yuklab bo'lmadi"));
    } finally {
      setXlsxBusy(false);
    }
  }

  /* ---- Jadval ---- */
  const cols = shownMonths.length + 1 + (month ? 0 : 1);
  const monthNums = shownMonths.map((m) => m.month);
  const cell = (v: number, m: number) => (isFuture(m) ? <span className="text-v2-text-3">—</span> : <span className={v < 0 ? "text-v2-danger" : ""}>{finNum(v)}</span>);

  const lineRow = (k: PnlLineKey) => {
    const l = line(k);
    return (
      <tr key={k} className="border-b border-v2-border">
        <td className={`${FIN_STICKY_LEFT} bg-v2-surface py-2.5 pl-8 pr-4 text-v2-text-2`}>{t(l.label)}</td>
        {l.values.map((v, i) => (
          <td key={monthNums[i]} className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-v2-text">
            {cell(v, monthNums[i])}
          </td>
        ))}
        {!month && <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-v2-text">{finNum(total(k))}</td>}
      </tr>
    );
  };
  const totalRow = (k: PnlLineKey, strong = false) => {
    const l = line(k);
    const bg = strong ? "bg-v2-brand-bg" : "bg-v2-surface";
    return (
      <tr key={k} className={`border-b border-v2-border font-semibold ${strong ? "bg-v2-brand-bg shadow-[inset_0_0_0_9999px_var(--v2-brand-bg)]" : ""}`}>
        <td className={`${FIN_STICKY_LEFT} ${bg} px-4 py-3 text-v2-text`}>{t(l.label)}</td>
        {l.values.map((v, i) => (
          <td key={monthNums[i]} className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-v2-text">
            {cell(v, monthNums[i])}
          </td>
        ))}
        {!month && <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${total(k) < 0 ? "text-v2-danger" : "text-v2-text"}`}>{finNum(total(k))}</td>}
      </tr>
    );
  };
  const sectionRow = (label: string) => (
    <tr className="border-b border-v2-border">
      <td className={`${FIN_STICKY_LEFT} bg-v2-surface ${SECTION}`}>{label}</td>
      <td colSpan={cols - 1} className={SECTION} />
    </tr>
  );

  const periodText = month ? `${monthNames[month - 1]} ${year}` : t("{year}-yil", { year });

  return (
    <PageShell flow>
      <PageHead
        title={t("Moliya hisobotlari (P&L)")}
        subtitle={`${t("Foyda va zarar · kassa usulida")} · ${periodText}`}
        actions={
          <>
            <FinYearNav
              value={year}
              onChange={(y) => {
                setYear(y);
                setMonth(null);
              }}
            />
            <FinMonthSelect value={month} onChange={setMonth} />
            <button type="button" onClick={() => void exportExcel()} disabled={!got || stale || xlsxBusy} className={`${secondaryBtn} disabled:opacity-50`}>
              {xlsxBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="size-4 text-v2-success" strokeWidth={1.75} aria-hidden />}
              Excel
            </button>
          </>
        }
      />

      {error ? (
        <ErrorBanner message="Ma'lumotni olib bo'lmadi. Internet aloqasini tekshirib, qayta urinib ko'ring." onRetry={() => setReloadKey((k) => k + 1)} />
      ) : (
        <>
          <div className={stale ? "opacity-60 transition-opacity" : ""}>
            <KpiStrip
              loading={loading}
              cells={[
                {
                  key: "i",
                  label: t("Jami daromad"),
                  value: finNum(incomeTotal),
                  unit: t("so'm"),
                  sub: t("dars bo'yicha {a} · boshqa {b}", { a: finNum(total("course")), b: finNum(total("otherIncome")) }),
                },
                { key: "e", label: t("Jami xarajat"), value: finNum(expenseTotal), unit: t("so'm"), sub: periodText },
                {
                  key: "n",
                  label: t("Sof foyda"),
                  value: finNum(netTotal),
                  unit: t("so'm"),
                  tone: netTotal < 0 ? "danger" : undefined,
                  sub: incomeTotal > 0 ? t("foyda ulushi {pct}", { pct: share(netTotal, incomeTotal) }) : t("kirim yo'q"),
                },
                ...(month
                  ? []
                  : [
                      {
                        key: "b",
                        label: t("Eng yaxshi oy"),
                        value: best === null ? null : monthNames[best],
                        sub: best === null ? t("harakat yo'q") : t("{sum} so'm foyda · {pct}", { sum: finNum(monthNet(best)), pct: share(monthNet(best), monthIncome(best)) }),
                      },
                    ]),
              ]}
            />
          </div>

          <section className={`relative overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm transition-opacity ${stale ? "opacity-60" : ""}`}>
            <div className="relative max-h-[75vh] overflow-auto">
              <table className="w-full border-collapse text-v2-body" style={{ minWidth: 220 + shownMonths.length * 124 + (month ? 0 : 140) }}>
                <caption className="sr-only">{t("Moliya hisobotlari (P&L)")}</caption>
                <thead>
                  <tr>
                    <th scope="col" className={`${FIN_TH_CORNER} w-[160px] min-w-[160px] sm:w-[220px] sm:min-w-[220px]`}>
                      {t("Kategoriya")}
                    </th>
                    {shownMonths.map((m, i) => (
                      <th key={m.month} scope="col" className={`${FIN_TH} text-right`}>
                        {year === thisYear && m.month === thisMonth ? (
                          <span className="inline-flex flex-col items-end leading-tight">
                            <span>{monthLabels[i]}</span>
                            <span className="font-normal text-v2-text-3">{t("hozircha")}</span>
                          </span>
                        ) : (
                          <span className={isFuture(m.month) ? "text-v2-text-3" : ""}>{monthLabels[i]}</span>
                        )}
                      </th>
                    ))}
                    {!month && (
                      <th scope="col" className={FIN_TH_TOTAL}>
                        {t("Jami")}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 7 }, (_, i) => (
                      <tr key={i} className="border-b border-v2-border last:border-b-0" aria-hidden>
                        <td className="px-4 py-3">
                          <span className="inline-block h-3 w-36 rounded bg-v2-skeleton" />
                        </td>
                        {Array.from({ length: cols - 1 }, (_, j) => (
                          <td key={j} className="px-4 py-3 text-right">
                            <span className="inline-block h-3 w-20 rounded bg-v2-skeleton" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <Fragment>
                      {sectionRow(t("Daromad"))}
                      {lineRow("course")}
                      {lineRow("otherIncome")}
                      {totalRow("income")}
                      {sectionRow(t("Xarajatlar"))}
                      {lineRow("otherExpense")}
                      {totalRow("expense")}
                      {totalRow("net", true)}
                      <tr>
                        <td className={`${FIN_STICKY_LEFT} bg-v2-surface px-4 py-2.5 text-v2-small text-v2-text-2`}>{t("Foyda ulushi")}</td>
                        {line("net").values.map((v, i) => (
                          <td key={monthNums[i]} className="px-4 py-2.5 text-right text-v2-small tabular-nums text-v2-text-2">
                            {isFuture(monthNums[i]) ? <span className="text-v2-text-3">—</span> : share(v, line("income").values[i])}
                          </td>
                        ))}
                        {!month && <td className="px-4 py-2.5 text-right text-v2-small font-semibold tabular-nums text-v2-text-2">{share(netTotal, incomeTotal)}</td>}
                      </tr>
                    </Fragment>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-col gap-1">
            <NoteLine>{t("Summalar so'mda. Kassa usuli: kirim va chiqim tushgan oyiga yoziladi; barcha kassalar amallari kiradi.")}</NoteLine>
            {year === thisYear && !month && <NoteLine>{t("Kelgusi oylar «—»: ular hali boshlanmagan.")}</NoteLine>}
          </div>
        </>
      )}
    </PageShell>
  );
}
