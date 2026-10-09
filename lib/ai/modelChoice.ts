import type { AiProviderConfig } from "./config";
import { AI_MODEL_CATALOG, DEFAULT_EFFORT, isEffort, modelInfo, modelOption, nearestEffort } from "./models";
import type { AiEffort, AiModelOption } from "./protocol";
import type { AiSettings } from "./settings";

// QAYSI MODEL VA QAYSI «TEZLIK» (08.10.2026) — admin ro'yxati, .env va
// OpenAI hisobi asosida. Sof funksiyalar (tarmoqqa chiqmaydi): hisobdagi
// modellar ro'yxatini chaqiruvchi beradi (lib/ai/openai.ts → accountModels).
//
//   1. Ro'yxat — admin Sozlamalarda ochgan modellar (`ai_settings.models`).
//      Admin hali tanlamagan bo'lsa — .env modeli + katalogdagi hammasi.
//   2. Chat Completions rejimida (proksi) vositasi faqat Responses'da
//      ishlaydigan modellar chiqariladi va tezlik tanlanmaydi: u yerda
//      vosita bilan fikrlash yo'q (lib/ai/openai.ts → reasoningNone).
//   3. Hisobda yo'q model panelda ko'rinmaydi; .env modeli bundan mustasno
//      (bugun u bilan ishlab turibdi, ro'yxatda esa taxallus bo'lib
//      ko'rinmasligi mumkin). Ro'yxatni olib bo'lmasa — tekshirilmaydi.
//
// XODIM TANLOVI SERVERDA QAYTA TEKSHIRILADI (`resolveChoice`): ro'yxatda
// yo'q model so'ralsa sukut ishlatiladi — brauzerdan istalgan (qimmat)
// modelni yozib yuborib bo'lmaydi.

export interface ModelChoices {
  models: AiModelOption[];
  defaultModel: string;
  defaultEffort: AiEffort | null;
}

/** Admin tanlamagan bo'lsa — .env modeli boshida, keyin katalog (taxalluslarsiz). */
export function adminModelIds(settings: Pick<AiSettings, "models">, envModel: string): string[] {
  if (settings.models?.length) return [...new Set(settings.models)];
  return [envModel, ...AI_MODEL_CATALOG.filter((m) => !m.alias && m.id !== envModel).map((m) => m.id)];
}

export function modelChoices(
  cfg: Pick<AiProviderConfig, "model" | "api">,
  settings: Pick<AiSettings, "models" | "defaultModel" | "defaultEffort">,
  available: ReadonlySet<string> | null = null,
): ModelChoices {
  const responses = cfg.api === "responses";
  let ids = adminModelIds(settings, cfg.model);
  if (!responses) ids = ids.filter((id) => !modelInfo(id).responsesOnly);
  if (available) ids = ids.filter((id) => id === cfg.model || available.has(id));
  if (!ids.length) ids = [cfg.model];

  const models = ids.map((id) => modelOption(id, responses));
  const defaultModel =
    settings.defaultModel && ids.includes(settings.defaultModel) ? settings.defaultModel : ids.includes(cfg.model) ? cfg.model : ids[0];
  const efforts = models.find((m) => m.id === defaultModel)?.efforts ?? [];
  return { models, defaultModel, defaultEffort: nearestEffort(settings.defaultEffort ?? DEFAULT_EFFORT, efforts) };
}

/** Xodim so'ragan model va daraja → ruxsat etilgani (ruxsatsizi — sukutga). */
export function resolveChoice(c: ModelChoices, model: unknown, effort: unknown): { model: string; effort: AiEffort | null } {
  const picked = c.models.find((m) => m.id === model) ?? c.models.find((m) => m.id === c.defaultModel) ?? c.models[0];
  const want = isEffort(effort) ? effort : (c.defaultEffort ?? DEFAULT_EFFORT);
  return { model: picked.id, effort: nearestEffort(want, picked.efforts) };
}
