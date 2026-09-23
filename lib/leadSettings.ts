import type { Db } from "mongodb";

// LIDLAR SOZLAMALARI — Sozlamalar → Sotuv va marketing → «Lidlar» tabi
// (components/settings/LeadSettingsTab.tsx). Ommaviy so'rovnoma
// (/sorovnoma) va Lidlar sahifasi shu ro'yxatlardan o'qiydi.
//
// Boshlang'ich qiymatlar — foydalanuvchi prototipidan (23.09.2026).
// Filiallar (manzil, telefon) va «Bizni qayerdan bildingiz?» manbalari BU
// YERDA EMAS: ular mavjud bo'limlarda — Boshqaruv → Filiallar va
// Sotuv va marketing → O'quvchilar oqimi (`student_sources`).
//
// Yo'nalishlar soni QAT'IY — uchta (`fan`, `til`, `pm`): so'rovnomadagi
// animatsiyali plitkalar (atom, salomlashuv, yulduz) va daraja/sinf savoli
// shularga bog'langan. Nomi, savoli, fanlar ro'yxati va ko'rinishi
// tahrirlanadi.

export const LEAD_SETTINGS_KEY = "sale-marketing.leads";

/** So'rovnomadan kelgan lidning `source` qiymati (kanal). */
export const SURVEY_SOURCE = "Sayt so'rovnomasi";

export type YonalishId = "fan" | "til" | "pm";
export const YONALISH_IDS: readonly YonalishId[] = ["fan", "til", "pm"];

export interface LeadFan {
  nom: string;
  /** Ixtiyoriy guruh sarlavhasi — ketma-ket bir xil guruhlilar birga chiziladi. */
  guruh?: string;
}

export interface LeadYonalish {
  id: YonalishId;
  nom: string;
  /** Birinchi qadam savoli: "Qaysi fan?". */
  savol: string;
  /** So'rovnomada ko'rinadimi. */
  yoqilgan: boolean;
  fanlar: LeadFan[];
}

export interface LeadSettings {
  yonalishlar: LeadYonalish[];
  /** Chet tili darajasi shkalasi (birinchisi — "0 dan"). */
  bosqichlar: string[];
  sinflar: string[];
  vaqtlar: string[];
  radSabablar: string[];
}

export const DEFAULT_LEAD_SETTINGS: LeadSettings = {
  yonalishlar: [
    {
      id: "fan",
      nom: "Fanlar",
      savol: "Qaysi fan?",
      yoqilgan: true,
      fanlar: ["Ona tili", "Matematika", "Fizika", "Kimyo", "Biologiya", "Tarix", "Huquq", "Geografiya"].map((nom) => ({ nom })),
    },
    {
      id: "til",
      nom: "Chet tili",
      savol: "Qaysi til?",
      yoqilgan: true,
      fanlar: [
        ...["Ingliz tili", "Rus tili", "Arab tili", "Turk tili", "Koreys tili", "Nemis tili"].map((nom) => ({ nom, guruh: "Tillar" })),
        ...["IELTS", "CEFR", "SAT", "Multilevel", "Milliy sertifikat"].map((nom) => ({ nom, guruh: "Sertifikat va imtihonlar" })),
      ],
    },
    {
      id: "pm",
      nom: "Prezident maktabi",
      savol: "Qaysi maktab?",
      yoqilgan: true,
      fanlar: [
        "Prezident maktablari",
        "Ixtisoslashtirilgan maktablar",
        "Ijod maktablari",
        "Abu Ali ibn Sino maktabi",
        "Is'hoqxon to'ra Ibrat maktabi",
        "Muhammad al-Xorazmiy maktabi",
      ].map((nom) => ({ nom })),
    },
  ],
  bosqichlar: ["Boshlang'ich (0 dan)", "1-bosqich", "2-bosqich", "3-bosqich", "4-bosqich", "5-bosqich", "6-bosqich"],
  sinflar: ["1-sinf", "2-sinf", "3-sinf", "4-sinf", "5-sinf", "6-sinf", "7-sinf", "8-sinf", "9-sinf", "10-sinf", "11-sinf", "Maktabni tugatgan"],
  vaqtlar: ["Ertalab (08:00–12:00)", "Tushdan keyin (13:00–18:00)", "Kechqurun (18:00–20:00)", "Farqi yo'q"],
  radSabablar: ["Narx qimmat", "Vaqt to'g'ri kelmadi", "Telefonga javob bermadi", "Boshqa markazni tanladi", "Hozircha rejasi yo'q"],
};

const clean = (v: unknown, max = 120) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

function cleanList(v: unknown, fallback: string[], max = 60): string[] {
  if (!Array.isArray(v)) return fallback;
  const out: string[] = [];
  for (const x of v) {
    const s = clean(x);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out.length ? out : fallback;
}

/** Bazadan/mijozdan kelgan qiymatni yaroqli sozlamaga keltiradi. */
export function normalizeLeadSettings(raw: unknown): LeadSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawYon = Array.isArray(o.yonalishlar) ? (o.yonalishlar as Record<string, unknown>[]) : [];
  const yonalishlar = DEFAULT_LEAD_SETTINGS.yonalishlar.map((def) => {
    const r = rawYon.find((x) => x && x.id === def.id);
    if (!r) return def;
    const fanlar: LeadFan[] = [];
    if (Array.isArray(r.fanlar)) {
      for (const f of r.fanlar as unknown[]) {
        const nom = clean(typeof f === "string" ? f : (f as Record<string, unknown>)?.nom);
        const guruh = typeof f === "object" && f ? clean((f as Record<string, unknown>).guruh, 60) : "";
        if (nom && !fanlar.some((x) => x.nom === nom)) fanlar.push(guruh ? { nom, guruh } : { nom });
        if (fanlar.length >= 60) break;
      }
    }
    return {
      id: def.id,
      nom: clean(r.nom, 60) || def.nom,
      savol: clean(r.savol, 80) || def.savol,
      yoqilgan: r.yoqilgan !== false,
      fanlar: fanlar.length ? fanlar : def.fanlar,
    };
  });
  const bosqichlar = cleanList(o.bosqichlar, DEFAULT_LEAD_SETTINGS.bosqichlar, 12);
  return {
    yonalishlar,
    bosqichlar: bosqichlar.length >= 2 ? bosqichlar : DEFAULT_LEAD_SETTINGS.bosqichlar,
    sinflar: cleanList(o.sinflar, DEFAULT_LEAD_SETTINGS.sinflar, 20),
    vaqtlar: cleanList(o.vaqtlar, DEFAULT_LEAD_SETTINGS.vaqtlar, 12),
    radSabablar: cleanList(o.radSabablar, DEFAULT_LEAD_SETTINGS.radSabablar, 20),
  };
}

export async function loadLeadSettings(db: Db): Promise<LeadSettings> {
  const doc = await db.collection("settings").findOne({ key: LEAD_SETTINGS_KEY }, { projection: { _id: 0, values: 1 } });
  return normalizeLeadSettings(doc?.values);
}

export async function saveLeadSettings(db: Db, s: LeadSettings): Promise<void> {
  await db.collection("settings").updateOne({ key: LEAD_SETTINGS_KEY }, { $set: { key: LEAD_SETTINGS_KEY, values: s } }, { upsert: true });
}

/** Chet tili yo'nalishimi (daraja shkalasi so'raladi) — qolganlarida sinf. */
export function hasDaraja(id: string | undefined): boolean {
  return id === "til";
}

/** So'rovnomadagi daraja javobi: shkala qiymati (0–100) yoki "bilmayman, test". */
export interface LeadDaraja {
  lvl: number;
  test: boolean;
}

export interface DarajaInfo {
  test: boolean;
  /** Aniq bosqichga yaqin (±4) — `near` ning o'zi. */
  aniq: boolean;
  near: string;
  /** Oraliqda bo'lsa — qaysi ikki bosqich orasida. */
  lo: string;
  hi: string;
}

/** Daraja shkalasidagi qiymat → bosqich (matnni chaqiruvchi o'z tilida yig'adi). */
export function darajaInfo(d: LeadDaraja, bosqichlar: string[]): DarajaInfo {
  if (d.test) return { test: true, aniq: false, near: "", lo: "", hi: "" };
  const n = Math.max(2, bosqichlar.length);
  const step = 100 / (n - 1);
  const v = Math.max(0, Math.min(100, Number(d.lvl) || 0));
  const i = Math.round(v / step);
  const near = bosqichlar[i] ?? "";
  if (Math.abs(v - i * step) <= 4) return { test: false, aniq: true, near, lo: near, hi: near };
  const lo = Math.floor(v / step);
  return { test: false, aniq: false, near, lo: bosqichlar[lo] ?? "", hi: bosqichlar[lo + 1] ?? "" };
}

/** O'zbekcha matn — Telegram xabari va eksport uchun. */
export function darajaMatnUz(d: LeadDaraja, bosqichlar: string[]): string {
  const i = darajaInfo(d, bosqichlar);
  if (i.test) return "Daraja testi kerak";
  return i.aniq ? i.near : `${i.lo} — ${i.hi} orasida`;
}
