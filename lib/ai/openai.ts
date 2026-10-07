import type { AiProviderConfig } from "./config";
import { applyChunk, emptyState, SseLineBuffer, stateFromMessage, type CompletionState } from "./sse";

// OpenAI CHAT COMPLETIONS — oqim (stream) va vosita chaqiruvlari bilan.
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
// Har biri birinchi rad javobidan keyin qo'llanib, so'rov qayta yuboriladi
// va shu jarayonda o'sha model (baseUrl + model) uchun eslab qolinadi.
// Boshqa 400 da qayta so'ralmaydi.
interface ModelQuirks {
  reasoningNone?: boolean;
  noStream?: boolean;
}
const quirks = new Map<string, ModelQuirks>();

/** 400 javobi qaysi moslashuvni so'rayapti (hech qaysi — `null`). */
function quirkFor(status: number, raw: string): keyof ModelQuirks | null {
  if (status !== 400) return null;
  let param = "";
  let text = raw;
  try {
    const err = JSON.parse(raw)?.error;
    param = String(err?.param ?? "");
    text = String(err?.message ?? "");
  } catch {
    // JSON emas — xom matn
  }
  if (param === "reasoning_effort" || (/reasoning_effort/i.test(text) && /\bnone\b/i.test(text))) return "reasoningNone";
  if (param === "stream" || /\bstream/i.test(text)) return "noStream";
  return null;
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
  const send = async (): Promise<Response> => {
    try {
      return await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: cfg.model,
          messages: req.messages,
          ...(req.tools.length ? { tools: req.tools } : {}),
          ...(q.reasoningNone ? { reasoning_effort: "none" } : {}),
          stream: !q.noStream,
        }),
        signal: req.signal,
      });
    } catch (e) {
      if (req.signal.aborted) throw new AiProviderError(PROVIDER_ERRORS.timeout.message, "timeout");
      throw new AiProviderError(PROVIDER_ERRORS.network.message, String((e as Error)?.message ?? e));
    }
  };

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

  if (!res.ok) {
    let detail = raw.slice(0, 500);
    try {
      detail = String(JSON.parse(raw)?.error?.message ?? detail);
    } catch {
      // JSON emas — xom matn qoladi
    }
    throw new AiProviderError(providerMessage(res.status), `HTTP ${res.status} (${cfg.model}): ${detail}`);
  }

  let state: CompletionState;
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/event-stream")) {
    // Proksi oqimni qo'llamadi — butun javob bir yo'la keldi.
    state = stateFromMessage(await res.json().catch(() => ({})));
    if (state.content) req.onText(state.content);
  } else {
    state = emptyState();
    const reader = res.body?.getReader();
    if (!reader) throw new AiProviderError(providerMessage(502), "javob tanasi yo'q");
    const decoder = new TextDecoder();
    const lines = new SseLineBuffer();
    const feed = (data: string[]) => {
      for (const d of data) {
        if (d === "[DONE]") continue;
        let chunk: unknown;
        try {
          chunk = JSON.parse(d);
        } catch {
          continue; // buzilgan bo'lak — keyingisi baribir keladi
        }
        const text = applyChunk(state, chunk);
        if (text) req.onText(text);
      }
    };
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        feed(lines.push(decoder.decode(value, { stream: true })));
      }
      feed(lines.push(decoder.decode()));
      feed(lines.flush());
    } catch (e) {
      if (req.signal.aborted) throw new AiProviderError(PROVIDER_ERRORS.timeout.message, "timeout (stream)");
      throw new AiProviderError(providerMessage(502), `oqim uzildi: ${String((e as Error)?.message ?? e)}`);
    }
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
