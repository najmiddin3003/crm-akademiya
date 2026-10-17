"use client";

import { useColumnPrefs, type ColumnDef } from "@/components/v2/ui/columnPrefs";

// YANGI GURUHLAR RO'YXATI — USTUNLAR (rasm «Guruhlar · Ustunlar», 18.10.2026).
// Rasmdagi tartib va sukut: «Guruh nomi» qulflangan (doim); ko'rinadi — Kurs,
// O'qituvchi, Kun va vaqt, Xona, O'quvchilar, Guruh holati; yashirilgan —
// Daraja, Guruh vaqti, Telegram havola, Ta'lim turi, Dars davomiyligi,
// Boshlanish sanasi, Tugash sanasi. Eski jadvaldagi hamma ustun shu yerda
// («Kun» + «Dars vaqti» — bitta «Kun va vaqt»); yangi — Ta'lim turi, Dars
// davomiyligi, Boshlanish/Tugash sanasi (ma'lumoti guruh yozuvida bor).

export type GroupColumnKey =
  | "name"
  | "course"
  | "teacher"
  | "schedule"
  | "room"
  | "students"
  | "status"
  | "level"
  | "period"
  | "telegram"
  | "eduType"
  | "duration"
  | "startDate"
  | "endDate";

export type GroupSortKey = "name" | "students" | "startDate" | "endDate";

export interface GroupColumn extends ColumnDef<GroupColumnKey> {
  sort?: GroupSortKey;
}

export const GROUP_COLUMNS: GroupColumn[] = [
  { key: "name", label: "Guruh nomi", on: true, locked: true, sort: "name" },
  { key: "course", label: "Kurs", on: true },
  { key: "teacher", label: "O'qituvchi", on: true },
  { key: "schedule", label: "Kun va vaqt", on: true },
  { key: "room", label: "Xona", on: true },
  { key: "students", label: "O'quvchilar", on: true, sort: "students" },
  { key: "status", label: "Guruh holati", on: true },
  { key: "level", label: "Daraja", on: false },
  { key: "period", label: "Guruh vaqti", on: false },
  { key: "telegram", label: "Telegram havola", on: false },
  { key: "eduType", label: "Ta'lim turi", on: false },
  { key: "duration", label: "Dars davomiyligi", on: false },
  { key: "startDate", label: "Boshlanish sanasi", on: false, sort: "startDate" },
  { key: "endDate", label: "Tugash sanasi", on: false, sort: "endDate" },
];

const KEY = "v2:groups-list:columns:1";

export function useGroupColumns() {
  return useColumnPrefs(KEY, GROUP_COLUMNS);
}
