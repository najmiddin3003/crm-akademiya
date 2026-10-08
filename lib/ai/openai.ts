import type { AiProviderConfig } from "./config";
import type { AiEffort } from "./protocol";
import {
  applyResponseEvent,
  emptyResponseState,
  functionCallsOf,
  itemsOf,
  plainItems,
  replayItems,
  responseStateFromBody,
  type ResponseCall,
  type ResponseItem,
  type ResponseState,
} from "./responsesSse";
import { applyChunk, emptyState, SseLineBuffer, stateFromMessage, type CompletionState } from "./sse";

// OpenAI — oqim (stream) va vosita chaqiruvlari bilan. Ikki yo'l
// (lib/ai/config.ts → `api`):
//   • RESPONSES (`streamResponse`, 08.10.2026) — OpenAI'ning o'zi bilan:
//     fikrlash darajasi («Tezlik») vositalar bilan birga faqat shu yerda;
//   • CHAT COMPLETIONS (`streamChatCompletion`) — proksi orqali.
//
// SDK EMAS, oddiy `fetch` — loyihadagi boshqa tashqi xizmatlar bilan bir
// xil (Google Sheets, Cloudinary, /api/gender-guess). `OPENAI_BASE_URL`
// orqali OpenAI'ga mos proksi ham ishlaydi.
//
// SO'ROV TANASI ATAYIN SODDA: `temperature`, `max_tokens`,
// `stream_options` yuborilmaydi — yangi modellar ularning bir qismini rad
// etadi (lib/genderGuess.ts → chatBody izohi), model almashtirilganda
// so'rov jimgina buzilardi.

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ToolSpec {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

/**
 * Xizmat xatosi. `message` — xodimga ko'rsatiladigan (o'zbekcha, `t()`
 * mijozda o'giradi), `detail` — faqat server jurnaliga (kalit, model nomi
 * kabi narsalar xodimga ko'rsatilmaydi).
 */
export class AiProviderError extends Error {
  // Parametr-xususiyat (konstruktorda `readonly …`) EMAS: Node skriptlari TS
  // turlarini faqat o'chiradi va u sintaksisni bajarmaydi. Nomlar `message`/
  // `detail` emas — i18n skaneri ularni xabar maydoni deb o'qiydi.
  readonly logDetail: string;
  constructor(userText: string, logDetail: string) {
    super(userText);
    this.name = "AiProviderError";
    this.logDetail = logDetail;
  }
}

/**
 * Xodimga ko'rinadigan xabarlar. Maydon nomi ataylab "message": i18n
 * skaneri (scripts/i18n-scan.mjs) backend xabarlarini shu nomdan taniydi
 * va inglizchasi yo'qligini ko'rsatadi.
 */
export const PROVIDER_ERRORS = {
  auth: { message: "AI xizmati kalitni qabul qilmadi. Administratorga xabar bering." },
  model: { message: "AI modeli topilmadi. Administratorga xabar bering." },
  busy: { message: "AI xizmati hozir band yoki hisob limiti tugagan. Birozdan keyin qayta urinib ko'ring." },
  down: { message: "AI xizmati vaqtincha javob bermayapti. Birozdan keyin qayta urinib ko'ring." },
  rejected: { message: "AI xizmati so'rovni qabul qilmadi. Administratorga xabar bering." },
  timeout: { message: "AI javobi juda uzoq davom etdi. Savolni qisqaroq qilib qayta yuboring." },
  network: { message: "AI xizmatiga ulanib bo'lmadi. Birozdan keyin qayta urinib ko'ring." },
} as const;

function providerMessage(status: number): string {
  if (status === 401 || status === 403) return PROVIDER_ERRORS.auth.message;
  if (status === 404) return PROVIDER_ERRORS.model.message;
  if (status === 429) return PROVIDER_ERRORS.busy.message;
  if (status >= 500) return PROVIDER_ERRORS.down.message;
  return PROVIDER_ERRORS.rejected.message;
}

/**
 * Xato tafsiloti ADMINGA (panelda, xodimlarga emas): xizmatning asl matni.
 * Kalitga o'xshagan bo'lak yashiriladi — OpenAI 401 matnida kalitning
 * boshi va oxiri bo'ladi, proksi esa butun sarlavhani qaytarishi mumkin.
 */
export function adminDetail(logDetail: string): string {
  return logDetail.replace(/sk-[A-Za-z0-9_*-]{6,}/g, "sk-…").slice(0, 400);
}

// MODELGA MOSLASHUV. Ba'zi modellar so'rovni 400 bilan rad etib, nima
// o'zgartirish kerakligini o'zi aytadi:
//   • `reasoningNone` — gpt-5.6 Chat Completions'da vositalarni faqat
//     fikrlashsiz qabul qiladi: "Function tools with reasoning_effort are not
//     supported for gpt-5.6 in /v1/chat/completions … set reasoning_effort to
//     'none'" (sinov saytida 07.10.2026 da ko'rildi). Eski modellar esa bu
//     maydonni umuman tanimaydi — shuning uchun oldindan yuborilmaydi;
//   • `noStream` — tashkilot tasdiqlanmagan bo'lsa yangi modellar oqimni rad
//     etadi ("Your organization must be verified to stream this model",
//     `param: "stream"`): javob bo'laklab emas, bir yo'la keladi.
//   • `effort` (faqat Responses) — model tanlangan darajani qabul qilmasa
//     (GPT-6 Astra `none` ni rad etadi), OpenAI qabul qiladiganlarini
//     sanab beradi ("Supported values are: 'low', 'medium' …") — eng
//     yaqini olinadi; ro'yxat bo'lmasa (fikrlamaydigan model) `reasoning`
//     umuman yuborilmaydi.
// Har biri birinchi rad javobidan keyin qo'llanib, so'rov qayta yuboriladi
// va shu jarayonda o'sha model (baseUrl + model) uchun eslab qolinadi.
// Boshqa 400 da qayta so'ralmaydi.
interface ModelQuirks {
  reasoningNone?: boolean;
  noStream?: boolean;
  /** So'ralgan daraja → model qabul qiladigani (`null` — `reasoning` yuborilmaydi). */
  effort?: Partial<Record<AiEffort, string | null>>;
  /** Oldingi elementlar fikrlashsiz va `id` siz qaytariladi (`responsesQuirkFor`). */
  plainInput?: boolean;
}
const quirks = new Map<string, ModelQuirks>();

/** OpenAI xato javobidan `param` va matn (`said`). */
function errorParts(raw: string): { param: string; said: string } {
  let param = "";
  let said = raw; // JSON bo'lmasa — xom matn
  try {
    const err = JSON.parse(raw)?.error;
    param = String(err?.param ?? "");
    said = String(err?.message ?? "");
  } catch {
    // JSON emas
  }
  return { param, said };
}

/** 400 javobi qaysi moslashuvni so'rayapti (hech qaysi — `null`). Chat Completions uchun. */
function quirkFor(status: number, raw: string): "reasoningNone" | "noStream" | null {
  if (status !== 400) return null;
  const { param, said: text } = errorParts(raw);
  if (param === "reasoning_effort" || (/reasoning_effort/i.test(text) && /\bnone\b/i.test(text))) return "reasoningNone";
  if (param === "stream" || /\bstream/i.test(text)) return "noStream";
  return null;
}

/** OpenAI'ning barcha darajalari, tezdan chuqurga (bizning to'rttamiz ham shu zinapoyada). */
const EFFORT_LADDER = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];

type ResponsesFix = { kind: "noStream" } | { kind: "plainInput" } | { kind: "effort"; supported: string[] };

/**
 * Responses: 400 javobi nimani so'rayapti. `supported` — model qabul
 * qiladigan darajalar (bo'sh — model umuman fikrlamaydi).
 *
 * `plainInput` — oldingi murojaat elementlarini qaytarib bo'lmadi ("Item …
 * not found", "provided without its required 'reasoning' item"): fikrlash
 * elementlari tashlanadi, qolganidan `id` olinadi. Hujjat bo'yicha bunday
 * bo'lmasligi kerak (`store: false` da fikrlash shifrlangan keladi) —
 * sinab bo'lmagan holatga zaxira.
 */
function responsesQuirkFor(status: number, raw: string): ResponsesFix | null {
  if (status !== 400) return null;
  const { param, said: text } = errorParts(raw);
  if (/not found|not persisted|without its required|required following item/i.test(text)) return { kind: "plainInput" };
  if (param.startsWith("reasoning") || /reasoning[._ ]?effort|\beffort\b/i.test(text)) {
    // `\b` boshida SHART: matn "Unsupported value: 'none' …" bilan boshlanadi — ro'yxat esa "Supported values are: …" dan keyin.
    const list = /\bsupported values?\b([\s\S]*)$/i.exec(text)?.[1] ?? "";
    const supported = [...list.matchAll(/['"`]([a-z]+)['"`]/g)].map((m) => m[1]).filter((v) => EFFORT_LADDER.includes(v));
    return { kind: "effort", supported };
  }
  if (param === "stream" || /\bstream/i.test(text)) return { kind: "noStream" };
  return null;
}

/** `want` ga zinapoyada eng yaqin qabul qilinadigan daraja (teng masofada — chuqurrog'i). */
function closestEffort(want: string, supported: readonly string[]): string | null {
  const at = EFFORT_LADDER.indexOf(want);
  let best: string | null = null;
  let gap = Infinity;
  for (const s of supported) {
    const g = Math.abs(EFFORT_LADDER.indexOf(s) - at);
    if (g < gap || (g === gap && best !== null && EFFORT_LADDER.indexOf(s) > EFFORT_LADDER.indexOf(best))) {
      best = s;
      gap = g;
    }
  }
  return best;
}

/** Muvaffaqiyatsiz javob → xodimga xabar, jurnalga (va adminga) asl matn. */
function failure(status: number, raw: string, model: string): AiProviderError {
  let detail = raw.slice(0, 500);
  try {
    detail = String(JSON.parse(raw)?.error?.message ?? detail);
  } catch {
    // JSON emas — xom matn qoladi
  }
  return new AiProviderError(providerMessage(status), `HTTP ${status} (${model}): ${detail}`);
}

/** `fetch` ni o'rab: tarmoq xatosi va "To'xtatish"/vaqt tugashi — tushunarli xabar bilan. */
async function post(url: string, apiKey: string, body: unknown, signal: AbortSignal): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (signal.aborted) throw new AiProviderError(PROVIDER_ERRORS.timeout.message, "timeout");
    throw new AiProviderError(PROVIDER_ERRORS.network.message, String((e as Error)?.message ?? e));
  }
}

/** SSE tanasini qatorma-qator o'qib, har `data:` JSON'ini `feed` ga beradi. */
async function readSse(res: Response, signal: AbortSignal, feed: (chunk: unknown) => void): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new AiProviderError(providerMessage(502), "javob tanasi yo'q");
  const decoder = new TextDecoder();
  const lines = new SseLineBuffer();
  const take = (data: string[]) => {
    for (const d of data) {
      if (d === "[DONE]") continue;
      let chunk: unknown;
      try {
        chunk = JSON.parse(d);
      } catch {
        continue; // buzilgan bo'lak — keyingisi baribir keladi
      }
      feed(chunk);
    }
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      take(lines.push(decoder.decode(value, { stream: true })));
    }
    take(lines.push(decoder.decode()));
    take(lines.flush());
  } catch (e) {
    if (signal.aborted) throw new AiProviderError(PROVIDER_ERRORS.timeout.message, "timeout (stream)");
    throw new AiProviderError(providerMessage(502), `oqim uzildi: ${String((e as Error)?.message ?? e)}`);
  }
}

export interface CompletionResult {
  content: string;
  toolCalls: ToolCall[];
  finishReason: string | null;
}

/**
 * Bitta murojaat. Matn bo'laklari kelishi bilan `onText` ga uzatiladi;
 * vosita chaqiruvlari oxirida to'liq holda qaytadi.
 */
export async function streamChatCompletion(
  cfg: AiProviderConfig,
  req: { messages: ChatMessage[]; tools: ToolSpec[]; signal: AbortSignal; onText: (text: string) => void },
): Promise<CompletionResult> {
  const modelKey = `${cfg.baseUrl} ${cfg.model}`;
  const q = quirks.get(modelKey) ?? {};
  const send = (): Promise<Response> =>
    post(
      `${cfg.baseUrl}/chat/completions`,
      cfg.apiKey,
      {
        model: cfg.model,
        messages: req.messages,
        ...(req.tools.length ? { tools: req.tools } : {}),
        ...(q.reasoningNone ? { reasoning_effort: "none" } : {}),
        stream: !q.noStream,
      },
      req.signal,
    );

  let res = await send();
  let raw = res.ok ? "" : await res.text().catch(() => "");
  // Ikkala moslashuv ham kerak bo'lishi mumkin — har biri bir martadan.
  for (let i = 0; i < 2 && !res.ok; i++) {
    const fix = quirkFor(res.status, raw);
    if (!fix || q[fix]) break;
    q[fix] = true;
    quirks.set(modelKey, q);
    console.warn(`[ai] ${cfg.model}: ${fix} — so'rov moslashtirilib qayta yuborildi`);
    res = await send();
    raw = res.ok ? "" : await res.text().catch(() => "");
  }

  if (!res.ok) throw failure(res.status, raw, cfg.model);

  let state: CompletionState;
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/event-stream")) {
    // Proksi oqimni qo'llamadi — butun javob bir yo'la keldi.
    state = stateFromMessage(await res.json().catch(() => ({})));
    if (state.content) req.onText(state.content);
  } else {
    const s = emptyState();
    state = s;
    await readSse(res, req.signal, (chunk) => {
      const text = applyChunk(s, chunk);
      if (text) req.onText(text);
    });
  }

  if (state.error) throw new AiProviderError(providerMessage(500), `oqimdagi xato (${cfg.model}): ${state.error}`);

  return {
    content: state.content,
    toolCalls: state.calls
      .filter((c) => c.name)
      .map((c, i) => ({
        // `id` yo'q bo'lsa (ba'zi proksilar) — javobni chaqiruvga bog'lash uchun o'zimiz beramiz.
        id: c.id || `call_${i}`,
        type: "function" as const,
        function: { name: c.name, arguments: c.arguments || "{}" },
      })),
    finishReason: state.finishReason,
  };
}

// ── RESPONSES API (08.10.2026) ──────────────────────────────────────

/** Responses'dagi vosita ta'rifi — Chat Completions'dagidan farqli, `function` ichiga o'ralmagan. */
export interface ResponseToolSpec {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /**
   * Responses'da sukut `true`: sxemadagi HAR maydon majburiy bo'lishi kerak
   * bo'lardi. Bizning vositalarda ixtiyoriy argumentlar bor — shuning uchun
   * aniq `false` (aks holda OpenAI butun so'rovni 400 bilan rad etadi).
   */
  strict: false;
}

/** `input` elementi: oddiy xabar (`role` + `content`) yoki oldingi javob elementi. */
export type ResponseInputItem = Record<string, unknown>;

export interface ResponseResult {
  content: string;
  calls: ResponseCall[];
  /** Vosita chaqirilgan bo'lsa — keyingi murojaatga qaytariladigan elementlar (fikrlash + chaqiruvlar). */
  replay: ResponseInputItem[];
  /** completed | incomplete | failed (oqim yakunsiz uzilsa — `null`). */
  status: string | null;
}

/**
 * Bitta Responses murojaati. Matn bo'laklari kelishi bilan `onText` ga
 * uzatiladi; vosita chaqiruvlari oxirida to'liq holda qaytadi.
 *
 * TANA ATAYIN SODDA (yuqoridagi izoh): `temperature`, `max_output_tokens`,
 * `include` yuborilmaydi. `store: false` — OpenAI suhbatni saqlamaydi.
 * `tool_choice: "none"` — oxirgi murojaatda (lib/ai/chat.ts): vositalar
 * ro'yxati turadi (oldingi chaqiruvlar unga tayanadi), lekin model faqat
 * javob yozadi.
 */
export async function streamResponse(
  cfg: AiProviderConfig,
  req: {
    instructions: string;
    input: ResponseInputItem[];
    tools: ResponseToolSpec[];
    toolChoice: "auto" | "none";
    /** `null` — model o'z sukuti (`reasoning` yuborilmaydi). */
    effort: AiEffort | null;
    signal: AbortSignal;
    onText: (text: string) => void;
  },
): Promise<ResponseResult> {
  const modelKey = `${cfg.baseUrl} ${cfg.model}`;
  const q = quirks.get(modelKey) ?? {};
  const effortNow = (): string | null => {
    if (req.effort === null) return null;
    const mapped = q.effort?.[req.effort];
    return mapped === undefined ? req.effort : mapped;
  };
  const send = (): Promise<Response> => {
    const effort = effortNow();
    return post(
      `${cfg.baseUrl}/responses`,
      cfg.apiKey,
      {
        model: cfg.model,
        instructions: req.instructions,
        input: q.plainInput ? plainItems(req.input) : req.input,
        ...(req.tools.length ? { tools: req.tools, tool_choice: req.toolChoice } : {}),
        ...(effort ? { reasoning: { effort } } : {}),
        store: false,
        stream: !q.noStream,
      },
      req.signal,
    );
  };

  let res = await send();
  let raw = res.ok ? "" : await res.text().catch(() => "");
  // Har moslashuv bir martadan (jami ko'pi bilan 4 so'rov).
  for (let i = 0; i < 3 && !res.ok; i++) {
    const fix = responsesQuirkFor(res.status, raw);
    if (!fix) break;
    if (fix.kind === "noStream") {
      if (q.noStream) break;
      q.noStream = true;
    } else if (fix.kind === "plainInput") {
      if (q.plainInput || !req.input.some((it) => "id" in it || it.type === "reasoning")) break;
      q.plainInput = true;
    } else {
      const current = effortNow();
      if (req.effort === null || current === null) break;
      const next = closestEffort(current, fix.supported);
      if (next === current) break; // ro'yxatda bor, demak sabab boshqa
      q.effort = { ...q.effort, [req.effort]: next };
    }
    quirks.set(modelKey, q);
    console.warn(`[ai] ${cfg.model}: ${fix.kind === "effort" ? `daraja → ${effortNow() ?? "—"}` : fix.kind} — so'rov qayta yuborildi`);
    res = await send();
    raw = res.ok ? "" : await res.text().catch(() => "");
  }

  if (!res.ok) throw failure(res.status, raw, cfg.model);

  let state: ResponseState;
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/event-stream")) {
    state = responseStateFromBody(await res.json().catch(() => ({})));
    if (state.content) req.onText(state.content);
  } else {
    const s = emptyResponseState();
    state = s;
    await readSse(res, req.signal, (chunk) => {
      const text = applyResponseEvent(s, chunk);
      if (text) req.onText(text);
    });
  }

  if (state.error) throw new AiProviderError(providerMessage(500), `oqimdagi xato (${cfg.model}): ${state.error}`);

  const items: ResponseItem[] = itemsOf(state);
  const calls = functionCallsOf(items);
  return { content: state.content, calls, replay: calls.length ? replayItems(items) : [], status: state.status };
}

// ── HISOBDAGI MODELLAR ──────────────────────────────────────────────

const MODEL_LIST_TTL_MS = 10 * 60_000;
const MODEL_LIST_RETRY_MS = 60_000;
const MODEL_LIST_TIMEOUT_MS = 4_000;
const modelLists = new Map<string, { until: number; ids: Set<string> | null }>();

/**
 * OpenAI hisobida bor modellar (GET /v1/models) — panelda faqat shular
 * ko'rinadi (masalan GPT-6 Astra hamma tashkilotga ochilmagan). 10 daqiqa
 * eslab qolinadi. Olib bo'lmasa (proksi, tarmoq, kalit) — `null`: ro'yxat
 * tekshirilmaydi, model yo'q bo'lsa OpenAI o'zi aytadi ("AI modeli
 * topilmadi").
 */
export async function accountModels(cfg: Pick<AiProviderConfig, "apiKey" | "baseUrl">): Promise<Set<string> | null> {
  const hit = modelLists.get(cfg.baseUrl);
  if (hit && hit.until > Date.now()) return hit.ids;
  let ids: Set<string> | null = null;
  try {
    const res = await fetch(`${cfg.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      signal: AbortSignal.timeout(MODEL_LIST_TIMEOUT_MS),
    });
    if (res.ok) {
      const data: unknown = (await res.json())?.data;
      if (Array.isArray(data)) {
        ids = new Set(data.map((m) => String((m as { id?: unknown })?.id ?? "")).filter(Boolean));
      }
    }
  } catch {
    // tarmoq / vaqt — tekshirilmaydi
  }
  modelLists.set(cfg.baseUrl, { until: Date.now() + (ids ? MODEL_LIST_TTL_MS : MODEL_LIST_RETRY_MS), ids });
  return ids;
}
