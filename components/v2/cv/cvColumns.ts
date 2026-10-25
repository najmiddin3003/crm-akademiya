"use client";

import { useColumnPrefs, type ColumnDef } from "@/components/v2/ui/columnPrefs";

// ISHGA QABUL (CV) — USTUNLAR (rasm «Nomzodlar ro'yxati», 25.10.2026). Rasmdagi tartib: Nomzod
// (qulf), Yo'nalish, Tajriba, Sertifikat, Filial, Kelgan, Holat; yashirilgan — eski jadvaldagi
// qolganlari (lavozim, bandlik, kutilayotgan oylik, ta'lim, ish boshlash, manba, admin izohi).

export type CvColumnKey =
  | "candidate"
  | "track"
  | "exp"
  | "cert"
  | "branch"
  | "submitted"
  | "status"
  | "position"
  | "load"
  | "salary"
  | "edu"
  | "start"
  | "source"
  | "note";

export const CV_COLUMNS: ColumnDef<CvColumnKey>[] = [
  { key: "candidate", label: "Nomzod", on: true, locked: true },
  { key: "track", label: "Yo'nalish", on: true },
  { key: "exp", label: "Tajriba", on: true },
  { key: "cert", label: "Sertifikat", on: true },
  { key: "branch", label: "Filial", on: true },
  // «Kelgan» yolg'iz — davomatdagi «Kelgan» ("Present") bilan bitta kalit bo'lardi; «Kelgan vaqti» — lidlardagidek.
  { key: "submitted", label: "Kelgan vaqti", on: true },
  { key: "status", label: "Holat", on: true },
  { key: "position", label: "Lavozim", on: false },
  { key: "load", label: "Bandlik", on: false },
  { key: "salary", label: "Kutilayotgan oylik", on: false },
  { key: "edu", label: "Ta'lim", on: false },
  { key: "start", label: "Ish boshlash", on: false },
  { key: "source", label: "Manba", on: false },
  { key: "note", label: "Admin izohi", on: false },
];

const KEY = "v2:cv-list:columns:1";

export function useCvColumns() {
  return useColumnPrefs(KEY, CV_COLUMNS);
}
