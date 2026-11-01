"use client";

import { useRef, type ReactNode } from "react";
import { Crown, FilePlus, FunnelX, SearchX } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useT } from "@/components/shared/Language";
import type { PodiumPlace, RankRow } from "@/lib/examRanking";
import TierBadge from "./TierBadge";
import { examGroupTitle } from "./sarhisobCore";
import type { CenterRanking } from "./useCenterRanking";

// ESKI VERSIYA — Imtihon → Sarhisob → «Markaz reytingi» (01.11.2026; yangi versiyada
// components/v2/imtihon/CenterRankingV2, qoidalar bitta — lib/examRanking.ts,
// useCenterRanking.ts). Oyning barcha guruhlaridagi o'quvchilar bitta reytingda: to'rt
// ko'rsatkich, 1–3-o'rinlar kartochkasi (teng natijada bir o'rinda bir necha o'quvchi) va
// jadval (o'rin, o'quvchi, fan, guruh, ustoz, to'g'ri javob, foiz — eski to'rt rangli shkala).
// Qator yoki ism bosilsa — shu guruh sarhisobi (SarhisobDetailDrawer). Filtrlar sahifaning
// o'zida (SarhisobView). Telefon ko'rsatilmaydi (reyting surati e'lon qilinishi mumkin).

/** Kartochkadagi ism: uch o'rin — 4 tadan, ikki — 6, bitta (hamma 1-o'rinda teng, keng kartochka) — 12. */
const PODIUM_NAMES: Record<number, number> = { 1: 12, 2: 6, 3: 4 };

function Kpi({ value, sub, label }: { value: string | number; sub?: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[24px] leading-tight font-bold tabular-nums tracking-tight">{value}</span>
        {sub && <span className="text-[13px] font-medium tabular-nums text-muted-foreground">{sub}</span>}
      </div>
      <div className="text-[12px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function RankBadge({ rank, pct }: { rank: number; pct: number }) {
  const top = pct > 0 && rank <= 3;
  return (
    <span
      className={`inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded-lg text-[12px] font-bold tabular-nums ${
        top ? (rank === 1 ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" : "bg-primary/10 text-primary") : "text-muted-foreground"
      }`}
    >
      {rank}
    </span>
  );
}

function PlaceCard({ place, first, limit, wide, onOpen }: { place: PodiumPlace; first: boolean; limit: number; wide: boolean; onOpen: (r: RankRow) => void }) {
  const { t } = useT();
  const shown = place.rows.slice(0, limit);
  const more = place.rows.length - shown.length;
  return (
    <div className={`rounded-xl border px-4 py-3.5 ${first ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ${
            first ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" : "bg-secondary text-muted-foreground"
          }`}
        >
          {first && <Crown className="w-3.5 h-3.5" aria-hidden />}
          {t("{n}-o'rin", { n: place.rank })}
        </span>
        {place.rows.length > 1 && <span className="mr-auto text-[12px] text-muted-foreground">{t("{n} o'quvchi", { n: place.rows.length })}</span>}
        <span className="text-[20px] font-bold tabular-nums">{place.pct}%</span>
      </div>
      <ul className={`mt-2.5 grid gap-x-4 gap-y-1 ${wide ? "sm:grid-cols-2 lg:grid-cols-3" : ""}`}>
        {shown.map((r) => (
          <li key={r.key}>
            <button type="button" onClick={() => onOpen(r)} className="group w-full text-left rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-secondary/60">
              <span className="block truncate text-[14px] font-semibold group-hover:underline underline-offset-2">{r.name}</span>
              <span className="block truncate text-[12px] text-muted-foreground">
                {r.course} · {examGroupTitle(r, t)} · {t("{correct} / {total} to'g'ri", { correct: r.correct, total: r.total })}
              </span>
            </button>
          </li>
        ))}
        {more > 0 && <li className="col-span-full text-[12px] text-muted-foreground">{t("yana {n} ta — jadvalda", { n: more })}</li>}
      </ul>
    </div>
  );
}

function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">
      <div className="mx-auto mb-2 flex w-10 h-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">{icon}</div>
      <div className="text-[14px] font-semibold text-foreground mb-0.5">{title}</div>
      {text}
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}

const outlineBtn =
  "inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed";

export default function CenterRankingView({
  rk,
  loading,
  monthTitle,
  onOpen,
  onAdd,
  onClearFilters,
}: {
  rk: CenterRanking;
  loading: boolean;
  monthTitle: string;
  onOpen: (examId: number) => void;
  onAdd: () => void;
  onClearFilters: () => void;
}) {
  const { t } = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const { stats } = rk;
  const openRow = (r: RankRow) => onOpen(r.examId);

  let empty: ReactNode = null;
  if (!loading && rk.pool.length === 0) {
    empty = (
      <Empty
        icon={<FilePlus className="w-5 h-5" />}
        title={t("Bu oyda sarhisob yo'q")}
        text={t("Guruh tanlab birinchi natijani kiriting.")}
        action={
          <button onClick={onAdd} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90">
            <FilePlus className="w-4 h-4" />
            {t("Natija qo'shish")}
          </button>
        }
      />
    );
  } else if (!loading && rk.ranked.length === 0) {
    empty = (
      <Empty
        icon={<FunnelX className="w-5 h-5" />}
        title={t("Filtrga mos natija yo'q")}
        text={t("Bu oyda tanlangan fan, bosqich, ustoz yoki guruh bo'yicha natija kiritilmagan.")}
        action={
          <button type="button" onClick={onClearFilters} className={outlineBtn}>
            {t("Filtrlarni tozalash")}
          </button>
        }
      />
    );
  } else if (!loading && rk.visible.length === 0) {
    empty = (
      <Empty
        icon={<SearchX className="w-5 h-5" />}
        title={t("Hech narsa topilmadi")}
        text={t("Ism yoki telefonni tekshiring — qidiruv tanlangan filtrlar ichida.")}
        action={
          <button type="button" onClick={() => rk.setQuery("")} className={outlineBtn}>
            {t("Qidiruvni tozalash")}
          </button>
        }
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi value={loading ? "—" : stats.pupils} label={t("Qatnashgan o'quvchi")} />
        <Kpi value={loading ? "—" : stats.groups} label={t("Guruhlar")} />
        <Kpi value={loading || stats.avg === null ? "—" : `${stats.avg}%`} label={t("O'rtacha natija")} />
        <Kpi
          value={loading ? "—" : stats.high}
          sub={!loading && stats.results ? `${Math.round((stats.high / stats.results) * 100)}%` : undefined}
          label={t("80% va yuqori")}
        />
      </div>

      {!loading && rk.podium.length > 0 && (
        // O'rinlar soni teng natijaga bog'liq (1, 1, 3 …) — ustunlar shunga teng, bo'sh joy qolmaydi.
        <section aria-label={t("Eng yaxshi uchlik")} className={`grid gap-3 ${rk.podium.length >= 3 ? "md:grid-cols-3" : rk.podium.length === 2 ? "md:grid-cols-2" : ""}`}>
          {rk.podium.slice(0, 3).map((p, i) => (
            <PlaceCard key={p.rank} place={p} first={i === 0} limit={PODIUM_NAMES[Math.min(3, rk.podium.length)]} wide={rk.podium.length === 1} onOpen={openRow} />
          ))}
        </section>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <div className="text-[15px] font-semibold">{t("Markaz reytingi · {month}", { month: monthTitle })}</div>
          {!loading && (
            <div className="text-[12px] text-muted-foreground">
              {t("{n} natija", { n: rk.ranked.length })} · {t("foiz bo'yicha, teng natija — teng o'rin")}
            </div>
          )}
        </div>
        {loading ? (
          <div className="px-4 py-8">
            <SpinnerBlock size={22} />
          </div>
        ) : (
          empty ?? (
            <>
              <div ref={boxRef} className="table-box">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40">
                    <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="text-left px-4 py-3 whitespace-nowrap w-16">{t("O'rin")}</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">{t("O'quvchi")}</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">{t("Fan")}</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">{t("Guruh")}</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">{t("Ustoz")}</th>
                      <th className="text-right px-4 py-3 whitespace-nowrap">{t("To'g'ri javob")}</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">{t("Natija")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rk.pageRows.map((r) => (
                      <tr
                        key={r.key}
                        onClick={() => openRow(r)}
                        className="border-b border-border/50 last:border-b-0 hover:bg-secondary/30 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-2.5">
                          <RankBadge rank={r.rank} pct={r.pct} />
                        </td>
                        <td className="px-4 py-2.5 text-[13px] font-semibold">{r.name}</td>
                        <td className="px-4 py-2.5 text-[13px]">{r.course}</td>
                        <td className="px-4 py-2.5 text-[13px]">
                          {examGroupTitle(r, t)}
                          {r.level ? <span className="text-muted-foreground"> · {t(r.level)}</span> : null}
                        </td>
                        <td className="px-4 py-2.5 text-[13px]">{r.teacher || "—"}</td>
                        <td className="px-4 py-2.5 text-[13px] tabular-nums text-right whitespace-nowrap">
                          {r.correct}
                          <span className="text-muted-foreground"> / {r.total}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <TierBadge pct={r.pct} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                totalItems={rk.visible.length}
                page={rk.page}
                pageSize={rk.pageSize}
                onPageChange={(p) => {
                  rk.setPage(p);
                  boxRef.current?.scrollTo({ top: 0 });
                }}
                onPageSizeChange={rk.setPageSize}
              />
            </>
          )
        )}
      </div>
    </>
  );
}
