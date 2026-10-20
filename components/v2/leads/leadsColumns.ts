"use client";

import { useColumnPrefs, type ColumnDef } from "@/components/v2/ui/columnPrefs";

// YANGI LIDLAR RO'YXATI — USTUNLAR (rasm «Lidlar», 20.10.2026). Rasmdagi tartib:
// «Lid» qulflangan (avatar + ism + telefon); ko'rinadi — Yo'nalish (kurs + daraja),
// Holat, Keyingi qadam, Manba, Qo'shilgan, Mas'ul (rasmda o'ng chetda kesilgan
// ustun); yashirilgan — Filial, Qayerdan bildi, Qulay vaqt, ID, Izoh. Eski
// jadvaldagi hamma ustun bor («Daraja / sinf» — Yo'nalish ichida).

export type LeadColumnKey = "lead" | "course" | "holat" | "next" | "source" | "created" | "moderator" | "branch" | "heardFrom" | "qulayVaqt" | "no" | "note";

export type LeadSortKey = "name" | "next" | "created";

export interface LeadColumn extends ColumnDef<LeadColumnKey> {
  sort?: LeadSortKey;
}

export const LEAD_COLUMNS: LeadColumn[] = [
  { key: "lead", label: "Lid", on: true, locked: true, sort: "name" },
  { key: "course", label: "Yo'nalish", on: true },
  { key: "holat", label: "Holat", on: true },
  { key: "next", label: "Keyingi qadam", on: true, sort: "next" },
  { key: "source", label: "Manba", on: true },
  { key: "created", label: "Qo'shilgan", on: true, sort: "created" },
  { key: "moderator", label: "Mas'ul", on: true },
  { key: "branch", label: "Filial", on: false },
  { key: "heardFrom", label: "Qayerdan bildi", on: false },
  { key: "qulayVaqt", label: "Qulay vaqt", on: false },
  { key: "no", label: "ID", on: false },
  { key: "note", label: "Izoh", on: false },
];

const KEY = "v2:leads-list:columns:1";

export function useLeadColumns() {
  return useColumnPrefs(KEY, LEAD_COLUMNS);
}
