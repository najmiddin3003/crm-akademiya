// NAZORAT → DAVOMAT NAZORATI (34-qism) — klient va server uchun umumiy tiplar.
// Server: lib/attendanceControl.ts, API: app/api/attendance-control.

/** Dars tugagach shu daqiqa ichida belgilanishi kerak (rasm: «30 daqiqa ichida»). */
export const MARK_DEADLINE_MIN = 30;
/** Shundan keyin davomatni faqat direktor o'zgartiradi (gamifikatsiyadagi e'tiroz muddati bilan bir xil sukut). */
export const ADMIN_EDIT_DAYS = 7;
/** «Jarima yozish» oynasidagi sukut summa (so'm). */
export const DEFAULT_MARK_PENALTY = 20_000;

export interface AcBranch {
  id: number;
  name: string;
}

export interface AcUnmarked {
  groupId: number;
  label: string;
  course: string;
  teacher: string;
  branchName: string;
  room: string;
  date: string;
  time: string;
  /** Dars tugaganidan beri o'tgan daqiqa. */
  passedMin: number;
  /** Necha kun o'tdi (dars kunidan). */
  daysPassed: number;
  reminded: { at: string; by: string } | null;
  penalty: { amount: number; date: string } | null;
}

export interface AcLate {
  groupId: number;
  label: string;
  course: string;
  teacher: string;
  date: string;
  endTime: string;
  markedDate: string;
  markedTime: string;
  delayMin: number;
  byName: string;
  self: boolean;
}

export interface AcToday {
  groupId: number;
  label: string;
  course: string;
  teacher: string;
  branchName: string;
  room: string;
  time: string;
  /** done — belgilangan; waiting — dars hali tugamagan; due — muddat ichida; overdue — muddat o'tdi. */
  state: "done" | "waiting" | "due" | "overdue";
  marked: number;
  members: number;
  markedAt: string | null;
}

export interface AcOverview {
  ok: true;
  today: string;
  from: string;
  to: string;
  branches: AcBranch[];
  isAdmin: boolean;
  kpi: { lessons: number; unmarked: number; late: number; onTime: number; penalties: number; penaltySum: number };
  excluded: { groupId: number; label: string; branchName: string }[];
  unmarked: AcUnmarked[];
  late: AcLate[];
  today_: AcToday[];
}

export type AcStatus = "keldi" | "kechikdi" | "birinchi" | "sababli" | "sababsiz";

export interface AcRecord {
  key: string;
  pupilId: number;
  pupilName: string;
  groupId: number;
  groupLabel: string;
  course: string;
  teacher: string;
  date: string;
  time: string;
  status: AcStatus;
  reason: string;
  note: string;
  byName: string;
  byAt: string;
  /** Shu guruhda ketma-ket sababsiz (shu darsgacha). */
  streak: number;
}

export interface AcRecords {
  ok: true;
  counts: Record<AcStatus, number>;
  days: { date: string; kechikdi: number; birinchi: number; sababli: number; sababsiz: number; pct: number }[];
  reasons: { reason: string; count: number }[];
  streakPupils: number;
  total: number;
  rows: AcRecord[];
  groups: { id: number; label: string }[];
  teachers: string[];
  markers: string[];
}
