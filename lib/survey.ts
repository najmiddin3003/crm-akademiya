import { hasDaraja, type LeadDaraja, type LeadYonalish } from "./leadSettings";

// OMMAVIY SO'ROVNOMA (/sorovnoma) — mijoz va server bo'lishadigan qism.
// Sahifa: components/leads/SurveyPage.tsx; qabul: app/api/sorovnoma/route.ts;
// sozlamalar: lib/surveyServer.ts → loadSurveyConfig.

export interface SurveyBranch {
  id: number;
  nom: string;
  /** Aniq manzil (Boshqaruv → Filiallar), bo'lmasa shahar. */
  manzil: string;
  /** Shahar/tuman (`branches.location`) — sahifa pastidagi yozuv uchun. */
  shahar: string;
  telefon: string;
}

/** Sahifaga server komponentdan keladigan hamma narsa. */
export interface SurveyConfig {
  /** Faqat yoqilgan va fanlari bor yo'nalishlar. */
  yonalishlar: LeadYonalish[];
  bosqichlar: string[];
  sinflar: string[];
  vaqtlar: string[];
  filiallar: SurveyBranch[];
  /** «Bizni qayerdan bildingiz?» — O'quvchilar oqimidagi manbalar + "Boshqa". */
  manbalar: string[];
}

/** POST /api/sorovnoma tanasi. */
export interface SurveySubmission {
  yonalish: string;
  fan: string;
  lvl?: number;
  test?: boolean;
  sinf?: string;
  filialId: number;
  vaqt: string;
  ism: string;
  tel: string;
  manba: string;
  izoh?: string;
  /** Spamdan himoya: forma ochilgandan beri o'tgan vaqt (ms, mijoz soati bilan emas). */
  ms: number;
  /** Yashirin maydon — odam ko'rmaydi, bot to'ldiradi. */
  website?: string;
}

/** Telefondan 9 raqam (operator kodi + raqam); boshidagi 998 olib tashlanadi. */
export function phone9(raw: string): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  return (d.startsWith("998") ? d.slice(3) : d).slice(0, 9);
}

/** "941558855" → "94 155 88 55" — bazadagi lid va o'quvchi raqamlari shakli. */
export function formatPhone9(d: string): string {
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
}

/** Kiritish maydoni niqobi: "+998 94 155 88 55" (+998 doim turadi). */
export function maskSurveyPhone(raw: string): string {
  const d = phone9(raw);
  return d ? `+998 ${formatPhone9(d)}` : "+998 ";
}

export type SurveyValidation =
  | {
      ok: true;
      value: {
        name: string;
        phone: string;
        branchId: number;
        yonalish: string;
        course: string;
        daraja?: LeadDaraja;
        sinf?: string;
        qulayVaqt: string;
        heardFrom: string;
        note: string;
      };
    }
  | { ok: false; error: string };

const LINK_RE = /(https?:\/\/|www\.|t\.me\/|\.(com|ru|uz|net|org)\b)/i;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * Javobni sozlamaga solishtiradi: har bir tanlov ro'yxatda bo'lishi
 * shart — bot o'zi to'qigan kurs yoki filial nomini yubora olmaydi.
 * Xato matni o'zbekcha (sahifa uni `t()` bilan tarjima qiladi).
 */
export function validateSurvey(cfg: SurveyConfig, b: Partial<SurveySubmission>): SurveyValidation {
  const yon = cfg.yonalishlar.find((y) => y.id === b.yonalish);
  if (!yon) return { ok: false, error: "Yo'nalishni tanlang." };
  const course = clean(b.fan, 120);
  if (!yon.fanlar.some((f) => f.nom === course)) return { ok: false, error: "Kurs yoki fanni tanlang." };

  let daraja: LeadDaraja | undefined;
  let sinf: string | undefined;
  if (hasDaraja(yon.id)) {
    const lvl = Math.round(Number(b.lvl));
    if (!b.test && !(lvl >= 0 && lvl <= 100)) return { ok: false, error: "Darajangizni belgilang." };
    daraja = { lvl: b.test ? 0 : lvl, test: Boolean(b.test) };
  } else {
    sinf = clean(b.sinf, 40);
    if (!cfg.sinflar.includes(sinf)) return { ok: false, error: "Sinfni tanlang." };
  }

  const branch = cfg.filiallar.find((f) => f.id === Number(b.filialId));
  if (!branch) return { ok: false, error: "Filialni tanlang." };
  const qulayVaqt = clean(b.vaqt, 80);
  if (!cfg.vaqtlar.includes(qulayVaqt)) return { ok: false, error: "Qulay vaqtni tanlang." };

  const name = clean(b.ism, 80);
  if (name.length < 3 || !/\p{L}/u.test(name) || LINK_RE.test(name)) return { ok: false, error: "Ism familiyani to'liq yozing." };
  const tel = phone9(String(b.tel ?? ""));
  if (tel.length !== 9 || /^(\d)\1+$/.test(tel)) return { ok: false, error: "Telefon raqamni to'liq kiriting." };
  const heardFrom = clean(b.manba, 60);
  if (!cfg.manbalar.includes(heardFrom)) return { ok: false, error: "Bizni qayerdan eshitganingizni belgilang." };
  const note = clean(b.izoh, 500);
  if (LINK_RE.test(note)) return { ok: false, error: "Izohda havola bo'lmasin." };

  return {
    ok: true,
    value: { name, phone: formatPhone9(tel), branchId: branch.id, yonalish: yon.id, course, daraja, sinf, qulayVaqt, heardFrom, note },
  };
}
