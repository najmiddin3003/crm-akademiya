// O'QUVCHI DARSNI BAHOLAYDI → NAZORAT «USTOZLAR REYTINGI» (34-qism) — klient va server uchun umumiy.
// Server: lib/lessonRatings.ts; o'quvchi API: app/api/student-web/rating; rahbar API: app/api/lesson-ratings.

/** Kelgan darsini shu kun ichida baholash mumkin (dars kuni + N kun). */
export const RATE_WINDOW_DAYS = 2;
/** O'rtachaga kirishi uchun ustozda kamida shuncha baho bo'lsin (rasm: «3 tadan kam baho olganlar o'rtachaga kirmaydi»). */
export const MIN_RATINGS_FOR_AVG = 3;

export const LESSON_TAGS = ["Tushunarli tushuntirdi", "Qiziqarli o'tdi", "Ko'p mashq qildik", "Juda tez o'tdi", "Uy vazifasi ko'p"] as const;
export type LessonTag = (typeof LESSON_TAGS)[number];

export const STAR_LABELS: Record<number, string> = { 1: "Yomon", 2: "Qoniqarsiz", 3: "O'rtacha", 4: "Yaxshi", 5: "A'lo" };

export interface MyRating {
  groupId: number;
  date: string;
  stars: number;
  title: string;
  course: string;
  teacher: string;
}

export interface TeacherRatingRow {
  teacher: string;
  /** «IELTS · 6.0+, Ingliz tili · 3-bosqich · Chortoq 1» */
  sub: string;
  count: number;
  avg: number | null;
  /** [5, 4, 3, 2, 1] yulduzlar soni. */
  dist: [number, number, number, number, number];
  prevAvg: number | null;
  low: number;
}

export interface RatingComment {
  groupLabel: string;
  date: string;
  stars: number;
  text: string;
}

export interface TeacherRatingsPayload {
  ok: true;
  month: string;
  branches: { id: number; name: string }[];
  courses: string[];
  kpi: { avg: number | null; count: number; teachers: number; ratedPct: number | null; low: number; lowPct: number; lowTopTeacher: number; comments: number };
  rows: TeacherRatingRow[];
  attention: { teacher: string; groupLabel: string; lastAvg: number; lastN: number; low: number; tags: string[] } | null;
  comments: RatingComment[];
}
