// ONLAYN KURSLAR (36-qism, rasm «Onlayn kurslar») — kurs tuzilmasi va statistika turlari (lib/onlineCourseAdmin.ts).

export interface OnlineLesson {
  id: string;
  title: string;
  /** Video manzili (Cloudinary) — bo'sh bo'lsa «rejada». */
  video: string;
  minutes: number;
  seconds: number;
}

export interface OnlineModule {
  id: string;
  name: string;
  lessons: OnlineLesson[];
  /** Modul oxiridagi test savollari soni; 0 — test yo'q. */
  testQuestions: number;
}

export interface OnlineCourseRow {
  id: number;
  name: string;
  teacher: string;
  audience: string;
  free: boolean;
  price: number;
  published: boolean;
  cover: string;
  modules: OnlineModule[];
  lessons: number;
  ready: number;
  minutes: number;
  /** Kamida bitta darsni ochgan o'quvchilar. */
  pupils: number;
  finished: number;
  testAvg: number | null;
  moduleProgress: number[];
  moduleTest: (number | null)[];
}

export interface OnlineCoursesPayload {
  ok: true;
  rows: OnlineCourseRow[];
  kpi: { pupils: number; finished: number; testAvg: number | null; revenue: number; paidPupils: number; paidName: string };
}

export const fmtDur = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} soat${min % 60 ? ` ${min % 60} daq` : ""}` : `${min} daq`);
