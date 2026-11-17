// «Tanga berish» (yangi versiya, 33-qism) — GET /api/gamification/lesson javobi.
// Server: lib/gamification/lesson.ts → lessonView (LessonRow). Bu fayl — klient tiplari
// (server modulini brauzerga tortmaslik uchun alohida).

import type { GamReason, GamTx, OpRes } from "@/components/v2/groups/detail/groupDetailBits";

export type { GamReason, GamTx, OpRes };

export type LessonAtt = "keldi" | "kechikdi" | "kelmadi" | "sababli";

export interface LessonRowV2 {
  pupilId: number;
  name: string;
  balance: number;
  streak: { run: number; next: number };
  att: LessonAtt | null;
  attAmount: number;
  homework: { value: "done" | "missed"; amount: number; by: string; txId: number; lock: string | null; lockShort: string | null } | null;
  activity: number;
  deducted: number;
  today: number;
  reasonUse: Record<number, number>;
  exam: { prev: number | null; cur: number | null };
  txs: GamTx[];
}

export interface LessonViewV2 {
  enabled: boolean;
  role: "director" | "branch_admin" | "teacher";
  today: string;
  settings: {
    homeworkDoneCoins: number;
    homeworkMissedPenalty: number;
    activityMaxPerClick: number;
    activityGroupLimitPerLesson: number;
    absencePenaltyCoins: number;
    dailyDeductionLimit: number;
    objectionDays: number;
    startDate: string | null;
    growthThresholdPp: number;
    streakLessons: number;
    streakBonusCoins: number;
    examCoins90: number;
    examCoins80: number;
    examCoins70: number;
    growthBonusCoins: number;
  };
  sys: Record<string, boolean>;
  reasons: GamReason[];
  groups: { id: number; label: string; branchName: string }[];
  group: { id: number; label: string; branchName: string; teacher: string; time: string; room: string; day: string } | null;
  canTeach: boolean;
  canExcuse: boolean;
  activityUsed: number;
  examMonths: { prev: string; cur: string } | null;
  examDone: { results: number; growth: number } | null;
  rows: LessonRowV2[];
}

/** Darsda yo'q — tanga faqat beriladigan sabablar bilan (server qoidasi). */
export const isAbsent = (att: LessonAtt | null) => att === "kelmadi" || att === "sababli";

/** «Keldi · +5», «Kelmadi · −10», «Sababli · 0»; belgilanmagan — null. */
export function attChip(att: LessonAtt | null): { label: string; tone: "success" | "danger" | "neutral" } | null {
  if (att === "keldi") return { label: "Keldi", tone: "success" };
  if (att === "kechikdi") return { label: "Kechikdi", tone: "success" };
  if (att === "kelmadi") return { label: "Kelmadi", tone: "danger" };
  if (att === "sababli") return { label: "Sababli", tone: "neutral" };
  return null;
}
