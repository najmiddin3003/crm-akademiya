import { NUMERIC_SETTINGS, type GamLevel, type GamSettings, type NumericSettingKey } from "./types";

// GAMIFIKATSIYA — sof qoidalar (Mongo yo'q, klientga ham tushadi): daraja
// hisobi va sozlamalar tekshiruvi. Server HAR DOIM shu yerdan o'tkazadi —
// UI faqat natijani ko'rsatadi (TZ: «hamma tekshiruvlar serverda»).

/** Xato matnidagi maydon nomlari (TZ 10: «{Maydon} {min}–{max} oralig'ida butun son bo'lsin»). */
export const SETTING_LABELS: Record<NumericSettingKey, string> = {
  attendanceOnTimeCoins: "Vaqtida keldi",
  attendanceLateCoins: "Kechikib keldi",
  absencePenaltyCoins: "Sababsiz dars qoldirish",
  homeworkDoneCoins: "Uy vazifasi bajarildi",
  homeworkMissedPenalty: "Uy vazifasini bajarmaslik",
  activityMaxPerClick: "Bir bosishda maksimum",
  activityGroupLimitPerLesson: "Bir darsda guruhga jami limit",
  examCoins90: "90% va yuqori",
  examCoins80: "80–89%",
  examCoins70: "70–79%",
  growthThresholdPp: "O'sish chegarasi",
  growthBonusCoins: "O'sish bonusi",
  streakLessons: "Necha dars ketma-ket",
  streakBonusCoins: "Uzluksiz davomat bonusi",
  referralBonusCoins: "Do'st olib keldi",
  dailyDeductionLimit: "Kunlik ayirish limiti",
  objectionDays: "E'tiroz muddati",
  kidsMaxGrade: "Kichiklar toifasi sinfi",
  wishlistMax: "Istaklar ro'yxati maksimumi",
  monthCloseDay: "Oy yakuni kuni",
};

/**
 * Qat'iy butun son: bo'sh, manfiy, kasr, "1e3" — rad etiladi (prototipdagi
 * `intIn`). Raqam kelsa ham tekshiriladi.
 */
export function intIn(raw: unknown, lo: number, hi: number): number | null {
  const t = String(raw ?? "").trim();
  if (!/^\d+$/.test(t)) return null;
  const v = Number(t);
  return v >= lo && v <= hi ? v : null;
}

/** O'quvchi darajasi — chegarasi «jami topilgan» dan oshmaydigan eng yuqorisi (0 dan). */
export function levelIndexOf(earned: number, levels: GamLevel[]): number {
  let idx = 0;
  levels.forEach((l, i) => {
    if (earned >= l.minEarned) idx = i;
  });
  return idx;
}

type Check<T> = { ok: true; value: T } | { ok: false; error: string };

/** Darajalar (TZ 4.2.4): 5 ta, nom 1–30 belgi va takrorlanmaydi, chegaralar qat'iy o'sadi, 1-si 0. */
export function checkLevels(raw: unknown): Check<GamLevel[]> {
  if (!Array.isArray(raw) || raw.length !== 5) return { ok: false, error: "Darajalar 5 ta bo'lishi kerak" };
  const out: GamLevel[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const r = raw[i] as Partial<GamLevel> | undefined;
    const name = String(r?.name ?? "").trim().replace(/\s+/g, " ");
    if (!name || name.length > 30) return { ok: false, error: "Daraja nomi 1–30 belgi bo'lsin" };
    const key = name.toLowerCase();
    if (seen.has(key)) return { ok: false, error: "Bu nomli daraja bor" };
    seen.add(key);
    let minEarned = 0;
    if (i > 0) {
      const lo = out[i - 1].minEarned + 1;
      const v = intIn(r?.minEarned, lo, 1_000_000);
      if (v === null) {
        const position = i + 1;
        return { ok: false, error: `${position}-daraja chegarasi ${lo}–1000000 oralig'ida butun son bo'lsin` };
      }
      minEarned = v;
    }
    out.push({ position: i + 1, name, minEarned });
  }
  return { ok: true, value: out };
}

/**
 * Sozlamalar yamog'ini tekshiradi va yangi to'liq holatni qaytaradi.
 *
 * `maxNegativeReasonMax` — o'chirilmagan (faol yoki to'xtatilgan)
 * ayiriladigan qo'shimcha sabablar maksimumlarining eng kattasi: kunlik
 * ayirish limitini undan kichik qilib bo'lmaydi (TZ 4.10.4).
 */
export function checkSettingsPatch(
  current: GamSettings,
  patch: Record<string, unknown>,
  maxNegativeReasonMax: number,
): Check<GamSettings> {
  const next: GamSettings = { ...current };
  for (const [k, raw] of Object.entries(patch)) {
    if (!(k in NUMERIC_SETTINGS)) continue;
    const key = k as NumericSettingKey;
    const [lo, hi] = NUMERIC_SETTINGS[key];
    const v = intIn(raw, lo, hi);
    if (v === null) {
      // Nom «…» ichida: ichida bo'shliq bor, mijozdagi teskari moslash
      // (lib/i18n.ts) usiz nomni birinchi so'zda uzib qo'yardi.
      const label = SETTING_LABELS[key];
      return { ok: false, error: `«${label}» ${lo}–${hi} oralig'ida butun son bo'lsin` };
    }
    next[key] = v;
  }
  if (!(next.examCoins90 >= next.examCoins80 && next.examCoins80 >= next.examCoins70)) {
    return { ok: false, error: "Sarhisob tangalari: 90%+ ≥ 80–89% ≥ 70–79% bo'lishi kerak" };
  }
  if (next.homeworkMissedPenalty > next.dailyDeductionLimit) {
    return { ok: false, error: "Uy vazifasini bajarmaslik miqdori kunlik ayirish limitidan oshmasin" };
  }
  if (next.dailyDeductionLimit < maxNegativeReasonMax) {
    const limit = maxNegativeReasonMax;
    return { ok: false, error: `Kunlik ayirish limiti ayiriladigan sabablar maksimumidan (${limit}) kam bo'lmasin` };
  }
  return { ok: true, value: next };
}
