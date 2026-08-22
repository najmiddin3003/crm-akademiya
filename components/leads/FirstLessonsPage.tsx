"use client";

import { useEffect, useMemo, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import { useTeachers } from "@/hooks/useTeachers";
import type { Order } from "@/lib/ordersData";

// Ported from crm-akademiya/index-dev.html lines 1129-1266 (id="view-first-lessons")
// + src/app.js (renderFirstLessons family, ~line 23283).
//
// Ma'lumot manbai — HAQIQIY buyurtmalar (MongoDB `orders` → /api/orders):
// "birinchi darsga kelish sanasi" belgilangan buyurtmalar aynan shu sahifada
// ko'rinadi. Ilgari bu yerda constants/index.js dagi statik 50 ta demo
// o'quvchi turardi (va sahifalash ham soxta edi) — u olib tashlandi.
//
// Scope cuts (disclosed, not bugs):
// - the "Conversion dashboard" stat cards (fl-dashboard) and quick-filter tabs
//   (fl-quick-tabs) aren't ported — those depend on richer status-history data
//   we don't have yet.
// - the never-wired custom date-range popover is replaced with two native
//   date inputs (same treatment as Tasks/Orders).
// - the row's 3-dot menu is a display-only stub (no backend to persist a
//   status change against yet).

/** "29.08.2026 | 10:00" → "2026-08-29" (date inputlari bilan solishtirish uchun). */
function firstLessonIso(firstLesson: string): string {
  const m = (firstLesson || "").match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/** Buyurtmadagi dars kunlari naqshi ("Toq kunlar", "Du,Ch") bo'yicha. */
function oddEvenOf(day: string): "toq" | "juft" | "boshqa" {
  const d = (day || "").toLowerCase();
  if (d.includes("toq")) return "toq";
  if (d.includes("juft")) return "juft";
  return "boshqa";
}

const uniq = (values: (string | undefined)[]): string[] =>
  [...new Set(values.filter((v): v is string => Boolean(v)))].sort();

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

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/orders")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setOrders(d.orders); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Birinchi darsga YOZILGANLAR — sanasi belgilangan buyurtmalar.
  const rows = useMemo(() => orders.filter((o) => (o.firstLesson || "").trim()), [orders]);

  // Tanlov ro'yxatlari ma'lumotning o'zidan; o'qituvchilar esa bazadagi
  // to'liq ro'yxatdan (/api/teachers) — hali birorta darsi bo'lmagan
  // o'qituvchi ham tanlanishi mumkin.
  const { names: allTeachers } = useTeachers();
  const courseOptions = useMemo(() => uniq(rows.map((o) => o.course)), [rows]);
  const levelOptions = useMemo(() => uniq(rows.map((o) => o.level)), [rows]);
  const statusOptions = useMemo(() => uniq(rows.map((o) => o.status)), [rows]);
  const dayOptions = useMemo(() => uniq(rows.map((o) => o.lessonDay)), [rows]);
  const moderatorOptions = useMemo(() => uniq(rows.map((o) => o.moderator)), [rows]);
  const teacherOptions = useMemo(
    () => uniq([...allTeachers, ...rows.map((o) => o.teacher)]),
    [allTeachers, rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((o) => {
      const iso = firstLessonIso(o.firstLesson);
      if (dateFilter && iso !== dateFilter) return false;
      if (rangeStart && (!iso || iso < rangeStart)) return false;
      if (rangeEnd && (!iso || iso > rangeEnd)) return false;
      if (courseFilter && o.course !== courseFilter) return false;
      if (levelFilter && o.level !== levelFilter) return false;
      if (statusFilter && o.status !== statusFilter) return false;
      if (dayFilter && o.lessonDay !== dayFilter) return false;
      if (oddEvenFilter && oddEvenOf(o.lessonDay) !== oddEvenFilter) return false;
      if (moderatorFilter && o.moderator !== moderatorFilter) return false;
      if (teacherFilter && o.teacher !== teacherFilter) return false;
      if (q && !`${o.name} ${o.phone} ${o.id}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, dateFilter, rangeStart, rangeEnd, courseFilter, levelFilter, statusFilter, dayFilter, oddEvenFilter, moderatorFilter, teacherFilter, search]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

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
            {courseOptions.map((c) => (
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
            {levelOptions.map((l) => (
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
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
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
            {dayOptions.map((d) => (
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
            {moderatorOptions.map((m) => (
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
            {teacherOptions.map((t) => (
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
                <th className="text-left px-3 py-3 whitespace-nowrap">Birinchi darsga kelish sanasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;qituvchi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Kurs</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Kurs darajasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Moderator</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Status</th>
                {/* Referensda oxirgi ustun — "Izoh". Manbada bunday maydon yo'q
                    va referensda ham qatorlarda bo'sh turadi; ustun tuzilishi
                    mos bo'lishi uchun shu holicha ko'chirildi (README'dagi
                    "To'lov sanasi"/"Taklif qilganlari" bilan bir xil holat). */}
                <th className="text-left px-3 py-3 whitespace-nowrap">Izoh</th>
                <th className="text-right px-3 py-3 whitespace-nowrap" />
              </tr>
            </thead>
            <tbody>
              {slice.map((s, i) => (
                <tr key={s.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                  <td className="px-3 py-3"><input type="checkbox" className="rounded border-border" /></td>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
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
                    {s.status ? <span className="fl-status">{s.status}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{s.note || "—"}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <button type="button" className="fl-row-actions-btn" title="Amallar">⋮</button>
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {loading ? "Yuklanmoqda…" : "Birinchi darsga yozilgan o'quvchi yo'q"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          totalItems={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </div>
    </div>
  );
}
