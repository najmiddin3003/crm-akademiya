// Dars jadvali yordamchi funksiyalari — crm-akademiya/src/app.js dagi konflikt
// aniqlash mantiqidan 1:1 ko'chirilgan (_detectConflicts / _detectAllConflicts /
// _conflictKeys) + formatStatValue.

import { ROOMS, SCH_DAY_ORDER, SCH_DAY_LONG, SCHEDULE_DATA } from "@/constants/schedule";

export interface Lesson {
  room: number;
  startSlot: number;
  slots: number;
  color: string;
  groupNum: number;
  teacher: string;
  book: string;
  ppl: string;
  extra?: number;
  course?: string;
  status?: string;
  isMakeup?: boolean;
}

export interface Conflict {
  type: "teacher" | "room";
  day: string;
  a: Lesson;
  b: Lesson;
  label: string;
}

/** Konflikt: bir kunda vaqti to'qnashadigan bir xil o'qituvchi YOKI bir xil xona. */
export function detectConflicts(day: string): Conflict[] {
  const lessons: Lesson[] = (SCHEDULE_DATA as Record<string, Lesson[]>)[day] || [];
  const conflicts: Conflict[] = [];
  for (let i = 0; i < lessons.length; i++) {
    for (let j = i + 1; j < lessons.length; j++) {
      const a = lessons[i];
      const b = lessons[j];
      const aEnd = a.startSlot + a.slots;
      const bEnd = b.startSlot + b.slots;
      const overlap = a.startSlot < bEnd && b.startSlot < aEnd;
      if (!overlap) continue;
      if (a.teacher === b.teacher) {
        conflicts.push({ type: "teacher", day, a, b, label: `O'qituvchi: ${a.teacher}` });
      }
      if (a.room === b.room) {
        conflicts.push({ type: "room", day, a, b, label: `Xona: ${ROOMS[a.room]}` });
      }
    }
  }
  return conflicts;
}

export function detectAllConflicts(): Conflict[] {
  const all: Conflict[] = [];
  for (const day of SCH_DAY_ORDER) all.push(...detectConflicts(day));
  return all;
}

/** Konfliktdagi darslarning kalitlari (kun bo'yicha): `groupNum|startSlot`. */
export function conflictKeys(day: string): Set<string> {
  const keys = new Set<string>();
  for (const c of detectConflicts(day)) {
    keys.add(`${c.a.groupNum}|${c.a.startSlot}`);
    keys.add(`${c.b.groupNum}|${c.b.startSlot}`);
  }
  return keys;
}

export interface ConflictSummary {
  total: number;
  teacher: number;
  room: number;
  dayList: string;
}

/** Konflikt bannerida ko'rsatiladigan yig'ma ma'lumot. */
export function conflictSummary(): ConflictSummary | null {
  const conflicts = detectAllConflicts();
  if (conflicts.length === 0) return null;
  const byDay: Record<string, number> = {};
  conflicts.forEach((c) => {
    byDay[c.day] = (byDay[c.day] || 0) + 1;
  });
  const dayList = Object.entries(byDay)
    .map(([d, n]) => {
      const idx = SCH_DAY_ORDER.indexOf(d);
      return `${SCH_DAY_LONG[idx]} (${n})`;
    })
    .join(", ");
  return {
    total: conflicts.length,
    teacher: conflicts.filter((c) => c.type === "teacher").length,
    room: conflicts.filter((c) => c.type === "room").length,
    dayList,
  };
}

/** 1000+ sonlarni probel bilan ajratadi (1 411 kabi). */
export function formatStatValue(n: number): string {
  if (n >= 1000) return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return String(n);
}
