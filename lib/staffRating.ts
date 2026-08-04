import { SR_TEACHERS, SR_STUDENTS, SR_COURSES, SR_GROUPS_BY_COURSE, SR_NOTES } from "@/constants/staffRating";

export interface StaffRating {
  id: number;
  teacher: string;
  student: string;
  course: string;
  group: string;
  lessonDate: string;
  izoh: string;
  ratingDate: string;
  rating: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Pseudo-random rating (mostly 5, some 4, rare 3) — ported verbatim from
// crm-akademiya/src/app.js _srRating() (~line 28697).
function srRating(seed: number): number {
  const r = seed % 100;
  if (r < 80) return 5;
  if (r < 95) return 4;
  return 3;
}

const GROUPS_BY_COURSE = SR_GROUPS_BY_COURSE as Record<string, string[]>;

// Ported verbatim from app.js's STAFF_RATINGS IIFE (~line 28705) — same LCG
// seed sequence per item, so this produces the exact same 61 records (same
// teacher weighting, dates, notes, ratings) as the original.
export function generateStaffRatings(): StaffRating[] {
  const items: StaffRating[] = [];
  for (let i = 1; i <= 61; i++) {
    let seed = i * 9301 + 49297;
    const rnd = (min: number, max: number) => {
      seed = (seed * 9301 + 49297) % 233280;
      return Math.floor((seed / 233280) * (max - min + 1)) + min;
    };

    const wTotal = SR_TEACHERS.reduce((s, t) => s + t.weight, 0);
    let wPick = rnd(0, wTotal - 1);
    let teacher = SR_TEACHERS[0];
    for (const t of SR_TEACHERS) {
      if (wPick < t.weight) { teacher = t; break; }
      wPick -= t.weight;
    }

    const student = SR_STUDENTS[rnd(0, SR_STUDENTS.length - 1)];
    const course = SR_COURSES[rnd(0, SR_COURSES.length - 1)];
    const groups = GROUPS_BY_COURSE[course];
    const group = groups[rnd(0, groups.length - 1)];

    const lessonMonth = rnd(7, 11); // Aug=7 - Dec=11
    const lessonDay = rnd(1, 28);
    const lessonDate = `${pad2(lessonDay)}.${pad2(lessonMonth + 1)}.2025`;
    const ratingMonth = Math.min(11, lessonMonth + rnd(0, 1));
    const ratingDay = rnd(lessonDay, 28);
    const ratingDate = `${pad2(ratingDay)}.${pad2(ratingMonth + 1)}.2025`;

    items.push({
      id: i,
      teacher: teacher.name,
      student,
      course,
      group,
      lessonDate,
      izoh: SR_NOTES[rnd(0, SR_NOTES.length - 1)],
      ratingDate,
      rating: srRating(seed),
    });
  }

  return items.sort((a, b) => {
    const [ad, am, ay] = a.ratingDate.split(".").map(Number);
    const [bd, bm, by] = b.ratingDate.split(".").map(Number);
    return by - ay || bm - am || bd - ad;
  });
}

export const STAFF_RATINGS = generateStaffRatings();
