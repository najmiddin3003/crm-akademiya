"use client";

import { useMemo, useState } from "react";
import Link from "@/components/ui/Link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useBranch } from "@/components/shared/BranchContext";
import { useT } from "@/components/shared/Language";
import { methodDot } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { branchBuildingLabel } from "@/lib/branchPools";
import type { SummaryRow } from "@/lib/financeAnalytics";
import type { MethodUsage } from "@/lib/paymentMethodUsage";
import { computePaymentMethodReport, fmtPp, fmtShare, type PmCard, type PmCashbox, type PmCashRow, type PmPoint } from "@/lib/reportPaymentMethods";
import type { ReportDef } from "@/lib/reportsCatalog";
import { CENTER_NAME, DOC_FOOTER, useReportData, useReportFmt, useToday } from "./reportHooks";
import { fileSafe, fmtNum, monthEnd, monthRangeLabel, monthsBetween, shiftMonth, type MonthRange } from "./reportFormat";
import type { Cell, ExportDoc } from "./reportExport";
import { ErrorBanner, NoteLine, ReportShell, ReportTable } from "./reportUi";
import V2MonthRange from "./V2MonthRange";

// YANGI VERSIYA — HISOBOTLAR → MOLIYA → «TO'LOV TURLARI» (26-qism, rasm 39–40, 13.11.2026).
//
//   • Kartalar — har to'lov turi (Sozlamalar tartibida, rangli nuqta bilan): oxirgi oy ulushi,
//     summasi, oldingi oyga nisbatan p.p., oylar bo'yicha kichik ustunli grafik (oldingi oylar
//     kulrang, oxirgisi tur rangida; hamma kartada BIR shkala 0–max).
//   • «Kassalar bo'yicha» — oxirgi oy, kassa × tur; «–» — kassa bu turni qabul qilmaydi.
//   • «Oylar bo'yicha» — grafikdagi raqamlar: summa va oy ichidagi ulush.
// Raqamlar Moliya analitikasi bilan BIR hisob (faqat tushum): lib/reportPaymentMethods.ts.
// Kassalar, mas'ul va 90 kunlik ishlatilish — GET /api/reports/payment-methods.

interface MetaResp {
  cashboxes: PmCashbox[];
  usage: MethodUsage;
  days: number;
}

const SETTINGS_CASHBOXES = "/settings-finance?tab=cashboxes";

/** «Terminal va Inkassa», «A, B va C». */
function joinNames(names: string[], and: string): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
}

export default function TolovTurlariReport({ report, author }: { report: ReportDef; author: string }) {
  const { t, lang } = useT();
  const f = useReportFmt();
  const today = useToday();
  const cur = today.slice(0, 7);
  const branch = useBranch();
  const pm = usePaymentMethods();

  const [range, setRange] = useState<MonthRange>({ from: shiftMonth(cur, -5), to: cur });
  const [branchId, setBranchId] = useState("");
  const [cashboxId, setCashboxId] = useState("");

  const months = useMemo(() => monthsBetween(range.from, range.to > cur ? cur : range.to), [range, cur]);
  const last = months[months.length - 1] ?? cur;
  const from = `${range.from}-01`;
  const to = monthEnd(last) > today ? today : monthEnd(last);
  const partial = last === cur && to < monthEnd(cur);

  const meta = useReportData<MetaResp>("/api/reports/payment-methods");
  const sum = useReportData<{ rows: SummaryRow[] }>(`/api/transactions/summary?${new URLSearchParams({ groupBy: "month,method,sign,category,cashbox", from, to })}`);
  const cashboxes = useMemo(() => meta.data?.cashboxes ?? [], [meta.data]);

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
  const scopeLower = cashboxId || branchId ? scopeName : t("barcha filiallar");

  const ready = !!sum.data && !!meta.data && !pm.loading;
  const loading = !ready && !sum.error && !meta.error;
  const stale = sum.stale || meta.stale;

  const R = useMemo(
    () =>
      computePaymentMethodReport({
        rows: sum.data?.rows ?? [],
        months,
        methods: pm.methods.map((m) => ({ key: m.key, name: m.name, active: m.active })),
        cashboxes,
        scope: cbSet,
        usage: meta.data?.usage ?? null,
        fallbackName: (key) => (key ? key.charAt(0).toUpperCase() + key.slice(1) : t("Ko'rsatilmagan")),
      }),
    [sum.data, months, pm.methods, cashboxes, cbSet, meta.data, t],
  );

  /** Oxirgi oy davri: «1–12-oktabr» (davom etayotgan oy) yoki «Sentabr 2026». */
  const lastLabel = partial ? f.dayRange(`${last}-01`, to) : f.monthTitle(last);
  const crossYear = months.length > 0 && months[0].slice(0, 4) !== last.slice(0, 4);
  const monthLabel = (m: string) => (crossYear ? f.monthTitle(m) : f.monthName(m));
  const isPartial = (m: string) => partial && m === last;
  const coverageText = (c: PmCard) => (c.coverage.all ? t("hamma kassada") : c.coverage.count > 0 ? t("{n} kassada", { n: c.coverage.count }) : t("faol kassada yo'q"));
  const cashName = (r: PmCashRow) => (r.unknown ? t("Kassa ko'rsatilmagan") : r.name);
  const tip = (p: PmPoint) => `${f.monthTitle(p.month)}${isPartial(p.month) ? "*" : ""} · ${fmtShare(p.share)} · ${fmtNum(p.sum)} ${t("so'm")}`;
  const nameOfKey = (key: string) => R.methods.find((m) => m.key === key)?.name ?? key;
  const singleNotes = R.single.map((s) =>
    t("{methods} faqat {cashbox}da", { methods: joinNames(s.keys.map(nameOfKey), t("va")), cashbox: cashboxes.find((c) => c.id === s.cashboxId)?.name ?? `#${s.cashboxId}` }),
  );
  const hasDash = R.cashRows.some((r) => r.cells.some((v) => v === null));
  const usageDays = meta.data?.days ?? 90;

  const cardsNote = [
    last === cur ? t("Kulrang ustunlar — oldingi oylar, rangli — joriy oy.") : t("Kulrang ustunlar — oldingi oylar, rangli — {month}.", { month: f.monthTitle(last) }),
    t("Ulush hamma kartada bir shkalada (0–{max}%).", { max: R.scaleMax }),
    partial ? t("* {month} hali tugamagan.", { month: f.monthLower(last) }) : "",
    R.hidden.length ? t("Ishlatilmagan turlar ko'rsatilmadi: {names}.", { names: R.hidden.join(", ") }) : "",
  ]
    .filter(Boolean)
    .join(" ");
  const acceptsNote = t("«Qabul qiladi» — oxirgi {days} kunda yoki tanlangan oylarda shu kassaga shu turda tushum yozilgan.", { days: usageDays });
  const incomeNote = t("Faqat tushum (kirim) hisoblanadi; bekor qilingan to'lovlar ayrilgan.");

  function getDoc(): ExportDoc | null {
    if (!ready || months.length === 0) return null;
    const cols = R.methods.map((m) => ({ label: m.name, numeric: true }));
    const monthText = (m: string) => `${monthLabel(m)}${isPartial(m) ? ` (${f.dayRange(`${m}-01`, to)})` : ""}`;
    return {
      title: t("{name} hisoboti", { name: t(report.title) }),
      fileBase: `${fileSafe(t(report.title))}-${to}`,
      center: t(CENTER_NAME),
      branchLabel: scopeName,
      dateLabel: f.fullDate(today),
      author,
      filters: [monthRangeLabel(range, lang), scopeName].join(" · "),
      kpis: [
        { label: `${t("Jami kirim")} · ${lastLabel}`, value: `${fmtNum(R.lastTotal)} ${t("so'm")}` },
        ...R.cards.slice(0, 4).map((c) => ({ label: c.name, value: fmtShare(c.share) })),
      ],
      sections: [
        {
          title: `${t("To'lov turlari")} · ${lastLabel}`,
          columns: [{ label: t("To'lov turi") }, { label: t("Summa, so'm"), numeric: true }, { label: t("Ulush") }, { label: t("O'zgarish, p.p.") }, { label: t("Kassalar") }],
          rows: R.cards.map((c) => [c.name, c.sum, fmtShare(c.share), c.change === null ? "—" : fmtPp(c.change, lang), coverageText(c)]),
          total: [t("Jami kirim"), R.lastTotal, R.lastTotal > 0 ? "100%" : "—", null, null],
        },
        {
          title: `${t("Kassalar bo'yicha")} · ${lastLabel} · ${t("kirim, so'm")}`,
          columns: [{ label: t("Kassa") }, { label: t("Mas'ul") }, ...cols, { label: t("Jami"), numeric: true }],
          rows: R.cashRows.map((r) => [cashName(r), r.owner || null, ...r.cells.map((v): Cell => (v === null ? "–" : v)), r.total]),
          total: [t("Jami kirim"), null, ...R.cashTotals, R.lastTotal],
        },
        {
          title: `${t("Oylar bo'yicha")} · ${t("kirim, so'm")}`,
          columns: [{ label: t("Oy") }, ...cols, { label: t("Jami kirim"), numeric: true }],
          rows: R.months.map((m, i) => [monthText(m), ...R.monthCells[i], R.monthTotals[i]]),
          total: [t("Jami"), ...R.methods.map((_, j) => R.monthCells.reduce((a, row) => a + row[j], 0)), R.rangeTotal],
        },
        {
          title: t("Ulush oylar bo'yicha, %"),
          columns: [{ label: t("Oy") }, ...R.methods.map((m) => ({ label: m.name }))],
          rows: R.months.map((m, i) => [monthText(m), ...R.cards.map((c) => fmtShare(c.series[i]?.share ?? null))]),
        },
      ],
      notes: [incomeNote, ...(R.hidden.length ? [t("Ishlatilmagan turlar ko'rsatilmadi: {names}.", { names: R.hidden.join(", ") })] : []), hasDash ? `${t("– shu kassa bu turni qabul qilmaydi.")} ${acceptsNote}` : acceptsNote, ...(partial ? [t("* {month} hali tugamagan.", { month: f.monthLower(last) })] : [])],
      footer: DOC_FOOTER,
    };
  }

  const gridCols = ["", "xl:grid-cols-1", "xl:grid-cols-2", "xl:grid-cols-3"][R.cards.length] ?? "xl:grid-cols-4";

  return (
    <ReportShell
      report={report}
      subtitle={`${t("kirim to'lov turi bo'yicha")} · ${scopeLower}`}
      getDoc={getDoc}
      exportReady={ready && !stale}
      filters={
        <>
          <V2MonthRange value={range} onChange={setRange} max={cur} />
          <V2Select
            variant="value"
            label={t("Filial")}
            emptyLabel="Barchasi"
            value={branchId}
            onChange={(v) => {
              setBranchId(v);
              setCashboxId("");
            }}
            options={branchOptions}
            searchable={false}
          />
          <V2Select variant="value" label={t("Kassa")} emptyLabel="Barchasi" value={cashboxId} onChange={setCashboxId} options={cashboxOptions} />
        </>
      }
    >
      {(sum.error || meta.error) && (
        <ErrorBanner
          message="Hisobot yuklanmadi"
          onRetry={() => {
            if (sum.error) sum.reload();
            if (meta.error) meta.reload();
          }}
        />
      )}

      {/* Kartalar — har to'lov turi */}
      <div className={stale ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <section aria-label={t("To'lov turlari")} className={`grid gap-3 sm:grid-cols-2 ${loading ? "xl:grid-cols-4" : gridCols}`}>
          {loading
            ? [0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)
            : R.cards.map((c) => (
                <MethodCard
                  key={c.key || "—"}
                  card={c}
                  coverage={coverageText(c)}
                  period={lastLabel}
                  scaleMax={R.scaleMax}
                  lang={lang}
                  tip={tip}
                  tick={(m) => `${f.monthShort(m)}${isPartial(m) ? "*" : ""}`}
                />
              ))}
        </section>
        {!loading && R.cards.length === 0 && <p className="rounded-v2-lg border border-v2-border bg-v2-surface px-4 py-8 text-center text-v2-small text-v2-text-2">{t("Bu davrda tushum yo'q")}</p>}
      </div>
      {!loading && R.cards.length > 0 && <NoteLine>{cardsNote}</NoteLine>}

      {/* Kassalar bo'yicha — oxirgi oy */}
      <div className={`flex flex-col gap-2 ${stale ? "opacity-60 transition-opacity" : "transition-opacity"}`}>
        <TableTitle title={t("Kassalar bo'yicha")} meta={`${lastLabel} · ${t("kirim, so'm")}`} />
        <ReportTable<PmCashRow>
          caption={`${t("Kassalar bo'yicha")} · ${lastLabel}`}
          cols={[
            {
              key: "name",
              label: t("Kassa"),
              render: (r) => (
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`font-medium ${r.unknown ? "text-v2-text-2" : "text-v2-text"}`}>{cashName(r)}</span>
                    {r.isPrimary && (
                      <span className="inline-flex h-5 items-center rounded-full border border-v2-warning/30 bg-v2-warning-bg px-2 text-v2-caption font-medium text-v2-warning">{t("Bosh kassa")}</span>
                    )}
                  </div>
                  {r.owner && <div className="mt-0.5 truncate text-v2-caption font-normal text-v2-text-2">{r.owner}</div>}
                </div>
              ),
            },
            ...R.methods.map((m, j) => ({
              key: `m:${m.key}`,
              label: m.name,
              align: "right" as const,
              render: (r: PmCashRow) => {
                const v = r.cells[j];
                return v === null ? (
                  <span className="text-v2-text-3" title={t("shu kassa bu turni qabul qilmaydi")}>
                    –
                  </span>
                ) : (
                  fmtNum(v)
                );
              },
            })),
            { key: "total", label: t("Jami"), align: "right", render: (r) => <span className="font-semibold text-v2-text">{fmtNum(r.total)}</span> },
          ]}
          rows={R.cashRows}
          rowKey={(r) => r.id}
          loading={loading}
          empty={t("Kassalar yo'q")}
          total={[
            t("Jami kirim"),
            ...R.cashTotals.map((v, j) => (
              <span key={R.methods[j]?.key ?? j} className="block">
                {fmtNum(v)}
                <span className="block text-v2-caption font-normal text-v2-text-2">{fmtShare(R.cards[j]?.share ?? null)}</span>
              </span>
            )),
            fmtNum(R.lastTotal),
          ]}
          minWidth={Math.max(560, 240 + R.methods.length * 130)}
        />
        {!loading && (hasDash || singleNotes.length > 0) && (
          <NoteLine>
            {hasDash ? `${t("– shu kassa bu turni qabul qilmaydi.")} ` : ""}
            {singleNotes.length > 0 ? `${singleNotes.join("; ")} — ` : ""}
            <Link href={SETTINGS_CASHBOXES} className="font-medium text-v2-brand-text hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus">
              {t("Sozlamalar → Kassalar")}
            </Link>
            .
          </NoteLine>
        )}
      </div>

      {/* Oylar bo'yicha — grafikdagi raqamlar */}
      <div className={`flex flex-col gap-2 ${stale ? "opacity-60 transition-opacity" : "transition-opacity"}`}>
        <TableTitle title={t("Oylar bo'yicha")} meta={`${t("grafikdagi raqamlar")} · ${t("kirim, so'm")}`} />
        <ReportTable<string>
          caption={t("Oylar bo'yicha")}
          cols={[
            {
              key: "m",
              label: t("Oy"),
              render: (m) => (
                <span className="whitespace-nowrap">
                  <span className="font-medium text-v2-text">
                    {monthLabel(m)}
                    {isPartial(m) ? "*" : ""}
                  </span>
                  {isPartial(m) && <span className="ml-1.5 text-v2-caption font-normal tabular-nums text-v2-text-2">{`1–${Number(to.slice(8, 10))}`}</span>}
                </span>
              ),
            },
            ...R.methods.map((x, j) => ({
              key: `m:${x.key}`,
              label: x.name,
              align: "right" as const,
              render: (m: string) => {
                const i = R.months.indexOf(m);
                const p = R.cards[j]?.series[i];
                return (
                  <span className="block">
                    {fmtNum(R.monthCells[i]?.[j] ?? 0)}
                    <span className="block text-v2-caption font-normal text-v2-text-2">{fmtShare(p?.share ?? null)}</span>
                  </span>
                );
              },
            })),
            {
              key: "sum",
              label: t("Jami kirim"),
              align: "right",
              render: (m) => <span className="font-semibold text-v2-text">{fmtNum(R.monthTotals[R.months.indexOf(m)] ?? 0)}</span>,
            },
          ]}
          rows={R.months}
          rowKey={(m) => m}
          loading={loading}
          empty={t("Bu davrda tushum yo'q")}
          minWidth={Math.max(560, 200 + R.methods.length * 130)}
        />
      </div>

      <NoteLine>{`${incomeNote} ${acceptsNote}`}</NoteLine>
    </ReportShell>
  );
}

/* ───────────────────────── Qismlar ───────────────────────── */

function TableTitle({ title, meta }: { title: string; meta: string }) {
  return (
    <h2 className="flex flex-wrap items-baseline gap-x-1.5 px-0.5">
      <span className="text-v2-section text-v2-text">{title}</span>
      <span className="text-v2-small font-normal text-v2-text-2">· {meta}</span>
    </h2>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm" aria-hidden>
      <div className="h-4 w-24 rounded bg-v2-skeleton" />
      <div className="mt-4 h-8 w-16 rounded bg-v2-skeleton" />
      <div className="mt-2 h-3 w-40 rounded bg-v2-skeleton" />
      <div className="mt-5 flex h-[76px] items-end gap-1.5">
        {[45, 60, 40, 55, 70, 50].map((h, i) => (
          <span key={i} className="flex-1 rounded-t-[3px] bg-v2-skeleton" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

function MethodCard({
  card,
  coverage,
  period,
  scaleMax,
  lang,
  tip,
  tick,
}: {
  card: PmCard;
  coverage: string;
  period: string;
  scaleMax: number;
  lang: string;
  tip: (p: PmPoint) => string;
  tick: (month: string) => string;
}) {
  const { t } = useT();
  const [hover, setHover] = useState<number | null>(null);
  const dot = methodDot(card.key);
  const n = card.series.length;
  const cols = { gridTemplateColumns: `repeat(${Math.max(1, n)}, minmax(0, 1fr))` };
  const height = (s: number | null) => (s === null || s <= 0 ? 0 : Math.max(2, Math.min(100, (s / scaleMax) * 100)));
  const showTicks = (i: number) => n <= 7 || i === 0 || i === n - 1;
  const ch = card.change === null ? null : Math.round(card.change * 10) / 10;
  const ChangeIcon = ch === null || ch === 0 ? Minus : ch > 0 ? ArrowUpRight : ArrowDownRight;
  const tipStyle = hover === null ? undefined : hover === 0 ? { left: 0 } : hover === n - 1 ? { right: 0 } : { left: `${((hover + 0.5) / n) * 100}%`, transform: "translateX(-50%)" };

  return (
    <article className="min-w-0 rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm" aria-label={card.name}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className={`size-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
          <span className="truncate text-v2-body font-medium text-v2-text">{card.name}</span>
        </span>
        <span className="shrink-0 text-v2-caption text-v2-text-2">{coverage}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5">
        <span className="text-v2-number tabular-nums text-v2-text">{fmtShare(card.share)}</span>
        {ch !== null && (
          <span className="inline-flex items-center gap-0.5 text-v2-small tabular-nums text-v2-text-2">
            <ChangeIcon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            {fmtPp(card.change ?? 0, lang)} {t("p.p.")}
            <span className="sr-only"> {t("oldingi oyga nisbatan")}</span>
          </span>
        )}
      </div>
      <div className="mt-0.5 truncate text-v2-caption font-normal tabular-nums text-v2-text-2">
        {fmtNum(card.sum)} {t("so'm")} · {period}
      </div>

      {/* Oylar grafigi: hamma kartada bir shkala (0–scaleMax %). */}
      <div className="mt-4">
        <div role="group" aria-label={t("{name}: ulush oylar bo'yicha", { name: card.name })} className="relative h-[92px]" onPointerLeave={() => setHover(null)}>
          <span className="absolute inset-x-0 bottom-0 h-px bg-v2-border" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 top-5 grid gap-1.5" style={cols}>
            {card.series.map((p, i) => {
              const isLast = i === n - 1;
              const on = hover === i;
              return (
                <button
                  key={p.month}
                  type="button"
                  aria-label={tip(p)}
                  onPointerEnter={() => setHover(i)}
                  onClick={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover((h) => (h === i ? null : h))}
                  className="relative flex h-full items-end justify-center rounded-t-v2-sm focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--v2-brand)]"
                >
                  <span className="relative block w-full max-w-[30px]" style={{ height: `${height(p.share)}%` }}>
                    {(i === 0 || isLast) && p.share !== null && (
                      <span
                        className={`absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-v2-caption tabular-nums ${isLast ? "font-semibold text-v2-text" : "text-v2-text-2"}`}
                      >
                        {fmtShare(p.share)}
                      </span>
                    )}
                    <span className={`absolute inset-0 rounded-t-[3px] transition-opacity ${isLast ? dot : "bg-v2-track"} ${on ? "opacity-80" : ""}`} />
                  </span>
                </button>
              );
            })}
          </div>
          {hover !== null && card.series[hover] && (
            <div
              role="tooltip"
              className="pointer-events-none absolute bottom-full z-10 mb-1.5 w-max max-w-[260px] rounded-v2-md border border-v2-border bg-v2-surface px-2.5 py-1.5 text-v2-caption tabular-nums text-v2-text shadow-v2-md"
              style={tipStyle}
            >
              {tip(card.series[hover])}
            </div>
          )}
        </div>
        <div className="mt-1.5 grid gap-1.5" style={cols} aria-hidden>
          {card.series.map((p, i) => (
            <span key={p.month} className={`truncate text-center text-v2-caption ${i === n - 1 ? "font-medium text-v2-text" : "text-v2-text-3"}`}>
              {showTicks(i) ? tick(p.month) : ""}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
