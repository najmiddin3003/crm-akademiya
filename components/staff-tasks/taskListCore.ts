"use client";

import { useMemo } from "react";
import { collapseBranchPools, sameBranchPool } from "@/lib/branchPools";
import {
  ACTIVE_STATUSES,
  isActive,
  matchesDue,
  ms,
  redeadlineOf,
  sameUzDay,
  sortTasks,
  uzMonthOf,
  type DueFilter,
  type StaffTask,
  type StaffTaskBranch,
  type StaffTaskEmployee,
  type StaffTaskViewerInfo,
} from "@/lib/staffTasks";

// «TOPSHIRIQLAR» RO'YXATINING UMUMIY HISOBI — eski jadval (TaskList.tsx) va yangi
// versiya (components/v2/tasks/TasksV2.tsx): filtrlash, filtr variantlari va
// yuqoridagi to'rt kartaning sonlari (23.10.2026, TaskList.tsx dan AYNAN
// ko'chirildi). Kartalar KO'RINADIGAN barcha topshiriqlardan hisoblanadi
// (filtrdan oldin), karta bosilsa holat filtri o'rnatiladi.

export interface TaskFilters {
  q: string;
  /** "faol" — yangi + qaytarildi + muddati o'tdi. */
  status: string;
  emp: string;
  branch: string;
  prio: string;
  due: DueFilter;
}

export const EMPTY_FILTERS: TaskFilters = { q: "", status: "", emp: "", branch: "", prio: "", due: "" };

/**
 * Filtrlash va tartib. Xodim/filial/muhimlik filtri faqat rahbarda (xodim
 * o'zinikini ko'radi); qidiruv — sarlavha, rahbarda xodim ismi ham.
 */
export function filterTasks(tasks: StaffTask[], f: TaskFilters, mgr: boolean, nowMs: number): StaffTask[] {
  const q = f.q.trim().toLowerCase();
  return tasks
    .filter((x) => {
      if (q && !x.title.toLowerCase().includes(q) && !(mgr && x.employeeName.toLowerCase().includes(q))) return false;
      if (f.status === "faol") {
        if (!ACTIVE_STATUSES.includes(x.status)) return false;
      } else if (f.status && x.status !== f.status) return false;
      if (mgr) {
        if (f.emp && String(x.employeeId) !== f.emp) return false;
        if (f.branch && !sameBranchPool(Number(x.branchId), Number(f.branch))) return false;
        if (f.prio && String(x.priority) !== f.prio) return false;
      }
      return matchesDue(x, f.due, nowMs);
    })
    .sort(sortTasks);
}

/** Yuqoridagi to'rt karta uchun to'plamlar va izoh satrlariga kerakli sonlar. */
export function taskCardStats(tasks: StaffTask[], nowMs: number, graceHours: number) {
  const nowM = uzMonthOf(nowMs);
  const faol = tasks.filter((x) => isActive(x.status));
  const wait = tasks.filter((x) => x.status === "tasdiq_kutilmoqda");
  const over = tasks.filter((x) => x.status === "muddati_otdi");
  const fail = tasks.filter((x) => x.status === "bajarilmadi" && x.failedAt && uzMonthOf(ms(x.failedAt)) === nowM);
  const pending = faol.filter((x) => x.status !== "muddati_otdi");
  const todayN = pending.filter((x) => sameUzDay(ms(x.deadline), nowMs)).length;
  const nextDl = pending.length ? Math.min(...pending.map((x) => ms(x.deadline))) : null;
  const oldestWait = wait.length ? Math.min(...wait.map((x) => ms(x.doneAt))) : null;
  const nearestOver = over.length ? Math.min(...over.map((x) => redeadlineOf(x, graceHours))) : null;
  const sumFail = fail.reduce((s, x) => s + (x.fine && x.fine.status === "kuchda" ? x.fine.amount : 0), 0);
  return { nowM, faol, wait, over, fail, todayN, nextDl, oldestWait, nearestOver, sumFail };
}

/** Kartalar holat filtri: «Bajarilmadi (shu oy)» muddat filtrini ham qo'yadi. */
export const CARD_FILTERS: { status: string; due: DueFilter }[] = [
  { status: "faol", due: "" },
  { status: "tasdiq_kutilmoqda", due: "" },
  { status: "muddati_otdi", due: "" },
  { status: "bajarilmadi", due: "oy" },
];

export function cardOn(c: { status: string; due: DueFilter }, f: TaskFilters): boolean {
  return f.status === c.status && (c.due === "" || f.due === c.due);
}

export function toggleCard(c: { status: string; due: DueFilter }, f: TaskFilters): TaskFilters {
  if (cardOn(c, f)) return { ...f, status: "", due: c.due ? "" : f.due };
  return { ...f, status: c.status, due: c.due || f.due };
}

/** Filtr variantlari: filial (1+2 hovuz bitta qator), xodim. */
export function useTaskFilterOptions({
  tasks,
  viewer,
  branches,
  employees,
}: {
  tasks: StaffTask[];
  viewer: StaffTaskViewerInfo;
  branches: StaffTaskBranch[];
  employees: StaffTaskEmployee[];
}) {
  const mgr = viewer.role !== "xodim";
  // Rahbarning bitta filiali bo'lsa filial filtri ma'nosiz — ko'rinmaydi.
  const branchOptions = useMemo(() => {
    const allowed = viewer.branchIds;
    const list = allowed === null ? branches : branches.filter((b) => allowed.includes(b.id));
    // 1+2 «Akademiya Chortoq» — bitta qator (lib/branchPools.ts).
    return collapseBranchPools(list).map((b) => ({ value: String(b.id), label: b.name }));
  }, [branches, viewer.branchIds]);
  const showBranch = mgr && branchOptions.length > 1;
  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  // Xodim filtri: topshiriq berish mumkin bo'lganlar + ro'yxatda topshirig'i
  // borlar (arxivga ketgan xodimning eski topshirig'i ham topilsin).
  const empOptions = useMemo(() => {
    const m = new Map<number, string>();
    for (const e of employees) m.set(e.id, e.name);
    for (const tk of tasks) if (!m.has(tk.employeeId)) m.set(tk.employeeId, tk.employeeName);
    return [...m].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => ({ value: String(id), label: name }));
  }, [employees, tasks]);

  return { mgr, branchOptions, showBranch, branchName, empOptions };
}
