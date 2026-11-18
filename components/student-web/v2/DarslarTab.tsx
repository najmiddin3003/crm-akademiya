"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { useT } from "@/components/shared/Language";
import type { CabinetGroup, CabinetLesson } from "@/lib/studentCabinetTypes";
import { fanOf, FAN_BG, FAN_BORDER, FAN_TEXT } from "@/components/v2/ui/fan";
import { Card, CardHead, Empty, FanDot, Pill, addDays, fmtSom, initials, timeRange, useCabinetFmt, type CabinetTabProps } from "./bits";
import AttendanceView from "./AttendanceView";
import { CoursesView, SupportView, TasksView } from "./LearningViews";
import LessonRatingCard from "./LessonRatingCard";
import { MarkPill, PageHead, UnderTabs, isMarkKey, mondayOf, parseDeadline, useMarkLabel, useWeekRange } from "./lessonParts";

// O'QUVCHI KABINETI (v2) — «DARSLAR» TABI (44-qism, rasmlar «Kabinet · Jadval», «Kabinet · Davomat»).
//   bo'limlar (chiziqli tablar): Jadval · Davomat (AttendanceView) · Vazifalar · Support · Onlayn kurslar;
//   Jadval — chap: hafta (telefonda ro'yxat, kengda soatlar to'ri) va «Guruhlarim» kartalari;
//   o'ng: «Keyingi dars» (+ eng yaqin vazifa) va «Darsni baholash» (LessonRatingCard).
// Hafta faqat `cab.lessons` oynasi ichida yuradi (o'tgan oyning 1-kunidan
// bugun + 21 kungacha) — undan tashqarida jadval ma'lumoti yo'q.

/** Guruh jadvali kunlari: [1,3,5] → «Du, Chor, Ju»; jadval yo'q — bazadagi matn. */
function useDaysText() {
  const fmt = useCabinetFmt();
  return (g: CabinetGroup): string => {
    if (!g.weekdays.length) return g.day;
    const order = [...g.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    return order.map((d) => fmt.weekdayShortOf(d)).join(", ");
  };
}

export default function DarslarTab({ me, cab, initData }: CabinetTabProps) {
  const { t } = useT();
  const [section, setSection] = useState<"jadval" | "davomat" | "vazifalar" | "support" | "kurslar">("jadval");
  const groups = cab.groups;
  const perWeek = groups.reduce((s, g) => s + (g.status === "gathering" ? 0 : g.weekdays.length), 0);
  const sub = [
    groups.length ? groups.map((g) => g.title).join(t(" va ")) : me.profile.fullName,
    cab.branch.name || me.profile.branch || null,
    perWeek ? t("haftada {n} dars", { n: perWeek }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      <PageHead title={t("Darslar")} sub={sub} />
      {/* 43–44-qism: bo'limlar — Jadval, Davomat, Vazifalar, Support, Onlayn kurslar (chiziqli tablar). */}
      <UnderTabs
        label={t("Darslar bo'limlari")}
        value={section}
        onChange={setSection}
        items={[
          { k: "jadval", label: t("Jadval") },
          { k: "davomat", label: t("Davomat") },
          { k: "vazifalar", label: t("Vazifalar"), count: me.tasks.length },
          { k: "support", label: t("Support") },
          { k: "kurslar", label: t("Onlayn kurslar") },
        ]}
      />
      {section === "davomat" && <AttendanceView me={me} cab={cab} />}
      {section === "vazifalar" && <TasksView me={me} cab={cab} />}
      {section === "support" && <SupportView cab={cab} initData={initData} />}
      {section === "kurslar" && <CoursesView initData={initData} />}
      {section === "jadval" && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <WeekCard me={me} cab={cab} />
            <div className="hidden lg:block">
              <GroupsCard groups={groups} />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <NextLessonCard me={me} cab={cab} onTasks={() => setSection("vazifalar")} />
            {/* 34-qism: kelgan darsni baholash va «Oxirgi baholarim». */}
            <LessonRatingCard cab={cab} initData={initData} />
            <div className="lg:hidden">
              <GroupsCard groups={groups} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Keyingi dars ───────────────────────── */

function NextLessonCard({ me, cab, onTasks }: Pick<CabinetTabProps, "me" | "cab"> & { onTasks: () => void }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const l = cab.upcoming;
  if (!l) return null;
  const tomorrow = addDays(cab.today, 1);
  const when = l.date === cab.today ? t("Bugun") : l.date === tomorrow ? t("Ertaga") : fmt.dayMonth(l.date);
  // Shu guruhning eng yaqin muddatli vazifasi (muddati o'tmagan).
  const task = me.tasks
    .map((tk) => ({ tk, due: parseDeadline(tk.deadline) }))
    .filter((x) => x.due && x.due >= cab.today && (!x.tk.groupName || l.title.includes(x.tk.groupName) || x.tk.groupName.includes(l.course)))
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""))[0];
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <span className="text-v2-small text-v2-text-2">{t("Keyingi dars")}</span>
        <Pill tone="info">{when}</Pill>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <FanDot course={l.course} className="size-2.5" />
        <span className="text-v2-section text-v2-text">{l.title}</span>
      </div>
      <p className="mt-1 text-v2-small text-v2-text-2">
        {fmt.weekdayFull(l.date)}, {fmt.dayMonth(l.date)}
        {l.start ? (
          <>
            {" · "}
            <b className="font-semibold tabular-nums text-v2-text">{timeRange(l.start, l.end)}</b>
          </>
        ) : null}
        {l.room ? ` · ${l.room}` : ""}
      </p>
      {l.teacher ? <p className="text-v2-small text-v2-text-2">{l.teacher}</p> : null}
      {task ? (
        <button type="button" onClick={onTasks} className="mt-3 flex w-full items-center gap-2.5 rounded-v2-md bg-v2-warning-bg px-3 py-2.5 text-left text-v2-small text-v2-text hover:opacity-90 focus-visible:outline-none focus-visible:shadow-v2-focus">
          <ClipboardList className="size-4 shrink-0 text-v2-warning" strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1">
            <b className="font-semibold">{t("Vazifa:")}</b> {task.tk.name}
            {task.due ? ` — ${task.due === tomorrow ? t("ertagacha") : t("{date} gacha", { date: fmt.dayMonth(task.due) })}` : ""}
          </span>
          <ChevronRight className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
    </Card>
  );
}

/* ───────────────────────── Hafta ───────────────────────── */

function WeekCard({ me, cab }: Pick<CabinetTabProps, "me" | "cab">) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const weekRange = useWeekRange();
  const [offset, setOffset] = useState(0);

  const thisMonday = mondayOf(cab.today);
  const start = addDays(thisMonday, offset * 7);
  const end = addDays(start, 6);
  const canPrev = addDays(start, -1) >= cab.lessons.from;
  const canNext = addDays(start, 7) <= cab.lessons.to;
  const tomorrow = addDays(cab.today, 1);

  // Qo'lda useMemo yo'q — React Compiler o'zi eslab qoladi (qo'lda yozilgani uni o'chirardi).
  const byDay = new Map<string, CabinetLesson[]>();
  for (const l of cab.lessons.items) {
    if (l.date < start || l.date > end) continue;
    const list = byDay.get(l.date) ?? [];
    list.push(l);
    byDay.set(l.date, list);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.start.localeCompare(b.start));

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const taskDays = new Set(me.tasks.map((tk) => parseDeadline(tk.deadline)).filter((d): d is string => !!d));
  const weekCount = [...byDay.values()].reduce((a, l) => a + l.length, 0);
  const title = offset === 0 ? t("Bu hafta") : offset === -1 ? t("O'tgan hafta") : offset === 1 ? t("Keyingi hafta") : t("Hafta");

  if (cab.lessons.items.length === 0) {
    return (
      <Card>
        <CardHead title={t("Bu hafta")} sub={weekRange(thisMonday, addDays(thisMonday, 6))} />
        <Empty>
          {cab.groups.length === 0
            ? t("Siz hali guruhga qo'shilmagansiz. Guruhga yozilgach darslar shu yerda chiqadi.")
            : t("Yaqin kunlarda dars yo'q.")}
        </Empty>
      </Card>
    );
  }

  const navBtn =
    "inline-flex size-8 items-center justify-center rounded-v2-md border border-v2-border-strong bg-v2-surface text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus disabled:pointer-events-none disabled:opacity-35";

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        {/* Telefonda sana oralig'i nom ostida — «Bu hafta» tugmasiga joy qolsin. */}
        <div className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-2">
          <h2 className="truncate text-v2-body font-semibold text-v2-text">{title}</h2>
          <span className="truncate text-v2-small tabular-nums text-v2-text-3">
            {weekRange(start, end)} · {t("{n} ta dars", { n: weekCount })}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {offset !== 0 ? (
            <button
              type="button"
              onClick={() => setOffset(0)}
              className="inline-flex h-8 items-center whitespace-nowrap rounded-v2-md px-2 text-v2-small font-medium text-v2-brand-text hover:bg-v2-brand-bg focus-visible:outline-none focus-visible:shadow-v2-focus"
            >
              {t("Bu hafta")}
            </button>
          ) : null}
          <button type="button" className={navBtn} disabled={!canPrev} onClick={() => setOffset((o) => o - 1)} aria-label={t("O'tgan hafta")} title={t("O'tgan hafta")}>
            <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
          <button type="button" className={navBtn} disabled={!canNext} onClick={() => setOffset((o) => o + 1)} aria-label={t("Keyingi hafta")} title={t("Keyingi hafta")}>
            <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>

      <WeekGrid days={days} byDay={byDay} today={cab.today} tomorrow={tomorrow} taskDays={taskDays} />
      <ul className="divide-y divide-v2-border md:hidden">
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          const isToday = d === cab.today;
          return (
            <li key={d} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
              <div
                className={`flex w-10 shrink-0 flex-col items-center justify-center self-start rounded-v2-md py-1 ${
                  isToday ? "bg-v2-brand-bg text-v2-brand-text" : "text-v2-text"
                }`}
                aria-current={isToday ? "date" : undefined}
              >
                <span className="text-v2-body font-semibold leading-5 tabular-nums">{Number(d.slice(8, 10))}</span>
                <span className={`text-[0.6875rem] leading-4 ${isToday ? "" : "text-v2-text-3"}`}>{fmt.weekdayShort(d)}</span>
              </div>
              <div className="min-w-0 flex-1">
                {list.length === 0 ? (
                  <p className="flex h-full min-h-9 items-center text-v2-small text-v2-text-3">{t("Dars yo'q")}</p>
                ) : (
                  <ul className="space-y-2">
                    {list.map((l) => (
                      <LessonRow key={`${l.groupId}-${l.start}`} l={l} today={cab.today} now={cab.now} tomorrow={tomorrow} />
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function LessonRow({ l, today, now, tomorrow }: { l: CabinetLesson; today: string; now: string; tomorrow: string }) {
  const { t } = useT();
  const started = l.date < today || (l.date === today && !!l.start && l.start <= now);
  const ended = l.date < today || (l.date === today && !!l.end && l.end <= now);

  let status: ReactNode = null;
  if (l.mark && isMarkKey(l.mark)) status = <MarkPill mark={l.mark} reason={l.reason} />;
  else if (l.date === today && started && !ended) status = <Pill tone="brand" dot>{t("Hozir")}</Pill>;
  else if (l.date === today && !started) status = <Pill tone="brand">{t("Bugun")}</Pill>;
  else if (l.date === tomorrow) status = <Pill tone="info">{t("Ertaga")}</Pill>;
  else if (ended) status = <Pill tone="neutral">{t("Belgilanmagan")}</Pill>;

  const place = [timeRange(l.start, l.end), l.room].filter(Boolean).join(" · ");
  return (
    <li className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <FanDot course={l.course} />
          <span className="truncate text-v2-body font-medium text-v2-text">{l.title}</span>
        </div>
        {place || l.teacher ? (
          // Telefonda ustoz ismi alohida qatorda (kesilmasin), kengda — bir qatorda.
          <div className="mt-0.5 pl-4 text-v2-caption font-normal tabular-nums text-v2-text-3">
            {place ? <span className="whitespace-nowrap">{place}</span> : null}
            {l.teacher ? (
              <span className="block truncate sm:inline">
                {place ? <span className="hidden sm:inline"> · </span> : null}
                {l.teacher}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        {l.grade ? (
          <span className="inline-flex items-center rounded-v2-full bg-v2-brand-bg px-2 py-0.5 text-v2-caption tabular-nums text-v2-brand-text" title={t("Baho")}>
            {t("Baho {n}", { n: l.grade })}
          </span>
        ) : null}
        {status}
      </div>
    </li>
  );
}

/* ───────────────────────── Guruhlarim ───────────────────────── */

function GroupsCard({ groups }: { groups: CabinetGroup[] }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const daysText = useDaysText();
  const since = (g: CabinetGroup) => (g.joinedAt ? t("{date}dan beri", { date: fmt.dayMonth(g.joinedAt) }) : "");

  return (
    <Card>
      <CardHead title={t("Guruhlarim")} sub={groups.length ? t("{n} ta", { n: groups.length }) : undefined} />
      {groups.length === 0 ? (
        <Empty>{t("Hozircha guruh yo'q.")}</Empty>
      ) : (
        <>
          {/* Telefon: ro'yxat (Asosiy'dagi «Guruhlarim» kabi). */}
          <ul className="divide-y divide-v2-border md:hidden">
            {groups.map((g) => (
              <li key={g.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-v2-full bg-v2-surface-2 text-v2-caption text-v2-text-2">
                  {initials(g.teacher || g.title)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <FanDot course={g.course} />
                    <span className="truncate text-v2-body font-medium text-v2-text">{g.title}</span>
                    {g.status === "gathering" ? <Pill tone="warning">{t("Yig'ilmoqda")}</Pill> : null}
                  </div>
                  <div className="mt-0.5 text-v2-caption font-normal text-v2-text-3">
                    {[g.teacher, g.room].filter(Boolean).join(" · ")}
                  </div>
                  <div className="text-v2-caption font-normal tabular-nums text-v2-text-3">
                    {[daysText(g), timeRange(g.start, g.end)].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {/* Keng ekran: kartalar (44-qism, rasm «Kabinet · Jadval» → «Guruhlarim»). */}
          <ul className="hidden gap-4 md:grid md:grid-cols-2">
            {groups.map((g) => (
              <li key={g.id} className="flex items-start gap-3 border-v2-border md:[&:nth-child(2n)]:border-l md:[&:nth-child(2n)]:pl-4">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-v2-full bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2">{initials(g.teacher || g.title)}</span>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-v2-body font-semibold text-v2-text">{g.title}</span>
                    {g.status === "gathering" ? <Pill tone="warning">{t("Yig'ilmoqda")}</Pill> : null}
                  </div>
                  <div className="text-v2-small text-v2-text-2">{[g.teacher, g.room].filter(Boolean).join(" · ")}</div>
                  <div className="text-v2-small tabular-nums text-v2-text-2">
                    {[daysText(g), timeRange(g.start, g.end), g.monthlyPrice ? t("{sum} so'm/oy", { sum: fmtSom(g.monthlyPrice) }) : null].filter(Boolean).join(" · ")}
                  </div>
                  {since(g) ? <div className="text-v2-caption text-v2-text-3">{since(g)}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/* ───────────────────────── Hafta to'ri (keng ekran) ───────────────────────── */

const HOUR_PX = 52;
const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : NaN;
};

function WeekGrid({ days, byDay, today, tomorrow, taskDays }: { days: string[]; byDay: Map<string, CabinetLesson[]>; today: string; tomorrow: string; taskDays: Set<string> }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const markLabel = useMarkLabel();
  const all = [...byDay.values()].flat().filter((l) => Number.isFinite(toMin(l.start)));
  if (!all.length) return <div className="hidden md:block"><Empty>{t("Bu haftada dars yo'q.")}</Empty></div>;
  const from = Math.floor(Math.min(...all.map((l) => toMin(l.start))) / 60) - 1;
  const to = Math.ceil(Math.max(...all.map((l) => (Number.isFinite(toMin(l.end)) ? toMin(l.end) : toMin(l.start) + 90))) / 60);
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const height = hours.length * HOUR_PX;

  return (
    <div className="hidden overflow-hidden rounded-v2-md border border-v2-border md:block">
      <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
        <div className="border-b border-r border-v2-border" />
        {days.map((d) => {
          const isToday = d === today;
          return (
            <div key={d} className="flex flex-col items-center gap-0.5 border-b border-r border-v2-border py-2 last:border-r-0">
              <span className={`text-v2-caption ${isToday ? "font-semibold text-v2-brand-text" : "text-v2-text-3"}`}>{fmt.weekdayShort(d)}</span>
              <span className={`inline-flex size-7 items-center justify-center rounded-v2-full text-v2-body font-semibold tabular-nums ${isToday ? "bg-v2-brand text-v2-on-brand" : "text-v2-text"}`}>{Number(d.slice(8, 10))}</span>
              <span className={`h-4 text-[0.6875rem] leading-4 ${taskDays.has(d) ? "text-v2-warning" : ""}`}>{taskDays.has(d) ? t("Vazifa") : ""}</span>
            </div>
          );
        })}
        <div className="relative border-r border-v2-border" style={{ height }}>
          {hours.map((h, i) => (
            <span key={h} className="absolute left-2 text-v2-caption tabular-nums text-v2-text-3" style={{ top: i * HOUR_PX + 4 }}>
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          const isToday = d === today;
          return (
            <div key={d} className={`relative border-r border-v2-border last:border-r-0 ${isToday ? "bg-v2-surface-2" : ""}`} style={{ height }}>
              {hours.map((h, i) => (
                <span key={h} aria-hidden className="absolute inset-x-0 border-t border-v2-border" style={{ top: i * HOUR_PX }} />
              ))}
              {list.length === 0 ? <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-v2-caption text-v2-text-3">{t("Dars yo'q")}</span> : null}
              {list.map((l) => {
                const s0 = toMin(l.start);
                if (!Number.isFinite(s0)) return null;
                const e0 = Number.isFinite(toMin(l.end)) ? toMin(l.end) : s0 + 90;
                const top = ((s0 - from * 60) / 60) * HOUR_PX + 2;
                const h = Math.max(36, ((e0 - s0) / 60) * HOUR_PX - 4);
                const f = fanOf(l.course);
                const status = l.mark && isMarkKey(l.mark) ? markLabel(l.mark) : l.date === tomorrow ? t("Ertaga") : l.date === today ? t("Bugun") : "";
                const statusCls = l.mark === "sababsiz" ? "bg-v2-danger-bg text-v2-danger" : l.mark ? "bg-v2-success-bg text-v2-success" : "bg-v2-info-bg text-v2-info";
                return (
                  <div
                    key={`${l.groupId}-${l.start}`}
                    title={[l.title, timeRange(l.start, l.end), l.room, l.teacher].filter(Boolean).join(" · ")}
                    className={`absolute inset-x-1 overflow-hidden rounded-v2-sm border border-l-[3px] px-1.5 py-1 ${FAN_BG[f]} ${FAN_BORDER[f]}`}
                    style={{ top, height: h }}
                  >
                    <div className={`truncate text-v2-caption font-semibold ${FAN_TEXT[f]}`}>{l.course || l.title}</div>
                    <div className="truncate text-[0.6875rem] leading-4 tabular-nums text-v2-text-2">{timeRange(l.start, l.end)}</div>
                    {l.room ? <div className="truncate text-[0.6875rem] leading-4 text-v2-text-2">{l.room}</div> : null}
                    {status ? <span className={`mt-1 inline-block rounded-v2-sm px-1.5 text-[0.6875rem] leading-4 ${statusCls}`}>{status}</span> : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
