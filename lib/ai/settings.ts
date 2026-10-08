import type { Db } from "mongodb";
import { AI } from "./db";
import { DEFAULT_EFFORT, isEffort, isModelId } from "./models";
import type { AiEffort } from "./protocol";

// AI YORDAMCHI SOZLAMALARI — Sozlamalar → Ilova sozlamalari → AI yordamchi.
//
// NEGA UMUMIY `settings` KOLLEKSIYASIDA EMAS: `PUT /api/settings` istalgan
// kalitni yozadi va unga Sozlamalar, O'quvchilar, Lidlar kabi o'nlab
// sahifaning ruxsati yetadi (lib/apiPermissions.generated.ts). Limit
// o'sha yerda tursa, o'quvchilar ro'yxatini ko'ra oladigan xodim o'ziga
// kunlik limitni ochib olardi. Shu sabab alohida kolleksiya va faqat admin
// yozadigan alohida route (app/api/ai/settings) — gamifikatsiya bilan bir
// xil yo'l.
//
// SUKUT — O'CHIQ. Yordamchi o'quvchi ismlari va summalarni tashqi
// xizmatga (OpenAI) yuboradi; bu qarorni admin ongli ravishda yoqishi
// kerak, deploy o'zi yoqib yubormasin.
//
// AMALLAR (2-bosqich: lid qo'shish, kirim, chiqim) — ALOHIDA kalit, u ham
// sukut bo'yicha o'chiq. Savol-javobni yoqqan admin pul yozuvlarini ham
// yoqib qo'ygan bo'lib qolmasin: bu boshqa darajadagi qaror.
//
// MODELLAR (4-bosqich, 08.10.2026): xodim panelda qaysi modellarni va
// qaysi «Tezlik» ni tanlay olishi. Modellar narxi o'n barobargacha farq
// qiladi — ro'yxatni admin belgilaydi. `models: null` — admin hali
// tanlamagan: katalogdagi hammasi + .env modeli (lib/ai/modelChoice.ts).

export interface AiSettings {
  enabled: boolean;
  /** Amallar qoralamasi + tasdiq (lib/ai/actions). Faqat `enabled` bilan birga ishlaydi. */
  actionsEnabled: boolean;
  /** Bitta xodimga kuniga nechta savol (Toshkent kuni). */
  dailyLimit: number;
  /** Xodimlarga ochiq modellar, paneldagi tartibda. `null` — admin tanlamagan (sukut ro'yxati). */
  models: string[] | null;
  /** Xodim tanlamaguncha shu model; `null` — .env dagisi. */
  defaultModel: string | null;
  /** Xodim tanlamaguncha shu «Tezlik». */
  defaultEffort: AiEffort;
  /** Kim va qachon oxirgi marta o'zgartirgan — Sozlamalarda ko'rinadi. */
  updatedBy: string | null;
  updatedAt: string | null;
}

export const DEFAULT_DAILY_LIMIT = 50;
export const MAX_DAILY_LIMIT = 1000;
/** Panel ro'yxati uzun bo'lib ketmasin. */
export const MAX_MODELS = 20;

const KEY = "main";

/** Takrorsiz, yaroqli ID'lar; bo'sh ro'yxat — `null`. */
function modelList(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const list = [...new Set(raw.filter(isModelId))].slice(0, MAX_MODELS);
  return list.length ? list : null;
}

export function normalizeAiSettings(raw: unknown): AiSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const limit = Number(r.dailyLimit);
  return {
    enabled: r.enabled === true,
    actionsEnabled: r.actionsEnabled === true,
    dailyLimit:
      Number.isInteger(limit) && limit >= 1 && limit <= MAX_DAILY_LIMIT ? limit : DEFAULT_DAILY_LIMIT,
    models: modelList(r.models),
    defaultModel: isModelId(r.defaultModel) ? r.defaultModel : null,
    defaultEffort: isEffort(r.defaultEffort) ? r.defaultEffort : DEFAULT_EFFORT,
    updatedBy: typeof r.updatedBy === "string" ? r.updatedBy : null,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : null,
  };
}

export async function loadAiSettings(db: Db): Promise<AiSettings> {
  const doc = await db.collection(AI.settings).findOne({ key: KEY }, { projection: { _id: 0 } });
  return normalizeAiSettings(doc);
}

export type SaveAiSettingsResult = { ok: true; settings: AiSettings } | { ok: false; error: string };

/**
 * Faqat yuborilgan maydonlar o'zgaradi. Yaroqsiz qiymat JIMGINA
 * tuzatilmaydi — rad etiladi: admin "500" deb yozib "50" ni saqlangan deb
 * o'ylab qolmasin.
 */
export async function saveAiSettings(
  db: Db,
  patch: {
    enabled?: unknown;
    actionsEnabled?: unknown;
    dailyLimit?: unknown;
    models?: unknown;
    defaultModel?: unknown;
    defaultEffort?: unknown;
  },
  by: string,
): Promise<SaveAiSettingsResult> {
  const set: Record<string, unknown> = {};
  if (patch.models !== undefined) {
    if (!Array.isArray(patch.models) || !patch.models.every(isModelId)) return { ok: false, error: "Model nomi noto'g'ri" };
    if (patch.models.length > MAX_MODELS) return { ok: false, error: `Ko'pi bilan ${MAX_MODELS} ta model` };
    const list = modelList(patch.models);
    if (!list) return { ok: false, error: "Kamida bitta model tanlang" };
    set.models = list;
  }
  if (patch.defaultModel !== undefined) {
    if (patch.defaultModel !== null && !isModelId(patch.defaultModel)) return { ok: false, error: "Model nomi noto'g'ri" };
    set.defaultModel = patch.defaultModel;
  }
  if (patch.defaultEffort !== undefined) {
    if (!isEffort(patch.defaultEffort)) return { ok: false, error: "Noto'g'ri qiymat" };
    set.defaultEffort = patch.defaultEffort;
  }
  if (patch.enabled !== undefined) {
    if (typeof patch.enabled !== "boolean") return { ok: false, error: "Noto'g'ri qiymat" };
    set.enabled = patch.enabled;
  }
  if (patch.actionsEnabled !== undefined) {
    if (typeof patch.actionsEnabled !== "boolean") return { ok: false, error: "Noto'g'ri qiymat" };
    set.actionsEnabled = patch.actionsEnabled;
  }
  if (patch.dailyLimit !== undefined) {
    const n = Number(patch.dailyLimit);
    if (!Number.isInteger(n) || n < 1 || n > MAX_DAILY_LIMIT) {
      return { ok: false, error: `Kunlik limit 1 dan ${MAX_DAILY_LIMIT} gacha butun son bo'lishi kerak` };
    }
    set.dailyLimit = n;
  }
  if (Object.keys(set).length === 0) return { ok: false, error: "O'zgartiriladigan qiymat yo'q" };

  set.updatedBy = by;
  set.updatedAt = new Date().toISOString();
  // Upsert'da `key` filtrdan o'zi yoziladi.
  await db.collection(AI.settings).updateOne({ key: KEY }, { $set: set }, { upsert: true });
  return { ok: true, settings: await loadAiSettings(db) };
}
