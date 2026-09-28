import type { InlineButton, InlineKeyboard, ReplyKeyboard } from "@/lib/telegramApi";
import type { BotCashbox } from "@/lib/staffBot/auth";
import { staffProfileUrl } from "@/lib/staffBot/config";

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
  /** Profil rejimidan parol bilan to'liq kirish (kassa amallari uchun). */
  passwordLogin: "s:pw",
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

/** «👤 Profilim» — Mini App (saytdagi profil, faqat o'qish). Hamma xodimda. */
const profileButton = (): InlineButton => ({ text: "👤 Profilim", web_app: { url: staffProfileUrl() } });

/**
 * Bosh menyu. Parol bilan kirgan: «Profilim» + 6 tugma (18.09.2026 tartibi).
 * Raqam ulashib kirgan (28.09.2026): faqat «Profilim», sayt hisobi bo'lsa
 * «Parol bilan kirish» (kassa amallari uchun) va «Chiqish».
 */
export function mainMenu(opts: { profileOnly: boolean; webLogin: boolean }): InlineKeyboard {
  if (opts.profileOnly) {
    const rows: InlineButton[][] = [[profileButton()]];
    if (opts.webLogin) rows.push([btn("🔑 Parol bilan kirish (kassa)", CB.passwordLogin)]);
    rows.push([btn("🚪 Chiqish", CB.logout)]);
    return { inline_keyboard: rows };
  }
  return {
    inline_keyboard: [
      [profileButton()],
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

export function kassamKeyboard(isAdmin: boolean, pendingInCount = 0): InlineKeyboard {
  const rows: InlineButton[][] = [
    [btn("🧾 Bugungi yozuvlar", CB.today), btn("🔄 Yangilash", CB.kassam)],
  ];
  // Kelayotgan ko'chirma bor — tasdiqlash bir bosishda (lib/staffBot/transfer.ts).
  if (pendingInCount > 0) rows.push([btn(`📥 Kelayotganlarni tasdiqlash (${pendingInCount})`, "s:t:inbox")]);
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

export function afterSaveKeyboard(kind: "kirim" | "chiqim" = "kirim"): InlineKeyboard {
  const again = kind === "chiqim" ? btn("💸 Yana chiqim", CB.chiqim) : btn("💵 Yana kirim", CB.kirim);
  return {
    inline_keyboard: [
      [again, btn("📊 Kassam", CB.kassam)],
      [btn("🏠 Bosh menyu", CB.menu)],
    ],
  };
}

// ── Chiqim qadamlari ────────────────────────────────────────────────

export const chiqimTypeCb = (typeId: number) => `s:c:t:${typeId}`;
export const chiqimPageCb = (page: number) => `s:c:pg:${page}`;
export const chiqimEmployeeCb = (id: number) => `s:c:e:${id}`;
export const chiqimStudentCb = (pupilId: number) => `s:c:s:${pupilId}`;
export const chiqimMethodCb = (key: string) => `s:c:m:${key}`;
export const chiqimConfirmCb = (nonce: string) => `s:c:ok:${nonce}`;

export const CHIQIM_CB = {
  cancel: "s:c:x",
  restart: "s:c:re",
  /** Summa = chegara/qoldiqning o'zi ("Hammasi" tugmasi). */
  amountMax: "s:c:a:max",
  noteSkip: "s:c:n:0",
} as const;

const numArg = (data: string, prefix: string): number | null => {
  if (!data.startsWith(prefix)) return null;
  const rest = data.slice(prefix.length);
  return /^\d+$/.test(rest) ? Number(rest) : null;
};
export const chiqimTypeArg = (data: string) => numArg(data, "s:c:t:");
export const chiqimPageArg = (data: string) => numArg(data, "s:c:pg:");
export const chiqimEmployeeArg = (data: string) => numArg(data, "s:c:e:");
export const chiqimStudentArg = (data: string) => numArg(data, "s:c:s:");
export function chiqimMethodArg(data: string): string | null {
  const m = data.match(/^s:c:m:([A-Za-z0-9_-]{1,32})$/);
  return m ? m[1] : null;
}
export function chiqimConfirmArg(data: string): string | null {
  const m = data.match(/^s:c:ok:([a-f0-9]{8,32})$/);
  return m ? m[1] : null;
}

const chiqimCancelRow = (): InlineButton[] => [btn("❌ Bekor qilish", CHIQIM_CB.cancel)];

/** Sahifadagi turlar soni — telefon ekraniga sig'adigan ro'yxat. */
export const TYPE_PAGE_SIZE = 8;

/**
 * Chiqim turlari — HAMMASI, sahifalab (foydalanuvchi qarori, 18.09.2026:
 * web'dagi barcha turlar chiqishi kerak; bazada 24 ta).
 */
export function chiqimTypeKeyboard(types: { id: number; name: string }[], page: number): InlineKeyboard {
  const pages = Math.max(1, Math.ceil(types.length / TYPE_PAGE_SIZE));
  const p = Math.min(Math.max(0, page), pages - 1);
  const slice = types.slice(p * TYPE_PAGE_SIZE, (p + 1) * TYPE_PAGE_SIZE);
  const rows: InlineButton[][] = slice.map((t) => [btn(t.name, chiqimTypeCb(t.id))]);
  if (pages > 1) {
    const nav: InlineButton[] = [];
    if (p > 0) nav.push(btn("◀ Oldingi", chiqimPageCb(p - 1)));
    nav.push(btn(`${p + 1}/${pages}`, chiqimPageCb(p)));
    if (p < pages - 1) nav.push(btn("Keyingi ▶", chiqimPageCb(p + 1)));
    rows.push(nav);
  }
  rows.push(chiqimCancelRow());
  return { inline_keyboard: rows };
}

export function chiqimCancelOnly(): InlineKeyboard {
  return { inline_keyboard: [chiqimCancelRow()] };
}

export interface PersonOption {
  id: number;
  label: string;
}

export function chiqimPersonKeyboard(options: PersonOption[], kind: "employee" | "student"): InlineKeyboard {
  const cb = kind === "employee" ? chiqimEmployeeCb : chiqimStudentCb;
  return { inline_keyboard: [...options.map((o) => [btn(o.label, cb(o.id))]), chiqimCancelRow()] };
}

/** To'lov turlari — faqat kassada mablag'i borlari (web'dagi Chiqim oynasi bilan bir xil). */
export function chiqimMethodKeyboard(methods: { key: string; name: string; balance: number }[]): InlineKeyboard {
  const rows: InlineButton[][] = [];
  for (let i = 0; i < methods.length; i += 2) {
    rows.push(methods.slice(i, i + 2).map((m) => btn(`${m.name} · ${fmtButtonAmount(m.balance)}`, chiqimMethodCb(m.key))));
  }
  rows.push(chiqimCancelRow());
  return { inline_keyboard: rows };
}

/** Tugmadagi summa — "2 400 000" (bo'shliq bilan, lib/studentBot/views.ts → fmtUZS bilan bir xil). */
function fmtButtonAmount(n: number): string {
  const digits = String(Math.round(Math.abs(n)));
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += " ";
    out += digits[i];
  }
  return `${n < 0 ? "-" : ""}${out}`;
}

/** Summa qadami: "Hammasi" (chegara/qoldiq bo'lsa) + bekor. */
export function chiqimAmountKeyboard(max: number | null): InlineKeyboard {
  const rows: InlineButton[][] = [];
  if (max !== null && max > 0) rows.push([btn(`💯 Hammasi: ${fmtButtonAmount(max)}`, CHIQIM_CB.amountMax)]);
  rows.push(chiqimCancelRow());
  return { inline_keyboard: rows };
}

export function chiqimNoteKeyboard(): InlineKeyboard {
  return { inline_keyboard: [[btn("⏭ Izohsiz davom etish", CHIQIM_CB.noteSkip)], chiqimCancelRow()] };
}

export function chiqimConfirmKeyboard(nonce: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [btn("✅ Tasdiqlash", chiqimConfirmCb(nonce))],
      [btn("🔄 Qaytadan", CHIQIM_CB.restart), btn("❌ Bekor qilish", CHIQIM_CB.cancel)],
    ],
  };
}

// ── Ko'chirish ──────────────────────────────────────────────────────

export const TRANSFER_CB = {
  menu: "s:t:menu",
  toCashbox: "s:t:to",
  betweenMethods: "s:t:in",
  inbox: "s:t:inbox",
  amountMax: "s:t:a:max",
  noteSkip: "s:t:n:0",
  cancel: "s:t:x",
  restart: "s:t:re",
} as const;

export const transferDestCb = (cashboxId: number) => `s:t:d:${cashboxId}`;
export const transferMethodCb = (key: string) => `s:t:m:${key}`;
export const transferToMethodCb = (key: string) => `s:t:m2:${key}`;
export const transferConfirmCb = (nonce: string) => `s:t:go:${nonce}`;
/** Kelayotgan ko'chirma — 1-bosish so'rov, 2-bosish qaror (acc/acc2, rej/rej2). */
export const transferAcceptCb = (entryId: number, sure = false) => `s:t:${sure ? "acc2" : "acc"}:${entryId}`;
export const transferRejectCb = (entryId: number, sure = false) => `s:t:${sure ? "rej2" : "rej"}:${entryId}`;

export const transferDestArg = (data: string) => numArg(data, "s:t:d:");
export const transferAcceptArg = (data: string) => numArg(data, "s:t:acc:");
export const transferAcceptSureArg = (data: string) => numArg(data, "s:t:acc2:");
export const transferRejectArg = (data: string) => numArg(data, "s:t:rej:");
export const transferRejectSureArg = (data: string) => numArg(data, "s:t:rej2:");
export function transferMethodArg(data: string): string | null {
  const m = data.match(/^s:t:m:([A-Za-z0-9_-]{1,32})$/);
  return m ? m[1] : null;
}
export function transferToMethodArg(data: string): string | null {
  const m = data.match(/^s:t:m2:([A-Za-z0-9_-]{1,32})$/);
  return m ? m[1] : null;
}
export function transferConfirmArg(data: string): string | null {
  const m = data.match(/^s:t:go:([a-f0-9]{8,32})$/);
  return m ? m[1] : null;
}

const transferCancelRow = (): InlineButton[] => [btn("❌ Bekor qilish", TRANSFER_CB.cancel)];

/** "🔁 Ko'chirish" bo'limi — uch yo'l. */
export function transferMenu(pendingIn: number): InlineKeyboard {
  return {
    inline_keyboard: [
      [btn("📤 Boshqa kassaga", TRANSFER_CB.toCashbox)],
      [btn("🔄 Turlar orasida (Naqd → Plastik)", TRANSFER_CB.betweenMethods)],
      [btn(pendingIn > 0 ? `📥 Kelayotganlar (${pendingIn})` : "📥 Kelayotganlar", TRANSFER_CB.inbox)],
      [btn("🏠 Bosh menyu", CB.menu)],
    ],
  };
}

export function transferDestKeyboard(list: BotCashbox[]): InlineKeyboard {
  return {
    inline_keyboard: [
      ...list.map((c) => [btn(`${c.isPrimary ? "⭐ " : ""}${c.name}`, transferDestCb(c.id))]),
      transferCancelRow(),
    ],
  };
}

/** To'lov turi tugmalari — yonida mavjud summa; `toMethod` — ichki ko'chirishda tushadigan tur. */
export function transferMethodKeyboard(
  methods: { key: string; name: string; available: number }[],
  toMethod = false,
): InlineKeyboard {
  const cb = toMethod ? transferToMethodCb : transferMethodCb;
  const rows: InlineButton[][] = [];
  for (let i = 0; i < methods.length; i += 2) {
    rows.push(methods.slice(i, i + 2).map((m) => btn(toMethod ? m.name : `${m.name} · ${fmtButtonAmount(m.available)}`, cb(m.key))));
  }
  rows.push(transferCancelRow());
  return { inline_keyboard: rows };
}

export function transferAmountKeyboard(max: number): InlineKeyboard {
  const rows: InlineButton[][] = [];
  if (max > 0) rows.push([btn(`💯 Hammasi: ${fmtButtonAmount(max)}`, TRANSFER_CB.amountMax)]);
  rows.push(transferCancelRow());
  return { inline_keyboard: rows };
}

export function transferCancelOnly(): InlineKeyboard {
  return { inline_keyboard: [transferCancelRow()] };
}

export function transferNoteKeyboard(): InlineKeyboard {
  return { inline_keyboard: [[btn("⏭ Izohsiz davom etish", TRANSFER_CB.noteSkip)], transferCancelRow()] };
}

export function transferConfirmKeyboard(nonce: string, mode: "cashbox" | "method"): InlineKeyboard {
  return {
    inline_keyboard: [
      [btn(mode === "cashbox" ? "✅ Jo'natish" : "✅ Ko'chirish", transferConfirmCb(nonce))],
      [btn("🔄 Qaytadan", TRANSFER_CB.restart), btn("❌ Bekor qilish", TRANSFER_CB.cancel)],
    ],
  };
}

export function afterTransferKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [btn("🔁 Ko'chirish", TRANSFER_CB.menu), btn("📊 Kassam", CB.kassam)],
      [btn("🏠 Bosh menyu", CB.menu)],
    ],
  };
}

/** Push xabari va ro'yxatdagi har bir ko'chirma tagida. */
export function transferDecisionKeyboard(inEntryId: number): InlineKeyboard {
  return {
    inline_keyboard: [[btn("✅ Qabul qilish", transferAcceptCb(inEntryId)), btn("❌ Rad etish", transferRejectCb(inEntryId))]],
  };
}

/** Kelayotganlar ro'yxati: har qatorga bitta ✓/✗ juftligi. */
export function transferInboxKeyboard(items: { id: number; label: string }[]): InlineKeyboard {
  return {
    inline_keyboard: [
      ...items.map((it) => [btn(`✅ ${it.label}`, transferAcceptCb(it.id)), btn(`❌ ${it.label}`, transferRejectCb(it.id))]),
      [btn("🔄 Yangilash", TRANSFER_CB.inbox), btn("↩️ Orqaga", TRANSFER_CB.menu)],
    ],
  };
}

/** "Rostdan ham?" — bitta qo'shimcha bosish, pul ko'chadi. */
export function transferSureKeyboard(inEntryId: number, decision: "confirm" | "reject"): InlineKeyboard {
  const yes = decision === "confirm"
    ? btn("✅ Ha, qabul qilaman", transferAcceptCb(inEntryId, true))
    : btn("❌ Ha, rad etaman", transferRejectCb(inEntryId, true));
  return { inline_keyboard: [[yes], [btn("↩️ Yo'q, orqaga", TRANSFER_CB.inbox)]] };
}

export function afterDecisionKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [btn("📥 Kelayotganlar", TRANSFER_CB.inbox), btn("📊 Kassam", CB.kassam)],
      [btn("🏠 Bosh menyu", CB.menu)],
    ],
  };
}

// ── Lid qo'shish ────────────────────────────────────────────────────

export const LEAD_CB = {
  cancel: "s:l:x",
  restart: "s:l:re",
  noteSkip: "s:l:n:0",
} as const;

export const leadStudentCb = (pupilId: number) => `s:l:s:${pupilId}`;
/** Kurs — ro'yxatdagi TARTIB raqami (nom 64 baytga sig'masligi mumkin). */
export const leadCourseCb = (index: number) => `s:l:c:${index}`;
export const leadDaysCb = (preset: string) => `s:l:d:${preset}`;
export const leadConfirmCb = (nonce: string) => `s:l:ok:${nonce}`;

export const leadStudentArg = (data: string) => numArg(data, "s:l:s:");
export const leadCourseArg = (data: string) => numArg(data, "s:l:c:");
export function leadDaysArg(data: string): string | null {
  const m = data.match(/^s:l:d:([a-z]{1,10})$/);
  return m ? m[1] : null;
}
export function leadConfirmArg(data: string): string | null {
  const m = data.match(/^s:l:ok:([a-f0-9]{8,32})$/);
  return m ? m[1] : null;
}

const leadCancelRow = (): InlineButton[] => [btn("❌ Bekor qilish", LEAD_CB.cancel)];

export function leadCancelOnly(): InlineKeyboard {
  return { inline_keyboard: [leadCancelRow()] };
}

export function leadStudentKeyboard(options: PersonOption[]): InlineKeyboard {
  return { inline_keyboard: [...options.map((o) => [btn(o.label, leadStudentCb(o.id))]), leadCancelRow()] };
}

/** Kurslar — 2 tadan qatorda; index bo'yicha (nomlar uzun). */
export function leadCourseKeyboard(names: string[]): InlineKeyboard {
  const rows: InlineButton[][] = [];
  for (let i = 0; i < names.length; i += 2) {
    rows.push(names.slice(i, i + 2).map((n, j) => btn(n, leadCourseCb(i + j))));
  }
  rows.push(leadCancelRow());
  return { inline_keyboard: rows };
}

/** Dars kunlari — web'dagi ikki tayyor jadval + "har kuni" (lib/ordersData.ts → LESSON_DAY_PRESETS). */
export const LEAD_DAY_PRESETS: { key: string; label: string; codes: string[] }[] = [
  { key: "toq", label: "Toq kunlar", codes: ["Du", "Ch", "Ju"] },
  { key: "juft", label: "Juft kunlar", codes: ["Se", "Pa", "Sh"] },
  { key: "har", label: "Har kuni", codes: ["Du", "Se", "Ch", "Pa", "Ju", "Sh"] },
];

export function leadDaysKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      LEAD_DAY_PRESETS.slice(0, 2).map((p) => btn(p.label, leadDaysCb(p.key))),
      [btn(LEAD_DAY_PRESETS[2].label, leadDaysCb(LEAD_DAY_PRESETS[2].key))],
      leadCancelRow(),
    ],
  };
}

export function leadNoteKeyboard(): InlineKeyboard {
  return { inline_keyboard: [[btn("⏭ Izohsiz davom etish", LEAD_CB.noteSkip)], leadCancelRow()] };
}

export function leadConfirmKeyboard(nonce: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [btn("✅ Lidni qo'shish", leadConfirmCb(nonce))],
      [btn("🔄 Qaytadan", LEAD_CB.restart), btn("❌ Bekor qilish", LEAD_CB.cancel)],
    ],
  };
}

export function afterLeadKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [btn("📋 Yana lid", CB.lead), btn("💵 Kirim", CB.kirim)],
      [btn("🏠 Bosh menyu", CB.menu)],
    ],
  };
}
