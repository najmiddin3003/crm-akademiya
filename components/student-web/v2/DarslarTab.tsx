"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, ClipboardList, Minus, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import type { CabinetGroup, CabinetLesson } from "@/lib/studentCabinetTypes";
import { Bar, Card, CardHead, Empty, FanDot, Pill, addDays, initials, timeRange, useCabinetFmt, weekdayOf, type CabinetTabProps } from "./bits";
import {
  MARK_CELL,
  MARK_DOT,
  MARK_WEIGHT,
  MarkPill,
  MonthStepper,
  PageHead,
  cameOf,
  isMarkKey,
  mondayOf,
  parseDeadline,
  useMarkLabel,
  useWeekRange,
  type MarkKey,
} from "./lessonParts";

// O'QUVCHI KABINETI (v2) — «DARSLAR» TABI. Dizayn rasmi yo'q: «Asosiy» va
// «To'lovlar» rasmlarining tili (kartalar, «Bu hafta» qatorlari, jadval).
//   chap: hafta (← o'tgan · bu hafta · keyingi →) va «Guruhlarim»;
//   o'ng: oy davomati (faqat davomati bor oylar) va «Vazifalar».
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

export default function DarslarTab({ me, cab }: CabinetTabProps) {
  const { t } = useT();
  const groups = cab.groups;
  const perWeek = groups.reduce((s, g) => s + (g.status === "gathering" ? 0 : g.weekdays.length), 0);
  const sub = [
    me.profile.fullName,
    groups.length ? t("{n} ta guruh", { n: groups.length }) : null,
    perWeek ? t("haftada {n} dars", { n: perWeek }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      <PageHead title={t("Darslar")} sub={sub} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Telefonda tartib: hafta → davomat → vazifalar → guruhlar; kengda guruhlar chapda. */}
        <div className="flex min-w-0 flex-col gap-4">
          <WeekCard me={me} cab={cab} />
          <div className="hidden lg:block">
            <GroupsCard groups={groups} />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <AttendanceCard me={me} cab={cab} />
          <TasksCard me={me} cab={cab} />
          <div className="lg:hidden">
            <GroupsCard groups={groups} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Hafta ───────────────────────── */

function WeekCard({ cab }: Pick<CabinetTabProps, "me" | "cab">) {
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
          <span className="truncate text-v2-small tabular-nums text-v2-text-3">{weekRange(start, end)}</span>
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

      <ul className="divide-y divide-v2-border">
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
          {/* Keng ekran: jadval («To'lovlar» jadvali uslubida). */}
          <div className="-mx-4 hidden overflow-x-auto sm:-mx-5 md:block">
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <thead>
                <tr className="bg-v2-surface-2 text-v2-caption text-v2-text-3">
                  <th className="py-2 pl-4 pr-3 font-medium sm:pl-5">{t("Guruh")}</th>
                  <th className="px-3 py-2 font-medium">{t("Ustoz")}</th>
                  <th className="px-3 py-2 font-medium">{t("Xona")}</th>
                  <th className="px-3 py-2 font-medium">{t("Kunlar")}</th>
                  <th className="py-2 pl-3 pr-4 font-medium sm:pr-5">{t("Vaqt")}</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="border-t border-v2-border text-v2-small text-v2-text">
                    <td className="py-2.5 pl-4 pr-3 sm:pl-5">
                      <div className="flex items-center gap-2">
                        <FanDot course={g.course} />
                        <span className="whitespace-nowrap font-medium">{g.title}</span>
                        {g.status === "gathering" ? <Pill tone="warning">{t("Yig'ilmoqda")}</Pill> : null}
                      </div>
                      {since(g) ? <div className="whitespace-nowrap pl-4 text-v2-caption font-normal text-v2-text-3">{since(g)}</div> : null}
                    </td>
                    <td className="px-3 py-2.5">{g.teacher || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{g.room || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{daysText(g) || "—"}</td>
                    <td className="whitespace-nowrap py-2.5 pl-3 pr-4 tabular-nums sm:pr-5">{timeRange(g.start, g.end) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

/* ───────────────────────── Oy davomati ───────────────────────── */

interface DayMark {
  groupId: number;
  status: MarkKey;
  reason: string | null;
  grade: number | null;
}

function AttendanceCard({ me, cab }: Pick<CabinetTabProps, "me" | "cab">) {
  const { t, weekdaysShort } = useT();
  const fmt = useCabinetFmt();
  const markLabel = useMarkLabel();
  const current = cab.today.slice(0, 7);

  // Faqat davomati bor oylar (+ joriy oy — bo'sh bo'lsa ham «bu oy hali belgi yo'q»).
  const months = useMemo(() => {
    const s = new Set(me.attendance.months.filter((m) => /^\d{4}-\d{2}$/.test(m)));
    s.add(current);
    return [...s].sort();
  }, [me.attendance.months, current]);
  const [month, setMonth] = useState(current);

  // Guruh nomi: hozirgi guruhlar, keyin darslar oynasi (chiqib ketgan guruh ham).
  const titleOf = useMemo(() => {
    const map = new Map<number, { title: string; course: string }>();
    for (const l of cab.lessons.items) map.set(l.groupId, { title: l.title, course: l.course });
    for (const g of cab.groups) map.set(g.id, { title: g.title, course: g.course });
    return (id: number) => map.get(id) ?? { title: t("{id}-guruh", { id }), course: "" };
  }, [cab.lessons.items, cab.groups, t]);

  const byDay = useMemo(() => {
    const map = new Map<string, DayMark[]>();
    for (const m of me.attendance.marks) {
      if (!m.date?.startsWith(month) || !isMarkKey(m.status)) continue;
      const list = map.get(m.date) ?? [];
      list.push({ groupId: m.groupId, status: m.status, reason: m.reason ?? null, grade: typeof m.grade === "number" && m.grade > 0 ? m.grade : null });
      map.set(m.date, list);
    }
    return map;
  }, [me.attendance.marks, month]);

  const all = useMemo(() => [...byDay.values()].flat(), [byDay]);
  const came = all.filter((m) => cameOf(m.status)).length;
  const excused = all.filter((m) => m.status === "sababli").length;
  const missed = all.filter((m) => m.status === "sababsiz").length;
  const total = all.length;
  const percent = total ? Math.round((came / total) * 100) : null;
  const grades = all.map((m) => m.grade).filter((g): g is number => g !== null);
  const avgGrade = grades.length ? grades.reduce((s, g) => s + g, 0) / grades.length : null;
  const tone = percent === null ? "brand" : percent >= 90 ? "success" : percent >= 70 ? "warning" : "danger";

  // Guruhlar bo'yicha: keldi / jami.
  const perGroup = useMemo(() => {
    const map = new Map<number, { came: number; total: number }>();
    for (const m of all) {
      const r = map.get(m.groupId) ?? { came: 0, total: 0 };
      r.total += 1;
      if (cameOf(m.status)) r.came += 1;
      map.set(m.groupId, r);
    }
    return [...map.entries()].map(([id, r]) => ({ id, ...r, ...titleOf(id) }));
  }, [all, titleOf]);

  // Kelgusi darslar (belgisiz, bugundan keyin) — kalendarda punktir chegara.
  const planned = useMemo(() => {
    const s = new Set<string>();
    for (const l of cab.lessons.items) if (l.date.startsWith(month) && l.date >= cab.today && !l.mark) s.add(l.date);
    return s;
  }, [cab.lessons.items, month, cab.today]);

  const absences = [...byDay.entries()]
    .flatMap(([date, list]) => list.filter((m) => m.status === "sababli" || m.status === "sababsiz").map((m) => ({ date, ...m })))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Kalendar: dushanbadan.
  const first = `${month}-01`;
  const lead = (weekdayOf(first) + 6) % 7;
  const [y, mo] = month.split("-").map(Number);
  const daysIn = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const head = [1, 2, 3, 4, 5, 6, 0].map((d) => weekdaysShort[d] ?? "");

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="truncate text-v2-body font-semibold text-v2-text">{t("Davomat")}</h2>
        <MonthStepper months={months} value={month} onChange={setMonth} thisYear={cab.today.slice(0, 4)} />
      </div>

      {total === 0 ? (
        <Empty>{month === current ? t("Bu oyda hali davomat belgilanmagan.") : t("Bu oyda davomat belgilanmagan.")}</Empty>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            <span className="text-v2-number tabular-nums text-v2-text">{percent}%</span>
            <span className="pb-1 text-v2-small tabular-nums text-v2-text-3">{t("{came} / {total} dars", { came, total })}</span>
          </div>
          <div className="mt-2">
            <Bar value={percent ?? 0} tone={tone} />
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-v2-small text-v2-text-2">
            <Counter icon={<Check className="size-3" strokeWidth={2.25} aria-hidden />} cls="bg-v2-success-bg text-v2-success" n={came} label={t("keldi")} />
            <Counter icon={<Minus className="size-3" strokeWidth={2.25} aria-hidden />} cls="bg-v2-warning-bg text-v2-warning" n={excused} label={t("sababli")} />
            <Counter icon={<X className="size-3" strokeWidth={2.25} aria-hidden />} cls="bg-v2-danger-bg text-v2-danger" n={missed} label={t("kelmadi")} />
            {avgGrade !== null ? (
              <span className="text-v2-small text-v2-text-3">
                {t("o'rtacha baho")} <b className="font-semibold tabular-nums text-v2-text">{avgGrade.toFixed(1)}</b>
              </span>
            ) : null}
          </div>

          {perGroup.length > 1 ? (
            <ul className="mt-3 space-y-2 border-t border-v2-border pt-3">
              {perGroup.map((g) => (
                <li key={g.id}>
                  <div className="flex items-center justify-between gap-2 text-v2-small">
                    <span className="flex min-w-0 items-center gap-2">
                      <FanDot course={g.course} />
                      <span className="truncate text-v2-text">{g.title}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-v2-text-3">
                      {g.came}/{g.total}
                    </span>
                  </div>
                  <div className="mt-1 pl-4">
                    <Bar value={g.total ? (g.came / g.total) * 100 : 0} tone="brand" />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      {/* Kalendar — belgi ham, kelgusi dars ham bo'lmasa chizilmaydi (yangi o'quvchi). */}
      {total > 0 || planned.size > 0 ? (
        <div className="mt-4 border-t border-v2-border pt-3">
          <div className="grid grid-cols-7 gap-1 text-center">
            {head.map((h, i) => (
              <span key={i} className="pb-1 text-[0.6875rem] leading-4 text-v2-text-3">
                {h}
              </span>
            ))}
            {cells.map((d, i) => {
              if (!d) return <span key={`b${i}`} aria-hidden />;
              const list = byDay.get(d) ?? [];
              const worst = list.reduce<MarkKey | null>((w, m) => (w === null || MARK_WEIGHT[m.status] > MARK_WEIGHT[w] ? m.status : w), null);
              const isToday = d === cab.today;
              const plan = !worst && planned.has(d);
              const label = list.length ? `${fmt.dayMonth(d)}: ${list.map((m) => `${titleOf(m.groupId).title} — ${markLabel(m.status)}`).join("; ")}` : fmt.dayMonth(d);
              return (
                <span
                  key={d}
                  title={label}
                  aria-label={label}
                  className={`relative flex h-9 flex-col items-center justify-center rounded-v2-sm text-v2-caption tabular-nums ${
                    worst ? MARK_CELL[worst] : plan ? "border border-dashed border-v2-border-strong text-v2-text-2" : "text-v2-text-3"
                  } ${isToday ? "ring-2 ring-v2-brand ring-offset-1 ring-offset-v2-surface" : ""}`}
                >
                  {Number(d.slice(8, 10))}
                  {list.length > 1 ? (
                    <span className="absolute bottom-0.5 flex gap-0.5" aria-hidden>
                      {list.map((m, k) => (
                        <span key={k} className={`size-1 rounded-full ${MARK_DOT[m.status]}`} />
                      ))}
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-v2-caption font-normal text-v2-text-3">
            {(["keldi", "birinchi", "sababli", "sababsiz"] as MarkKey[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className={`size-2 rounded-full ${MARK_DOT[k]}`} aria-hidden />
                {markLabel(k)}
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-[2px] border border-dashed border-v2-border-strong" aria-hidden />
              {t("Kelgusi dars")}
            </span>
          </div>
        </div>
      ) : null}

      {total > 0 ? (
        <div className="mt-4 border-t border-v2-border pt-3">
          <h3 className="mb-2 text-v2-small font-semibold text-v2-text">{t("Qoldirilgan darslar")}</h3>
          {absences.length === 0 ? (
            <p className="text-v2-small text-v2-success">{t("Bu oyda dars qoldirilmagan.")}</p>
          ) : (
            <ul className="space-y-2">
              {absences.map((a, i) => {
                const g = titleOf(a.groupId);
                return (
                  <li key={`${a.date}-${a.groupId}-${i}`} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-v2-small font-medium text-v2-text">
                        {fmt.dayMonth(a.date)}
                        <span className="font-normal text-v2-text-3"> · {fmt.weekdayShort(a.date)}</span>
                      </div>
                      <div className="flex min-w-0 items-center gap-1.5 text-v2-caption font-normal text-v2-text-3">
                        <FanDot course={g.course} className="size-1.5" />
                        <span className="truncate">{g.title}</span>
                      </div>
                    </div>
                    <MarkPill mark={a.status} reason={a.reason} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function Counter({ icon, cls, n, label }: { icon: ReactNode; cls: string; n: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-flex size-4 items-center justify-center rounded-full ${cls}`}>{icon}</span>
      <b className="font-semibold tabular-nums text-v2-text">{n}</b>
      {label}
    </span>
  );
}

/* ───────────────────────── Vazifalar ───────────────────────── */

function TasksCard({ me, cab }: Pick<CabinetTabProps, "me" | "cab">) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const tomorrow = addDays(cab.today, 1);
  const tasks = me.tasks;

  return (
    <Card>
      <CardHead
        title={t("Vazifalar")}
        sub={tasks.length ? t("{n} ta", { n: tasks.length }) : undefined}
        icon={<ClipboardList className="size-4 text-v2-text-3" strokeWidth={1.75} aria-hidden />}
      />
      {tasks.length === 0 ? (
        <Empty>{t("Hozircha topshiriq yo'q.")}</Empty>
      ) : (
        <ul className="divide-y divide-v2-border">
          {tasks.map((tk) => {
            const due = parseDeadline(tk.deadline);
            let pill: ReactNode = null;
            if (due && due < cab.today) pill = <Pill tone="danger">{t("Muddati o'tgan")}</Pill>;
            else if (due === cab.today) pill = <Pill tone="warning">{t("Bugun")}</Pill>;
            else if (due === tomorrow) pill = <Pill tone="warning">{t("Ertaga")}</Pill>;
            const meta = [
              tk.groupName,
              due ? t("Muddat: {date}", { date: fmt.dayMonth(due) }) : tk.deadline ? t("Muddat: {date}", { date: tk.deadline }) : "",
              tk.maxScore ? t("Maks. ball: {maxScore}", { maxScore: tk.maxScore }) : "",
            ].filter(Boolean);
            return (
              <li key={tk.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-v2-body font-medium text-v2-text">{tk.name}</span>
                  {pill}
                </div>
                {meta.length ? (
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-v2-caption font-normal text-v2-text-3">
                    {meta.map((m, i) => (
                      <span key={i} className="whitespace-nowrap">
                        {m}
                      </span>
                    ))}
                  </div>
                ) : null}
                {tk.note ? <p className="mt-1 text-v2-small text-v2-text-2">{tk.note}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
