// OpenAI Chat Completions OQIMINI (stream) yig'ish — sof funksiyalar.
//
// Alohida fayl va HECH NARSA import qilmaydi: tarmoqqa chiqmasdan sinash
// uchun (scripts/_verify-ai.mjs). Tuzoqlar aynan shu qismda:
//
//   • Vosita chaqiruvi BO'LAKLAB keladi: birinchi bo'lakda `id` va nom,
//     keyingilarida `arguments` satrining davomi. Bo'laklar `index` bo'yicha
//     yig'iladi — `id` faqat birinchisida bor.
//   • Bir javobda bir nechta vosita bo'lishi mumkin (index 0, 1, …).
//   • Tarmoq bo'lagi qatorni o'rtasidan kesishi mumkin — to'liq qator
//     kelguncha bufer saqlanadi (`SseLineBuffer`).
//   • OpenAI'ga mos proksilar ba'zan `\r\n` yuboradi, ba'zan `data:` dan
//     keyin bo'shliq qo'ymaydi.

export interface ToolCallDraft {
  id: string;
  name: string;
  arguments: string;
}

export interface CompletionState {
  content: string;
  calls: ToolCallDraft[];
  finishReason: string | null;
  /** Oqim ichida kelgan xato (`{"error": …}`). */
  error: string | null;
}

export function emptyState(): CompletionState {
  return { content: "", calls: [], finishReason: null, error: null };
}

interface ChunkToolCall {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

/**
 * Bitta JSON bo'lakni holatga qo'shadi. Qaytaradi — shu bo'lakdagi
 * matn (panelga darhol uzatiladi), bo'lmasa bo'sh satr.
 */
export function applyChunk(state: CompletionState, chunk: unknown): string {
  const c = (chunk && typeof chunk === "object" ? chunk : {}) as Record<string, unknown>;
  if (c.error) {
    const e = c.error as { message?: unknown };
    state.error = String(e?.message ?? c.error);
    return "";
  }
  const choice = Array.isArray(c.choices) ? (c.choices[0] as Record<string, unknown> | undefined) : undefined;
  if (!choice) return "";
  const delta = (choice.delta ?? {}) as { content?: unknown; tool_calls?: unknown };
  let text = "";
  if (typeof delta.content === "string" && delta.content) {
    state.content += delta.content;
    text = delta.content;
  }
  if (Array.isArray(delta.tool_calls)) {
    for (const raw of delta.tool_calls as ChunkToolCall[]) {
      const i = Number.isInteger(raw.index) ? (raw.index as number) : state.calls.length;
      const call = (state.calls[i] ??= { id: "", name: "", arguments: "" });
      if (raw.id) call.id = raw.id;
      if (raw.function?.name) call.name += raw.function.name;
      if (raw.function?.arguments) call.arguments += raw.function.arguments;
    }
  }
  if (typeof choice.finish_reason === "string") state.finishReason = choice.finish_reason;
  return text;
}

/**
 * Oqim EMAS, oddiy JSON javob keldi (ba'zi proksilar `stream: true` ni
 * e'tiborsiz qoldiradi) — o'sha natijani shu holatga keltiradi.
 */
export function stateFromMessage(body: unknown): CompletionState {
  const s = emptyState();
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (b.error) {
    s.error = String((b.error as { message?: unknown })?.message ?? b.error);
    return s;
  }
  const choice = Array.isArray(b.choices) ? (b.choices[0] as Record<string, unknown> | undefined) : undefined;
  const msg = (choice?.message ?? {}) as { content?: unknown; tool_calls?: unknown };
  if (typeof msg.content === "string") s.content = msg.content;
  if (Array.isArray(msg.tool_calls)) {
    s.calls = (msg.tool_calls as { id?: string; function?: { name?: string; arguments?: string } }[]).map((t) => ({
      id: String(t.id ?? ""),
      name: String(t.function?.name ?? ""),
      arguments: String(t.function?.arguments ?? ""),
    }));
  }
  s.finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : null;
  return s;
}

/** Tarmoq bo'laklarini to'liq SSE qatorlariga ajratadi. */
export class SseLineBuffer {
  private buf = "";

  /** Yangi matn qo'shadi; to'liq bo'lgan `data:` qiymatlarini qaytaradi. */
  push(text: string): string[] {
    this.buf += text;
    const out: string[] = [];
    let nl: number;
    while ((nl = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, nl).replace(/\r$/, "");
      this.buf = this.buf.slice(nl + 1);
      const data = dataOf(line);
      if (data !== null) out.push(data);
    }
    return out;
  }

  /** Oqim tugadi — oxirgi qator `\n` siz qolgan bo'lsa. */
  flush(): string[] {
    const line = this.buf.replace(/\r$/, "");
    this.buf = "";
    const data = dataOf(line);
    return data === null ? [] : [data];
  }
}

function dataOf(line: string): string | null {
  if (!line.startsWith("data:")) return null; // izoh (":"), "event:", bo'sh qator
  const v = line.slice(5).trim();
  return v ? v : null;
}
