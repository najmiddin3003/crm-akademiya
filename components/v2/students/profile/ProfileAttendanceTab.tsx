"use client";

import { useMemo, useState } from "react";
import { BarChart3, CalendarCheck, Check, ChevronLeft, ChevronRight, Clock3, Minus, Table2, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { WEEKDAYS_SHORT, type Lang } from "@/lib/i18n";
import { markCame, monthBoundsOf, shiftMonthKey, type ProfileMark } from "@/lib/pupilProfile";
import { dateToIso, isoToDate, lessonsOfMonth, markStats, marksOfMonth, startHm, type LessonCell } from "./profileLedger";
import { Card, EmptyBlock, KpiCell, KpiStrip, MarkIcon, PctBar, SegTabs, ToneBadge, courseShort, groupTitle } from "./profileBits";
import type { TabProps } from "./profileTypes";

// YANGI VERSIYA — O'QUVCHI SAHIFASI · DAVOMAT (rasm «O'quvchi sahifasi · Davomat»,
// 23.10.2026):
//   ko'rsatkichlar — Davomat · oy (foiz, chiziq, «7 / 9 dars») | Keldi | Kelmadi (oxirgisi:
//     «3-oktyabr · Matematika») | Sababli;
//   kalendar (dushanbadan) — «‹ Oktyabr 2026 ›», «9 ta dars o'tdi · 18 tasi rejada», guruh
//     segmenti; katakda dars chiplari: ✓ keldi, ✕ kelmadi, — sababli, rejadagisi — fan
//     nuqtasi bilan oq chip, bugungisi — «◷ 16:00»; bugun — brend chegara; izoh;
//   «Qoldirilgan darslar» — kun, guruh, sabab («…»), «Belgiladi: …», belgi;
//   «Oylar bo'yicha» — qatnashish foizi (ustunli grafik / jadval), joriy oy «*».
// Oy va guruh tanlovi ko'rsatkichlar, kalendar va ro'yxatga; grafik — guruh tanloviga.

type Filter = "all" | `${number}`;

export default function ProfileAttendanceTab({ data, fmt }: TabProps) {
  const { t, lang } = useT();
  const cur = data.asOf.slice(0, 7);
  const [month, setMonth] = useState(cur);
  const [gf, setGf] = useState<Filter>("all");
  const [view, setView] = useState<"chart" | "table">("chart");

  const groupById = useMemo(() => new Map(data.groups.map((g) => [g.id, g])), [data.groups]);
  // Segmentdagi guruhlar — hozirgi (darsi bor) yoki belgisi borlari; yig'ilayotgan guruhda dars yo'q,
  // ancha oldin chiqib ketgan guruh (belgisi oxirgi oylarda yo'q) ham ko'rsatilmaydi.
  const lessonGroups = data.groups.filter((g) => (g.current && g.months.length > 0) || data.marks.some((m) => m.groupId === g.id));
  const options: { value: Filter; label: string }[] = [
    { value: "all", label: t("Hammasi") },
    ...lessonGroups.map((g) => ({ value: String(g.id) as Filter, label: g.course || g.label })),
  ];
  const filter: Filter = options.some((o) => o.value === gf) ? gf : "all";
  const gid = filter === "all" ? null : Number(filter);

  const lessons = lessonsOfMonth(data, month, gid);
  const monthMarks = marksOfMonth(data.marks, month, gid);
  const stats = markStats(monthMarks);
  const lastOf = (pred: (m: ProfileMark) => boolean) => [...monthMarks].reverse().find(pred);
  const lastAbsent = lastOf((m) => !markCame(m.status) && m.status !== "sababli");
  const lastExcused = lastOf((m) => m.status === "sababli");
  const markSub = (m: ProfileMark | undefined) => (m ? [fmt.dayMonth(m.date), groupById.get(m.groupId)?.course || ""].filter(Boolean).join(" · ") : "—");
  const passed = lessons.filter((l) => l.status !== "planned").length;
  const planned = lessons.length - passed;
  const hasAny = data.marks.length > 0 || data.groups.some((g) => g.months.length > 0);
  const gathering = data.groups.find((g) => g.current && g.status === "gathering");

  if (!hasAny) {
    return (
      <Card title={t("Davomat")}>
        <EmptyBlock
          icon={<CalendarCheck className="size-5" strokeWidth={1.75} />}
          title={t("Darslar hali boshlanmagan")}
          text={
            gathering
              ? t("{course} guruhi yig'ilmoqda. Birinchi dars belgilangach, davomat shu yerda chiqadi.", { course: gathering.course || gathering.label })
              : data.groups.some((g) => g.current)
                ? t("Guruh darslari boshlangach, davomat shu yerda chiqadi.")
                : t("O'quvchi hali guruhga qo'shilmagan.")
          }
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <KpiStrip cols={4} label={t("Ko'rsatkichlar")}>
        <KpiCell label={`${t("Davomat")} · ${fmt.monthLower(month)}`} value={stats.pct === null ? "—" : `${stats.pct}%`} sub={stats.total ? `${stats.came} / ${stats.total} ${t("dars")}` : t("belgi yo'q")}>
          {stats.pct !== null && <PctBar pct={stats.pct} className="mt-1.5 max-w-[9rem]" />}
        </KpiCell>
        <KpiCell
          icon={<StatusDot kind="came" />}
          label={t("Keldi")}
          value={stats.came}
          sub={t("dars")}
        />
        <KpiCell icon={<StatusDot kind="absent" />} label={t("Kelmadi")} value={stats.absent} sub={markSub(lastAbsent)} />
        <KpiCell icon={<StatusDot kind="excused" />} label={t("Sababli")} value={stats.excused} sub={markSub(lastExcused)} />
      </KpiStrip>

      {/* Kalendar */}
      <section aria-label={t("Kalendar")} className="min-w-0 rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMonth((m) => shiftMonthKey(m, -1))}
                aria-label={t("Oldingi oy")}
                title={t("Oldingi oy")}
                className="inline-flex size-8 items-center justify-center rounded-v2-md border border-v2-border-strong bg-v2-surface text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
              >
                <ChevronLeft className="size-4" strokeWidth={1.75} />
              </button>
              <span className="min-w-[8.5rem] text-center text-v2-body font-semibold tabular-nums text-v2-text" aria-live="polite">
                {fmt.monthName(month)} {month.slice(0, 4)}
              </span>
              <button
                type="button"
                onClick={() => setMonth((m) => shiftMonthKey(m, 1))}
                disabled={month >= shiftMonthKey(cur, 1)}
                aria-label={t("Keyingi oy")}
                title={t("Keyingi oy")}
                className="inline-flex size-8 items-center justify-center rounded-v2-md border border-v2-border-strong bg-v2-surface text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="size-4" strokeWidth={1.75} />
              </button>
            </div>
            <span className="text-v2-small text-v2-text-2">
              {lessons.length === 0
                ? t("Bu oyda dars yo'q")
                : [passed ? t("{n} ta dars o'tdi", { n: passed }) : "", planned ? t("{n} tasi rejada", { n: planned }) : ""].filter(Boolean).join(" · ")}
            </span>
            {month !== cur && (
              <button type="button" onClick={() => setMonth(cur)} className="text-v2-small font-medium text-v2-brand-text underline-offset-2 hover:underline">
                {t("Joriy oy")}
              </button>
            )}
          </div>
          {options.length > 2 && <SegTabs value={filter} onChange={setGf} options={options} label={t("Guruh")} />}
        </div>
        <MonthCalendar month={month} lessons={lessons} asOf={data.asOf} lang={lang} />
        <div className="space-y-1.5 border-t border-v2-border px-4 py-2.5 text-v2-caption text-v2-text-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <MarkIcon status="keldi" size="sm" />
              {t("Keldi")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MarkIcon status="sababsiz" size="sm" />
              {t("Kelmadi")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MarkIcon status="sababli" size="sm" />
              {t("Sababli")}
            </span>
            {lessons.some((l) => l.status === "unmarked") && (
              <span className="inline-flex items-center gap-1.5">
                <MarkIcon status="unmarked" size="sm" />
                {t("Belgilanmagan")}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3.5 rounded-full border border-v2-border-strong bg-v2-surface" aria-hidden />
              {t("Rejada")}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {lessonGroups
              .filter((g) => gid === null || g.id === gid)
              .map((g) => (
                <span key={g.id} className="inline-flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />
                  {[groupTitle(g), [g.day.trim().toLowerCase(), startHm(g.time)].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
                </span>
              ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 @min-[44rem]:grid-cols-2">
        <MissedList marks={monthMarks} {...{ data, fmt, month }} />
        <MonthsChart data={data} fmt={fmt} gid={gid} view={view} setView={setView} groupsLabel={gid === null ? (lessonGroups.length > 1 ? t("{n} ta guruh", { n: lessonGroups.length }) : lessonGroups[0] ? groupTitle(lessonGroups[0]) : "") : groupTitle(groupById.get(gid) ?? lessonGroups[0])} />
      </div>
    </div>
  );
}

function StatusDot({ kind }: { kind: "came" | "absent" | "excused" }) {
  const cls = kind === "came" ? "bg-v2-success-bg text-v2-success" : kind === "absent" ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-warning-bg text-v2-warning";
  const Icon = kind === "came" ? Check : kind === "absent" ? X : Minus;
  return (
    <span className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full ${cls}`} aria-hidden>
      <Icon className="size-3" strokeWidth={2.5} />
    </span>
  );
}

/* ── Kalendar ─────────────────────────────────────────────────────── */

function MonthCalendar({ month, lessons, asOf, lang }: { month: string; lessons: LessonCell[]; asOf: string; lang: Lang }) {
  const { t } = useT();
  const mb = monthBoundsOf(month);
  const first = isoToDate(mb.from);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const last = isoToDate(mb.to);
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7)));
  const days: string[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(dateToIso(d));
  const byDay = new Map<string, LessonCell[]>();
  for (const l of lessons) byDay.set(l.date, [...(byDay.get(l.date) ?? []), l]);
  const wd = WEEKDAYS_SHORT[lang];
  const heads = [...wd.slice(1), wd[0]];

  return (
    <div className="border-t border-v2-border">
      <div className="grid grid-cols-7 border-b border-v2-border bg-v2-surface-2" aria-hidden>
        {heads.map((h) => (
          <div key={h} className="px-2 py-1.5 text-v2-caption font-medium text-v2-text-2">
            {h}
          </div>
        ))}
      </div>
      <ol className="grid grid-cols-7">
        {days.map((iso, i) => {
          const inMonth = iso.startsWith(month);
          const today = iso === asOf;
          const sunday = i % 7 === 6;
          const list = inMonth ? (byDay.get(iso) ?? []) : [];
          return (
            <li
              key={iso}
              className={`relative min-h-[4.25rem] min-w-0 border-b border-r border-v2-border p-1.5 [&:nth-child(7n)]:border-r-0 ${sunday ? "bg-v2-surface-2" : ""} ${
                today ? "z-[1] shadow-[inset_0_0_0_2px_var(--v2-brand)]" : ""
              }`}
            >
              <div className="flex items-center gap-1">
                <span className={`text-v2-caption tabular-nums ${inMonth ? (today ? "font-semibold text-v2-text" : "text-v2-text-2") : "text-v2-text-3"}`}>{Number(iso.slice(8, 10))}</span>
                {today && <span className="hidden text-v2-caption font-semibold text-v2-brand-text @min-[34rem]:inline">{t("Bugun")}</span>}
              </div>
              {list.length > 0 && (
                <div className="mt-1 flex flex-col gap-1">
                  {list.map((l) => (
                    <LessonChip key={l.key} l={l} today={today} />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function LessonChip({ l, today }: { l: LessonCell; today: boolean }) {
  const { t } = useT();
  const name = l.group ? courseShort(l.group) : t("Dars");
  const full = l.group ? groupTitle(l.group) : t("Dars");
  const base = "flex h-6 min-w-0 items-center gap-1 rounded-v2-full px-1.5 text-[11px] font-medium leading-none";
  const label = <span className="hidden truncate @min-[34rem]:inline">{name}</span>;
  if (l.status === "planned") {
    if (today)
      return (
        <span className={`${base} border border-v2-brand bg-v2-surface text-v2-brand-text`} title={`${full} · ${l.time}`}>
          <Clock3 className="size-3 shrink-0" strokeWidth={2} aria-hidden />
          <span className="hidden truncate @min-[34rem]:inline">{l.time || name}</span>
        </span>
      );
    return (
      <span className={`${base} border border-v2-border bg-v2-surface text-v2-text-2`} title={`${full} · ${t("Rejada")}`}>
        <span className={`size-1.5 shrink-0 rounded-full ${FAN_DOT[fanOf(l.group?.course)]}`} aria-hidden />
        {label}
      </span>
    );
  }
  if (l.status === "unmarked")
    return (
      <span className={`${base} border border-dashed border-v2-border-strong text-v2-text-3`} title={`${full} · ${t("Belgilanmagan")}`}>
        <span aria-hidden>?</span>
        {label}
      </span>
    );
  const came = markCame(l.status);
  const excused = l.status === "sababli";
  const cls = came ? "bg-v2-success-bg text-v2-success" : excused ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-danger-bg text-v2-danger";
  const Icon = came ? Check : excused ? Minus : X;
  const what = came ? (l.status === "kechikdi" ? t("Kechikdi") : t("Keldi")) : excused ? t("Sababli") : t("Kelmadi");
  return (
    <span className={`${base} ${cls}`} title={`${full} · ${what}`}>
      <Icon className="size-3 shrink-0" strokeWidth={2.5} aria-hidden />
      {label}
    </span>
  );
}

/* ── Qoldirilgan darslar ──────────────────────────────────────────── */

function MissedList({ marks, data, fmt, month }: { marks: ProfileMark[]; data: TabProps["data"]; fmt: TabProps["fmt"]; month: string }) {
  const { t } = useT();
  const missed = marks.filter((m) => !markCame(m.status)).sort((a, b) => b.date.localeCompare(a.date));
  const groupById = new Map(data.groups.map((g) => [g.id, g]));
  return (
    <Card
      title={t("Qoldirilgan darslar")}
      count={`${fmt.monthLower(month)} · ${t("{n} ta", { n: missed.length })}`}
      flush
    >
      {missed.length === 0 ? (
        <div className="border-t border-v2-border">
          {/* Belgi umuman yo'q oyda «hammasiga kelgan» demaymiz — davomat qo'yilmagan. */}
          {marks.length === 0 ? (
            <EmptyBlock icon={<CalendarCheck className="size-5" strokeWidth={1.75} />} title={t("Davomat belgilanmagan")} text={t("Bu oyda hali davomat qo'yilmagan.")} />
          ) : (
            <EmptyBlock icon={<Check className="size-5" strokeWidth={1.75} />} title={t("Qoldirilgan dars yo'q")} text={t("Bu oyda o'quvchi hamma belgilangan darslarga kelgan.")} />
          )}
        </div>
      ) : (
        <ul className="divide-y divide-v2-border border-t border-v2-border">
          {missed.map((m) => {
            const g = groupById.get(m.groupId);
            const excused = m.status === "sababli";
            const why = [m.reason ? t(m.reason) : "", m.note].filter((s) => s.trim()).join(" — ");
            const hm = g ? startHm(g.time) : "";
            const wd = fmt.weekday(m.date);
            return (
              <li key={`${m.groupId}:${m.date}`} className="flex items-start gap-3 px-4 py-3">
                <MarkIcon status={m.status} />
                <div className="min-w-0 flex-1">
                  <div className="text-v2-small font-semibold text-v2-text">
                    {fmt.dayMonth(m.date)}, {wd}
                    {hm && <span className="font-normal text-v2-text-2"> · {hm}</span>}
                  </div>
                  {g && (
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-v2-caption text-v2-text-2">
                      <span className={`size-1.5 shrink-0 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />
                      <span className="truncate">{groupTitle(g)}</span>
                    </div>
                  )}
                  {why && <div className="mt-0.5 text-v2-caption text-v2-text">«{why}»</div>}
                  {m.author && <div className="mt-0.5 text-v2-caption text-v2-text-3">{t("Belgiladi: {name}", { name: m.author })}</div>}
                </div>
                <ToneBadge tone={excused ? { badge: "bg-v2-warning-bg text-v2-warning", dot: "bg-v2-warning" } : { badge: "bg-v2-danger-bg text-v2-danger", dot: "bg-v2-danger" }}>
                  {excused ? t("Sababli") : t("Kelmadi")}
                </ToneBadge>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ── Oylar bo'yicha ───────────────────────────────────────────────── */

function MonthsChart({
  data,
  fmt,
  gid,
  view,
  setView,
  groupsLabel,
}: {
  data: TabProps["data"];
  fmt: TabProps["fmt"];
  gid: number | null;
  view: "chart" | "table";
  setView: (v: "chart" | "table") => void;
  groupsLabel: string;
}) {
  const { t } = useT();
  const [hover, setHover] = useState<string | null>(null);
  const cur = data.asOf.slice(0, 7);
  // Oxirgi 6 oy; boshidagi belgisiz oylar (o'quvchi hali kelmagan) tashlanadi.
  const all = Array.from({ length: 6 }, (_, i) => shiftMonthKey(cur, i - 5));
  const rows = all.map((m) => ({ m, s: markStats(marksOfMonth(data.marks, m, gid)) }));
  const firstIdx = rows.findIndex((r) => r.s.total > 0);
  const shown = firstIdx === -1 ? [] : rows.slice(firstIdx);
  const lastDay = Number(data.asOf.slice(8, 10));
  const toggleBtn = (v: "chart" | "table", Icon: typeof BarChart3, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={view === v}
      aria-label={label}
      title={label}
      onClick={() => setView(v)}
      className={`inline-flex size-7 items-center justify-center rounded-[6px] transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
        view === v ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2 hover:text-v2-text"
      }`}
    >
      <Icon className="size-4" strokeWidth={1.75} />
    </button>
  );

  return (
    <Card
      title={t("Oylar bo'yicha")}
      sub={[t("qatnashish foizi"), groupsLabel].filter(Boolean).join(" · ")}
      action={
        <div role="radiogroup" aria-label={t("Ko'rinish")} className="inline-flex h-8 items-center gap-0.5 rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
          {toggleBtn("chart", BarChart3, t("Grafik"))}
          {toggleBtn("table", Table2, t("Jadval"))}
        </div>
      }
    >
      {shown.length === 0 ? (
        <p className="py-6 text-center text-v2-small text-v2-text-3">{t("Oxirgi oylarda davomat belgisi yo'q")}</p>
      ) : view === "table" ? (
        <div className="relative overflow-x-auto">
          <table className="w-full border-collapse text-v2-small">
            <thead>
              <tr className="bg-v2-surface-2 text-left text-v2-text-2">
                <th scope="col" className="px-3 py-2 font-medium">{t("Oy")}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{t("Keldi")}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{t("Kelmadi")}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{t("Sababli")}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{t("Foiz")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ m, s }) => (
                <tr key={m} className="border-t border-v2-border">
                  <th scope="row" className="px-3 py-2 text-left font-medium text-v2-text">
                    {fmt.monthName(m)}
                    {m === cur && "*"}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">{s.came}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.absent}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.excused}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-v2-text">{s.pct === null ? "—" : `${s.pct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Chizma balandligi 7.75rem (+ ostida oy nomi 1.25rem = h-36); foiz chiziqlari shu balandlikda.
        <div className="flex gap-2 pt-7">
          <div className="relative h-36 w-9 shrink-0 text-right text-v2-caption tabular-nums text-v2-text-3" aria-hidden>
            <span className="absolute right-0 top-0 -translate-y-1/2">100%</span>
            <span className="absolute right-0 top-[3.875rem] -translate-y-1/2">50%</span>
            <span className="absolute right-0 top-[7.75rem] -translate-y-1/2">0%</span>
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[7.75rem]" aria-hidden>
              <span className="absolute inset-x-0 top-0 border-t border-dashed border-v2-border" />
              <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-v2-border" />
              <span className="absolute inset-x-0 bottom-0 border-t border-v2-border-strong" />
            </div>
            <ol className="relative flex h-36 gap-2">
              {shown.map(({ m, s }, i) => {
                const pct = s.pct ?? 0;
                const isCur = m === cur;
                const on = hover === m;
                const edge = i === 0 ? "left-0" : i === shown.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2";
                const showLabel = i === 0 || i === shown.length - 1;
                const aria = `${fmt.monthName(m)}: ${s.pct === null ? "—" : `${s.pct}%`}, ${s.came} / ${s.total} ${t("dars")}`;
                return (
                  <li key={m} className="flex min-w-0 flex-1 flex-col items-center">
                    <button
                      type="button"
                      onPointerEnter={() => setHover(m)}
                      onPointerLeave={() => setHover((h) => (h === m ? null : h))}
                      onFocus={() => setHover(m)}
                      onBlur={() => setHover((h) => (h === m ? null : h))}
                      aria-label={aria}
                      className={`relative flex h-[7.75rem] w-full items-end justify-center rounded-t-v2-sm transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${on ? "bg-v2-surface-2" : ""}`}
                    >
                      {on && (
                        <span className={`absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-v2-md border border-v2-border bg-v2-surface px-2 py-1 text-v2-caption text-v2-text shadow-v2-md ${edge}`}>
                          <span className="mr-1 inline-block size-2 rounded-[2px] bg-v2-series-1 align-middle" aria-hidden />
                          {fmt.monthName(m)} <b className="font-semibold">{s.pct === null ? "—" : `${s.pct}%`}</b>{" "}
                          <span className="text-v2-text-2">
                            {s.came} / {s.total} {t("dars")}
                          </span>
                        </span>
                      )}
                      <span
                        className={`relative block w-full max-w-9 rounded-t-[4px] bg-v2-series-1 ${isCur ? "opacity-55" : ""}`}
                        style={{ height: `${Math.max(pct, s.total ? 2 : 0)}%` }}
                        aria-hidden
                      >
                        {showLabel && !on && s.pct !== null && (
                          <span className="absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2 text-v2-caption font-semibold tabular-nums text-v2-text">{s.pct}%</span>
                        )}
                      </span>
                    </button>
                    <span className="mt-1 h-4 text-v2-caption leading-4 text-v2-text-2">
                      {fmt.monthShort(m)}
                      {isCur && "*"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
      {shown.some((r) => r.m === cur) && (
        <p className="mt-2 text-v2-caption text-v2-text-3">
          * {t("{month} — 1–{day}-{monthLower}, oy hali tugamagan", { month: fmt.monthName(cur), day: lastDay, monthLower: fmt.monthLower(cur) })}
        </p>
      )}
    </Card>
  );
}
