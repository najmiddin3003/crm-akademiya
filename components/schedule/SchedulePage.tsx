"use client";

// Dars jadvali (view-schedule) — crm-akademiya/index-dev.html id="view-schedule"
// + src/app.js render funksiyalaridan 1:1 ko'chirildi.
// To'liq ishlaydi: statistika kartalari, Statistika/Filtr toggle, filtr paneli,
// kun tablari, xona/o'qituvchi guruhlash, ustun/qator layout, to'liq ekran,
// 5 ko'rinish (Kun/Hafta/Oy/O'qituvchi/Xona) va konflikt banneri.
// Chiqarib qoldirilgan (keyingi bosqich): darslarni drag-drop/resize, boy hover
// tooltip (native title bilan almashtirildi), "Yangi dars" modali (stub).

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ROOMS,
  SCH_DAY_LONG,
  SCH_DAY_ORDER,
  SCHEDULE_DATA,
  STATS,
  STATS_CONFIG,
  STATUSES,
  TIME_SLOTS,
} from "@/constants/schedule";
import {
  conflictKeys,
  conflictSummary,
  detectAllConflicts,
  formatStatValue,
  type Lesson,
} from "@/lib/schedule";

type SchView = "day" | "week" | "month" | "teacher" | "room";
type GroupBy = "room" | "teacher";
type Layout = "grid" | "row";

interface Filters {
  teacher: string;
  group: string;
  room: string;
  course: string;
  status: string;
}

const EMPTY_FILTERS: Filters = { teacher: "", group: "", room: "", course: "", status: "" };

export default function SchedulePage() {
  const [day, setDay] = useState("payshanba");
  const [groupBy, setGroupBy] = useState<GroupBy>("room");
  const [layout, setLayout] = useState<Layout>("grid");
  const [schView, setSchView] = useState<SchView>("day");
  const [statsVisible, setStatsVisible] = useState(true);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [fullscreen, setFullscreen] = useState(false);

  // To'liq ekran — body klassi orqali (globals.css: body.fullscreen-mode ...)
  useEffect(() => {
    document.body.classList.toggle("fullscreen-mode", fullscreen);
    return () => document.body.classList.remove("fullscreen-mode");
  }, [fullscreen]);

  // Guruh/xona/o'qituvchi/kurs filtr variantlari — joriy kun darslaridan
  const filterOptions = useMemo(() => {
    const lessons: Lesson[] = (SCHEDULE_DATA as Record<string, Lesson[]>)[day] || [];
    const teachers = [...new Set(lessons.map((l) => l.teacher).filter(Boolean))].sort();
    const groups = [...new Set(lessons.map((l) => l.groupNum))].sort((a, b) => a - b);
    const courses = [...new Set(lessons.map((l) => l.course).filter(Boolean))].sort() as string[];
    return { teachers, groups, courses };
  }, [day]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const summary = useMemo(() => conflictSummary(), []);
  const totalConflicts = useMemo(() => detectAllConflicts().length, []);

  function selectDay(d: string) {
    if (!(SCHEDULE_DATA as Record<string, unknown>)[d] || d === day) return;
    // Kun almashganda o'qituvchi/guruh/kurs filtrlari tozalanadi (variantlar farq qiladi)
    setFilters((f) => ({ ...f, teacher: "", group: "", course: "" }));
    setDay(d);
  }

  function pickView(v: SchView) {
    setSchView(v);
    if (v === "teacher") setGroupBy("teacher");
    else if (v === "room") setGroupBy("room");
  }

  function toggleStats() {
    setStatsVisible((v) => !v);
  }

  function toggleFilters() {
    setFiltersVisible((v) => {
      const next = !v;
      return next;
    });
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  const dayTabsVisible = schView === "day" || schView === "teacher" || schView === "room";
  const oldTogglesVisible = schView === "day";

  return (
    <div
      id="view-schedule"
      className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-5"
    >
      {/* Page title */}
      <div id="schedule-header" className="flex items-center justify-between non-fullscreen">
        <h1
          id="page-title"
          className={`text-xl font-semibold tracking-tight${statsVisible ? "" : " collapsed"}`}
        >
          Statistika
        </h1>
        <div className="flex gap-2">
          <button
            id="btn-statistika"
            onClick={toggleStats}
            title={statsVisible ? "Statistikani yashirish" : "Statistikani ko'rsatish"}
            className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-shadow${
              statsVisible ? "" : " ring-2 ring-white/60"
            }`}
          >
            <svg className="icon icon-sm">
              <use href="#i-bar-chart" />
            </svg>{" "}
            <span>Statistika</span>
          </button>
          <button
            id="btn-filter"
            onClick={toggleFilters}
            className={`relative inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-shadow${
              filtersVisible ? " ring-2 ring-blue-300" : ""
            }`}
          >
            <svg className="icon icon-sm">
              <use href="#i-filter" />
            </svg>{" "}
            <span>Filtr</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div
        id="stats-grid"
        className={`non-fullscreen grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3${
          statsVisible ? "" : " collapsed"
        }`}
      >
        {STATS_CONFIG.map((c) => (
          <div
            key={c.key}
            className="stat-card rounded-xl border border-border bg-card p-3 flex items-center gap-3 shadow-sm"
            data-stat={c.key}
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.bg} text-white`}
            >
              <svg className="icon icon-sm">
                <use href={`#${c.icon}`} />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-muted-foreground leading-tight">
                {c.label}
              </div>
              <div className="text-xl font-bold leading-tight mt-1 tabular-nums">
                {formatStatValue(STATS[c.key as keyof typeof STATS])}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div id="filter-bar" className={`non-fullscreen${filtersVisible ? "" : " collapsed"}`}>
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <FilterSelect
            value={filters.teacher}
            onChange={(v) => setFilters((f) => ({ ...f, teacher: v }))}
            placeholder="O'qituvchi"
            width="w-36"
            options={filterOptions.teachers.map((tch) => [tch, tch])}
          />
          <FilterSelect
            value={filters.group}
            onChange={(v) => setFilters((f) => ({ ...f, group: v }))}
            placeholder="Guruh"
            width="w-32"
            options={filterOptions.groups.map((g) => [String(g), `№ ${g}`])}
          />
          <FilterSelect
            value={filters.room}
            onChange={(v) => setFilters((f) => ({ ...f, room: v }))}
            placeholder="Xona"
            width="w-32"
            options={ROOMS.map((r, i) => [String(i), `${r} - xona`])}
          />
          <FilterSelect
            value={filters.course}
            onChange={(v) => setFilters((f) => ({ ...f, course: v }))}
            placeholder="Kurs"
            width="w-36"
            options={filterOptions.courses.map((c) => [c, c])}
          />
          <FilterSelect
            value={filters.status}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            placeholder="Holati"
            width="w-36"
            options={STATUSES.map((s) => [s.value, s.label])}
          />
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            <svg className="icon icon-xs">
              <use href="#i-x-circle" />
            </svg>{" "}
            Tozalash
          </button>
        </div>
      </div>

      {/* "Dars jadvali" sub-heading + day tabs + view toggles */}
      <div className="space-y-3 pt-2">
        <h2 className="text-lg font-semibold tracking-tight non-fullscreen">Dars jadvali</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {dayTabsVisible && (
            <div className="flex flex-wrap gap-1 rounded-lg bg-card border border-border p-1">
              {SCH_DAY_ORDER.map((d, i) => (
                <button
                  key={d}
                  onClick={() => selectDay(d)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                    d === day ? "bg-primary text-white" : "hover:bg-secondary"
                  }`}
                >
                  {SCH_DAY_LONG[i]}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            {oldTogglesVisible && (
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-border bg-card p-0.5">
                  <ToggleBtn active={groupBy === "room"} onClick={() => setGroupBy("room")} title="Xona bo'yicha" icon="i-grid" />
                  <ToggleBtn active={groupBy === "teacher"} onClick={() => setGroupBy("teacher")} title="O'qituvchi bo'yicha" icon="i-user" />
                </div>
                <div className="flex rounded-lg border border-border bg-card p-0.5">
                  <ToggleBtn active={layout === "grid"} onClick={() => setLayout("grid")} title="Ustun ko'rinishi" icon="i-grid" />
                  <ToggleBtn active={layout === "row"} onClick={() => setLayout("row")} title="Qator ko'rinishi" icon="i-list" />
                </div>
              </div>
            )}
            <button
              onClick={() => setFullscreen((v) => !v)}
              title={fullscreen ? "Kichik xolatda ko'rish" : "To'liq ekran"}
              className="inline-flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-card hover:bg-secondary"
            >
              <svg className="icon icon-sm">
                <use href={fullscreen ? "#i-minimize" : "#i-maximize"} />
              </svg>
              {fullscreen && <span className="text-sm font-medium">Kichik xolatda ko&apos;rish</span>}
            </button>
          </div>
        </div>
      </div>

      {/* View picker */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3 non-fullscreen">
        <div className="sch-view-picker">
          <ViewBtn active={schView === "day"} onClick={() => pickView("day")} icon="i-calendar" label="Kun" />
          <ViewBtn active={schView === "week"} onClick={() => pickView("week")} icon="i-grid" label="Hafta" />
          <ViewBtn active={schView === "month"} onClick={() => pickView("month")} icon="i-layers" label="Oy" />
          <ViewBtn active={schView === "teacher"} onClick={() => pickView("teacher")} icon="i-user" label="O'qituvchi" />
          <ViewBtn active={schView === "room"} onClick={() => pickView("room")} icon="i-archive" label="Xona" />
        </div>

        <button
          onClick={() => {
            /* "Yangi dars" modali keyingi bosqichda */
          }}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <svg className="icon icon-sm">
            <use href="#i-file-plus" />
          </svg>
          <span>Yangi dars</span>
        </button>
      </div>

      {/* Conflict banner */}
      {summary && (
        <div className="sch-conflict-banner">
          <div className="icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div className="text">
            <b>{totalConflicts} ta jadval konflikti</b> aniqlandi
            <div className="details">
              {summary.teacher} ta o&apos;qituvchi konflikti, {summary.room} ta xona konflikti ·{" "}
              {summary.dayList}
            </div>
          </div>
          <button onClick={() => showConflictDetails()}>Tafsilot</button>
        </div>
      )}

      {/* Schedule grid */}
      <div id="schedule-grid">
        {schView === "week" ? (
          <WeekView />
        ) : schView === "month" ? (
          <MonthView />
        ) : (
          <DayGrid day={day} groupBy={groupBy} layout={layout} filters={filters} />
        )}
      </div>

      <ScheduleIcons />
    </div>
  );
}

/* ============================ Kun ko'rinishi ============================ */

function DayGrid({
  day,
  groupBy,
  layout,
  filters,
}: {
  day: string;
  groupBy: GroupBy;
  layout: Layout;
  filters: Filters;
}) {
  let lessons: Lesson[] = (SCHEDULE_DATA as Record<string, Lesson[]>)[day] || [];
  lessons = lessons.filter((L) => {
    if (filters.teacher && L.teacher !== filters.teacher) return false;
    if (filters.group && String(L.groupNum) !== filters.group) return false;
    if (filters.room && String(L.room) !== filters.room) return false;
    if (filters.course && L.course !== filters.course) return false;
    if (filters.status && L.status !== filters.status) return false;
    return true;
  });

  // Ustunlar (xona yoki o'qituvchi)
  let items: { label: string; full: string; key: string | number }[];
  if (groupBy === "teacher") {
    const seen = new Set<string>();
    items = [];
    for (const L of lessons) {
      if (!seen.has(L.teacher)) {
        seen.add(L.teacher);
        const lbl = L.teacher.length > 18 ? L.teacher.slice(0, 18) + "..." : L.teacher;
        items.push({ label: lbl, full: L.teacher, key: L.teacher });
      }
    }
    if (items.length === 0) items = [{ label: "—", full: "", key: "__none__" }];
  } else {
    items = ROOMS.map((r) => ({ label: `${r} - xona`, full: `${r} - xona`, key: r }));
  }

  const placed = lessons
    .map((L) => {
      const idx = groupBy === "teacher" ? items.findIndex((it) => it.key === L.teacher) : L.room;
      return { ...L, idx };
    })
    .filter((L) => L.idx >= 0 && L.idx < items.length);

  const cKeys = conflictKeys(day);

  if (layout === "row") return <RowLayout items={items} lessons={placed} cKeys={cKeys} />;
  return <GridLayout items={items} lessons={placed} cKeys={cKeys} />;
}

function buildMatrices(items: unknown[], lessons: (Lesson & { idx: number })[], byRow: boolean) {
  // byRow=false → [slot][col]; byRow=true → [row][slot]
  const outer = byRow ? items.length : TIME_SLOTS.length;
  const inner = byRow ? TIME_SLOTS.length : items.length;
  const skip: boolean[][] = Array.from({ length: outer }, () => Array(inner).fill(false));
  const start: (typeof lessons[number] | null)[][] = Array.from({ length: outer }, () =>
    Array(inner).fill(null),
  );
  for (const L of lessons) {
    if (L.startSlot < 0 || L.startSlot >= TIME_SLOTS.length) continue;
    if (byRow) {
      start[L.idx][L.startSlot] = L;
      for (let i = 1; i < L.slots; i++) {
        const s = L.startSlot + i;
        if (s < TIME_SLOTS.length) skip[L.idx][s] = true;
      }
    } else {
      start[L.startSlot][L.idx] = L;
      for (let i = 1; i < L.slots; i++) {
        const s = L.startSlot + i;
        if (s < TIME_SLOTS.length) skip[s][L.idx] = true;
      }
    }
  }
  return { skip, start };
}

function LessonCard({ L, cKeys, row }: { L: Lesson; cKeys: Set<string>; row?: boolean }) {
  const isConflict = cKeys.has(`${L.groupNum}|${L.startSlot}`);
  const roomLbl = `Xona: ${ROOMS[L.room]} - xona`;
  const tip = `№${L.groupNum} · ${L.teacher} · ${ROOMS[L.room]}-xona`;
  const extra = L.extra !== undefined && L.extra !== null ? <span>{L.extra}</span> : null;

  if (row) {
    return (
      <div
        className={`sch-lesson-row${L.isMakeup ? " is-makeup" : ""}${isConflict ? " has-conflict" : ""}`}
        style={{ background: L.color, gridColumn: `span ${L.slots}` }}
        title={tip}
      >
        <span className="gnum">{L.groupNum}</span>
        <div className="info">
          <span className="tname">{L.teacher}</span>
          <span className="room">• {roomLbl}</span>
        </div>
        <div className="meta">
          <span className="flex items-center gap-1">
            <svg className="icon icon-xs">
              <use href="#i-book" />
            </svg>{" "}
            {L.book}
          </span>
          <span className="flex items-center gap-1">
            <svg className="icon icon-xs">
              <use href="#i-users-group" />
            </svg>{" "}
            {L.ppl}
          </span>
          {extra}
        </div>
        {isConflict && (
          <span className="conflict-badge" title="Konflikt: vaqtda boshqa dars bilan to'qnashadi">
            !
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`sch-lesson${L.isMakeup ? " is-makeup" : ""}${isConflict ? " has-conflict" : ""}`}
      style={{ background: L.color, gridRow: `span ${L.slots}` }}
      title={tip}
    >
      <div>
        <div className="gnum">{L.groupNum}</div>
        <div className="tname">{L.teacher}</div>
        <div className="room">{roomLbl}</div>
      </div>
      <div className="meta">
        <span className="flex items-center gap-1">
          <svg className="icon icon-xs">
            <use href="#i-book" />
          </svg>{" "}
          {L.book}
        </span>
        <span className="flex items-center gap-1">
          <svg className="icon icon-xs">
            <use href="#i-users-group" />
          </svg>{" "}
          {L.ppl}
        </span>
        {extra}
      </div>
      {isConflict && (
        <span className="conflict-badge" title="Konflikt: vaqtda boshqa dars bilan to'qnashadi">
          !
        </span>
      )}
    </div>
  );
}

function GridLayout({
  items,
  lessons,
  cKeys,
}: {
  items: { label: string; full: string; key: string | number }[];
  lessons: (Lesson & { idx: number })[];
  cKeys: Set<string>;
}) {
  const { skip, start } = buildMatrices(items, lessons, false);
  const cols = `110px repeat(${items.length}, minmax(140px, 1fr))`;
  const minWidth = 110 + items.length * 140;

  return (
    <div className="overflow-x-auto rounded-2xl">
      <div className="schedule" style={{ gridTemplateColumns: cols, minWidth }}>
        <div className="sch-room" style={{ background: "hsl(var(--secondary) / 0.65)" }} />
        {items.map((it, i) => (
          <div key={`h${i}`} className="sch-room" title={it.full}>
            {it.label}
          </div>
        ))}
        {TIME_SLOTS.map((ts, s) => (
          <Fragment key={`r${s}`}>
            <div className="sch-time">{ts}</div>
            {items.map((_, c) => {
              if (skip[s][c]) return null;
              const L = start[s][c];
              if (L) return <LessonCard key={`c${s}-${c}`} L={L} cKeys={cKeys} />;
              return (
                <div key={`c${s}-${c}`} className="sch-empty">
                  —
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function RowLayout({
  items,
  lessons,
  cKeys,
}: {
  items: { label: string; full: string; key: string | number }[];
  lessons: (Lesson & { idx: number })[];
  cKeys: Set<string>;
}) {
  const { skip, start } = buildMatrices(items, lessons, true);
  const cols = `150px repeat(${TIME_SLOTS.length}, minmax(140px, 1fr))`;
  const minWidth = 150 + TIME_SLOTS.length * 140;

  return (
    <div className="overflow-x-auto rounded-2xl">
      <div className="schedule-row" style={{ gridTemplateColumns: cols, minWidth }}>
        <div className="sch-time-h" style={{ background: "hsl(var(--secondary) / 0.65)" }} />
        {TIME_SLOTS.map((t, i) => (
          <div key={`th${i}`} className="sch-time-h">
            {t}
          </div>
        ))}
        {items.map((it, r) => (
          <Fragment key={`row${r}`}>
            <div className="sch-room-side" title={it.full}>
              {it.label}
            </div>
            {TIME_SLOTS.map((_, s) => {
              if (skip[r][s]) return null;
              const L = start[r][s];
              if (L) return <LessonCard key={`rc${r}-${s}`} L={L} cKeys={cKeys} row />;
              return (
                <div key={`rc${r}-${s}`} className="sch-empty">
                  —
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/* ============================ Hafta ko'rinishi ============================ */

function WeekView() {
  const todayDay = SCH_DAY_ORDER[new Date().getDay()];
  return (
    <div className="sch-week">
      <div className="sch-week-head" />
      {SCH_DAY_LONG.map((lbl, i) => (
        <div key={`wh${i}`} className={`sch-week-head${SCH_DAY_ORDER[i] === todayDay ? " today" : ""}`}>
          {lbl}
        </div>
      ))}
      {TIME_SLOTS.map((ts, s) => (
        <Fragment key={`wr${s}`}>
          <div className="sch-week-time">{ts.split(" - ")[0]}</div>
          {SCH_DAY_ORDER.map((dayKey) => {
            const lessons: Lesson[] = (SCHEDULE_DATA as Record<string, Lesson[]>)[dayKey] || [];
            const cellLessons = lessons.filter((L) => L.startSlot === s);
            const cKeys = conflictKeys(dayKey);
            return (
              <div key={`wc${dayKey}-${s}`} className="sch-week-cell">
                {cellLessons.map((L, k) => {
                  const isConflict = cKeys.has(`${L.groupNum}|${L.startSlot}`);
                  return (
                    <div
                      key={k}
                      className={`sch-week-lesson${isConflict ? " has-conflict" : ""}`}
                      style={{ background: L.color }}
                      title={`№${L.groupNum} · ${L.teacher} · ${ROOMS[L.room]}-xona`}
                    >
                      №{L.groupNum} · {(L.teacher || "").split(" ")[0]}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

/* ============================ Oy ko'rinishi ============================ */

function MonthView() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startCol = firstDay.getDay();
  const today = now.getDate();
  const monthNames = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
  const labels = ["Yak", "Du", "Se", "Cho", "Pa", "Ju", "Sha"];

  const totalCells = startCol + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;

  return (
    <>
      <div style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {monthNames[month]} {year}
        </div>
        <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>Bugun: {today}</div>
      </div>
      <div className="sch-month">
        {labels.map((lbl, i) => (
          <div key={`mh${i}`} className="sch-month-head">
            {lbl}
          </div>
        ))}
        {Array.from({ length: startCol }).map((_, i) => (
          <div key={`me${i}`} className="sch-month-day empty" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, di) => {
          const d = di + 1;
          const dt = new Date(year, month, d);
          const jsDow = dt.getDay();
          const dayKey = SCH_DAY_ORDER[jsDow];
          const lessons: Lesson[] = (SCHEDULE_DATA as Record<string, Lesson[]>)[dayKey] || [];
          const cKeys = conflictKeys(dayKey);
          const isToday = d === today;
          const isWeekend = jsDow === 0 || jsDow === 6;
          const visible = lessons.slice(0, 3);
          const remaining = Math.max(0, lessons.length - 3);
          return (
            <div key={`md${d}`} className={`sch-month-day${isToday ? " today" : ""}${isWeekend ? " weekend" : ""}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="sch-month-num">{d}</span>
                {lessons.length > 0 && <span className="sch-month-count">{lessons.length}</span>}
              </div>
              {visible.map((L, k) => {
                const isConflict = cKeys.has(`${L.groupNum}|${L.startSlot}`);
                return (
                  <span
                    key={k}
                    className={`sch-month-dot${isConflict ? " has-conflict" : ""}`}
                    style={isConflict ? undefined : { background: L.color }}
                    title={`№${L.groupNum} · ${L.teacher || ""}`}
                  >
                    {TIME_SLOTS[L.startSlot]?.split(" - ")[0] || ""} {L.groupNum}
                  </span>
                );
              })}
              {remaining > 0 && <div className="sch-month-more">+{remaining} ta</div>}
            </div>
          );
        })}
        {Array.from({ length: trailing }).map((_, i) => (
          <div key={`mt${i}`} className="sch-month-day empty" />
        ))}
      </div>
    </>
  );
}

/* ============================ Kichik komponentlar ============================ */

function FilterSelect({
  value,
  onChange,
  placeholder,
  width,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  width: string;
  options: [string, string][];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`filter-select h-9 ${width} appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
      >
        <option value="">{placeholder}</option>
        {options.map(([v, lbl]) => (
          <option key={v} value={v}>
            {lbl}
          </option>
        ))}
      </select>
      <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
        <use href="#i-chevron-down" />
      </svg>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  title,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`h-8 w-8 flex items-center justify-center rounded-md ${
        active ? "bg-primary text-white" : "hover:bg-secondary"
      }`}
    >
      <svg className="icon icon-sm">
        <use href={`#${icon}`} />
      </svg>
    </button>
  );
}

function ViewBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button className={`sch-view-btn${active ? " active" : ""}`} onClick={onClick}>
      <svg>
        <use href={`#${icon}`} />
      </svg>{" "}
      <span>{label}</span>
    </button>
  );
}

function showConflictDetails() {
  const conflicts = detectAllConflicts();
  if (conflicts.length === 0) return;
  const lines = conflicts.map((c, i) => {
    const dayIdx = SCH_DAY_ORDER.indexOf(c.day);
    const dayLbl = SCH_DAY_LONG[dayIdx];
    const tA = TIME_SLOTS[c.a.startSlot]?.split(" - ")[0] || "";
    const tB = TIME_SLOTS[c.b.startSlot]?.split(" - ")[0] || "";
    return `${i + 1}. ${dayLbl} ${tA}/${tB} → ${c.label}\n   - Guruh №${c.a.groupNum} (${c.a.teacher})\n   - Guruh №${c.b.groupNum} (${c.b.teacher})`;
  });
  alert(`⚠ KONFLIKTLAR (${conflicts.length} ta):\n\n` + lines.join("\n\n"));
}

/* Sidebar/Navbar sprite'ida bo'lmagan, shu sahifaga xos icon'lar */
function ScheduleIcons() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="i-filter" viewBox="0 0 24 24">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </symbol>
        <symbol id="i-user-check" viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <polyline points="16 11 18 13 22 9" />
        </symbol>
        <symbol id="i-user-star" viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <polygon points="19 4 20.5 7 23.5 7.5 21.25 9.75 21.75 13 19 11.5 16.25 13 16.75 9.75 14.5 7.5 17.5 7" />
        </symbol>
        <symbol id="i-user-minus" viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </symbol>
        <symbol id="i-user-off" viewBox="0 0 24 24">
          <circle cx="9" cy="7" r="4" />
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <line x1="3" y1="3" x2="21" y2="21" />
        </symbol>
        <symbol id="i-dollar-sign" viewBox="0 0 24 24">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </symbol>
        <symbol id="i-snowflake" viewBox="0 0 24 24">
          <line x1="2" y1="12" x2="22" y2="12" />
          <line x1="12" y1="2" x2="12" y2="22" />
          <path d="m20 16-4-4 4-4" />
          <path d="m4 8 4 4-4 4" />
          <path d="m16 4-4 4-4-4" />
          <path d="m8 20 4-4 4 4" />
        </symbol>
        <symbol id="i-list" viewBox="0 0 24 24">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </symbol>
        <symbol id="i-maximize" viewBox="0 0 24 24">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </symbol>
        <symbol id="i-minimize" viewBox="0 0 24 24">
          <path d="M8 3v3a2 2 0 0 1-2 2H3" />
          <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
          <path d="M3 16h3a2 2 0 0 1 2 2v3" />
          <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </symbol>
        <symbol id="i-layers" viewBox="0 0 24 24">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </symbol>
      </defs>
    </svg>
  );
}
