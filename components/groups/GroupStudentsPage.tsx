"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import EmployeeToggle from "@/components/employees/EmployeeToggle";
import { createInitialOrders } from "@/lib/ordersData";
import { GROUP_SEED } from "@/constants/groups";

// Guruh → Guruh o'quvchilari (crm-akademiya #view-groups-students, sidebar:
// Guruh > Guruh o'quvchilari, href /groups-students). Har bir qator — bitta
// buyurtma (createInitialOrders(), 502 ta) qaysidir guruhga (GROUP_SEED)
// deterministik biriktirilgan holda; shu sababli ism ustiga bosilganda
// /student-edit/[id] (mavjud profil sahifasi) har doim topiladi — chunki id
// aynan shu createInitialOrders() massividan olingan.

type StudentStatus = "active" | "new" | "frozen";

interface StudentRow {
  id: number;
  name: string;
  groupId: number;
  teacher: string;
  status: StudentStatus;
  created: string;
}

const STATUS_OPTIONS: { value: StudentStatus; label: string }[] = [
  { value: "active", label: "Aktiv" },
  { value: "new", label: "Yangi" },
  { value: "frozen", label: "Muzlatilgan" },
];
const STATUS_LABEL: Record<StudentStatus, string> = { active: "active", new: "new", frozen: "frozen" };
const STATUS_CLS: Record<StudentStatus, string> = {
  active: "text-emerald-600",
  new: "text-blue-600",
  frozen: "text-cyan-600",
};

function buildStudentRows(): StudentRow[] {
  const orders = createInitialOrders();
  return orders.map((o, i) => {
    const group = GROUP_SEED[i % GROUP_SEED.length];
    const status: StudentStatus = i % 13 === 0 ? "frozen" : o.isNew || i % 5 === 1 ? "new" : "active";
    return { id: o.id, name: o.name, groupId: group.id, teacher: group.teacher, status, created: o.created };
  });
}

// "20.05.2026 | 17:54" → Date
function parseCreated(s: string): Date | null {
  const m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

const selectCls = "h-9 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function GroupStudentsPage() {
  const [rows] = useState<StudentRow[]>(() => buildStudentRows());

  const [frozenOnly, setFrozenOnly] = useState(false);
  const [teacher, setTeacher] = useState("");
  const [status, setStatus] = useState<StudentStatus | "">("");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const teacherOptions = useMemo(() => [...new Set(rows.map((r) => r.teacher).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (frozenOnly && r.status !== "frozen") return false;
      if (teacher && r.teacher !== teacher) return false;
      if (status && r.status !== status) return false;
      if (dateRange.start || dateRange.end) {
        const dt = parseCreated(r.created);
        if (!dt) return false;
        if (dateRange.start && dt < dateRange.start) return false;
        if (dateRange.end) {
          const end = new Date(dateRange.end);
          end.setHours(23, 59, 59, 999);
          if (dt > end) return false;
        }
      }
      return true;
    });
  }, [rows, frozenOnly, teacher, status, dateRange]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      {/* Filtr qatori */}
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <EmployeeToggle checked={frozenOnly} onChange={resetPage(setFrozenOnly)} label="Muzlatilgan" />

        <div className="relative">
          <select value={teacher} onChange={(e) => resetPage(setTeacher)(e.target.value)} className={`${selectCls} w-44`}>
            <option value="">O&apos;qituvchi</option>
            {teacherOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>

        <div className="relative">
          <select value={status} onChange={(e) => resetPage(setStatus)(e.target.value as StudentStatus | "")} className={`${selectCls} w-40`}>
            <option value="">Guruh holati</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>

        <DateRangePicker value={dateRange} onChange={resetPage(setDateRange)} placeholder="Oraliqni tanlang" />
      </div>

      <div className="flex items-center justify-end">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">Umumiy soni:</span>
          <span className="font-bold tabular-nums">{filtered.length.toLocaleString("ru-RU").replace(/,/g, " ")}</span>
        </div>
      </div>

      {/* Jadval */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">ID</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Ism</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Guruhlar</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;qituvchi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Holati</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r, i) => (
                <tr key={r.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  <td className="px-3 py-3 tabular-nums text-[13px] text-muted-foreground">{r.id}</td>
                  <td className="px-3 py-3 text-[13px]">
                    <Link href={`/student-edit/${r.id}`} className="font-medium hover:text-primary hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{r.groupId}</td>
                  <td className="px-3 py-3 text-[13px]">{r.teacher || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">
                    <span className={`font-medium ${STATUS_CLS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">O&apos;quvchi topilmadi</td>
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
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
    </div>
  );
}
