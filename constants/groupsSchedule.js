// Guruh → Dars jadvali (group/class-schedule) uchun konfiguratsiya.
// Guruhlarning o'zi /api/groups dan keladi (constants/groups.js GROUP_SEED
// asosida seed qilingan) — bu yerda faqat: kun tablari, vaqt o'qi va
// guruh.day ("Toq kunlar" kabi) ni haftaning aniq kuniga moslashtiruvchi
// qoidalar bor. Backend spetsifikatsiyasida (day_pattern: 'toq'|'juft'|'har_kuni')
// aniq hafta kuni yozilmagan — shu sababli o'quv markazlarida keng tarqalgan
// standart konvensiya qo'llanildi: Toq kunlar = Du/Chor/Ju, Juft kunlar = Se/Pa/Sha.
// Kerak bo'lsa DAY_PATTERN_MAP'ni backend qoidasiga moslab o'zgartirish oson.

export const SCHEDULE_DAY_ORDER = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
export const SCHEDULE_DAY_LABELS = ["Yak", "Du", "Se", "Chor", "Pa", "Ju", "Sha"];
export const SCHEDULE_DAY_LONG = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

// 06:00 dan 22:00 gacha, 30 daqiqalik slotlar (guruh.time har doim shu oraliqda,
// GROUP_TIMES eng kechi "18:00 - 20:00").
export const SCHEDULE_TIME_SLOTS = (() => {
  const fmt = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  const out = [];
  for (let m = 6 * 60; m < 22 * 60; m += 30) out.push(`${fmt(m)} - ${fmt(m + 30)}`);
  return out;
})();
const SCHEDULE_START_MIN = 6 * 60;

// guruh.day (constants/groups.js GROUP_DAYS) → shu qoida bo'yicha qaysi hafta
// kunlarida dars bo'ladi.
const DAY_PATTERN_MAP = {
  "Toq kunlar": ["dushanba", "chorshanba", "juma"],
  "Juft kunlar": ["seshanba", "payshanba", "shanba"],
  "Hafta kunlari": ["dushanba", "seshanba", "chorshanba", "payshanba", "juma"],
  "Ya,Ch": ["yakshanba", "chorshanba"],
  "Ya,Pa": ["yakshanba", "payshanba"],
  "Chor": ["chorshanba"],
  "Du,Ju": ["dushanba", "juma"],
  "Se,Sh": ["seshanba", "shanba"],
  "Ya,Du,Ch,Ju": ["yakshanba", "dushanba", "chorshanba", "juma"],
};

export function weekdaysForDayPattern(pattern) {
  return DAY_PATTERN_MAP[pattern] || [];
}

// Kurs bo'yicha barqaror rang (constants/groups.js GROUP_COURSES bilan mos).
const COURSE_COLORS = {
  "Ingliz tili": "#7c2d3a",
  "Arab tili": "#0e7490",
  "Rus tili": "#dc2626",
  "Matematika": "#10b981",
  "Fizika": "#8b5cf6",
  "Biologiya": "#1e293b",
  "Kimyo": "#b91c1c",
  "Tarix": "#f59e0b",
  "Ona tili": "#0891b2",
};

export function courseColor(course) {
  return COURSE_COLORS[course] || "#64748b";
}

// "08:00 - 10:00" → { startSlot, span } (SCHEDULE_TIME_SLOTS bo'yicha, 30 daq. birlik).
// Diapazondan tashqari yoki noto'g'ri qiymatda startSlot=-1 qaytadi (chizilmaydi).
export function parseTimeRange(time) {
  const [from, to] = String(time || "").split(" - ");
  const toMinutes = (t) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec((t || "").trim());
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const startAbs = toMinutes(from);
  const endAbs = toMinutes(to);
  if (startAbs === null || endAbs === null || endAbs <= startAbs) return { startSlot: -1, span: 1 };
  const startSlot = Math.round((startAbs - SCHEDULE_START_MIN) / 30);
  const span = Math.max(1, Math.round((endAbs - startAbs) / 30));
  if (startSlot < 0 || startSlot >= SCHEDULE_TIME_SLOTS.length) return { startSlot: -1, span };
  return { startSlot, span };
}
