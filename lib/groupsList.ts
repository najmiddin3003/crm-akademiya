import type { Group } from "@/lib/groups";

// GURUHLAR RO'YXATINING MANTIG'I — eski (components/groups/GroupsListPage.tsx)
// va yangi (components/v2/groups/GroupsListV2.tsx) sahifa BITTA manbadan
// filtrlaydi va sanaydi: versiyani almashtirgan xodim aynan o'sha ro'yxatni va
// o'sha sonlarni ko'radi. Fayl TOZA (Mongo yo'q) — brauzerga tushadi.

export interface GroupFilters {
  teacher: string;
  course: string;
  room: string;
  /** Aniq tenglik: "Toq kunlar", "Ya,Du,Ch,Ju"… */
  day: string;
  /** lib/groupRules.ts → GROUP_STATUS_VALUES. */
  status: string;
  /** "Toq" | "Juft" — kun matnida bormi. */
  oddEven: string;
  /** "08:30" — dars shu vaqtdan OLDIN boshlanmasin. */
  startTime: string;
  /** "18:00" — dars shu vaqtdan KEYIN tugamasin. */
  endTime: string;
  /** "Oflayn" | "Onlayn" (constants/groups → GROUP_FORMATS). Yangi versiyada qo'shildi. */
  eduType: string;
}

export const EMPTY_GROUP_FILTERS: GroupFilters = {
  teacher: "",
  course: "",
  room: "",
  day: "",
  status: "",
  oddEven: "",
  startTime: "",
  endTime: "",
  eduType: "",
};

/** "08:30" → 510 (yarim tundan boshlab daqiqalar). */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m || 0);
}

/** "06:00 - 08:00" → [360, 480]. Format mos kelmasa [null, null]. */
export function parseTimeRange(range: string): [number | null, number | null] {
  const m = (range || "").match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (!m) return [null, null];
  return [toMinutes(m[1]), toMinutes(m[2])];
}

/** Dars davomiyligi, daqiqada ("14:00 - 16:00" → 120); vaqt o'qilmasa null. */
export function lessonMinutes(time: string): number | null {
  const [s, e] = parseTimeRange(time);
  if (s === null || e === null || e <= s) return null;
  return e - s;
}

/**
 * Guruhdagi o'quvchilar soni — HAQIQIY a'zolik ro'yxatidan (`studentIds`).
 *
 * NEGA: `Group.students` — bazada yotgan o'lik hisoblagich. U guruh
 * yaratilganda 0 qilib yoziladi va /api/groups/:id/students (POST/DELETE)
 * uni HECH QACHON yangilamaydi — faqat `studentIds` massivini
 * o'zgartiradi. Ya'ni ustunda va "Jami o'quvchilar soni" da ilgari
 * o'quvchilar qo'shilgan guruhlar uchun ham 0 turardi.
 */
export function groupStudentCount(g: Group): number {
  return g.studentIds?.length ?? 0;
}

/** Bazadagi ro'yxat + guruhlarda amalda uchraydigan qiymatlar. */
export function unionWithGroups(fromDb: string[], groups: Group[], pick: (g: Group) => string | undefined): string[] {
  return [...new Set([...fromDb, ...groups.map(pick).filter((v): v is string => Boolean(v))])];
}

/** Qidiruv: guruh nomi, kurs, o'qituvchi yoki xona (eski sahifadagidek). */
export function matchesGroupQuery(g: Group, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [g.name, g.course, g.teacher, g.room].some((v) => (v || "").toLowerCase().includes(q));
}

export function applyGroupFilters(groups: Group[], search: string, f: GroupFilters): Group[] {
  return groups.filter((g) => {
    if (!matchesGroupQuery(g, search)) return false;
    if (f.teacher && g.teacher !== f.teacher) return false;
    if (f.course && g.course !== f.course) return false;
    if (f.room && g.room !== f.room) return false;
    if (f.day && g.day !== f.day) return false;
    if (f.status && g.status !== f.status) return false;
    if (f.eduType && (g.eduType || "") !== f.eduType) return false;
    if (f.oddEven && !(g.day || "").toLowerCase().includes(f.oddEven.toLowerCase())) return false;
    // Dars vaqti bo'yicha (referensdagi "Boshlanish vaqti" / "Tugash vaqti").
    // g.time formati: "06:00 - 08:00".
    if (f.startTime || f.endTime) {
      const [gs, ge] = parseTimeRange(g.time);
      if (gs === null || ge === null) return false;
      if (f.startTime && gs < toMinutes(f.startTime)) return false;
      if (f.endTime && ge > toMinutes(f.endTime)) return false;
    }
    return true;
  });
}

/**
 * Guruhlarga qo'shilgan o'quvchilarning TAKRORLANMAS id'lari. Bitta
 * o'quvchi bir nechta guruhda bo'lishi mumkin — guruhlar bo'yicha oddiy
 * yig'indi uni bir necha marta sanardi, shuning uchun Set ishlatilgan.
 */
export function memberIdsOf(groups: Group[]): Set<number> {
  const set = new Set<number>();
  for (const g of groups) for (const id of g.studentIds ?? []) set.add(id);
  return set;
}

/** "2026-09-16" → "16.09.2026"; boshqa shakl o'zgarmaydi. */
function isoToDmy(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s.trim();
}

/**
 * Boshlanish va tugash sanasi «kk.oo.yyyy» shaklida. Yangi guruhlarda
 * `startDate`/`endDate` (ISO), eskilarida yagona manba — `period`
 * ("16.09.2026 - 31.05.2027"); GroupFormModal ham shu tartibda o'qiydi.
 */
export function groupDates(g: Group): { start: string; end: string } {
  const [p0 = "", p1 = ""] = (g.period || "").split(" - ");
  return {
    start: g.startDate ? isoToDmy(g.startDate) : p0.trim(),
    end: g.endDate ? isoToDmy(g.endDate) : p1.trim(),
  };
}

/** "16.09.2026" → 20260916 (saralash uchun); o'qilmasa null. */
export function dmyKey(s: string): number | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s.trim());
  return m ? Number(`${m[3]}${m[2]}${m[1]}`) : null;
}
