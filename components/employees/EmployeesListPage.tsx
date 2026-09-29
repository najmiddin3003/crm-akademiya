"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/ui/Link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Filter, LayoutGrid, List, MoreVertical, Plus, Settings } from "lucide-react";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import AddEmployeeModal from "./AddEmployeeModal";
import EmployeeToggle from "./EmployeeToggle";
import EmployeeTaxModal from "./EmployeeTaxModal";
import EmployeePlastikModal from "./EmployeePlastikModal";
import { groupNumber } from "@/components/ui/MoneyInput";
import type { HrEmployeeFull } from "./employeeExtras";
import type { Group } from "@/lib/groups";
import { payrollDue, payrollEarned, payrollPeriod, type EmployeePayroll, type SalaryType } from "@/lib/salary";
import {
  EMP_COLUMNS,
  EMP_LEAVE_REASONS,
  EMP_ROLES,
  EMP_STATES,
  GENDER_LABELS,
  ROLE_LABELS,
} from "@/constants/employees";
import Select from "@/components/ui/Select";
import { useT } from "@/components/shared/Language";

// Boshqaruv → Xodimlar ro'yxati (crm-akademiya #view-management-xodimlar).
// Toolbar ikonkalari (Sozlash / Filtr / 3-nuqta) Lidlar → Buyurtmalar ro'yxati
// sahifasidagi kabi lucide + Button (variant="outline") bilan. Ma'lumot
// HAQIQIY — /api/hr-employees (MongoDB `hr_employees`). Demo seed YO'Q:
// xodim qo'shilmagan bo'lsa ro'yxat bo'sh turadi. Ism ustiga bosilsa xodim
// profiliga o'tadi.

const inputCls = "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

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
  "name", "gender", "aktivOq", "groups", "turi", "ishTuri", "filial", "phone", "kurs",
  "created", "archReason", "archDate", "soliq", "plastik",
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
  salaryType: SalaryType;
  percent: number;
  fixedSalary: number;
  jamiOylik: number;
  jamiAvans: number;
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
    qolganOylik: payrollDue(row, p),
  };
}

/** Arxivdagi xodimda o'chirilgan tugmachalar ustidagi izoh. */
const ARCHIVED_HINT = "Xodim arxivda — oylik hisoblanmaydi, soliq va plastik ta'sir qilmaydi";

/** Sozlanmagan xodim uchun bir xil ko'rinish — hamma ustunda. */
function NotConfigured() {
  const { t } = useT();
  return <span className="text-[12px] text-muted-foreground" title={t("Xodim kartasida ish haqi kiritilmagan")}>{t("Sozlanmagan")}</span>;
}

export default function EmployeesListPage() {
  const { t } = useT();
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
  // Soliq turlarini tanlash oynasi ochilgan xodim.
  const [taxTarget, setTaxTarget] = useState<HrEmployeeFull | null>(null);
  // Plastik oylik summasini kiritish oynasi ochilgan xodim.
  const [plastikTarget, setPlastikTarget] = useState<HrEmployeeFull | null>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  // Ustun saralash: bo'sh `sortKey` — saralanmagan (bazadan kelgan tartib).
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [importing, setImporting] = useState(false);

  const [rows, setRows] = useState<HrEmployeeFull[]>([]);
  // Guruhlar — "Guruhlar" va "Aktiv o'quvchilar soni" ustunlari SHU YERDAN
  // hisoblanadi. `hr_employees` hujjatidagi `groups`/`aktivOq` maydonlari
  // xodim yaratilganda 0 qilib yoziladi va HECH QACHON yangilanmaydi
  // (app/api/hr-employees/route.ts), ya'ni ular guruhga biriktirilgan
  // o'qituvchida ham 0 bo'lib qolaverardi — jadval "bu o'qituvchining
  // guruhi yo'q" deb yolg'on da'vo qilardi.
  const [groups, setGroups] = useState<Group[]>([]);
  const [payrollById, setPayrollById] = useState<Map<number, EmployeePayroll>>(new Map());
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
      fetch("/api/groups").then((r) => r.json()).catch(() => null),
    ])
      .then(([emps, pay, grps]) => {
        if (cancelled) return;
        if (emps?.ok) setRows(emps.employees);
        if (pay?.ok) {
          setPayrollById(new Map((pay.employees as EmployeePayroll[]).map((e) => [e.id, e])));
        }
        if (grps?.ok) setGroups(grps.groups as Group[]);
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

  // Xodim ISMI bo'yicha guruhlari va ulardagi o'quvchilar soni. Bog'lanish
  // ismga tayanadi, chunki `groups` hujjatida `teacherId` yo'q — faqat
  // `teacher` satri (app/api/hr-employees/[id]/students/route.ts da ham
  // xuddi shu zanjir). O'quvchilar takrorsiz sanaladi: bitta o'quvchi
  // xodimning bir nechta guruhida bo'lishi mumkin.
  const groupStatsByName = useMemo(() => {
    const acc = new Map<string, { groups: number; pupils: Set<number> }>();
    for (const g of groups) {
      const key = String(g.teacher ?? "").trim().toLowerCase();
      if (!key) continue;
      let entry = acc.get(key);
      if (!entry) {
        entry = { groups: 0, pupils: new Set<number>() };
        acc.set(key, entry);
      }
      entry.groups += 1;
      for (const id of g.studentIds ?? []) entry.pupils.add(id);
    }
    return new Map(
      [...acc].map(([key, v]) => [key, { groups: v.groups, students: v.pupils.size }]),
    );
  }, [groups]);

  const statsOf = (e: HrEmployeeFull) =>
    groupStatsByName.get(e.name.trim().toLowerCase()) ?? { groups: 0, students: 0 };

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
        case "aktivOq": return statsOf(e).students;
        case "groups": return statsOf(e).groups;
        // `e.turi` bo'sh satr bo'lishi mumkin (import qilingan yoki vazifasi
        // tanlanmagan xodim). `?? e.turi` bunda "" qaytarardi — bu null EMAS,
        // shuning uchun qiymatsiz qatorlar oxirida emas, BOSHIDA turib
        // qolardi. `|| null` bo'sh satrni ham "qiymat yo'q" deb sanaydi,
        // ya'ni qolgan matnli ustunlar bilan bir xil qoida.
        case "turi": return ROLE_LABELS[e.turi as keyof typeof ROLE_LABELS] ?? (e.turi || null);
        case "filial": return (e.filial || "").toLowerCase() || null;
        case "phone": return e.phone || null;
        case "kurs": return (e.kurs || "").toLowerCase() || null;
        // Soliq — mantiqiy ustun; yoqilganlar bir joyga to'planishi uchun
        // 1/0 sifatida saralanadi.
        case "soliq": return (e.taxIds ?? []).length;
        // Plastik — summa bo'yicha. Biriktirilmagan xodim `null` beradi va
        // matnli ustunlar bilan bir xil qoidada oxirda turadi.
        case "plastik": return e.plastikSalary ?? null;
        case "created": return dateVal(e.created);
        case "archDate": return dateVal(e.archDate);
        case "archReason": return (e.archReason || "").toLowerCase() || null;
        default: {
          const s = salaryFor(e, period, payrollById);
          if (!s) return null;
          if (sortKey === "ishTuri") {
            if (s.salaryType === "mixed") return `Oklad+ ${String(s.percent).padStart(3, "0")}`;
            return s.salaryType === "foiz" ? `Foiz ${String(s.percent).padStart(3, "0")}` : "Oklad";
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir, period, payrollById]);

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
    return sorted.map((e, i) => [i + 1, e.name, GENDER_LABELS[e.gender as keyof typeof GENDER_LABELS], statsOf(e).students, statsOf(e).groups, ROLE_LABELS[e.turi as keyof typeof ROLE_LABELS] ?? e.turi, e.filial, e.phone, e.kurs, e.created]);
  }

  // Import — eksport bilan bir xil ustunlar (eksport → tahrir → import).
  // Ilgari bu tugma faqat "Import funksiyasi (demo)" toast'ini chiqarardi.
  // Naqsh components/groups/GroupsListPage.tsx dan olingan.
  async function importCsv(file: File) {
    setImporting(true);
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.length < 2) {
        showError(t("Faylda sarlavhadan boshqa qator yo'q"));
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
        showError(t(data.error || "Import qilinmadi"));
        return;
      }
      const fresh = await fetch("/api/hr-employees").then((r) => r.json()).catch(() => null);
      if (fresh?.ok) setRows(fresh.employees);
      const skipped = (data.skipped as { reason: string }[]).length;
      showSuccess(
        skipped > 0
          ? t("{created} ta xodim qo'shildi, {skipped} tasi o'tkazib yuborildi", { created: data.created, skipped })
          : t("{created} ta xodim qo'shildi", { created: data.created }),
      );
    } catch {
      showError(t("Faylni o'qib bo'lmadi"));
    } finally {
      setImporting(false);
    }
  }
  function exportCSV() {
    const csv = [EXPORT_HEADERS, ...exportRows()].map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "xodimlar.csv");
    showSuccess(t("CSV yuklab olindi — {filtered} ta yozuv", { filtered: filtered.length }));
    setMoreOpen(false);
  }
  function exportExcel() {
    const head = "<tr>" + EXPORT_HEADERS.map((h) => `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`).join("") + "</tr>";
    const body = exportRows().map((r) => "<tr>" + r.map((v) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;">${v}</td>`).join("") + "</tr>").join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${head}</thead><tbody>${body}</tbody></table></body></html>`;
    downloadBlob(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), "xodimlar.xls");
    showSuccess(t("Excel yuklab olindi — {filtered} ta yozuv", { filtered: filtered.length }));
    setMoreOpen(false);
  }

  /**
   * Xodimga biriktirilgan soliq turlarini saqlaydi.
   *
   * Optimistik: qator darhol yangilanadi, so'rov muvaffaqiyatsiz bo'lsa
   * eski holatga qaytariladi va xato ko'rsatiladi — aks holda foydalanuvchi
   * yoqilgan deb o'ylab qolardi.
   */
  async function saveTaxIds(e: HrEmployeeFull, next: number[]) {
    const before = e.taxIds ?? [];
    setRows((prev) => prev.map((r) => (r.id === e.id ? { ...r, taxIds: next } : r)));
    try {
      const res = await fetch(`/api/hr-employees/${e.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxIds: next }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Saqlanmadi");
      showSuccess(
        next.length > 0
          ? t("{name} — {next} ta soliq turi biriktirildi", { name: e.name, next: next.length })
          : t("{name} — soliq o'chirildi", { name: e.name }),
      );
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === e.id ? { ...r, taxIds: before } : r)));
      showError(err instanceof Error ? err.message : "Saqlanmadi");
    }
  }

  /**
   * Tugmacha bosilganda: O'CHIQ bo'lsa qaysi soliq turlari qo'llanishini
   * SO'RAYMIZ, yoqilgan bo'lsa darhol o'chiramiz. Turlarni keyin
   * o'zgartirish uchun tugmacha yonidagi izohga bosiladi.
   */
  function onTaxToggle(e: HrEmployeeFull, next: boolean) {
    if (next) setTaxTarget(e);
    else saveTaxIds(e, []);
  }

  /**
   * Plastik oylik summasini saqlaydi. `saveTaxIds` bilan bir xil naqsh:
   * optimistik yangilash, xatoda orqaga qaytarish.
   *
   * `null` — biriktirilmagan. 0 YOZILMAYDI: unda xodimda plastik solig'i
   * bor-u summasi yo'q holat paydo bo'lardi va soliq jimgina 0 ga tushardi.
   */
  async function savePlastikSalary(e: HrEmployeeFull, next: number | null) {
    const before = e.plastikSalary ?? null;
    setRows((prev) => prev.map((r) => (r.id === e.id ? { ...r, plastikSalary: next } : r)));
    setPlastikTarget(null);
    try {
      const res = await fetch(`/api/hr-employees/${e.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plastikSalary: next }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Saqlanmadi");
      showSuccess(
        next != null
          ? t("{name} — plastik oylik {next} so'm", { name: e.name, next: groupNumber(next) })
          : t("{name} — plastik oylik olib tashlandi", { name: e.name }),
      );
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === e.id ? { ...r, plastikSalary: before } : r)));
      showError(err instanceof Error ? err.message : "Saqlanmadi");
    }
  }

  /** Tugmacha: yoqilsa summa so'raladi, o'chirilsa darhol olib tashlanadi. */
  function onPlastikToggle(e: HrEmployeeFull, next: boolean) {
    if (next) setPlastikTarget(e);
    else savePlastikSalary(e, null);
  }

  function renderCell(e: HrEmployeeFull, colId: string, i: number) {
    // ARXIVDAGI XODIM — soliq va plastik tugmachalari o'chiriladi.
    //
    // Arxivlangan xodim oylik hisobiga UMUMAN kirmaydi
    // (lib/payrollSources.ts → loadPayrollRefs `archReason` bo'yicha
    // kesadi), ya'ni unga soliq yoki plastik biriktirish hech qanday
    // natija bermaydi — faqat "biriktirilgan" degan yolg'on ko'rinish
    // qoladi. Mavjud qiymat o'chirilmaydi, shunchaki tahrirlab
    // bo'lmaydigan qilib ko'rsatiladi: xodim arxivdan qaytarilsa
    // sozlamasi joyida turadi.
    const archived = Boolean(e.archReason);
    switch (colId) {
      case "num": return <span className="text-muted-foreground tabular-nums">{start + i + 1}</span>;
      case "name": return (
        <Link href={`/management-xodimlar/${e.id}`} onClick={(ev) => ev.stopPropagation()} className="font-semibold text-amber-600 hover:text-amber-700 hover:underline">
          {e.name}
        </Link>
      );
      case "gender": return <span className="text-[13px] text-muted-foreground">{GENDER_LABELS[e.gender as keyof typeof GENDER_LABELS]}</span>;
      case "aktivOq": return <span className="tabular-nums">{statsOf(e).students}</span>;
      case "groups": return <span className="tabular-nums">{statsOf(e).groups}</span>;
      case "turi": {
        const turiBadge = e.turi === "teacher"
          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
          : e.turi === "moderator"
          ? "bg-sky-500/10 text-sky-600 border-sky-500/20"
          : "bg-violet-500/10 text-violet-600 border-violet-500/20";
        return (
          <span className={`inline-flex items-center h-6 px-2 rounded-md border text-[11px] font-medium ${turiBadge} whitespace-nowrap`}>
            {t(e.turi)}
          </span>
        );
      }
      case "ishTuri": {
        // ARXIVDAGI XODIM — "Sozlanmagan" EMAS.
        //
        // Arxivlangan xodim oylik hisobiga umuman kirmaydi
        // (lib/payrollSources.ts → loadPayrollRefs `archReason` bo'yicha
        // kesadi), shu sabab uning oylik qatori topilmaydi. Ilgari bu
        // "Sozlanmagan" deb ko'rsatilardi — go'yo xodim kartasi
        // to'ldirilmagandek. Aslida sozlama joyida, u shunchaki ishdan
        // ketgan va oylik olmaydi.
        if (e.archReason) {
          return (
            <span
              className="inline-flex items-center h-6 px-2 rounded-md border text-[11px] font-medium bg-rose-500/10 text-rose-600 border-rose-500/20 whitespace-nowrap"
              title={t("Arxivlangan: {archReason} — oylik hisoblanmaydi", { archReason: e.archReason })}
            >
              {t("Arxivda")}
            </span>
          );
        }
        const s = salaryFor(e, period, payrollById);
        if (!s) return <NotConfigured />;
        const isFoiz = s.salaryType === "foiz";
        const isMixed = s.salaryType === "mixed";
        const cls = isMixed
          ? "bg-violet-500/10 text-violet-600 border-violet-500/20"
          : isFoiz
            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
            : "bg-sky-500/10 text-sky-600 border-sky-500/20";
        return (
          <span className={`inline-flex items-center h-6 px-2 rounded-md border text-[11px] font-medium ${cls} whitespace-nowrap`}>
            {isMixed
              ? t("Oklad + {percent}%", { percent: s.percent })
              : isFoiz ? t("Foiz {percent}%", { percent: s.percent }) : "Oklad"}
          </span>
        );
      }
      // Soliq tugmachasi. Bosilishi bilan bazaga yoziladi (PATCH), lekin
      // ekranda DARHOL o'zgaradi — javobni kutib turish tugmachani
      // "tormozlab" ko'rsatardi. Xato bo'lsa holat orqaga qaytariladi.
      //
      // stopPropagation SHART: qatorning o'zida `onClick` bor va u xodim
      // profiliga o'tkazadi. Usiz tugmachani bosgan odam soliqni yoqib,
      // ayni paytda boshqa sahifaga uchib ketardi — natijani ko'rolmasdi.
      case "soliq": {
        const count = (e.taxIds ?? []).length;
        return (
          <span
            className="inline-flex flex-col items-start gap-0.5"
            onClick={(ev) => ev.stopPropagation()}
            // Klaviatura bilan (Enter/Bo'shliq) bosilganda ham qator
            // hodisasi ishga tushmasin.
            onKeyDown={(ev) => ev.stopPropagation()}
          >
            <EmployeeToggle
              checked={count > 0}
              onChange={(v) => onTaxToggle(e, v)}
              disabled={archived}
              title={archived ? ARCHIVED_HINT : undefined}
            />
            {count > 0 && !archived && (
              // Biriktirilgan turlarni KEYIN o'zgartirish yo'li: tugmachani
              // bosish uni o'chiradi, shuning uchun tahrirlash shu yerda.
              <button
                type="button"
                onClick={() => setTaxTarget(e)}
                className="text-[11px] text-primary hover:underline whitespace-nowrap"
                title={t("Soliq turlarini o'zgartirish")}
              >
                {count} ta tur
              </button>
            )}
            {count > 0 && archived && (
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">{count} ta tur</span>
            )}
          </span>
        );
      }
      // Plastik tugmachasi — soliqniki bilan aynan bir xil naqsh
      // (stopPropagation, optimistik yozish, izohga bosib tahrirlash).
      case "plastik": {
        const amount = e.plastikSalary ?? null;
        return (
          <span
            className="inline-flex flex-col items-start gap-0.5"
            onClick={(ev) => ev.stopPropagation()}
            onKeyDown={(ev) => ev.stopPropagation()}
          >
            <EmployeeToggle
              checked={amount != null}
              onChange={(v) => onPlastikToggle(e, v)}
              disabled={archived}
              title={archived ? ARCHIVED_HINT : undefined}
            />
            {amount != null && !archived && (
              <button
                type="button"
                onClick={() => setPlastikTarget(e)}
                className="text-[11px] text-primary hover:underline whitespace-nowrap tabular-nums"
                title={t("Plastik oylik summasini o'zgartirish")}
              >
                {groupNumber(amount)}
              </button>
            )}
            {amount != null && archived && (
              <span className="text-[11px] text-muted-foreground whitespace-nowrap tabular-nums">{groupNumber(amount)}</span>
            )}
          </span>
        );
      }
      case "filial": return e.filial;
      case "phone": return <span className="tabular-nums text-[13px]">{e.phone}</span>;
      case "kurs": return <span className="text-[13px]">{e.kurs || "-"}</span>;
      case "created": return <span className="tabular-nums text-[12px] text-muted-foreground">{e.created}</span>;
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
          {t("Xodim qo'shish")}
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
              title={t("Ro'yxat ko'rinishi")}
              onClick={() => setViewMode("list")}
              className={`h-full w-10 inline-flex items-center justify-center ${viewMode === "list" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              title={t("Karta ko'rinishi")}
              onClick={() => setViewMode("grid")}
              className={`h-full w-10 inline-flex items-center justify-center border-l border-border ${viewMode === "grid" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <div className="relative" ref={settingsRef}>
            <Button variant="outline" lucideIcon={Settings} title={t("Sozlash")} onClick={() => { setSettingsOpen((o) => !o); setMoreOpen(false); }} />
            {settingsOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card shadow-xl p-3 z-30">
                <div className="text-[13px] font-semibold mb-2">{t("Ustunlar")}</div>
                <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                  {EMP_COLUMNS.filter((c) => c.id !== "num").map((c) => (
                    <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary cursor-pointer">
                      <input type="checkbox" checked={!hiddenCols.has(c.id)} onChange={() => toggleCol(c.id)} className="w-4 h-4 rounded border-border accent-primary" />
                      <span className="text-[13px]">{t(c.label)}</span>
                    </label>
                  ))}
                </div>
                <button onClick={() => { setHiddenCols(new Set()); setSettingsOpen(false); }} className="w-full mt-2 h-9 px-3 rounded-md hover:bg-secondary text-[13px] text-primary font-medium">
                  {t("Standartga qaytarish")}
                </button>
              </div>
            )}
          </div>
          <Button variant="outline" lucideIcon={Filter} title={t("Filtrlar")} onClick={() => setFiltersOpen((o) => !o)} />
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
            <Button variant="outline" lucideIcon={MoreVertical} title={t("Ko'proq")} onClick={() => { setMoreOpen((o) => !o); setSettingsOpen(false); }} />
            {moreOpen && (
              <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-border bg-card shadow-xl p-1 z-30">
                <button
                  onClick={() => { fileRef.current?.click(); setMoreOpen(false); }}
                  disabled={importing}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left disabled:opacity-60"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">IN</span>
                  <span>{importing ? t("Import qilinmoqda…") : t("Import (CSV)")}</span>
                </button>
                <button onClick={exportCSV} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 text-[9px] font-bold text-blue-700">CSV</span>
                  <span>{t("CSV faylini yuklab olish")}</span>
                </button>
                <button onClick={exportExcel} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-[9px] font-bold text-emerald-700">XLS</span>
                  <span>{t("EXCEL faylini yuklab olish")}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter grid */}
      {filtersOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} type="text" placeholder={t("Qidiruv")} className={inputCls} />
          <Select value={stateFilter} onChange={(v) => { setStateFilter(v); setPage(1); }} options={EMP_STATES.map((s) => ({ value: s.value, label: s.label }))} placeholder={t("Holat")} clearable />
          <DateRangePicker
            value={activeDateRange}
            onChange={(r) => { setActiveDateRange(r); setPage(1); }}
            placeholder={t("Faollik sanasi")}
            className="w-full"
          />
          <DateRangePicker
            value={leaveDateRange}
            onChange={(r) => { setLeaveDateRange(r); setPage(1); }}
            placeholder={t("Ketish sanasi")}
            className="w-full"
          />
          <Select value={roleFilter} onChange={(v) => { setRoleFilter(v); setPage(1); }} options={EMP_ROLES.map((r) => ({ value: r.value, label: r.label }))} placeholder={t("Rol")} clearable />
          <Select value={courseFilter} onChange={(v) => { setCourseFilter(v); setPage(1); }} options={courseNames.map((c) => ({ value: c, label: c }))} placeholder={t("Kurs")} clearable />
          <Select value={reasonFilter} onChange={(v) => { setReasonFilter(v); setPage(1); }} options={EMP_LEAVE_REASONS.map((r) => ({ value: r, label: r }))} placeholder={t("Ketish sababi")} clearable />
        </div>
      )}

      {/* Table / grid card */}
      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>{t("Umumiy soni:")}</span>
            <span className="tabular-nums">{filtered.length}</span>
          </div>
        </div>
        {viewMode === "list" ? (
          <div className="table-scroll">
            <table className="emp-list-table w-full text-sm min-w-[1700px]">
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
                            title={active ? (sortDir === "asc" ? t("O'sish bo'yicha — bosing: kamayish") : t("Kamayish bo'yicha — bosing: bekor qilish")) : "Saralash"}
                            className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground ${active ? "text-primary" : ""}`}
                          >
                            {t(c.label)}
                            {active && sortDir === "desc"
                              ? <ArrowUp className="h-3 w-3" />
                              : <ArrowDown className={`h-3 w-3 ${active ? "" : "opacity-30"}`} />}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1">{t(c.label)}</span>
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
                    // Hover, kursor va ARXIV foni — app/globals.css dagi
                    // `.emp-list-table` qoidalarida (sabab o'sha izohda).
                    className={e.archReason ? "is-archived" : undefined}
                    title={e.archReason ? t("Arxivlangan: {archReason} — oylik hisoblanmaydi", { archReason: e.archReason }) : undefined}
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
                          {t(e.turi)}
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
                              <div className="text-muted-foreground">{t("Ish turi")}</div>
                              <div className="font-medium">
                                {s.salaryType === "mixed"
                                  ? t("Oklad + {percent}%", { percent: s.percent })
                                  : s.salaryType === "foiz" ? `Foiz ${s.percent}%` : "Oklad"}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">{t("Jami oylik")}</div>
                              <div className="font-semibold text-amber-600 tabular-nums">{fmtNum(s.jamiOylik)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">{t("Jami avans")}</div>
                              <div className="font-medium text-amber-600 tabular-nums">{fmtNum(s.jamiAvans)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">{t("Qolgan")}</div>
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

      {taxTarget && (
        <EmployeeTaxModal
          employeeName={taxTarget.name}
          selected={taxTarget.taxIds ?? []}
          onClose={() => setTaxTarget(null)}
          onSave={async (nextIds) => {
            await saveTaxIds(taxTarget, nextIds);
            setTaxTarget(null);
          }}
        />
      )}

      {plastikTarget && (
        <EmployeePlastikModal
          employeeName={plastikTarget.name}
          current={plastikTarget.plastikSalary ?? null}
          onClose={() => setPlastikTarget(null)}
          onSave={(next) => savePlastikSalary(plastikTarget, next)}
        />
      )}
    </div>
  );
}
