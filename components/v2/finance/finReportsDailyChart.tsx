"use client";

import { useState } from "react";
import { ChartColumn, Table2 } from "lucide-react";
import { useLang, useT } from "@/components/shared/Language";
import { Segmented } from "@/components/v2/form/fields";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { fmtMln, niceAxis } from "./analyticsShared";
import type { DailyPoint } from "./finReportsCalc";
import { FIN_TH, finNum } from "./finReportsKit";

// YANGI VERSIYA — «KIRIM VA CHIQIM · KUNMA-KUN» (Moliya hisobotlari, 28-qism moliya-A). Moliya
// analitikasidagi oyma-oy grafik (./AnalyticsCashChart.tsx) tizimida: Kirim — `series-1`, Chiqim —
// `series-2`, ustun tepasi 4 px yumaloq, o'q chapda mln so'mda, sichqoncha / fokus — kulrang fon va
// maslahat oynasi (sana, kirim, chiqim, farq). Kun ko'p bo'lsa ustun torayadi, o'qdagi yozuvlar
// siyraklashadi (~6 ta). «Jadval» — xuddi shu raqamlar to'liq so'mda (eski sahifadagi
// «chiziqli / ustunli» almashtirgich o'rnida).

export default function FinDailyChart({
  points,
  loading,
  view,
  onView,
  subtitle,
}: {
  points: DailyPoint[];
  loading: boolean;
  view: "chart" | "table";
  onView: (v: "chart" | "table") => void;
  subtitle: string;
}) {
  const { t } = useT();
  const [lang] = useLang();
  const f = useProfileFmt();
  const [hover, setHover] = useState<number | null>(null);

  const n = points.length;
  const max = Math.max(0, ...points.map((p) => Math.max(p.income, p.expense)));
  const axis = niceAxis(max);
  const ticks = Array.from({ length: Math.round(axis.top / axis.step) + 1 }, (_, i) => i * axis.step);
  const pct = (v: number) => Math.max(0, Math.min(100, (v / axis.top) * 100));
  const axisLabel = (v: number) => (v === 0 ? "0" : `${fmtMln(v, lang).replace(/[,.]0$/, "")} ${t("mln")}`);
  const every = Math.max(1, Math.ceil(n / 6));
  const empty = !loading && n > 0 && points.every((p) => p.income === 0 && p.expense === 0);
  const cols = { gridTemplateColumns: `repeat(${Math.max(n, 1)}, minmax(0, 1fr))` };
  const gap = n > 45 ? "gap-0" : "gap-px sm:gap-0.5";
  const sum = (k: "income" | "expense") => points.reduce((s, p) => s + p[k], 0);

  return (
    <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm" aria-label={t("Kirim va chiqim · kunma-kun")}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-3.5 pb-2.5 sm:px-5 sm:pt-4">
        <div className="min-w-0">
          <h2 className="text-v2-section text-v2-text">{t("Kirim va chiqim · kunma-kun")}</h2>
          <p className="mt-0.5 text-v2-small text-v2-text-2">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
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

      {!loading && n === 0 ? (
        <div className="mx-4 mb-4 rounded-v2-md bg-v2-surface-2 px-3 py-10 text-center text-v2-small text-v2-text-2 sm:mx-5">
          {t("Kunma-kun grafik uchun davrni tanlang — «Barcha sanalar»da u chizilmaydi.")}
        </div>
      ) : view === "table" ? (
        <div className="relative max-h-[420px] overflow-auto border-t border-v2-border">
          <table className="w-full min-w-[420px] border-collapse text-v2-body">
            <caption className="sr-only">{t("Kirim va chiqim · kunma-kun")}</caption>
            <thead>
              <tr>
                <th scope="col" className={`${FIN_TH} text-left`}>
                  {t("Sana")}
                </th>
                <th scope="col" className={`${FIN_TH} text-right`}>
                  {t("Kirim")}
                </th>
                <th scope="col" className={`${FIN_TH} text-right`}>
                  {t("Chiqim")}
                </th>
                <th scope="col" className={`${FIN_TH} text-right`}>
                  {t("Farq")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }, (_, i) => (
                    <tr key={i} className="border-b border-v2-border" aria-hidden>
                      {Array.from({ length: 4 }, (_, j) => (
                        <td key={j} className={`px-4 py-3 ${j ? "text-right" : ""}`}>
                          <span className={`inline-block h-3 rounded bg-v2-skeleton ${j ? "w-20" : "w-24"}`} />
                        </td>
                      ))}
                    </tr>
                  ))
                : points.map((p) => {
                    const net = p.income - p.expense;
                    const quiet = p.income === 0 && p.expense === 0;
                    return (
                      <tr key={p.date} className="border-b border-v2-border">
                        <td className={`whitespace-nowrap px-4 py-2.5 ${quiet ? "text-v2-text-3" : "text-v2-text"}`}>{f.dayMonth(p.date)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-v2-text">{p.income ? finNum(p.income) : <span className="text-v2-text-3">—</span>}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-v2-text">{p.expense ? finNum(p.expense) : <span className="text-v2-text-3">—</span>}</td>
                        <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${quiet ? "text-v2-text-3" : net < 0 ? "text-v2-danger" : "text-v2-text"}`}>{quiet ? "—" : finNum(net)}</td>
                      </tr>
                    );
                  })}
            </tbody>
            {!loading && (
              <tfoot>
                <tr className="bg-v2-surface-2 font-semibold">
                  <td className="px-4 py-3 text-v2-text">{t("Jami")}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-v2-text">{finNum(sum("income"))}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-v2-text">{finNum(sum("expense"))}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${sum("income") - sum("expense") < 0 ? "text-v2-danger" : "text-v2-text"}`}>{finNum(sum("income") - sum("expense"))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-[48px_minmax(0,1fr)] px-4 pb-4 pt-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:px-5 sm:pb-5" onPointerLeave={() => setHover(null)}>
          {/* Y o'qi */}
          <div className="relative h-[200px] sm:h-[230px]" aria-hidden>
            {ticks.map((v) => (
              <span key={v} className="absolute right-2.5 translate-y-1/2 whitespace-nowrap text-v2-caption tabular-nums text-v2-text-3" style={{ bottom: `${pct(v)}%` }}>
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
              <div className="absolute inset-0 grid items-end" style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }} aria-hidden>
                {Array.from({ length: 20 }, (_, i) => (
                  <div key={i} className="flex h-full items-end justify-center gap-0.5">
                    <span className="w-[30%] rounded-t-[3px] bg-v2-skeleton" style={{ height: `${25 + ((i * 17) % 50)}%` }} />
                    <span className="w-[30%] rounded-t-[3px] bg-v2-skeleton" style={{ height: `${15 + ((i * 11) % 35)}%` }} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="absolute inset-0 grid" style={cols}>
                {points.map((p, i) => (
                  <button
                    key={p.date}
                    type="button"
                    onPointerEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover((h) => (h === i ? null : h))}
                    aria-label={`${f.dayMonth(p.date)}: ${t("Kirim")} ${finNum(p.income)}, ${t("Chiqim")} ${finNum(p.expense)} ${t("so'm")}`}
                    className={`flex h-full min-w-0 items-end justify-center pb-px transition-colors focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--v2-brand)] ${gap} ${hover === i ? "bg-v2-hover" : ""}`}
                  >
                    <span className="block max-w-[12px] flex-1 rounded-t-[3px] bg-v2-series-1" style={{ height: `${pct(p.income)}%` }} />
                    <span className="block max-w-[12px] flex-1 rounded-t-[3px] bg-v2-series-2" style={{ height: `${pct(p.expense)}%` }} />
                  </button>
                ))}
              </div>
            )}

            {/* Maslahat oynasi — ustunning o'ng yonida, o'ng yarmida — chapda */}
            {hover !== null && points[hover] && (
              <div
                role="tooltip"
                className="pointer-events-none absolute top-[12%] z-10 w-max min-w-[180px] rounded-v2-lg border border-v2-border bg-v2-surface px-3.5 py-3 text-v2-small shadow-v2-md"
                style={hover < n / 2 ? { left: `calc(${((hover + 1) / n) * 100}% + 4px)` } : { right: `calc(${((n - hover) / n) * 100}% + 4px)` }}
              >
                <div className="text-v2-caption text-v2-text-3">{f.dayMonth(points[hover].date)}</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="h-0.5 w-3 rounded-full bg-v2-series-1" aria-hidden />
                  <b className="font-semibold tabular-nums text-v2-text">{finNum(points[hover].income)}</b>
                  <span className="text-v2-text-2">{t("Kirim")}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-0.5 w-3 rounded-full bg-v2-series-2" aria-hidden />
                  <b className="font-semibold tabular-nums text-v2-text">{finNum(points[hover].expense)}</b>
                  <span className="text-v2-text-2">{t("Chiqim")}</span>
                </div>
                <div className="mt-2 flex items-center gap-2 border-t border-v2-border pt-2">
                  <span className="w-3" aria-hidden />
                  <b className={`font-semibold tabular-nums ${points[hover].income - points[hover].expense < 0 ? "text-v2-danger" : "text-v2-text"}`}>
                    {finNum(points[hover].income - points[hover].expense)}
                  </b>
                  <span className="text-v2-text-2">{t("Farq")}</span>
                </div>
              </div>
            )}

            {empty && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="rounded-v2-md bg-v2-surface-2 px-3 py-2 text-v2-small text-v2-text-2">{t("Bu davrda kirim yoki chiqim yo'q")}</span>
              </div>
            )}
          </div>

          {/* X o'qi — siyrak yozuvlar (~6 ta) */}
          <div />
          <div className="grid pt-2" style={cols} aria-hidden>
            {points.map((p, i) => (
              <span key={p.date} className="relative h-4">
                {(i % every === 0 || hover === i) && (
                  <span
                    className={`absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-v2-caption tabular-nums ${hover === i ? "z-[1] bg-v2-surface px-0.5 font-semibold text-v2-text" : "text-v2-text-2"}`}
                  >
                    {p.label}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
