"use client";

import { useColumnPrefs, type ColumnDef } from "@/components/v2/ui/columnPrefs";

// YANGI XODIMLAR RO'YXATI — USTUNLAR (rasm «Xodimlar», 20.10.2026). Rasmdagi tartib va
// sukut: «Xodim» qulflangan; ko'rinadi — Lavozim, Guruhlar, Hisoblash usuli, Jami oylik,
// Qolgan oylik; yashirilgan — eski jadvaldagi qolganlari (telefon, filial, fan,
// o'quvchilar, avans, soliq, plastik, qo'shilgan sana, ketish sababi va sanasi).

export type EmployeeColumnKey =
  | "employee"
  | "role"
  | "groups"
  | "salaryType"
  | "earned"
  | "owed"
  | "phone"
  | "branch"
  | "kurs"
  | "students"
  | "avans"
  | "tax"
  | "plastik"
  | "created"
  | "archReason"
  | "archDate";

export type EmployeeSortKey = "name" | "groups" | "earned" | "owed" | "students" | "created";

export interface EmployeeColumn extends ColumnDef<EmployeeColumnKey> {
  sort?: EmployeeSortKey;
}

export const EMPLOYEE_COLUMNS: EmployeeColumn[] = [
  { key: "employee", label: "Xodim", on: true, locked: true, sort: "name" },
  { key: "role", label: "Lavozim", on: true },
  { key: "groups", label: "Guruhlar", on: true, sort: "groups" },
  { key: "salaryType", label: "Hisoblash usuli", on: true },
  { key: "earned", label: "Jami oylik", on: true, align: "right", sort: "earned" },
  { key: "owed", label: "Qolgan oylik", on: true, align: "right", sort: "owed" },
  { key: "phone", label: "Telefon", on: false },
  { key: "branch", label: "Filial", on: false },
  { key: "kurs", label: "Fani", on: false },
  { key: "students", label: "O'quvchilar", on: false, align: "right", sort: "students" },
  { key: "avans", label: "Berilgan avans", on: false, align: "right" },
  { key: "tax", label: "Soliq", on: false },
  { key: "plastik", label: "Plastik oylik", on: false, align: "right" },
  { key: "created", label: "Qo'shilgan", on: false, sort: "created" },
  { key: "archReason", label: "Ketish sababi", on: false },
  { key: "archDate", label: "Ketgan sana", on: false },
];

const KEY = "v2:employees-list:columns:1";

export function useEmployeeColumns() {
  return useColumnPrefs(KEY, EMPLOYEE_COLUMNS);
}
