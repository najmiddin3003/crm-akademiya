// Guruh davomati (Davomat) — umumiy tiplar va dars kunlarini hisoblash.
// API route'lari va klient komponentlar shu faylni bo'lishadi.
// MongoDB kolleksiyasi: `attendance`.
//
// Referens (akademiya.edutizim.uz/group/groups/details/<id>?status=attendance):
// jadval ustunlari guruhning DARS KUNLARIdan avtomatik hosil bo'ladi —
// tanlangan yil+oy ichida guruh jadvaliga to'g'ri keladigan har bir sana
// alohida ustun bo'ladi ("1-dars 03.08", "2-dars 05.08", ...).

export type AttendanceStatus = "keldi" | "birinchi" | "sababli" | "sababsiz";

export interface AttendanceOption {
  key: AttendanceStatus;
  label: string;
  /** Doiracha rangi — referensdagi bilan bir xil. */
  color: string;
}

// Ranglar jonli referensdan (getComputedStyle) olingan — taxmin emas.
export const ATTENDANCE_OPTIONS: AttendanceOption[] = [
  { key: "keldi", label: "Keldi", color: "#28d94f" },
  { key: "birinchi", label: "Birinchi dars", color: "#fbb500" },
  { key: "sababli", label: "Sababli", color: "#1f2937" },
  { key: "sababsiz", label: "Sababsiz", color: "#fc0707" },
];

export const ATTENDANCE_COLOR: Record<AttendanceStatus, string> = {
  keldi: "#28d94f",
  birinchi: "#fbb500",
  sababli: "#1f2937",
  sababsiz: "#fc0707",
};

/** Doiracha ichidagi belgi (referensda har bir holatning o'z ikonkasi bor). */
export type AttendanceGlyph = "check" | "bang" | "minus";
export const ATTENDANCE_GLYPH: Record<AttendanceStatus, AttendanceGlyph> = {
  keldi: "check",
  birinchi: "bang",
  sababli: "bang",
  sababsiz: "minus",
};

/** Baho — referensda ro'yxat ostida 1..5 tugmalari turadi. */
export type AttendanceGrade = 1 | 2 | 3 | 4 | 5;
export const GRADES: AttendanceGrade[] = [1, 2, 3, 4, 5];
/** 1 — qizil, 5 — yashil (referensdagi ranglanish). */
export const GRADE_COLOR: Record<AttendanceGrade, string> = {
  1: "#dc2626",
  2: "#ea580c",
  3: "#a3a812",
  4: "#3f9e3f",
  5: "#28a745",
};

/**
 * "Sababli" tanlanganda chiqadigan "Izoh qoldiring" oynasidagi sabablar
 * (referens ro'yxati bilan bir xil tartibda).
 */
export const ABSENCE_REASONS = [
  "Qattiq kasal bo'lgan",
  "Sinov darsi",
  "Ota-onasi so'radi",
  "Ustozdan ruxsat so'radi",
  "Boshqa",
];

/**
 * Katakcha bo'yicha o'zgarishlar tarixi ("Tarixi" bo'limi).
 * Har bir saqlashda bitta yozuv qo'shiladi — eskisi o'chirilmaydi.
 * MongoDB kolleksiyasi: `attendance_history`.
 */
export interface AttendanceHistoryEntry {
  id: number;
  groupId: number;
  pupilId: number;
  date: string;
  /** O'zgartirgan xodim (users.fullName). */
  author: string;
  /** "15.08.2026 | 00:22" */
  createdAt: string;
  /** Shu o'zgarishdan keyingi holat (null — belgi olib tashlangan). */
  status: AttendanceStatus | null;
  grade: AttendanceGrade | null;
  reason: string | null;
  note: string | null;
}

/** Bitta o'quvchining bitta darsdagi belgisi. */
export interface AttendanceMark {
  groupId: number;
  pupilId: number;
  /** ISO sana, faqat kun aniqligida: "2026-08-03". */
  date: string;
  status: AttendanceStatus;
  /** Shu darsdagi baho (1..5) — "O'rtacha baho" ustuni shundan hisoblanadi. */
  grade?: AttendanceGrade | null;
  /** Dars qoldirish sababi — faqat `sababli` uchun (ABSENCE_REASONS dan). */
  reason?: string | null;
  /** Erkin izoh matni. */
  note?: string | null;
}

// JS `getDay()`: 0=Yakshanba, 1=Dushanba ... 6=Shanba.
const DU = 1, SE = 2, CH = 3, PA = 4, JU = 5, SH = 6, YA = 0;

// constants/groups.js dagi GROUP_DAYS qisqartmalari.
const ABBR: Record<string, number> = {
  ya: YA, du: DU, se: SE, ch: CH, chor: CH, pa: PA, ju: JU, sh: SH,
};

/**
 * Guruhning `day` maydonidan hafta kunlari ro'yxatini chiqaradi.
 *
 * Qo'llab-quvvatlanadigan qiymatlar (constants/groups.js → GROUP_DAYS):
 *   "Toq kunlar"    → Dushanba, Chorshanba, Juma
 *   "Juft kunlar"   → Seshanba, Payshanba, Shanba
 *   "Hafta kunlari" → Dushanba–Juma
 *   "Ya,Ch" / "Du,Ju" / "Se,Sh" / "Chor" — vergul bilan ajratilgan qisqartmalar
 *
 * Tanilmagan qiymatda bo'sh massiv qaytaradi (ustunlar chiqmaydi) — bu
 * noto'g'ri sanalarni to'qib chiqarishdan ko'ra xavfsizroq.
 */
export function groupWeekdays(day: string | undefined | null): number[] {
  if (!day) return [];
  const norm = day.trim().toLowerCase();

  if (norm === "toq kunlar") return [DU, CH, JU];
  if (norm === "juft kunlar") return [SE, PA, SH];
  if (norm === "hafta kunlari") return [DU, SE, CH, PA, JU];

  const out: number[] = [];
  for (const partRaw of norm.split(",")) {
    const part = partRaw.trim();
    if (!part) continue;
    const wd = ABBR[part];
    if (wd !== undefined && !out.includes(wd)) out.push(wd);
  }
  return out.sort((a, b) => a - b);
}

export interface LessonDate {
  /** "2026-08-03" */
  iso: string;
  /** "03.08" — ustun sarlavhasida ko'rsatiladi */
  short: string;
  /** 1 dan boshlanadigan dars tartib raqami ("1-dars") */
  index: number;
}

/** Sanani mahalliy vaqt bo'yicha "YYYY-MM-DD" ga aylantiradi. */
export function toIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Tanlangan yil va oy ichida guruh jadvaliga to'g'ri keladigan barcha
 * dars sanalari. `month` — 1..12.
 *
 * Guruhning faoliyat muddati berilsa (startDate/endDate), undan tashqaridagi
 * sanalar tushib qoladi — referensda ham guruh boshlanmasdan oldingi kunlarga
 * davomat ustuni chiqmaydi.
 */
export function lessonDates(
  day: string | undefined | null,
  year: number,
  month: number,
  bounds?: { start?: Date | null; end?: Date | null },
): LessonDate[] {
  const weekdays = groupWeekdays(day);
  if (weekdays.length === 0) return [];

  const out: LessonDate[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const p = (n: number) => String(n).padStart(2, "0");

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const d = new Date(year, month - 1, dayNum);
    if (!weekdays.includes(d.getDay())) continue;
    if (bounds?.start && d < bounds.start) continue;
    if (bounds?.end && d > bounds.end) continue;
    out.push({
      iso: toIsoDate(d),
      short: `${p(dayNum)}.${p(month)}`,
      index: out.length + 1,
    });
  }
  return out;
}

/**
 * "03.09.2025 - 03.09.2026" ko'rinishidagi `period` satridan boshlanish va
 * tugash sanalarini ajratadi. Format mos kelmasa null qaytaradi.
 */
export function parsePeriod(period: string | undefined | null): { start: Date | null; end: Date | null } {
  if (!period) return { start: null, end: null };
  const m = period.match(/(\d{2})\.(\d{2})\.(\d{4})\s*-\s*(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return { start: null, end: null };
  const [, d1, m1, y1, d2, m2, y2] = m;
  return {
    start: new Date(Number(y1), Number(m1) - 1, Number(d1)),
    end: new Date(Number(y2), Number(m2) - 1, Number(d2)),
  };
}

// Oy nomlari lib/i18n.ts ga ko'chirildi — ular navbardagi til tanloviga
// bog'liq va bir nechta komponent bo'lishadi.
