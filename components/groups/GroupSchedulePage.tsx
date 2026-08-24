"use client";

// Guruh → Dars jadvali (crm-akademiya sidebar: Guruh > Dars jadvali, href
// /groups-schedule). Guruhlar /api/groups dan keladi (constants/groups.js
// GROUP_SEED asosida seed qilingan — Guruh ro'yxati bilan bir xil ma'lumot).
// Har guruhning "kun" maydoni ("Toq kunlar" kabi) constants/groupsSchedule.js
// dagi qoida bo'yicha haftaning aniq kuniga moslanadi, "vaqt" maydoni esa
// 30 daqiqalik slotlarga bo'linib xona/o'qituvchi ustunida joylashtiriladi.
// Filtr (o'qituvchi/kurs/xona/kun turi) va Export (CSV) tepadagi tugmalar
// orqali ishlaydi; ko'rinish xona yoki o'qituvchi bo'yicha, ustun yoki qator
// layoutda tanlanadi.

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BarChart3, ChevronDown, DoorOpen, Download, Filter, LayoutGrid, Maximize2, Minimize2, Rows3, User, Users, X } from "lucide-react";
import { computeScheduleKpis } from "@/lib/scheduleStats";
import Button from "@/components/ui/Button";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import type { Group } from "@/lib/groups";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import { useRooms } from "@/hooks/useRooms";
import { GROUP_DAYS } from "@/constants/groups";
import {
  SCHEDULE_DAY_LABELS,
  SCHEDULE_DAY_LONG,
  SCHEDULE_DAY_ORDER,
  SCHEDULE_TIME_SLOTS,
  courseColor,
  parseTimeRange,
  weekdaysForDayPattern,
} from "@/constants/groupsSchedule";

type GroupBy = "room" | "teacher";
type Layout = "grid" | "row";

interface Filters {
  teacher: string;
  course: string;
  room: string;
  dayType: string;
}
const EMPTY_FILTERS: Filters = { teacher: "", course: "", room: "", dayType: "" };

interface Placed {
  group: Group;
  startSlot: number;
  span: number;
  color: string;
  col: number;
}

const selectCls = "h-9 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function GroupSchedulePage() {
  const { showSuccess } = useToast();
  const { names: roomNames } = useRooms();
  const { names: courseNames } = useOfflineCourseList();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState(() => SCHEDULE_DAY_ORDER[new Date().getDay()]);
  const [groupBy, setGroupBy] = useState<GroupBy>("room");
  const [layout, setLayout] = useState<Layout>("grid");
  const [filtersVisible, setFiltersVisible] = useState(false);
  // Referensda KPI kartalari boshlang'ich holatda ko'rinib turadi.
  const [statsVisible, setStatsVisible] = useState(true);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [fullscreen, setFullscreen] = useState(false);
  // "Birinchi darsga keladiganlar" — /first-lessons sahifasi bilan bir xil
  // shart: birinchi dars sanasi belgilangan buyurtmalar.
  const [firstLessonCount, setFirstLessonCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/orders")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        setFirstLessonCount(
          (d.orders as { firstLesson?: string }[]).filter((o) => (o.firstLesson || "").trim()).length,
        );
      });
    return () => { cancelled = true; };
  }, []);
  // Guruhlar soni va birinchi darsga yozilganlar HAQIQIY (/api/groups,
  // /api/orders), qolgan ko'rsatkichlar tegishli sahifalar bilan bir xil
  // mantiqdan hisoblanadi — lib/scheduleStats.ts.
  const kpis = useMemo(
    () => computeScheduleKpis(groups.length, firstLessonCount),
    [groups.length, firstLessonCount],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/groups")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setGroups(d.groups); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // To'liq ekran — body klassi orqali (globals.css: body.fullscreen-mode ...)
  useEffect(() => {
    document.body.classList.toggle("fullscreen-mode", fullscreen);
    return () => document.body.classList.remove("fullscreen-mode");
  }, [fullscreen]);

  // Shu hafta kunida darsi bo'lgan guruhlar (day pattern → weekday)
  const dayGroups = useMemo(
    () => groups.filter((g) => weekdaysForDayPattern(g.day).includes(day)),
    [groups, day],
  );

  const filterOptions = useMemo(() => {
    const teachers = [...new Set(dayGroups.map((g) => g.teacher).filter(Boolean))].sort();
    const rooms = [...new Set(dayGroups.map((g) => g.room).filter(Boolean))].sort();
    return { teachers, rooms };
  }, [dayGroups]);

  const filtered = useMemo(() => {
    return dayGroups.filter((g) => {
      if (filters.teacher && g.teacher !== filters.teacher) return false;
      if (filters.course && g.course !== filters.course) return false;
      if (filters.room && g.room !== filters.room) return false;
      if (filters.dayType && g.day !== filters.dayType) return false;
      return true;
    });
  }, [dayGroups, filters]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Ustunlar: xona (doim to'liq ro'yxat) yoki o'qituvchi (shu kunda darsi borlar)
  const columns = useMemo(() => {
    if (groupBy === "teacher") {
      const seen: string[] = [];
      for (const g of filtered) if (g.teacher && !seen.includes(g.teacher)) seen.push(g.teacher);
      return seen;
    }
    // Xona ustunlari BAZADAN (/api/rooms). Ilgari constants'dagi
    // "201 - xona … 219 - xona" ro'yxati edi va foydalanuvchi yaratgan
    // xonadagi guruh jadvalda UMUMAN ko'rinmasdi (indexOf → -1 → continue).
    // Ro'yxatda yo'q, lekin guruhlarda uchraydigan xonalar ham qo'shiladi.
    const extra = filtered
      .map((g) => g.room)
      .filter((r): r is string => Boolean(r) && !roomNames.includes(r));
    return [...roomNames, ...new Set(extra)];
  }, [filtered, groupBy, roomNames]);

  const placed: Placed[] = useMemo(() => {
    const out: Placed[] = [];
    for (const g of filtered) {
      const col = columns.indexOf(groupBy === "teacher" ? g.teacher : g.room);
      if (col < 0) continue;
      const { startSlot, span } = parseTimeRange(g.time);
      if (startSlot < 0) continue;
      out.push({ group: g, startSlot, span, color: courseColor(g.course), col });
    }
    return out;
  }, [filtered, groupBy, columns]);

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  function exportCSV() {
    const headers = ["Guruh", "Kurs", "Kun", "Vaqt", "Xona", "O'qituvchi", "O'quvchilar"];
    const rows = filtered.map((g) => [g.name, g.course, g.day, g.time, g.room, g.teacher, g.students]);
    const csv = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const dayIdx = SCHEDULE_DAY_ORDER.indexOf(day);
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `dars-jadvali-${SCHEDULE_DAY_LONG[dayIdx] || day}.csv`);
    showSuccess(`CSV yuklab olindi — ${filtered.length} ta`);
  }

  return (
    <div id="view-groups-schedule" className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      {/* Sarlavha + Export/Filtr */}
      <div className="flex items-center justify-between non-fullscreen">
        <h1 className="text-lg font-semibold tracking-tight">Dars jadvali</h1>
        <div className="flex gap-2">
          <Button variant="outline" lucideIcon={Download} onClick={exportCSV}>
            Export
          </Button>
          <button
            onClick={() => setStatsVisible((v) => !v)}
            title="Statistika kartalarini ko'rsatish/yashirish"
            className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium transition-colors ${
              statsVisible ? "bg-primary text-white hover:opacity-90" : "border border-border bg-card hover:bg-secondary"
            }`}
          >
            <BarChart3 className="icon icon-sm" />
            <span>Statistika</span>
          </button>

          <button
            onClick={() => setFiltersVisible((v) => !v)}
            className={`relative inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-shadow${
              filtersVisible ? " ring-2 ring-blue-300" : ""
            }`}
          >
            <Filter className="icon icon-sm" />
            <span>Filtr</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* KPI kartalari — referensda jadval ustida turadi. "Statistika"
          tugmasi ularni yashiradi/ko'rsatadi (boshlang'ich holat — ochiq,
          referensdagi kabi). */}
      {statsVisible && (
        <div className="kpi-grid non-fullscreen">
          {kpis.map((k) => (
            <Link key={k.key} href={k.href} className="kpi-card">
              <span className="kpi-icon" style={{ backgroundColor: k.bg, color: k.fg }}>
                <svg className="icon"><use href={`#${k.icon}`} /></svg>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] leading-tight text-muted-foreground">{k.label}</span>
                <span className="block text-[17px] font-bold tabular-nums leading-tight">
                  {k.value.toLocaleString("ru-RU").replace(/,/g, " ")}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Filtr paneli */}
      {filtersVisible && (
        <div className="non-fullscreen flex flex-wrap items-center justify-end gap-2">
          <FilterSelect
            value={filters.teacher}
            onChange={(v) => setFilters((f) => ({ ...f, teacher: v }))}
            placeholder="O'qituvchi"
            width="w-40"
            options={filterOptions.teachers.map((t) => [t, t] as [string, string])}
          />
          <FilterSelect
            value={filters.course}
            onChange={(v) => setFilters((f) => ({ ...f, course: v }))}
            placeholder="Kurs"
            width="w-36"
            options={courseNames.map((c) => [c, c] as [string, string])}
          />
          <FilterSelect
            value={filters.room}
            onChange={(v) => setFilters((f) => ({ ...f, room: v }))}
            placeholder="Xona"
            width="w-32"
            options={filterOptions.rooms.map((r) => [r, r] as [string, string])}
          />
          <FilterSelect
            value={filters.dayType}
            onChange={(v) => setFilters((f) => ({ ...f, dayType: v }))}
            placeholder="Kun turi"
            width="w-36"
            options={GROUP_DAYS.map((d) => [d, d] as [string, string])}
          />
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            <X className="icon icon-xs" /> Tozalash
          </button>
        </div>
      )}

      {/* Kun tablari + ko'rinish tugmalari */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-card border border-border p-1 non-fullscreen">
          {SCHEDULE_DAY_ORDER.map((d, i) => (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${d === day ? "bg-primary text-white" : "hover:bg-secondary"}`}
            >
              {SCHEDULE_DAY_LABELS[i]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-card p-0.5 non-fullscreen">
            <ToggleBtn active={groupBy === "room"} onClick={() => setGroupBy("room")} title="Xona bo'yicha" Icon={DoorOpen} />
            <ToggleBtn active={groupBy === "teacher"} onClick={() => setGroupBy("teacher")} title="O'qituvchi bo'yicha" Icon={User} />
          </div>
          <div className="flex rounded-lg border border-border bg-card p-0.5 non-fullscreen">
            <ToggleBtn active={layout === "grid"} onClick={() => setLayout("grid")} title="Ustun ko'rinishi" Icon={LayoutGrid} />
            <ToggleBtn active={layout === "row"} onClick={() => setLayout("row")} title="Qator ko'rinishi" Icon={Rows3} />
          </div>
          <button
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? "Kichik xolatda ko'rish" : "To'liq ekran"}
            className="inline-flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-card hover:bg-secondary"
          >
            {fullscreen ? <Minimize2 className="icon icon-sm" /> : <Maximize2 className="icon icon-sm" />}
            {fullscreen && <span className="text-sm font-medium">Kichik xolatda ko&apos;rish</span>}
          </button>
        </div>
      </div>

      {/* Jadval */}
      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground"><SpinnerBlock /></div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {SCHEDULE_DAY_LONG[SCHEDULE_DAY_ORDER.indexOf(day)]} kuni uchun dars topilmadi.
        </div>
      ) : layout === "row" ? (
        <RowLayout columns={columns} lessons={placed} groupBy={groupBy} />
      ) : (
        <GridLayout columns={columns} lessons={placed} groupBy={groupBy} />
      )}
    </div>
  );
}

/* ============================ Joylashtirish (rowspan) ============================ */

function buildMatrices(colCount: number, lessons: Placed[], byRow: boolean) {
  const rows = SCHEDULE_TIME_SLOTS.length;
  const outer = byRow ? colCount : rows;
  const inner = byRow ? rows : colCount;
  const skip: boolean[][] = Array.from({ length: outer }, () => Array(inner).fill(false));
  const start: (Placed | null)[][] = Array.from({ length: outer }, () => Array(inner).fill(null));
  for (const L of lessons) {
    if (L.startSlot < 0 || L.startSlot >= rows) continue;
    if (byRow) {
      if (start[L.col][L.startSlot] || skip[L.col][L.startSlot]) continue;
      start[L.col][L.startSlot] = L;
      for (let i = 1; i < L.span; i++) {
        const s = L.startSlot + i;
        if (s < rows) skip[L.col][s] = true;
      }
    } else {
      if (start[L.startSlot][L.col] || skip[L.startSlot][L.col]) continue;
      start[L.startSlot][L.col] = L;
      for (let i = 1; i < L.span; i++) {
        const s = L.startSlot + i;
        if (s < rows) skip[s][L.col] = true;
      }
    }
  }
  return { skip, start };
}

function colLabel(c: string): string {
  return c.length > 18 ? c.slice(0, 18) + "…" : c;
}

function LessonCard({ p, groupBy, row }: { p: Placed; groupBy: GroupBy; row?: boolean }) {
  const g = p.group;
  const tip = `№${g.name} · ${g.teacher} · ${g.room}`;

  if (row) {
    return (
      <div className="sch-lesson-row" style={{ background: p.color, gridColumn: `span ${p.span}` }} title={tip}>
        <span className="gnum">{g.name}</span>
        <div className="info">
          <span className="tname">{g.course}</span>
          <span className="room">• {groupBy === "room" ? g.teacher : g.room}</span>
        </div>
        <div className="meta">
          <span className="tabular-nums">{g.time}</span>
          <span className="flex items-center gap-1">
            <Users className="icon icon-xs" />
            {g.students}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="sch-lesson" style={{ background: p.color, gridRow: `span ${p.span}` }} title={tip}>
      <div>
        <div className="text-[10px] font-semibold opacity-90 tabular-nums leading-tight">{g.time}</div>
        <div className="text-[13px] font-bold leading-tight mt-0.5">{g.course}</div>
        <div className="tname">{g.teacher}</div>
        <div className="room">{groupBy === "room" ? `Xona: ${g.room}` : g.room}</div>
        <div className="text-[10px] opacity-80 mt-0.5">{g.day}</div>
      </div>
      <div className="meta">
        <span className="gnum" style={{ fontSize: 14 }}>
          №{g.name}
        </span>
        <span className="flex items-center gap-0.5">
          <Users className="icon icon-xs" />
          {g.students}
        </span>
      </div>
    </div>
  );
}

function GridLayout({ columns, lessons, groupBy }: { columns: string[]; lessons: Placed[]; groupBy: GroupBy }) {
  const { skip, start } = buildMatrices(columns.length, lessons, false);
  const cols = `110px repeat(${columns.length}, minmax(140px, 1fr))`;
  const minWidth = 110 + columns.length * 140;

  return (
    <div className="overflow-x-auto rounded-2xl">
      <div className="schedule" style={{ gridTemplateColumns: cols, minWidth }}>
        <div className="sch-room" style={{ background: "hsl(var(--secondary) / 0.65)" }} />
        {columns.map((c, i) => (
          <div key={`h${i}`} className="sch-room" title={c}>
            {colLabel(c)}
          </div>
        ))}
        {SCHEDULE_TIME_SLOTS.map((ts, s) => (
          <Fragment key={`r${s}`}>
            <div className="sch-time">{ts}</div>
            {columns.map((_, c) => {
              if (skip[s][c]) return null;
              const L = start[s][c];
              if (L) return <LessonCard key={`c${s}-${c}`} p={L} groupBy={groupBy} />;
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

function RowLayout({ columns, lessons, groupBy }: { columns: string[]; lessons: Placed[]; groupBy: GroupBy }) {
  const { skip, start } = buildMatrices(columns.length, lessons, true);
  const cols = `150px repeat(${SCHEDULE_TIME_SLOTS.length}, minmax(140px, 1fr))`;
  const minWidth = 150 + SCHEDULE_TIME_SLOTS.length * 140;

  return (
    <div className="overflow-x-auto rounded-2xl">
      <div className="schedule-row" style={{ gridTemplateColumns: cols, minWidth }}>
        <div className="sch-time-h" style={{ background: "hsl(var(--secondary) / 0.65)" }} />
        {SCHEDULE_TIME_SLOTS.map((t, i) => (
          <div key={`th${i}`} className="sch-time-h">
            {t}
          </div>
        ))}
        {columns.map((c, r) => (
          <Fragment key={`row${r}`}>
            <div className="sch-room-side" title={c}>
              {colLabel(c)}
            </div>
            {SCHEDULE_TIME_SLOTS.map((_, s) => {
              if (skip[r][s]) return null;
              const L = start[r][s];
              if (L) return <LessonCard key={`rc${r}-${s}`} p={L} groupBy={groupBy} row />;
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
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${selectCls} ${width}`}>
        <option value="">{placeholder}</option>
        {options.map(([v, lbl]) => (
          <option key={v} value={v}>
            {lbl}
          </option>
        ))}
      </select>
      <ChevronDown className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
    </div>
  );
}

function ToggleBtn({ active, onClick, title, Icon }: { active: boolean; onClick: () => void; title: string; Icon: LucideIcon }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`h-8 w-8 flex items-center justify-center rounded-md ${active ? "bg-primary text-white" : "hover:bg-secondary"}`}
    >
      <Icon className="icon icon-sm" />
    </button>
  );
}
