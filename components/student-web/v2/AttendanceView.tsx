"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Info, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { Card, CardHead, Empty, FanDot, weekdayOf, useCabinetFmt, type CabinetTabProps } from "./bits";
import { MARK_CELL, MarkPill, cameOf, isMarkKey, useMarkLabel, type MarkKey } from "./lessonParts";

// O'QUVCHI KABINETI → DARSLAR → «DAVOMAT» (44-qism, rasm «Kabinet · Davomat»).
//   chap: oy kalendari — har kunda o'sha kungi darslar (fan nuqtasi + belgi; kelgusi dars — vaqti, punktir);
//   o'ng: oy xulosasi (foiz, keldi / sababli / kelmadi), «Qoldirilgan darslar» (sababi bilan),
//   «Oylar bo'yicha» — oxirgi 5 oy (cab.attendanceHistory).
// Oy faqat davomati bor oylar va joriy oy orasida yuradi (bo'sh oyga o'tish ma'nosiz).

interface DayItem {
  groupId: number;
  title: string;
  course: string;
  mark: MarkKey | null;
  time: string;
  reason: string | null;
}

export default function AttendanceView({ me, cab }: Pick<CabinetTabProps, "me" | "cab">) {
  const { t, weekdaysShort } = useT();
  const fmt = useCabinetFmt();
  const markLabel = useMarkLabel();
  const current = cab.today.slice(0, 7);

  const months = useMemo(() => {
    const s = new Set(me.attendance.months.filter((m) => /^\d{4}-\d{2}$/.test(m)));
    s.add(current);
    return [...s].sort();
  }, [me.attendance.months, current]);
  const [month, setMonth] = useState(current);
  const mi = months.indexOf(month);

  const titleOf = useMemo(() => {
    const map = new Map<number, { title: string; course: string }>();
    for (const l of cab.lessons.items) map.set(l.groupId, { title: l.title, course: l.course });
    for (const g of cab.groups) map.set(g.id, { title: g.title, course: g.course });
    return (id: number) => map.get(id) ?? { title: t("{id}-guruh", { id }), course: "" };
  }, [cab.lessons.items, cab.groups, t]);

  // Kun → darslar: avval qo'yilgan belgilar, keyin jadvaldagi belgisiz (kelgusi) darslar.
  const byDay = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    const push = (d: string, x: DayItem) => map.set(d, [...(map.get(d) ?? []), x]);
    for (const m of me.attendance.marks) {
      if (!m.date?.startsWith(month) || !isMarkKey(m.status)) continue;
      push(m.date, { groupId: m.groupId, ...titleOf(m.groupId), mark: m.status, time: "", reason: m.reason ?? null });
    }
    for (const l of cab.lessons.items) {
      if (!l.date.startsWith(month) || l.mark || l.date < cab.today) continue;
      if (map.get(l.date)?.some((x) => x.groupId === l.groupId)) continue;
      push(l.date, { groupId: l.groupId, title: l.title, course: l.course, mark: null, time: l.start, reason: null });
    }
    return map;
  }, [me.attendance.marks, cab.lessons.items, cab.today, month, titleOf]);

  const marked = [...byDay.values()].flat().filter((x) => x.mark !== null) as (DayItem & { mark: MarkKey })[];
  const came = marked.filter((x) => cameOf(x.mark)).length;
  const excused = marked.filter((x) => x.mark === "sababli").length;
  const missed = marked.filter((x) => x.mark === "sababsiz").length;
  const total = marked.length;
  const planned = [...byDay.values()].flat().filter((x) => x.mark === null).length;
  const percent = total ? Math.round((came / total) * 100) : null;
  const courses = [...new Map(cab.groups.map((g) => [g.id, g])).values()];
  const absences = [...byDay.entries()]
    .flatMap(([date, list]) => list.filter((x) => x.mark === "sababli" || x.mark === "sababsiz").map((x) => ({ date, ...x })))
    .sort((a, b) => b.date.localeCompare(a.date));

  const first = `${month}-01`;
  const lead = (weekdayOf(first) + 6) % 7;
  const [y, mo] = month.split("-").map(Number);
  const daysIn = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const head = [1, 2, 3, 4, 5, 6, 0].map((d) => weekdaysShort[d] ?? "");
  const navBtn =
    "inline-flex size-8 items-center justify-center rounded-v2-md border border-v2-border-strong bg-v2-surface text-v2-text-2 hover:bg-v2-surface-2 focus-visible:outline-none focus-visible:shadow-v2-focus disabled:pointer-events-none disabled:opacity-35";
  const history = cab.attendanceHistory ?? [];
  const tone = percent === null ? "bg-v2-brand" : percent >= 90 ? "bg-v2-success" : percent >= 70 ? "bg-v2-warning" : "bg-v2-danger";

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="min-w-0">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-v2-section text-v2-text">
              {fmt.monthName(month)} {month.slice(0, 4)}
            </h2>
            <p className="text-v2-small text-v2-text-3">
              {[t("{n} ta dars o'tdi", { n: total }), planned ? t("{n} tasi rejada", { n: planned }) : null].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button type="button" className={navBtn} disabled={mi <= 0} onClick={() => setMonth(months[mi - 1])} aria-label={t("Oldingi oy")}>
              <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
            <button type="button" className={navBtn} disabled={mi < 0 || mi >= months.length - 1} onClick={() => setMonth(months[mi + 1])} aria-label={t("Keyingi oy")}>
              <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-v2-caption text-v2-text-2">
          {courses.map((g) => (
            <span key={g.id} className="inline-flex items-center gap-1.5">
              <FanDot course={g.course} />
              {g.title}
            </span>
          ))}
          {courses.length ? <span className="hidden h-4 w-px bg-v2-border sm:block" aria-hidden /> : null}
          {(["keldi", "sababsiz", "sababli"] as MarkKey[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={`inline-flex size-4 items-center justify-center rounded-v2-sm ${MARK_CELL[k]}`} aria-hidden>
                {k === "keldi" ? <Check className="size-3" strokeWidth={2.25} /> : k === "sababsiz" ? <X className="size-3" strokeWidth={2.25} /> : <Info className="size-3" strokeWidth={2.25} />}
              </span>
              {markLabel(k)}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-4 rounded-v2-sm border border-dashed border-v2-border-strong" aria-hidden />
            {t("Rejada")}
          </span>
        </div>

        <div className="overflow-hidden rounded-v2-md border border-v2-border">
          <div className="grid grid-cols-7 border-b border-v2-border bg-v2-surface-2">
            {head.map((h, i) => (
              <span key={i} className="px-1.5 py-2 text-v2-caption text-v2-text-3 sm:px-2.5">
                {h}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              const list = d ? (byDay.get(d) ?? []) : [];
              const isToday = d === cab.today;
              return (
                <div key={d ?? `b${i}`} className={`min-h-[3.75rem] border-b border-r border-v2-border p-1 last:border-r-0 sm:min-h-[4.5rem] sm:p-2 [&:nth-child(7n)]:border-r-0 ${d ? "" : "bg-v2-surface-2"}`}>
                  {d ? (
                    <>
                      <span className={`inline-flex size-6 items-center justify-center rounded-v2-full text-v2-caption font-medium tabular-nums ${isToday ? "bg-v2-brand text-v2-on-brand" : "text-v2-text"}`}>{Number(d.slice(8, 10))}</span>
                      <div className="mt-1 space-y-1">
                        {list.map((x, k) => (
                          <div
                            key={k}
                            title={`${x.title}${x.mark ? ` — ${markLabel(x.mark)}` : x.time ? ` · ${x.time}` : ""}${x.reason ? ` («${x.reason}»)` : ""}`}
                            className={`flex items-center gap-1 rounded-v2-sm px-1 py-0.5 text-[0.6875rem] leading-4 sm:px-1.5 ${x.mark ? MARK_CELL[x.mark] : "border border-dashed border-v2-border-strong text-v2-text-2"}`}
                          >
                            <FanDot course={x.course} className="size-1.5" />
                            <span className="hidden truncate sm:inline">{x.mark ? markLabel(x.mark) : x.time}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-v2-small text-v2-text-2">{t("Davomat · {month}", { month: fmt.monthLower(month) })}</span>
            <span className="text-v2-small tabular-nums text-v2-text-3">{t("{came} / {total} dars", { came, total })}</span>
          </div>
          {total === 0 ? (
            <Empty>{t("Bu oyda davomat belgilanmagan.")}</Empty>
          ) : (
            <>
              <div className="mt-1 text-v2-number tabular-nums text-v2-text">{percent}%</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-v2-full bg-v2-track">
                <div className={`h-full rounded-v2-full ${tone}`} style={{ width: `${percent ?? 0}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { n: came, label: t("keldi"), cls: "bg-v2-success-bg text-v2-success" },
                  { n: excused, label: t("sababli"), cls: "bg-v2-warning-bg text-v2-warning" },
                  { n: missed, label: t("kelmadi"), cls: "bg-v2-danger-bg text-v2-danger" },
                ].map((x) => (
                  <div key={x.label} className={`rounded-v2-md px-2.5 py-2 ${x.cls}`}>
                    <div className="text-v2-section font-semibold tabular-nums">{x.n}</div>
                    <div className="text-v2-caption text-v2-text-2">{x.label}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card>
          <CardHead title={t("Qoldirilgan darslar")} sub={t("{n} ta · {month}", { n: absences.length, month: fmt.monthLower(month) })} />
          {absences.length === 0 ? (
            <p className="text-v2-small text-v2-success">{t("Bu oyda dars qoldirilmagan.")}</p>
          ) : (
            <ul className="divide-y divide-v2-border">
              {absences.map((a, i) => (
                <li key={`${a.date}-${a.groupId}-${i}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md ${MARK_CELL[a.mark as MarkKey]}`} aria-hidden>
                    {a.mark === "sababsiz" ? <X className="size-4" strokeWidth={2} /> : <Info className="size-4" strokeWidth={2} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-v2-body font-medium text-v2-text">
                        {fmt.dayMonth(a.date)}, {fmt.weekdayFull(a.date).toLowerCase()}
                      </span>
                      <MarkPill mark={a.mark as MarkKey} />
                    </div>
                    <div className="text-v2-caption text-v2-text-3">{a.title}</div>
                    {a.reason ? <div className="text-v2-caption text-v2-text-2">«{a.reason}»</div> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {history.some((h) => h.total > 0) ? (
          <Card>
            <CardHead title={t("Oylar bo'yicha")} sub={t("{month}dan beri", { month: fmt.monthLower(history.find((h) => h.total > 0)!.month) })} />
            <ul className="space-y-2.5">
              {history
                .filter((h) => h.total > 0)
                .map((h) => {
                  const cur = h.month === current;
                  return (
                    <li key={h.month} className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 text-v2-small">
                      <span className={cur ? "font-semibold text-v2-text" : "text-v2-text-2"}>{fmt.monthName(h.month)}</span>
                      <span className="h-1.5 overflow-hidden rounded-v2-full bg-v2-track">
                        <span className={`block h-full rounded-v2-full ${cur ? "bg-v2-brand" : "bg-v2-border-strong"}`} style={{ width: `${h.percent ?? 0}%` }} />
                      </span>
                      <span className="tabular-nums text-v2-text-3">
                        <b className="font-semibold text-v2-text">{h.percent}%</b> · {h.came} / {h.total}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
