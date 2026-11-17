// MAVSUMIY BAHOLASH (36-qism, rasmlar «Mavsumiy baholash», «Baholash — telefon») — umumiy turlar va chorak hisobi.

/** Chorak kaliti: «2026-1» — 2026–2027 o'quv yili, 1-chorak (sentabr–oktabr). */
export type SeasonKey = string;

const Q = [
  { n: 1, season: "Kuz", months: [9, 10] },
  { n: 2, season: "Qish", months: [11, 12] },
  { n: 3, season: "Qish", months: [1, 2, 3] },
  { n: 4, season: "Bahor", months: [4, 5] },
] as const;
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

export function seasonOf(iso: string): SeasonKey {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  if (m >= 9) return `${y}-${m >= 11 ? 2 : 1}`;
  if (m <= 3) return `${y - 1}-3`;
  return `${y - 1}-4`; // aprel–avgust — 4-chorak (yoz ta'tilida ham oxirgi chorak ochiq turadi)
}

export function seasonInfo(key: SeasonKey) {
  const [ys, qs] = key.split("-");
  const y = Number(ys);
  const q = Q[Math.min(4, Math.max(1, Number(qs))) - 1];
  const yearOf = (m: number) => (m >= 9 ? y : y + 1);
  const first = q.months[0];
  const last = q.months[q.months.length - 1];
  /** Muddat — choraknin oxirgi oyining 25-kuni. */
  const deadline = `${yearOf(last)}-${String(last).padStart(2, "0")}-25`;
  return { key, n: q.n, label: `${q.season} · ${q.n}-chorak · ${MONTHS[first - 1]}–${MONTHS[last - 1]}`, short: `${q.season.toLowerCase()}, ${q.n}-chorak`, deadline };
}

export const prevSeason = (key: SeasonKey) => {
  const [y, q] = key.split("-").map(Number);
  return q > 1 ? `${y}-${q - 1}` : `${y - 1}-4`;
};

export const LANG_CRITERIA = ["Gapirish", "Tinglash", "O'qish", "Yozish", "Grammatika"];
export const DEFAULT_CRITERIA = ["Bilim", "Masala yechish", "Faollik", "Uy vazifasi"];

export type GroupSeasonState = "sent" | "ready" | "progress" | "none";

export interface SeasonGroupRow {
  id: number;
  name: string;
  course: string;
  level: string;
  teacher: string;
  day: string;
  time: string;
  room: string;
  total: number;
  graded: number;
  state: GroupSeasonState;
  sentAt?: string;
}

export interface SeasonPupilRow {
  pupilId: number;
  name: string;
  scores: Record<string, number>;
  note: string;
  avg: number | null;
  prevAvg: number | null;
}

export interface SeasonPayload {
  ok: true;
  season: SeasonKey;
  label: string;
  deadline: string;
  today: string;
  seasons: { key: SeasonKey; label: string }[];
  groups: SeasonGroupRow[];
  courses: string[];
  teachers: string[];
  criteria: Record<string, string[]>;
}

export interface SeasonGroupDetail {
  ok: true;
  group: SeasonGroupRow;
  criteria: string[];
  pupils: SeasonPupilRow[];
  avgBy: Record<string, number | null>;
}

/** O'quvchi kabinetidagi «Chorak bahosi keldi» kartasi (lib/seasonGrades.ts → seasonCardsFor). */
export interface SeasonCard {
  season: string;
  label: string;
  group: string;
  teacher: string;
  sentAt: string;
  criteria: { name: string; score: number }[];
  avg: number | null;
  prevAvg: number | null;
  note: string;
}

export const avgOf = (scores: Record<string, number>, criteria: string[]) => {
  const v = criteria.map((c) => scores[c]).filter((x) => x >= 1 && x <= 5);
  return v.length === criteria.length && v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};
