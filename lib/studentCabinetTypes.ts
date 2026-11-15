import type { ReceiptBranch, ReceiptProfile } from "@/lib/receiptProfile";

// O'QUVCHI KABINETI (v2, 28-qism) — server (lib/studentCabinet.ts) va mijoz
// (components/student-web/v2/*) BO'LISHADIGAN shakl. Bu faylda FAQAT tip va sof
// konstanta: mijoz to'plamiga server zanjiri (mongodb, next/server) tortilmasin.
//
// Manba: POST /api/student-web/me javobidagi `cabinet` maydoni. Hisob xato bersa
// `cabinet: null` — eski kabinet baribir ochiladi (u `cabinet` siz ishlaydi).
//
// PUL QOIDASI — xodimlardagi «Qarzdorlar» hisoboti bilan AYNAN BIR XIL
// (lib/debtors.ts → computeDebtors): qarz = guruh jadvali bo'yicha BUGUNGACHA
// o'tgan darslar × bitta dars narxi − to'langan. Ota-ona markazga qo'ng'iroq
// qilganda kassadagi xodim ko'rgan raqam bilan bu yerdagi raqam bir xil bo'lishi
// SHART — shu sabab alohida «oylik to'lov» modeli qurilmagan.

/** "YYYY-MM-DD" */
export type IsoDay = string;
/** "YYYY-MM" */
export type IsoMonth = string;

/** Davomat belgisi (lib/attendance.ts → AttendanceStatus bilan bir xil qiymatlar). */
export type CabinetMark = "keldi" | "kechikdi" | "birinchi" | "sababli" | "sababsiz";

export interface CabinetGroup {
  id: number;
  /** Kartalardagi nom: «Ingliz tili · 2-bosqich»; bosqich yo'q bo'lsa — lib/groups.ts → groupLabel. */
  title: string;
  /** groupLabel — «Matematika (13-guruh)». */
  label: string;
  /** Fan rangi uchun (components/v2/ui/fan.ts → fanOf). */
  course: string;
  level: string;
  teacher: string;
  room: string;
  /** Bazadagi jadval matni («Juft kunlar», «Du,Ju»). */
  day: string;
  /** JS getDay(): 0=Yakshanba … 6=Shanba (lib/attendance.ts → groupWeekdays). */
  weekdays: number[];
  /** «16:00» — boshlanish; noma'lum bo'lsa "". */
  start: string;
  /** «18:00» — tugash; noma'lum bo'lsa "". */
  end: string;
  /** Oylik narx (lib/coursePrice.ts → monthlyPriceFor); yo'q — null. */
  monthlyPrice: number | null;
  /** «active» | «gathering» (yig'ilayotgan — darslar hali boshlanmagan) | boshqa. */
  status: string;
  /** O'quvchi guruhga qo'shilgan kun (group_memberships.joinedAt); noma'lum — null. */
  joinedAt: IsoDay | null;
}

/** Bitta dars (jadvaldan) yoki jadvalda yo'q kunga qo'yilgan davomat belgisi. */
export interface CabinetLesson {
  date: IsoDay;
  /** 0=Yakshanba … 6=Shanba. */
  weekday: number;
  groupId: number;
  /** CabinetGroup.title */
  title: string;
  course: string;
  start: string;
  end: string;
  room: string;
  teacher: string;
  /** Qo'yilgan davomat belgisi; hali qo'yilmagan — null. */
  mark: CabinetMark | null;
  /** Sababli bo'lsa — sababi. */
  reason: string | null;
  /** Dars bahosi (1..5), qo'yilmagan — null. */
  grade: number | null;
}

/** «Oylar bo'yicha» jadvalining bitta katagi (guruh × oy). */
export type CabinetCellState =
  /** Hisob bor va to'liq yopilgan. */
  | "paid"
  /** Hisobning bir qismi yopilgan. */
  | "partial"
  /** Hisob bor, hech qismi yopilmagan. */
  | "debt"
  /** Kelgusi oy — hali hisoblanmagan; `expected` ko'rsatiladi. */
  | "future"
  /** Shu oyda shu guruhda darsi yo'q (a'zo emas / boshlanmagan). */
  | "none";

export interface CabinetMonthCell {
  month: IsoMonth;
  state: CabinetCellState;
  /** Shu oyda shu guruh bo'yicha hisoblangan (darslar × dars narxi; joriy oyda — bugungacha). */
  charge: number;
  /** Shundan yopilgani. */
  covered: number;
  /** charge − covered (≥ 0). */
  remaining: number;
  /** Faqat `future`: to'liq oy kutilayotgan summa (jadvaldagi darslar × dars narxi). */
  expected: number;
}

export interface CabinetMonthRow {
  groupId: number;
  title: string;
  course: string;
  monthlyPrice: number | null;
  /** `CabinetMonths.list` bilan bir xil tartib va uzunlik. */
  cells: CabinetMonthCell[];
}

export interface CabinetMonths {
  /** Ustunlar: 4 ta o'tgan oy + joriy + kelgusi (eskidan yangiga). */
  list: IsoMonth[];
  current: IsoMonth;
  rows: CabinetMonthRow[];
  /** Har ustun bo'yicha qolgan qarz yig'indisi (`list` tartibida; kelgusi oy — 0). */
  remainingByMonth: number[];
  /**
   * `list[0]` dan OLDINGI oylarda qolgan qarz (jadvalga sig'magan). Shart:
   * olderRemaining + Σ remainingByMonth = debt.total.
   */
  olderRemaining: number;
}

export interface CabinetDebtPart {
  groupId: number;
  title: string;
  course: string;
  /** Shu guruh bo'yicha qolgan qarz (oylar jadvali katakchalari yig'indisi). */
  remaining: number;
  /** Qarzli eng eski oy — «sentabrdan beri» kabi yozuv uchun; qarz yo'q — null. */
  since: IsoMonth | null;
  /** Qisman yopilgan (masalan «300 000 dan qoldi»): shu qarzli oylarning jami hisobi. */
  charged: number;
}

export interface CabinetDebt {
  /** Hisob sanasi (bugun, Toshkent). */
  asOf: IsoDay;
  /** computeDebtors bilan AYNAN bir xil: charged − paid. Musbat — qarz, manfiy — oldindan to'langan. */
  balance: number;
  /** max(0, balance). */
  total: number;
  /** max(0, −balance) — oldindan to'langan. */
  advance: number;
  /** Guruhlar bo'yicha (faqat qarzi borlari, kattasidan). */
  parts: CabinetDebtPart[];
  /** Bironta guruhda narx/jadval/boshlanish sanasi yo'q — hisob to'liq emas (xodimdagi «hisob to'liq emas»). */
  incomplete: boolean;
}

export interface CabinetPayment {
  /** transaction_entries.id — chek raqami. */
  id: number;
  date: IsoDay;
  /** «18:07»; yo'q bo'lsa "". */
  time: string;
  /** Ishorali: to'lov musbat, qaytarilgan pul manfiy. */
  amount: number;
  /** Tanga evaziga chegirma (so'm), bo'lmasa 0. */
  discount: number;
  /** «Naqd», «Plastik», … */
  paymentType: string;
  /** Qaysi oy uchun (periodMonth; yo'q bo'lsa sananing oyi). */
  periodMonth: IsoMonth;
  /** Kassa nomi; topilmasa "". */
  cashbox: string;
  cancelled: boolean;
  /** O'quvchiga pul qaytarilgan yozuv. */
  refund: boolean;
}

export interface CabinetPaid {
  /** Bekor qilinmagan to'lovlar yig'indisi (qaytarimlar ayrilgan) — computeDebtors `paid` bilan bir xil. */
  total: number;
  /** Bekor qilinmagan to'lovlar soni (qaytarimsiz). */
  count: number;
  /** Eng birinchi to'lov kuni; to'lov yo'q — null. */
  since: IsoDay | null;
}

export interface CabinetNextMonth {
  month: IsoMonth;
  /** Faol guruhlar bo'yicha to'liq oy: jadvaldagi darslar × dars narxi. */
  expected: number;
  /** Hisobga kirgan guruhlar soni. */
  groups: number;
}

export interface CabinetAttendance {
  month: IsoMonth;
  /** keldi + kechikdi + birinchi (lib/attendance.ts → cameStatus). */
  came: number;
  excused: number;
  missed: number;
  /** Belgi qo'yilgan darslar. */
  total: number;
  /** came / total × 100 (butun); belgi yo'q — null. */
  percent: number | null;
}

export interface CabinetCoins {
  balance: number;
  /** Shu oyda olingan tangalar (+130). */
  monthEarned: number;
  /** Guruhlardagi eng yaxshi o'rin (joriy oy reytingi); reyting yo'q — null. */
  bestRank: { groupId: number; title: string; rank: number; total: number } | null;
  /** Istaklar ro'yxatidagi birinchi sovg'a; yo'q — null. */
  wish: { title: string; price: number; ready: boolean } | null;
}

/** Sarhisob natijasi (Imtihon → Sarhisob, `group_exams`). */
export interface CabinetResult {
  examId: number;
  date: IsoDay;
  month: IsoMonth;
  /** CabinetGroup.title uslubida: «Ingliz tili · 2-bosqich»; guruhsiz — fan nomi. */
  title: string;
  course: string;
  correct: number;
  total: number;
  /** O'quvchi foizi (butun). */
  pct: number;
  /** Guruh o'rtachasi (butun). */
  groupAvg: number;
  /** Guruh ichidagi o'rni (teng natija — teng o'rin); hisoblab bo'lmasa null. */
  rank: number | null;
  /** Natija kiritilgan o'quvchilar soni. */
  participants: number;
}

export interface StudentCabinet {
  /** Bugun (Toshkent). */
  today: IsoDay;
  /** Hozir «HH:mm» (Toshkent) — «keyingi dars» va «bugun» hisoblari uchun. */
  now: string;
  /** Salomlashuvdagi ism («Salom, Diyora!»). */
  firstName: string;
  /** To'lov joyi: o'quvchi filiali (manzil va telefon — Sozlamalar → Filiallar). */
  branch: ReceiptBranch;
  /** Chek uchun: markaz chek sozlamasi + filial (Sozlamalar → Markaz ma'lumotlari). */
  receipt: { profile: ReceiptProfile; branch: ReceiptBranch };
  /** Hozir a'zo bo'lgan guruhlar. */
  groups: CabinetGroup[];
  /**
   * Darslar oynasi: o'tgan oyning 1-kunidan bugundan 21 kun keyingacha — jadval darslari
   * va jadvaldan tashqari qo'yilgan davomat belgilari, sana va vaqt bo'yicha tartiblangan.
   */
  lessons: { from: IsoDay; to: IsoDay; items: CabinetLesson[] };
  /** Bugundan keyin boshlanadigan eng yaqin dars (bugungi hali boshlanmagani ham); yo'q — null. */
  upcoming: CabinetLesson | null;
  debt: CabinetDebt;
  months: CabinetMonths;
  nextMonth: CabinetNextMonth;
  paid: CabinetPaid;
  /** To'lov tarixi — yangidan eskiga, ko'pi bilan 200 ta (bekor qilinganlar ham, belgisi bilan). */
  payments: CabinetPayment[];
  /** Jami to'lovlar soni (ro'yxat kesilgan bo'lsa «yana N ta»). */
  paymentsTotal: number;
  /** Joriy oy davomati. */
  attendance: CabinetAttendance;
  /** Gamifikatsiya o'chiq — null. */
  coins: CabinetCoins | null;
  /** Sarhisob natijalari — yangidan eskiga, ko'pi bilan 24 ta. */
  results: CabinetResult[];
}

/** Kabinet ko'rinishi tanlovi — brauzer xotirasida (localStorage). Sukut — yangi. */
export const STUDENT_UI_KEY = "tizimli_student_ui";
export type StudentUiChoice = "new" | "old";
