"use client";

import { useMemo } from "react";
import { AlertTriangle, CalendarDays } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { FAN_BG, FAN_BORDER, FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { GROUP_TONE, roomLabel, timeLabel } from "@/components/v2/ui/groupStatus";
import { SCHEDULE_DAY_LABELS } from "@/constants/groupsSchedule";
import type { Group } from "@/lib/groups";
import { findClashes, groupDays, hhmm, hourRange, layoutDay, slotsOf, visibleDays, weeklyMinutes, type Clash } from "./scheduleUtils";

// YANGI VERSIYA — XODIM PROFILI → «GURUHLAR VA JADVAL» (rasm «Xodim profili», 20.10.2026):
// sarlavha + «3 ta guruh · haftada 12 soat»; haftalik jadval (Du–Sha ustunlar, soat
// chiziqlari, guruh bloklari fan rangida, xona raqami bilan; bir vaqtga to'g'ri kelgan
// bloklar yonma-yon va `warning` chegarada); ostida ogohlantirish («Toq kunlar
// 14:00–16:00 da ikki guruh bir vaqtga to'g'ri kelgan: …») va guruhlar ro'yxati
// (fan nuqtasi, nom, «Toq kunlar · 14:00–16:00 · 205-xona», o'quvchilar soni, holat).
// Hisob — ./scheduleUtils.ts.

const HOUR_PX = 44;

export interface ProfileGroup extends Group {
  /** Xodim bu guruhda yordamchi o'qituvchi. */
  asAssistant?: boolean;
}

const DAY_PATTERNS: Record<string, number[]> = {
  "Toq kunlar": [1, 3, 5],
  "Juft kunlar": [2, 4, 6],
  "Hafta kunlari": [1, 2, 3, 4, 5],
};

function sameDays(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Xona — blokda faqat raqami («205»), raqam bo'lmasa nomi. */
function roomShort(room: string | undefined): string {
  const d = /\d+/.exec(room || "");
  return d ? d[0] : (room || "").trim();
}

export default function EmployeeScheduleCard({ groups, loading }: { groups: ProfileGroup[]; loading: boolean }) {
  const { t, weekdaysShort } = useT();
  const slots = useMemo(() => slotsOf(groups), [groups]);
  const range = useMemo(() => hourRange(slots), [slots]);
  const days = useMemo(() => visibleDays(slots), [slots]);
  const clashes = useMemo(() => findClashes(slots), [slots]);
  const hours = Math.round((weeklyMinutes(slots) / 60) * 10) / 10;
  const clashIds = useMemo(() => new Set(clashes.flatMap((c) => c.groups.map((g) => g.id))), [clashes]);

  const dayName = (i: number) => weekdaysShort[i] ?? SCHEDULE_DAY_LABELS[i];
  const groupName = (g: Group) => (g.name || "").trim() || `#${g.id}`;
  const roomOf = (g: Group) => roomLabel((g.room || "").replace(/\s*-\s*xona$/i, "-xona"));

  /** «Toq kunlar» (guruhlar shu qolipda bo'lsa) yoki «Du, Chor». */
  function clashDays(c: Clash<ProfileGroup>): string {
    for (const [label, set] of Object.entries(DAY_PATTERNS)) {
      if (sameDays(c.days, set) && c.groups.every((g) => sameDays(groupDays(g.day), set))) return t(label);
    }
    return c.days.map(dayName).join(", ");
  }
  function clashText(c: Clash<ProfileGroup>) {
    const n = c.groups.length;
    const count = n === 2 ? t("ikki guruh") : t("{n} ta guruh", { n });
    return (
      <>
        {t("{days} {from}–{to} da {count} bir vaqtga to'g'ri kelgan:", { days: clashDays(c), from: hhmm(c.start), to: hhmm(c.end), count })}{" "}
        {c.groups.map((g, i) => (
          <span key={g.id}>
            {i > 0 && (i === c.groups.length - 1 ? ` ${t("va")} ` : ", ")}
            <b className="font-semibold">
              {groupName(g)}
              {roomShort(g.room) ? ` (${roomShort(g.room)})` : ""}
            </b>
          </span>
        ))}
        .
      </>
    );
  }

  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm" aria-label={t("Guruhlar va jadval")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-v2-section text-v2-text">{t("Guruhlar va jadval")}</h2>
        {!loading && groups.length > 0 && (
          <span className="text-v2-small text-v2-text-2">
            {t("{n} ta guruh", { n: groups.length })}
            {hours > 0 && ` · ${t("haftada {h} soat", { h: String(hours).replace(".", ",") })}`}
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-4 space-y-3" aria-hidden>
          <div className="h-40 rounded-v2-md bg-v2-skeleton" />
          <div className="h-4 w-2/3 rounded bg-v2-skeleton" />
          <div className="h-4 w-1/2 rounded bg-v2-skeleton" />
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
            <CalendarDays className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="text-v2-body font-medium text-v2-text">{t("Guruh biriktirilmagan")}</div>
          <p className="text-v2-small text-v2-text-2">{t("O'qituvchi yoki yordamchi sifatida guruhi yo'q.")}</p>
        </div>
      ) : (
        <>
          {range ? (
            <div className="mt-4 overflow-x-auto">
              {/* pb-2 — oxirgi soat yozuvi («18:00») chiziq ustida o'rtada turadi, pastga chiqmasin. */}
              <div className="min-w-[520px] pb-2">
                {/* Kunlar */}
                <div className="flex pl-11">
                  {days.map((d) => {
                    const busy = slots.some((s) => s.day === d);
                    return (
                      <div key={d} className={`flex-1 pb-1.5 text-center text-v2-small ${busy ? "font-semibold text-v2-text" : "text-v2-text-3"}`}>
                        {dayName(d)}
                      </div>
                    );
                  })}
                </div>
                {/* Soatlar va bloklar */}
                <div className="relative flex" style={{ height: (range.to - range.from) * HOUR_PX }}>
                  <div className="relative w-11 shrink-0">
                    {Array.from({ length: range.to - range.from + 1 }, (_, i) => (
                      <span
                        key={i}
                        className="absolute right-2 -translate-y-1/2 text-v2-caption font-normal tabular-nums text-v2-text-3"
                        style={{ top: i * HOUR_PX }}
                      >
                        {`${String(range.from + i).padStart(2, "0")}:00`}
                      </span>
                    ))}
                  </div>
                  <div className="relative flex flex-1 border-b border-v2-border">
                    {Array.from({ length: range.to - range.from }, (_, i) => (
                      <div key={i} className="pointer-events-none absolute inset-x-0 border-t border-v2-border" style={{ top: i * HOUR_PX }} aria-hidden />
                    ))}
                    {days.map((d) => (
                      <div key={d} className="relative flex-1 border-l border-v2-border last:border-r">
                        {layoutDay(slots.filter((s) => s.day === d)).map(({ slot, lane, lanes, clash }) => {
                          const g = slot.group;
                          const fan = fanOf(g.course);
                          const top = ((slot.start - range.from * 60) / 60) * HOUR_PX + 2;
                          const height = Math.max(((slot.end - slot.start) / 60) * HOUR_PX - 4, 18);
                          return (
                            <Link
                              key={`${g.id}-${slot.start}`}
                              href={`/groups/${g.id}`}
                              title={`${groupName(g)} · ${timeLabel(g.time)}${g.room ? ` · ${roomOf(g)}` : ""}${clash ? ` · ${t("bir vaqtga to'g'ri kelgan")}` : ""}`}
                              className={`absolute overflow-hidden rounded-v2-sm border px-1.5 py-1 text-left transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:shadow-v2-focus ${FAN_BG[fan]} ${clash ? "border-v2-warning" : FAN_BORDER[fan]}`}
                              style={{
                                top,
                                height,
                                left: `calc(${(lane / lanes) * 100}% + 3px)`,
                                width: `calc(${100 / lanes}% - 6px)`,
                              }}
                            >
                              <span className="block truncate text-[11px] font-semibold leading-4 text-v2-text">{groupName(g)}</span>
                              {roomShort(g.room) && <span className="block truncate text-[11px] leading-4 text-v2-text-2">{roomShort(g.room)}</span>}
                            </Link>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-v2-small text-v2-text-3">{t("Guruhlarning dars vaqti kiritilmagan — jadval chizilmadi.")}</p>
          )}

          {clashes.map((c, i) => (
            <div key={i} role="note" className="mt-3 flex items-start gap-2 rounded-v2-md bg-v2-warning-bg px-3 py-2.5 text-v2-small text-v2-text">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-v2-warning" strokeWidth={2} aria-hidden />
              <span>{clashText(c)}</span>
            </div>
          ))}

          <ul className="mt-3 divide-y divide-v2-border">
            {groups.map((g) => {
              const tone = GROUP_TONE[g.status] ?? null;
              const count = g.studentIds?.length ?? g.students ?? 0;
              const parts = [g.day ? t(g.day) : "", timeLabel(g.time), g.room ? roomOf(g) : ""].filter(Boolean);
              return (
                <li key={g.id} className="flex items-center gap-3 py-2.5">
                  <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <Link href={`/groups/${g.id}`} className="truncate text-v2-body font-semibold text-v2-text underline-offset-2 hover:text-v2-brand-text hover:underline">
                        {groupName(g)}
                      </Link>
                      {g.asAssistant && <span className="shrink-0 rounded-v2-sm bg-v2-surface-2 px-1.5 py-px text-v2-caption text-v2-text-2">{t("yordamchi")}</span>}
                      {clashIds.has(g.id) && <AlertTriangle className="size-3.5 shrink-0 text-v2-warning" strokeWidth={2} aria-label={t("bir vaqtga to'g'ri kelgan")} />}
                    </div>
                    <div className="mt-0.5 truncate text-v2-caption text-v2-text-2">{parts.join(" · ") || t("Dars vaqti kiritilmagan")}</div>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-v2-small text-v2-text-2">{t("{n} o'quvchi", { n: count })}</span>
                  {tone && <span className={`inline-flex h-6 shrink-0 items-center rounded-v2-sm px-2 text-v2-caption font-medium ${tone.badge}`}>{t(tone.label)}</span>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
