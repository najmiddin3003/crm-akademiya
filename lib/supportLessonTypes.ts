// NAZORAT → «SUPPORT DARSLARI» (34-qism, rasm «Support darslari») — klient va server uchun umumiy.
// Server: lib/supportLessons.ts; API: app/api/support-lessons.

export interface SupportSeat {
  pupilId: number;
  name: string;
  /** Yozilgan vaqt — "YYYY-MM-DDTHH:mm" (Toshkent). */
  at: string;
  /** Davomat: true keldi, false kelmadi, null — hali belgilanmagan. */
  came: boolean | null;
}

export type SupportStatus = "open" | "full" | "done" | "unmarked";

export interface SupportLesson {
  id: number;
  branchId: number;
  date: string;
  start: string;
  room: string;
  course: string;
  topic: string;
  teacher: string;
  capacity: number;
  seats: SupportSeat[];
  queue: SupportSeat[];
  createdAt: string;
  createdBy: string;
}

export interface SupportLessonRow extends SupportLesson {
  status: SupportStatus;
  came: number;
}

export interface SupportTeacherRow {
  teacher: string;
  course: string;
  lessons: number;
  enrolled: number;
  /** Kelganlar ulushi, % (o'tgan va belgilangan darslar bo'yicha). */
  pct: number | null;
}

export interface SupportPayload {
  ok: true;
  from: string;
  to: string;
  courses: string[];
  kpi: { lessons: number; done: number; planned: number; enrolled: number; pupils: number; came: number; cameOf: number; noShow: number; pct: number | null; queue: number };
  rows: SupportLessonRow[];
  teachers: SupportTeacherRow[];
}

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  open: "Yozilish ochiq",
  full: "Joy to'ldi",
  done: "O'tdi",
  unmarked: "Davomat qilinmagan",
};
