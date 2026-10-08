import type { Lang } from "@/lib/i18n";
import { HISTORY_MESSAGES, MAX_ROUNDS, ROUND_TIMEOUT_MS, TOTAL_DEADLINE_MS, type AiProviderConfig } from "./config";
import type { AiContext } from "./context";
import {
  AiProviderError,
  PROVIDER_ERRORS,
  streamChatCompletion,
  streamResponse,
  type ChatMessage,
  type ResponseInputItem,
  type ResponseToolSpec,
  type ToolSpec,
} from "./openai";
import { systemPrompt } from "./prompt";
import type { AiChatMessage, AiEffort, AiStreamEvent } from "./protocol";
import { toolLabel } from "./toolLabels";
import { responseToolSpecs, runTool, tooManyCallsResult, toolSpecs, toolsFor } from "./tools";

// BITTA SAVOL — model ↔ vositalar sikli.
//
//   1. Model savolni va ruxsat etilgan vositalar ro'yxatini oladi.
//   2. Vosita so'rasa — server uni xodim nomidan bajaradi va natijani
//      qaytaradi; model yana o'ylaydi.
//   3. Vosita so'ramasa — bu yakuniy javob, bo'laklab panelga oqadi.
//
// CHEGARALAR: ko'pi bilan MAX_ROUNDS murojaat; oxirgi murojaatda vosita
// chaqirib BO'LMAYDI — model javob yozishga majbur bo'ladi. Bir murojaatda
// ko'pi bilan MAX_CALLS_PER_ROUND vosita (Mongo pool'i kichik — vositalar
// navbat bilan bajariladi, parallel emas: lib/mongodb.ts → POOL).
//
// IKKI API (lib/ai/config.ts → `api`) — sikl bitta, "suhbat daftari"
// (`Dialog`) har birida o'z shaklida yuritiladi.

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
  /**
   * «Tezlik» — fikrlash darajasi (faqat Responses API'da; Chat Completions
   * vosita bilan fikrlay olmaydi). `null`/berilmagan — modelning o'z sukuti.
   */
  effort?: AiEffort | null;
}

export interface ChatTurnResult {
  answer: string;
  /** Ishlatilgan vositalar nomi — jurnal uchun. */
  usedTools: string[];
  /** Shu javobda tuzilgan amal qoralamalari — suhbatga bog'lanadi (lib/ai/store.ts). */
  actionIds: string[];
}

interface ModelCall {
  id: string;
  name: string;
  arguments: string;
}

/**
 * Model bilan suhbat "daftari":
 *   • Chat Completions — `messages`: assistant (+ tool_calls), keyin har
 *     chaqiruvga role "tool" xabari;
 *   • Responses — `input` elementlari: modelning fikrlashi va function_call
 *     elementlari (o'zgartirilmay), keyin function_call_output. `store:
 *     false` — OpenAI hech narsani eslamaydi, hammasini o'zimiz qaytaramiz.
 */
interface Dialog {
  /** Bitta murojaat; vosita chaqirgan bo'lsa — chaqiruvlar (daftarga yozib qo'yiladi). */
  call(last: boolean, signal: AbortSignal, onText: (text: string) => void): Promise<ModelCall[]>;
  /** Vosita natijasi — o'sha chaqiruv id'si bilan. */
  answer(callId: string, content: string): void;
}

function chatDialog(input: ChatTurnInput, system: string, specs: ToolSpec[]): Dialog {
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...input.history.slice(-HISTORY_MESSAGES).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: input.question },
  ];
  return {
    async call(last, signal, onText) {
      // Oxirgi murojaatda vositalar umuman berilmaydi.
      const res = await streamChatCompletion(input.cfg, { messages, tools: last ? [] : specs, signal, onText });
      if (res.toolCalls.length) messages.push({ role: "assistant", content: res.content || null, tool_calls: res.toolCalls });
      return res.toolCalls.map((c) => ({ id: c.id, name: c.function.name, arguments: c.function.arguments }));
    },
    answer(callId, content) {
      messages.push({ role: "tool", tool_call_id: callId, content });
    },
  };
}

function responsesDialog(input: ChatTurnInput, system: string, tools: ResponseToolSpec[]): Dialog {
  const items: ResponseInputItem[] = [
    ...input.history.slice(-HISTORY_MESSAGES).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: input.question },
  ];
  return {
    async call(last, signal, onText) {
      // Oxirgi murojaatda ro'yxat turadi (oldingi chaqiruvlar unga
      // tayanadi), lekin `tool_choice: "none"` — model faqat javob yozadi.
      const res = await streamResponse(input.cfg, {
        instructions: system,
        input: items,
        tools,
        toolChoice: last ? "none" : "auto",
        effort: input.effort ?? null,
        signal,
        onText,
      });
      items.push(...res.replay);
      return res.calls.map((c) => ({ id: c.callId, name: c.name, arguments: c.arguments }));
    },
    answer(callId, content) {
      items.push({ type: "function_call_output", call_id: callId, output: content });
    },
  };
}

export async function runChatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
  const { ctx, cfg, emit, signal } = input;
  const tools = toolsFor(ctx);
  const system = systemPrompt(ctx, input.lang);
  const dialog =
    cfg.api === "responses" ? responsesDialog(input, system, responseToolSpecs(tools)) : chatDialog(input, system, toolSpecs(tools));

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
    let calls: ModelCall[];
    try {
      calls = await dialog.call(last, link.signal, onText);
    } finally {
      link.dispose();
    }

    if (calls.length === 0) break;

    for (const [i, call] of calls.entries()) {
      if (i >= MAX_CALLS_PER_ROUND) {
        dialog.answer(call.id, tooManyCallsResult(MAX_CALLS_PER_ROUND));
        continue;
      }
      emit({ type: "tool", id: call.id, label: toolLabel(call.name), status: "start" });
      const result = await runTool(ctx, call.name, call.arguments);
      emit({
        type: "tool",
        id: call.id,
        label: toolLabel(call.name),
        status: result.ok ? "done" : "error",
        // Panel kichrayib, ekranda shu sahifani ochadi (4-bosqich).
        ...(result.ok && result.screen ? { href: result.screen } : {}),
      });
      if (result.action) {
        emit({ type: "action", action: result.action });
        actionIds.push(result.action.id);
      }
      dialog.answer(call.id, result.content);
      usedTools.push(call.name);
    }
  }

  return { answer: answer.trim(), usedTools, actionIds };
}
