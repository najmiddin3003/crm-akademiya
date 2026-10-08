// OpenAI RESPONSES API javobini yig'ish — sof funksiyalar (lib/ai/sse.ts ning
// Responses juftligi, 08.10.2026).
//
// Fayl HECH NARSA import qilmaydi: sinov skripti uni tarmoqsiz tekshiradi.
//
// CHAT COMPLETIONS'DAN FARQI — oqim "hodisa" lardan iborat (`type` maydoni):
//   • response.output_text.delta — javob matnining bo'lagi (`delta`);
//   • response.output_item.done  — tugagan element: fikrlash (reasoning),
//     vosita chaqiruvi (function_call: `call_id`, `name`, TO'LIQ
//     `arguments`) yoki xabar (message);
//   • response.completed / response.incomplete — yakun; `response.output`
//     da hamma elementlar;
//   • response.failed / error — xato.
// Argumentlarni bo'laklardan yig'ish shart emas — `output_item.done` to'liq
// elementni beradi.
//
// KEYINGI MUROJAATGA QAYTARISH. So'rov `store: false` bilan ketadi —
// OpenAI hech narsani eslab qolmaydi (o'quvchi ismlari, summalar uning
// bazasida qolmasin). Shuning uchun model o'z fikrlashini va vosita
// chaqiruvlarini keyingi so'rovda yana ko'rishi kerak: aks holda vosita
// natijasini o'z chaqiruviga bog'lay olmaydi. Fikrlash elementi shifrlangan
// (`encrypted_content`) keladi va O'ZGARTIRILMAY qaytariladi. Shifri yo'q
// bo'lsa — u tashlanadi va qolgan elementlardan `id` olib tashlanadi: aks
// holda OpenAI ularni o'z bazasidan qidirib, "not found" bilan rad etadi.

export type ResponseItem = Record<string, unknown>;

export interface ResponseState {
  /** Oqimda kelgan matn (oqimsiz javobda — xabar elementlaridan). */
  content: string;
  /** Tugagan elementlar `output_index` bo'yicha — yakuniy hodisa kelmasa ham ishlatiladi. */
  done: ResponseItem[];
  /** Yakuniy hodisadagi to'liq ro'yxat (`response.output`). */
  output: ResponseItem[] | null;
  /** completed | incomplete | failed … */
  status: string | null;
  incompleteReason: string | null;
  error: string | null;
}

export interface ResponseCall {
  callId: string;
  name: string;
  arguments: string;
}

export function emptyResponseState(): ResponseState {
  return { content: "", done: [], output: null, status: null, incompleteReason: null, error: null };
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Yakuniy `response` obyekti — holat, elementlar, xato. */
function finish(state: ResponseState, r: Record<string, unknown>): void {
  if (typeof r.status === "string") state.status = r.status;
  if (Array.isArray(r.output)) state.output = r.output.map(obj);
  const inc = obj(r.incomplete_details);
  if (typeof inc.reason === "string") state.incompleteReason = inc.reason;
  const err = obj(r.error);
  if (typeof err.message === "string" && err.message) state.error = err.message;
  else if (r.status === "failed") state.error = "response failed";
}

/**
 * Bitta oqim hodisasini holatga qo'shadi. Qaytaradi — shu hodisadagi javob
 * matni (panelga darhol uzatiladi), bo'lmasa bo'sh satr.
 */
export function applyResponseEvent(state: ResponseState, ev: unknown): string {
  const e = obj(ev);
  switch (e.type) {
    case "response.output_text.delta":
    case "response.refusal.delta": {
      const text = typeof e.delta === "string" ? e.delta : "";
      state.content += text;
      return text;
    }
    case "response.output_item.done": {
      const i = Number(e.output_index);
      const item = obj(e.item);
      if (Number.isInteger(i) && i >= 0 && i < 1000 && typeof item.type === "string") state.done[i] = item;
      return "";
    }
    case "response.completed":
    case "response.incomplete":
    case "response.failed":
      finish(state, obj(e.response));
      return "";
    case "error": {
      const nested = obj(e.error);
      state.error = String(e.message ?? nested.message ?? "stream error");
      return "";
    }
    default:
      return "";
  }
}

/** Oqim EMAS — butun javob bir yo'la (oqim rad etilganda yoki proksi oqimni qo'llamasa). */
export function responseStateFromBody(body: unknown): ResponseState {
  const s = emptyResponseState();
  const b = obj(body);
  finish(s, b);
  if (!s.error && b.error && !Array.isArray(b.output)) s.error = String(obj(b.error).message ?? b.error);
  s.content = textOf(itemsOf(s));
  return s;
}

/** Javob elementlari: yakuniy hodisadagisi, u kelmagan bo'lsa — tugaganlari. */
export function itemsOf(state: ResponseState): ResponseItem[] {
  return state.output ?? state.done.filter(Boolean);
}

/** Xabar elementlaridagi matn (rad javobi ham — xodim sababini ko'rsin). */
export function textOf(items: readonly ResponseItem[]): string {
  return items
    .filter((it) => it.type === "message")
    .flatMap((it) => (Array.isArray(it.content) ? it.content.map(obj) : []))
    .map((c) =>
      c.type === "output_text" && typeof c.text === "string" ? c.text : c.type === "refusal" && typeof c.refusal === "string" ? c.refusal : "",
    )
    .join("");
}

export function functionCallsOf(items: readonly ResponseItem[]): ResponseCall[] {
  return items
    .filter((it) => it.type === "function_call" && typeof it.name === "string" && it.name)
    .map((it, i) => ({
      // `call_id` — natija shu bilan bog'lanadi; yo'q bo'lsa (proksi) o'zimiz beramiz.
      callId: String(it.call_id || it.id || `call_${i}`),
      name: String(it.name),
      arguments: typeof it.arguments === "string" && it.arguments ? it.arguments : "{}",
    }));
}

/** Keyingi so'rovga qaytariladigan elementlar (yuqoridagi izoh). */
export function replayItems(items: readonly ResponseItem[]): ResponseItem[] {
  const sealed = items.every((it) => it.type !== "reasoning" || typeof it.encrypted_content === "string");
  return sealed ? [...items] : plainItems(items);
}

/**
 * Fikrlash elementlarisiz va `id` siz — OpenAI hech birini o'z bazasidan
 * qidirmaydi. Oddiy xabarlarga (`role` + `content`) tegmaydi.
 */
export function plainItems(items: readonly ResponseItem[]): ResponseItem[] {
  return items
    .filter((it) => it.type !== "reasoning")
    .map((it) => ("id" in it ? Object.fromEntries(Object.entries(it).filter(([k]) => k !== "id")) : it));
}
