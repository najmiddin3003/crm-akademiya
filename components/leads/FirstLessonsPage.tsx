"use client";

import { useMemo, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import { COURSES, LEVELS, MODERATORS, STATUS_LABELS, STUDENTS, TEACHERS, WEEKDAYS } from "@/constants";

// Ported from crm-akademiya/index-dev.html lines 1129-1266 (id="view-first-lessons")
// + src/app.js (renderFirstLessons family, ~line 23283).
// Scope cuts (disclosed, not bugs):
// - the "Conversion dashboard" stat cards (fl-dashboard) and quick-filter tabs
//   (fl-quick-tabs) aren't ported — those depend on richer status-history data
//   we don't have yet.
// - the never-wired custom date-range popover is replaced with two native
//   date inputs (same treatment as Tasks/Orders).
// - the status pill and the row's 3-dot menu are display-only stubs (no
//   backend to persist a status change against yet).
// - there is no real backend, so the list always comes from the 50-item
//   STUDENTS array in constants/index.js. Pagination below is therefore
//   cosmetic: it shows up to 20 page buttons (matching the original's visual
//   footprint for a much larger dataset) but every page renders the same
//   (filtered) 50 records — this is the intended, temporary behavior until a
//   real API replaces constants/index.js.

const FAKE_PAGE_COUNT = 20;

function oddEvenOf(day: string): "toq" | "juft" | "boshqa" {
  if (day === "Dushanba" || day === "Chorshanba" || day === "Juma") return "toq";
  if (day === "Seshanba" || day === "Payshanba" || day === "Shanba") return "juft";
  return "boshqa";
}

export default function FirstLessonsPage() {
  const [dateFilter, setDateFilter] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [oddEvenFilter, setOddEvenFilter] = useState("");
  const [moderatorFilter, setModeratorFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return STUDENTS.filter((s) => {
      if (courseFilter && s.course !== courseFilter) return false;
      if (levelFilter && s.level !== levelFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      if (dayFilter && s.day !== dayFilter) return false;
      if (oddEvenFilter && oddEvenOf(s.day) !== oddEvenFilter) return false;
      if (moderatorFilter && s.moderator !== moderatorFilter) return false;
      if (teacherFilter && s.teacher !== teacherFilter) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.phone.includes(q) && String(s.id).includes(q) === false) return false;
      return true;
    });
  }, [courseFilter, levelFilter, statusFilter, dayFilter, oddEvenFilter, moderatorFilter, teacherFilter, search]);

  const fakeTotalItems = pageSize * FAKE_PAGE_COUNT;

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Birinchi darsga yozilganlar</h1>
      </div>

      {/* Filter row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <span className="text-muted-foreground text-sm">—</span>
          <input
            type="date"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="relative">
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Kurs</option>
            {COURSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Daraja</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Status bo&apos;yicha</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        <div className="relative">
          <select
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            className="w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Kun</option>
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <select
            value={oddEvenFilter}
            onChange={(e) => setOddEvenFilter(e.target.value)}
            className="w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Toq/Juft kunlar</option>
            <option value="toq">Toq kunlar (Du-Ch-Ju)</option>
            <option value="juft">Juft kunlar (Se-Pa-Sh)</option>
            <option value="boshqa">Boshqa kunlar (Yakshanba)</option>
          </select>
        </div>
        <div className="relative">
          <select
            value={moderatorFilter}
            onChange={(e) => setModeratorFilter(e.target.value)}
            className="w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Moderator</option>
            {MODERATORS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <select
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            className="w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">O&apos;qituvchi</option>
            {TEACHERS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          type="text"
          placeholder="Qidirish (ism, telefon, ID)"
          className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Total count */}
      <div className="flex items-center justify-end">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">Umumiy soni:</span>
          <span className="font-bold tabular-nums">{filtered.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap w-8">
                  <input type="checkbox" className="rounded border-border" />
                </th>
                <th className="text-left px-3 py-3 whitespace-nowrap">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">ID</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;quvchini ismi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Telefon raqam</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Yaratilgan sanasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Birinchi dars guni</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;qituvchi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Kurs</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Kurs darajasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Moderator</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Status</th>
                <th className="text-right px-3 py-3 whitespace-nowrap" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                  <td className="px-3 py-3"><input type="checkbox" className="rounded border-border" /></td>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{i + 1}</td>
                  <td className="px-3 py-3 tabular-nums font-medium text-[13px]">{s.id}</td>
                  <td className="px-3 py-3 text-[13px]">
                    <span className="text-foreground">{s.name}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 rounded-md bg-white/60 text-xs font-medium tabular-nums">{s.phone}</span>
                  </td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground whitespace-nowrap tabular-nums">{s.created}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground whitespace-nowrap tabular-nums">{s.firstLesson}</td>
                  <td className="px-3 py-3 text-[13px]">{s.teacher || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{s.course || "—"}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{s.level || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{s.moderator || "—"}</td>
                  <td className="px-3 py-3">
                    <span className={`fl-status fl-status-${s.status}`}>{STATUS_LABELS[s.status as keyof typeof STATUS_LABELS]}</span>
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <button type="button" className="fl-row-actions-btn" title="Amallar">⋮</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          totalItems={fakeTotalItems}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </div>
    </div>
  );
}
