import type { InlineButton, InlineKeyboard, ReplyKeyboard } from "@/lib/telegramApi";
import { plainEmoji } from "@/lib/studentBot/premiumEmoji";
import type { NotifyKind, StudentBotUser } from "@/lib/studentBot/users";

// Tugmalar va ular ortidagi KALITLAR.
//
// `callback_data` 64 BAYTdan oshmasligi kerak (Telegram cheklovi), shu
// bois kalitlar qisqa: "att", "pay", "sch". Ma'no shu faylda
// hujjatlashtirilgan — matnni tugma yozuvidan taxmin qilish shart emas.
//
// KALIT — RUXSAT EMAS. Bosgan odam `callback_data` ni o'zi to'qib
// yubora oladi (Telegram klienti ochiq protokol), shu bois bu yerda
// o'quvchi ID'si UZATILMAYDI: bot har safar `student_bot_users` dagi
// bog'lanishdan o'qiydi. Yagona istisno — "kid:<id>" (farzand
// almashtirish), va u `setActivePupil` da ro'yxatga tekshiriladi.

export const CB = {
  home: "home",
  attendance: "att",
  payments: "pay",
  schedule: "sch",
  grades: "grd",
  exams: "exm",
  tasks: "tsk",
  coins: "coin",
  news: "news",
  ask: "ask",
  askCancel: "ask:x",
  settings: "set",
  kids: "kids",
  logout: "out",
  logoutYes: "out:yes",
} as const;

/** "att:2026-09" -> "2026-09"; oysiz "att" -> null. */
export function monthArg(data: string): string | null {
  const m = data.match(/^att:(\d{4}-\d{2})$/);
  return m ? m[1] : null;
}

/** "kid:1234" -> 1234; mos kelmasa null. */
export function kidArg(data: string): number | null {
  const m = data.match(/^kid:(\d+)$/);
  return m ? Number(m[1]) : null;
}

/** "set:attendance" -> "attendance"; mos kelmasa null. */
export function notifyArg(data: string): NotifyKind | null {
  if (data === "set:attendance") return "attendance";
  if (data === "set:payment") return "payment";
  return null;
}

/**
 * Telefon tugmasining YOZUVI — bitta manba.
 *
 * Xush kelibsiz matni ("pastdagi ... tugmasini bosing") aynan shu
 * yozuvga havola qiladi; ikki joyda alohida yozilsa, biri o'zgarganda
 * bot mavjud bo'lmagan tugmani ko'rsatishga chaqirardi.
 *
 * ODDIY EMOJI, premium emas: oddiy klaviatura tugmalarida Telegram
 * maxsus emojini QO'LLAB-QUVVATLAMAYDI — u yerda HTML umuman ishlamaydi.
 */
export const CONTACT_BUTTON = `${plainEmoji("phone")} Telefon raqamimni yuborish`;

/**
 * Telefon so'raydigan ODDIY klaviatura — bog'lanmagan odamga ko'rsatiladi.
 *
 * `request_contact` ATAYLAB: matn maydoniga raqam yozdirilsa, odam
 * boshqa o'quvchining raqamini kiritib uning balansi va davomatini
 * ko'rib olardi. Telegram yuboradigan kontakt esa hisobga bog'langan,
 * SMS bilan tasdiqlangan raqam.
 */
export function contactKeyboard(): ReplyKeyboard {
  return {
    keyboard: [[{ text: CONTACT_BUTTON, request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
    input_field_placeholder: "Pastdagi tugmani bosing",
  };
}

/** Asosiy menyu. `hasSupport` va `multiKid` bo'yicha qatorlar qo'shiladi. */
export function mainMenu(opts: { hasSupport: boolean; multiKid: boolean }): InlineKeyboard {
  const rows: InlineButton[][] = [
    [
      { text: "📋 Davomat", callback_data: CB.attendance },
      { text: "💳 To'lovlar", callback_data: CB.payments },
    ],
    [
      { text: "🗓 Dars jadvali", callback_data: CB.schedule },
      { text: "⭐ Baholar", callback_data: CB.grades },
    ],
    [
      { text: "🏆 Imtihonlar", callback_data: CB.exams },
      { text: "📚 Vazifalar", callback_data: CB.tasks },
    ],
    [
      { text: "🪙 Koinlar", callback_data: CB.coins },
      { text: "📰 Yangiliklar", callback_data: CB.news },
    ],
  ];

  const last: InlineButton[] = [];
  if (opts.hasSupport) last.push({ text: "✍️ Ustozga savol", callback_data: CB.ask });
  last.push({ text: "⚙️ Sozlamalar", callback_data: CB.settings });
  rows.push(last);

  if (opts.multiKid) {
    rows.push([{ text: "👨‍👩‍👧 Farzandni almashtirish", callback_data: CB.kids }]);
  }
  return { inline_keyboard: rows };
}

/** Ichki bo'limlarning pastidagi qaytish tugmasi. */
export function backOnly(): InlineKeyboard {
  return { inline_keyboard: [[{ text: "⬅️ Asosiy menyu", callback_data: CB.home }]] };
}

/**
 * Davomat oynasining oy o'qi.
 *
 * Tugmalar FAQAT belgisi bor oylar uchun chiqadi (`months` — bazadan).
 * Bo'sh oyga o'tkazadigan tugma "ma'lumot yo'q" ekranini ochardi va
 * odam buni xato deb o'ylardi.
 */
export function attendanceNav(months: string[], current: string, monthLabel: (m: string) => string): InlineKeyboard {
  const i = months.indexOf(current);
  const row: InlineButton[] = [];
  if (i > 0) row.push({ text: `⬅️ ${monthLabel(months[i - 1])}`, callback_data: `att:${months[i - 1]}` });
  if (i >= 0 && i < months.length - 1) {
    row.push({ text: `${monthLabel(months[i + 1])} ➡️`, callback_data: `att:${months[i + 1]}` });
  }
  const rows = row.length > 0 ? [row] : [];
  rows.push([{ text: "⬅️ Asosiy menyu", callback_data: CB.home }]);
  return { inline_keyboard: rows };
}

/** Sozlamalar — har bir xabar turi yonida joriy holati ko'rinadi. */
export function settingsMenu(user: StudentBotUser): InlineKeyboard {
  const on = (k: NotifyKind) => (user.notify?.[k] ?? true) ? "🔔" : "🔕";
  return {
    inline_keyboard: [
      [{ text: `${on("attendance")} Davomat xabarlari`, callback_data: "set:attendance" }],
      [{ text: `${on("payment")} To'lov xabarlari`, callback_data: "set:payment" }],
      [{ text: "🚪 Chiqish (bog'lanishni uzish)", callback_data: CB.logout }],
      [{ text: "⬅️ Asosiy menyu", callback_data: CB.home }],
    ],
  };
}

export function logoutConfirm(): InlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "Ha, chiqaman", callback_data: CB.logoutYes }],
      [{ text: "⬅️ Bekor qilish", callback_data: CB.settings }],
    ],
  };
}

/** Farzand tanlash — ota-onaga bir nechta bola bog'langanda. */
export function kidsMenu(links: { pupilId: number }[], names: Map<number, string>, activeId: number): InlineKeyboard {
  const rows = links.map((l) => [
    {
      text: `${l.pupilId === activeId ? "✅ " : ""}${names.get(l.pupilId) ?? `O'quvchi #${l.pupilId}`}`,
      callback_data: `kid:${l.pupilId}`,
    },
  ]);
  rows.push([{ text: "⬅️ Asosiy menyu", callback_data: CB.home }]);
  return { inline_keyboard: rows };
}

/** "Ustozga savol" yozilayotganda — bekor qilish imkoni. */
export function askCancel(): InlineKeyboard {
  return { inline_keyboard: [[{ text: "⬅️ Bekor qilish", callback_data: CB.askCancel }]] };
}
