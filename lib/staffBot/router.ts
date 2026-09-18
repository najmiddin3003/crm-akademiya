import type { Db } from "mongodb";
import type { AdjustDeps } from "@/lib/cashboxAdjust";
import { isValidPhone, normalizePhone } from "@/lib/invite";
import { uzDateIso } from "@/lib/uzTime";
import { answerStaff, deleteUserMessage, dropReplyKeyboard, sendToStaff } from "@/lib/staffBot/api";
import { clearPasswordAttempts, takePasswordAttempt } from "@/lib/staffBot/attempts";
import { listCashboxesForAdmin, resolveAccess, verifyStaffLogin, type StaffAccess } from "@/lib/staffBot/auth";
import type { StaffBotConfig } from "@/lib/staffBot/config";
import { loadKassam, loadTodayEntries } from "@/lib/staffBot/data";
import {
  CB,
  backToMenu,
  cashboxArg,
  cashboxPicker,
  contactKeyboard,
  isStaffCallback,
  kassamKeyboard,
  logoutConfirm,
  mainMenu,
  todayKeyboard,
} from "@/lib/staffBot/keyboards";
import { kirimCallback, kirimText, startKirim, type FlowCtx } from "@/lib/staffBot/kirim";
import { showScreen, type Screen } from "@/lib/staffBot/screen";
import {
  completeLogin,
  getStaffUser,
  logoutStaff,
  setAdminCashbox,
  setPendingPhone,
  startLogin,
  touchStaffUser,
  type StaffBotUser,
} from "@/lib/staffBot/session";
import * as V from "@/lib/staffBot/views";

// Xodimlar boti — SHAXSIY yozishmadagi yangilanishni ishlaydigan yagona joy.
//
// Webhook (app/api/telegram/webhook) lid tugmalarini (`lead:…`) o'zi
// ishlaydi, qolgan hammasini — shaxsiy xabar va `s:` tugmalar — shu yerga
// beradi. GURUH XABARLARI BU YERDA TASHLANADI: bot guruhlarda admin va
// `allowed_updates` ga `message` qo'shilgach u yerdagi har bir xabar ham
// keladi; ularga javob berilmaydi va ular o'qilmaydi ham.
//
// XAVFSIZLIK CHEGARASI. Kim ekani `chatId` bo'yicha `staff_bot_users`
// dan o'qiladi (Telegram beradi, klient to'qib bo'lmaydi); ruxsat va
// kassa esa HAR yangilanishda CRM bazasidan qayta yechiladi
// (lib/staffBot/auth.ts). Tugma ichidagi id'larga ishonilmaydi.

interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat?: { id: number; type?: string };
  text?: string;
  contact?: { phone_number?: string; user_id?: number };
}

interface TgCallbackQuery {
  id: string;
  data?: string;
  from?: TgUser;
  message?: { message_id: number; chat?: { id: number; type?: string } };
}

export interface TelegramUpdate {
  message?: TgMessage;
  edited_message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

function displayName(u: TgUser | undefined): string {
  const full = [u?.first_name, u?.last_name].filter(Boolean).join(" ").trim();
  return full || (u?.username ? `@${u.username}` : "");
}

/** Salomlashuvdagi ism — juda uzun bo'lsa (reklama satri) username (o'quvchilar botidagi qoida). */
function greetName(u: TgUser | undefined): string {
  const full = [u?.first_name, u?.last_name].filter(Boolean).join(" ").trim();
  if (full && [...full].length <= 35) return full;
  return u?.username ? `@${u.username}` : "";
}

const COMMANDS = {
  start: /^\/start(@\w+)?$/i,
  kassa: /^\/kassa(@\w+)?$/i,
  logout: /^\/(chiqish|logout)(@\w+)?$/i,
} as const;

/**
 * Yangilanishni ishlaydi. HECH QACHON OTMAYDI — webhook Telegram'ga
 * doim 200 qaytarishi kerak, aks holda u yangilanishni qayta-qayta
 * yuboraveradi.
 */
export async function handleStaffUpdate(
  db: Db,
  cfg: StaffBotConfig,
  update: TelegramUpdate,
  defer: AdjustDeps["defer"],
): Promise<void> {
  try {
    if (update.callback_query) {
      await handleCallback(db, cfg, update.callback_query, defer);
    } else if (update.message) {
      await handleMessage(db, cfg, update.message, defer);
    }
    // `edited_message` va boshqalar e'tiborsiz.
  } catch (e) {
    console.error("[staff-bot]", e instanceof Error ? e.stack || e.message : e);
  }
}

// ── Ekranlar ────────────────────────────────────────────────────────

function menuScreen(access: StaffAccess): Screen {
  return {
    html: V.menuView(access.identity.name, access.cashbox, access.identity.isAdmin),
    keyboard: mainMenu(),
  };
}

async function kassamScreen(db: Db, access: StaffAccess): Promise<Screen> {
  if (!access.canCash) return { html: V.noPermission(), keyboard: backToMenu() };
  if (!access.cashbox) return { html: V.noCashbox(), keyboard: backToMenu() };
  const view = await loadKassam(db, access.cashbox);
  return { html: V.kassamView(view, uzDateIso()), keyboard: kassamKeyboard(access.identity.isAdmin) };
}

async function todayScreen(db: Db, access: StaffAccess): Promise<Screen> {
  if (!access.canCash) return { html: V.noPermission(), keyboard: backToMenu() };
  if (!access.cashbox) return { html: V.noCashbox(), keyboard: backToMenu() };
  const today = uzDateIso();
  const entries = await loadTodayEntries(db, access.cashbox.id, today);
  return { html: V.todayView(access.cashbox.name, entries, today), keyboard: todayKeyboard() };
}

// ── Kirish ──────────────────────────────────────────────────────────

async function askPhone(db: Db, cfg: StaffBotConfig, chatId: number, from: TgUser | undefined): Promise<void> {
  await startLogin(db, chatId, { name: displayName(from), username: from?.username ?? "" });
  await sendToStaff(cfg, chatId, V.loginPrompt(greetName(from)), contactKeyboard());
}

/** Raqam qabul qilindi (tugma yoki qo'lda) — parol so'raladi. */
async function acceptPhone(db: Db, cfg: StaffBotConfig, chatId: number, rawPhone: string): Promise<void> {
  if (!isValidPhone(rawPhone)) {
    await sendToStaff(cfg, chatId, V.loginFailed("Raqam noto'g'ri — 90 123 45 67 ko'rinishida yozing"), contactKeyboard());
    return;
  }
  const phone = normalizePhone(rawPhone);
  await setPendingPhone(db, chatId, phone);
  // Telefon tugmasi kirish maydonining ustidan olib tashlanadi — endi
  // parol yoziladi va tugma chalg'itadi.
  await dropReplyKeyboard(cfg, chatId);
  await sendToStaff(cfg, chatId, V.passwordPrompt(phone));
}

async function acceptPassword(
  db: Db,
  cfg: StaffBotConfig,
  msg: TgMessage,
  user: StaffBotUser,
  password: string,
): Promise<void> {
  const chatId = msg.chat!.id;

  // PAROL XABARI DARHOL O'CHIRILADI — tekshiruvdan ham oldin: bcrypt
  // sekin, bu orada xabar ekranda turmasin. (lib/staffBot/api.ts)
  const deleted = await deleteUserMessage(cfg, chatId, msg.message_id);
  const warn = deleted ? "" : `${V.passwordNotDeleted()}\n\n`;

  // Qorovul TEKSHIRUVDAN OLDIN (lib/staffBot/attempts.ts).
  const gate = await takePasswordAttempt(db, chatId);
  if (!gate.allowed) {
    await sendToStaff(cfg, chatId, warn + V.tooManyTries(gate.waitMinutes));
    return;
  }

  const res = await verifyStaffLogin(db, user.pendingPhone ?? "", password);
  if (!res.ok) {
    await sendToStaff(cfg, chatId, warn + V.loginFailed(res.error));
    return;
  }

  await completeLogin(db, chatId, res.identity);
  await clearPasswordAttempts(db, chatId);

  const fresh = await getStaffUser(db, chatId);
  const access = fresh ? await resolveAccess(db, fresh) : null;
  if (!access || !access.ok) {
    await logoutStaff(db, chatId);
    await sendToStaff(cfg, chatId, V.sessionInvalid(access && !access.ok ? access.error : "Hisob topilmadi"));
    return;
  }
  if (warn) await sendToStaff(cfg, chatId, warn.trim());
  await showScreen(db, cfg, chatId, undefined, menuScreen(access.access));
}

// ── Xabarlar ────────────────────────────────────────────────────────

async function handleMessage(db: Db, cfg: StaffBotConfig, msg: TgMessage, defer: AdjustDeps["defer"]): Promise<void> {
  const chatId = msg.chat?.id;
  if (chatId === undefined || !msg.from) return;
  // GURUHLARDA JIM (yuqoridagi izoh).
  if (msg.chat?.type && msg.chat.type !== "private") return;
  // Boshqa bot yozgan xabar ham e'tiborsiz.
  if ((msg.from as TgUser & { is_bot?: boolean }).is_bot) return;

  const text = (msg.text || "").trim();
  const user = await getStaffUser(db, chatId);

  // /start — har qanday holatda: kirgan bo'lsa menyu, aks holda kirish.
  if (COMMANDS.start.test(text)) {
    if (user?.stage === "in") {
      await openMenu(db, cfg, chatId, user);
      return;
    }
    await askPhone(db, cfg, chatId, msg.from);
    return;
  }

  // ── Kirmagan: telefon kutilyapti ──
  if (!user || user.stage === "phone") {
    if (msg.contact) {
      // BOSHQA ODAMNING KONTAKTI RAD ETILADI: `request_contact` har doim
      // o'z raqamini yuboradi, lekin qo'lda istalgan kontakt kartochkasini
      // jo'natish ham mumkin — unda `user_id` boshqa bo'ladi.
      if (msg.contact.user_id !== msg.from.id) {
        await sendToStaff(cfg, chatId, V.foreignContact(), contactKeyboard());
        return;
      }
      if (!user) await startLogin(db, chatId, { name: displayName(msg.from), username: msg.from.username ?? "" });
      await acceptPhone(db, cfg, chatId, String(msg.contact.phone_number ?? ""));
      return;
    }
    if (text && isValidPhone(text)) {
      if (!user) await startLogin(db, chatId, { name: displayName(msg.from), username: msg.from.username ?? "" });
      await acceptPhone(db, cfg, chatId, text);
      return;
    }
    await askPhone(db, cfg, chatId, msg.from);
    return;
  }

  // ── Parol kutilyapti ──
  if (user.stage === "password") {
    // Raqamni almashtirish — kontakt yoki raqamga o'xshash matn.
    if (msg.contact && msg.contact.user_id === msg.from.id) {
      await acceptPhone(db, cfg, chatId, String(msg.contact.phone_number ?? ""));
      return;
    }
    if (text && isValidPhone(text)) {
      await acceptPhone(db, cfg, chatId, text);
      return;
    }
    if (!text || text.startsWith("/")) {
      await sendToStaff(cfg, chatId, V.passwordPrompt(user.pendingPhone ?? ""));
      return;
    }
    await acceptPassword(db, cfg, msg, user, text);
    return;
  }

  // ── Kirgan ──
  await touchStaffUser(db, chatId);
  const res = await resolveAccess(db, user);
  if (!res.ok) {
    await logoutStaff(db, chatId);
    await sendToStaff(cfg, chatId, V.sessionInvalid(res.error));
    return;
  }
  const access = res.access;
  const ctx: FlowCtx = { db, cfg, chatId, user, access, defer };

  if (COMMANDS.logout.test(text)) {
    await showScreen(db, cfg, chatId, undefined, { html: V.logoutView(), keyboard: logoutConfirm() });
    return;
  }
  if (COMMANDS.kassa.test(text)) {
    await showScreen(db, cfg, chatId, undefined, await kassamScreen(db, access));
    return;
  }

  // Qoralama matn kutayotgan bo'lsa — unga.
  if (text && !text.startsWith("/") && (await kirimText(ctx, text))) return;

  // Har qanday boshqa matn — bosh menyu. Bot suhbatdosh emas: erkin
  // matnga javob bermaydi, aniq tugmalarni taklif qiladi.
  await showScreen(db, cfg, chatId, undefined, menuScreen(access));
}

async function openMenu(db: Db, cfg: StaffBotConfig, chatId: number, user: StaffBotUser): Promise<void> {
  const res = await resolveAccess(db, user);
  if (!res.ok) {
    await logoutStaff(db, chatId);
    await sendToStaff(cfg, chatId, V.sessionInvalid(res.error));
    return;
  }
  await showScreen(db, cfg, chatId, undefined, menuScreen(res.access));
}

// ── Tugmalar ────────────────────────────────────────────────────────

async function handleCallback(db: Db, cfg: StaffBotConfig, cq: TgCallbackQuery, defer: AdjustDeps["defer"]): Promise<void> {
  const data = cq.data ?? "";
  if (!isStaffCallback(data)) {
    await answerStaff(cfg, cq.id, "Tugma tanilmadi");
    return;
  }
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  if (chatId === undefined || messageId === undefined) {
    await answerStaff(cfg, cq.id);
    return;
  }
  if (cq.message?.chat?.type && cq.message.chat.type !== "private") {
    await answerStaff(cfg, cq.id);
    return;
  }

  const user = await getStaffUser(db, chatId);
  if (!user || user.stage !== "in") {
    await answerStaff(cfg, cq.id, "Avval tizimga kiring");
    await askPhone(db, cfg, chatId, cq.from);
    return;
  }
  await touchStaffUser(db, chatId);

  const res = await resolveAccess(db, user);
  if (!res.ok) {
    await answerStaff(cfg, cq.id);
    await logoutStaff(db, chatId);
    await showScreen(db, cfg, chatId, messageId, { html: V.sessionInvalid(res.error) });
    return;
  }
  const access = res.access;
  const ctx: FlowCtx = { db, cfg, chatId, user, access, messageId, defer };
  const show = (screen: Screen) => showScreen(db, cfg, chatId, messageId, screen);

  // Kirim oqimi — o'z tugmalarini o'zi taniydi.
  if (data.startsWith("s:k:")) {
    const r = await kirimCallback(ctx, data);
    await answerStaff(cfg, cq.id, r.toast ?? "");
    return;
  }

  switch (data) {
    case CB.menu:
      await show(menuScreen(access));
      break;
    case CB.kirim:
      await startKirim(ctx);
      break;
    case CB.chiqim:
    case CB.transfer:
    case CB.lead:
      // Keyingi bosqichlar — tugma joyida, ish hali yo'q.
      await answerStaff(cfg, cq.id, V.COMING_SOON);
      return;
    case CB.kassam:
      await show(await kassamScreen(db, access));
      break;
    case CB.today:
      await show(await todayScreen(db, access));
      break;
    case CB.cashboxes: {
      if (!access.identity.isAdmin) {
        await answerStaff(cfg, cq.id, "Faqat admin uchun");
        return;
      }
      const list = await listCashboxesForAdmin(db);
      await show({ html: V.cashboxPickerView(), keyboard: cashboxPicker(list, access.cashbox?.id ?? null) });
      break;
    }
    case CB.logout:
      await show({ html: V.logoutView(), keyboard: logoutConfirm() });
      break;
    case CB.logoutYes:
      await logoutStaff(db, chatId);
      await show({ html: V.loggedOut() });
      break;
    default: {
      const cbx = cashboxArg(data);
      if (cbx !== null) {
        if (!access.identity.isAdmin) {
          await answerStaff(cfg, cq.id, "Faqat admin uchun");
          return;
        }
        await setAdminCashbox(db, chatId, cbx);
        // Kassa o'zgardi — ruxsat va kassa qayta yechiladi.
        const again = await resolveAccess(db, { ...user, cashboxId: cbx });
        if (again.ok) await show(await kassamScreen(db, again.access));
        break;
      }
      await answerStaff(cfg, cq.id, "Tugma tanilmadi");
      return;
    }
  }
  await answerStaff(cfg, cq.id);
}
