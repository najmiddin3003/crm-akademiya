"use client";

import { useColumnPrefs, type ColumnDef } from "@/components/v2/ui/columnPrefs";

// YANGI VERSIYA — OYLIK CHIQARISH JADVALI USTUNLARI (rasm «Oylik chiqarish»,
// 19.10.2026). Rasmdagi tartib: Xodim · Hisob-kitob · Jami oylik · Jami avans ·
// Bonus · Jarima · Soliq · Kartaga · Qolgan oylik.
//
// «Xodim» va «Qolgan oylik» qulflangan (doim): birinchisi doim boshida,
// ikkinchisi — yakuniy raqam — doim oxirida (sahifa o'zi chizadi).
// «To'langan» va «O'tgan oydan» sukutda yoqilgan, lekin QIYMATI BO'LGANDA
// o'zi chiqadi (rasmdagi izoh); «Kartaga» — ro'yxatda kartali xodim bo'lsa
// (eski sahifadek). Telefon va Xodim turi — yashirilgan, kerak bo'lsa yoqiladi.

export type PayrollColumnKey =
  | "employee"
  | "calc"
  | "earned"
  | "avans"
  | "paid"
  | "carry"
  | "bonus"
  | "jarima"
  | "tax"
  | "karta"
  | "phone"
  | "role"
  | "due";

export type PayrollColumn = ColumnDef<PayrollColumnKey>;

export const PAYROLL_COLUMNS: PayrollColumn[] = [
  { key: "employee", label: "Xodim", on: true, locked: true },
  { key: "due", label: "Qolgan oylik", on: true, locked: true, align: "right" },
  { key: "calc", label: "Hisob-kitob", on: true },
  { key: "earned", label: "Jami oylik", on: true, align: "right" },
  { key: "avans", label: "Jami avans", on: true, align: "right" },
  { key: "paid", label: "To'langan", on: true, align: "right" },
  { key: "carry", label: "O'tgan oydan", on: true, align: "right" },
  { key: "bonus", label: "Bonus", on: true, align: "right" },
  { key: "jarima", label: "Jarima", on: true, align: "right" },
  { key: "tax", label: "Soliq", on: true, align: "right" },
  { key: "karta", label: "Kartaga", on: true, align: "right" },
  { key: "phone", label: "Telefon", on: false },
  { key: "role", label: "Xodim turi", on: false },
];

const KEY = "v2:payroll:columns:1";

export function usePayrollColumns() {
  return useColumnPrefs(KEY, PAYROLL_COLUMNS);
}
