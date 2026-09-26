import { uzNow } from "./uzTime";
// O'quvchilar — MongoDB'dagi "pupils" kolleksiyasi. Bu loyihadagi
// o'quvchilarning YAGONA manbasi: "O'quvchi qo'shish" (AddStudentModal) orqali
// qo'shilganlar ham, scripts/seed-test-pupils.js bilan bazaga yozilgan test
// o'quvchilar ham shu yerda. Ilgari yonida constants/index.js (STUDENTS, 50 ta)
// va constants/studentsList.js (STUDENTS_LIST, 5909 ta) statik demo ro'yxatlari
// turardi — ular olib tashlandi, endi hamma joy /api/pupils dan o'qiydi.

/**
 * O'quvchining holati. Ilgari bunday maydon umuman yo'q edi va
 * "Aktiv o'quvchilar" / "Muzlatilgan" / "Arxiv" sahifalari bilan KPI
 * kartalari sonni `i % 13` kabi indeks arifmetikasidan o'ylab topardi.
 */
export const PUPIL_STATUSES = ["Aktiv", "Muzlatilgan", "Arxiv"] as const;
export type PupilStatus = (typeof PUPIL_STATUSES)[number];

/** Yozuvda holat bo'lmasa (eski o'quvchilar) — "Aktiv". */
export function pupilStatusOf(p: Pick<Pupil, "status">): PupilStatus {
  return p.status && PUPIL_STATUSES.includes(p.status) ? p.status : "Aktiv";
}

export function isPupilStatus(v: unknown): v is PupilStatus {
  return PUPIL_STATUSES.includes(v as PupilStatus);
}

export interface Pupil {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  extraPhone: string;
  category: string;
  birthDate: string;
  createdAt: string;
  /** Balans (UZS) — manfiy bo'lsa qarzdor. Yangi o'quvchida 0. */
  balance?: number;
  /** Gamifikatsiya koinlari. Yangi o'quvchida 0. */
  coin?: number;
  /**
   * Maktabdagi sinfi (1–11) — gamifikatsiyada toifa (kichiklar/kattalar)
   * shundan aniqlanadi (TZ 4.21.4). Bo'sh — katta (masalan kattalar kursi).
   */
  grade?: number | null;
  /** O'quvchini olib borayotgan moderator. */
  moderator?: string;
  /** Qayerdan keldi (Instagram, Telegram, Tavsiya...). */
  source?: string;

  /**
   * O'quvchining holati. Yozuvda yo'q bo'lsa "Aktiv" hisoblanadi (eski
   * yozuvlar shu maydonsiz yaratilgan). Faqat /api/pupils/:id/status
   * o'zgartiradi — oddiy profil formasi orqali emas.
   */
  status?: PupilStatus;
  /** "Muzlatilgan"/"Arxiv" ga o'tkazilgan sana ("YYYY-MM-DD"). */
  statusChangedAt?: string;
  /** Muzlatish/arxivlash sababi (ro'yxatlarda va hisobotlarda ko'rinadi). */
  statusReason?: string;

  // --- O'quvchi profilidagi ("Tahrirlash" tabi) qo'shimcha maydonlar ---
  // Hammasi ixtiyoriy: eski yozuvlarda yo'q va forma bo'sh qoldirilishi mumkin.
  email?: string;
  tags?: string;
  /** Dars shakli/vaqti. */
  lessonTime?: string;
  /** O'quvchining pul to'lash sanasi ("YYYY-MM-DD"). */
  paymentDate?: string;
  /** O'qish tili. */
  language?: string;
  /** Marketing so'rovnomasi. */
  survey?: string;
  /** Maqsadidagi universitet. */
  targetUniversity?: string;
  fatherName?: string;
  fatherPhone?: string;
  fatherWork?: string;
  motherName?: string;
  motherPhone?: string;
  motherWork?: string;
  /** Uy manzili. */
  address?: string;
  /** O'qish joyi (maktab/litsey). */
  studyPlace?: string;
  note?: string;

  /** Qarzdorlik limiti (UZS) — "Qarzdorlik limiti" tabi. */
  debtLimit?: number;
  /** "Manzil" tabida qo'shilgan manzillar. */
  addresses?: PupilAddress[];

  // --- Kirish ma'lumotlari ("Parol o'rnatish" tabi) ---
  // Parolning O'ZI hech qachon saqlanmaydi — faqat bcrypt xesh, va u
  // hech qachon klientga qaytarilmaydi.
  studentLogin?: string;
  studentPasswordHash?: string;
  parentLogin?: string;
  parentPasswordHash?: string;
}

/**
 * RO'YXAT rejimidagi o'quvchi — GET /api/pupils qaytaradigan maydonlar.
 *
 * Ro'yxat javobi to'liq hujjat EMAS: `pupils` da 6 732 yozuv bor, to'liq
 * hujjatlar ~3.6 MB, shuning uchun route proyeksiya qo'llaydi
 * (app/api/pupils/route.ts → MEDIUM_PROJECTION). Bu tip aynan o'sha
 * proyeksiyaning aksi — ikkalasi BIRGA o'zgartirilsin.
 *
 * Ro'yxatda YO'Q maydon kerak bo'lsa (masalan `email`, `note`, `debtLimit`)
 * — bitta o'quvchini GET /api/pupils/:id orqali oling, u to'liq `Pupil`
 * qaytaradi. Shu tip tufayli yo'q maydonni o'qish kompilyatsiya xatosi
 * bo'ladi, jimgina bo'sh qiymat emas.
 */
/**
 * `/api/pupils` HAR DOIM qaytaradigan maydonlar — `studentRowFromPupil`
 * (lib/studentsData.ts) talab qiladigan asosiy to'plam.
 *
 * Ilgari bu yerda yana o'nta maydon bor edi (ota-ona, manzil, tug'ilgan
 * sana, to'lov sanasi). Ular 13 ta sahifadan atigi 4 tasiga kerak, lekin
 * HAMMASIGA tashilardi: 6 732 hujjatda 1.02 MB ortiqcha. Endi ular
 * `?extra=` bilan ALOHIDA so'raladi.
 */
export type PupilListItem = Pick<
  Pupil,
  | "id" | "firstName" | "lastName" | "phone"
  | "balance" | "coin" | "createdAt" | "moderator" | "source" | "category"
  | "status" | "statusReason" | "statusChangedAt"
>;

/**
 * `?extra=` orqali qo'shimcha so'rash mumkin bo'lgan maydonlar (OQ RO'YXAT).
 *
 * Bu ro'yxat serverda ham, `useStudents` turida ham ishlatiladi: sahifa
 * so'ramagan maydonni o'qisa, TypeScript kompilyatsiyada to'xtatadi —
 * ya'ni `undefined` jimgina ekranga chiqmaydi.
 */
export const PUPIL_EXTRA_FIELDS = [
  "paymentDate", "birthDate",
  "fatherName", "fatherPhone", "fatherWork",
  "motherName", "motherPhone", "motherWork",
  "address", "addresses",
] as const;
export type PupilExtraField = (typeof PUPIL_EXTRA_FIELDS)[number];


export interface PupilAddress {
  id: number;
  /** Manzil nomi/matni. */
  name: string;
  /** Manzil turi (Uy, Ish, Maktab...). */
  type: string;
}

/** "Manzil" tabidagi tanlov. */
export const ADDRESS_TYPES = ["Uy", "Ish", "Maktab", "Boshqa"];

export interface NewPupilValues {
  firstName: string;
  lastName: string;
  phone: string;
  extraPhone: string;
  category: string;
  birthDate: string;
  /**
   * O'quvchi markazni qayerdan eshitgani — qo'shish formasida MAJBURIY
   * (constants/index.js → STUDENT_SOURCES).
   *
   * IXTIYORIY (`source?:`) EMAS: shundagina TypeScript uni yubormayotgan
   * chaqiruvchini ko'rsatib beradi. DIQQAT — bu kafolat to'liq emas:
   * `lib/enrollStudent.ts` obyektni `JSON.stringify()` ichida uzatadi va
   * `app/api/pupils/route.ts` tanani `await req.json()` dan tayinlaydi,
   * ya'ni ikkalasi ham `any` orqali o'tadi va xato bermaydi.
   */
  source: string;
}

/** "Ism Familiya" — ro'yxat/tanlov joylarida o'quvchining ko'rinadigan nomi. */
export function pupilFullName(p: Pick<Pupil, "firstName" | "lastName">): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

/**
 * To'liq ism bo'yicha o'quvchi id'si — faqat ism YAGONA bo'lsa (ismdoshlar
 * bo'lsa null: taxmin qilinmaydi). Lid formasidagi «Referal bergan
 * o'quvchi» tanlovi ism bilan ishlaydi, id shu yerda aniqlanadi.
 */
export function pupilIdByName(pupils: Pick<Pupil, "id" | "firstName" | "lastName">[], name: string): number | null {
  const key = name.trim().replace(/\s+/g, " ").toLowerCase();
  if (!key) return null;
  const hits = pupils.filter((p) => pupilFullName(p).replace(/\s+/g, " ").toLowerCase() === key);
  return hits.length === 1 ? hits[0].id : null;
}

export function buildPupilFromValues(nextId: number, values: NewPupilValues): Pupil {
  const now = uzNow();
  const pad = (n: number) => String(n).padStart(2, "0");
  const createdAt = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} | ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  // balance/coin/moderator qo'shish formasida so'ralmaydi — nol/bo'sh
  // holatda boshlanadi, keyin moliya amallari (bonus/jarima/to'lov) o'zgartiradi.
  //
  // `source` bu ro'yxatda YO'Q va bo'lmasligi ham kerak: u endi formada
  // MAJBURIY so'raladi va `...values` orqali keladi. Ilgari bu yerda
  // `source: ""` turardi — `...values` dan KEYIN, ya'ni u formadan kelgan
  // qiymatni har safar JIMGINA bosib ketardi: foydalanuvchi manbani
  // tanlaydi, "qo'shildi" degan xabarni ko'radi, bazada esa bo'sh qoladi.
  //
  // TARTIB QOIDASI: `...values` BIRINCHI, server aniqlaydigan maydonlar
  // undan KEYIN. Shunda klient yuborgan ortiqcha kalitlar server
  // qiymatini bosib yoza olmaydi.
  //
  // `id` ataylab spread'dan KEYINGA ko'chirildi. Ilgari u birinchi
  // turardi (`{ id: nextId, ...values, ... }`), ya'ni POST tanasida
  // `id` yuborilsa server bergan raqam bosib yozilardi: `body` —
  // `await req.json()` dan kelgan `any`, ya'ni TypeScript buni
  // to'smaydi. Oqibati: mavjud id yuborilsa unikal indeks E11000 bilan
  // yiqilardi, yangi id yuborilsa esa ketma-ketlik buzilardi.
  return { ...values, id: nextId, createdAt, balance: 0, coin: 0, moderator: "", status: "Aktiv" };
}
