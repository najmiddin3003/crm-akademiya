import type { InlineButton, InlineKeyboard, ReplyKeyboard } from "@/lib/telegramApi";
import type { BotCashbox } from "@/lib/staffBot/auth";

// Tugmalar va ular ortidagi KALITLAR.
//
// Hamma kalit `s:` bilan boshlanadi — lid tugmalari (`lead:…`,
// lib/leadStatus.ts) bilan bitta webhook'ga tushadi va prefiks ularni
// ajratadi. `callback_data` 64 BAYTdan oshmasligi kerak (Telegram
// cheklovi), shu bois kalitlar qisqa.
//
// KALIT — RUXSAT EMAS. Bosgan odam `callback_data` ni o'zi to'qib yubora
// oladi, shu bois tugmadagi id'ga (o'quvchi, kassa, tur) ishonilmaydi:
// router har safar bazadan qayta o'qiydi va kirgan odamning kassasi
// bilan solishtiradi (lib/staffBot/auth.ts).

export const CB = {
  menu: "s:menu",
  kirim: "s:kirim",
  chiqim: "s:chiqim",
  transfer: "s:transfer",
  lead: "s:lead",
  kassam: "s:kassam",
  today: "s:today",
  cashboxes: "s:cbx",
  logout: "s:out",
  logoutYes: "s:out:y",
  /** Kirim qadamlari — argumentli kalitlar quyidagi yordamchilar bilan quriladi. */
  kirimCancel: "s:k:x",
  kirimRestart: "s:k:re",
  kirimNoteAuto: "s:k:n:a",
  kirimNoteSkip: "s:k:n:0",
} as const;

/** `s:` bilan boshlanadigan kalitmi — xodimlar botiga tegishli. */
export function isStaffCallback(data: unknown): data is string {
  return typeof data === "string" && data.startsWith("s:");
}

export const kirimTypeCb = (typeId: number) => `s:k:t:${typeId}`;
export const kirimStudentCb = (pupilId: number) => `s:k:s:${pupilId}`;
export const kirimMethodCb = (key: string) => `s:k:m:${key}`;
export const kirimMonthCb = (month: string) => `s:k:p:${month}`;
export const kirimConfirmCb = (nonce: string) => `s:k:ok:${nonce}`;
export const cashboxCb = (id: number) => `s:cbx:${id}`;

/** "s:k:t:12" -> 12; mos kelmasa null. */
export function kirimTypeArg(data: string): number | null {
  const m = data.match(/^s:k:t:(\d+)$/);
  return m ? Number(m[1]) : null;
}
export function kirimStudentArg(data: string): number | null {
  const m = data.match(/^s:k:s:(\d+)$/);
  return m ? Number(m[1]) : null;
}
export function kirimMethodArg(data: string): string | null {
  const m = data.match(/^s:k:m:([A-Za-z0-9_-]{1,32})$/);
  return m ? m[1] : null;
}
export function kirimMonthArg(data: string): string | null {
  const m = data.match(/^s:k:p:(\d{4}-(?:0[1-9]|1[0-2]))$/);
  return m ? m[1] : null;
}
export function kirimConfirmArg(data: string): string | null {
  const m = data.match(/^s:k:ok:([a-f0-9]{8,32})$/);
  return m ? m[1] : null;
}
export function cashboxArg(data: string): number | null {
  const m = data.match(/^s:cbx:(\d+)$/);
  return m ? Number(m[1]) : null;
}

const btn = (text: string, callback_data: string): InlineButton => ({ text, callback_data });

// ── Kirish ──────────────────────────────────────────────────────────

export const CONTACT_BUTTON = "📱 Telefon raqamimni yuborish";

/**
 * Telefon so'raydigan ODDIY klaviatura.
 *
 * `request_contact` — Telegram raqamni O'ZI qo'shadi (hisobga bog'langan,
 * SMS bilan tasdiqlangan). Qo'lda yozish ham qabul qilinadi — asosiy
 * to'siq baribir PAROL (lib/staffBot/auth.ts).
 */
export function contactKeyboard(): ReplyKeyboard {
  return {
    keyboard: [[{ text: CONTACT_BUTTON, request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
    input_field_placeholder: "yoki raqamni yozing: 90 123 45 67",
  };
}

// ── Bosh menyu ──────────────────────────────────────────────────────

/** 6 tugma — foydalanuvchi bilan kelishilgan tartib (18.09.2026). */
export function mainMenu(): InlineKeyboard {
  return {
    inline_keyboard: [
      [btn("💵 Kirim", CB.kirim), btn("💸 Chiqim", CB.chiqim)],
      [btn("🔁 Ko'chirish", CB.transfer), btn("📋 Lid qo'shish", CB.lead)],
      [btn("📊 Kassam", CB.kassam), btn("🚪 Chiqish", CB.logout)],
    ],
  };
}

export function backToMenu(): InlineKeyboard {
  return { inline_keyboard: [[btn("🏠 Bosh menyu", CB.menu)]] };
}

export function logoutConfirm(): InlineKeyboard {
  return {
    inline_keyboard: [[btn("✅ Ha, chiqaman", CB.logoutYes), btn("↩️ Yo'q", CB.menu)]],
  };
}

// ── Kassam ──────────────────────────────────────────────────────────

export function kassamKeyboard(isAdmin: boolean): InlineKeyboard {
  const rows: InlineButton[][] = [
    [btn("🧾 Bugungi yozuvlar", CB.today), btn("🔄 Yangilash", CB.kassam)],
  ];
  if (isAdmin) rows.push([btn("🏦 Kassani almashtirish", CB.cashboxes)]);
  rows.push([btn("💵 Kirim", CB.kirim), btn("🏠 Bosh menyu", CB.menu)]);
  return { inline_keyboard: rows };
}

export function todayKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [btn("🔄 Yangilash", CB.today), btn("📊 Kassam", CB.kassam)],
      [btn("🏠 Bosh menyu", CB.menu)],
    ],
  };
}

/** Admin uchun kassa ro'yxati — joriysi belgilangan. */
export function cashboxPicker(list: BotCashbox[], currentId: number | null): InlineKeyboard {
  return {
    inline_keyboard: [
      ...list.map((c) => [btn(`${c.id === currentId ? "✅ " : ""}${c.name}`, cashboxCb(c.id))]),
      [btn("↩️ Orqaga", CB.kassam)],
    ],
  };
}

// ── Kirim qadamlari ─────────────────────────────────────────────────

const cancelRow = (): InlineButton[] => [btn("❌ Bekor qilish", CB.kirimCancel)];

export function kirimTypeKeyboard(types: { id: number; name: string }[]): InlineKeyboard {
  return {
    inline_keyboard: [...types.map((t) => [btn(t.name, kirimTypeCb(t.id))]), cancelRow()],
  };
}

/** Matn kutiladigan qadamlar (o'quvchi qidiruvi, summa, izoh) — faqat Bekor. */
export function kirimCancelOnly(): InlineKeyboard {
  return { inline_keyboard: [cancelRow()] };
}

export interface StudentOption {
  id: number;
  label: string;
}

export function kirimStudentKeyboard(options: StudentOption[]): InlineKeyboard {
  return {
    inline_keyboard: [...options.map((o) => [btn(o.label, kirimStudentCb(o.id))]), cancelRow()],
  };
}

/** To'lov turlari — 2 tadan qatorda (8 ta tur 4 qator bo'ladi). */
export function kirimMethodKeyboard(methods: { key: string; name: string }[]): InlineKeyboard {
  const rows: InlineButton[][] = [];
  for (let i = 0; i < methods.length; i += 2) {
    rows.push(methods.slice(i, i + 2).map((m) => btn(m.name, kirimMethodCb(m.key))));
  }
  rows.push(cancelRow());
  return { inline_keyboard: rows };
}

export interface MonthOption {
  month: string;
  label: string;
  current: boolean;
}

export function kirimMonthKeyboard(options: MonthOption[]): InlineKeyboard {
  return {
    inline_keyboard: [
      options.map((o) => btn(o.current ? `• ${o.label} •` : o.label, kirimMonthCb(o.month))),
      cancelRow(),
    ],
  };
}

/** Izoh qadami: tayyor izoh (bo'lsa), izohsiz, bekor. */
export function kirimNoteKeyboard(auto: string | null): InlineKeyboard {
  const rows: InlineButton[][] = [];
  if (auto) rows.push([btn(`✍️ ${auto}`, CB.kirimNoteAuto)]);
  rows.push([btn("⏭ Izohsiz davom etish", CB.kirimNoteSkip)]);
  rows.push(cancelRow());
  return { inline_keyboard: rows };
}

export function kirimConfirmKeyboard(nonce: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [btn("✅ Tasdiqlash", kirimConfirmCb(nonce))],
      [btn("🔄 Qaytadan", CB.kirimRestart), btn("❌ Bekor qilish", CB.kirimCancel)],
    ],
  };
}

export function afterSaveKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [btn("💵 Yana kirim", CB.kirim), btn("📊 Kassam", CB.kassam)],
      [btn("🏠 Bosh menyu", CB.menu)],
    ],
  };
}
