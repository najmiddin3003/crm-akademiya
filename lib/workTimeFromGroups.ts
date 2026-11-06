import { normName } from "@/lib/gamification/scope";
import { groupBoundsIso, parseTimeRange } from "@/lib/groupRules";

// O'QITUVCHI ISH VAQTI GURUH VAQTIDAN (06.11.2026). Egasi: «o'qituvchilarni ish vaqt guruh
// vaqtiga qarab belgilansin». /vaqtinchalik → «Ish vaqtini belgilash» → «Guruh vaqti bo'yicha»
// tugmasi shu natijani o'qituvchi qatorlariga qo'yadi, saqlash odatdagidek.
//
// Ish vaqti bitta, kun bo'yicha farqi yo'q (lib/workTime.ts), shu sababli hafta bo'yi eng erta
// boshlanish va eng kech tugash olinadi: 08:00–10:00 va 14:00–16:00 → 08:00–16:00.
//
// Bog'lanish ISM bo'yicha (`groups.teacher`, teacherId yo'q). Yordamchi ustoz ham kiradi: o'sha
// darsda u ham ishda, kechikish ham shunday hisoblanadi (lib/attendanceCheck.ts → expectationFor).
// Tugagan guruh kirmaydi: muddati o'tib, `status` hali "active" turgani bor.

export interface GroupTime {
  start: string;
  end: string;
}

export interface GroupTimeRow {
  status?: string;
  teacher?: string;
  assistant?: string;
  time?: string;
  startDate?: string;
  endDate?: string;
  period?: string;
}

/** Daqiqadan "HH:MM": lib/workTime.ts qoidasi ikki xonali soat talab qiladi. */
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Kalit — `normName(ism)`. Aktiv guruhi yoki yaroqli dars vaqti yo'q ustoz ro'yxatga kirmaydi. */
export function groupTimesByTeacher(groups: GroupTimeRow[], todayIso: string): Map<string, GroupTime> {
  const spans = new Map<string, [number, number]>();
  for (const g of groups) {
    if (g.status !== "active") continue;
    const range = parseTimeRange(g.time ?? "");
    if (!range) continue;
    const { end } = groupBoundsIso(g);
    if (end && end < todayIso) continue;
    for (const who of [g.teacher, g.assistant]) {
      const key = normName(who);
      if (!key) continue;
      const seen = spans.get(key);
      spans.set(key, seen ? [Math.min(seen[0], range[0]), Math.max(seen[1], range[1])] : [range[0], range[1]]);
    }
  }
  const out = new Map<string, GroupTime>();
  for (const [key, [start, end]] of spans) out.set(key, { start: hhmm(start), end: hhmm(end) });
  return out;
}
