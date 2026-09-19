import { toUz } from "./uzTime";
// Boshqaruv → Ishga qabul (CV) uchun umumiy tip. API route'lari va klient
// komponentlar (CRM ro'yxati, anketa modali, ommaviy /ariza sahifasi) shuni
// bo'lishadi. MongoDB `cv_applications` kolleksiyasi.
//
// IKKI AVLOD ARIZA bir kolleksiyada turadi:
//   • eski 20 savollik anketa (CRM ichidagi "CV to'ldirish" modali, Google
//     Sheets sinxroni) — faqat matn maydonlari;
//   • 19.09.2026 dagi yangi ommaviy anketa (/ariza) — rasm (Cloudinary),
//     filial, bandlik, ta'lim darajasi, CV fayli, sertifikat nusxalari.
// Yangi maydonlar ixtiyoriy — eski yozuvlar o'zgarmaydi, ro'yxat/tafsilot
// ikkalasini ham chizadi. Semantik jihatdan bir xil savollar ESKI kalitga
// yoziladi (yangi formadagi "Yashash manzili" → `address`, "Qaysi ish"
// → `position`, "O'quv yurti" → `university`, "Kutayotgan oylik" →
// `expectedSalary` …) — shunda "Ishga olish", jadval ustunlari va Sheets
// eksporti ikki avlod uchun ham bitta kod bilan ishlaydi.

export type CvStatus = "new" | "reviewed" | "interview" | "accepted" | "rejected";

/** Cloudinary'ga yuklangan fayl — ro'yxatda havola, tafsilotda nomi bilan. */
export interface CvFile {
  name: string;
  url: string;
  size: number;
  type: string;
}

export interface CvApplication {
  id: number;
  /** Ommaviy anketa (/ariza) yoki Google Sheets'dan kelgan yozuvning kaliti. */
  sid?: string;
  /** Nomzodga ko'rsatiladigan ariza raqami — "AK-260919-K7Q" (faqat yangi anketa). */
  ref?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  telegram?: string;
  /** Nomzod rasmi (Cloudinary `secure_url`). */
  photoUrl?: string;
  address: string;
  birth: string;
  university: string;
  position: string;
  subject: string;
  achievements: string;
  experience: string;
  startDate: string;
  whyUs: string;
  schools: string;
  currentJob: string;
  levels: string;
  plans5: string;
  expectedSalary: string;
  results: string;
  /** "Siz uchun ishda muhim 3 ta omil" — ko'p tanlovli. */
  priorities: string[];
  /** "Kuchli tomonlaringiz" — ko'p tanlovli. */
  strengths: string[];
  extra: string;
  /**
   * Nomzod tanlagan filial. `null` — "qaysi filial bo'lsa ham"; maydon
   * yo'q — eski ariza. Ikkalasi ham HAR BIR filial ro'yxatida ko'rinadi
   * (app/api/management-cv `cvBranchFilter`).
   */
  branchId?: number | null;
  /** Tanlangan filialning o'sha paytdagi nomi — ro'yxatda so'rovsiz ko'rsatish uchun. */
  branchName?: string;
  /** Bandlik turi — CV_LOADS. */
  load?: string;
  /** Ta'lim darajasi — CV_EDU_LEVELS. */
  edu?: string;
  /** Vakansiyani qayerdan bilgani — CV_SOURCES. */
  source?: string;
  cvFile?: CvFile | null;
  docs?: CvFile[];
  /** Rozilik belgilangan vaqt (ISO). */
  consentAt?: string;
  status: CvStatus;
  /** "dd.MM.yyyy | HH:mm" — jadvaldagi "Topshirilgan" ustuni. */
  submitted: string;
  /** "Ishga olish" bosilganda yaratilgan `hr_employees.id`. */
  hiredEmpId?: number;
}

/** Erkin matn maydonlari — anketa savollari kalitlari bilan bir xil tartibda. */
export const CV_TEXT_FIELDS = [
  "name",
  "phone",
  "address",
  "birth",
  "university",
  "position",
  "subject",
  "achievements",
  "experience",
  "startDate",
  "whyUs",
  "schools",
  "currentJob",
  "levels",
  "plans5",
  "expectedSalary",
  "results",
  "extra",
] as const;

/** Yangi anketaning ixtiyoriy matn maydonlari (JSON'dan ham, Sheets'dan ham kelishi mumkin). */
export const CV_EXTRA_TEXT_FIELDS = ["ref", "firstName", "lastName", "telegram", "photoUrl", "branchName", "load", "edu", "source"] as const;

export const CV_STATUS_VALUES: CvStatus[] = ["new", "reviewed", "interview", "accepted", "rejected"];

export function isCvStatus(v: unknown): v is CvStatus {
  return typeof v === "string" && (CV_STATUS_VALUES as string[]).includes(v);
}

/** "dd.MM.yyyy | HH:mm" — referens HTML'dagi `submitted` formati. */
export function formatSubmitted(raw: Date): string {
  const d = toUz(raw);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Ariza raqami — "AK-260919-K7Q": sana + 3 belgi (o'qishda adashtiradigan
 * 0/O, 1/I harflari yo'q). Nomzod uni saqlab qo'yadi, telefonda aytadi.
 */
export function makeCvRef(now = new Date()): string {
  const d = toUz(now);
  const z = (x: number) => String(x).padStart(2, "0");
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let tail = "";
  for (let i = 0; i < 3; i++) tail += abc[Math.floor(Math.random() * abc.length)];
  return `AK-${String(d.getFullYear()).slice(2)}${z(d.getMonth() + 1)}${z(d.getDate())}-${tail}`;
}

/**
 * Mijozdan (CRM anketasi, /ariza yoki Google Sheets) kelgan xom yozuvni
 * `CvApplication` shakliga keltiradi. `id`/`status`/`submitted` ni server
 * qo'yadi, shuning uchun bu yerda faqat anketa maydonlari tozalanadi.
 * Fayllar (rasm, CV, hujjatlar) bu yerdan o'tmaydi — ularni route
 * Cloudinary'ga yuklab, natijani o'zi qo'shadi.
 */
export function sanitizeCvInput(raw: unknown): Omit<CvApplication, "id" | "status" | "submitted"> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string).trim() : "");
  const list = (k: string) => {
    const v = r[k];
    // Sheets qatorlari massivni "a | b | c" ko'rinishida qaytaradi.
    if (typeof v === "string") return v.split(" | ").map((x) => x.trim()).filter(Boolean);
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
    return [];
  };

  // Yangi anketa ism va familiyani alohida beradi — `name` shundan yig'iladi.
  const firstName = str("firstName");
  const lastName = str("lastName");
  const name = str("name") || `${firstName} ${lastName}`.trim();
  if (!name) return null;

  const out = {
    name,
    phone: str("phone"),
    priorities: list("priorities").slice(0, 3),
    strengths: list("strengths"),
  } as Omit<CvApplication, "id" | "status" | "submitted">;

  for (const k of CV_TEXT_FIELDS) {
    if (k === "name" || k === "phone") continue;
    (out as unknown as Record<string, string>)[k] = str(k);
  }
  for (const k of CV_EXTRA_TEXT_FIELDS) {
    const v = str(k);
    if (v) (out as unknown as Record<string, string>)[k] = v;
  }
  const sid = str("sid");
  if (sid) out.sid = sid;

  // Filial: son — aniq filial; "any"/null/bo'sh — "qaysi filial bo'lsa ham".
  if ("branchId" in r) {
    const b = r.branchId;
    const n = typeof b === "number" ? b : typeof b === "string" && /^\d+$/.test(b) ? Number(b) : NaN;
    out.branchId = Number.isFinite(n) && n > 0 ? n : null;
  }
  return out;
}

/** Yangi anketadagi majburiy maydonlar — mijoz va server bir xil ro'yxatni tekshiradi. */
export const CV_PUBLIC_REQUIRED = [
  "firstName",
  "lastName",
  "birth",
  "phone",
  "address",
  "position",
  "branch",
  "load",
  "startDate",
  "expectedSalary",
  "edu",
  "experience",
  "university",
  "whyUs",
] as const;

/** Tug'ilgan sanadan yosh (to'liq yillar). */
export function ageOf(iso: string, now = new Date()): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return -1;
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

/** "+998 (94) 111-88-55" ko'rinishi — 9 ta raqamdan. */
export function formatUzPhone(digits: string): string {
  let d = digits.replace(/\D/g, "");
  if (d.startsWith("998")) d = d.slice(3);
  d = d.slice(0, 9);
  let out = "+998";
  if (d.length) out += " (" + d.slice(0, 2);
  if (d.length >= 2) out += ")";
  if (d.length > 2) out += " " + d.slice(2, 5);
  if (d.length > 5) out += "-" + d.slice(5, 7);
  if (d.length > 7) out += "-" + d.slice(7, 9);
  return out;
}
