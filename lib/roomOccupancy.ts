import { groupWeekdays } from "@/lib/attendance";
import { sameBranchPool } from "@/lib/branchPools";
import { lessonMinutes, parseTimeRange } from "@/lib/groupsList";
import { holdsRoom } from "@/lib/groupRules";
import type { BranchHours } from "@/lib/managementBranches";
import { roomBranchId, type Room } from "@/lib/rooms";

// XONALAR BANDLIGI — SOF HISOB (23-qism «Sozlamalar · Xonalar», 13.11.2026).
// Mijoz va server birdek import qiladi (baza/cookie yo'q).
//
// Guruh xonaga NOMI bilan bog'lanadi (`groups.room`) va FILIAL ichida — 1+2
// hovuzida ikkala filial guruhlari bir xonani ishlatadi (lib/roomBranch.ts,
// lib/groupRoomClash.ts bilan bir xil qoida). Bandlik faqat xonani egallab
// turgan guruhlardan (ROOM_HOLDING_STATUSES: yig'ilmoqda, faol, muzlatilgan)
// va muddati tugamaganlaridan — `findRoomConflict` ham shularni hisoblaydi.
//
// SIG'IM: guruhda «sig'im» maydoni YO'Q — xona sig'imi guruhdagi HOZIRGI
// o'quvchilar soni (`studentIds`) bilan solishtiriladi.

/** GET /api/rooms?view=overview dagi guruh — faqat bandlik uchun kerakli maydonlar. */
export interface OverviewGroup {
  id: number;
  name: string;
  course: string;
  day: string;
  time: string;
  room: string;
  status: string;
  /** Guruhdagi o'quvchilar soni (`studentIds.length`). */
  students: number;
  branchId?: number;
  /** Muddati tugagan (endDate < bugun) — xonani band qilmaydi. */
  expired: boolean;
}

export interface OverviewBranch {
  id: number;
  name: string;
  openFrom?: string | null;
  openTo?: string | null;
  workDays?: number[] | null;
}

export interface RoomsOverview {
  branches: OverviewBranch[];
  rooms: Room[];
  groups: OverviewGroup[];
  /** Foydalanuvchiga ruxsat etilgan filiallar (xona qo'shish/ko'chirish shu ro'yxatda). */
  allowed: number[];
  /** Navbardagi filial. */
  current: number;
}

/** Guruh qaysi filialda — maydoni yo'q eski yozuv 1-filial (xona bilan bir xil qoida). */
export function groupBranchId(g: Pick<OverviewGroup, "branchId">): number {
  return typeof g.branchId === "number" ? g.branchId : 1;
}

function roomKey(name: string): string {
  return (name || "").trim().toLowerCase();
}

/** Xonada dars o'tadigan tirik guruhlar (vaqt bo'yicha tartiblangan). */
export function groupsInRoomOf(room: Room, groups: readonly OverviewGroup[]): OverviewGroup[] {
  const key = roomKey(room.name);
  const branch = roomBranchId(room);
  return groups
    .filter((g) => !g.expired && holdsRoom(g.status) && roomKey(g.room) === key && sameBranchPool(groupBranchId(g), branch))
    .sort((a, b) => (parseTimeRange(a.time)[0] ?? 0) - (parseTimeRange(b.time)[0] ?? 0) || a.id - b.id);
}

/** Guruhning haftalik dars daqiqalari: hafta kunlari × dars davomiyligi (vaqt o'qilmasa 0). */
export function weeklyLessonMinutes(g: Pick<OverviewGroup, "day" | "time">): number {
  return groupWeekdays(g.day).length * (lessonMinutes(g.time) ?? 0);
}

export interface RoomLoad {
  groups: OverviewGroup[];
  /** Haftalik band daqiqalar. */
  busy: number;
  /** Haftalik ochiq daqiqalar (filial ish vaqti). */
  open: number;
  /** Bandlik foizi, butun (0 — ochiq vaqt yo'q bo'lsa ham). */
  pct: number;
  /** Sig'imdan ko'p o'quvchili guruhlar. */
  over: { group: OverviewGroup; lack: number }[];
}

export function roomLoad(room: Room, groups: readonly OverviewGroup[], openMinutes: number): RoomLoad {
  const own = groupsInRoomOf(room, groups);
  const busy = own.reduce((s, g) => s + weeklyLessonMinutes(g), 0);
  const pct = openMinutes > 0 ? Math.round((busy / openMinutes) * 100) : 0;
  const over =
    room.capacity > 0
      ? own.filter((g) => g.students > room.capacity).map((group) => ({ group, lack: group.students - room.capacity }))
      : [];
  return { groups: own, busy, open: openMinutes, pct, over };
}

/** Daqiqa → soat: butun bo'lsa butun, aks holda bitta kasr («4,5»). */
export function hoursLabel(minutes: number): string {
  const h = minutes / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(1).replace(".", ",");
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Filialda ertalabki / kechki ikki soat HAMMA xonada bo'shmi — pastki qatordagi
 * «ertalab va kechqurun yangi guruh uchun joy bor» faqat rost bo'lsa aytiladi.
 */
export function freeEdges(groups: readonly OverviewGroup[], hours: BranchHours): { morning: boolean; evening: boolean } {
  const open = toMin(hours.from);
  const close = toMin(hours.to);
  if (close - open < 6 * 60) return { morning: false, evening: false };
  let first = Infinity;
  let last = -Infinity;
  for (const g of groups) {
    const [s, e] = parseTimeRange(g.time);
    if (s === null || e === null) continue;
    first = Math.min(first, s);
    last = Math.max(last, e);
  }
  return { morning: first >= open + 120, evening: last <= close - 120 };
}
