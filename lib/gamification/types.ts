// GAMIFIKATSIYA — umumiy tiplar va konstantalar (klient ham, server ham).
// Fayl TOZA: Mongo yo'q, brauzerga ham tushadi.
//
// Manba — Gamifikatsiya TZ v1.4 (25.09.2026) va uning prototipi. TZ
// jadvallari SQL uchun yozilgan (snake_case); bu yerda maydonlar loyiha
// konvensiyasi bo'yicha camelCase: `gamification_start_date` → `startDate`,
// `daily_deduction_limit` → `dailyDeductionLimit`, `student_id` → `pupilId`.
//
// TZ → tizim moslashtirishlari (26.09.2026, foydalanuvchi bilan):
//   • Direktor = users.role "admin"; Filial admini = hr_employees.turi
//     "moderator"; Ustoz = turi "teacher" (guruhlari groups.teacher nomi bo'yicha).
//   • Modul feature-flag bilan (`enabled`): o'chiq paytda hech narsa
//     yozilmaydi; birinchi yoqilgan kun — `startDate`.

export type GamRole = "director" | "branch_admin" | "teacher";

export const GAM_ROLE_LABELS: Record<GamRole, string> = {
  director: "Direktor",
  branch_admin: "Filial admini",
  teacher: "Ustoz",
};

/** Daraja: `position` 1–5, `minEarned` — «jami topilgan» tanga chegarasi. */
export interface GamLevel {
  position: number;
  name: string;
  minEarned: number;
}

export const DEFAULT_LEVELS: GamLevel[] = [
  { position: 1, name: "Yangi boshlovchi", minEarned: 0 },
  { position: 2, name: "Izlanuvchi", minEarned: 300 },
  { position: 3, name: "Bilimdon", minEarned: 800 },
  { position: 4, name: "Olim", minEarned: 1600 },
  { position: 5, name: "Akademik", minEarned: 3000 },
];

/** Sozlamalar (TZ 6.1) — butun markaz bo'yicha bitta hujjat. */
export interface GamSettings {
  /** Modul yoqilganmi (feature-flag). O'chiq paytda tanga yozilmaydi. */
  enabled: boolean;
  /** `gamification_start_date` — birinchi yoqilgan kun (YYYY-MM-DD). */
  startDate: string | null;
  attendanceOnTimeCoins: number;
  attendanceLateCoins: number;
  absencePenaltyCoins: number;
  homeworkDoneCoins: number;
  homeworkMissedPenalty: number;
  activityMaxPerClick: number;
  activityGroupLimitPerLesson: number;
  examCoins90: number;
  examCoins80: number;
  examCoins70: number;
  growthThresholdPp: number;
  growthBonusCoins: number;
  streakLessons: number;
  streakBonusCoins: number;
  /** `streak_lessons` o'zgarganda yoki `streak` qayta yoqilganda (ISO). */
  streakRuleChangedAt: string | null;
  referralBonusCoins: number;
  dailyDeductionLimit: number;
  objectionDays: number;
  kidsMaxGrade: number;
  wishlistMax: number;
  monthCloseDay: number;
  levels: GamLevel[];
  updatedByName?: string;
  updatedAt?: string;
}

/** Raqamli sozlamalar kalitlari va TZ 6.1 dagi ruxsat etilgan oraliqlar. */
export const NUMERIC_SETTINGS = {
  attendanceOnTimeCoins: [0, 100],
  attendanceLateCoins: [0, 100],
  absencePenaltyCoins: [1, 100],
  homeworkDoneCoins: [1, 100],
  homeworkMissedPenalty: [1, 100],
  activityMaxPerClick: [1, 5],
  activityGroupLimitPerLesson: [1, 500],
  examCoins90: [0, 500],
  examCoins80: [0, 500],
  examCoins70: [0, 500],
  growthThresholdPp: [1, 100],
  growthBonusCoins: [1, 500],
  streakLessons: [2, 100],
  streakBonusCoins: [1, 500],
  referralBonusCoins: [1, 1000],
  dailyDeductionLimit: [1, 500],
  objectionDays: [0, 60],
  kidsMaxGrade: [1, 11],
  wishlistMax: [1, 20],
  monthCloseDay: [1, 10],
} as const satisfies Record<string, readonly [number, number]>;

export type NumericSettingKey = keyof typeof NUMERIC_SETTINGS;

export const DEFAULT_SETTINGS: GamSettings = {
  enabled: false,
  startDate: null,
  attendanceOnTimeCoins: 5,
  attendanceLateCoins: 2,
  absencePenaltyCoins: 10,
  homeworkDoneCoins: 5,
  homeworkMissedPenalty: 5,
  activityMaxPerClick: 5,
  activityGroupLimitPerLesson: 30,
  examCoins90: 50,
  examCoins80: 30,
  examCoins70: 20,
  growthThresholdPp: 10,
  growthBonusCoins: 30,
  streakLessons: 13,
  streakBonusCoins: 20,
  streakRuleChangedAt: null,
  referralBonusCoins: 100,
  dailyDeductionLimit: 20,
  objectionDays: 7,
  kidsMaxGrade: 6,
  wishlistMax: 5,
  monthCloseDay: 1,
  levels: DEFAULT_LEVELS,
};

// ── Tanga sabablari (TZ 4.4, 4.9, 6.3) ─────────────────────────────────

export type SystemReasonCode =
  | "attendance"
  | "absence"
  | "homework_done"
  | "homework_missed"
  | "activity"
  | "exam_result"
  | "growth"
  | "streak"
  | "referral";

export type ReasonAllowedRoles = "teacher" | "branch_admin" | "both";

export const ALLOWED_ROLE_LABELS: Record<ReasonAllowedRoles, string> = {
  teacher: "Ustoz",
  branch_admin: "Filial admini",
  both: "Ustoz va admin",
};

/** Qo'shimcha sababda «bir o'quvchiga kuniga» tanlovlari (0 — cheklovsiz). */
export const PER_DAY_LIMITS = [0, 1, 2, 3, 5] as const;

export interface CoinReason {
  id: number;
  /** Faqat tizim sabablarida. */
  code: SystemReasonCode | null;
  name: string;
  direction: 1 | -1;
  /** Qo'shimcha sababda majburiy; tizim sababida null (miqdor sozlamalarda). */
  amountMin: number | null;
  amountMax: number | null;
  allowedRoles: ReasonAllowedRoles | null;
  perDayLimit: number;
  noteRequired: boolean;
  isSystem: boolean;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Faol yozuvlarda necha marta ishlatilgan (ro'yxatda hisoblanadi). */
  usedCount?: number;
}

/**
 * Tizim sabablari — avtomatik jarayon yoki dars tugmasiga bog'langan.
 * Nomi va kodi o'zgarmaydi, o'chirilmaydi; miqdori sozlamalardagi `fields`
 * kalitlarida (label — tahrirlash oynasidagi maydon nomi).
 */
export const SYSTEM_REASONS: {
  code: SystemReasonCode;
  name: string;
  direction: 1 | -1;
  who: string;
  fields: { key: NumericSettingKey; label: string }[];
}[] = [
  {
    code: "attendance",
    name: "Davomat (keldi / kechikdi)",
    direction: 1,
    who: "Avto · Davomat bo'limi",
    fields: [
      { key: "attendanceOnTimeCoins", label: "Vaqtida keldi" },
      { key: "attendanceLateCoins", label: "Kechikib keldi" },
    ],
  },
  { code: "homework_done", name: "Uy vazifasi bajarildi", direction: 1, who: "Ustoz · ✓ tugmasi", fields: [{ key: "homeworkDoneCoins", label: "Tanga" }] },
  {
    code: "activity",
    name: "Darsdagi faollik",
    direction: 1,
    who: "Ustoz · +1…+5 tugmalari",
    fields: [
      { key: "activityMaxPerClick", label: "Bir bosishda maksimum (1–5)" },
      { key: "activityGroupLimitPerLesson", label: "Bir darsda guruhga jami limit" },
    ],
  },
  {
    code: "exam_result",
    name: "Sarhisob natijasi",
    direction: 1,
    who: "Avto · Sarhisob saqlanganda",
    fields: [
      { key: "examCoins90", label: "90% va yuqori" },
      { key: "examCoins80", label: "80–89%" },
      { key: "examCoins70", label: "70–79%" },
    ],
  },
  {
    code: "growth",
    name: "O'sish bonusi",
    direction: 1,
    who: "Avto · Sarhisob saqlanganda",
    fields: [
      { key: "growthBonusCoins", label: "Tanga" },
      { key: "growthThresholdPp", label: "O'sish chegarasi (foiz punkt)" },
    ],
  },
  {
    code: "streak",
    name: "Uzluksiz davomat bonusi",
    direction: 1,
    who: "Avto · Davomat bo'limi",
    fields: [
      { key: "streakBonusCoins", label: "Tanga" },
      { key: "streakLessons", label: "Necha dars ketma-ket (1 oy ≈ 13 dars)" },
    ],
  },
  { code: "referral", name: "Do'st olib keldi", direction: 1, who: "Filial admini · do'st to'lov qilgach", fields: [{ key: "referralBonusCoins", label: "Tanga" }] },
  { code: "absence", name: "Sababsiz dars qoldirish", direction: -1, who: "Avto · Davomat bo'limi", fields: [{ key: "absencePenaltyCoins", label: "Tanga" }] },
  { code: "homework_missed", name: "Uy vazifasini bajarmaslik", direction: -1, who: "Ustoz · ✗ tugmasi", fields: [{ key: "homeworkMissedPenalty", label: "Tanga" }] },
];

/**
 * Boshlang'ich qo'shimcha sabablar (TZ 4.9.5, namuna JSON). Faqat BIR MARTA
 * yoziladi — direktor keraksizini o'chirsa, qayta paydo bo'lmaydi.
 */
export const SEED_REASONS: Omit<CoinReason, "id" | "code" | "isSystem" | "deletedAt" | "createdAt" | "updatedAt">[] = [
  { name: "Olimpiada yoki tanlovda qatnashdi", direction: 1, amountMin: 30, amountMax: 30, allowedRoles: "branch_admin", perDayLimit: 0, noteRequired: false, isActive: true },
  { name: "Olimpiada yoki tanlovda g'olib bo'ldi", direction: 1, amountMin: 50, amountMax: 150, allowedRoles: "branch_admin", perDayLimit: 0, noteRequired: true, isActive: true },
  { name: "Qo'shimcha kitob o'qib, taqdimot qildi", direction: 1, amountMin: 20, amountMax: 20, allowedRoles: "teacher", perDayLimit: 1, noteRequired: false, isActive: true },
  { name: "Sinfdoshiga yordam berdi", direction: 1, amountMin: 1, amountMax: 5, allowedRoles: "teacher", perDayLimit: 2, noteRequired: false, isActive: true },
  { name: "Intizom buzilishi", direction: -1, amountMin: 5, amountMax: 20, allowedRoles: "teacher", perDayLimit: 0, noteRequired: true, isActive: true },
  { name: "Darsga tayyorlanmay keldi (daftar, kitob yo'q)", direction: -1, amountMin: 5, amountMax: 5, allowedRoles: "teacher", perDayLimit: 1, noteRequired: true, isActive: true },
  { name: "Markaz mulkiga zarar yetkazdi", direction: -1, amountMin: 10, amountMax: 20, allowedRoles: "branch_admin", perDayLimit: 0, noteRequired: true, isActive: false },
];

// ── Tanga yozuvlari (TZ 6.4) ───────────────────────────────────────────

export type TxType = SystemReasonCode | "reason" | "shop";

/** Manbadan (Davomat, Sarhisob) hisoblanadi — qo'lda bekor qilinmaydi (TZ 2, 4.11.3). */
export const AUTO_TX_TYPES: readonly TxType[] = ["attendance", "absence", "streak", "exam_result", "growth"];

export const TX_TYPE_LABELS: Record<TxType, string> = {
  attendance: "Davomat",
  absence: "Davomat",
  homework_done: "Uy vazifasi",
  homework_missed: "Uy vazifasi",
  activity: "Faollik",
  exam_result: "Sarhisob",
  growth: "O'sish bonusi",
  streak: "Uzluksiz davomat",
  referral: "Do'st olib keldi",
  reason: "Sabab",
  shop: "Do'kon",
};

export type TxCreatorRole = "system" | GamRole;

export interface CoinTransaction {
  id: number;
  pupilId: number;
  /** null — guruhsiz (reytingga kirmaydi): do'st bonusi, xarid, «Guruhsiz» sabab. */
  groupId: number | null;
  branchId: number;
  /** Qaysi kunga tegishli (YYYY-MM-DD) — TZ 6.4 dagi qoida. */
  date: string;
  type: TxType;
  reasonId: number | null;
  reasonName: string | null;
  /** So'ralgan miqdor (ishorali) — reyting, musobaqa, kunlik limit shu bo'yicha. */
  amount: number;
  /** Balansga haqiqiy ta'sir (balans 0 dan pastga tushmaydi). */
  applied: number;
  note: string;
  createdByUserId: string | null;
  createdByName: string;
  createdByRole: TxCreatorRole;
  createdAt: string;
  status: "active" | "cancelled";
  cancelledByUserId?: string | null;
  cancelledByName?: string | null;
  cancelledAt?: string | null;
  cancelNote?: string | null;
  /** Bekor qilinganda balansga haqiqiy ta'sir (TZ 4.1.5). */
  reversed?: number | null;
  examMonth?: string | null;
  examPercent?: number | null;
  examId?: number | null;
  leadId?: number | null;
  shopOrderId?: number | null;
}

/** Hamyon keshi (TZ 6.5) — istalgan vaqtda yozuvlardan qayta hisoblanadi. */
export interface StudentWallet {
  pupilId: number;
  balance: number;
  earnedTotal: number;
  levelPosition: number;
  updatedAt: string;
}
