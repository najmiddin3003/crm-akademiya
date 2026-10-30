"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, ChevronRight, CreditCard, History, KeyRound, ListChecks, MoreHorizontal, Pencil, Percent, Phone, Settings2, Wallet } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import { formatPhoneDisplay } from "@/components/auth/PhoneField";
import AddEmployeeModal from "@/components/employees/AddEmployeeModal";
import EmployeeArchiveModal, { type ArchiveMode } from "@/components/employees/EmployeeArchiveModal";
import EmployeePasswordModal from "@/components/employees/EmployeePasswordModal";
import EmployeePlastikModal from "@/components/employees/EmployeePlastikModal";
import EmployeeSalaryConfigModal from "@/components/employees/EmployeeSalaryConfigModal";
import EmployeeTaxModal from "@/components/employees/EmployeeTaxModal";
import type { HrEmployeeFull } from "@/components/employees/employeeExtras";
import { employeeRoleLabel, useRoleNames } from "@/components/employees/useRoleNames";
import CashOperationModalV2 from "@/components/v2/finance/CashOperationModalV2";
import { useCanOpen, useShell } from "@/components/v2/shell/ShellContext";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import { secondaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { ROLE_LABELS } from "@/constants/employees";
import type { Group } from "@/lib/groups";
import { hasSectionPermission } from "@/lib/permissions";
import { payrollPeriod, type EmployeePayroll } from "@/lib/salary";
import type { StaffTask } from "@/lib/staffTasks";
import { EmployeeAvatar, SALARY_TAG, fmtSum, salaryTypeLabel } from "./employeeBits";
import EmployeeSalaryCard, { type SalaryCardState } from "./EmployeeSalaryCard";
import EmployeeScheduleCard, { type ProfileGroup } from "./EmployeeScheduleCard";
import EmployeeTasksCard from "./EmployeeTasksCard";
import EmployeeFaceCard from "./EmployeeFaceCard";

// YANGI VERSIYA — XODIM PROFILI (rasm «Xodim profili», yorug'/qorong'i, 20.10.2026):
//
//   1. «Xodimlar › Madina Qosimjonova»; avatar (brand), ism, «O'qituvchi · Akademiya 3
//      Uychi · [Oklad + 30%] · ⚷ Huquqlar: rol bo'yicha · login bor»; o'ngda «Topshiriq
//      berish», «Avans berish», «⋯» (tahrir, ish haqi, soliq, plastik, parol, qo'ng'iroq,
//      batafsil, arxiv — eski profildagi amallar);
//   2. chapda «Guruhlar va jadval» (./EmployeeScheduleCard.tsx), ostida «Batafsil» —
//      eski profilning tablari (tranzaksiyalar, to'lovlar, daftar, eslatma …) eski
//      ko'rinishda (`?classic=1&tab=…`) — yangi dizaynda ular yo'q, yo'qolib qolmasin;
//   3. o'ngda «Oylik · oktabr 2026» (./EmployeeSalaryCard.tsx) va «Topshiriqlar»
//      (./EmployeeTasksCard.tsx).
//
// Manbalar eski profil va ro'yxat bilan bir xil: /api/hr-employees/:id (+ `account` —
// tizim hisobi bor-yo'qligi), /api/groups (o'qituvchi/yordamchi ISMI bo'yicha — eski
// ro'yxatdagi bog'lanish), /api/salary-runs/employees-payroll?branch=pool, /api/staff-tasks.
// Oynalar hozircha eski (Kassa amali — yangi). Taxminlar: design/v2/SAVOLLAR.md 126–133.

interface Account {
  exists: boolean;
  status: string | null;
  hasPassword: boolean;
}

/** Eski profilning tablari — «Batafsil» havolalari (EP_TABS id). */
const DETAIL_TABS: { id: string; label: string }[] = [
  { id: "transactions", label: "Tranzaksiyalar tarixi" },
  { id: "student-payments", label: "O'quvchilar to'lovlari" },
  { id: "advances", label: "Avans tarixi" },
  { id: "salary-log", label: "Oylik tarixi" },
  { id: "balance", label: "Balans tarixi" },
  { id: "unpaid-payments", label: "To'lanmagan to'lovlar" },
  { id: "work-hours", label: "Ish soati" },
  { id: "kpi", label: "KPI" },
  { id: "notes", label: "Eslatma" },
];

export default function EmployeeProfileV2({ id }: { id: number }) {
  const { t } = useT();
  const branch = useBranch();
  const { permissions, isAdmin } = useShell();
  const canCash = useCanOpen("/finance-cash");
  const canPayroll = useCanOpen("/finance-payroll");
  const canAssign = hasSectionPermission("/tasks", permissions);
  const roleNames = useRoleNames();
  const { showSuccess, showError } = useToast();
  const period = useMemo(() => payrollPeriod(), []);

  const [emp, setEmp] = useState<HrEmployeeFull | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [empState, setEmpState] = useState<"loading" | "ok" | "notfound" | "error">("loading");
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [pay, setPay] = useState<{ ok: boolean; row: EmployeePayroll | null } | null>(null);
  const [tasks, setTasks] = useState<StaffTask[] | null | undefined>(null);
  const [finVersion, setFinVersion] = useState(0);

  const [editOpen, setEditOpen] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);
  const [plastikOpen, setPlastikOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [archiveMode, setArchiveMode] = useState<ArchiveMode | null>(null);
  const [avansOpen, setAvansOpen] = useState(false);

  // Xodimning o'zi (+ tizim hisobi).
  useEffect(() => {
    let off = false;
    fetch(`/api/hr-employees/${id}`)
      .then(async (r) => ({ status: r.status, d: await r.json().catch(() => null) }))
      .then(({ status, d }) => {
        if (off) return;
        if (d?.ok) {
          setEmp(d.employee as HrEmployeeFull);
          setAccount((d.account as Account | undefined) ?? null);
          setEmpState("ok");
        } else setEmpState(status === 404 ? "notfound" : "error");
      })
      .catch(() => {
        if (!off) setEmpState("error");
      });
    return () => {
      off = true;
    };
  }, [id]);

  // Guruhlar, oylik qatori va topshiriqlar — ism kelishini kutmaydi (guruhlar keyin ism bo'yicha kesiladi).
  useEffect(() => {
    let off = false;
    const get = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    Promise.all([get("/api/groups"), get("/api/salary-runs/employees-payroll?branch=pool"), get("/api/staff-tasks")]).then(([g, p, k]) => {
      if (off) return;
      setGroups(g?.ok ? (g.groups as Group[]) : []);
      setPay(p?.ok ? { ok: true, row: (p.employees as EmployeePayroll[]).find((e) => e.id === id) ?? null } : { ok: false, row: null });
      setTasks(k?.ok ? (k.tasks as StaffTask[]) : undefined);
    });
    return () => {
      off = true;
    };
  }, [id, finVersion]);

  const myGroups: ProfileGroup[] = useMemo(() => {
    if (!emp || !groups) return [];
    const key = emp.name.trim().toLowerCase();
    return groups
      .filter((g) => String(g.teacher ?? "").trim().toLowerCase() === key || String(g.assistant ?? "").trim().toLowerCase() === key)
      .map((g) => ({ ...g, asAssistant: String(g.teacher ?? "").trim().toLowerCase() !== key }))
      .sort((a, b) => (a.time || "").localeCompare(b.time || "") || a.id - b.id);
  }, [emp, groups]);

  const branchName = (bid: number | undefined) => (bid ? (branch.branches.find((b) => b.id === bid)?.name ?? "") : "");

  const salaryState: SalaryCardState = !emp || !pay
    ? { kind: "loading" }
    : emp.archReason
      ? { kind: "archived" }
      : !pay.ok
        ? { kind: "error" }
        : pay.row
          ? { kind: "row", row: pay.row }
          : { kind: "elsewhere", branch: branchName(emp.payrollBranchId) };

  async function patchEmployee(body: Partial<HrEmployeeFull>, okMsg: string) {
    if (!emp) return;
    try {
      const res = await fetch(`/api/hr-employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Saqlanmadi");
      setEmp((data.employee as HrEmployeeFull | undefined) ?? { ...emp, ...body });
      setFinVersion((v) => v + 1);
      showSuccess(okMsg);
    } catch (err) {
      showError(t(err instanceof Error ? err.message : "Saqlanmadi"));
    }
  }

  if (empState === "loading") {
    return (
      <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 sm:p-5" aria-busy>
        <div className="h-4 w-48 rounded bg-v2-skeleton" />
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-full bg-v2-skeleton" />
          <div className="space-y-2">
            <div className="h-5 w-56 rounded bg-v2-skeleton" />
            <div className="h-3 w-80 rounded bg-v2-skeleton" />
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="h-80 rounded-v2-lg bg-v2-skeleton" />
          <div className="h-80 rounded-v2-lg bg-v2-skeleton" />
        </div>
      </div>
    );
  }
  if (empState !== "ok" || !emp) {
    return (
      <div data-ui="v2" className="flex min-h-full flex-col items-start gap-3 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5">
        <p className="text-v2-body text-v2-text-2">{empState === "notfound" ? t("Xodim topilmadi.") : t("Ma'lumotni olib bo'lmadi. Internet aloqasini tekshirib, qayta urinib ko'ring.")}</p>
        <Link href="/management-xodimlar" className={secondaryBtn}>
          {t("Xodimlar ro'yxati")}
        </Link>
      </div>
    );
  }

  const archived = Boolean(emp.archReason);
  const role = employeeRoleLabel(emp, roleNames, ROLE_LABELS);
  const branchesText = (emp.branchIds ?? []).map((b) => branchName(b)).filter(Boolean).join(", ") || emp.filial;
  const phone = formatPhoneDisplay(emp.phone);
  const permsText = Array.isArray(emp.permissions) ? t("alohida — {n} bo'lim", { n: emp.permissions.length }) : t("rol bo'yicha");
  const loginText = !account
    ? ""
    : !account.exists
      ? t("login yo'q")
      : account.status === "invited"
        ? t("taklif yuborilgan")
        : account.hasPassword
          ? t("login bor")
          : t("parol o'rnatilmagan");

  const menu: ActionMenuEntry[] = [
    { key: "h", heading: emp.name },
    { key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: () => setEditOpen(true) },
    { key: "salary", label: t("Ish haqini sozlash"), icon: Settings2, onSelect: () => setSalaryOpen(true) },
    {
      key: "tax",
      label: t("Soliq turlari"),
      icon: Percent,
      hint: (emp.taxIds ?? []).length ? String((emp.taxIds ?? []).length) : undefined,
      disabled: archived,
      title: archived ? t("Xodim arxivda — oylik hisoblanmaydi, soliq va plastik ta'sir qilmaydi") : undefined,
      onSelect: () => setTaxOpen(true),
    },
    {
      key: "plastik",
      label: t("Plastik oylik"),
      icon: CreditCard,
      hint: emp.plastikSalary != null ? fmtSum(emp.plastikSalary) : undefined,
      disabled: archived,
      title: archived ? t("Xodim arxivda — oylik hisoblanmaydi, soliq va plastik ta'sir qilmaydi") : undefined,
      onSelect: () => setPlastikOpen(true),
    },
    ...(isAdmin ? [{ key: "password", label: t("Parol"), icon: KeyRound, onSelect: () => setPasswordOpen(true) } as ActionMenuEntry] : []),
    ...(phone ? [{ key: "call", label: t("Qo'ng'iroq qilish"), icon: Phone, hint: phone, href: `tel:${phone.replace(/\s/g, "")}` } as ActionMenuEntry] : []),
    { key: "d1", divider: true },
    { key: "classic", label: t("Batafsil — tranzaksiyalar va tarix"), icon: History, href: `/management-xodimlar/${emp.id}?classic=1` },
    { key: "d2", divider: true },
    archived
      ? { key: "restore", label: t("Arxivdan chiqarish"), icon: ArchiveRestore, onSelect: () => setArchiveMode("activate") }
      : { key: "archive", label: t("Arxivlash"), icon: Archive, danger: true, onSelect: () => setArchiveMode("archive") },
  ];

  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5">
      {/* 1. Sarlavha */}
      <nav aria-label={t("Yo'l")} className="flex items-center gap-1.5 text-v2-small">
        <Link href="/management-xodimlar" className="text-v2-text-2 underline-offset-2 hover:text-v2-text hover:underline">
          {t("Xodimlar")}
        </Link>
        <ChevronRight className="size-3.5 text-v2-text-3" strokeWidth={2} aria-hidden />
        <span className="truncate font-medium text-v2-text">{emp.name}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <EmployeeAvatar name={emp.name} photoUrl={emp.photoUrl} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[20px] font-semibold leading-7 text-v2-text">{emp.name}</h1>
              {archived && (
                <span
                  className="inline-flex h-6 items-center rounded-v2-sm bg-v2-danger-bg px-2 text-v2-caption font-medium text-v2-danger"
                  title={`${emp.archReason}${emp.archDate ? ` · ${emp.archDate}` : ""}`}
                >
                  {t("Arxivda")}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-v2-small text-v2-text-2">
              <span>{[role ? t(role) : "", branchesText].filter(Boolean).join(" · ") || "—"}</span>
              {pay?.row?.configured && <span className={SALARY_TAG}>{salaryTypeLabel(pay.row, t)}</span>}
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 font-medium text-v2-text" title={t("Huquqlar Boshqaruv → Rollar va huquqlar'da sozlanadi")}>
                <KeyRound className="size-3.5 text-v2-text-2" strokeWidth={1.75} aria-hidden />
                {t("Huquqlar: {perm}", { perm: permsText })}
                {loginText && ` · ${loginText}`}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canAssign && !archived && (
            <Link href={`/tasks?new=1&employee=${emp.id}`} className={secondaryBtn}>
              <ListChecks className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Topshiriq berish")}
            </Link>
          )}
          {canCash && !archived && (
            <button type="button" onClick={() => setAvansOpen(true)} className={secondaryBtn}>
              <Wallet className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Avans berish")}
            </button>
          )}
          <ActionMenu items={menu} label={t("{name} — amallar", { name: emp.name })} width={270}>
            {(trigger) => (
              <button type="button" {...trigger} title={t("Amallar")} aria-label={t("{name} — amallar", { name: emp.name })} className={secondaryIcon}>
                <MoreHorizontal className="size-4" strokeWidth={1.75} />
              </button>
            )}
          </ActionMenu>
        </div>
      </div>

      {/* 2–3. Kartalar */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-4">
          <EmployeeScheduleCard groups={myGroups} loading={groups === null} />
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm" aria-label={t("Batafsil")}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-v2-section text-v2-text">{t("Batafsil")}</h2>
              <span className="text-v2-caption text-v2-text-3">{t("eski ko'rinishda ochiladi")}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {DETAIL_TABS.map((tab) => (
                <Link
                  key={tab.id}
                  href={`/management-xodimlar/${emp.id}?classic=1&tab=${tab.id}`}
                  className="inline-flex h-8 items-center rounded-v2-full border border-v2-border-strong bg-v2-surface px-3 text-v2-small font-medium text-v2-text transition-colors hover:bg-v2-surface-2"
                >
                  {t(tab.label)}
                </Link>
              ))}
            </div>
          </section>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <EmployeeSalaryCard state={salaryState} period={period} canPayroll={canPayroll} canConfigure={!archived} onConfigure={() => setSalaryOpen(true)} />
          <EmployeeTasksCard tasks={tasks} employeeId={emp.id} canAssign={canAssign && !archived} />
          {/* Face ID — biometrik rasm, faqat admin (API ham shunday). */}
          {isAdmin && <EmployeeFaceCard employeeId={emp.id} />}
        </div>
      </div>

      {/* Oynalar — eski (Kassa amali — yangi). */}
      {editOpen && (
        <AddEmployeeModal
          employee={emp}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setEmp(updated);
            setFinVersion((v) => v + 1);
          }}
        />
      )}
      {salaryOpen && (
        <EmployeeSalaryConfigModal
          employee={emp}
          onClose={() => setSalaryOpen(false)}
          onSaved={(updated) => {
            setEmp({ ...emp, ...updated });
            setSalaryOpen(false);
            setFinVersion((v) => v + 1);
          }}
        />
      )}
      {taxOpen && (
        <EmployeeTaxModal
          employeeName={emp.name}
          selected={emp.taxIds ?? []}
          onClose={() => setTaxOpen(false)}
          onSave={async (nextIds) => {
            setTaxOpen(false);
            await patchEmployee(
              { taxIds: nextIds },
              nextIds.length > 0 ? t("{name} — {next} ta soliq turi biriktirildi", { name: emp.name, next: nextIds.length }) : t("{name} — soliq o'chirildi", { name: emp.name }),
            );
          }}
        />
      )}
      {plastikOpen && (
        <EmployeePlastikModal
          employeeName={emp.name}
          current={emp.plastikSalary ?? null}
          onClose={() => setPlastikOpen(false)}
          onSave={async (next) => {
            setPlastikOpen(false);
            await patchEmployee(
              { plastikSalary: next },
              next != null ? t("{name} — plastik oylik {next} so'm", { name: emp.name, next: fmtSum(next) }) : t("{name} — plastik oylik olib tashlandi", { name: emp.name }),
            );
          }}
        />
      )}
      {passwordOpen && <EmployeePasswordModal employee={emp} onClose={() => setPasswordOpen(false)} />}
      {archiveMode && (
        <EmployeeArchiveModal
          employee={emp}
          mode={archiveMode}
          onClose={() => setArchiveMode(null)}
          onDone={(updated) => {
            setEmp({ ...emp, ...updated });
            setArchiveMode(null);
            setFinVersion((v) => v + 1);
          }}
        />
      )}
      {avansOpen && (
        <CashOperationModalV2
          initialTab="chiqim"
          presetAvansFor={emp.name}
          onClose={() => setAvansOpen(false)}
          onSaved={() => setFinVersion((v) => v + 1)}
        />
      )}
    </div>
  );
}
