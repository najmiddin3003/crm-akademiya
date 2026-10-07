// AI YORDAMCHI — server va panel o'rtasidagi oqim (stream) shakli.
//
// Bu fayl HECH NARSA import qilmaydi: uni ham server (app/api/ai/chat),
// ham "use client" panel (components/ai) o'qiydi. Server tomondagi
// modullarni bu yerga olib kirish ularni brauzer to'plamiga tortib,
// sahifani yiqitardi (lib/debtorsTypes.ts izohidagi holat).
//
// JAVOB — NDJSON: har qatorda bitta JSON hodisa. SSE (EventSource) emas,
// chunki EventSource faqat GET yuboradi, savol esa POST tanasida ketadi.

export type AiToolStatus = "start" | "done" | "error";

export type AiStreamEvent =
  /** Birinchi hodisa: suhbat id'si (yangi bo'lsa ham) va qolgan limit. */
  | { type: "meta"; conversationId: string; remaining: number; limit: number }
  /** Vosita ishga tushdi / tugadi — panelda "… olinmoqda" belgisi. */
  | { type: "tool"; id: string; label: string; status: AiToolStatus }
  /** Javob matnining navbatdagi bo'lagi. */
  | { type: "delta"; text: string }
  /** Ulanish tirikligi — kutish uzoq cho'zilganda (Nginx uzib qo'ymasin). */
  | { type: "ping" }
  | { type: "done" }
  | { type: "error"; message: string };

/** Saqlangan suhbatdagi bitta xabar (GET /api/ai/conversations). */
export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
  /** ISO vaqt. */
  at: string;
}

/** GET /api/ai/status javobi. */
export interface AiStatus {
  /** Admin yoqqanmi (Sozlamalar). */
  enabled: boolean;
  /** Serverda kalit sozlanganmi (.env). */
  configured: boolean;
  isAdmin: boolean;
  limit: number;
  remaining: number;
}
