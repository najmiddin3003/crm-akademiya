"use client";

import { useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, CreditCard, Download, FileSpreadsheet, MoreHorizontal, Pencil, Percent, Plus, Search, SquareArrowOutUpRight, Upload, UserPlus, Users, Wallet } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import AddEmployeeModal from "@/components/employees/AddEmployeeModal";
import EmployeeTaxModal from "@/components/employees/EmployeeTaxModal";
import EmployeePlastikModal from "@/components/employees/EmployeePlastikModal";
import type { HrEmployeeFull } from "@/components/employees/employeeExtras";
import { employeeExportRows, employeesCsvBlob, employeesXlsBlob, importEmployeesCsv, downloadBlob } from "@/components/employees/employeesExport";
import { salaryFor, useEmployeesCore } from "@/components/employees/useEmployeesCore";
import { employeeRoleLabel, useRoleNames } from "@/components/employees/useRoleNames";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import ColumnsControl from "@/components/v2/ui/ColumnsControl";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import V2Select, { type V2SelectOption } from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { DENSITY_CELL, DENSITY_ROW } from "@/components/v2/ui/columnPrefs";
import { ROW_TINT } from "@/components/v2/ui/table";
import { GENDER_LABELS, ROLE_LABELS } from "@/constants/employees";
import type { Group } from "@/lib/groups";
import { payrollHasOklad, payrollStartsInPeriod, type EmployeePayroll } from "@/lib/salary";
import { EmployeeAvatar, SALARY_TAG, fmtIsoDay, fmtSum, salaryTypeLabel } from "./employeeBits";
import { useEmployeeColumns, type EmployeeColumnKey, type EmployeeSortKey } from "./employeesColumns";

// YANGI VERSIYA — BOSHQARUV → XODIMLAR (rasm «Xodimlar», yorug'/qorong'i, 20.10.2026;
// andoza — O'quvchilar/Guruhlar ro'yxati):
//
//   1. «Xodimlar» + «Akademiya 3 Uychi · 4 ta xodim · oylik 1–12-oktabr bo'yicha»;
//      o'ngda «Ishga qabul (CV)» va «+ Xodim qo'shish» (va «⋯» — eski sahifadagi
//      Excel/CSV/import);
//   2. filtrlar: «Ism yoki telefon» → Lavozim, Hisoblash usuli, Holati → «Ustunlar»;
//   3. jadval: Xodim (bosh harflar) · Lavozim · Guruhlar («3 ta» + nomlari) · Hisoblash
//      usuli («Oklad + 30%», «01.10.2026 dan») · Jami oylik · Qolgan oylik · ⋯;
//      xodim shu filialda ishlaydi-yu oyligi BOSHQA filial ro'yxatida bo'lsa — ikkala
//      pul katagi o'rnida «⚠ Shu filial oylik ro'yxatida yo'q» (eski sahifada
//      «Sozlanmagan» edi — u boshqa narsa);
//   4. pastda «Jami · oylikdagi N xodim» va ikki yig'indi.
//
// Ma'lumot, oylik raqamlari va guruh soni — eski sahifa bilan BITTA yadrodan
// (components/employees/useEmployeesCore.ts; raqamlar Oylik chiqarish bilan bir xil
// manbada). Qo'shish/tahrir, soliq va plastik oynalari hozircha eski. Taxminlar:
// design/v2/SAVOLLAR.md 119–125.

type SalaryFilter = "" | "fixed" | "foiz" | "mixed" | "none" | "elsewhere";

interface SortState {
  key: EmployeeSortKey;
  dir: "asc" | "desc";
}

function nextSort(s: SortState | null, key: EmployeeSortKey): SortState | null {
  const first: SortState["dir"] = key === "name" ? "asc" : "desc";
  if (!s || s.key !== key) return { key, dir: first };
  if (s.dir === first) return { key, dir: first === "asc" ? "desc" : "asc" };
  return null;
}

/** "DD.MM.YYYY | HH:mm" → vaqt (saralash uchun); o'qib bo'lmasa null. */
function storedDateMs(s: string): number | null {
  const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(s || "");
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime() : null;
}

export default function EmployeesListV2() {
  const { t, months } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const branch = useBranch();
  const { showSuccess, showError } = useToast();
  const roleNames = useRoleNames();
  const { rows, setRows, groups, payrollById, payrollLoaded, loadingRows, period, statsOf } = useEmployeesCore();
  const columns = useEmployeeColumns();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [salaryFilter, setSalaryFilter] = useState<SalaryFilter>("");
  // Sukut — «Faol» (eski sahifadagi foydalanuvchi qarori, 04.10.2026: ro'yxat
  // ochilganda arxivdagilar aralashmasin); × — hammasi, «Arxivda» — faqat arxiv.
  const [stateFilter, setStateFilter] = useState("active");
  const [sort, setSort] = useState<SortState | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [addOpen, setAddOpen] = useState(false);
  const addFromUrl = useSearchParams().get("add") === "1";
  const [editFor, setEditFor] = useState<HrEmployeeFull | null>(null);
  const [taxFor, setTaxFor] = useState<HrEmployeeFull | null>(null);
  const [plastikFor, setPlastikFor] = useState<HrEmployeeFull | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const closeAdd = () => {
    setAddOpen(false);
    if (addFromUrl) router.replace(pathname, { scroll: false });
  };

  const roleOf = (e: HrEmployeeFull) => {
    const l = employeeRoleLabel(e, roleNames, ROLE_LABELS);
    return l ? t(l) : "";
  };

  // Xodim ISMI bo'yicha guruhlari (yadrodagi `statsOf` bilan bir xil bog'lanish — `groups.teacher`).
  const groupsByTeacher = useMemo(() => {
    const m = new Map<string, Group[]>();
    for (const g of groups) {
      const key = String(g.teacher ?? "").trim().toLowerCase();
      if (!key) continue;
      const list = m.get(key) ?? [];
      list.push(g);
      m.set(key, list);
    }
    return m;
  }, [groups]);
  const groupsOf = (e: HrEmployeeFull) => groupsByTeacher.get(e.name.trim().toLowerCase()) ?? [];

  /** Oylik holati: ro'yxatdagi qator, sozlanmagan, boshqa filial ro'yxatida yoki arxivda. */
  const payOf = (e: HrEmployeeFull): { kind: "row"; row: EmployeePayroll } | { kind: "none" | "elsewhere" | "archived" | "loading" } => {
    if (e.archReason) return { kind: "archived" };
    const row = payrollById.get(e.id);
    if (row) return row.configured ? { kind: "row", row } : { kind: "none" };
    return payrollLoaded ? { kind: "elsewhere" } : { kind: "loading" };
  };
  const salaryKind = (e: HrEmployeeFull): SalaryFilter => {
    const p = payOf(e);
    if (p.kind === "row") return p.row.salaryType;
    if (p.kind === "none") return "none";
    if (p.kind === "elsewhere") return "elsewhere";
    return "";
  };

  /* ---- Filtr va saralash ---- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return rows.filter((e) => {
      if (q) {
        const phone = (e.phone || "").replace(/\D/g, "");
        const hit = e.name.toLowerCase().includes(q) || (qDigits.length >= 3 && phone.includes(qDigits)) || (e.kurs || "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (stateFilter === "active" && e.archReason) return false;
      if (stateFilter === "archive" && !e.archReason) return false;
      if (roleFilter && roleOf(e) !== roleFilter) return false;
      if (salaryFilter && salaryKind(e) !== salaryFilter) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, stateFilter, roleFilter, salaryFilter, payrollById, payrollLoaded, roleNames]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    const value = (e: HrEmployeeFull): number | string | null => {
      const s = salaryFor(e, period, payrollById);
      switch (sort.key) {
        case "name":
          return e.name.toLowerCase();
        case "groups":
          return statsOf(e).groups;
        case "students":
          return statsOf(e).students;
        case "earned":
          return s ? s.jamiOylik : null;
        case "owed":
          return s ? s.qolganOylik : null;
        case "created":
          return storedDateMs(e.created);
      }
    };
    // Qiymati yo'q qatorlar (sozlanmagan, sana yo'q) HAR DOIM oxirida.
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
  }, [filtered, sort, period, payrollById, groups]);

  const start = (page - 1) * pageSize;
  const slice = sorted.slice(start, start + pageSize);

  // «Jami · oylikdagi N xodim» — filtrlangan ro'yxatdan, oyligi hisoblanadiganlar.
  const totals = useMemo(() => {
    let n = 0;
    let earned = 0;
    let owed = 0;
    for (const e of filtered) {
      const s = salaryFor(e, period, payrollById);
      if (!s) continue;
      n += 1;
      earned += s.jamiOylik;
      owed += s.qolganOylik;
    }
    return { n, earned, owed };
  }, [filtered, period, payrollById]);

  /* ---- Tanlovlar ---- */
  const roleOptions: V2SelectOption[] = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of rows) {
      const l = roleOf(e);
      if (l) m.set(l, (m.get(l) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "uz")).map(([l, n]) => ({ value: l, label: l, hint: String(n) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, roleNames]);
  const salaryOptions: V2SelectOption[] = [
    { value: "fixed", label: t("Oklad") },
    { value: "foiz", label: t("Foiz") },
    { value: "mixed", label: t("Oklad + foiz") },
    { value: "none", label: t("Sozlanmagan") },
    { value: "elsewhere", label: t("Boshqa filial oyligida") },
  ];
  const stateOptions: V2SelectOption[] = [
    { value: "active", label: t("Faol") },
    { value: "archive", label: t("Arxivda") },
  ];

  const branchName = (id: number | undefined) => (id ? (branch.branches.find((b) => b.id === id)?.name ?? "") : "");
  const currentBranch = branchName(branch.branchId ?? undefined);
  const periodLabel = t("oylik 1–{day}-{month} bo'yicha", { day: period.day, month: (months[period.month] ?? "").toLowerCase() });

  /* ---- Saqlash: soliq va plastik (eski sahifadagi bilan bir xil PATCH) ---- */
  async function patchEmployee(e: HrEmployeeFull, body: Partial<HrEmployeeFull>, okMsg: string) {
    const before = e;
    setRows((prev) => prev.map((r) => (r.id === e.id ? { ...r, ...body } : r)));
    try {
      const res = await fetch(`/api/hr-employees/${e.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Saqlanmadi");
      showSuccess(okMsg);
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === e.id ? before : r)));
      showError(t(err instanceof Error ? err.message : "Saqlanmadi"));
    }
  }

  /* ---- Eksport / import (eski sahifadagi — components/employees/employeesExport.ts) ---- */
  function exportFile(kind: "csv" | "xls") {
    const data = employeeExportRows(sorted, statsOf, (e) => employeeRoleLabel(e, roleNames, ROLE_LABELS) ?? "", GENDER_LABELS);
    downloadBlob(kind === "csv" ? employeesCsvBlob(data) : employeesXlsBlob(data), kind === "csv" ? "xodimlar.csv" : "xodimlar.xls");
    showSuccess(t(kind === "csv" ? "CSV yuklab olindi — {filtered} ta yozuv" : "Excel yuklab olindi — {filtered} ta yozuv", { filtered: sorted.length }));
  }
  async function importCsv(file: File) {
    setImporting(true);
    try {
      const r = await importEmployeesCsv(file);
      if (!r.ok) {
        showError(t(r.error));
        return;
      }
      const fresh = await fetch("/api/hr-employees").then((x) => x.json()).catch(() => null);
      if (fresh?.ok) setRows(fresh.employees);
      showSuccess(
        r.skipped > 0
          ? t("{created} ta xodim qo'shildi, {skipped} tasi o'tkazib yuborildi", { created: r.created, skipped: r.skipped })
          : t("{created} ta xodim qo'shildi", { created: r.created }),
      );
    } catch {
      showError(t("Faylni o'qib bo'lmadi"));
    } finally {
      setImporting(false);
    }
  }
  const pageMenu: ActionMenuEntry[] = [
    { key: "xls", label: t("Excel yuklab olish"), icon: FileSpreadsheet, hint: "XLS", onSelect: () => exportFile("xls") },
    { key: "csv", label: t("CSV yuklab olish"), icon: Download, hint: "CSV", onSelect: () => exportFile("csv") },
    { key: "d", divider: true },
    { key: "imp", label: importing ? t("Import qilinmoqda…") : t("CSV'dan import"), icon: Upload, disabled: importing, onSelect: () => fileRef.current?.click() },
  ];

  function rowMenu(e: HrEmployeeFull): ActionMenuEntry[] {
    const archived = Boolean(e.archReason);
    const off = archived ? t("Xodim arxivda — oylik hisoblanmaydi, soliq va plastik ta'sir qilmaydi") : undefined;
    return [
      { key: "h", heading: e.name },
      { key: "open", label: t("Profilni ochish"), icon: SquareArrowOutUpRight, href: `/management-xodimlar/${e.id}` },
      { key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: () => setEditFor(e) },
      { key: "pay", label: t("Oylik chiqarishda ochish"), icon: Wallet, href: "/finance-payroll" },
      { key: "d", divider: true },
      { key: "tax", label: t("Soliq turlari"), icon: Percent, hint: (e.taxIds ?? []).length ? String((e.taxIds ?? []).length) : undefined, disabled: archived, title: off, onSelect: () => setTaxFor(e) },
      {
        key: "plastik",
        label: t("Plastik oylik"),
        icon: CreditCard,
        hint: e.plastikSalary != null ? fmtSum(e.plastikSalary) : undefined,
        disabled: archived,
        title: off,
        onSelect: () => setPlastikFor(e),
      },
    ];
  }

  const visibleCols = columns.shown;
  const colCount = visibleCols.length + 2;
  const rowH = DENSITY_ROW[columns.density];
  const cellY = DENSITY_CELL[columns.density];
  const th = "sticky top-0 z-10 whitespace-nowrap bg-v2-surface-2 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";

  function sortHead(label: string, k: EmployeeSortKey, right = false) {
    const on = sort?.key === k;
    const Icon = on && sort?.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => {
          setSort((s) => nextSort(s, k));
          setPage(1);
        }}
        className={`inline-flex items-center gap-1 ${right ? "flex-row-reverse" : ""} ${on ? "text-v2-text" : ""} hover:text-v2-text`}
      >
        {label}
        <Icon className={`size-3.5 ${on ? "" : "opacity-0"}`} strokeWidth={2} aria-hidden />
      </button>
    );
  }

  const onRowClick = (ev: MouseEvent<HTMLTableRowElement>, id: number) => {
    if ((ev.target as HTMLElement).closest("button, a, input, label")) return;
    router.push(`/management-xodimlar/${id}`);
  };

  const dash = <span className="text-v2-text-3">—</span>;

  /** Pul katagi o'rnidagi holat (sozlanmagan / boshqa filialda / arxivda). */
  function payState(e: HrEmployeeFull, wide: boolean): ReactNode {
    const p = payOf(e);
    if (p.kind === "elsewhere") {
      const where = branchName(e.payrollBranchId);
      return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-v2-small font-medium text-v2-warning" title={where ? t("Oyligi «{branch}» ro'yxatida hisoblanadi", { branch: where }) : t("Oyligi boshqa filial ro'yxatida hisoblanadi")}>
          <AlertTriangle className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
          {wide ? t("Shu filial oylik ro'yxatida yo'q") : t("Boshqa filialda")}
        </span>
      );
    }
    if (p.kind === "none") {
      return (
        <Link href={`/management-xodimlar/${e.id}`} className="whitespace-nowrap text-v2-small font-medium text-v2-brand-text underline-offset-2 hover:underline" title={t("Xodim kartasida ish haqi kiritilmagan")}>
          {t("Ish haqi kiritilmagan — sozlash")}
        </Link>
      );
    }
    if (p.kind === "archived") {
      return (
        <span className="whitespace-nowrap text-v2-small text-v2-text-3" title={t("Arxivlangan: {archReason} — oylik hisoblanmaydi", { archReason: e.archReason })}>
          {t("Arxivda — oylik hisoblanmaydi")}
        </span>
      );
    }
    return <span className="inline-block h-3 w-16 rounded bg-v2-skeleton" aria-hidden />;
  }

  function cell(e: HrEmployeeFull, key: EmployeeColumnKey): ReactNode {
    const s = salaryFor(e, period, payrollById);
    const row = payrollById.get(e.id);
    switch (key) {
      case "employee":
        return null;
      case "role": {
        const l = roleOf(e);
        return l ? <span className="whitespace-nowrap text-v2-text-2">{l}</span> : dash;
      }
      case "groups": {
        const list = groupsOf(e);
        if (list.length === 0) return dash;
        const names = list.map((g) => (g.name || "").trim() || `#${g.id}`).join(", ");
        return (
          <div className="min-w-[140px] max-w-[260px]">
            <div className="font-semibold tabular-nums text-v2-text">{t("{n} ta", { n: list.length })}</div>
            <div className="truncate text-v2-caption font-normal text-v2-text-2" title={names}>
              {names}
            </div>
          </div>
        );
      }
      case "salaryType": {
        if (!row || !row.configured) return dash;
        const startDate = payrollHasOklad(row) && row.salaryStart && payrollStartsInPeriod(row, period) ? row.salaryStart : "";
        return (
          <div>
            <span className={SALARY_TAG}>{salaryTypeLabel(row, t)}</span>
            {startDate && <div className="mt-0.5 whitespace-nowrap text-v2-caption font-normal tabular-nums text-v2-text-3">{t("{date} dan", { date: fmtIsoDay(startDate) })}</div>}
          </div>
        );
      }
      case "earned":
        return s ? <span className="font-semibold tabular-nums text-v2-text">{fmtSum(s.jamiOylik)}</span> : payState(e, false);
      case "owed":
        if (!s) return payState(e, false);
        return (
          <div>
            <span className={`font-semibold tabular-nums ${s.qolganOylik < 0 ? "text-v2-danger" : "text-v2-text"}`}>{fmtSum(s.qolganOylik)}</span>
            {s.otganOylar > 0 && (
              <div className="whitespace-nowrap text-v2-caption font-normal tabular-nums text-v2-text-3" title={t("O'tgan oylarda to'lanmagan qoldiq joriy oyda chiqarilmaydi — o'z oyining Oylik sahifasidan chiqariladi")}>
                {t("o'tgan oylardan: {amount}", { amount: fmtSum(s.otganOylar) })}
              </div>
            )}
          </div>
        );
      case "phone":
        return e.phone ? <span className="whitespace-nowrap tabular-nums text-v2-text-2">{e.phone}</span> : dash;
      case "branch":
        return e.filial ? <span className="whitespace-nowrap text-v2-text-2">{e.filial}</span> : dash;
      case "kurs":
        return e.kurs ? <span className="whitespace-nowrap text-v2-text-2">{e.kurs}</span> : dash;
      case "students":
        return <span className="tabular-nums text-v2-text">{statsOf(e).students}</span>;
      case "avans":
        return s && s.jamiAvans > 0 ? <span className="font-medium tabular-nums text-v2-warning">{fmtSum(s.jamiAvans)}</span> : dash;
      case "tax": {
        const n = (e.taxIds ?? []).length;
        return n > 0 ? <span className="whitespace-nowrap text-v2-text-2">{t("{n} ta tur", { n })}</span> : dash;
      }
      case "plastik":
        return e.plastikSalary != null ? <span className="tabular-nums text-v2-text">{fmtSum(e.plastikSalary)}</span> : dash;
      case "created":
        return e.created ? <span className="whitespace-nowrap tabular-nums text-v2-text-2">{e.created.split("|")[0].trim()}</span> : dash;
      case "archReason":
        return e.archReason ? <span className="text-v2-text-2">{e.archReason}</span> : dash;
      case "archDate":
        return e.archDate ? <span className="whitespace-nowrap tabular-nums text-v2-text-2">{e.archDate.split("|")[0].trim()}</span> : dash;
    }
  }

  /** Qator kataklari: «Jami oylik» va «Qolgan oylik» yonma-yon bo'lsa, oylik yo'q xodimda ikkalasi bitta katak. */
  function rowCells(e: HrEmployeeFull): ReactNode[] {
    const out: ReactNode[] = [];
    const merge = !salaryFor(e, period, payrollById) && payOf(e).kind !== "loading";
    for (let i = 0; i < visibleCols.length; i++) {
      const c = visibleCols[i];
      const next = visibleCols[i + 1];
      if (merge && c.key === "earned" && next?.key === "owed") {
        out.push(
          <td key="pay" colSpan={2} className={`${cellY} px-2.5 text-right`}>
            {payState(e, true)}
          </td>,
        );
        i += 1;
        continue;
      }
      out.push(
        <td key={c.key} className={`${cellY} px-2.5 ${c.align === "right" ? "text-right" : ""}`}>
          {cell(e, c.key)}
        </td>,
      );
    }
    return out;
  }

  const anyFilter = !!(search || roleFilter || salaryFilter || stateFilter !== "active");
  const clearAll = () => {
    setSearch("");
    setRoleFilter("");
    setSalaryFilter("");
    setStateFilter("active");
    setPage(1);
  };

  return (
    <div data-ui="v2" className="relative flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5 lg:h-full lg:min-h-0">
      {/* 1. Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("Xodimlar")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {[currentBranch, loadingRows ? t("Yuklanmoqda…") : t("{n} ta xodim", { n: filtered.length }), periodLabel].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              // Bir xil faylni ketma-ket ikki marta tanlash mumkin bo'lsin.
              ev.target.value = "";
              if (f) void importCsv(f);
            }}
          />
          <ActionMenu items={pageMenu} label={t("Eksport va import")} width={240}>
            {(trigger) => (
              <button type="button" {...trigger} title={t("Eksport va import")} aria-label={t("Eksport va import")} className={secondaryIcon}>
                <MoreHorizontal className="size-4" strokeWidth={1.75} />
              </button>
            )}
          </ActionMenu>
          <Link href="/management-cv" className={secondaryBtn}>
            <UserPlus className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Ishga qabul (CV)")}
          </Link>
          <button type="button" onClick={() => setAddOpen(true)} className={primaryBtn}>
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            {t("Xodim qo'shish")}
          </button>
        </div>
      </div>

      {/* 2. Filtrlar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <input
            value={search}
            onChange={(ev) => {
              setSearch(ev.target.value);
              setPage(1);
            }}
            type="search"
            placeholder={t("Ism yoki telefon")}
            aria-label={t("Ism yoki telefon")}
            className="h-9 w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
          />
        </div>
        <V2Select variant="chip" label={t("Lavozim")} value={roleFilter} onChange={(v) => { setRoleFilter(v); setPage(1); }} options={roleOptions} searchable={false} />
        <V2Select variant="chip" label={t("Hisoblash usuli")} value={salaryFilter} onChange={(v) => { setSalaryFilter(v as SalaryFilter); setPage(1); }} options={salaryOptions} searchable={false} />
        <V2Select variant="chip" label={t("Holati")} value={stateFilter} onChange={(v) => { setStateFilter(v); setPage(1); }} options={stateOptions} searchable={false} />
        <div className="ml-auto">
          <ColumnsControl prefs={columns} />
        </div>
      </div>

      {/* 3. Jadval */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none">
          <table className="w-full border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${th} pl-4 pr-2.5`}>{sortHead(t("Xodim"), "name")}</th>
                {visibleCols.map((c) => (
                  <th key={c.key} className={`${th} px-2.5 ${c.align === "right" ? "text-right" : ""} ${c.key === "owed" ? "text-v2-text" : ""}`}>
                    {c.sort ? sortHead(t(c.label), c.sort, c.align === "right") : t(c.label)}
                  </th>
                ))}
                <th className={`${th} w-11 pl-1 pr-3`}>
                  <span className="sr-only">{t("Amallar")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingRows &&
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={`sk${i}`} className={`border-b border-v2-border ${rowH}`} aria-hidden>
                    <td className="py-3 pl-4 pr-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-full bg-v2-skeleton" />
                        <div className="h-3 w-32 rounded bg-v2-skeleton" />
                      </div>
                    </td>
                    {visibleCols.map((c) => (
                      <td key={c.key} className="px-2.5 py-3">
                        <div className={`h-3 w-20 rounded bg-v2-skeleton ${c.align === "right" ? "ml-auto" : ""}`} />
                      </td>
                    ))}
                    <td />
                  </tr>
                ))}

              {!loadingRows && slice.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="p-6">
                    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                        <Users className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      {rows.length === 0 ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Hozircha xodim yo'q")}</div>
                          <p className="text-v2-small text-v2-text-2">{t("Birinchi xodimni qo'shing — u shu ro'yxatda paydo bo'ladi.")}</p>
                        </>
                      ) : (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Mos xodim topilmadi")}</div>
                          <p className="text-v2-small text-v2-text-2">{t("Qidiruv yoki filtrlarni o'zgartirib ko'ring.")}</p>
                          {anyFilter && (
                            <button type="button" onClick={clearAll} className={`${secondaryBtn} mt-2`}>
                              {t("Filtrlarni tozalash")}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {!loadingRows &&
                slice.map((e) => {
                  const archived = Boolean(e.archReason);
                  return (
                    <tr
                      key={e.id}
                      onClick={(ev) => onRowClick(ev, e.id)}
                      title={archived ? t("Arxivlangan: {archReason} — oylik hisoblanmaydi", { archReason: e.archReason }) : undefined}
                      className={`group cursor-pointer border-b border-v2-border transition-colors last:border-b-0 ${rowH} ${ROW_TINT.hover}`}
                    >
                      <td className={`${cellY} pl-4 pr-2.5`}>
                        <span className="flex min-w-[200px] items-center gap-2.5">
                          <EmployeeAvatar name={e.name} />
                          <Link
                            href={`/management-xodimlar/${e.id}`}
                            className={`truncate font-semibold underline-offset-2 hover:text-v2-brand-text group-hover:underline ${archived ? "text-v2-text-2" : "text-v2-text"}`}
                          >
                            {e.name}
                          </Link>
                          {archived && <span className="inline-flex shrink-0 whitespace-nowrap rounded-v2-sm bg-v2-surface-2 px-1.5 py-px text-v2-caption text-v2-text-2">{t("arxivda")}</span>}
                        </span>
                      </td>
                      {rowCells(e)}
                      <td className={`${cellY} pl-1 pr-3 text-right`}>
                        <ActionMenu items={rowMenu(e)} label={t("{name} — amallar", { name: e.name })} width={240}>
                          {(trigger, open) => (
                            <button
                              type="button"
                              {...trigger}
                              title={t("Amallar")}
                              aria-label={t("{name} — amallar", { name: e.name })}
                              className={`inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus ${open ? "bg-v2-surface-2" : ""}`}
                            >
                              <MoreHorizontal className="size-4" strokeWidth={1.75} />
                            </button>
                          )}
                        </ActionMenu>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            {/* 4. Jami — filtrlangan ro'yxatdagi oyligi hisoblanadigan xodimlar bo'yicha */}
            {!loadingRows && totals.n > 0 && (
              <tfoot>
                <tr className="bg-v2-surface-2">
                  <td className="sticky bottom-0 z-[1] bg-v2-surface-2 py-3 pl-4 pr-2.5 text-v2-small font-semibold text-v2-text shadow-[inset_0_1px_0_var(--v2-border)]">
                    {t("Jami · oylikdagi {n} xodim", { n: totals.n })}
                  </td>
                  {visibleCols.map((c) => (
                    <td key={c.key} className={`sticky bottom-0 z-[1] bg-v2-surface-2 px-2.5 py-3 shadow-[inset_0_1px_0_var(--v2-border)] ${c.align === "right" ? "text-right" : ""}`}>
                      {c.key === "earned" ? (
                        <span className="font-semibold tabular-nums text-v2-text">{fmtSum(totals.earned)}</span>
                      ) : c.key === "owed" ? (
                        <span className="whitespace-nowrap font-semibold tabular-nums text-v2-brand-text">
                          {fmtSum(totals.owed)} {t("so'm")}
                        </span>
                      ) : null}
                    </td>
                  ))}
                  <td className="sticky bottom-0 z-[1] bg-v2-surface-2 shadow-[inset_0_1px_0_var(--v2-border)]" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {sorted.length > pageSize && (
          <V2Pagination
            totalItems={sorted.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        )}
      </div>

      {/* Oynalar — hozircha eski ko'rinishda (bo'limma-bo'lim almashadi). */}
      {(addOpen || addFromUrl) && <AddEmployeeModal onClose={closeAdd} onCreated={(emp) => setRows((prev) => [emp, ...prev])} />}
      {editFor && (
        <AddEmployeeModal
          employee={editFor}
          onClose={() => setEditFor(null)}
          onSaved={(updated) => setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))}
        />
      )}
      {taxFor && (
        <EmployeeTaxModal
          employeeName={taxFor.name}
          selected={taxFor.taxIds ?? []}
          onClose={() => setTaxFor(null)}
          onSave={async (nextIds) => {
            const e = taxFor;
            setTaxFor(null);
            await patchEmployee(
              e,
              { taxIds: nextIds },
              nextIds.length > 0 ? t("{name} — {next} ta soliq turi biriktirildi", { name: e.name, next: nextIds.length }) : t("{name} — soliq o'chirildi", { name: e.name }),
            );
          }}
        />
      )}
      {plastikFor && (
        <EmployeePlastikModal
          employeeName={plastikFor.name}
          current={plastikFor.plastikSalary ?? null}
          onClose={() => setPlastikFor(null)}
          onSave={async (next) => {
            const e = plastikFor;
            setPlastikFor(null);
            await patchEmployee(
              e,
              { plastikSalary: next },
              next != null ? t("{name} — plastik oylik {next} so'm", { name: e.name, next: fmtSum(next) }) : t("{name} — plastik oylik olib tashlandi", { name: e.name }),
            );
          }}
        />
      )}
    </div>
  );
}
