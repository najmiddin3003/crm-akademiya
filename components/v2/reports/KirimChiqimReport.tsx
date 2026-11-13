"use client";

import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowLeftRight, ArrowUp, BarChart3, Calendar, ChevronDown, ChevronLeft, ChevronRight, Clock, Crown, Info } from "lucide-react";
import Link from "@/components/ui/Link";
import { useBranch } from "@/components/shared/BranchContext";
import { useLang, useT } from "@/components/shared/Language";
import { methodDot } from "@/components/v2/form/fields";
import { useCanOpen, useShell } from "@/components/v2/shell/ShellContext";
import FloatingPanel from "@/components/v2/ui/FloatingPanel";
import V2Select from "@/components/v2/ui/V2Select";
import { panelTriggerCls } from "@/components/v2/ui/buttons";
import { useTransactionTypes } from "@/hooks/useTransactionTypes";
import { branchBuildingLabel } from "@/lib/branchPools";
import type { CashboxName } from "@/lib/cashboxes";
import { moneyTotals, monthlyMoney, type SummaryRow } from "@/lib/financeAnalytics";
import { MONTHS_SHORT } from "@/lib/i18n";
import type { CashMonthBox, CashMonthReport } from "@/lib/reportCashboxMonth";
import type { ReportDef } from "@/lib/reportsCatalog";
import { uzTimeHm } from "@/lib/uzTime";
import { bestMonth, cashboxVisible, categoryMatrix, sharePct, type CashCells, type CatRow } from "./kirimChiqimCalc";
import { CENTER_NAME, DOC_FOOTER, useReportData, useReportFmt, useToday } from "./reportHooks";
import { fileSafe, fmtNum, fmtSigned, monthEnd, monthRangeLabel, monthsBetween, shiftMonth, type MonthRange } from "./reportFormat";
import type { Cell, ExportDoc } from "./reportExport";
import { ErrorBanner, KpiStrip, ReportShell } from "./reportUi";
import V2MonthRange from "./V2MonthRange";

// YANGI VERSIYA — HISOBOTLAR → MOLIYA → «KIRIM VA CHIQIM» (26-qism, rasmlar 35–38,
// 13.11.2026). Ikki tab:
//
//   1. TOIFALAR («oylar bo'yicha») — qatorlar toifalar («↓ Kirim · N toifa», «↑ Chiqim ·
//      N toifa»), ustunlar oylar va «Jami»; pastda «Jami kirim/chiqim», «Sof foyda»,
//      «Foyda ulushi». Tugamagan oy xira («Oktabr* 1–12»). Grafik YO'Q — o'ngda «Grafiklar
//      — Moliya analitikasida» havolasi. Raqamlar Moliya analitikasi bilan BIR hisob:
//      /api/transactions/summary + addMoney qoidasi (./kirimChiqimCalc.ts). Toifa ostidagi
//      izoh («to'lov qabul qilishdan», «oylik chiqarishdan») — faqat tur haqiqatan o'sha
//      oqimdan yozilganda (/api/transaction-types, ./kirimChiqimCalc.ts → categoryFlow).
//
//   2. KASSALAR («qoldiq va ko'chirish») — bitta oy: kassa × to'lov turi bo'yicha oy
//      boshidagi qoldiq, kirim, chiqim, ko'chirish va oy oxiridagi (joriy oyda — hozirgi)
//      qoldiq. /api/reports/cashbox-month (lib/reportCashboxMonth.ts): hozirgi qoldiq
//      Moliya → Kassalar bilan AYNAN bir xil, oy boshi — orqaga hisob. Qamrov Kassalar
//      sahifasidagidek: admin hammasini, xodim faqat o'z kassasini ko'radi.
//
// Rasmdagi «bugun ishga kelmadi» (kassa egasi davomati) — kiritilmadi (savollarda).
// Eksport (Excel/PDF) — faol tabning jadvali.

type Tab = "toifalar" | "kassalar";

export default function KirimChiqimReport({ report, author }: { report: ReportDef; author: string }) {
  const today = useToday();
  const cur = today.slice(0, 7);
  const [tab, setTab] = useState<Tab>("toifalar");
  const [range, setRange] = useState<MonthRange>({ from: shiftMonth(cur, -5), to: cur });
  const [branchId, setBranchId] = useState("");
  const [cashboxId, setCashboxId] = useState("");
  const [month, setMonth] = useState(cur);
  const tabs = <TabBar tab={tab} onChange={setTab} />;
  return tab === "toifalar" ? (
    <ToifalarTab report={report} author={author} tabs={tabs} today={today} range={range} setRange={setRange} branchId={branchId} setBranchId={setBranchId} cashboxId={cashboxId} setCashboxId={setCashboxId} />
  ) : (
    <KassalarTab report={report} author={author} tabs={tabs} today={today} month={month} setMonth={setMonth} branchId={branchId} setBranchId={setBranchId} />
  );
}

/* ───────────────────────── Umumiy bo'laklar ───────────────────────── */

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const { t } = useT();
  const items: { key: Tab; label: string; hint: string }[] = [
    { key: "toifalar", label: t("Toifalar"), hint: t("oylar bo'yicha") },
    { key: "kassalar", label: t("Kassalar"), hint: t("qoldiq va ko'chirish") },
  ];
  return (
    <div role="tablist" aria-label={t("Hisobot ko'rinishi")} className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-v2-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((x) => {
        const on = tab === x.key;
        return (
          <button
            key={x.key}
            type="button"
            role="tab"
            id={`kc-tab-${x.key}`}
            aria-selected={on}
            aria-controls="kc-panel"
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(x.key)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const next = items[(items.findIndex((y) => y.key === tab) + 1) % items.length];
              onChange(next.key);
              requestAnimationFrame(() => document.getElementById(`kc-tab-${next.key}`)?.focus());
            }}
            className={`relative inline-flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-v2-body transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
              on ? "font-semibold text-v2-text" : "text-v2-text-2 hover:text-v2-text"
            }`}
          >
            {x.label}
            <span className="text-v2-caption font-normal text-v2-text-3">{x.hint}</span>
            {on && <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-t-full bg-v2-brand" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

/** Ruxsat bo'lsa havola, bo'lmasa oddiy matn (rol sahifani ko'ra olmasa — o'lik havola bo'lmasin). */
function PageLink({ href, children }: { href: string; children: ReactNode }) {
  const can = useCanOpen(href);
  if (!can) return <span className="font-medium text-v2-text">{children}</span>;
  return (
    <Link href={href} className="rounded-v2-sm font-medium text-v2-brand-text hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus">
      {children}
    </Link>
  );
}

/** «… {link} …» — matn bitta kalit (tarjima butun gap bo'yicha), havola o'rtada. */
function LinkSentence({ text, href, label }: { text: string; href: string; label: string }) {
  const [pre, post = ""] = text.split("{link}");
  return (
    <>
      {pre}
      <PageLink href={href}>{label}</PageLink>
      {post}
    </>
  );
}

function Note({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-v2-caption font-normal text-v2-text-2">
      <span className="mt-px shrink-0 [&>svg]:size-3.5">{icon}</span>
      <span>{children}</span>
    </p>
  );
}

/** Sarlavha ostidagi izoh: «barcha filiallar · kunlik yozuvlar — Moliya → Kirim-chiqim». */
function Subtitle({ scope }: { scope: string }) {
  const { t } = useT();
  return (
    <>
      {scope} · {t("kunlik yozuvlar")} — <PageLink href="/finance-cashflow">{t("Moliya → Kirim-chiqim")}</PageLink>
    </>
  );
}

/** Filiallar (bino yorlig'i bilan) — Moliya analitikasidagidek. */
function useBranchOptions() {
  const branch = useBranch();
  const { t } = useT();
  return useMemo(() => {
    const word = (n: number) => t("{n}-bino", { n });
    return branch.branches.map((b) => ({ value: String(b.id), label: branchBuildingLabel(b, word) }));
  }, [branch.branches, t]);
}

/** Bitta oy tanlagichi: «📅 Oktabr 2026 ⌄» — oynada yil va 12 oy, kelajak oy yopiq. */
function MonthPick({ value, onChange, max }: { value: string; onChange: (m: string) => void; max: string }) {
  const [lang] = useLang();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const btnRef = useRef<HTMLButtonElement>(null);
  const maxYear = Number(max.slice(0, 4));
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setYear(Number(value.slice(0, 4)));
          setOpen((o) => !o);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={panelTriggerCls(open)}
      >
        <Calendar className="size-4 text-v2-text-2" strokeWidth={1.75} aria-hidden />
        <span className="whitespace-nowrap font-semibold tabular-nums">{monthRangeLabel({ from: value, to: value }, lang)}</span>
        <ChevronDown className={`size-4 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
      </button>
      <FloatingPanel open={open} anchorRef={btnRef} onClose={() => setOpen(false)} width={272} role="dialog" ariaLabel={t("Oyni tanlang")}>
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setYear((y) => y - 1)} aria-label={t("Oldingi yil")} className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-hover hover:text-v2-text">
              <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
            <span className="text-v2-body font-semibold tabular-nums text-v2-text">{year}</span>
            <button
              type="button"
              onClick={() => setYear((y) => Math.min(maxYear, y + 1))}
              disabled={year >= maxYear}
              aria-label={t("Keyingi yil")}
              className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-hover hover:text-v2-text disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS_SHORT[lang].map((m, i) => {
              const key = `${year}-${String(i + 1).padStart(2, "0")}`;
              const on = key === value;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={key > max}
                  aria-pressed={on}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                    btnRef.current?.focus();
                  }}
                  className={`h-9 rounded-v2-md text-v2-body transition-colors disabled:cursor-not-allowed disabled:text-v2-text-3 disabled:opacity-50 ${
                    on ? "bg-v2-brand font-semibold text-v2-on-brand" : "text-v2-text hover:bg-v2-hover"
                  } ${key === max && !on ? "font-semibold text-v2-brand-text" : ""}`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      </FloatingPanel>
    </>
  );
}

/* ───────────────────────── 1. Toifalar ───────────────────────── */

function ToifalarTab(p: {
  report: ReportDef;
  author: string;
  tabs: ReactNode;
  today: string;
  range: MonthRange;
  setRange: (r: MonthRange) => void;
  branchId: string;
  setBranchId: (v: string) => void;
  cashboxId: string;
  setCashboxId: (v: string) => void;
}) {
  const { report, author, today, range, branchId, cashboxId } = p;
  const { t } = useT();
  const [lang] = useLang();
  const f = useReportFmt();
  const cur = today.slice(0, 7);
  const [loadedAt] = useState(() => uzTimeHm());
  const branchOptions = useBranchOptions();
  const { types } = useTransactionTypes();
  const canAnalytics = useCanOpen("/finance-analytics");

  const from = `${range.from}-01`;
  const to = monthEnd(range.to) > today ? today : monthEnd(range.to);
  const months = useMemo(() => monthsBetween(range.from, range.to > cur ? cur : range.to), [range.from, range.to, cur]);
  const cash = useReportData<{ cashboxes: CashboxName[] }>("/api/cashboxes?names=1");
  const cashboxes = useMemo(() => cash.data?.cashboxes ?? [], [cash.data]);
  const cbSet = useMemo<Set<number> | null>(() => {
    if (cashboxId) return new Set([Number(cashboxId)]);
    if (branchId) return new Set(cashboxes.filter((c) => c.branchId === Number(branchId)).map((c) => c.id));
    return null;
  }, [cashboxId, branchId, cashboxes]);
  const cashboxOptions = cashboxes
    .filter((c) => !branchId || c.branchId === Number(branchId))
    .map((c) => ({ value: String(c.id), label: c.name, hint: c.archived ? t("arxiv") : undefined }));
  const scopeName = cashboxId
    ? (cashboxes.find((c) => String(c.id) === cashboxId)?.name ?? "")
    : branchId
      ? (branchOptions.find((b) => b.value === branchId)?.label ?? "")
      : t("barcha filiallar");

  const sum = useReportData<{ rows: SummaryRow[] }>(`/api/transactions/summary?${new URLSearchParams({ groupBy: "month,sign,category,cashbox", from, to })}`);
  const ready = !!sum.data && !!cash.data;
  const rows = useMemo(() => sum.data?.rows ?? [], [sum.data]);
  const matrix = useMemo(() => categoryMatrix(rows, months, cbSet, types), [rows, months, cbSet, types]);
  const monthly = useMemo(() => monthlyMoney(rows, months, cbSet), [rows, months, cbSet]);
  const totals = useMemo(() => moneyTotals(rows, cbSet), [rows, cbSet]);

  const partialIdx = months.length > 0 && months[months.length - 1] === cur && to < monthEnd(cur) ? months.length - 1 : null;
  const multiYear = months.length > 0 && months[0].slice(0, 4) !== months[months.length - 1].slice(0, 4);
  const monthHead = (m: string) => (multiYear ? `${f.monthName(m)} ${m.slice(0, 4)}` : f.monthName(m));
  const best = bestMonth(months, monthly, partialIdx);
  const top = matrix.expense[0] ?? null;
  const topPct = top ? sharePct(top.total, totals.expense) : null;
  const margin = sharePct(totals.net, totals.income);
  const lastDay = Number(to.slice(8, 10));
  const periodText = (() => {
    if (months.length === 0) return "";
    const a = f.monthLower(months[0]);
    const b = partialIdx !== null ? f.dayMonth(to) : f.monthLower(months[months.length - 1]);
    return months.length === 1 && partialIdx === null ? a : `${a} – ${b}`;
  })();
  const pctText = (p: number | null) => (p === null ? "—" : `${p}%`);
  const flowText = (r: CatRow) => (r.flow === "payments" ? t("to'lov qabul qilishdan") : r.flow === "payroll" ? t("oylik chiqarishdan") : null);

  function getDoc(): ExportDoc | null {
    if (!ready) return null;
    const head = months.map((m, i) => ({ label: i === partialIdx ? `${monthHead(m)}* 1–${lastDay}` : monthHead(m), numeric: true }));
    const columns = [{ label: t("Toifa") }, ...head, { label: t("Jami"), numeric: true }];
    const line = (name: string, vals: number[], total: number): Cell[] => [name, ...vals, total];
    return {
      title: t("{name} hisoboti", { name: t(report.title) }),
      fileBase: `${fileSafe(t(report.title))}-${fileSafe(t("Toifalar"))}-${to}`,
      center: t(CENTER_NAME),
      branchLabel: scopeName,
      dateLabel: f.fullDate(today),
      author,
      filters: [t("Toifalar"), monthRangeLabel(range, lang), scopeName].join(" · "),
      kpis: [
        { label: t("Kirim"), value: `${fmtNum(totals.income)} ${t("so'm")}` },
        { label: t("Chiqim"), value: `${fmtNum(totals.expense)} ${t("so'm")}` },
        { label: t("Sof foyda"), value: `${fmtNum(totals.net)} ${t("so'm")}` },
        { label: t("Foyda ulushi"), value: pctText(margin) },
      ],
      sections: [
        {
          title: t("Kirim"),
          columns,
          rows: matrix.income.map((r) => line(r.name, r.byMonth, r.total)),
          total: line(t("Jami kirim"), monthly.map((m) => m.income), totals.income),
        },
        {
          title: t("Chiqim"),
          columns,
          rows: matrix.expense.map((r) => line(r.name, r.byMonth, r.total)),
          total: line(t("Jami chiqim"), monthly.map((m) => m.expense), totals.expense),
        },
        {
          title: t("Natija"),
          columns,
          rows: [line(t("Sof foyda"), monthly.map((m) => m.net), totals.net), [t("Foyda ulushi"), ...monthly.map((m) => pctText(sharePct(m.net, m.income))), pctText(margin)]],
        },
      ],
      notes: [
        ...(partialIdx !== null ? [t("* {month} hali tugamagan — {stamp} holatiga.", { month: f.monthName(cur), stamp: f.stamp(today, loadedAt) })] : []),
        t("Oy yakunlari Moliya analitikasidagi grafik bilan bir xil: bekor qilingan amal teskari yozuv bilan ayriladi."),
      ],
      footer: DOC_FOOTER,
    };
  }

  const loading = !ready && !sum.error;
  return (
    <ReportShell
      report={report}
      subtitle={<Subtitle scope={scopeName} />}
      tabs={p.tabs}
      getDoc={getDoc}
      exportReady={ready && !sum.stale}
      filters={
        <>
          <V2MonthRange value={range} onChange={p.setRange} max={cur} />
          <V2Select
            variant="value"
            label={t("Filial")}
            emptyLabel="Barchasi"
            value={branchId}
            onChange={(v) => {
              p.setBranchId(v);
              p.setCashboxId("");
            }}
            options={branchOptions}
            searchable={false}
          />
          <V2Select variant="value" label={t("Kassa")} emptyLabel="Barchasi" value={cashboxId} onChange={p.setCashboxId} options={cashboxOptions} />
        </>
      }
      filtersEnd={
        canAnalytics ? (
          <Link href="/finance-analytics" className="inline-flex h-9 items-center gap-1.5 rounded-v2-md px-1 text-v2-small font-medium text-v2-brand-text hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus">
            <BarChart3 className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Grafiklar — Moliya analitikasida")}
          </Link>
        ) : undefined
      }
    >
      <div role="tabpanel" id="kc-panel" aria-labelledby="kc-tab-toifalar" className="flex min-w-0 flex-col gap-4">
        {(sum.error || cash.error) && <ErrorBanner message="Hisobot yuklanmadi" onRetry={() => (sum.error ? sum.reload() : cash.reload())} />}
        <div className={sum.stale ? "opacity-60 transition-opacity" : ""}>
          <KpiStrip
            loading={loading}
            cells={[
              { key: "i", label: t("Kirim"), value: fmtNum(totals.income), unit: t("so'm"), sub: months.length ? `${periodText} · ${t("{n} oy", { n: months.length })}` : undefined },
              {
                key: "e",
                label: t("Chiqim"),
                value: fmtNum(totals.expense),
                unit: t("so'm"),
                sub: top ? t("eng kattasi — {name}, {pct}", { name: top.name, pct: pctText(topPct) }) : t("xarajat yo'q"),
              },
              {
                key: "n",
                label: t("Sof foyda"),
                value: fmtNum(totals.net),
                unit: t("so'm"),
                tone: totals.net < 0 ? "danger" : undefined,
                sub: margin === null ? t("kirim yo'q") : t("foyda ulushi {pct}", { pct: pctText(margin) }),
              },
              {
                key: "b",
                label: t("Eng yaxshi oy"),
                value: best === null ? null : monthHead(months[best]),
                sub:
                  best === null
                    ? t("harakat yo'q")
                    : t("{sum} so'm foyda · {pct}", { sum: fmtNum(monthly[best].net), pct: pctText(sharePct(monthly[best].net, monthly[best].income)) }),
              },
            ]}
          />
        </div>
        <div className={sum.stale ? "opacity-60 transition-opacity" : ""}>
          <CategoryTable months={months} monthHead={monthHead} partialIdx={partialIdx} lastDay={lastDay} matrix={matrix} monthly={monthly} totals={totals} loading={loading} flowText={flowText} />
        </div>
        <div className="flex flex-col gap-1">
          {partialIdx !== null && (
            <Note icon={<Clock strokeWidth={1.75} aria-hidden />}>{t("* {month} hali tugamagan — {stamp} holatiga.", { month: f.monthName(cur), stamp: f.stamp(today, loadedAt) })}</Note>
          )}
          <Note icon={<Info strokeWidth={1.75} aria-hidden />}>
            <LinkSentence text={t("Oy yakunlari Moliya analitikasidagi grafik bilan bir xil. Har bir summa ortidagi amallar — {link}.")} href="/finance-cashflow" label={t("Moliya → Kirim-chiqim")} />
          </Note>
        </div>
      </div>
    </ReportShell>
  );
}

function CategoryTable({
  months,
  monthHead,
  partialIdx,
  lastDay,
  matrix,
  monthly,
  totals,
  loading,
  flowText,
}: {
  months: string[];
  monthHead: (m: string) => string;
  partialIdx: number | null;
  lastDay: number;
  matrix: { income: CatRow[]; expense: CatRow[] };
  monthly: { income: number; expense: number; net: number }[];
  totals: { income: number; expense: number; net: number };
  loading: boolean;
  flowText: (r: CatRow) => string | null;
}) {
  const { t } = useT();
  const cols = months.length + 2;
  const muted = (i: number) => (i === partialIdx ? "text-v2-text-3" : "");
  const num = "px-4 py-2.5 text-right tabular-nums whitespace-nowrap";
  const cellVal = (v: number) => (Math.round(v) === 0 ? <span className="text-v2-text-3">—</span> : fmtNum(v));
  const empty = !loading && matrix.income.length === 0 && matrix.expense.length === 0;

  const group = (kind: "income" | "expense", list: CatRow[]) => (
    <Fragment key={kind}>
      <tr className="border-b border-v2-border bg-v2-surface-2/60">
        <td colSpan={cols} className="px-4 py-1.5 text-v2-caption font-medium text-v2-text-2">
          <span className="inline-flex items-center gap-1.5">
            {kind === "income" ? <ArrowDown className="size-3.5" strokeWidth={1.75} aria-hidden /> : <ArrowUp className="size-3.5" strokeWidth={1.75} aria-hidden />}
            <span className="font-semibold text-v2-text">{kind === "income" ? t("Kirim") : t("Chiqim")}</span>
            <span>· {t("{n} toifa", { n: list.length })}</span>
          </span>
        </td>
      </tr>
      {list.map((r) => {
        const sub = flowText(r);
        return (
          <tr key={`${kind}-${r.name}`} className="border-b border-v2-border">
            <td className="max-w-[260px] px-4 py-2.5 align-middle">
              <div className="font-medium text-v2-text">{r.name}</div>
              {sub && <div className="text-v2-caption font-normal text-v2-text-3">{sub}</div>}
            </td>
            {r.byMonth.map((v, i) => (
              <td key={months[i]} className={`${num} ${muted(i)}`}>
                {cellVal(v)}
              </td>
            ))}
            <td className={`${num} font-semibold text-v2-text`}>{fmtNum(r.total)}</td>
          </tr>
        );
      })}
      <tr className="border-b border-v2-border font-semibold">
        <td className="px-4 py-2.5">{kind === "income" ? t("Jami kirim") : t("Jami chiqim")}</td>
        {monthly.map((m, i) => (
          <td key={months[i]} className={`${num} ${muted(i)}`}>
            {fmtNum(kind === "income" ? m.income : m.expense)}
          </td>
        ))}
        <td className={num}>{fmtNum(kind === "income" ? totals.income : totals.expense)}</td>
      </tr>
    </Fragment>
  );

  return (
    <section className="relative overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
      <div className="relative overflow-x-auto">
        <table className="w-full border-collapse text-v2-body" style={{ minWidth: 240 + months.length * 112 + 128 }}>
          <caption className="sr-only">{t("Toifalar bo'yicha kirim va chiqim")}</caption>
          <thead>
            <tr className="border-b border-v2-border bg-v2-surface-2">
              <th scope="col" className="h-9 px-4 text-left text-v2-caption font-medium text-v2-text-2">
                {t("Toifa")}
              </th>
              {months.map((m, i) => (
                <th key={m} scope="col" className={`h-9 px-4 text-right text-v2-caption font-medium ${i === partialIdx ? "text-v2-text-3" : "text-v2-text-2"}`}>
                  {i === partialIdx ? (
                    <span className="inline-flex flex-col items-end leading-tight">
                      <span>{monthHead(m)}*</span>
                      <span className="font-normal tabular-nums">1–{lastDay}</span>
                    </span>
                  ) : (
                    monthHead(m)
                  )}
                </th>
              ))}
              <th scope="col" className="h-9 px-4 text-right text-v2-caption font-semibold text-v2-text">
                {t("Jami")}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i} className="border-b border-v2-border last:border-b-0" aria-hidden>
                  <td className="px-4 py-3">
                    <span className="inline-block h-3 w-32 rounded bg-v2-skeleton" />
                  </td>
                  {Array.from({ length: cols - 1 }, (_, j) => (
                    <td key={j} className="px-4 py-3 text-right">
                      <span className="inline-block h-3 w-16 rounded bg-v2-skeleton" />
                    </td>
                  ))}
                </tr>
              ))
            ) : empty ? (
              <tr>
                <td colSpan={cols} className="px-4 py-10 text-center text-v2-small text-v2-text-2">
                  {t("Bu davrda kirim yoki chiqim yo'q")}
                </td>
              </tr>
            ) : (
              <>
                {group("income", matrix.income)}
                {group("expense", matrix.expense)}
                <tr className="border-b border-v2-border bg-v2-brand-bg font-semibold">
                  <td className="px-4 py-3 text-v2-text">{t("Sof foyda")}</td>
                  {monthly.map((m, i) => (
                    <td key={months[i]} className={`${num} py-3 ${m.net < 0 ? "text-v2-danger" : i === partialIdx ? "text-v2-text-2" : "text-v2-text"}`}>
                      {fmtNum(m.net)}
                    </td>
                  ))}
                  <td className={`${num} py-3 ${totals.net < 0 ? "text-v2-danger" : "text-v2-text"}`}>{fmtNum(totals.net)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-v2-small text-v2-text-2">{t("Foyda ulushi")}</td>
                  {monthly.map((m, i) => {
                    const p = sharePct(m.net, m.income);
                    return (
                      <td key={months[i]} className={`${num} text-v2-small ${i === partialIdx ? "text-v2-text-3" : "text-v2-text-2"}`}>
                        {p === null ? "—" : `${p}%`}
                      </td>
                    );
                  })}
                  <td className={`${num} text-v2-small font-semibold text-v2-text-2`}>{sharePct(totals.net, totals.income) === null ? "—" : `${sharePct(totals.net, totals.income)}%`}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ───────────────────────── 2. Kassalar ───────────────────────── */

type CashResp = { ok: true } & CashMonthReport;

function KassalarTab(p: {
  report: ReportDef;
  author: string;
  tabs: ReactNode;
  today: string;
  month: string;
  setMonth: (m: string) => void;
  branchId: string;
  setBranchId: (v: string) => void;
}) {
  const { report, author, today, month, branchId } = p;
  const { t } = useT();
  const [lang] = useLang();
  const f = useReportFmt();
  const { isAdmin } = useShell();
  const branchOptions = useBranchOptions();
  const cur = today.slice(0, 7);
  const data = useReportData<CashResp>(`/api/reports/cashbox-month?${new URLSearchParams({ month })}`);
  const [open, setOpen] = useState<Record<number, boolean>>({});

  const ready = !!data.data;
  const resp = data.data;
  const methodName = useMemo(() => new Map((resp?.methods ?? []).map((m) => [m.key, m.name])), [resp]);
  const methodOrder = useMemo(() => (resp?.methods ?? []).map((m) => m.key), [resp]);
  const boxes = useMemo(
    () =>
      (resp?.cashboxes ?? [])
        .filter((c) => !branchId || c.branchId === Number(branchId))
        .filter(cashboxVisible)
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || (a.branchId ?? 1e9) - (b.branchId ?? 1e9) || a.id - b.id),
    [resp, branchId],
  );
  const total = useMemo(
    () =>
      boxes.reduce<CashCells>(
        (s, c) => ({ start: s.start + c.total.start, kirim: s.kirim + c.total.kirim, chiqim: s.chiqim + c.total.chiqim, kochirish: s.kochirish + c.total.kochirish, end: s.end + c.total.end }),
        { start: 0, kirim: 0, chiqim: 0, kochirish: 0, end: 0 },
      ),
    [boxes],
  );
  const methodsOf = (c: CashMonthBox) => methodOrder.filter((k) => c.methods[k]).map((k) => ({ key: k, name: methodName.get(k) ?? k, cells: c.methods[k] }));

  const current = resp ? resp.current : month === cur;
  const fromIso = `${month}-01`;
  const startLabel = t("{date} holatiga", { date: f.dayMonth(fromIso) });
  const endStamp = current && resp ? f.stamp(resp.asOf.date, resp.asOf.time) : f.dayMonth(monthEnd(month));
  const endLabel = t("{date} holatiga", { date: endStamp });
  const scopeName = branchId ? (branchOptions.find((b) => b.value === branchId)?.label ?? "") : t("barcha filiallar");
  const primary = boxes.find((c) => c.isPrimary) ?? null;
  const intoPrimary = primary && primary.total.kochirish > 0 ? primary.total.kochirish : 0;
  const anyPending = current && boxes.some((c) => c.pendingOut > 0);
  const roleText = (c: CashMonthBox) => [c.moderator, c.moderatorRole ? t(c.moderatorRole) : ""].filter(Boolean).join(" · ");

  function getDoc(): ExportDoc | null {
    if (!resp) return null;
    const columns = [
      { label: t("Kassa") },
      { label: t("To'lov turi") },
      { label: startLabel, numeric: true },
      { label: t("Kirim"), numeric: true, signed: true },
      { label: t("Chiqim"), numeric: true, signed: true },
      { label: t("Ko'chirish"), numeric: true, signed: true },
      { label: endLabel, numeric: true },
    ];
    const cells = (x: CashCells): Cell[] => [x.start, x.kirim, x.chiqim, x.kochirish, x.end];
    const rows: Cell[][] = [];
    for (const c of boxes) {
      rows.push([c.isPrimary ? `${c.name} (${t("Bosh kassa")})` : c.name, t("Jami"), ...cells(c.total)]);
      for (const m of methodsOf(c)) rows.push(["", m.name, ...cells(m.cells)]);
    }
    return {
      title: t("{name} hisoboti", { name: t(report.title) }),
      fileBase: `${fileSafe(t(report.title))}-${fileSafe(t("Kassalar"))}-${month}`,
      center: t(CENTER_NAME),
      branchLabel: scopeName,
      dateLabel: f.fullDate(today),
      author,
      filters: [t("Kassalar"), monthRangeLabel({ from: month, to: month }, lang), scopeName].join(" · "),
      kpis: [
        { label: startLabel, value: `${fmtNum(total.start)} ${t("so'm")}` },
        { label: t("Kirim"), value: `${fmtSigned(total.kirim)} ${t("so'm")}` },
        { label: t("Chiqim"), value: `${fmtNum(total.chiqim)} ${t("so'm")}` },
        { label: endLabel, value: `${fmtNum(total.end)} ${t("so'm")}` },
      ],
      sections: [{ columns, rows, total: [t("Jami · {n} kassa", { n: boxes.length }), "", ...cells(total)] }],
      notes: [
        current ? t("Hozirgi qoldiqlar Moliya → Kassalar sahifasidagi bilan bir xil.") : t("Oy oxiridagi qoldiq — hozirgi qoldiqdan keyingi oylar yozuvlari ayirib hisoblangan."),
        t("Ko'chirish — kassalar va to'lov turlari orasida o'tgan pul; umumiy qoldiqni o'zgartirmaydi."),
      ],
      footer: DOC_FOOTER,
    };
  }

  const loading = !ready && !data.error;
  const num = "px-4 py-2.5 text-right tabular-nums whitespace-nowrap";
  const signed = (v: number) => (Math.round(v) === 0 ? "0" : fmtSigned(v));
  const endCls = (v: number) => (v < 0 ? "text-v2-danger" : "text-v2-text");

  return (
    <ReportShell
      report={report}
      subtitle={<Subtitle scope={scopeName} />}
      tabs={p.tabs}
      getDoc={getDoc}
      exportReady={ready && !data.stale}
      filters={
        <>
          <MonthPick value={month} onChange={p.setMonth} max={cur} />
          <V2Select variant="value" label={t("Filial")} emptyLabel="Barchasi" value={branchId} onChange={p.setBranchId} options={branchOptions} searchable={false} />
        </>
      }
      filtersEnd={<span className="text-v2-small text-v2-text-2">{t("Kassalar bir oy bo'yicha ko'rsatiladi")}</span>}
    >
      <div role="tabpanel" id="kc-panel" aria-labelledby="kc-tab-kassalar" className="flex min-w-0 flex-col gap-4">
        {data.error && <ErrorBanner message="Hisobot yuklanmadi" onRetry={data.reload} />}
        <div className={data.stale ? "opacity-60 transition-opacity" : ""}>
          <KpiStrip
            loading={loading}
            cells={[
              { key: "s", label: startLabel, value: fmtNum(total.start), unit: t("so'm"), sub: branchId ? t("{n} kassada", { n: boxes.length }) : t("barcha kassalarda") },
              { key: "i", label: t("Kirim"), value: signed(total.kirim), unit: t("so'm"), sub: t("to'lovlar va boshqa kirim") },
              { key: "e", label: t("Chiqim"), value: signed(total.chiqim), unit: t("so'm"), sub: t("xarajatlar, oylik va avans") },
              { key: "n", label: endLabel, value: fmtNum(total.end), unit: t("so'm"), tone: total.end < 0 ? "danger" : undefined, sub: t("oy boshidan {d}", { d: signed(total.end - total.start) }) },
            ]}
          />
        </div>
        <section className={`relative overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm ${data.stale ? "opacity-60 transition-opacity" : ""}`}>
          <div className="relative overflow-x-auto">
            <table className="w-full border-collapse text-v2-body" style={{ minWidth: 880 }}>
              <caption className="sr-only">{t("Kassalar bo'yicha qoldiq va harakat")}</caption>
              <thead>
                <tr className="border-b border-v2-border bg-v2-surface-2">
                  <th scope="col" className="h-9 px-4 text-left text-v2-caption font-medium text-v2-text-2">
                    {t("Kassa")}
                  </th>
                  {[startLabel, t("Kirim"), t("Chiqim"), t("Ko'chirish")].map((h) => (
                    <th key={h} scope="col" className="h-9 px-4 text-right text-v2-caption font-medium text-v2-text-2">
                      {h}
                    </th>
                  ))}
                  <th scope="col" className="h-9 px-4 text-right text-v2-caption font-semibold text-v2-text">
                    {endStamp}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }, (_, i) => (
                    <tr key={i} className="border-b border-v2-border last:border-b-0" aria-hidden>
                      <td className="px-4 py-3.5">
                        <span className="inline-block h-3 w-36 rounded bg-v2-skeleton" />
                      </td>
                      {Array.from({ length: 5 }, (_, j) => (
                        <td key={j} className="px-4 py-3.5 text-right">
                          <span className="inline-block h-3 w-20 rounded bg-v2-skeleton" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : boxes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-v2-small text-v2-text-2">
                      {t("Kassa topilmadi")}
                    </td>
                  </tr>
                ) : (
                  boxes.map((c) => {
                    const ms = methodsOf(c);
                    const canOpen = ms.length > 1;
                    const isOpen = canOpen && (open[c.id] ?? c.isPrimary);
                    const sub = roleText(c);
                    return (
                      <Fragment key={c.id}>
                        <tr className={`border-b border-v2-border ${isOpen ? "bg-v2-surface-2" : ""}`}>
                          <td className="px-4 py-2.5 align-middle">
                            <div className="flex items-start gap-2">
                              {canOpen ? (
                                <button
                                  type="button"
                                  onClick={() => setOpen((o) => ({ ...o, [c.id]: !isOpen }))}
                                  aria-expanded={isOpen}
                                  aria-label={isOpen ? t("To'lov turlarini yopish") : t("To'lov turlari bo'yicha ochish")}
                                  className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-hover hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
                                >
                                  <ChevronRight className={`size-4 transition-transform ${isOpen ? "rotate-90" : ""}`} strokeWidth={1.75} aria-hidden />
                                </button>
                              ) : (
                                <span className="size-5 shrink-0" aria-hidden />
                              )}
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-semibold text-v2-text">{c.name}</span>
                                  {c.isPrimary && (
                                    <span className="inline-flex items-center gap-1 rounded-v2-full bg-v2-warning-bg px-2 py-0.5 text-v2-caption font-medium text-v2-warning">
                                      <Crown className="size-3" strokeWidth={1.75} aria-hidden />
                                      {t("Bosh kassa")}
                                    </span>
                                  )}
                                  {c.archived && <span className="text-v2-caption text-v2-text-3">{t("arxiv")}</span>}
                                </div>
                                {(sub || (current && c.pendingOut > 0)) && (
                                  <div className="text-v2-caption font-normal text-v2-text-3">
                                    {sub}
                                    {current && c.pendingOut > 0 && (
                                      <>
                                        {sub ? " · " : ""}
                                        <span className="tabular-nums text-v2-warning">{t("{sum} yo'lda", { sum: fmtNum(c.pendingOut) })}</span>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className={num}>{fmtNum(c.total.start)}</td>
                          <td className={num}>{signed(c.total.kirim)}</td>
                          <td className={num}>{signed(c.total.chiqim)}</td>
                          <td className={num}>{signed(c.total.kochirish)}</td>
                          <td className={`${num} font-semibold ${endCls(c.total.end)}`}>{fmtNum(c.total.end)}</td>
                        </tr>
                        {isOpen &&
                          ms.map((m) => (
                            <tr key={`${c.id}-${m.key}`} className="border-b border-v2-border">
                              <td className="py-2.5 pl-11 pr-4">
                                <span className="inline-flex items-center gap-2 text-v2-text">
                                  <span className={`size-2 shrink-0 rounded-full ${methodDot(m.key.startsWith("name:") ? m.name : m.key)}`} aria-hidden />
                                  {m.name}
                                </span>
                              </td>
                              <td className={`${num} text-v2-text-2`}>{fmtNum(m.cells.start)}</td>
                              <td className={`${num} text-v2-text-2`}>{signed(m.cells.kirim)}</td>
                              <td className={`${num} text-v2-text-2`}>{signed(m.cells.chiqim)}</td>
                              <td className={`${num} text-v2-text-2`}>{signed(m.cells.kochirish)}</td>
                              <td className={`${num} ${m.cells.end < 0 ? "text-v2-danger" : "text-v2-text"}`}>{fmtNum(m.cells.end)}</td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
              {!loading && boxes.length > 0 && (
                <tfoot>
                  <tr className="border-t border-v2-border bg-v2-surface-2 font-semibold">
                    <td className="px-4 py-2.5">{t("Jami · {n} kassa", { n: boxes.length })}</td>
                    <td className={num}>{fmtNum(total.start)}</td>
                    <td className={num}>{signed(total.kirim)}</td>
                    <td className={num}>{signed(total.chiqim)}</td>
                    <td className={num}>{signed(total.kochirish)}</td>
                    <td className={`${num} ${endCls(total.end)}`}>{fmtNum(total.end)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
        {ready && (
          <div className="flex flex-col gap-1">
            <Note icon={<ArrowLeftRight strokeWidth={1.75} aria-hidden />}>
              {intoPrimary > 0 && primary
                ? t("Ko'chirish — kassalar va to'lov turlari orasida o'tgan pul: bu oy bosh kassaga ({name}) {sum} so'm o'tdi, jami {total}.", {
                    name: primary.name,
                    sum: fmtNum(intoPrimary),
                    total: signed(total.kochirish),
                  })
                : t("Ko'chirish — kassalar va to'lov turlari orasida o'tgan pul; jami {total}.", { total: signed(total.kochirish) })}
            </Note>
            {anyPending && <Note icon={<Clock strokeWidth={1.75} aria-hidden />}>{t("«Yo'lda» — boshqa kassaga jo'natilgan, qabul qiluvchi hali tasdiqlamagan pul; u jo'natuvchi kassa qoldig'ida turadi.")}</Note>}
            <Note icon={<Info strokeWidth={1.75} aria-hidden />}>
              {current ? (
                <LinkSentence text={t("Hozirgi qoldiqlar {link} sahifasidagi bilan bir xil.")} href="/finance-cash" label={t("Moliya → Kassalar")} />
              ) : (
                t("Oy oxiridagi qoldiq — hozirgi qoldiqdan keyingi oylar yozuvlari ayirib hisoblangan.")
              )}
              {!isAdmin && <> {t("Sizga faqat o'zingizga biriktirilgan kassa ko'rinadi.")}</>}
            </Note>
          </div>
        )}
      </div>
    </ReportShell>
  );
}
