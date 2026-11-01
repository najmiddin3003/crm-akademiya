"use client";

import type { ReactNode } from "react";
import { Crown } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { examGroupTitle, type PodiumPlace, type RankRow, type RankStats } from "@/lib/examRanking";

// MARKAZ REYTINGI — UMUMIY BO'LAKLAR (01.11.2026): CRM'dagi Imtihon → Sarhisob → «Markaz reytingi»
// (CenterRankingV2) va ochiq havola sahifasi (/natijalar/markaz/<kalit>, PublicCenterRanking)
// bir xil ko'rinsin — to'rt ko'rsatkich, o'rin belgisi va 1–3-o'rinlar kartochkasi shu yerda.
// Uchlik ochiq sahifada bosilmaydi (`onOpen` berilmaydi) — CRM'da ism bosilsa guruh sarhisobi.

/**
 * Uchlik kartochkasida ko'rinadigan ism (qolgani jadvalda) — o'rinlar soniga qarab: uch o'rin
 * bo'lsa 4 tadan, ikki o'rin — 6, hamma 1-o'rinda teng (bitta keng kartochka) — 12.
 */
const PODIUM_NAMES: Record<number, number> = { 1: 12, 2: 6, 3: 4 };
/** Tor ekranda (< 40rem, kartochkalar ustma-ust) — har kartochkada. */
const MOBILE_NAMES = 4;

/** O'rin: 1 — `warning-bg`, 2–3 — `brand-bg` kvadrat (0% bo'lsa — oddiy raqam). */
export function RankBadge({ rank, pct }: { rank: number; pct: number }) {
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

/** To'rt ko'rsatkich: qatnashgan o'quvchi, guruhlar, o'rtacha natija, 80% va yuqori. */
export function RankKpis({ stats, loading = false }: { stats: RankStats; loading?: boolean }) {
  const { t } = useT();
  const kpis: { label: string; value: string; sub?: string }[] = [
    { label: t("Qatnashgan o'quvchi"), value: String(stats.pupils) },
    { label: t("Guruhlar"), value: String(stats.groups) },
    { label: t("O'rtacha natija"), value: stats.avg === null ? "—" : `${stats.avg}%` },
    { label: t("80% va yuqori"), value: String(stats.high), sub: stats.results ? `${Math.round((stats.high / stats.results) * 100)}%` : undefined },
  ];
  return (
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
  );
}

/** Bosiladigan (CRM) yoki oddiy (ochiq sahifa) ism bloki. */
function NameBox({ onClick, className, children }: { onClick?: () => void; className: string; children: ReactNode }) {
  return onClick ? (
    <button type="button" onClick={onClick} className={`group focus-visible:outline-none focus-visible:shadow-v2-focus ${className}`}>
      {children}
    </button>
  ) : (
    <div className={className}>{children}</div>
  );
}

function PodiumCard({ place, first, limit, wide, onOpen }: { place: PodiumPlace; first: boolean; limit: number; wide: boolean; onOpen?: (r: RankRow) => void }) {
  const { t } = useT();
  const single = place.rows.length === 1 ? place.rows[0] : null;
  const shown = place.rows.slice(0, limit);
  const more = place.rows.length - shown.length;
  const moreMobile = place.rows.length - Math.min(shown.length, MOBILE_NAMES);
  const hoverName = onOpen ? "group-hover:underline group-hover:underline-offset-2" : "";
  const avatar = (r: RankRow, big: boolean) => (
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
        <NameBox onClick={onOpen && (() => onOpen(single))} className="mt-2 flex max-w-full flex-col items-center rounded-v2-md px-2 py-1">
          {avatar(single, true)}
          <span className={`mt-2 max-w-full truncate text-v2-body font-semibold text-v2-text ${hoverName}`}>{single.name}</span>
          <span className="flex max-w-full items-center gap-1.5 text-v2-caption text-v2-text-2">
            <span className={`size-1.5 shrink-0 rounded-full ${FAN_DOT[fanOf(single.course)]}`} aria-hidden />
            <span className="truncate">{meta(single)}</span>
          </span>
        </NameBox>
      ) : (
        <ul className={`mt-2 grid w-full gap-x-3 gap-y-0.5 ${wide ? "min-[40rem]:grid-cols-2 min-[64rem]:grid-cols-3" : ""}`}>
          {shown.map((r, i) => (
            // Tor ekranda (bir ustun) har kartochkada ko'pi bilan MOBILE_NAMES ta — jadvalgacha uzun ro'yxat bo'lmasin.
            <li key={r.key} className={i >= MOBILE_NAMES ? "max-[40rem]:hidden" : undefined}>
              <NameBox
                onClick={onOpen && (() => onOpen(r))}
                className={`flex w-full items-center gap-2 rounded-v2-md px-2 py-1 text-left transition-colors ${onOpen ? (first ? "hover:bg-v2-surface" : "hover:bg-v2-surface-2") : ""}`}
              >
                {avatar(r, false)}
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-v2-small font-semibold text-v2-text ${hoverName}`}>{r.name}</span>
                  <span className="block truncate text-v2-caption text-v2-text-2">{meta(r)}</span>
                </span>
              </NameBox>
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
export function Podium({ places, onOpen }: { places: PodiumPlace[]; onOpen?: (r: RankRow) => void }) {
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
