import type { Lang } from "@/lib/i18n";
import { HISTORY_MESSAGES, MAX_ROUNDS, ROUND_TIMEOUT_MS, TOTAL_DEADLINE_MS, type AiProviderConfig } from "./config";
import type { AiContext } from "./context";
import { AiProviderError, PROVIDER_ERRORS, streamChatCompletion, type ChatMessage, type CompletionResult } from "./openai";
import { systemPrompt } from "./prompt";
import type { AiChatMessage, AiStreamEvent } from "./protocol";
import { toolLabel } from "./toolLabels";
import { runTool, tooManyCallsResult, toolSpecs, toolsFor } from "./tools";

// BITTA SAVOL — model ↔ vositalar sikli.
//
//   1. Model savolni va ruxsat etilgan vositalar ro'yxatini oladi.
//   2. Vosita so'rasa — server uni xodim nomidan bajaradi va natijani
//      qaytaradi; model yana o'ylaydi.
//   3. Vosita so'ramasa — bu yakuniy javob, bo'laklab panelga oqadi.
//
// CHEGARALAR: ko'pi bilan MAX_ROUNDS murojaat; oxirgi murojaatda vositalar
// BERILMAYDI — model javob yozishga majbur bo'ladi. Bir murojaatda ko'pi
// bilan MAX_CALLS_PER_ROUND vosita (Mongo pool'i kichik — vositalar
// navbat bilan bajariladi, parallel emas: lib/mongodb.ts → POOL).

const MAX_CALLS_PER_ROUND = 4;

/** Ota signal (mijoz uzildi) yoki vaqt tugashi — qaysi biri oldin bo'lsa. */
function linkedSignal(parent: AbortSignal, ms: number): { signal: AbortSignal; dispose: () => void } {
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  if (parent.aborted) ctl.abort();
  else parent.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => ctl.abort(), Math.max(ms, 1));
  return {
    signal: ctl.signal,
    dispose: () => {
      clearTimeout(timer);
      parent.removeEventListener("abort", onAbort);
    },
  };
}

export interface ChatTurnInput {
  ctx: AiContext;
  cfg: AiProviderConfig;
  lang: Lang;
  /** Shu suhbatning oldingi xabarlari (bazadan, lib/ai/store.ts). */
  history: AiChatMessage[];
  question: string;
  emit: (e: AiStreamEvent) => void;
  /** Mijoz ulanishni uzsa — ish to'xtaydi (OpenAI'ga ortiqcha pul ketmasin). */
  signal: AbortSignal;
}

export interface ChatTurnResult {
  answer: string;
  /** Ishlatilgan vositalar nomi — jurnal uchun. */
  usedTools: string[];
  /** Shu javobda tuzilgan amal qoralamalari — suhbatga bog'lanadi (lib/ai/store.ts). */
  actionIds: string[];
}

export async function runChatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
  const { ctx, cfg, emit, signal } = input;
  const tools = toolsFor(ctx);
  const specs = toolSpecs(tools);
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(ctx, input.lang) },
    ...input.history.slice(-HISTORY_MESSAGES).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: input.question },
  ];

  const deadline = Date.now() + TOTAL_DEADLINE_MS;
  let answer = "";
  const usedTools: string[] = [];
  const actionIds: string[] = [];

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (signal.aborted) break;
    const left = deadline - Date.now();
    if (left <= 0) throw new AiProviderError(PROVIDER_ERRORS.timeout.message, "umumiy muddat tugadi");

    // Oldingi murojaatdan qolgan matn bilan yangisi yopishib qolmasin.
    let roundStarted = false;
    const onText = (text: string) => {
      if (!roundStarted && answer && !answer.endsWith("\n")) {
        answer += "\n\n";
        emit({ type: "delta", text: "\n\n" });
      }
      roundStarted = true;
      answer += text;
      emit({ type: "delta", text });
    };

    const last = round === MAX_ROUNDS;
    const link = linkedSignal(signal, Math.min(ROUND_TIMEOUT_MS, left));
    let res: CompletionResult;
    try {
      res = await streamChatCompletion(cfg, { messages, tools: last ? [] : specs, signal: link.signal, onText });
    } finally {
      link.dispose();
    }

    if (res.toolCalls.length === 0) break;

    messages.push({ role: "assistant", content: res.content || null, tool_calls: res.toolCalls });
    for (const [i, call] of res.toolCalls.entries()) {
      if (i >= MAX_CALLS_PER_ROUND) {
        messages.push({ role: "tool", tool_call_id: call.id, content: tooManyCallsResult(MAX_CALLS_PER_ROUND) });
        continue;
      }
      emit({ type: "tool", id: call.id, label: toolLabel(call.function.name), status: "start" });
      const result = await runTool(ctx, call.function.name, call.function.arguments);
      emit({ type: "tool", id: call.id, label: toolLabel(call.function.name), status: result.ok ? "done" : "error" });
      if (result.action) {
        emit({ type: "action", action: result.action });
        actionIds.push(result.action.id);
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: result.content });
      usedTools.push(call.function.name);
    }
  }

  return { answer: answer.trim(), usedTools, actionIds };
}
