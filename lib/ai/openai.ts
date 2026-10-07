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
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: req.messages,
        ...(req.tools.length ? { tools: req.tools } : {}),
        stream: true,
      }),
      signal: req.signal,
    });
  } catch (e) {
    if (req.signal.aborted) throw new AiProviderError(PROVIDER_ERRORS.timeout.message, "timeout");
    throw new AiProviderError(PROVIDER_ERRORS.network.message, String((e as Error)?.message ?? e));
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
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
