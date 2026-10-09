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

/** Vazifa rejasining qadami (`update_plan` vositasi). Matn — model yozgan (xodim tilida). */
export interface AiPlanStep {
  title: string;
  status: "pending" | "active" | "done";
}

/**
 * Fikrlash darajasi — panelda «Tezlik» (tezdan chuqurga). OpenAI'ning
 * `reasoning.effort` qiymatlari; qaysi model qaysi birini qabul qilishi
 * lib/ai/models.ts da.
 */
export type AiEffort = "none" | "low" | "medium" | "high";

/** Panelda tanlanadigan model (GET /api/ai/status → `models`). */
export interface AiModelOption {
  id: string;
  /** Ko'rinadigan nom ("GPT-6 Sol") — tarjima qilinmaydi. */
  name: string;
  /** Qisqa tavsif (o'zbekcha, mijoz `t()` qiladi); noma'lum modelda bo'sh. */
  hint: string;
  /** Shu modelda tanlash mumkin bo'lgan darajalar; bo'sh — tezlik tanlanmaydi. */
  efforts: AiEffort[];
}

export type AiStreamEvent =
  /**
   * Birinchi hodisa: suhbat id'si (yangi bo'lsa ham) va qolgan limit.
   * `model`/`effort` — shu javobni HAQIQATAN qaysi model va daraja yozyapti
   * (tanlov ruxsat etilmagan bo'lsa server sukutga almashtiradi).
   */
  | { type: "meta"; conversationId: string; remaining: number; limit: number; model?: string; effort?: AiEffort | null }
  /**
   * Vosita ishga tushdi / tugadi — panelda "… olinmoqda" belgisi. `href` —
   * vosita ko'rgan ma'lumotning CRM sahifasi (faqat `done` da, xodim ocha
   * oladigan bo'lsa): panel kichrayib, ekranda shu sahifani ko'rsatadi.
   * `note` — natija haqida qisqa yozuv ("23 ta to'lov · 4 500 000 so'm"),
   * ish jarayoni ro'yxatida qadam ostida chiqadi (o'zbekcha, `t()` siz).
   */
  | { type: "tool"; id: string; label: string; status: AiToolStatus; href?: string; note?: string }
  /**
   * Vazifa rejasi (5-bosqich, Cowork kabi) — model `update_plan` bilan
   * yozadi va yangilaydi; panel uni belgilanadigan ro'yxat qilib ko'rsatadi.
   */
  | { type: "plan"; steps: AiPlanStep[] }
  /** Javob matnining navbatdagi bo'lagi. */
  | { type: "delta"; text: string }
  /** Amal qoralamasi tayyor — panel tasdiq kartasini chizadi (2-bosqich). */
  | { type: "action"; action: AiActionView }
  /**
   * OLDINGI javobdagi kartaning yangi holati — masalan, xodim qoralamani
   * o'zgartirishni so'radi va eskisi yangisi bilan ALMASHTIRILDI (bekor
   * qilindi). Panel kartani qaysi xabarda bo'lsa ham o'z joyida yangilaydi.
   */
  | { type: "action_update"; action: AiActionView }
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
 * topshiriq. 5-bosqich (08.10.2026): yangi o'quvchi (`pupil`), guruhga
 * qo'shish/chiqarish (`membership`), davomat (`attendance`), o'quvchi
 * holati (`status` — Aktiv/Muzlatilgan/Arxiv), lid bosqichi (`stage`).
 */
export type AiActionKind =
  | "lead"
  | "kirim"
  | "chiqim"
  | "transfer"
  | "comment"
  | "task"
  | "pupil"
  | "membership"
  | "attendance"
  | "status"
  | "stage";

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
  | "link"
  // 5-bosqich
  | "phone"
  | "birth_date"
  | "category"
  | "source"
  | "joined_at"
  | "op"
  | "date"
  | "marks"
  | "summary"
  | "status"
  | "reason"
  | "lead"
  | "stage"
  | "trial"
  | "effect"
  // Qizil qator: tasdiqdan oldin albatta ko'rilsin (masalan, oylik ikki marta
  // to'lanishi mumkin — «qayta bermang», 09.10.2026).
  | "warning";

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
  /** Yangi qoralama bilan almashtirilgan (status `cancelled`) — yangisining id'si. */
  replacedBy?: string;
}

/** Sozlamalardagi modellar ro'yxatining qatori (GET /api/ai/settings → `modelRows`). */
export interface AiModelRow {
  id: string;
  name: string;
  hint: string;
  /** OpenAI hisobida bormi; `null` — tekshirib bo'lmadi. */
  available: boolean | null;
  /** Vosita bilan faqat Responses API'da — proksi (Chat Completions) rejimida xodimlarga ko'rinmaydi. */
  responsesOnly: boolean;
  /** Katalogda yo'q (admin qo'lda qo'shgan yoki .env dagi). */
  custom: boolean;
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
  /** Tanlash mumkin bo'lgan modellar (admin ochgan va OpenAI hisobida bor). */
  models: AiModelOption[];
  /** Xodim hali tanlamagan bo'lsa — shu model va daraja. */
  defaultModel: string;
  defaultEffort: AiEffort | null;
}
