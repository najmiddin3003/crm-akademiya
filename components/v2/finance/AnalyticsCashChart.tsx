"use client";

import { useState } from "react";
import { ChartColumn, Table2 } from "lucide-react";
import { useLang, useT } from "@/components/shared/Language";
import { Segmented } from "@/components/v2/form/fields";
import type { MoneyTotals } from "@/lib/financeAnalytics";
import { fmtMln, fmtSom, monthTick, niceAxis } from "./analyticsShared";

// YANGI VERSIYA — «KIRIM VA CHIQIM · OYMA-OY» (rasm «Moliya analitikasi», 20.10.2026).
//
// Guruhlangan ustunlar: Kirim — 1-slot ko'k, Chiqim — 2-slot to'q sariq (dataviz
// palitrasi, tokenlar `--v2-series-1/2`; validator o'tdi). Ustun ≤ 22 px, tepasi 4 px
// yumaloq, asosi to'g'ri; davom etayotgan oy — shu rang 55% (och). Raqam faqat
// tanlab: eng katta kirim va oxirgi oy (qolgani — o'q, maslahat oynasi va jadval).
// Sichqoncha / fokus ustun ustida: kulrang fon + maslahat oynasi (oy, kirim,
// chiqim, sof foyda — qiymat oldin, nomi keyin). Ostida «Sof foyda» qatori, eng
// kattasi qalin. «Jadval» — xuddi shu raqamlar to'liq so'mda (WCAG ekvivalenti).

export interface MonthPoint {
  /** "YYYY-MM" */
  key: string;
  totals: MoneyTotals;
  /** Shu oyda biror yozuv bormi (yo'q bo'lsa — «—»). */
  hasData: boolean;
}

export default function AnalyticsCashChart({
  points,
  partialDay,
  subtitle,
  view,
  onView,
  loading,
  stale,
}: {
  points: MonthPoint[];
  /** Oxirgi oy davom etmoqda — necha kun o'tdi (aks holda null). */
  partialDay: number | null;
  subtitle: string;
  view: "chart" | "table";
  onView: (v: "chart" | "table") => void;
  /** Birinchi yuklanish — skelet. */
  loading: boolean;
  /** Yangi so'rov ketyapti — eski rasm xira turadi (sakramaydi). */
  stale: boolean;
}) {
  const { t, months, monthsShort } = useT();
  const [lang] = useLang();
  const [hover, setHover] = useState<number | null>(null);

  const n = points.length;
  const max = Math.max(0, ...points.map((p) => Math.max(p.totals.income, p.totals.expense)));
  const axis = niceAxis(max);
  const ticks = Array.from({ length: Math.round(axis.top / axis.step) + 1 }, (_, i) => i * axis.step);
  const pct = (v: number) => Math.max(0, Math.min(100, (v / axis.top) * 100));
  const last = n - 1;
  const maxIncomeIdx = points.reduce((best, p, i) => (p.totals.income > (points[best]?.totals.income ?? 0) ? i : best), 0);
  const maxNetIdx = points.reduce((best, p, i) => (p.hasData && p.totals.net > (points[best]?.hasData ? points[best].totals.net : -Infinity) ? i : best), 0);
  const empty = !loading && points.every((p) => !p.hasData);

  const ym = (key: string) => key.split("-").map(Number) as [number, number];
  const monthName = (key: string) => {
    const [y, m] = ym(key);
    return `${months[m - 1] ?? key} ${y}`;
  };
  const tick = (key: string) => {
    const [, m] = ym(key);
    return monthTick(m - 1, months, monthsShort);
  };
  const mln = (v: number) => `${fmtMln(v, lang)} ${t("mln")}`;
  const axisLabel = (v: number) => (v === 0 ? "0" : `${fmtMln(v, lang).replace(/[,.]0$/, "")} ${t("mln")}`);

  const barCls = (series: 1 | 2, partial: boolean) =>
    partial
      ? series === 1
        ? "bg-[color-mix(in_srgb,var(--v2-series-1)_55%,var(--v2-surface))]"
        : "bg-[color-mix(in_srgb,var(--v2-series-2)_55%,var(--v2-surface))]"
      : series === 1
        ? "bg-v2-series-1"
        : "bg-v2-series-2";

  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm" aria-label={t("Kirim va chiqim · oyma-oy")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-v2-section text-v2-text">{t("Kirim va chiqim · oyma-oy")}</h2>
          <p className="mt-0.5 text-v2-small text-v2-text-2">{subtitle}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-v2-small text-v2-text-2" aria-hidden={view === "table"}>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-v2-series-1" aria-hidden />
              {t("Kirim")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-v2-series-2" aria-hidden />
              {t("Chiqim")}
            </span>
          </div>
          <div className="w-[176px]">
            <Segmented
              value={view}
              onChange={(v) => onView(v as "chart" | "table")}
              label={t("Ko'rinish")}
              options={[
                { value: "chart", label: t("Grafik"), icon: <ChartColumn className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden /> },
                { value: "table", label: t("Jadval"), icon: <Table2 className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden /> },
              ]}
            />
          </div>
        </div>
      </div>

      <div className={`mt-5 transition-opacity ${stale ? "opacity-60" : ""}`}>
        {view === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-v2-body">
              <thead>
                <tr className="text-left text-v2-small text-v2-text-2">
                  <th className="border-b border-v2-border py-2 pr-3 font-medium">{t("Oy")}</th>
                  <th className="border-b border-v2-border px-3 py-2 text-right font-medium">{t("Kirim, so'm")}</th>
                  <th className="border-b border-v2-border px-3 py-2 text-right font-medium">{t("Chiqim, so'm")}</th>
                  <th className="border-b border-v2-border py-2 pl-3 text-right font-medium">{t("Sof foyda, so'm")}</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p, i) => (
                  <tr key={p.key} className="border-b border-v2-border last:border-b-0">
                    <td className="py-2.5 pr-3 text-v2-text">
                      {monthName(p.key)}
                      {i === last && partialDay ? <span className="text-v2-text-3"> · 1–{partialDay}</span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-v2-text">{p.hasData ? fmtSom(p.totals.income) : "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-v2-text">{p.hasData ? fmtSom(p.totals.expense) : "—"}</td>
                    <td className={`py-2.5 pl-3 text-right font-semibold tabular-nums ${p.totals.net < 0 ? "text-v2-danger" : "text-v2-text"}`}>{p.hasData ? fmtSom(p.totals.net) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-v2-surface-2">
                  <td className="py-2.5 pl-2 pr-3 font-semibold text-v2-text">{t("Jami")}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-v2-text">{fmtSom(points.reduce((s, p) => s + p.totals.income, 0))}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-v2-text">{fmtSom(points.reduce((s, p) => s + p.totals.expense, 0))}</td>
                  <td className="py-2.5 pl-3 pr-2 text-right font-semibold tabular-nums text-v2-text">{fmtSom(points.reduce((s, p) => s + p.totals.net, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-[52px_minmax(0,1fr)] sm:grid-cols-[60px_minmax(0,1fr)]" onPointerLeave={() => setHover(null)}>
            {/* Y o'qi */}
            <div className="relative h-[200px] sm:h-[230px]" aria-hidden>
              {ticks.map((v) => (
                <span key={v} className="absolute right-3 translate-y-1/2 whitespace-nowrap text-v2-caption tabular-nums text-v2-text-3" style={{ bottom: `${pct(v)}%` }}>
                  {axisLabel(v)}
                </span>
              ))}
            </div>

            {/* Maydon */}
            <div className="relative h-[200px] sm:h-[230px]">
              {ticks.map((v) => (
                <span key={v} aria-hidden className={`absolute inset-x-0 h-px ${v === 0 ? "bg-v2-border-strong" : "bg-v2-border"}`} style={{ bottom: `${pct(v)}%` }} />
              ))}
              {loading ? (
                <div className="absolute inset-0 grid items-end" style={{ gridTemplateColumns: `repeat(${n || 6}, minmax(0, 1fr))` }} aria-hidden>
                  {Array.from({ length: n || 6 }, (_, i) => (
                    <div key={i} className="flex h-full items-end justify-center gap-1">
                      <span className="w-[14px] rounded-t-[4px] bg-v2-skeleton sm:w-[22px]" style={{ height: `${30 + ((i * 17) % 45)}%` }} />
                      <span className="w-[14px] rounded-t-[4px] bg-v2-skeleton sm:w-[22px]" style={{ height: `${20 + ((i * 11) % 35)}%` }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
                  {points.map((p, i) => {
                    const partial = i === last && partialDay !== null;
                    const on = hover === i;
                    const showIn = i === last || (i === maxIncomeIdx && p.totals.income > 0);
                    const showOut = i === last;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onPointerEnter={() => setHover(i)}
                        onFocus={() => setHover(i)}
                        onBlur={() => setHover((h) => (h === i ? null : h))}
                        aria-label={`${monthName(p.key)}: ${t("Kirim")} ${mln(p.totals.income)}, ${t("Chiqim")} ${mln(p.totals.expense)}, ${t("Sof foyda")} ${mln(p.totals.net)}`}
                        className={`relative mx-0.5 flex h-full items-end justify-center gap-1 rounded-v2-md pb-px transition-colors focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--v2-brand)] sm:mx-2 ${on ? "bg-v2-hover" : ""}`}
                      >
                        <span className="relative flex h-full w-[14px] flex-col justify-end sm:w-[22px]">
                          {showIn && p.totals.income > 0 && (
                            <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-v2-caption font-semibold tabular-nums text-v2-text" style={{ bottom: `calc(${pct(p.totals.income)}% + 4px)` }}>
                              {fmtMln(p.totals.income, lang)}
                            </span>
                          )}
                          <span className={`block w-full rounded-t-[4px] ${barCls(1, partial)}`} style={{ height: `${pct(p.totals.income)}%` }} />
                        </span>
                        <span className="relative flex h-full w-[14px] flex-col justify-end sm:w-[22px]">
                          {showOut && p.totals.expense > 0 && (
                            <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-v2-caption font-semibold tabular-nums text-v2-text" style={{ bottom: `calc(${pct(p.totals.expense)}% + 4px)` }}>
                              {fmtMln(p.totals.expense, lang)}
                            </span>
                          )}
                          <span className={`block w-full rounded-t-[4px] ${barCls(2, partial)}`} style={{ height: `${pct(p.totals.expense)}%` }} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Maslahat oynasi — ustunning o'ng yonida (rasmdagidek), oxirgi ikkitasida — chapda */}
              {hover !== null && points[hover] && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute top-[38%] z-10 w-max min-w-[176px] rounded-v2-lg border border-v2-border bg-v2-surface px-3.5 py-3 text-v2-small shadow-v2-md"
                  style={hover <= n - 3 ? { left: `calc(${((hover + 1) / n) * 100}% + 4px)` } : { right: `calc(${((n - hover) / n) * 100}% + 4px)` }}
                >
                  <div className="text-v2-caption text-v2-text-3">{monthName(points[hover].key)}</div>
                  {points[hover].hasData ? (
                    <>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="h-0.5 w-3 rounded-full bg-v2-series-1" aria-hidden />
                        <b className="font-semibold tabular-nums text-v2-text">{mln(points[hover].totals.income)}</b>
                        <span className="text-v2-text-2">{t("Kirim")}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="h-0.5 w-3 rounded-full bg-v2-series-2" aria-hidden />
                        <b className="font-semibold tabular-nums text-v2-text">{mln(points[hover].totals.expense)}</b>
                        <span className="text-v2-text-2">{t("Chiqim")}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 border-t border-v2-border pt-2">
                        <span className="w-3" aria-hidden />
                        <b className={`font-semibold tabular-nums ${points[hover].totals.net < 0 ? "text-v2-danger" : "text-v2-text"}`}>{mln(points[hover].totals.net)}</b>
                        <span className="text-v2-text-2">{t("Sof foyda")}</span>
                      </div>
                    </>
                  ) : (
                    <div className="mt-1.5 text-v2-text-2">{t("Bu oyda yozuv yo'q")}</div>
                  )}
                </div>
              )}

              {empty && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="rounded-v2-md bg-v2-surface-2 px-3 py-2 text-v2-small text-v2-text-2">{t("Bu davrda kirim yoki chiqim yo'q")}</span>
                </div>
              )}
            </div>

            {/* X o'qi */}
            <div />
            <div className="grid pt-2" style={{ gridTemplateColumns: `repeat(${n || 6}, minmax(0, 1fr))` }}>
              {points.map((p, i) => (
                <span key={p.key} className={`truncate text-center text-v2-caption ${hover === i ? "font-semibold text-v2-text" : "text-v2-text-2"}`}>
                  {tick(p.key)}
                  {/* Tor ekranda sig'maydi — faqat oy nomi. */}
                  {i === last && partialDay ? <span className="hidden sm:inline"> · 1–{partialDay}</span> : null}
                </span>
              ))}
            </div>

            {/* Sof foyda qatori */}
            <div className="pt-3 text-v2-caption text-v2-text-2">{t("Sof foyda")}</div>
            <div className="grid pt-3" style={{ gridTemplateColumns: `repeat(${n || 6}, minmax(0, 1fr))` }}>
              {points.map((p, i) => (
                <span
                  key={p.key}
                  className={`text-center text-v2-small tabular-nums ${!p.hasData ? "text-v2-text-3" : p.totals.net < 0 ? "font-medium text-v2-danger" : i === maxNetIdx ? "font-semibold text-v2-text" : "font-medium text-v2-text"}`}
                >
                  {loading ? "—" : p.hasData ? fmtMln(p.totals.net, lang) : "—"}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
