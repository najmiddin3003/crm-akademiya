"use client";

import { useRef, type ReactNode } from "react";
import { Crown, FilePlus, FunnelX, Plus, SearchX } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import { examGroupTitle } from "@/components/imtihon/sarhisobCore";
import type { CenterRanking } from "@/components/imtihon/useCenterRanking";
import type { PodiumPlace, RankRow } from "@/lib/examRanking";
import { ScoreBar, examBand, examTh } from "./examBits";

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

/**
 * Uchlik kartochkasida ko'rinadigan ism (qolgani jadvalda) — o'rinlar soniga qarab: uch o'rin
 * bo'lsa 4 tadan, ikki o'rin — 6, hamma 1-o'rinda teng (bitta keng kartochka) — 12.
 */
const PODIUM_NAMES: Record<number, number> = { 1: 12, 2: 6, 3: 4 };
/** Tor ekranda (< 40rem, kartochkalar ustma-ust) — har kartochkada. */
const MOBILE_NAMES = 4;

function RankBadge({ rank, pct }: { rank: number; pct: number }) {
  if (pct > 0 && rank <= 3) {
    return (
      <span
        className={`inline-flex size-6 items-center justify-center rounded-v2-md text-v2-caption font-semibold tabular-nums ${
          rank === 1 ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-brand-bg text-v2-brand-text"
        }`}
      >
        {rank}
      </span>
    );
  }
  return <span className="inline-flex w-6 justify-center text-v2-small tabular-nums text-v2-text-2">{rank}</span>;
}

function PodiumCard({ place, first, limit, wide, onOpen }: { place: PodiumPlace; first: boolean; limit: number; wide: boolean; onOpen: (r: RankRow) => void }) {
  const { t } = useT();
  const single = place.rows.length === 1 ? place.rows[0] : null;
  const shown = place.rows.slice(0, limit);
  const more = place.rows.length - shown.length;
  const moreMobile = place.rows.length - Math.min(shown.length, MOBILE_NAMES);
  const avatar =(r: RankRow, big: boolean) => (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border font-semibold ${big ? "size-10 text-v2-small" : "size-7 text-[11px]"} ${
        first ? "border-v2-brand bg-v2-surface text-v2-text" : "border-v2-border bg-v2-surface-2 text-v2-text-2"
      }`}
      aria-hidden
    >
      {initialsOf(r.name)}
    </span>
  );
  const meta = (r: RankRow) => `${r.course} · ${examGroupTitle(r, t)}`;

  return (
    <div
      className={`flex min-w-0 flex-col items-center rounded-v2-lg border px-3 py-4 text-center ${
        first ? "order-first border-v2-brand bg-v2-brand-bg min-[40rem]:order-none" : "border-v2-border bg-v2-surface"
      }`}
    >
      <span
        className={`inline-flex items-center gap-1 rounded-v2-full px-2 py-0.5 text-v2-caption font-semibold ${
          first ? "bg-v2-warning-bg text-v2-warning" : "border border-v2-border bg-v2-surface-2 text-v2-text-2"
        }`}
      >
        {first && <Crown className="size-3.5" strokeWidth={2} aria-hidden />}
        {t("{n}-o'rin", { n: place.rank })}
      </span>
      {/* Natija — o'rin belgisidan keyin: kartochkalar bo'yi har xil bo'lsa ham bir qatorda turadi. */}
      <span className="mt-2 text-[1.375rem] font-semibold leading-7 tabular-nums text-v2-text">{place.pct}%</span>
      <span className="text-v2-caption text-v2-text-2">
        {single ? t("{correct} / {total} to'g'ri", { correct: single.correct, total: single.total }) : t("{n} o'quvchi", { n: place.rows.length })}
      </span>

      {single ? (
        <button
          type="button"
          onClick={() => onOpen(single)}
          className="group mt-2 flex max-w-full flex-col items-center rounded-v2-md px-2 py-1 focus-visible:outline-none focus-visible:shadow-v2-focus"
        >
          {avatar(single, true)}
          <span className="mt-2 max-w-full truncate text-v2-body font-semibold text-v2-text group-hover:underline group-hover:underline-offset-2">{single.name}</span>
          <span className="flex max-w-full items-center gap-1.5 text-v2-caption text-v2-text-2">
            <span className={`size-1.5 shrink-0 rounded-full ${FAN_DOT[fanOf(single.course)]}`} aria-hidden />
            <span className="truncate">{meta(single)}</span>
          </span>
        </button>
      ) : (
        <ul className={`mt-2 grid w-full gap-x-3 gap-y-0.5 ${wide ? "min-[40rem]:grid-cols-2 min-[64rem]:grid-cols-3" : ""}`}>
          {shown.map((r, i) => (
            // Tor ekranda (bir ustun) har kartochkada ko'pi bilan MOBILE_NAMES ta — jadvalgacha uzun ro'yxat bo'lmasin.
            <li key={r.key} className={i >= MOBILE_NAMES ? "max-[40rem]:hidden" : undefined}>
              <button
                type="button"
                onClick={() => onOpen(r)}
                className={`group flex w-full items-center gap-2 rounded-v2-md px-2 py-1 text-left transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
                  first ? "hover:bg-v2-surface" : "hover:bg-v2-surface-2"
                }`}
              >
                {avatar(r, false)}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-v2-small font-semibold text-v2-text group-hover:underline group-hover:underline-offset-2">{r.name}</span>
                  <span className="block truncate text-v2-caption text-v2-text-2">{meta(r)}</span>
                </span>
              </button>
            </li>
          ))}
          {more > 0 && (
            <li className={`col-span-full px-2 pt-0.5 text-left text-v2-caption text-v2-text-2 ${moreMobile !== more ? "max-[40rem]:hidden" : ""}`}>
              {t("yana {n} ta — jadvalda", { n: more })}
            </li>
          )}
          {moreMobile !== more && (
            <li className="col-span-full px-2 pt-0.5 text-left text-v2-caption text-v2-text-2 min-[40rem]:hidden">{t("yana {n} ta — jadvalda", { n: moreMobile })}</li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * O'rinlar soni teng natijaga bog'liq (1, 1, 3 …): uchtasi bo'lsa — keng ekranda 2 · 1 · 3
 * (birinchi o'rtada, torda 1, 2, 3 — `order-first`); ikkitasi (1 va 2 yoki 1 va 3) — yonma-yon,
 * birinchisi chapda; bittasi (uch va undan ko'p o'quvchi 1-o'rinda teng) — bitta keng
 * kartochka, ismlar ustun-ustun. Bo'sh joy qoldirilmaydi.
 */
function Podium({ places, onOpen }: { places: PodiumPlace[]; onOpen: (r: RankRow) => void }) {
  const { t } = useT();
  const n = Math.min(3, places.length);
  const slots = n === 3 ? [places[1], places[0], places[2]] : places.slice(0, n);
  const firstAt = n === 3 ? 1 : 0;
  return (
    <section aria-label={t("Eng yaxshi uchlik")} className="rounded-v2-lg border border-v2-border bg-v2-surface-2 p-3 sm:p-4">
      <div className={`grid gap-3 ${n === 3 ? "min-[40rem]:grid-cols-3" : n === 2 ? "min-[40rem]:grid-cols-2" : ""}`}>
        {slots.map((p, i) => (
          <PodiumCard key={p.rank} place={p} first={i === firstAt} limit={PODIUM_NAMES[n]} wide={n === 1} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

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

  const kpis: { label: string; value: string; sub?: string }[] = [
    { label: t("Qatnashgan o'quvchi"), value: String(stats.pupils) },
    { label: t("Guruhlar"), value: String(stats.groups) },
    { label: t("O'rtacha natija"), value: stats.avg === null ? "—" : `${stats.avg}%` },
    { label: t("80% va yuqori"), value: String(stats.high), sub: stats.results ? `${Math.round((stats.high / stats.results) * 100)}%` : undefined },
  ];

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
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border shadow-v2-sm min-[64rem]:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="min-w-0 bg-v2-surface px-4 py-3">
            <div className="truncate text-v2-small font-medium text-v2-text-2">{k.label}</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[1.375rem] font-semibold leading-7 tabular-nums text-v2-text">{loading ? "—" : k.value}</span>
              {!loading && k.sub && <span className="text-v2-small font-medium tabular-nums text-v2-text-2">{k.sub}</span>}
            </div>
          </div>
        ))}
      </div>

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
