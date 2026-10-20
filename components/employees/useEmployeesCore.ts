"use client";

import { useEffect, useMemo, useState } from "react";
import type { HrEmployeeFull } from "./employeeExtras";
import type { Group } from "@/lib/groups";
import { payrollEarned, payrollOwedTotal, payrollPeriod, type EmployeePayroll, type SalaryType } from "@/lib/salary";

// BOSHQARUV → XODIMLAR — MA'LUMOT YADROSI (20.10.2026). Eski ro'yxat
// (EmployeesListPage.tsx) dan AYNAN ko'chirildi: yangi versiyadagi Xodimlar
// sahifasi (components/v2/employees/EmployeesListV2.tsx) ham shundan oladi — ikkala
// versiya bir xil xodimlar, bir xil oylik raqamlari va guruh sonini ko'rsatadi.

// Oylik-komponentlar backend'dan (/api/salary-runs/employees-payroll)
// olinadi. Ilgari bu yerda alohida hisob bor edi va u xodim id'sidan
// hisoblanadigan demo generatorlarni ishlatardi — natijada bu ro'yxat
// bilan Oylik chiqarish sahifasi bir odam haqida turlicha raqam
// ko'rsatardi. Endi manba bitta.
//
// Oyligi sozlanmagan xodim uchun null qaytadi: bunday xodimda hisoblangan
// raqam yo'q, "0" esa yolg'on bo'lardi.
export interface SalaryView {
  salaryType: SalaryType;
  percent: number;
  fixedSalary: number;
  jamiOylik: number;
  jamiAvans: number;
  /**
   * Xodimga JAMI qancha qarzmiz (`payrollOwedTotal`): shu oyda
   * to'lanadigani + o'tgan oylarda to'lanmagani. Kartochka "xodim
   * holati"ni ko'rsatadi, chiqarish chegarasini emas.
   */
  qolganOylik: number;
  /**
   * Shundan o'tgan oylarda to'lanmagan qism (`carryPending`, ≥ 0) — u
   * joriy oyda TO'LANMAYDI, o'z oyining Oylik sahifasidan chiqariladi
   * (04.10.2026, "faqat o'z oyidan chiqarilsin"). 0 — yo'q.
   */
  otganOylar: number;
}

export function salaryFor(
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
    // 04.10.2026 gacha `payrollDue` edi — u o'shanda o'tgan oylar qoldig'ini
    // ham to'liq olardi. Endi `payrollDue` faqat SHU OYDA to'lanadiganini
    // oladi; kartochka raqami avvalgidek JAMI qolsin (sentabr qoldig'i
    // ro'yxatdan "yo'qolmasin") — `payrollOwedTotal`, qismi pastda alohida.
    qolganOylik: payrollOwedTotal(row, p),
    otganOylar: Math.max(row.carryPending ?? 0, 0),
  };
}

export function useEmployeesCore() {
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
  // Oylik ro'yxati keldimi — kelmagan bo'lsa (xato) «shu filial ro'yxatida yo'q»
  // degan xulosa chiqarilmaydi (yangi sahifa, 20.10.2026).
  const [payrollLoaded, setPayrollLoaded] = useState(false);

  const period = useMemo(() => payrollPeriod(), []);

  // Xodimlar ro'yxati va ularning oylik qatorlari — ikkalasi ham backend'dan.
  // Oylik hisobi shu sahifada TAKRORLANMAYDI: u /api/salary-runs/
  // employees-payroll dan keladi, shunda Oylik chiqarish sahifasi bilan
  // bir xil raqam chiqadi.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/hr-employees").then((r) => r.json()).catch(() => null),
      // `branch=pool` — ro'yxat 1+2 hovuzi bo'yicha (lib/branchPools.ts), oylik
      // qatorlari ham o'sha hovuzdan bo'lsin, aks holda boshqa filial
      // oyligidagi xodim «Sozlanmagan» chiqardi.
      fetch("/api/salary-runs/employees-payroll?branch=pool").then((r) => r.json()).catch(() => null),
      fetch("/api/groups").then((r) => r.json()).catch(() => null),
    ])
      .then(([emps, pay, grps]) => {
        if (cancelled) return;
        if (emps?.ok) setRows(emps.employees);
        if (pay?.ok) {
          setPayrollById(new Map((pay.employees as EmployeePayroll[]).map((e) => [e.id, e])));
          setPayrollLoaded(true);
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

  return { rows, setRows, groups, payrollById, payrollLoaded, loadingRows, period, groupStatsByName, statsOf };
}
