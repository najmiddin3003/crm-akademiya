// ISH KUNLARI VA BAYRAMLAR (37-qism, rasmlar «Bayramlar», «Bayram qo'shish») — umumiy turlar.

export type HolidayKind = "davlat" | "diniy" | "markaz";

export interface Holiday {
  id: number;
  name: string;
  /** «YYYY-MM-DD», ikkalasi ham kiradi. */
  from: string;
  to: string;
  kind: HolidayKind;
  /** Sana taxminiy (diniy bayramlar — oy kalendari bo'yicha e'lon qilinadi). */
  approx: boolean;
  /** null — barcha filiallar. */
  branchIds: number[] | null;
  /** Har yil o'zi qo'shilgan davlat bayrami. */
  auto?: boolean;
  notifyParents: boolean;
  notifiedAt?: string;
  notifiedCount?: number;
  createdBy?: string;
}

export interface HolidayRow extends Holiday {
  days: number;
  groups: number;
  lessons: number;
  pupils: number;
  byBranch: { name: string; groups: number }[];
}

export interface WorkWeek {
  /** JS getDay(): 1 — Du … 6 — Sh, 0 — Ya. */
  days: number[];
  from: string;
  to: string;
}

export interface HolidaysPayload {
  ok: true;
  year: string;
  today: string;
  week: WorkWeek;
  oddGroups: number;
  evenGroups: number;
  rows: HolidayRow[];
  branches: { id: number; name: string }[];
}

export const HOLIDAY_KINDS: { value: HolidayKind; label: string }[] = [
  { value: "davlat", label: "Davlat bayrami" },
  { value: "diniy", label: "Diniy bayram" },
  { value: "markaz", label: "Markaz qarori" },
];
