"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, CalendarCheck, Filter, LayoutGrid, List, MoreVertical, Plus, Settings, UserCog } from "lucide-react";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import AddEmployeeModal from "./AddEmployeeModal";
import type { HrEmployee } from "@/lib/hrEmployees";
import { payrollDue, payrollEarned, payrollPeriod, type EmployeePayroll } from "@/lib/salary";
import {
  EMP_COLUMNS,
  EMP_LEAVE_REASONS,
  EMP_ROLES,
  EMP_STATES,
  GENDER_LABELS,
  ROLE_LABELS,
} from "@/constants/employees";

// Boshqaruv → Xodimlar ro'yxati (crm-akademiya #view-management-xodimlar).
// Toolbar ikonkalari (Sozlash / Filtr / 3-nuqta) Lidlar → Buyurtmalar ro'yxati
// sahifasidagi kabi lucide + Button (variant="outline") bilan. Ma'lumot
// HAQIQIY — /api/hr-employees (MongoDB `hr_employees`, bo'sh bo'lsa 49 ta
// demo yozuvdan seed qilinadi). Ism ustiga bosilsa xodim profiliga o'tadi.

const inputCls = "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const selectCls = "h-10 w-full appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

const EMPTY_RANGE: DateRange = { start: null, end: null };

// "DD.MM.YYYY | HH:mm" (yoki shunga o'xshash, faqat kun aniqligida kerak) →
// Date. created/lastActive/archDate uchun bir xil format ishlatiladi.
function parseStoredDate(s: string): Date | null {
  const m = s.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}
function inDateRange(d: Date | null, range: DateRange): boolean {
  if (!range.start && !range.end) return true;
  if (!d) return false;
  if (range.start && d < range.start) return false;
  if (range.end) {
    const endOfDay = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate(), 23, 59, 59, 999);
    if (d > endOfDay) return false;
  }
  return true;
}

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
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

const EXPORT_HEADERS = ["№", "To'liq nomi", "Jinsi", "Aktiv o'quvchilar", "Guruhlar", "Turi", "Filiallar", "Telefon raqam", "Kurs", "Yaratilgan sana"];

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}

// Oylik-komponentlar backend'dan (/api/salary-runs/employees-payroll)
// olinadi. Ilgari bu yerda alohida hisob bor edi va u xodim id'sidan
// hisoblanadigan demo generatorlarni ishlatardi — natijada bu ro'yxat
// bilan Oylik chiqarish sahifasi bir odam haqida turlicha raqam
// ko'rsatardi. Endi manba bitta.
//
// Oyligi sozlanmagan xodim uchun null qaytadi: bunday xodimda hisoblangan
// raqam yo'q, "0" esa yolg'on bo'lardi.
interface SalaryView {
  salaryType: "foiz" | "fixed";
  percent: number;
  fixedSalary: number;
  jamiOylik: number;
  jamiAvans: number;
  tolanganOylik: number;
  qolganOylik: number;
}

function salaryFor(
  emp: HrEmployee,
  p: ReturnType<typeof payrollPeriod>,
  payrollById: Map<number, EmployeePayroll>,
): SalaryView | null {
  const row = payrollById.get(emp.id);
  if (!row || !row.configured) return null;
  return {
    salaryType: row.salaryType,
    percent: row.percent,
    fixedSalary: row.fixedSalary,
    jamiOylik: payrollEarned(row, p),
    jamiAvans: row.paidAvans,
    tolanganOylik: row.paidOylik,
    qolganOylik: payrollDue(row, p),
  };
}

/** Sozlanmagan xodim uchun bir xil ko'rinish — hamma ustunda. */
function NotConfigured() {
  return <span className="text-[12px] text-muted-foreground" title="Xodim kartasida ish haqi kiritilmagan">Sozlanmagan</span>;
}

export default function EmployeesListPage() {
  const router = useRouter();
  const { showSuccess } = useToast();
  // Kurs filtri bazadan (ilgari constants'dagi uchinchi, boshqalariga mos
  // kelmaydigan EMP_COURSES ro'yxati edi).
  const { names: courseNames } = useOfflineCourseList();

  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");
  const [activeDateRange, setActiveDateRange] = useState<DateRange>(EMPTY_RANGE);
  const [leaveDateRange, setLeaveDateRange] = useState<DateRange>(EMPTY_RANGE);

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const [rows, setRows] = useState<HrEmployee[]>([]);
  const [payrollById, setPayrollById] = useState<Map<number, EmployeePayroll>>(new Map());
  const [loadingRows, setLoadingRows] = useState(true);

  const period = useMemo(() => payrollPeriod(), []);

  const settingsRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  // Xodimlar ro'yxati va ularning oylik qatorlari — ikkalasi ham backend'dan.
  // Oylik hisobi shu sahifada TAKRORLANMAYDI: u /api/salary-runs/
  // employees-payroll dan keladi, shunda Oylik chiqarish sahifasi bilan
  // bir xil raqam chiqadi.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/hr-employees").then((r) => r.json()).catch(() => null),
      fetch("/api/salary-runs/employees-payroll").then((r) => r.json()).catch(() => null),
    ])
      .then(([emps, pay]) => {
        if (cancelled) return;
        if (emps?.ok) setRows(emps.employees);
        if (pay?.ok) {
          setPayrollById(new Map((pay.employees as EmployeePayroll[]).map((e) => [e.id, e])));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRows(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen && !moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [settingsOpen, moreOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q) && !e.phone.includes(q) && !(e.kurs && e.kurs.toLowerCase().includes(q))) return false;
      if (roleFilter && e.turi !== roleFilter) return false;
      if (courseFilter && e.kurs !== courseFilter) return false;
      // Holat: archReason bo'lsa — arxiv, bo'lmasa — aktiv (alohida "holat"
      // maydoni yo'q, shu belgi orqali chiqarib olinadi).
      if (stateFilter === "active" && e.archReason) return false;
      if (stateFilter === "archive" && !e.archReason) return false;
      if (reasonFilter && e.archReason !== reasonFilter) return false;
      if (!inDateRange(parseStoredDate(e.lastActive), activeDateRange)) return false;
      if (!inDateRange(parseStoredDate(e.archDate || ""), leaveDateRange)) return false;
      return true;
    });
  }, [rows, search, roleFilter, courseFilter, stateFilter, reasonFilter, activeDateRange, leaveDateRange]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const visibleCols = EMP_COLUMNS.filter((c) => !hiddenCols.has(c.id));

  function toggleCol(id: string) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportRows() {
    return filtered.map((e, i) => [i + 1, e.name, GENDER_LABELS[e.gender as keyof typeof GENDER_LABELS], e.aktivOq, e.groups, ROLE_LABELS[e.turi as keyof typeof ROLE_LABELS] ?? e.turi, e.filial, e.phone, e.kurs, e.created]);
  }
  function exportCSV() {
    const csv = [EXPORT_HEADERS, ...exportRows()].map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "xodimlar.csv");
    showSuccess(`CSV yuklab olindi — ${filtered.length} ta yozuv`);
    setMoreOpen(false);
  }
  function exportExcel() {
    const head = "<tr>" + EXPORT_HEADERS.map((h) => `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`).join("") + "</tr>";
    const body = exportRows().map((r) => "<tr>" + r.map((v) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;">${v}</td>`).join("") + "</tr>").join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${head}</thead><tbody>${body}</tbody></table></body></html>`;
    downloadBlob(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), "xodimlar.xls");
    showSuccess(`Excel yuklab olindi — ${filtered.length} ta yozuv`);
    setMoreOpen(false);
  }

  function renderCell(e: HrEmployee, colId: string, i: number) {
    switch (colId) {
      case "num": return <span className="text-muted-foreground tabular-nums">{start + i + 1}</span>;
      case "name": return (
        <Link href={`/management-xodimlar/${e.id}`} onClick={(ev) => ev.stopPropagation()} className="font-semibold text-amber-600 hover:text-amber-700 hover:underline">
          {e.name}
        </Link>
      );
      case "gender": return <span className="text-[13px] text-muted-foreground">{GENDER_LABELS[e.gender as keyof typeof GENDER_LABELS]}</span>;
      case "aktivOq": return <span className="tabular-nums">{e.aktivOq}</span>;
      case "groups": return <span className="tabular-nums">{e.groups}</span>;
      case "turi": {
        const turiBadge = e.turi === "teacher"
          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
          : e.turi === "moderator"
          ? "bg-sky-500/10 text-sky-600 border-sky-500/20"
          : "bg-violet-500/10 text-violet-600 border-violet-500/20";
        return (
          <span className={`inline-flex items-center h-6 px-2 rounded-md border text-[11px] font-medium ${turiBadge} whitespace-nowrap`}>
            {e.turi}
          </span>
        );
      }
      case "ishTuri": {
        const s = salaryFor(e, period, payrollById);
        if (!s) return <NotConfigured />;
        const isFoiz = s.salaryType === "foiz";
        const cls = isFoiz
          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
          : "bg-sky-500/10 text-sky-600 border-sky-500/20";
        return (
          <span className={`inline-flex items-center h-6 px-2 rounded-md border text-[11px] font-medium ${cls} whitespace-nowrap`}>
            {isFoiz ? `Foiz ${s.percent}%` : "Oklad"}
          </span>
        );
      }
      case "jamiOylik": {
        const s = salaryFor(e, period, payrollById);
        if (!s) return <NotConfigured />;
        return s.jamiOylik > 0
          ? <span className="tabular-nums text-[13px] font-semibold text-amber-600">{fmtNum(s.jamiOylik)}</span>
          : <span className="tabular-nums text-muted-foreground">0</span>;
      }
      case "jamiAvans": {
        const s = salaryFor(e, period, payrollById);
        if (!s) return <NotConfigured />;
        return s.jamiAvans > 0
          ? <span className="tabular-nums text-[13px] font-medium text-amber-600">{fmtNum(s.jamiAvans)}</span>
          : <span className="tabular-nums text-muted-foreground">0</span>;
      }
      case "tolanganOylik": {
        const s = salaryFor(e, period, payrollById);
        if (!s) return <NotConfigured />;
        return s.tolanganOylik > 0
          ? <span className="tabular-nums text-[13px]">{fmtNum(s.tolanganOylik)}</span>
          : <span className="tabular-nums text-muted-foreground">0</span>;
      }
      case "qolganOylik": {
        const s = salaryFor(e, period, payrollById);
        if (!s) return <NotConfigured />;
        return s.qolganOylik !== 0
          ? <span className="tabular-nums text-[13px] font-semibold text-amber-600">{fmtNum(s.qolganOylik)}</span>
          : <span className="tabular-nums text-muted-foreground">0</span>;
      }
      case "filial": return e.filial;
      case "phone": return <span className="tabular-nums text-[13px]">{e.phone}</span>;
      case "kurs": return <span className="text-[13px]">{e.kurs || "-"}</span>;
      // Bu uch maydon demo yozuvlarda yo'q — constants/employees.js dagi
      // izohga qarang. Ustunlar referensga moslik uchun turadi.
      case "lavozim":
      case "birthDate":
      case "salaryCalc":
        return <span className="text-muted-foreground">-</span>;
      case "created": return <span className="tabular-nums text-[12px] text-muted-foreground">{e.created}</span>;
      case "lastActive": return <span className="tabular-nums text-[12px] text-muted-foreground">{e.lastActive || "-"}</span>;
      case "archReason": return <span className="text-muted-foreground">{e.archReason || "-"}</span>;
      case "archDate": return <span className="tabular-nums text-[12px] text-muted-foreground">{e.archDate || "-"}</span>;
      default: return null;
    }
  }

  return (
    <div className="page-frame container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      {/* i-list sprite Pagination "qator" ikonkasi uchun (global sprite'da yo'q) */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <symbol id="i-list" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></symbol>
        </defs>
      </svg>

      {/* Top action row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="primary" lucideIcon={Plus} onClick={() => setAddOpen(true)}>
          Xodim qo&apos;shish
        </Button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => showSuccess("Ishga qabul / bo'shatish (demo)")}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            <UserCog className="w-4 h-4 text-primary" />
            Ishga qabul / bo&apos;shatish
          </button>
          <button
            type="button"
            onClick={() => showSuccess("HR davomat / ta'til (demo)")}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            <CalendarCheck className="w-4 h-4 text-emerald-600" />
            HR davomat / ta&apos;til
          </button>
          <div className="inline-flex items-center h-10 rounded-lg border border-border bg-card overflow-hidden">
            <button
              type="button"
              title="Ro'yxat ko'rinishi"
              onClick={() => setViewMode("list")}
              className={`h-full w-10 inline-flex items-center justify-center ${viewMode === "list" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Karta ko'rinishi"
              onClick={() => setViewMode("grid")}
              className={`h-full w-10 inline-flex items-center justify-center border-l border-border ${viewMode === "grid" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <div className="relative" ref={settingsRef}>
            <Button variant="outline" lucideIcon={Settings} title="Sozlash" onClick={() => { setSettingsOpen((o) => !o); setMoreOpen(false); }} />
            {settingsOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card shadow-xl p-3 z-30">
                <div className="text-[13px] font-semibold mb-2">Ustunlar</div>
                <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                  {EMP_COLUMNS.filter((c) => c.id !== "num").map((c) => (
                    <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary cursor-pointer">
                      <input type="checkbox" checked={!hiddenCols.has(c.id)} onChange={() => toggleCol(c.id)} className="w-4 h-4 rounded border-border accent-primary" />
                      <span className="text-[13px]">{c.label}</span>
                    </label>
                  ))}
                </div>
                <button onClick={() => { setHiddenCols(new Set()); setSettingsOpen(false); }} className="w-full mt-2 h-9 px-3 rounded-md hover:bg-secondary text-[13px] text-primary font-medium">
                  Standartga qaytarish
                </button>
              </div>
            )}
          </div>
          <Button variant="outline" lucideIcon={Filter} title="Filtrlar" onClick={() => setFiltersOpen((o) => !o)} />
          <div className="relative" ref={moreRef}>
            <Button variant="outline" lucideIcon={MoreVertical} title="Ko'proq" onClick={() => { setMoreOpen((o) => !o); setSettingsOpen(false); }} />
            {moreOpen && (
              <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-border bg-card shadow-xl p-1 z-30">
                <button onClick={() => { showSuccess("Import funksiyasi (demo)"); setMoreOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">IN</span>
                  <span>Import</span>
                </button>
                <button onClick={exportCSV} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 text-[9px] font-bold text-blue-700">CSV</span>
                  <span>CSV faylini yuklab olish</span>
                </button>
                <button onClick={exportExcel} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-[9px] font-bold text-emerald-700">XLS</span>
                  <span>EXCEL faylini yuklab olish</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter grid */}
      {filtersOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} type="text" placeholder="Qidiruv" className={inputCls} />
          <div className="relative">
            <select value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">Holat</option>
              {EMP_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
          <DateRangePicker
            value={activeDateRange}
            onChange={(r) => { setActiveDateRange(r); setPage(1); }}
            placeholder="Faollik sanasi"
            className="w-full"
          />
          <DateRangePicker
            value={leaveDateRange}
            onChange={(r) => { setLeaveDateRange(r); setPage(1); }}
            placeholder="Ketish sanasi"
            className="w-full"
          />
          <div className="relative">
            <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">Rol</option>
              {EMP_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
          <div className="relative">
            <select value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">Kurs</option>
              {courseNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
          <div className="relative">
            <select value={reasonFilter} onChange={(e) => { setReasonFilter(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">Ketish sababi</option>
              {EMP_LEAVE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
        </div>
      )}

      {/* Table / grid card */}
      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{filtered.length}</span>
          </div>
        </div>
        {viewMode === "list" ? (
          <div className="table-scroll">
            <table className="w-full text-sm min-w-[1700px]">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  {visibleCols.map((c) => (
                    <th key={c.id} className="px-3 py-3 text-left whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {c.sortable && <ArrowDown className="h-3 w-3" />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {slice.map((e, i) => (
                  <tr
                    key={e.id}
                    onClick={() => router.push(`/management-xodimlar/${e.id}`)}
                    className="hover:bg-secondary/30 transition-colors cursor-pointer"
                  >
                    {visibleCols.map((c) => (
                      <td key={c.id} className="px-3 py-3 whitespace-nowrap">{renderCell(e, c.id, i)}</td>
                    ))}
                  </tr>
                ))}
                {slice.length === 0 && (
                  <tr>
                    <td colSpan={visibleCols.length} className="px-3 py-10 text-center text-sm text-muted-foreground">{loadingRows ? <SpinnerBlock size={22} /> : "Xodim topilmadi"}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4">
            {slice.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">{loadingRows ? <SpinnerBlock size={22} /> : "Xodim topilmadi"}</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {slice.map((e) => {
                  const s = salaryFor(e, period, payrollById);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => router.push(`/management-xodimlar/${e.id}`)}
                      className="text-left rounded-xl border border-border bg-card hover:bg-secondary/30 hover:border-primary/40 transition-colors p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-amber-600">{e.name}</div>
                        <span className={`inline-flex items-center h-5 px-2 rounded-md border text-[10.5px] font-medium ${e.turi === "teacher" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : e.turi === "moderator" ? "bg-sky-500/10 text-sky-600 border-sky-500/20" : "bg-violet-500/10 text-violet-600 border-violet-500/20"}`}>
                          {e.turi}
                        </span>
                      </div>
                      <div className="text-[12.5px] text-muted-foreground tabular-nums">{e.phone}</div>
                      <div className="text-[12.5px] text-muted-foreground mt-0.5">{e.kurs || "—"}</div>
                      <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-[12px]">
                        {!s ? (
                          <div className="col-span-2"><NotConfigured /></div>
                        ) : (
                          <>
                            <div>
                              <div className="text-muted-foreground">Ish turi</div>
                              <div className="font-medium">{s.salaryType === "foiz" ? `Foiz ${s.percent}%` : "Oklad"}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Jami oylik</div>
                              <div className="font-semibold text-amber-600 tabular-nums">{fmtNum(s.jamiOylik)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Jami avans</div>
                              <div className="font-medium text-amber-600 tabular-nums">{fmtNum(s.jamiAvans)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Qolgan</div>
                              <div className="font-semibold text-amber-600 tabular-nums">{fmtNum(s.qolganOylik)}</div>
                            </div>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <Pagination
          totalItems={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </div>

      {addOpen && (
        <AddEmployeeModal
          onClose={() => setAddOpen(false)}
          onCreated={(emp) => setRows((prev) => [emp, ...prev])}
        />
      )}
    </div>
  );
}
