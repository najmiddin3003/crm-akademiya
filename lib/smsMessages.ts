// Sotuv va marketing → Xabarlar ro'yhati (sidebar: Sotuv va marketing >
// Xabarlar ro'yhati, href /sales-messages). MongoDB `sms_messages` kolleksiyasi.
//
// Yuborilgan SMS jurnali — sof hisobot (qo'shish/tahrirlash yo'q).
export type SmsKind = "manual" | "auto" | "grouped";

/**
 * SMS NEGA yuborilgani. `kind` dan FARQ QILADI: `kind` — QANDAY
 * yuborilgani (qo'lda / avtomatik), `purpose` — NEGA.
 *
 * Nazorat > SMS analitikasi sahifasi shu bo'yicha guruhlaydi.
 */
export type SmsPurpose = "payment" | "invite" | "password-reset" | "manual" | "other";

export const SMS_PURPOSE_LABELS: Record<SmsPurpose, string> = {
  payment: "To'lov qabul qilindi",
  invite: "Xodim taklifi",
  "password-reset": "Parol tiklash",
  manual: "Qo'lda yuborilgan",
  other: "Boshqa",
};

export function smsPurposeLabel(p: unknown): string {
  return SMS_PURPOSE_LABELS[p as SmsPurpose] ?? "Aniqlanmagan";
}

export interface SmsMessage {
  id: number;
  recipientName: string; // To'liq ismi
  text: string; // Xabar
  date: string; // "YYYY-MM-DD" — filtrlash uchun
  time: string; // "HH:mm"
  moderator: string;
  status: string; // "Qabul qilindi" | "Yuborilmadi" | "Kutilmoqda"
  kind: SmsKind;

  // ── Quyidagilar SMS analitikasi uchun qo'shildi ────────────────────
  // Eski yozuvlarda ular YO'Q (maydonlar 2026-09-05 da kiritilgan) —
  // sahifa ularni "Aniqlanmagan" deb ko'rsatadi, yashirmaydi.

  /** NEGA yuborilgan. */
  purpose?: SmsPurpose;
  /** Qaysi kassadan — faqat to'lov SMS ida bo'ladi. */
  cashboxId?: number;
  cashboxName?: string;
  /** Qabul qiluvchining raqami (Eskiz formatida, 998XXXXXXXXX). */
  phone?: string;

  /**
   * Eskizning javobi va undan ajratilgan xabar ID si.
   *
   * NEGA SAQLANADI: `status` faqat "Eskiz so'rovni QABUL QILDI" degani —
   * telefonga yetib borgani EMAS. Haqiqiy yetkazilishni keyinroq
   * Eskizdan so'rash uchun xabar ID si kerak bo'ladi, va u faqat
   * yuborish paytida qo'lda bo'ladi. Hozir saqlanmasa, bugun ketayotgan
   * SMS larning taqdiri hech qachon bilinmaydi.
   */
  providerMessageId?: string | null;
  providerRaw?: unknown;

  /**
   * HAQIQIY yetkazilish holati — Eskizdan alohida so'ralib aniqlanadi.
   *
   * Hozir HAMMA yozuvda "unknown": so'rash yo'li hali qo'shilmagan
   * (Eskizning status endpointi loyihada ishlatilmagan va uni taxmin
   * qilib yozish — jimgina ishlamaydigan kod demak). Sahifada bu ustun
   * ROST nomlanadi, "yetkazildi" deb ko'rsatilmaydi.
   */
  deliveryStatus?: "unknown" | "delivered" | "failed";
}

// Yuqoridagi tablar. "Hammasi" — filtrsiz.
export const SMS_TABS: { key: "all" | SmsKind; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "auto", label: "Avto sms" },
  { key: "grouped", label: "Guruhlangan sms" },
];

export const SMS_STATUSES = ["Qabul qilindi", "Kutilmoqda", "Yuborilmadi"];

export function formatSmsDate(m: SmsMessage): string {
  const [y, mo, d] = m.date.split("-");
  return `${d}.${mo}.${y} | ${m.time}`;
}
