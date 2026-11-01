"use client";

import { useRef, type ReactNode } from "react";
import { FilePlus, FunnelX, Plus, SearchX } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import { examGroupTitle } from "@/components/imtihon/sarhisobCore";
import type { CenterRanking } from "@/components/imtihon/useCenterRanking";
import type { RankRow } from "@/lib/examRanking";
import { ScoreBar, examBand, examTh } from "./examBits";
import { Podium, RankBadge, RankKpis } from "./rankingBits";

// YANGI VERSIYA — IMTIHON → SARHISOB → MARKAZ REYTINGI (01.11.2026, SAVOLLAR 238). Rasmi
// KELMAGAN — gamifikatsiya «Reyting» sahifasi (RankingV2, DESIGN.md → «Gamifikatsiya») tilida:
// to'rt ko'rsatkich; uchlik — `surface-2` qutida o'rin kartochkalari (uchta bo'lsa 2 · 1 · 3,
// birinchisi `brand` chegara + `brand-bg`, 👑 `warning-bg` belgi). TENG NATIJADA bir o'rinda bir
// necha o'quvchi va keyingi o'rin tushib qoladi (1, 1, 3) — kartochkalar soni shunga moslanadi
// (Podium izohi), ortig'i «yana N ta — jadvalda»; jadval: O'rin (1 — `warning-bg`, 2–3 —
// `brand-bg` kvadrat) | O'quvchi | Fan | Guruh | Ustoz | To'g'ri javob | Natija, 50/100/200 qatorli
// sahifalash. Qator yoki uchlikdagi ism bosilsa — shu guruh sarhisobi (SarhisobDetailV2).
// Telefon ko'rsatilmaydi (reyting surati e'lon qilinishi mumkin) — qidiruv uni baribir topadi.
// Hisob va filtrlar — components/imtihon/useCenterRanking.ts (qoidalar lib/examRanking.ts).

// To'rt ko'rsatkich, o'rin belgisi va uchlik — rankingBits.tsx (ochiq havola sahifasi ham shundan).

function EmptyCell({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">{icon}</span>
      <div className="text-v2-section text-v2-text">{title}</div>
      {text && <p className="text-v2-small text-v2-text-2">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export default function CenterRankingV2({
  rk,
  loading,
  monthTitle,
  onOpen,
  onAdd,
  onClearFilters,
}: {
  rk: CenterRanking;
  loading: boolean;
  /** «Oktabr 2026». */
  monthTitle: string;
  /** Guruh sarhisobi (tafsilot oynasi). */
  onOpen: (examId: number) => void;
  onAdd: () => void;
  /** Fan, bosqich, ustoz, guruh va qidiruvni tozalaydi. */
  onClearFilters: () => void;
}) {
  const { t } = useT();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { stats } = rk;
  const openRow = (r: RankRow) => onOpen(r.examId);

  let empty: ReactNode = null;
  if (!loading && rk.pool.length === 0) {
    empty = (
      <EmptyCell
        icon={<FilePlus className="size-5" strokeWidth={1.75} aria-hidden />}
        title={t("Bu oyda sarhisob yo'q")}
        text={t("Guruh tanlab birinchi natijani kiriting.")}
        action={
          <button type="button" onClick={onAdd} className={primaryBtn}>
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            {t("Natija kiritish")}
          </button>
        }
      />
    );
  } else if (!loading && rk.ranked.length === 0) {
    empty = (
      <EmptyCell
        icon={<FunnelX className="size-5" strokeWidth={1.75} aria-hidden />}
        title={t("Filtrga mos natija yo'q")}
        text={t("Bu oyda tanlangan fan, bosqich, ustoz yoki guruh bo'yicha natija kiritilmagan.")}
        action={
          <button type="button" onClick={onClearFilters} className={secondaryBtn}>
            {t("Filtrlarni tozalash")}
          </button>
        }
      />
    );
  } else if (!loading && rk.visible.length === 0) {
    empty = (
      <EmptyCell
        icon={<SearchX className="size-5" strokeWidth={1.75} aria-hidden />}
        title={t("Hech narsa topilmadi")}
        text={t("Ism yoki telefonni tekshiring — qidiruv tanlangan filtrlar ichida.")}
        action={
          <button type="button" onClick={() => rk.setQuery("")} className={secondaryBtn}>
            {t("Qidiruvni tozalash")}
          </button>
        }
      />
    );
  }

  return (
    <>
      <RankKpis stats={stats} loading={loading} />

      {!loading && rk.podium.length > 0 && <Podium places={rk.podium} onOpen={openRow} />}

      <div className="flex min-h-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3">
          <h2 className="text-v2-section text-v2-text">{t("Markaz reytingi · {month}", { month: monthTitle })}</h2>
          <p className="text-v2-small text-v2-text-2">
            {loading ? "" : `${t("{n} natija", { n: rk.ranked.length })} · ${t("foiz bo'yicha, teng natija — teng o'rin")}`}
          </p>
        </div>
        <div ref={scrollRef} className="max-h-[70vh] min-h-0 overflow-auto">
          <table className="w-full min-w-[820px] border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${examTh} w-16 pl-4 pr-2`}>{t("O'rin")}</th>
                <th className={`${examTh} px-3`}>{t("O'quvchi")}</th>
                <th className={`${examTh} px-3`}>{t("Fan")}</th>
                <th className={`${examTh} px-3`}>{t("Guruh")}</th>
                <th className={`${examTh} px-3`}>{t("Ustoz")}</th>
                <th className={`${examTh} px-3 text-right`}>{t("To'g'ri javob")}</th>
                <th className={`${examTh} pl-3 pr-4`}>{t("Natija")}</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={`sk${i}`} className="border-b border-v2-border" aria-hidden>
                    {Array.from({ length: 7 }, (__, j) => (
                      <td key={j} className={`py-3.5 ${j === 0 ? "pl-4 pr-2" : "px-3"}`}>
                        <div className={`h-3 rounded bg-v2-skeleton ${j === 0 ? "w-6" : "w-20"}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              {empty && (
                <tr>
                  <td colSpan={7} className="p-6">
                    {empty}
                  </td>
                </tr>
              )}
              {!loading &&
                rk.pageRows.map((r) => (
                  <tr
                    key={r.key}
                    tabIndex={0}
                    onClick={() => openRow(r)}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                        e.preventDefault();
                        openRow(r);
                      }
                    }}
                    className={`group cursor-pointer border-b border-v2-border last:border-b-0 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--v2-brand)] ${ROW_TINT.hover}`}
                  >
                    <td className="py-2.5 pl-4 pr-2">
                      <RankBadge rank={r.rank} pct={r.pct} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-[11px] font-semibold text-v2-text-2" aria-hidden>
                          {initialsOf(r.name)}
                        </span>
                        <span className="truncate font-semibold text-v2-text group-hover:underline group-hover:underline-offset-2">{r.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(r.course)]}`} aria-hidden />
                        <span className="truncate text-v2-small text-v2-text">{r.course}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-v2-small">
                      <span className="text-v2-text">{examGroupTitle(r, t)}</span>
                      {r.level ? <span className="text-v2-text-3"> · {t(r.level)}</span> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-v2-small text-v2-text">{r.teacher || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-v2-small tabular-nums text-v2-text">
                      {r.correct}
                      <span className="text-v2-text-3"> / {r.total}</span>
                    </td>
                    <td className="py-2.5 pl-3 pr-4">
                      <span className="flex items-center gap-2.5">
                        <ScoreBar pct={r.pct} className="w-[96px]" />
                        <span className={`text-v2-small font-semibold tabular-nums ${examBand(r.pct) === "low" ? "text-v2-warning" : "text-v2-text"}`}>{r.pct}%</span>
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!loading && rk.visible.length > 0 && (
          <V2Pagination
            totalItems={rk.visible.length}
            page={rk.page}
            pageSize={rk.pageSize}
            onPageChange={(p) => {
              rk.setPage(p);
              scrollRef.current?.scrollTo({ top: 0 });
            }}
            onPageSizeChange={rk.setPageSize}
          />
        )}
      </div>
    </>
  );
}
