"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { ErrorBanner, KpiStrip, NoteLine } from "@/components/v2/reports/reportUi";
import { PageHead, PageShell } from "@/components/v2/students/lists/listKit";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { fetchJson } from "@/lib/fetchJson";
import type { TransactionType } from "@/lib/transactionTypes";
import { FLOW_OTHER_KEY, flowCategoryRows, flowComputed, flowMonthly, type FlowMonthRow, type MonthCatRow } from "./finReportsCalc";
import { FIN_STICKY_LEFT, FIN_TH, FIN_TH_CORNER, FinMonthSelect, FinYearNav, finNum } from "./finReportsKit";

// YANGI VERSIYA — MOLIYA → «PUL OQIMI» (/finance-flow, 28-qism moliya-A, rasmsiz — Moliyaviy reja
// va Hisobotlar → «Kirim va chiqim» uslubida). Eski sahifa (components/finance/CashFlowStatementPage.tsx)
// bilan BIR XIL so'rov va hisob (./finReportsCalc.ts → flowMonthly, flowComputed):
//
//   1. sarlavha; o'ngda yil («‹ 2026 ›»), oy («Oy: Butun yil») va Excel (eski fayl bilan aynan bir xil);
//   2. ko'rsatkichlar: Boshlang'ich balans · Kirim · Chiqim · Yakuniy balans;
//   3. jadval: Boshlang'ich balans → OPERATSION FAOLIYAT (Kirim — Jami + turlar, Chiqim — Jami +
//      turlar, Sof) → INVESTITSION / MOLIYAVIY FAOLIYAT («—»: tranzaksiyani bu bo'limlarga
//      ajratadigan belgi tizimda yo'q — 0 emas) → Yakuniy balans. «Kirim — Jami» / «Chiqim — Jami»
//      qatoridagi o'q turlarni yig'adi/yoyadi (sukut — yoyiq, eskidagidek). Turdagi nol — xira «0»
//      («—» faqat manbasi yo'q bo'limlar uchun). Chap ustun qotgan (telefonda).
//
// Ma'lumot — /api/transactions/summary?groupBy=month,category,sign&before=<yil boshi> (`before` —
// yanvarning boshlang'ich balansi) va /api/transaction-types (tur qatorlari).

const SECTION = "px-4 pt-4 pb-1.5 text-v2-caption font-semibold uppercase tracking-wide text-v2-text-3";

type Data = { key: string; rows: MonthCatRow[]; opening: number; incomeCats: string[]; expenseCats: string[] };

export default function CashFlowStatementV2() {
  const { t, months } = useT();
  const f = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [openIncome, setOpenIncome] = useState(true);
  const [openExpense, setOpenExpense] = useState(true);
  const [xlsxBusy, setXlsxBusy] = useState(false);

  /* ---- So'rov (eski sahifadagi ikkitasi) ---- */
  const [reloadKey, setReloadKey] = useState(0);
  const reqKey = `${year}#${reloadKey}`;
  const [got, setGot] = useState<Data | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ groupBy: "month,category,sign", from: `${year}-01-01`, to: `${year}-12-31`, before: `${year}-01-01` });
    Promise.all([
      fetchJson<{ rows: MonthCatRow[]; before: number }>(`/api/transactions/summary?${qs}`),
      fetchJson<{ types: TransactionType[] }>("/api/transaction-types"),
    ])
      .then(([sum, types]) => {
        if (cancelled) return;
        const all = types.types;
        setGot({
          key: reqKey,
          rows: sum.rows,
          opening: Number(sum.before) || 0,
          incomeCats: Array.from(new Set(all.filter((tv) => tv.mainType === "kirim").map((tv) => tv.name))),
          expenseCats: Array.from(new Set(all.filter((tv) => tv.mainType === "chiqim").map((tv) => tv.name))),
        });
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
  const stale = !!got && got.key !== reqKey && !error;

  /* ---- Hisob ---- */
  const incomeCats = useMemo(() => got?.incomeCats ?? [], [got]);
  const expenseCats = useMemo(() => got?.expenseCats ?? [], [got]);
  const computed = useMemo(() => flowComputed(flowMonthly(got?.rows ?? [], incomeCats, expenseCats), got?.opening ?? 0), [got, incomeCats, expenseCats]);
  const visible = month ? computed.filter((c) => c.month === month) : computed;
  const monthLabels = month ? [months[month - 1]] : months;
  const incomeRows = flowCategoryRows(visible, incomeCats, "income");
  const expenseRows = flowCategoryRows(visible, expenseCats, "expense");
  const hasOther = incomeRows.some((r) => r.key === FLOW_OTHER_KEY) || expenseRows.some((r) => r.key === FLOW_OTHER_KEY);

  const first = visible[0];
  const last = visible[visible.length - 1];
  const kirim = visible.reduce((s, v) => s + v.kirim, 0);
  const chiqim = visible.reduce((s, v) => s + v.chiqim, 0);
  const openingDate = f.dayMonth(`${year}-${String(month ?? 1).padStart(2, "0")}-01`);
  const periodText = month ? `${months[month - 1]} ${year}` : t("{year}-yil", { year });
  const signed = (v: number) => (Math.round(v) > 0 ? `+${finNum(v)}` : finNum(v));

  /* ---- Eksport — eski sahifadagi fayl bilan aynan bir xil ---- */
  async function exportExcel() {
    setXlsxBusy(true);
    try {
      const XLSX = await import("xlsx");
      const sheetRows: Record<string, string | number>[] = [];
      const pushRow = (label: string, values: (number | string)[]) => {
        const row: Record<string, string | number> = { Kategoriya: label };
        monthLabels.forEach((l, i) => {
          row[l] = values[i];
        });
        sheetRows.push(row);
      };
      pushRow("Boshlang'ich balans", visible.map((v) => v.opening));
      pushRow("Operatsion faoliyat", visible.map(() => ""));
      pushRow("Kirim — Jami", visible.map((v) => v.kirim));
      incomeRows.forEach(({ key, label }) => pushRow(label, visible.map((v) => v.income[key] || 0)));
      pushRow("Chiqim — Jami", visible.map((v) => v.chiqim));
      expenseRows.forEach(({ key, label }) => pushRow(label, visible.map((v) => v.expense[key] || 0)));
      pushRow("Sof", visible.map((v) => v.sof));
      // Manbasi yo'q bo'limlar — 0 emas «—» (eski fayldagidek; sarlavha nomlari takrorlanmasin — bo'shliq bilan).
      pushRow("Investitsion faoliyat", visible.map(() => ""));
      pushRow("Kirim — Jami ", visible.map(() => "—"));
      pushRow("Chiqim — Jami ", visible.map(() => "—"));
      pushRow("Sof ", visible.map(() => "—"));
      pushRow("Moliyaviy faoliyat", visible.map(() => ""));
      pushRow("Kirim — Jami  ", visible.map(() => "—"));
      pushRow("Chiqim — Jami  ", visible.map(() => "—"));
      pushRow("Sof  ", visible.map(() => "—"));
      pushRow("Yakuniy balans", visible.map((v) => v.closing));
      const worksheet = XLSX.utils.json_to_sheet(sheetRows, { header: ["Kategoriya", ...monthLabels] });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Pul oqimi");
      XLSX.writeFile(workbook, `pul-oqimi-${year}${month ? `-${String(month).padStart(2, "0")}` : ""}.xlsx`);
      showSuccess(t("Excel fayl yuklab olindi"));
    } catch {
      showError(t("Excel faylni yuklab bo'lmadi"));
    } finally {
      setXlsxBusy(false);
    }
  }

  /* ---- Jadval qatorlari ---- */
  const cols = visible.length + 1;
  const num = "whitespace-nowrap px-4 text-right tabular-nums";
  const money = (v: number, strong = false) => <span className={v < 0 ? "text-v2-danger" : strong ? "text-v2-text" : ""}>{finNum(v)}</span>;

  const balanceRow = (label: string, pick: (v: FlowMonthRow) => number, tone: "surface" | "brand") => {
    const bg = tone === "brand" ? "bg-v2-brand-bg" : "bg-v2-surface-2";
    return (
      <tr className={`border-b border-v2-border font-semibold ${bg} ${tone === "brand" ? "shadow-[inset_0_0_0_9999px_var(--v2-brand-bg)]" : "shadow-[inset_0_0_0_9999px_var(--v2-surface-2)]"}`}>
        <td className={`${FIN_STICKY_LEFT} ${bg} px-4 py-3 text-v2-text`}>{t(label)}</td>
        {visible.map((v) => (
          <td key={v.month} className={`${num} py-3 text-v2-text`}>
            {money(pick(v), true)}
          </td>
        ))}
      </tr>
    );
  };
  const sectionRow = (label: string) => (
    <tr className="border-b border-v2-border">
      <td className={`${FIN_STICKY_LEFT} bg-v2-surface ${SECTION}`}>{label}</td>
      <td colSpan={cols - 1} className={SECTION} />
    </tr>
  );
  const groupRow = (label: string, pick: (v: FlowMonthRow) => number, open: boolean | null, onToggle?: () => void, count?: number) => (
    <tr className="border-b border-v2-border font-semibold">
      <td className={`${FIN_STICKY_LEFT} bg-v2-surface px-4 py-2.5 text-v2-text`}>
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!!open}
            className="-mx-1 inline-flex items-center gap-1.5 rounded-v2-sm px-1 text-left hover:text-v2-brand-text focus-visible:outline-none focus-visible:shadow-v2-focus"
          >
            <ChevronDown className={`size-4 shrink-0 text-v2-text-3 transition-transform ${open ? "" : "-rotate-90"}`} strokeWidth={1.75} aria-hidden />
            {t(label)}
            {count !== undefined && <span className="font-normal text-v2-text-3">· {t("{n} ta tur", { n: count })}</span>}
          </button>
        ) : (
          <span className="pl-[22px]">{t(label)}</span>
        )}
      </td>
      {visible.map((v) => (
        <td key={v.month} className={`${num} py-2.5 text-v2-text`}>
          {open === null ? <span className="font-normal text-v2-text-3">—</span> : money(pick(v), true)}
        </td>
      ))}
    </tr>
  );
  const catRow = (key: string, label: string, side: "income" | "expense") => (
    <tr key={`${side}-${key}`} className="border-b border-v2-border">
      <td className={`${FIN_STICKY_LEFT} bg-v2-surface py-2.5 pl-[42px] pr-4 text-v2-text-2 [overflow-wrap:anywhere]`}>
        {t(label)}
      </td>
      {visible.map((v) => {
        const val = v[side][key] || 0;
        return (
          <td key={v.month} className={`${num} py-2.5 ${val === 0 ? "text-v2-text-3" : "text-v2-text"}`}>
            {money(val)}
          </td>
        );
      })}
    </tr>
  );
  const noSourceSection = (title: string) => (
    <>
      {sectionRow(title)}
      {groupRow("Kirim — Jami", () => 0, null)}
      {groupRow("Chiqim — Jami", () => 0, null)}
      {groupRow("Sof", () => 0, null)}
    </>
  );

  return (
    <PageShell flow>
      <PageHead
        title={t("Pul oqimi")}
        subtitle={`${t("Boshlang'ich balans, kirim, chiqim va yakuniy balans — oyma-oy")} · ${periodText}`}
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
                { key: "o", label: t("Boshlang'ich balans"), value: first ? finNum(first.opening) : null, unit: t("so'm"), tone: first && first.opening < 0 ? "danger" : undefined, sub: t("{date} holatiga", { date: openingDate }) },
                { key: "i", label: t("Kirim"), value: finNum(kirim), unit: t("so'm"), sub: t("operatsion faoliyat · {period}", { period: periodText }) },
                { key: "e", label: t("Chiqim"), value: finNum(chiqim), unit: t("so'm"), sub: t("operatsion faoliyat · {period}", { period: periodText }) },
                {
                  key: "c",
                  label: t("Yakuniy balans"),
                  value: last ? finNum(last.closing) : null,
                  unit: t("so'm"),
                  tone: last && last.closing < 0 ? "danger" : undefined,
                  sub: t("sof o'zgarish {sum} so'm", { sum: signed(kirim - chiqim) }),
                },
              ]}
            />
          </div>

          <section className={`relative overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm transition-opacity ${stale ? "opacity-60" : ""}`}>
            <div className="relative max-h-[75vh] overflow-auto">
              <table className="w-full border-collapse text-v2-body" style={{ minWidth: 240 + visible.length * 124 }}>
                <caption className="sr-only">{t("Pul oqimi hisoboti")}</caption>
                <thead>
                  <tr>
                    <th scope="col" className={`${FIN_TH_CORNER} w-[180px] min-w-[180px] sm:w-[260px] sm:min-w-[260px]`}>
                      {t("Kategoriya")}
                    </th>
                    {monthLabels.map((l) => (
                      <th key={l} scope="col" className={`${FIN_TH} text-right`}>
                        {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 9 }, (_, i) => (
                      <tr key={i} className="border-b border-v2-border last:border-b-0" aria-hidden>
                        <td className="px-4 py-3">
                          <span className="inline-block h-3 w-40 rounded bg-v2-skeleton" />
                        </td>
                        {Array.from({ length: cols - 1 }, (_, j) => (
                          <td key={j} className="px-4 py-3 text-right">
                            <span className="inline-block h-3 w-20 rounded bg-v2-skeleton" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <>
                      {balanceRow("Boshlang'ich balans", (v) => v.opening, "surface")}
                      {sectionRow(t("Operatsion faoliyat"))}
                      {groupRow("Kirim — Jami", (v) => v.kirim, openIncome, () => setOpenIncome((o) => !o), incomeRows.length)}
                      {openIncome && incomeRows.map((c) => catRow(c.key, c.label, "income"))}
                      {groupRow("Chiqim — Jami", (v) => v.chiqim, openExpense, () => setOpenExpense((o) => !o), expenseRows.length)}
                      {openExpense && expenseRows.map((c) => catRow(c.key, c.label, "expense"))}
                      {groupRow("Sof", (v) => v.sof, true)}
                      {noSourceSection(t("Investitsion faoliyat"))}
                      {noSourceSection(t("Moliyaviy faoliyat"))}
                      {balanceRow("Yakuniy balans", (v) => v.closing, "brand")}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-col gap-1">
            <NoteLine>{t("Summalar so'mda. Yanvarning boshlang'ich balansi — tanlangan yilgacha bo'lgan barcha amallar qoldig'i; keyingi oy oldingisining yakunidan boshlanadi.")}</NoteLine>
            <NoteLine>{t("Investitsion va moliyaviy faoliyat «—»: tranzaksiyani bu bo'limlarga ajratadigan belgi tizimda yo'q (bu nol degani emas).")}</NoteLine>
            {hasOther && <NoteLine>{t("«Boshqa» — «Tranzaksiya turi» ro'yxatida yo'q (o'chirilgan yoki nomi o'zgargan) turlardagi pul.")}</NoteLine>}
          </div>
        </>
      )}
    </PageShell>
  );
}
