import { toUz } from "./uzTime";
// Boshqaruv → Ishga qabul (CV) uchun umumiy tip. API route'lari va klient
// komponentlar (CRM ro'yxati, anketa modali, ommaviy /ariza sahifasi) shuni
// bo'lishadi. MongoDB `cv_applications` kolleksiyasi.

export type CvStatus = "new" | "reviewed" | "interview" | "accepted" | "rejected";

export interface CvApplication {
  id: number;
  /** Ommaviy anketa (/ariza) yoki Google Sheets'dan kelgan yozuvning kaliti. */
  sid?: string;
  name: string;
  phone: string;
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
 * Mijozdan (CRM anketasi, /ariza yoki Google Sheets) kelgan xom yozuvni
 * `CvApplication` shakliga keltiradi. `id`/`status`/`submitted` ni server
 * qo'yadi, shuning uchun bu yerda faqat anketa maydonlari tozalanadi.
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

  const name = str("name");
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
  const sid = str("sid");
  if (sid) out.sid = sid;
  return out;
}
