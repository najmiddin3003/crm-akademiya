"use client";

import { Check, Eye, Lock } from "lucide-react";
import type { TFn } from "@/components/shared/Language";
import type { MatrixEmployee } from "@/app/api/roles/matrix/route";
import type { Role } from "@/lib/roles";
import { isRoleKey } from "@/lib/roles";
import type { Access, RowState } from "@/lib/accessRows";

// YANGI VERSIYA — «ROLLAR VA HUQUQLAR» umumiy qismlari (25-qism): jadval, alohida ruxsat paneli va
// login hisoblari tabi shu yerdan oladi.

export type { MatrixEmployee };

export interface MatrixBranch {
  id: number;
  name: string;
}

export interface MatrixMe {
  isAdmin: boolean;
  employeeId: number | null;
  /** So'rov egasining bo'lim ruxsati (`null` — cheklovsiz / admin). */
  access: Access;
}

export interface MatrixData {
  me: MatrixMe;
  roles: Role[];
  employees: MatrixEmployee[];
  branches: MatrixBranch[];
}

/**
 * Xodimning roli — lib/rolePermissions.ts (employeePermissions) zanjiri bilan bir xil: Rollar'da
 * qo'lda qo'shilgan rol (`centerRoleId`) bo'lsa — o'sha, aks holda lavozim kaliti (`turi`).
 */
export function roleOf(emp: Pick<MatrixEmployee, "turi" | "centerRoleId">, roles: Role[]): Role | undefined {
  if (emp.centerRoleId !== null && emp.centerRoleId !== undefined) return roles.find((r) => r.id === emp.centerRoleId);
  return isRoleKey(emp.turi) ? roles.find((r) => r.key === emp.turi) : undefined;
}

/**
 * Xodim ROLIDAN keladigan ruxsat (alohida ruxsatsiz). `null` — cheklovsiz: lavozimi belgilanmagan
 * yoki rolda ro'yxat yo'q. O'chirilgan qo'lda rol — `[]` (hech narsa ochilmaydi), serverdagidek.
 */
export function roleAccessOf(emp: Pick<MatrixEmployee, "turi" | "centerRoleId">, roles: Role[]): Access {
  const role = roleOf(emp, roles);
  if (!role) return emp.centerRoleId !== null && emp.centerRoleId !== undefined ? [] : null;
  return Array.isArray(role.permissions) ? role.permissions : null;
}

/** Xodimning HAQIQIY ruxsati: alohida ruxsat bo'lsa — u, aks holda rol. Admin — cheklovsiz. */
export function effectiveAccess(emp: MatrixEmployee, roles: Role[]): Access {
  if (emp.admin) return null;
  return emp.override ?? roleAccessOf(emp, roles);
}

/** Lavozim/rol nomi: «Administrator», Rollar'dagi nom yoki «Lavozimsiz». */
export function roleNameOf(emp: MatrixEmployee, roles: Role[], t: TFn): string {
  if (emp.admin) return t("Administrator");
  const role = roleOf(emp, roles);
  if (role) return t(role.name);
  return emp.turi && emp.turi !== "staff" ? t(emp.turi) : t("Lavozimsiz");
}

/** Faol xodimlar shu rolda (admin — alohida ustunda, bu yerda sanalmaydi). */
export function employeesOfRole(role: Role, employees: MatrixEmployee[]): MatrixEmployee[] {
  return employees.filter((e) => {
    if (e.admin) return false;
    if (role.key) return e.centerRoleId === null && e.turi === role.key;
    return e.centerRoleId === role.id;
  });
}

/** Lavozimi belgilanmagan va admin bo'lmagan — rol ruxsati qo'llanmaydi, hamma bo'limni ko'radi. */
export function unrestrictedEmployees(employees: MatrixEmployee[]): MatrixEmployee[] {
  return employees.filter((e) => !e.admin && e.override === null && e.centerRoleId === null && !isRoleKey(e.turi));
}

/**
 * Jadval katagi: «✓ To'liq» (brend), «Qisman 2/5» va «Ko'rish · o'zi» (kulrang), «Yo'q» (oddiy matn).
 * `locked` — o'zgartirib bo'lmaydi (administrator, hammaga ochiq yoki faqat admin qatori).
 */
export function LevelChip({ state, t, locked = false, compact = false }: { state: RowState; t: TFn; locked?: boolean; compact?: boolean }) {
  const pill = "inline-flex items-center gap-1 whitespace-nowrap rounded-v2-full px-2 py-0.5 text-v2-caption font-semibold";
  let chip;
  if (state.level === "full") {
    chip = (
      <span className={`${pill} bg-v2-brand-bg text-v2-brand`}>
        <Check className="size-3" strokeWidth={2.5} aria-hidden />
        {t("To'liq")}
      </span>
    );
  } else if (state.level === "partial") {
    chip = (
      <span className={`${pill} bg-v2-surface-2 text-v2-text-2`}>
        <span className="size-2.5 rounded-full border-[1.5px] border-current bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)]" aria-hidden />
        {t("Qisman")}
      </span>
    );
  } else if (state.level === "own") {
    chip = (
      <span className={`${pill} bg-v2-surface-2 text-v2-text-2`}>
        <Eye className="size-3" strokeWidth={2} aria-hidden />
        {t("Ko'rish")}
      </span>
    );
  } else {
    chip = <span className="text-v2-caption text-v2-text-3">{t("Yo'q")}</span>;
  }
  const sub =
    state.level === "partial" ? `${state.on}/${state.total}` : state.level === "own" ? t("o'zi") : "";
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <span className="inline-flex items-center gap-1">
        {chip}
        {locked && !compact && <Lock className="size-3 text-v2-text-3" strokeWidth={2} aria-hidden />}
      </span>
      {sub && <span className="text-[10.5px] leading-none tabular-nums text-v2-text-3">{sub}</span>}
    </span>
  );
}

/** Daraja nomi matnda (panel, toast, tarix): «To'liq», «Qisman 2/5», «Ko'rish (o'zi)», «Yo'q». */
export function levelText(state: RowState, t: TFn): string {
  if (state.level === "full") return t("To'liq");
  if (state.level === "partial") return t("Qisman {on}/{total}", { on: state.on, total: state.total });
  if (state.level === "own") return t("Ko'rish (o'zi)");
  return t("Yo'q");
}
