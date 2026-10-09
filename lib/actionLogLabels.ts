// AMALLAR JURNALI YORLIQLARI — «Amallar jurnali» sahifasi (components/admin/
// ActionLogPage.tsx) yozuvni odam tilida ko'rsatishi uchun. Bazada xom kalit
// turadi (`section` = API yo'lining birinchi segmenti, `action` = HTTP usuli
// yoki maxsus amal — lib/actionLog.ts); nom shu yerda, ko'rsatish paytida.
// Ya'ni nom o'zgarsa eski yozuvlar ham yangi nom bilan chiqadi.
//
// Matnlar o'zbekcha — sahifada `t()` bilan o'giriladi (scripts/i18n-scan.mjs
// → CONSTANT_SOURCES bu faylni o'qiydi). Ro'yxatda yo'q bo'lim — kalitning
// o'zi.

/** API bo'limi → nom. */
export const SECTION_LABELS: Record<string, string> = {
  ai: "AI yordamchi",
  attendance: "Davomat",
  "attendance-qr": "QR davomat",
  auth: "Kirish va hisob",
  "block-test-exams": "Blok testlar",
  "block-test-types": "Blok testlar",
  bonuses: "Bonuslar",
  branches: "Filiallar",
  cashboxes: "Kassalar",
  contracts: "Shartnomalar",
  "edu-categories": "Kategoriyalar",
  employees: "Xodimlar",
  equipment: "Jihozlar",
  feedback: "Fikr-mulohazalar",
  "finance-contracts": "Shartnomalar",
  gamification: "Gamifikatsiya",
  "group-tasks": "Guruh vazifalari",
  groups: "Guruhlar",
  "hr-employees": "Xodimlar",
  imtihon: "Imtihonlar",
  "lead-settings": "Lid sozlamalari",
  "management-cv": "Ishga qabul (CV)",
  news: "Yangiliklar",
  "offline-courses": "Oflayn kurslar",
  "online-courses": "Onlayn kurslar",
  orders: "Lidlar",
  penalties: "Jarimalar",
  "planned-expenses": "Rejali xarajatlar",
  profile: "Profil",
  pupils: "O'quvchilar",
  roles: "Rollar",
  rooms: "Xonalar",
  "salary-runs": "Oylik",
  "sales-plans": "Sotuv rejasi",
  "seasonal-assessments": "Mavsumiy baholash",
  sessions: "Qurilmalar",
  settings: "Sozlamalar",
  "settings-lists": "Sozlamalar",
  "sms-messages": "SMS",
  "sms-templates": "SMS",
  sorovnoma: "So'rovnoma",
  "staff-tasks": "Topshiriqlar",
  stories: "Hikoyalar",
  "student-sources": "O'quvchi manbalari",
  students: "O'quvchilar",
  surveys: "So'rovnomalar",
  sync: "Sinxronlash",
  "task-types": "Vazifa turlari",
  tasks: "Vazifalar",
  "teacher-handovers": "Ustoz almashuvi",
  "temp-staff": "Vaqtinchalik xodimlar",
  "transaction-entries": "Tranzaksiyalar",
  "transaction-types": "Kirim-chiqim turlari",
  "work-schedules": "Ish jadvallari",
};

/** Maxsus amal (bot, kirish, tizim) yoki HTTP usuli → nom. */
export const ACTION_LABELS: Record<string, string> = {
  login: "Tizimga kirdi",
  login_failed: "Kirish urinishi muvaffaqiyatsiz",
  kirim: "Kassaga kirim (bot)",
  chiqim: "Kassadan chiqim (bot)",
  transfer: "Boshqa kassaga o'tkazma (bot)",
  method_transfer: "To'lov turini almashtirish (bot)",
  transfer_confirm: "O'tkazmani tasdiqladi (bot)",
  transfer_reject: "O'tkazmani rad etdi (bot)",
  lead: "Lid qo'shdi (bot)",
  lead_holat: "Lid holati (guruh boti)",
  qr_in: "Ishga keldi (QR)",
  qr_out: "Ishdan ketdi (QR)",
  task_failed_fine: "Topshiriq bajarilmadi — jarima",
  POST: "Qo'shdi",
  PUT: "O'zgartirdi",
  PATCH: "O'zgartirdi",
  DELETE: "O'chirdi",
};

/** Muhim yo'llar uchun aniq nom (usul + yo'l andozasi) — umumiy «Qo'shdi» o'rniga. */
const ROUTE_LABELS: { m: string; re: RegExp; label: string }[] = [
  { m: "POST", re: /^\/api\/cashboxes\/\d+\/adjust$/, label: "Kassa: kirim yoki chiqim" },
  { m: "POST", re: /^\/api\/cashboxes\/\d+\/transfer$/, label: "Kassa: to'lov turini almashtirish" },
  { m: "POST", re: /^\/api\/cashboxes\/\d+\/transfer-to$/, label: "Kassa: boshqa kassaga o'tkazma" },
  { m: "POST", re: /^\/api\/cashboxes\/handover$/, label: "Kassa: rahbarga topshirish" },
  { m: "POST", re: /^\/api\/transaction-entries\/\d+\/cancel$/, label: "To'lovni bekor qildi" },
  { m: "POST", re: /^\/api\/transaction-entries\/\d+\/transfer-confirm$/, label: "O'tkazmani tasdiqladi" },
  { m: "POST", re: /^\/api\/transaction-entries\/\d+\/transfer-reject$/, label: "O'tkazmani rad etdi" },
  { m: "POST", re: /^\/api\/salary-runs$/, label: "Oylik chiqardi" },
  { m: "DELETE", re: /^\/api\/salary-runs\/\d+$/, label: "Oylik chiqarishni bekor qildi" },
  { m: "POST", re: /^\/api\/groups\/\d+\/attendance$/, label: "Davomat belgiladi" },
  { m: "POST", re: /^\/api\/groups\/\d+\/students$/, label: "Guruh o'quvchilarini o'zgartirdi" },
  { m: "POST", re: /^\/api\/orders\/\d+\/holat$/, label: "Lid holatini o'zgartirdi" },
  { m: "POST", re: /^\/api\/auth\/logout$/, label: "Tizimdan chiqdi" },
  { m: "POST", re: /^\/api\/auth\/lock$/, label: "Ekranni qulfladi" },
  { m: "POST", re: /^\/api\/auth\/unlock$/, label: "Ekran qulfini ochdi" },
  { m: "POST", re: /^\/api\/auth\/change-password$/, label: "Parolini o'zgartirdi" },
  { m: "POST", re: /^\/api\/auth\/activate$/, label: "Hisobni faollashtirdi" },
  { m: "POST", re: /^\/api\/auth\/forgot-password$/, label: "Parolni tiklash kodi so'radi" },
  { m: "POST", re: /^\/api\/auth\/reset-password$/, label: "Parolni tikladi" },
  { m: "POST", re: /^\/api\/hr-employees\/\d+\/password$/, label: "Xodim parolini o'rnatdi" },
  { m: "POST", re: /^\/api\/ai\/actions\/[^/]+$/, label: "AI amalini tasdiqladi" },
  { m: "DELETE", re: /^\/api\/sessions$/, label: "Qurilmani uzdi" },
];

export interface ActionLabelInput {
  section: string;
  action: string;
  path?: string | null;
}

/** Bo'lim nomi (o'zbekcha kalit — `t()` bilan o'giriladi). */
export function sectionLabel(section: string): string {
  return SECTION_LABELS[section] ?? section;
}

/** Amal nomi: aniq yo'l → maxsus amal → HTTP usuli. */
export function actionLabel(r: ActionLabelInput): string {
  if (r.path) {
    const hit = ROUTE_LABELS.find((x) => x.m === r.action && x.re.test(r.path!));
    if (hit) return hit.label;
  }
  return ACTION_LABELS[r.action] ?? r.action;
}

/** Filtr guruhlari (sahifadagi «Amal turi»). */
export const ACTION_KINDS = [
  { value: "create", label: "Qo'shish", actions: ["POST"] },
  { value: "update", label: "O'zgartirish", actions: ["PUT", "PATCH"] },
  { value: "delete", label: "O'chirish", actions: ["DELETE"] },
  { value: "auth", label: "Kirish", actions: ["login", "login_failed"] },
  {
    value: "bot",
    label: "Bot va QR",
    actions: ["kirim", "chiqim", "transfer", "method_transfer", "transfer_confirm", "transfer_reject", "lead", "lead_holat", "qr_in", "qr_out"],
  },
  { value: "system", label: "Tizim", actions: ["task_failed_fine"] },
] as const;

export type ActionKind = (typeof ACTION_KINDS)[number]["value"];

/** Kim turi → nom. */
export const ACTOR_KIND_LABELS: Record<string, string> = {
  user: "Hisob",
  bot: "Telegram bot",
  miniapp: "Telegram ilova",
  public: "Tizimga kirmagan",
  system: "Tizim",
};
