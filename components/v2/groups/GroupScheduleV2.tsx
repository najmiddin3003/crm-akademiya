"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CalendarDays, DoorOpen, Download, LayoutGrid, List, Maximize2, Minimize2, RefreshCw, Rows3, User, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { SegmentSwitch } from "@/components/v2/imtihon/examBits";
import { B, PageHead, PageShell, SummaryLine } from "@/components/v2/students/lists/listKit";
import V2Select from "@/components/v2/ui/V2Select";
import { secondaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { layoutDay, parseTimeRange as parseMinutes } from "@/components/v2/employees/scheduleUtils";
import { GROUP_DAYS } from "@/constants/groups";
import { SCHEDULE_DAY_LABELS, SCHEDULE_DAY_LONG, SCHEDULE_DAY_ORDER, parseTimeRange, weekdaysForDayPattern } from "@/constants/groupsSchedule";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import { useRooms } from "@/hooks/useRooms";
import type { Group } from "@/lib/groups";
import { GridView, ListView, LessonHoverCard, RowView, type GroupBy, type HoverFn, type SchedColumn, type SchedLesson } from "./groupScheduleViews";

// YANGI VERSIYA — GURUH → «DARS JADVALI» (/groups-schedule, 54-qism, rasmsiz, 20.11.2026). Eski versiyada —
// components/groups/GroupSchedulePage.tsx (o'zgarmagan; /home ham o'shani ko'rsatadi).
//
// Ma'lumot va qoidalar eski sahifa bilan BITTA:
//   • guruhlar — GET /api/groups; xonalar — useRooms (/api/rooms); kurslar — useOfflineCourseList;
//   • kun — guruh «kun» maydonidan (constants/groupsSchedule.js → weekdaysForDayPattern: Toq = Du/Chor/Ju …);
//   • jadvalga tushadigan dars — eskisidagi shart (parseTimeRange: 06:00–22:00 oralig'ida, vaqti o'qiladi);
//   • ustunlar — xona bo'yicha: bazadagi HAMMA xona + guruhlarda uchraydigan qo'shimcha xonalar; o'qituvchi
//     bo'yicha: shu kunda darsi borlar (eski tartibda);
//   • filtrlar (O'qituvchi, Kurs, Xona, Kun turi) va ularning variantlari — eskisidagidek;
//   • CSV — eski fayl bilan AYNAN bir xil (o'sha ustunlar, nom `dars-jadvali-<Kun>.csv`, xabar).
// Farqi — ko'rinishda: hafta Du dan boshlanadi va har kunda darslar soni; ustun/qator ko'rinishi blokli vaqt
// setkasi (Xonalar bandligi qolipi); bir ustunda vaqti kesishgan darslar yonma-yon `warning` bilan (eskisida
// ikkinchisi chizilmay qolardi); telefon uchun «Ro'yxat» (tor ekranda sukut); bugungi kunda «hozir» chizig'i;
// «To'liq ekran» — sahifa ustidagi oyna (eskisida body klassi).

type View = "grid" | "row" | "list";

interface Filters {
  teacher: string;
  course: string;
  room: string;
  dayType: string;
}
const EMPTY_FILTERS: Filters = { teacher: "", course: "", room: "", dayType: "" };

/** Hafta Dushanbadan: SCHEDULE_DAY_ORDER indekslari (0 — yakshanba). */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/* ---- Brauzer holati (gidratatsiyada server bilan bir xil — null / false) ---- */

function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, 30_000);
  return () => window.clearInterval(id);
}
/** Bugungi kun indeksi va daqiqasi — bitta raqamda (kun × 1440 + daqiqa), har 30 soniyada. */
function clockSnapshot(): number {
  const d = new Date();
  return d.getDay() * 1440 + d.getHours() * 60 + d.getMinutes();
}
function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia("(max-width: 639px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const narrowSnapshot = () => window.matchMedia("(max-width: 639px)").matches;

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

export default function GroupScheduleV2() {
  const { t, weekdaysShort } = useT();
  const { showSuccess } = useToast();
  const { rooms, names: roomNames } = useRooms();
  const { names: courseNames } = useOfflineCourseList();

  const [groups, setGroups] = useState<Group[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  const clock = useSyncExternalStore(subscribeClock, clockSnapshot, () => null);
  const narrow = useSyncExternalStore(subscribeNarrow, narrowSnapshot, () => false);
  const todayIdx = clock === null ? null : Math.floor(clock / 1440);
  const nowOfDay = clock === null ? null : clock % 1440;

  // Tanlangan kun — bosilmaguncha BUGUN (eskisidagidek); serverda va gidratatsiyada — dushanba.
  const [picked, setPicked] = useState<string | null>(null);
  const day = picked ?? SCHEDULE_DAY_ORDER[todayIdx ?? 1];
  const dayIdx = SCHEDULE_DAY_ORDER.indexOf(day);
  const isToday = todayIdx !== null && dayIdx === todayIdx;

  const [groupBy, setGroupBy] = useState<GroupBy>("room");
  const [viewPicked, setViewPicked] = useState<View | null>(null);
  const view: View = viewPicked ?? (narrow ? "list" : "grid");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/groups")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) {
          setGroups(d.groups);
          setFailed(false);
        } else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  /* ---- Sichqoncha ostidagi karta (eskisidagidek: blokdan chiqqanda 160 ms kutadi) ---- */
  const [hovered, setHovered] = useState<{ lesson: SchedLesson; rect: DOMRect } | null>(null);
  const closeTimer = useRef<number | null>(null);
  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  const onHover: HoverFn = useCallback(
    (l, rect) => {
      cancelClose();
      if (l && rect) setHovered({ lesson: l, rect });
      else closeTimer.current = window.setTimeout(() => setHovered(null), 160);
    },
    [cancelClose],
  );
  useEffect(() => cancelClose, [cancelClose]);

  /* ---- To'liq ekran: Esc yopadi, orqadagi sahifa aylanmaydi ---- */
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) setFullscreen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  /* ---- Hisob — eski sahifadagi bilan bir xil ---- */
  const all = useMemo(() => groups ?? [], [groups]);

  const passes = useCallback(
    (g: Group) => {
      if (filters.teacher && g.teacher !== filters.teacher) return false;
      if (filters.course && g.course !== filters.course) return false;
      if (filters.room && g.room !== filters.room) return false;
      if (filters.dayType && g.day !== filters.dayType) return false;
      return true;
    },
    [filters],
  );

  const dayGroups = useMemo(() => all.filter((g) => (weekdaysForDayPattern(g.day) as string[]).includes(day)), [all, day]);

  const dayTypeOptions = useMemo(() => [...new Set([...(GROUP_DAYS as string[]), ...all.map((g) => g.day).filter(Boolean)])], [all]);

  const filterOptions = useMemo(() => {
    const teachers = [...new Set(dayGroups.map((g) => g.teacher).filter(Boolean))].sort();
    const roomsOfDay = [...new Set(dayGroups.map((g) => g.room).filter(Boolean))].sort();
    return { teachers, rooms: roomsOfDay };
  }, [dayGroups]);

  const filtered = useMemo(() => dayGroups.filter(passes), [dayGroups, passes]);

  /** Har kun tablaridagi son — o'sha filtrlar bilan. */
  const dayCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const d of SCHEDULE_DAY_ORDER) out[d] = 0;
    for (const g of all) {
      if (!passes(g)) continue;
      for (const d of weekdaysForDayPattern(g.day) as string[]) if (d in out) out[d] += 1;
    }
    return out;
  }, [all, passes]);

  const columnKeys = useMemo(() => {
    if (groupBy === "teacher") {
      const seen: string[] = [];
      for (const g of filtered) if (g.teacher && !seen.includes(g.teacher)) seen.push(g.teacher);
      return seen;
    }
    const extra = filtered.map((g) => g.room).filter((r): r is string => Boolean(r) && !roomNames.includes(r));
    return [...roomNames, ...new Set(extra)];
  }, [filtered, groupBy, roomNames]);

  const lessons: SchedLesson[] = useMemo(() => {
    // Jadvalga tushish sharti — eskisidagi (ustun topilsin, vaqti 06:00–22:00 setkasiga tushsin);
    // joylashuv esa aniq daqiqada (eskisida 30 daqiqaga yaxlitlanardi).
    const raw: { group: Group; start: number; end: number; col: number }[] = [];
    for (const g of filtered) {
      const col = columnKeys.indexOf(groupBy === "teacher" ? g.teacher : g.room);
      if (col < 0) continue;
      if (parseTimeRange(g.time).startSlot < 0) continue;
      const m = parseMinutes(g.time);
      if (!m) continue;
      raw.push({ group: g, start: m.start, end: m.end, col });
    }
    const out: SchedLesson[] = [];
    for (let c = 0; c < columnKeys.length; c++) {
      const inCol = raw.filter((r) => r.col === c);
      if (inCol.length === 0) continue;
      for (const { slot, lane, lanes, clash } of layoutDay(inCol.map((r) => ({ group: r.group, day: c, start: r.start, end: r.end })))) {
        out.push({ key: `${slot.group.id}-${c}-${slot.start}`, group: slot.group, start: slot.start, end: slot.end, col: c, lane, lanes, clash });
      }
    }
    return out;
  }, [filtered, columnKeys, groupBy]);

  const columns: SchedColumn[] = useMemo(() => {
    const capByName = new Map(rooms.map((r) => [r.name, r.capacity]));
    return columnKeys.map((k, i) => ({
      key: k,
      label: k,
      capacity: groupBy === "room" ? (capByName.get(k) ?? null) || null : null,
      count: lessons.filter((l) => l.col === i).length,
    }));
  }, [columnKeys, lessons, rooms, groupBy]);

  const range = useMemo(() => {
    if (lessons.length === 0) return null;
    // Setka shu kundagi darslar oralig'ida (eskisida doim 06:00–22:00 — bo'sh soatlar ko'p edi).
    const from = Math.max(0, Math.floor(Math.min(...lessons.map((l) => l.start)) / 60));
    const to = Math.min(24, Math.ceil(Math.max(...lessons.map((l) => l.end)) / 60));
    return { from, to: Math.max(to, from + 1) };
  }, [lessons]);

  const unplaced = filtered.length - new Set(lessons.map((l) => l.group.id)).size;
  const clashCount = new Set(lessons.filter((l) => l.clash).map((l) => l.group.id)).size;
  const pupils = filtered.reduce((s, g) => s + (Number(g.students) || 0), 0);
  const busyCols = columns.filter((c) => c.count > 0).length;
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const dayLong = t(SCHEDULE_DAY_LONG[dayIdx] || day);

  // Tanlangan qiymat boshqa kunda ro'yxatda bo'lmasa ham chip'da ko'rinsin.
  const withCurrent = (list: string[], v: string) => (v && !list.includes(v) ? [v, ...list] : list).map((x) => ({ value: x, label: x }));
  const setFilter = (k: keyof Filters) => (v: string) => setFilters((f) => ({ ...f, [k]: v }));

  function exportCSV() {
    const headers = ["Guruh", "Kurs", "Kun", "Vaqt", "Xona", "O'qituvchi", "O'quvchilar"];
    const rows = filtered.map((g) => [g.name, g.course, g.day, g.time, g.room, g.teacher, g.students]);
    const csv = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `dars-jadvali-${SCHEDULE_DAY_LONG[dayIdx] || day}.csv`);
    showSuccess(t("CSV yuklab olindi — {filtered} ta", { filtered: filtered.length }));
  }

  const loading = groups === null && !failed;

  /* ---------------- Bo'laklar ---------------- */

  const dayTabs = (
    <div role="tablist" aria-label={t("Hafta kunlari")} className="flex flex-wrap items-center gap-1.5">
      {WEEK.map((i) => {
        const d = SCHEDULE_DAY_ORDER[i];
        const on = d === day;
        const n = dayCounts[d] ?? 0;
        const today = todayIdx === i;
        return (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={on}
            title={`${t(SCHEDULE_DAY_LONG[i])}${today ? ` · ${t("bugun")}` : ""}`}
            onClick={() => setPicked(d)}
            className={`relative inline-flex h-8 items-center gap-1.5 rounded-v2-full border px-3 text-v2-small font-medium transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
              on ? "border-v2-brand bg-v2-brand-bg text-v2-brand-text" : "border-v2-border-strong bg-v2-surface text-v2-text hover:bg-v2-surface-2"
            }`}
          >
            {weekdaysShort[i] ?? SCHEDULE_DAY_LABELS[i]}
            {groups && <span className={`tabular-nums ${on ? "" : n ? "text-v2-text-3" : "text-v2-text-3 opacity-60"}`}>{n}</span>}
            {today && <span className="absolute -top-0.5 right-1 size-1.5 rounded-full bg-v2-danger" aria-hidden />}
          </button>
        );
      })}
    </div>
  );

  const switches = (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentSwitch<GroupBy>
        label={t("Ustunlar")}
        value={groupBy}
        onChange={setGroupBy}
        options={[
          { value: "room", label: t("Xona bo'yicha"), icon: DoorOpen },
          { value: "teacher", label: t("O'qituvchi bo'yicha"), icon: User },
        ]}
      />
      <SegmentSwitch<View>
        label={t("Ko'rinish")}
        value={view}
        onChange={setViewPicked}
        options={[
          { value: "grid", label: t("Ustunlar"), icon: LayoutGrid },
          { value: "row", label: t("Qatorlar"), icon: Rows3 },
          { value: "list", label: t("Ro'yxat"), icon: List },
        ]}
      />
    </div>
  );

  const filterRow = (
    <div className="flex flex-wrap items-center gap-2">
      <V2Select variant="chip" label={t("O'qituvchi")} value={filters.teacher} onChange={setFilter("teacher")} options={withCurrent(filterOptions.teachers, filters.teacher)} searchable="auto" />
      <V2Select variant="chip" label={t("Kurs")} value={filters.course} onChange={setFilter("course")} options={withCurrent(courseNames, filters.course)} searchable="auto" />
      <V2Select variant="chip" label={t("Xona")} value={filters.room} onChange={setFilter("room")} options={withCurrent(filterOptions.rooms, filters.room)} searchable="auto" />
      <V2Select variant="chip" label={t("Kun turi")} value={filters.dayType} onChange={setFilter("dayType")} options={withCurrent(dayTypeOptions, filters.dayType)} searchable="auto" />
      {activeFilterCount > 0 && (
        <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="inline-flex h-9 items-center gap-1 rounded-v2-md px-2 text-v2-small text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text">
          <X className="size-3.5" strokeWidth={2} aria-hidden />
          {t("Tozalash")}
        </button>
      )}
    </div>
  );

  const summary = (
    <SummaryLine
      items={[
        <span key="d">
          {dayLong}
          {isToday ? ` · ${t("bugun")}` : ""}
        </span>,
        <span key="n">
          <B>{groups ? filtered.length : "—"}</B> {t("ta dars")}
        </span>,
        <span key="p">
          <B>{groups ? pupils : "—"}</B> {t("o'quvchi")}
        </span>,
        groups && (
          <span key="c">
            {groupBy === "room" ? t("{n} ta xona band", { n: busyCols }) : t("{n} ta o'qituvchi", { n: busyCols })}
          </span>
        ),
        clashCount > 0 && (
          <span key="x" className="inline-flex items-center gap-1 font-medium text-v2-warning">
            <AlertTriangle className="size-3.5" strokeWidth={2} aria-hidden />
            {t("{n} ta guruh vaqti kesishadi", { n: clashCount })}
          </span>
        ),
      ]}
    />
  );

  let body: ReactNode;
  if (loading) {
    body = (
      <div className="space-y-3 p-4" aria-hidden>
        <div className="flex gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-9 flex-1 rounded-v2-md bg-v2-skeleton" />
          ))}
        </div>
        <div className="h-64 rounded-v2-md bg-v2-skeleton" />
      </div>
    );
  } else if (failed && !groups) {
    body = (
      <EmptyBox title={t("Ma'lumotni yuklab bo'lmadi")}>
        <button type="button" onClick={() => setVersion((v) => v + 1)} className={`${secondaryBtn} mt-2`}>
          <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Qayta urinish")}
        </button>
      </EmptyBox>
    );
  } else if (filtered.length === 0 || !range) {
    body = (
      <EmptyBox title={t("{day} kuni uchun dars topilmadi.", { day: dayLong })} hint={filtered.length > 0 ? t("Bu kundagi guruhlarning vaqti yoki xonasi kiritilmagan — jadvalga tushmadi.") : undefined}>
        {activeFilterCount > 0 && (
          <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className={`${secondaryBtn} mt-2`}>
            {t("Filtrlarni tozalash")}
          </button>
        )}
      </EmptyBox>
    );
  } else if (view === "list") {
    body = <ListView lessons={lessons} columns={columns} groupBy={groupBy} nowMin={isToday ? nowOfDay : null} />;
  } else if (view === "row") {
    body = <RowView columns={columns} lessons={lessons} range={range} groupBy={groupBy} onHover={onHover} nowMin={isToday ? nowOfDay : null} />;
  } else {
    body = <GridView columns={columns} lessons={lessons} range={range} groupBy={groupBy} onHover={onHover} nowMin={isToday ? nowOfDay : null} />;
  }

  const board = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {dayTabs}
        {switches}
      </div>
      {filterRow}
      {summary}
      <div className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm ${fullscreen ? "flex-1" : "lg:flex-1"}`}>
        <div className={`min-h-0 overflow-auto ${fullscreen ? "flex-1" : "max-h-[70vh] lg:max-h-none lg:flex-1"}`}>{body}</div>
        {!loading && groups && unplaced > 0 && (
          <div className="shrink-0 border-t border-v2-border px-4 py-2 text-v2-caption text-v2-text-2">
            {t("{n} ta guruhning vaqti yoki xonasi kiritilmagan — jadvalga tushmadi.", { n: unplaced })}
          </div>
        )}
      </div>
    </>
  );

  const exportBtn = (
    <button type="button" onClick={exportCSV} disabled={!groups} title={t("CSV faylini yuklab olish")} className={`${secondaryBtn} disabled:opacity-50`}>
      <Download className="size-4" strokeWidth={1.75} aria-hidden />
      {t("Yuklab olish")}
    </button>
  );

  return (
    <PageShell>
      <PageHead
        title={t("Dars jadvali")}
        subtitle={t("Guruhlar darslari kun bo'yicha — xona yoki o'qituvchi kesimida")}
        actions={
          <>
            {exportBtn}
            <button type="button" onClick={() => setFullscreen(true)} title={t("To'liq ekran")} aria-label={t("To'liq ekran")} className={secondaryIcon}>
              <Maximize2 className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
          </>
        }
      />

      {fullscreen
        ? createPortal(
            <div data-ui="v2" role="dialog" aria-modal="true" aria-label={t("Dars jadvali")} className="fixed inset-0 z-[95] flex flex-col gap-3 overflow-hidden bg-v2-surface p-3 font-v2 text-v2-text sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-v2-section text-v2-text">
                  {t("Dars jadvali")} · {dayLong}
                </h2>
                <div className="flex items-center gap-2">
                  {exportBtn}
                  <button type="button" onClick={() => setFullscreen(false)} className={secondaryBtn} autoFocus>
                    <Minimize2 className="size-4" strokeWidth={1.75} aria-hidden />
                    {t("Kichik xolatda ko'rish")}
                  </button>
                </div>
              </div>
              {board}
            </div>,
            document.body,
          )
        : board}

      {hovered && view !== "list" && (
        <LessonHoverCard key={hovered.lesson.key} lesson={hovered.lesson} rect={hovered.rect} onEnter={cancelClose} onLeave={() => onHover(null, null)} />
      )}
    </PageShell>
  );
}

function EmptyBox({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="p-5">
      <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
        <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
          <CalendarDays className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="text-v2-section text-v2-text">{title}</div>
        {hint && <p className="max-w-md text-v2-small text-v2-text-2">{hint}</p>}
        {children}
      </div>
    </div>
  );
}
