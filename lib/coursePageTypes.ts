// KURS SAHIFASI (36-qism, rasm «Kurs sahifasi») — klient va server uchun umumiy turlar (lib/coursePage.ts).

export interface CourseLevelRow {
  name: string;
  /** Joriy filialdagi oylik narx; null — kiritilmagan. */
  price: number | null;
  groups: number;
  pupils: number;
}

export interface CourseTeacherRow {
  name: string;
  levels: string[];
  pupils: number;
  groups: number;
  branches: string[];
}

export interface CourseBook {
  id: number;
  courseId: number;
  name: string;
  author: string;
  level: string;
}

export interface CoursePage {
  ok: true;
  course: { id: number; name: string; category: string; branches: number };
  kpi: { groups: number; byBranch: { name: string; n: number }[]; pupils: number; teachers: number; topTeacher: { name: string; pupils: number } | null; attendance: number | null; centerAttendance: number | null; month: string };
  levels: CourseLevelRow[];
  teachers: CourseTeacherRow[];
  /** Dars vaqtlari: qatorlar — vaqt, ustunlar — Toq / Juft / Boshqa kunlar; qiymat — guruhlar soni. */
  times: { time: string; odd: number; even: number; other: number }[];
  books: (CourseBook & { pupils: number })[];
}
