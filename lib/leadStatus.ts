// LID STATUSI — Telegram guruhidagi tugmalar bilan belgilanadi.
//
// Guruhga tushgan har bir lid xabarining tagida to'rtta tugma turadi;
// bosilgani xabarning o'zidagi "Status:" qatorini almashtiradi va bazaga
// yoziladi (`orders.leadStatus`).
//
// NEGA ALOHIDA FAYL: bu ro'yxatni IKKI tomon o'qiydi — xabarni YUBORUVCHI
// (lib/leadNotify.ts) va tugma bosilganda uni TAHRIRLOVCHI
// (app/api/telegram/webhook). Ikkalasida alohida yozilsa, yorliq bir
// joyda o'zgartirilib ikkinchisida eskicha qolib ketardi va xabar
// tugmasidagi matn bilan status qatoridagi matn bir-biriga to'g'ri
// kelmasdi.
//
// DIQQAT: bu buyurtmaning `status` maydoni (STATUSES — "Yangi", "Qabul
// qilindi" …) EMAS va u bilan aralashtirilmaydi. Bu — guruhdagi
// moderatorning TEZKOR belgisi: lid bilan bog'lanildimi va natija nima.
// Ikkalasi bir maydonga sig'maydi: CRM dagi holat ish jarayonini
// boshqaradi, bu esa aloqa natijasini qayd etadi.

import { guruhOf, holatOf, sinovOf, type HolatSource, type LeadGuruh } from "./leadHolat";

export type LeadStatusKey = "first" | "later" | "pay" | "reject";

export interface LeadStatusOption {
  key: LeadStatusKey;
  emoji: string;
  label: string;
}

/** Tugmalar tartibi — guruhda ham shu tartibda chiqadi. */
export const LEAD_STATUSES: readonly LeadStatusOption[] = [
  { key: "first", emoji: "🟢", label: "Birinchi darsga yozildi" },
  { key: "later", emoji: "🕒", label: "Keyinroq keladi" },
  { key: "pay", emoji: "💳", label: "O'qish niyatida / to'lov qilmoqchi" },
  { key: "reject", emoji: "❌", label: "Rad etdi" },
];

/** Hali hech kim tugma bosmagan lid. */
const NOT_CONTACTED = "⚪ Hali bog'lanilmadi";

export function leadStatusOption(key: unknown): LeadStatusOption | null {
  return LEAD_STATUSES.find((s) => s.key === key) ?? null;
}

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Status qatori o'qiydigan maydonlar (Order'ning bir qismi). */
export type StatusLineSource = HolatSource & {
  radSabab?: string;
  guruh?: LeadGuruh | null;
  teacher?: string;
  group?: string;
};

/**
 * Xabardagi "Status:" qatori — Lidlar sahifasidagi HOLATDAN (lib/leadHolat.ts).
 *
 * 23.09.2026 dan tugma va CRM bitta holatni yuritadi: tugma bosilsa holat
 * o'zgaradi (app/api/telegram/webhook), CRM'da o'zgarsa xabar qayta
 * chiziladi (lib/leadNotify.ts → refreshLeadMessage). "Bog'lanildi" da
 * tugmaning aniq javobi (keyinroq / to'lov niyatida) saqlanib ko'rsatiladi.
 *
 * Status YO'Q bo'lsa qator baribir turadi — "bo'lim yo'q" bilan "hali
 * bog'lanilmagan" bir xil ko'rinmasligi kerak: birinchisida xabar eski
 * (tugmasiz) bo'lardi, ikkinchisida esa ish hali qilinmagan.
 */
export function leadStatusLine(o: StatusLineSource): string {
  const holat = holatOf(o);
  let text = NOT_CONTACTED;
  if (holat === "bog") {
    const s = o.leadStatus === "later" || o.leadStatus === "pay" ? leadStatusOption(o.leadStatus) : null;
    text = s ? `${s.emoji} ${s.label}` : "📞 Bog'lanildi";
  } else if (holat === "sinov") {
    const s = sinovOf(o);
    const when = s ? [s.sana.split("-").reverse().slice(0, 2).join("."), s.vaqt].filter(Boolean).join(" ") : "";
    text = `🟢 Sinov darsiga yozildi${when ? ` — ${escHtml(when)}` : ""}`;
  } else if (holat === "guruh") {
    const g = guruhOf(o);
    text = `✅ Guruhga qo'shildi${g?.nom ? ` — ${escHtml(g.nom)}` : ""}`;
  } else if (holat === "rad") {
    text = `❌ Rad etdi${o.radSabab ? ` — ${escHtml(o.radSabab)}` : ""}`;
  }
  return `<b>Status:</b> ${text}`;
}

/**
 * Tugma ostidagi ma'lumot: `lead:<buyurtma id>:<status kaliti>`.
 *
 * Telegram `callback_data` uchun 64 BAYT chegara qo'yadi — shu bois
 * yorliq emas, qisqa kalit yuboriladi (eng uzuni ~14 bayt).
 */
export function leadCallbackData(orderId: number, key: LeadStatusKey): string {
  return `lead:${orderId}:${key}`;
}

export function parseLeadCallback(data: unknown): { orderId: number; key: LeadStatusKey } | null {
  const parts = String(data ?? "").split(":");
  if (parts.length !== 3 || parts[0] !== "lead") return null;
  const orderId = Number(parts[1]);
  if (!Number.isFinite(orderId)) return null;
  const opt = leadStatusOption(parts[2]);
  return opt ? { orderId, key: opt.key } : null;
}

/** Xabar tagidagi tugmalar. Har biri alohida qatorda — yorliqlar uzun. */
export function leadKeyboard(orderId: number) {
  return {
    inline_keyboard: LEAD_STATUSES.map((s) => [
      { text: `${s.emoji} ${s.label}`, callback_data: leadCallbackData(orderId, s.key) },
    ]),
  };
}
