"use client";

import { ChartColumn, Table2 } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { Segmented } from "@/components/v2/form/fields";
import type { FunnelStats, SourceStat } from "@/lib/financeAnalytics";
import { fmtPct } from "./analyticsShared";

// YANGI VERSIYA — «LID → O'QUVCHI» (rasm «Moliya analitikasi», 20.10.2026).
//
// Chapda BOSQICHLAR: har bosqichga yetgan lidlar soni va jami lidlarga nisbati —
// tartibli (ordinal) bitta rang: yorug'da och → to'q, qorong'ida teskari
// (`--v2-ord-1…4`, validator `--ordinal` o'tdi). O'ngda MANBA BO'YICHA: chiziq
// uzunligi — manbadan kelgan lidlar (eng kattasiga nisbatan), ichida ko'k qismi —
// o'quvchi bo'lganlar (1-slot), qolgani — trek; raqam «9 / 38 · 24%». Yetti tadan
// ko'p manba — oltitasi + «Boshqalar». «Jadval» — o'sha raqamlar jadvalda.

const STAGES = ["Lidlar", "Bog'lanildi", "Birinchi darsga yozildi", "Guruhga qo'shildi"] as const;
const STAGE_BAR = ["bg-v2-ord-1", "bg-v2-ord-2", "bg-v2-ord-3", "bg-v2-ord-4"] as const;
const MAX_SOURCES = 7;

/** Ko'p manba — oltitasi + «Boshqalar» (yig'indi). */
function topSources(list: SourceStat[]): (SourceStat & { other?: boolean })[] {
  if (list.length <= MAX_SOURCES) return list;
  const head = list.slice(0, MAX_SOURCES - 1);
  const rest = list.slice(MAX_SOURCES - 1);
  return [...head, { source: "Boshqalar", total: rest.reduce((s, x) => s + x.total, 0), joined: rest.reduce((s, x) => s + x.joined, 0), other: true }];
}

export default function AnalyticsLeadFunnel({
  stats,
  subtitle,
  view,
  onView,
  stale,
}: {
  stats: FunnelStats | null;
  subtitle: string;
  view: "chart" | "table";
  onView: (v: "chart" | "table") => void;
  stale: boolean;
}) {
  const { t } = useT();
  const total = stats?.total ?? 0;
  const sources = stats ? topSources(stats.sources) : [];
  const maxSource = Math.max(1, ...sources.map((s) => s.total));
  const label = (s: string) => (s === "—" ? t("Manba ko'rsatilmagan") : t(s));

  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm" aria-label={t("Lid → o'quvchi")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-v2-section text-v2-text">{t("Lid → o'quvchi")}</h2>
          <p className="mt-0.5 text-v2-small text-v2-text-2">{subtitle}</p>
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

      <div className={`mt-5 transition-opacity ${stale ? "opacity-60" : ""}`}>
        {!stats ? (
          <div className="grid gap-8 lg:grid-cols-2" aria-hidden>
            {[0, 1].map((k) => (
              <div key={k} className="space-y-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="h-4 rounded bg-v2-skeleton" style={{ width: `${90 - i * 18}%` }} />
                ))}
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <div className="rounded-v2-lg bg-v2-surface-2 px-4 py-6 text-center text-v2-small text-v2-text-2">{t("Bu davrda lid kelmagan")}</div>
        ) : view === "table" ? (
          <div className="grid gap-8 lg:grid-cols-2">
            <table className="w-full border-collapse text-v2-body">
              <thead>
                <tr className="text-left text-v2-small text-v2-text-2">
                  <th className="border-b border-v2-border py-2 pr-3 font-medium">{t("Bosqich")}</th>
                  <th className="border-b border-v2-border px-3 py-2 text-right font-medium">{t("Lidlar")}</th>
                  <th className="border-b border-v2-border py-2 pl-3 text-right font-medium">{t("Ulushi")}</th>
                </tr>
              </thead>
              <tbody>
                {STAGES.map((s, i) => (
                  <tr key={s} className="border-b border-v2-border last:border-b-0">
                    <td className="py-2.5 pr-3 text-v2-text">{t(s)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-v2-text">{stats.reached[i]}</td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-v2-text-2">{fmtPct(stats.reached[i], total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="w-full border-collapse text-v2-body">
              <thead>
                <tr className="text-left text-v2-small text-v2-text-2">
                  <th className="border-b border-v2-border py-2 pr-3 font-medium">{t("Manba")}</th>
                  <th className="border-b border-v2-border px-3 py-2 text-right font-medium">{t("Lidlar")}</th>
                  <th className="border-b border-v2-border px-3 py-2 text-right font-medium">{t("O'quvchi bo'ldi")}</th>
                  <th className="border-b border-v2-border py-2 pl-3 text-right font-medium">{t("Konversiya")}</th>
                </tr>
              </thead>
              <tbody>
                {stats.sources.map((s) => (
                  <tr key={s.source} className="border-b border-v2-border last:border-b-0">
                    <td className="py-2.5 pr-3 text-v2-text">{label(s.source)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-v2-text">{s.total}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-v2-text">{s.joined}</td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-v2-text-2">{fmtPct(s.joined, s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Bosqichlar */}
            <div>
              <h3 className="mb-3 text-v2-small font-semibold text-v2-text">{t("Bosqichlar")}</h3>
              <ul className="space-y-3">
                {STAGES.map((s, i) => {
                  const v = stats.reached[i];
                  return (
                    <li key={s} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 text-v2-small sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_6.5rem]">
                      <span className="truncate text-v2-text" title={t(s)}>
                        {t(s)}
                      </span>
                      <span className="h-4 min-w-0">
                        <span className={`block h-full rounded-r-[4px] ${STAGE_BAR[i]}`} style={{ width: `${Math.max(v > 0 ? 2 : 0, (v / total) * 100)}%` }} />
                      </span>
                      <span className="whitespace-nowrap tabular-nums text-v2-text-2">
                        <b className="font-semibold text-v2-text">{v}</b> · {fmtPct(v, total)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-v2-caption text-v2-text-3">{t("Har bosqich — o'sha bosqichga yetgan lidlar soni va jami lidlarga nisbati.")}</p>
            </div>

            {/* Manba bo'yicha */}
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-v2-small font-semibold text-v2-text">{t("Manba bo'yicha")}</h3>
                <div className="flex items-center gap-3 text-v2-caption text-v2-text-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-[3px] bg-v2-series-1" aria-hidden />
                    {t("O'quvchi bo'ldi")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-[3px] bg-v2-track" aria-hidden />
                    {t("Hali emas")}
                  </span>
                </div>
              </div>
              <ul className="space-y-3">
                {sources.map((s) => {
                  const w = (s.total / maxSource) * 100;
                  const joinedW = s.total ? (s.joined / s.total) * 100 : 0;
                  return (
                    <li
                      key={s.source}
                      className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 text-v2-small sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_7rem]"
                      title={`${label(s.source)}: ${s.joined} / ${s.total}`}
                    >
                      <span className="truncate text-v2-text">{label(s.source)}</span>
                      <span className="h-4 min-w-0">
                        <span className="flex h-full gap-0.5" style={{ width: `${Math.max(3, w)}%` }}>
                          {s.joined > 0 && <span className={`h-full shrink-0 bg-v2-series-1 ${s.joined === s.total ? "rounded-r-[4px]" : ""}`} style={{ width: `${joinedW}%` }} />}
                          {s.joined < s.total && <span className="h-full min-w-0 flex-1 rounded-r-[4px] bg-v2-track" />}
                        </span>
                      </span>
                      <span className="whitespace-nowrap tabular-nums text-v2-text-2">
                        <b className="font-semibold text-v2-text">
                          {s.joined} / {s.total}
                        </b>{" "}
                        · {fmtPct(s.joined, s.total)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
