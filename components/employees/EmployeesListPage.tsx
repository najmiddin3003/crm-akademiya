"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Filter, LayoutGrid, List, MoreVertical, Plus, Settings } from "lucide-react";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import AddEmployeeModal from "./AddEmployeeModal";
import type { HrEmployeeFull } from "./employeeExtras";
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
// HAQIQIY — /api/hr-employees (MongoDB `hr_employees`). Demo seed YO'Q:
// xodim qo'shilmagan bo'lsa ro'yxat bo'sh turadi. Ism ustiga bosilsa xodim
// profiliga o'tadi.

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
/**
 * CSV matnini qatorlarga ajratadi — eksport yozgan qoidalar bo'yicha
 * (qo'shtirnoq ichidagi vergul/yangi qator ajratmaydi, "" bitta qo'shtirnoq).
 * components/groups/GroupsListPage.tsx dagi bilan bir xil, chunki import
 * ham aynan shu sahifaning eksportini qaytarib o'qishi kerak.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  // BOM eksport tomonidan qo'shiladi — olib tashlanmasa birinchi ustun buziladi.
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}
/** "1998-04-17" → "17.04.1998" (jadvalda qolgan sanalar bilan bir xil ko'rinish). */
function fmtBirthDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}
/** Manbasi yo'q katak — 0 emas, chunki 0 ham da'vo bo'lardi. */
function Dash() {
  return <span className="text-muted-foreground">—</span>;
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
// Eksportdagi ustun tartibi = importda o'qiladigan indekslar. "№",
// "Aktiv o'quvchilar" va "Guruhlar" import qilinmaydi (backend izohiga qarang).
const IMPORT_IDX = { name: 1, gender: 2, turi: 5, filial: 6, phone: 7, kurs: 8, created: 9 };

// Saralanadigan ustunlar. Bu ro'yxat constants/employees.js dagi `sortable`
// bayrog'idan MUSTAQIL: u yerda faqat bitta ustun belgilangan edi va hech
// qayerda o'qilmasdi (strelka chizilardi, bosilganda hech narsa bo'lmasdi).
// "№" saralanmaydi — u qator raqami, ya'ni tartibning O'ZI.
const SORTABLE = new Set([
  "name", "gender", "aktivOq", "groups", "turi", "ishTuri", "jamiOylik", "jamiAvans",
  "tolanganOylik", "qolganOylik", "filial", "phone", "kurs", "lavozim", "birthDate",
  "salaryCalc", "created", "lastActive", "archReason", "archDate",
]);
type SortDir = "asc" | "desc";

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
  emp: HrEmployeeFull,
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
  const { showSuccess, showError } = useToast();
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
  // Ustun saralash: bo'sh `sortKey` — saralanmagan (bazadan kelgan tartib).
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [importing, setImporting] = useState(false);

  const [rows, setRows] = useState<HrEmployeeFull[]>([]);
  const [payrollById, setPayrollById] = useState<Map<number, EmployeePayroll>>(new Map());
  // Rol nomlari — "Lavozim" ustuni uchun (xodimda faqat roleId saqlanadi).
  const [roleNameById, setRoleNameById] = useState<Map<number, string>>(new Map());
  const [loadingRows, setLoadingRows] = useState(true);

  const period = useMemo(() => payrollPeriod(), []);

  const settingsRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Xodimlar ro'yxati va ularning oylik qatorlari — ikkalasi ham backend'dan.
  // Oylik hisobi shu sahifada TAKRORLANMAYDI: u /api/salary-runs/
  // employees-payroll dan keladi, shunda Oylik chiqarish sahifasi bilan
  // bir xil raqam chiqadi.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/hr-employees").then((r) => r.json()).catch(() => null),
      fetch("/api/salary-runs/employees-payroll").then((r) => r.json()).catch(() => null),
      fetch("/api/roles").then((r) => r.json()).catch(() => null),
    ])
      .then(([emps, pay, rls]) => {
        if (cancelled) return;
        if (emps?.ok) setRows(emps.employees);
        if (pay?.ok) {
          setPayrollById(new Map((pay.employees as EmployeePayroll[]).map((e) => [e.id, e])));
        }
        if (rls?.ok) {
          setRoleNameById(new Map((rls.roles as { id: number; name: string }[]).map((r) => [r.id, r.name])));
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

  /** Xodimga biriktirilgan rol nomlari (filiallar bo'yicha, takrorsiz). */
  function roleNamesOf(e: HrEmployeeFull): string[] {
    return [...new Set(
      (e.branchAssignments ?? [])
        .map((b) => (b.roleId != null ? roleNameById.get(b.roleId) : undefined))
        .filter((n): n is string => Boolean(n)),
    )];
  }

  // Ustun bo'yicha saralash. Ilgari sarlavhalarda strelka chizilardi, lekin
  // na holat, na taqqoslagich, na onClick bor edi — ya'ni bezak edi.
  // Qiymati yo'q qatorlar ("Sozlanmagan", bo'sh sana) HAR DOIM oxirida
  // turadi, aks holda ular haqiqiy eng kichik qiymatdek ko'rinardi.
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;

    const dateVal = (s: string) => parseStoredDate(s || "")?.getTime() ?? null;
    const value = (e: HrEmployeeFull): string | number | null => {
      switch (sortKey) {
        case "name": return e.name.toLowerCase();
        case "gender": return GENDER_LABELS[e.gender as keyof typeof GENDER_LABELS] ?? null;
        case "aktivOq": return e.aktivOq;
        case "groups": return e.groups;
        // `e.turi` bo'sh satr bo'lishi mumkin (import qilingan yoki vazifasi
        // tanlanmagan xodim). `?? e.turi` bunda "" qaytarardi — bu null EMAS,
        // shuning uchun qiymatsiz qatorlar oxirida emas, BOSHIDA turib
        // qolardi. `|| null` bo'sh satrni ham "qiymat yo'q" deb sanaydi,
        // ya'ni qolgan matnli ustunlar bilan bir xil qoida.
        case "turi": return ROLE_LABELS[e.turi as keyof typeof ROLE_LABELS] ?? (e.turi || null);
        case "filial": return (e.filial || "").toLowerCase() || null;
        case "phone": return e.phone || null;
        case "kurs": return (e.kurs || "").toLowerCase() || null;
        case "lavozim": return roleNamesOf(e).join(", ").toLowerCase() || null;
        case "birthDate": return e.birthDate || null; // ISO — leksikografik tartib = xronologik
        case "salaryCalc": return e.payroll === undefined ? null : Number(e.payroll);
        case "created": return dateVal(e.created);
        case "lastActive": return dateVal(e.lastActive);
        case "archDate": return dateVal(e.archDate);
        case "archReason": return (e.archReason || "").toLowerCase() || null;
        default: {
          const s = salaryFor(e, period, payrollById);
          if (!s) return null;
          if (sortKey === "ishTuri") return s.salaryType === "foiz" ? `Foiz ${String(s.percent).padStart(3, "0")}` : "Oklad";
          if (sortKey === "jamiOylik") return s.jamiOylik;
          if (sortKey === "jamiAvans") return s.jamiAvans;
          if (sortKey === "tolanganOylik") return s.tolanganOylik;
          if (sortKey === "qolganOylik") return s.qolganOylik;
          return null;
        }
      }
    };

    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "uz") * dir;
    });
    // roleNamesOf faqat roleNameById dan bog'liq — shuning uchun deps'da o'sha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir, period, payrollById, roleNameById]);

  /** Sarlavhaga bosish: o'sish → kamayish → saralashsiz. */
  function toggleSort(colId: string) {
    setPage(1);
    if (sortKey !== colId) { setSortKey(colId); setSortDir("asc"); return; }
    if (sortDir === "asc") { setSortDir("desc"); return; }
    setSortKey("");
  }

  const start = (page - 1) * pageSize;
  const slice = sorted.slice(start, start + pageSize);
  const visibleCols = EMP_COLUMNS.filter((c) => !hiddenCols.has(c.id));

  function toggleCol(id: string) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Eksport ekrandagi TARTIBDA chiqadi — saralab, keyin yuklab olish
  // kutilgan natijani bersin.
  function exportRows() {
    return sorted.map((e, i) => [i + 1, e.name, GENDER_LABELS[e.gender as keyof typeof GENDER_LABELS], e.aktivOq, e.groups, ROLE_LABELS[e.turi as keyof typeof ROLE_LABELS] ?? e.turi, e.filial, e.phone, e.kurs, e.created]);
  }

  // Import — eksport bilan bir xil ustunlar (eksport → tahrir → import).
  // Ilgari bu tugma faqat "Import funksiyasi (demo)" toast'ini chiqarardi.
  // Naqsh components/groups/GroupsListPage.tsx dan olingan.
  async function importCsv(file: File) {
    setImporting(true);
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.length < 2) {
        showError("Faylda sarlavhadan boshqa qator yo'q");
        return;
      }
      const body = parsed.slice(1).map((r) => ({
        name: r[IMPORT_IDX.name],
        gender: r[IMPORT_IDX.gender],
        turi: r[IMPORT_IDX.turi],
        filial: r[IMPORT_IDX.filial],
        phone: r[IMPORT_IDX.phone],
        kurs: r[IMPORT_IDX.kurs],
        created: r[IMPORT_IDX.created],
      }));
      const res = await fetch("/api/hr-employees/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employees: body }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Import qilinmadi");
        return;
      }
      const fresh = await fetch("/api/hr-employees").then((r) => r.json()).catch(() => null);
      if (fresh?.ok) setRows(fresh.employees);
      const skipped = (data.skipped as { reason: string }[]).length;
      showSuccess(
        skipped > 0
          ? `${data.created} ta xodim qo'shildi, ${skipped} tasi o'tkazib yuborildi`
          : `${data.created} ta xodim qo'shildi`,
      );
    } catch {
      showError("Faylni o'qib bo'lmadi");
    } finally {
      setImporting(false);
    }
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

  function renderCell(e: HrEmployeeFull, colId: string, i: number) {
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
      case "lavozim": {
        // "Lavozim" = xodimga biriktirilgan ROL (Boshqaruv → Rollar). Xodim
        // hujjatida faqat `branchAssignments[].roleId` bor, shuning uchun
        // nomi /api/roles dan olinadi. Rol biriktirilmagan bo'lsa — "—".
        const names = roleNamesOf(e);
        return names.length ? <span className="text-[13px]">{names.join(", ")}</span> : <Dash />;
      }
      case "birthDate":
        // Xodim qo'shish modalidagi "Tug'ilgan sanasi". Eski hujjatlarda bu
        // maydon yo'q — bunday xodimda "—" turadi.
        return e.birthDate ? <span className="tabular-nums text-[13px]">{fmtBirthDate(e.birthDate)}</span> : <Dash />;
      case "salaryCalc": {
        // "Maosh hisoblanadi" = modaldagi "Ish haqi chiqarish" toggle'i.
        // undefined ("hech qachon so'ralmagan") bilan false ("yo'q deb
        // belgilangan") ni ajratamiz — "Yo'q" ham da'vo bo'lardi.
        //
        // "Ha" / "Yo'q" ham DA'VO edi, va u YOLG'ON edi: bu bayroqni hech kim
        // o'qimaydi — lib/payrollSources.ts dagi buildPayrollRows()
        // `hr_employees` ni filtrsiz oladi va `payroll` maydoniga umuman
        // qaramaydi, ya'ni Oylik chiqarish sahifasi belgidan qat'i nazar
        // HAMMANI hisoblaydi. Shu bois ustun endi tizim xulqi haqida emas,
        // SAQLANGAN TANLOV haqida gapiradi.
        if (e.payroll === undefined) return <Dash />;
        return (
          <span
            className="text-[13px] text-muted-foreground"
            title="Xodim kartasidagi saqlangan tanlov. Oylik chiqarish hozircha bu belgini o'qimaydi — hisobga barcha xodimlar kiradi."
          >
            {e.payroll ? "Belgilangan" : "Belgilanmagan"}
          </span>
        );
      }
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
        {/* "Ishga qabul / bo'shatish" va "HR davomat / ta'til" tugmalari OLIB
            TASHLANDI: ikkalasi ham faqat "(demo)" toast chiqarardi, ortida esa
            butun boshli HR quyi tizimi kerak (buyruqlar, ta'til balansi, ish
            kunlari kalendari) — bunday narsani soxta qilib qo'yish yolg'on
            bo'lardi. Xodimni arxivlash/qaytarish profil sahifasida ishlaydi. */}
        <div className="flex items-center gap-2">
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
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                // Bir xil faylni ketma-ket ikki marta tanlash mumkin bo'lsin.
                e.target.value = "";
                if (f) importCsv(f);
              }}
            />
            <Button variant="outline" lucideIcon={MoreVertical} title="Ko'proq" onClick={() => { setMoreOpen((o) => !o); setSettingsOpen(false); }} />
            {moreOpen && (
              <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-border bg-card shadow-xl p-1 z-30">
                <button
                  onClick={() => { fileRef.current?.click(); setMoreOpen(false); }}
                  disabled={importing}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left disabled:opacity-60"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">IN</span>
                  <span>{importing ? "Import qilinmoqda…" : "Import (CSV)"}</span>
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
                  {visibleCols.map((c) => {
                    const canSort = SORTABLE.has(c.id);
                    const active = sortKey === c.id;
                    return (
                      <th key={c.id} className="px-3 py-3 text-left whitespace-nowrap">
                        {canSort ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(c.id)}
                            title={active ? (sortDir === "asc" ? "O'sish bo'yicha — bosing: kamayish" : "Kamayish bo'yicha — bosing: bekor qilish") : "Saralash"}
                            className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground ${active ? "text-primary" : ""}`}
                          >
                            {c.label}
                            {active && sortDir === "desc"
                              ? <ArrowUp className="h-3 w-3" />
                              : <ArrowDown className={`h-3 w-3 ${active ? "" : "opacity-30"}`} />}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1">{c.label}</span>
                        )}
                      </th>
                    );
                  })}
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
