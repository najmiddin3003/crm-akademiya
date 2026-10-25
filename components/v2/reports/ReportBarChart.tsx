"use client";

import { useState, type ReactNode } from "react";
import { useT } from "@/components/shared/Language";
import { niceAxis } from "@/components/v2/finance/analyticsShared";

// YANGI VERSIYA — HISOBOT GRAFIGI (rasm «Kelgan va ketgan · Oyma-oy», 25.10.2026): ikki
// seriyali guruhlangan ustunlar — 1-slot ko'k, 2-slot to'q sariq (`--v2-series-1/2`,
// 6-qism «Kirim va chiqim · oyma-oy» bilan bir tizim: ustun ≤ 22 px, tepasi 4 px
// yumaloq; davom etayotgan oy — shu rang 55%). Sichqoncha / fokus ustun ustida — kulrang
// fon, ustunlar ustida son va maslahat oynasi (oy, seriyalar, ostida chiziq bilan
// `extra` — «+47 sof o'sish»). Oxirgi (davom etayotgan) oy sonlari doim ko'rinadi.
// Ma'lumotsiz oy (`values` null) — ustunsiz, maslahatda «ma'lumot yo'q».

export interface ChartPoint {
  key: string;
  /** X o'qidagi qisqa nom («Sen», «Okt*»). */
  tick: string;
  /** Maslahatdagi to'liq nom («Sentabr 2026»). */
  title: string;
  /** Har seriya qiymati; null — noma'lum. */
  values: (number | null)[];
  partial?: boolean;
  /** Maslahat oynasi ostidagi qator. */
  extra?: { value: string; label: string; tone?: "danger" | "success" };
}

const BAR = ["bg-v2-series-1", "bg-v2-series-2"];
const BAR_SOFT = [
  "bg-[color-mix(in_srgb,var(--v2-series-1)_55%,var(--v2-surface))]",
  "bg-[color-mix(in_srgb,var(--v2-series-2)_55%,var(--v2-surface))]",
];

export default function ReportBarChart({
  title,
  subtitle,
  series,
  points,
  format,
  loading,
  stale,
  emptyText,
  aside,
  minTop = 0,
}: {
  title: string;
  subtitle?: string;
  series: string[];
  points: ChartPoint[];
  format: (v: number) => string;
  loading: boolean;
  stale?: boolean;
  emptyText: string;
  /** Sarlavha o'ng tomonidagi qo'shimcha (legenda yonida). */
  aside?: ReactNode;
  /** O'qning eng kichik tepasi (sonlar uchun — bo'sh grafikda «0 · 2 · 4 · 6»). */
  minTop?: number;
}) {
  const { t } = useT();
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;
  const max = Math.max(minTop, ...points.flatMap((p) => p.values.map((v) => v ?? 0)));
  const axis = niceAxis(max);
  const ticks = Array.from({ length: Math.round(axis.top / axis.step) + 1 }, (_, i) => i * axis.step);
  const pct = (v: number) => Math.max(0, Math.min(100, (v / axis.top) * 100));
  const last = n - 1;
  const empty = !loading && points.every((p) => p.values.every((v) => !v));
  const cols = { gridTemplateColumns: `repeat(${n || 6}, minmax(0, 1fr))` };

  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-v2-section text-v2-text">{title}</h2>
          {subtitle && <p className="mt-0.5 text-v2-small text-v2-text-2">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-v2-small text-v2-text-2">
            {series.map((s, i) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={`size-2.5 rounded-[3px] ${BAR[i] ?? BAR[0]}`} aria-hidden />
                {s}
              </span>
            ))}
          </div>
          {aside}
        </div>
      </div>

      <div className={`mt-5 grid grid-cols-[40px_minmax(0,1fr)] transition-opacity sm:grid-cols-[48px_minmax(0,1fr)] ${stale ? "opacity-60" : ""}`} onPointerLeave={() => setHover(null)}>
        <div className="relative h-[190px] sm:h-[220px]" aria-hidden>
          {ticks.map((v) => (
            <span key={v} className="absolute right-3 translate-y-1/2 whitespace-nowrap text-v2-caption tabular-nums text-v2-text-3" style={{ bottom: `${pct(v)}%` }}>
              {format(v)}
            </span>
          ))}
        </div>

        <div className="relative h-[190px] sm:h-[220px]">
          {ticks.map((v) => (
            <span key={v} aria-hidden className={`absolute inset-x-0 h-px ${v === 0 ? "bg-v2-border-strong" : "bg-v2-border"}`} style={{ bottom: `${pct(v)}%` }} />
          ))}
          {loading ? (
            <div className="absolute inset-0 grid items-end" style={cols} aria-hidden>
              {Array.from({ length: n || 6 }, (_, i) => (
                <div key={i} className="flex h-full items-end justify-center gap-1">
                  <span className="w-[14px] rounded-t-[4px] bg-v2-skeleton sm:w-[22px]" style={{ height: `${30 + ((i * 17) % 45)}%` }} />
                  <span className="w-[14px] rounded-t-[4px] bg-v2-skeleton sm:w-[22px]" style={{ height: `${20 + ((i * 11) % 35)}%` }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="absolute inset-0 grid" style={cols}>
              {points.map((p, i) => {
                const on = hover === i;
                const showNums = on || (i === last && !!p.partial);
                const label = `${p.title}: ${series.map((s, si) => `${s} ${p.values[si] === null ? "—" : format(p.values[si] ?? 0)}`).join(", ")}${p.extra ? `, ${p.extra.value} ${p.extra.label}` : ""}`;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onPointerEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover((h) => (h === i ? null : h))}
                    aria-label={label}
                    className={`relative mx-0.5 flex h-full items-end justify-center gap-1 rounded-v2-md pb-px transition-colors focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--v2-brand)] sm:mx-2 ${on ? "bg-v2-hover" : ""}`}
                  >
                    {series.map((s, si) => {
                      const v = p.values[si];
                      return (
                        <span key={s} className="relative flex h-full w-[14px] flex-col justify-end sm:w-[22px]">
                          {showNums && v !== null && (
                            <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-v2-caption font-semibold tabular-nums text-v2-text" style={{ bottom: `calc(${pct(v)}% + 4px)` }}>
                              {format(v)}
                            </span>
                          )}
                          {v !== null && <span className={`block w-full rounded-t-[4px] ${(p.partial ? BAR_SOFT : BAR)[si] ?? BAR[0]}`} style={{ height: `${pct(v)}%` }} />}
                        </span>
                      );
                    })}
                  </button>
                );
              })}
            </div>
          )}

          {hover !== null && points[hover] && (
            <div
              role="tooltip"
              className="pointer-events-none absolute top-[30%] z-10 w-max min-w-[160px] rounded-v2-lg border border-v2-border bg-v2-surface px-3.5 py-3 text-v2-small shadow-v2-md"
              style={hover <= n - 3 ? { left: `calc(${((hover + 1) / n) * 100}% + 4px)` } : { right: `calc(${((n - hover) / n) * 100}% + 4px)` }}
            >
              <div className="text-v2-caption text-v2-text-3">{points[hover].title}</div>
              {points[hover].values.every((v) => v === null) ? (
                <div className="mt-1.5 text-v2-text-2">{t("Bu oy uchun ma'lumot yo'q")}</div>
              ) : (
                <>
                  {series.map((s, si) => (
                    <div key={s} className="mt-1.5 flex items-center gap-2">
                      <span className={`h-0.5 w-3 rounded-full ${BAR[si] ?? BAR[0]}`} aria-hidden />
                      <b className="font-semibold tabular-nums text-v2-text">{points[hover].values[si] === null ? "—" : format(points[hover].values[si] ?? 0)}</b>
                      <span className="text-v2-text-2">{s.toLowerCase()}</span>
                    </div>
                  ))}
                  {points[hover].extra && (
                    <div className="mt-2 flex items-center gap-2 border-t border-v2-border pt-2">
                      <span className="w-3" aria-hidden />
                      <b className={`font-semibold tabular-nums ${points[hover].extra.tone === "danger" ? "text-v2-danger" : "text-v2-text"}`}>{points[hover].extra.value}</b>
                      <span className="text-v2-text-2">{points[hover].extra.label}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {empty && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-v2-md bg-v2-surface-2 px-3 py-2 text-v2-small text-v2-text-2">{emptyText}</span>
            </div>
          )}
        </div>

        <div />
        <div className="grid pt-2" style={cols}>
          {points.map((p, i) => (
            <span key={p.key} className={`truncate text-center text-v2-caption ${hover === i ? "font-semibold text-v2-text" : "text-v2-text-2"}`}>
              {p.tick}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
