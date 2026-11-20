"use client";

import { memo, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowRight, Users } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import StaffName from "@/components/v2/ui/StaffName";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { roomLabel, timeLabel } from "@/components/v2/ui/groupStatus";
import { hhmm } from "@/components/v2/employees/scheduleUtils";
import type { Group } from "@/lib/groups";

// YANGI VERSIYA — GURUH → «DARS JADVALI» (/groups-schedule) KO'RINISHLARI (54-qism, rasmsiz, 20.11.2026).
// Uch ko'rinish, hammasi bitta joylashuvdan (./GroupScheduleV2.tsx → `SchedLesson`):
//   • GridView  — ustunlar xona yoki o'qituvchi, qatorlar soatlar (eski «Ustun ko'rinishi»);
//   • RowView   — qatorlar xona yoki o'qituvchi, o'q bo'ylab soatlar (eski «Qator ko'rinishi»,
//                 Hisobotlar → Xonalar bandligi qolipi);
//   • ListView  — telefon uchun kun ro'yxati (boshlanish vaqti bo'yicha).
// Blok — Xonalar bandligidagi kabi: `surface`, chap 3 px `brand` chiziq, fan nuqtasi; bir ustunda
// vaqti kesishgan darslar yonma-yon va `warning` chiziqda (eskisida ikkinchisi chizilmay qolardi).
// Sichqoncha ostida — guruh ma'lumoti kartasi (`LessonHoverCard`, eski paneldagi qatorlar).

export type GroupBy = "room" | "teacher";

export interface SchedColumn {
  key: string;
  label: string;
  /** Xona sig'imi (faqat xona ustunida, bazadagi xona bo'lsa). */
  capacity: number | null;
  /** Shu ustundagi darslar soni. */
  count: number;
}

export interface SchedLesson {
  key: string;
  group: Group;
  /** Daqiqada, kun boshidan. */
  start: number;
  end: number;
  col: number;
  lane: number;
  lanes: number;
  /** Shu ustunda (xona yoki o'qituvchi) boshqa dars bilan vaqti kesishadi. */
  clash: boolean;
}

export type HoverFn = (lesson: SchedLesson | null, rect: DOMRect | null) => void;

export const HOUR_PX = 64;
const TIME_W = 56;
const COL_MIN = 168;
const HOUR_W = 132;
const NAME_W = 168;
const LANE_PX = 52;

/** Soat chiziqlari — fon gradienti (har soatda to'liq, yarim soatda och chiziq). */
function hourLines(dir: "down" | "right", step: number) {
  const solid = "var(--v2-border)";
  const faint = "color-mix(in srgb, var(--v2-border) 45%, transparent)";
  const to = dir === "down" ? "to bottom" : "to right";
  return {
    backgroundImage: `linear-gradient(${to}, ${solid} 1px, transparent 1px), linear-gradient(${to}, ${faint} 1px, transparent 1px)`,
    backgroundSize: dir === "down" ? `100% ${step}px, 100% ${step}px` : `${step}px 100%, ${step}px 100%`,
    backgroundPosition: dir === "down" ? `0 0, 0 ${step / 2}px` : `0 0, ${step / 2}px 0`,
  };
}

function groupTitle(g: Group): string {
  return [g.course, g.level].filter(Boolean).join(" · ") || g.name;
}

/* ============================ Blok ============================ */

/** Blok balandligiga qarab: xs — faqat nom, sm — vaqt + nom + o'qituvchi/xona, md — ostida №guruh va o'quvchilar. */
type BlockSize = "xs" | "sm" | "md";
function blockSize(px: number): BlockSize {
  return px < 44 ? "xs" : px < 80 ? "sm" : "md";
}

function LessonBlock({ l, groupBy, onHover, style, size }: { l: SchedLesson; groupBy: GroupBy; onHover: HoverFn; style: CSSProperties; size: BlockSize }) {
  const { t } = useT();
  const g = l.group;
  const sub = groupBy === "room" ? g.teacher : roomLabel(g.room);
  return (
    <Link
      href={`/groups/${g.id}`}
      style={style}
      onMouseEnter={(e) => onHover(l, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => onHover(null, null)}
      onFocus={(e) => onHover(l, e.currentTarget.getBoundingClientRect())}
      onBlur={() => onHover(null, null)}
      aria-label={`№${g.name} · ${groupTitle(g)} · ${timeLabel(g.time)}${l.clash ? ` · ${t("bir vaqtga to'g'ri kelgan")}` : ""}`}
      className={`absolute flex flex-col overflow-hidden rounded-[6px] border-l-[3px] bg-v2-surface px-2 py-1 text-left shadow-v2-sm ring-1 transition-[box-shadow,background-color] hover:bg-v2-surface-2 hover:shadow-v2-md focus-visible:outline-none focus-visible:shadow-v2-focus ${
        l.clash ? "border-v2-warning ring-v2-warning" : "border-v2-brand ring-v2-border"
      }`}
    >
      {size !== "xs" && (
        <span className="flex items-center justify-between gap-1 text-[11px] leading-4 tabular-nums text-v2-text-2">
          <span className="truncate">
            {hhmm(l.start)}–{hhmm(l.end)}
          </span>
          {l.clash && <AlertTriangle className="size-3 shrink-0 text-v2-warning" strokeWidth={2} aria-hidden />}
        </span>
      )}
      <span className="flex min-w-0 items-center gap-1.5 text-v2-small font-semibold leading-[18px] text-v2-text">
        <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />
        <span className="truncate">{groupTitle(g)}</span>
      </span>
      {size !== "xs" && sub && <span className="truncate text-[11px] leading-4 text-v2-text-2">{sub}</span>}
      {size === "md" && (
        <span className="mt-auto flex items-center justify-between gap-1 text-[11px] leading-4 text-v2-text-3">
          <span className="truncate">№{g.name}</span>
          <span className="inline-flex shrink-0 items-center gap-0.5 tabular-nums">
            <Users className="size-3" strokeWidth={1.75} aria-hidden />
            {g.students}
          </span>
        </span>
      )}
    </Link>
  );
}

/* ============================ Ustun sarlavhasi ============================ */

function ColumnHead({ c, groupBy }: { c: SchedColumn; groupBy: GroupBy }) {
  const { t } = useT();
  const empty = c.count === 0;
  return (
    <div className="min-w-0">
      <div className={`truncate text-v2-small font-semibold ${empty ? "text-v2-text-3" : "text-v2-text"}`} title={c.label}>
        {groupBy === "teacher" ? <StaffName name={c.label} /> : roomLabel(c.label)}
      </div>
      <div className="truncate text-v2-caption font-normal text-v2-text-3">
        {[c.capacity ? t("{n} o'rin", { n: c.capacity }) : "", empty ? t("dars yo'q") : t("{n} dars", { n: c.count })].filter(Boolean).join(" · ")}
      </div>
    </div>
  );
}

/* ============================ Ustunlar (vertikal vaqt) ============================ */

function GridViewInner({
  columns,
  lessons,
  range,
  groupBy,
  onHover,
  nowMin,
}: {
  columns: SchedColumn[];
  lessons: SchedLesson[];
  range: { from: number; to: number };
  groupBy: GroupBy;
  onHover: HoverFn;
  nowMin: number | null;
}) {
  const hours = range.to - range.from;
  const height = hours * HOUR_PX;
  const byCol = columns.map((_, i) => lessons.filter((l) => l.col === i));
  const nowTop = nowMin !== null && nowMin >= range.from * 60 && nowMin <= range.to * 60 ? ((nowMin - range.from * 60) / 60) * HOUR_PX : null;
  return (
    <div className="grid" style={{ gridTemplateColumns: `${TIME_W}px repeat(${columns.length}, minmax(${COL_MIN}px, 1fr))`, minWidth: TIME_W + columns.length * COL_MIN }}>
      {/* Sarlavha qatori */}
      <div className="sticky left-0 top-0 z-30 bg-v2-surface-2 shadow-[inset_0_-1px_0_var(--v2-border),inset_-1px_0_0_var(--v2-border)]" />
      {columns.map((c) => (
        <div key={c.key} className="sticky top-0 z-20 bg-v2-surface-2 px-3 py-2 shadow-[inset_0_-1px_0_var(--v2-border),inset_1px_0_0_var(--v2-border)]">
          <ColumnHead c={c} groupBy={groupBy} />
        </div>
      ))}

      {/* Soatlar o'qi */}
      <div className="sticky left-0 z-10 bg-v2-surface shadow-[inset_-1px_0_0_var(--v2-border)]" style={{ height }}>
        {Array.from({ length: hours }, (_, i) => (
          <span key={i} className="absolute right-2 text-v2-caption font-normal tabular-nums text-v2-text-3" style={{ top: i * HOUR_PX + 4 }}>
            {`${String(range.from + i).padStart(2, "0")}:00`}
          </span>
        ))}
        {nowTop !== null && <span className="absolute right-0 size-2 -translate-y-1/2 translate-x-1/2 rounded-full bg-v2-danger" style={{ top: nowTop }} aria-hidden />}
      </div>

      {/* Ustunlar */}
      {columns.map((c, i) => (
        <div key={c.key} className="relative shadow-[inset_1px_0_0_var(--v2-border)]" style={{ height, ...hourLines("down", HOUR_PX) }}>
          {nowTop !== null && <span className="pointer-events-none absolute inset-x-0 z-[5] h-px bg-v2-danger" style={{ top: nowTop }} aria-hidden />}
          {byCol[i].map((l) => {
            const top = ((l.start - range.from * 60) / 60) * HOUR_PX + 2;
            const h = Math.max(((l.end - l.start) / 60) * HOUR_PX - 4, 24);
            return (
              <LessonBlock
                key={l.key}
                l={l}
                groupBy={groupBy}
                onHover={onHover}
                size={blockSize(h)}
                style={{ top, height: h, left: `calc(${(l.lane / l.lanes) * 100}% + 4px)`, width: `calc(${100 / l.lanes}% - 8px)` }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ============================ Qatorlar (gorizontal vaqt) ============================ */

function RowViewInner({
  columns,
  lessons,
  range,
  groupBy,
  onHover,
  nowMin,
}: {
  columns: SchedColumn[];
  lessons: SchedLesson[];
  range: { from: number; to: number };
  groupBy: GroupBy;
  onHover: HoverFn;
  nowMin: number | null;
}) {
  const hours = range.to - range.from;
  const width = hours * HOUR_W;
  const byCol = columns.map((_, i) => lessons.filter((l) => l.col === i));
  const nowLeft = nowMin !== null && nowMin >= range.from * 60 && nowMin <= range.to * 60 ? ((nowMin - range.from * 60) / 60) * HOUR_W : null;
  return (
    <div style={{ minWidth: NAME_W + width }}>
      {/* Soatlar o'qi */}
      <div className="sticky top-0 z-20 flex bg-v2-surface-2 shadow-[inset_0_-1px_0_var(--v2-border)]">
        <div className="sticky left-0 z-10 shrink-0 bg-v2-surface-2 px-3 py-2.5 text-v2-small font-medium text-v2-text-2 shadow-[inset_-1px_0_0_var(--v2-border)]" style={{ width: NAME_W }}>
          {groupBy === "room" ? <RoomWord /> : <TeacherWord />}
        </div>
        <div className="relative shrink-0" style={{ width }}>
          {Array.from({ length: hours }, (_, i) => (
            <span key={i} className="absolute top-1/2 -translate-y-1/2 pl-2 text-v2-caption font-normal tabular-nums text-v2-text-3" style={{ left: i * HOUR_W }}>
              {`${String(range.from + i).padStart(2, "0")}:00`}
            </span>
          ))}
        </div>
      </div>
      {columns.map((c, i) => {
        const lanes = byCol[i].reduce((m, l) => Math.max(m, l.lanes), 1);
        const rowH = Math.max(lanes * LANE_PX + 8, 60);
        return (
          <div key={c.key} className="flex border-b border-v2-border last:border-b-0">
            <div className="sticky left-0 z-10 flex shrink-0 items-center bg-v2-surface px-3 py-2 shadow-[inset_-1px_0_0_var(--v2-border)]" style={{ width: NAME_W }}>
              <ColumnHead c={c} groupBy={groupBy} />
            </div>
            <div className="relative shrink-0" style={{ width, height: rowH, ...hourLines("right", HOUR_W) }}>
              {nowLeft !== null && <span className="pointer-events-none absolute inset-y-0 z-[5] w-px bg-v2-danger" style={{ left: nowLeft }} aria-hidden />}
              {byCol[i].map((l) => {
                const left = ((l.start - range.from * 60) / 60) * HOUR_W + 2;
                const w = Math.max(((l.end - l.start) / 60) * HOUR_W - 4, 40);
                const laneH = (rowH - 8) / l.lanes;
                return (
                  <LessonBlock
                    key={l.key}
                    l={l}
                    groupBy={groupBy}
                    onHover={onHover}
                    size={blockSize(laneH - 4)}
                    style={{ left, width: w, top: 4 + l.lane * laneH, height: laneH - 4 }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoomWord() {
  const { t } = useT();
  return <>{t("Xona")}</>;
}
function TeacherWord() {
  const { t } = useT();
  return <>{t("O'qituvchi")}</>;
}

/* ============================ Ro'yxat (telefon) ============================ */

function ListViewInner({ lessons, columns, groupBy, nowMin }: { lessons: SchedLesson[]; columns: SchedColumn[]; groupBy: GroupBy; nowMin: number | null }) {
  const { t } = useT();
  const sorted = [...lessons].sort((a, b) => a.start - b.start || a.end - b.end || a.col - b.col);
  const starts = [...new Set(sorted.map((l) => l.start))];
  return (
    <ol className="divide-y divide-v2-border">
      {starts.map((s) => {
        const items = sorted.filter((l) => l.start === s);
        const live = nowMin !== null && items.some((l) => nowMin >= l.start && nowMin < l.end);
        return (
          <li key={s} className="flex gap-3 px-4 py-3">
            <div className="w-12 shrink-0 pt-0.5 text-right">
              <div className={`text-v2-body font-semibold tabular-nums ${live ? "text-v2-brand-text" : "text-v2-text"}`}>{hhmm(s)}</div>
              {live && <div className="text-v2-caption text-v2-brand-text">{t("hozir")}</div>}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {items.map((l) => {
                const g = l.group;
                const colName = columns[l.col]?.label ?? "";
                const where = groupBy === "room" ? [roomLabel(colName), g.teacher] : [g.teacher, roomLabel(g.room)];
                return (
                  <Link
                    key={l.key}
                    href={`/groups/${g.id}`}
                    className={`block rounded-v2-md border-l-[3px] bg-v2-surface px-3 py-2 shadow-v2-sm ring-1 transition-colors hover:bg-v2-surface-2 focus-visible:outline-none focus-visible:shadow-v2-focus ${
                      l.clash ? "border-v2-warning ring-v2-warning" : "border-v2-brand ring-v2-border"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-semibold text-v2-text">{groupTitle(g)}</span>
                      <span className="shrink-0 text-v2-caption tabular-nums text-v2-text-2">
                        {hhmm(l.start)}–{hhmm(l.end)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate pl-3.5 text-v2-small text-v2-text-2">{where.filter(Boolean).join(" · ") || "—"}</span>
                    <span className="mt-0.5 flex items-center gap-3 pl-3.5 text-v2-caption text-v2-text-3">
                      <span className="truncate">№{g.name}</span>
                      <span className="inline-flex shrink-0 items-center gap-0.5 tabular-nums">
                        <Users className="size-3" strokeWidth={1.75} aria-hidden />
                        {g.students}
                      </span>
                      {l.clash && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-v2-warning">
                          <AlertTriangle className="size-3" strokeWidth={2} aria-hidden />
                          {t("bir vaqtga to'g'ri kelgan")}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Setka sichqoncha harakatida QAYTA CHIZILMAYDI (eski sahifadagi sabab): hover holati ota komponentda,
 * ko'rinishlar `memo` — `columns`/`lessons` `useMemo` da, `onHover` `useCallback` da.
 */
export const GridView = memo(GridViewInner);
export const RowView = memo(RowViewInner);
export const ListView = memo(ListViewInner);

/* ============================ Sichqoncha ostidagi karta ============================ */

function CardRow({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-v2-small">
      <span className="shrink-0 text-v2-text-2">{k}</span>
      <span className="min-w-0 break-words text-right font-medium text-v2-text">{children}</span>
    </div>
  );
}

/**
 * Blok ustidagi karta — <body> ga portal (jadval o'z qutisida aylanadi, ichida kesilib qolardi), o'zi
 * `data-ui="v2"`. Karta sichqonchani qabul qiladi (havolalar bosilsin); yopilish chaqiruvchida
 * kechiktirilgan — blokdan kartaga o'tishda yo'qolmasin (eski paneldagidek).
 */
export function LessonHoverCard({ lesson, rect, onEnter, onLeave }: { lesson: SchedLesson; rect: DOMRect; onEnter: () => void; onLeave: () => void }) {
  const { t } = useT();
  const g = lesson.group;
  const W = 288;
  const H = 250;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - W - 8));
  const below = rect.bottom + 8;
  const top = below + H > window.innerHeight ? Math.max(8, rect.top - H - 8) : below;
  return createPortal(
    <div
      data-ui="v2"
      role="tooltip"
      style={{ position: "fixed", top, left, width: W, zIndex: 1100 }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="space-y-1.5 rounded-v2-lg border border-v2-border bg-v2-surface p-3 font-v2 text-v2-text shadow-v2-md"
    >
      <div className="flex items-center gap-2 border-b border-v2-border pb-2">
        <span className={`size-2.5 shrink-0 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />
        <span className="min-w-0 truncate text-v2-body font-semibold">
          №{g.name} · {g.course || "—"}
        </span>
      </div>
      <CardRow k={t("O'qituvchi")}>
        <StaffName name={g.teacher} />
      </CardRow>
      <CardRow k={t("Xona")}>{g.room ? roomLabel(g.room) : "—"}</CardRow>
      <CardRow k={t("Vaqti")}>
        <span className="tabular-nums">{timeLabel(g.time) || "—"}</span>
      </CardRow>
      <CardRow k={t("Kunlari")}>{g.day ? t(g.day) : "—"}</CardRow>
      <CardRow k={t("Daraja")}>{g.level || "—"}</CardRow>
      <CardRow k={t("O'quvchilar")}>
        <span className="tabular-nums">{g.students}</span>
      </CardRow>
      <CardRow k={t("Davri")}>
        <span className={g.periodExpired ? "text-v2-danger" : ""}>{g.period || "—"}</span>
      </CardRow>
      {lesson.clash && (
        <div className="flex items-start gap-1.5 rounded-v2-md bg-v2-warning-bg px-2 py-1.5 text-v2-caption text-v2-text">
          <AlertTriangle className="mt-px size-3.5 shrink-0 text-v2-warning" strokeWidth={2} aria-hidden />
          {t("Shu ustunda boshqa dars bilan vaqti kesishadi")}
        </div>
      )}
      <Link href={`/groups/${g.id}`} className="mt-1 flex items-center gap-1 border-t border-v2-border pt-2 text-v2-small font-semibold text-v2-brand-text hover:underline">
        {t("Guruh sahifasini ochish")}
        <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
      </Link>
    </div>,
    document.body,
  );
}
