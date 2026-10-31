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
  "attendance-qr": "Ishga keldim",
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
  qr_in: "Ishga keldi",
  qr_out: "Ishdan ketdi",
  face_enroll: "Yuzini ro'yxatdan o'tkazdi (Face ID)",
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
  { m: "DELETE", re: /^\/api\/hr-employees\/\d+\/face$/, label: "Xodim yuzini o'chirdi (Face ID)" },
  { m: "PATCH", re: /^\/api\/hr-employees\/\d+\/face$/, label: "Face ID ozodligini o'zgartirdi" },
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
    label: "Bot va «Ishga keldim»",
    actions: ["kirim", "chiqim", "transfer", "method_transfer", "transfer_confirm", "transfer_reject", "lead", "lead_holat", "qr_in", "qr_out", "face_enroll"],
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

// ── YANGI VERSIYA — «AMALLAR JURNALI» (25.10.2026, 14-qism; lib/actionLogView.ts) ──────────
// Yozuv odam tilida: «Sarkor Shukurjonov kirim qo'shdi — Muxlisa Xoshimjanova». Fe'llar va
// maydon nomlari shu yerda (skaner `kalit: "matn",` qatorlarini o'qiydi — har biri o'z qatorida).

/** Amal fe'li (ism va obyekt orasida). */
export const LOG_VERBS = {
  login: "tizimga kirdi",
  login_failed: "kira olmadi",
  logout: "tizimdan chiqdi",
  lock: "ekranni qulfladi",
  unlock: "ekran qulfini ochdi",
  change_password: "parolini o'zgartirdi",
  activate: "hisobini faollashtirdi",
  forgot_password: "parolni tiklash kodini so'radi",
  reset_password: "parolini tikladi",
  session_drop: "qurilmani uzdi",
  kirim: "kirim qo'shdi",
  chiqim: "chiqim qildi",
  method_transfer: "to'lov turini almashtirdi",
  transfer_to: "boshqa kassaga o'tkazdi",
  handover: "kassani rahbarga topshirdi",
  payment_cancel: "to'lovni bekor qildi",
  transfer_confirm: "o'tkazmani tasdiqladi",
  transfer_reject: "o'tkazmani rad etdi",
  salary_run: "oylik chiqardi",
  salary_run_cancel: "oylik chiqarishni bekor qildi",
  teacher_share: "ustoz ulushini yopdi",
  teacher_share_undo: "ustoz ulushini qaytardi",
  pupil_add: "o'quvchi qo'shdi",
  pupil_edit: "o'quvchini tahrirladi",
  pupil_status: "o'quvchi holatini o'zgartirdi",
  pupil_delete: "o'quvchini o'chirdi",
  group_add: "guruh qo'shdi",
  group_edit: "guruhni tahrirladi",
  group_delete: "guruhni o'chirdi",
  group_pupils: "guruhga o'quvchi qo'shdi",
  group_pupil_remove: "o'quvchini guruhdan chiqardi",
  attendance: "davomat belgiladi",
  lesson_add: "dars qo'shdi",
  lesson_delete: "darsni o'chirdi",
  lead_add: "lid qo'shdi",
  lead_edit: "lidni tahrirladi",
  lead_holat: "lid holatini o'zgartirdi",
  lead_comment: "lidga izoh yozdi",
  employee_add: "xodim qo'shdi",
  employee_edit: "xodimni tahrirladi",
  employee_delete: "xodimni o'chirdi",
  employee_password: "xodim parolini o'rnatdi",
  qr_in: "ishga keldi",
  qr_out: "ishdan ketdi",
  face_enroll: "yuzini ro'yxatdan o'tkazdi (Face ID)",
  face_reset: "xodim yuzini o'chirdi (Face ID)",
  face_exempt: "Face ID ozodligini o'zgartirdi",
  task_done: "topshiriqni bajardi",
  task_approve: "topshiriqni tasdiqladi",
  task_return: "topshiriqni qaytardi",
  task_fine: "topshirig'i bajarilmadi — jarima",
  add: "qo'shdi",
  edit: "o'zgartirdi",
  remove: "o'chirdi",
} as const;

export type LogVerbKey = keyof typeof LOG_VERBS;

/** «Oldin → keyin» jadvalidagi maydon nomlari (ro'yxatda yo'q kalit — o'zi). */
export const LOG_FIELD_LABELS: Record<string, string> = {
  name: "Nomi",
  firstName: "Ism",
  lastName: "Familiya",
  phone: "Telefon",
  extraPhone: "Qo'shimcha telefon",
  fatherName: "Otasining ismi",
  fatherPhone: "Otasining telefoni",
  fatherWork: "Otasining ishi",
  motherName: "Onasining ismi",
  motherPhone: "Onasining telefoni",
  motherWork: "Onasining ishi",
  birthDate: "Tug'ilgan sana",
  category: "Kategoriya",
  status: "Holat",
  statusReason: "Holat sababi",
  address: "Manzil",
  studyPlace: "O'qish joyi",
  note: "Izoh",
  comment: "Izoh",
  email: "Email",
  tags: "Teglar",
  grade: "Sinf",
  source: "Manba",
  subsource: "Kichik manba",
  moderator: "Moderator",
  language: "Til",
  debtLimit: "Qarz chegarasi",
  paymentDate: "To'lov kuni",
  lessonTime: "Dars vaqti",
  course: "Kurs",
  level: "Bosqich",
  day: "Dars kunlari",
  time: "Dars vaqti",
  teacher: "O'qituvchi",
  assistant: "Yordamchi o'qituvchi",
  room: "Xona",
  startDate: "Boshlanish sanasi",
  endDate: "Tugash sanasi",
  eduType: "Ta'lim turi",
  telegram: "Telegram guruh",
  period: "Davr",
  price: "Narx",
  amount: "Summa",
  firstLesson: "Birinchi dars",
  group: "Guruh",
  survey: "So'rovnoma",
  subcourse: "Yo'nalish",
  percent: "Foiz",
  kurs: "Kurs",
  degree: "Daraja",
  employmentRate: "Bandlik",
  salaryStartDate: "Ishga kirgan sana",
  salaryEndDate: "Ishdan ketgan sana",
  branchIds: "Filiallar",
  payrollBranchId: "Oylik filiali",
  gender: "Jins",
  photoUrl: "Rasm",
  title: "Nomi",
  description: "Tavsif",
  deadline: "Muddat",
  capacity: "Sig'imi",
  month: "Oy",
};

/**
 * Toifalar — «Hammasi · Moliya · O'quvchi va guruh · …» chiplari, «Davr bo'yicha» va «Nima
 * yoziladi». Tartib — ekrandagidek; har obyekt bitta qatorda (skaner `key:` ni kalit deb olmasin).
 */
export const LOG_CATEGORIES = [
  { key: "finance", label: "Moliya", about: "kirim, chiqim, ko'chirish, oylik chiqarish" },
  { key: "pupils", label: "O'quvchi va guruh", about: "qo'shish, tahrirlash, ko'chirish, arxivlash" },
  { key: "leads", label: "Lidlar", about: "qo'shish, tahrirlash, holat va izohlar" },
  { key: "attendance", label: "Davomat", about: "darslardagi davomat va darslar" },
  { key: "staff", label: "Xodimlar", about: "xodimlar, rollar, topshiriqlar, ishga kelish" },
  { key: "auth", label: "Kirishlar", about: "kim, qachon, qaysi qurilmadan" },
  { key: "deleted", label: "O'chirilganlar", about: "nima, kim tomonidan, qaysi sabab bilan" },
  { key: "other", label: "Boshqa", about: "sozlamalar va qolgan bo'limlar" },
] as const;

export type LogCategory = (typeof LOG_CATEGORIES)[number]["key"];
