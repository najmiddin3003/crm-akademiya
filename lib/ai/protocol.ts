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
  /** Amal qoralamasi tayyor — panel tasdiq kartasini chizadi (2-bosqich). */
  | { type: "action"; action: AiActionView }
  /** Ulanish tirikligi — kutish uzoq cho'zilganda (Nginx uzib qo'ymasin). */
  | { type: "ping" }
  | { type: "done" }
  /** `detail` — faqat ADMINGA: xizmatning asl xato matni (kalit yashirilgan). */
  | { type: "error"; message: string; detail?: string };

/** Saqlangan suhbatdagi bitta xabar (GET /api/ai/conversations). */
export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
  /** ISO vaqt. */
  at: string;
  /** Shu javobda tayyorlangan amal qoralamalari (`ai_actions.id`) — faqat bazada. */
  actionIds?: string[];
  /** Panelga: qoralamalarning HOZIRGI holati (GET /api/ai/conversations to'ldiradi). */
  actions?: AiActionView[];
}

// ── AMALLAR (2-bosqich) ─────────────────────────────────────────────
//
// Model hech narsani o'zi SAQLAMAYDI: u faqat qoralama tuzadi
// (lib/ai/actions), panel uni karta qilib ko'rsatadi va yozuv xodim
// «Tasdiqlash» ni bosgandagina bo'ladi (POST /api/ai/actions/:id).

/**
 * 2-bosqich: lid, kirim, chiqim. 3-bosqich (08.10.2026): boshqa kassaga
 * ko'chirish (qabul qiluvchi keyin ✓/✗ qiladi), o'quvchiga izoh, xodimga
 * topshiriq.
 */
export type AiActionKind = "lead" | "kirim" | "chiqim" | "transfer" | "comment" | "task";

/** `expired` bazada yozilmaydi — muddati o'tgan qoralama ko'rsatishda shunday chiqadi. */
export type AiActionStatus = "draft" | "executing" | "done" | "failed" | "cancelled" | "expired";

/** Kartadagi qator. Yorliq mijozda (`key` bo'yicha, `t()` bilan), qiymat — tayyor matn. */
export type AiActionFieldKey =
  | "type"
  | "pupil"
  | "employee"
  | "group"
  | "teacher"
  | "course"
  | "days"
  | "amount"
  | "method"
  | "month"
  | "cashbox"
  | "branch"
  | "author"
  | "discount"
  | "note"
  | "from_cashbox"
  | "to_cashbox"
  | "comment"
  | "title"
  | "description"
  | "deadline"
  | "priority"
  | "fine"
  | "link";

export interface AiActionField {
  key: AiActionFieldKey;
  value: string;
}

export interface AiActionView {
  id: string;
  kind: AiActionKind;
  status: AiActionStatus;
  fields: AiActionField[];
  /** ISO — qoralama shu vaqtgacha tasdiqlanishi mumkin. */
  expiresAt: string;
  /** Saqlangandan keyin: yozuv raqami ("#708") va sahifa havolasi. */
  resultText?: string;
  resultHref?: string;
  /** Saqlab bo'lmagan bo'lsa — sabab (o'zbekcha, mijoz `t()` qiladi). */
  error?: string;
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
  /** Amallar (lid, kirim, chiqim, ko'chirish, izoh, topshiriq — tasdiq bilan) shu xodimga ochiqmi. */
  actions: boolean;
}
