import type { Db } from "mongodb";
import type { AdjustDeps } from "@/lib/cashboxAdjust";
import { isValidPhone, normalizePhone } from "@/lib/invite";
import { uzDateIso } from "@/lib/uzTime";
import type { HrEmployee } from "@/lib/hrEmployees";
import { loadAttendanceSettings, parseScanned, type AttendanceKind } from "@/lib/attendanceQr";
import { markAttendance } from "@/lib/attendanceCheck";
import { notifyLate } from "@/lib/attendanceNotify";
import { answerStaff, deleteUserMessage, dropReplyKeyboard, sendToStaff } from "@/lib/staffBot/api";
import { clearPasswordAttempts, takePasswordAttempt } from "@/lib/staffBot/attempts";
import { findEmployeeByPhone, hasWebLogin, listCashboxesForAdmin, resolveAccess, verifyStaffLogin, type StaffAccess } from "@/lib/staffBot/auth";
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
import { chiqimCallback, chiqimText, startChiqim } from "@/lib/staffBot/chiqim";
import type { FlowCtx } from "@/lib/staffBot/flow";
import { kirimCallback, kirimText, startKirim } from "@/lib/staffBot/kirim";
import { leadCallback, leadText, startLead } from "@/lib/staffBot/lead";
import { startTransfer, transferCallback, transferText } from "@/lib/staffBot/transfer";
import { showScreen, type Screen } from "@/lib/staffBot/screen";
import {
  completeContactLogin,
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
  /** `/start <parametr>` — havola orqali kelgan (QR: "k_…" / "x_…", lib/attendanceQr.ts). */
  startWith: /^\/start(?:@\w+)?\s+(\S+)$/i,
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

async function menuScreen(db: Db, access: StaffAccess): Promise<Screen> {
  // «🏁 Ishdan ketdim» tugmasi faqat admin yoqqanda (QR ekranidagi sozlama).
  const { checkoutEnabled } = await loadAttendanceSettings(db);
  if (access.profileOnly) {
    return {
      html: V.profileMenuView(access.identity.name, access.webLogin),
      keyboard: mainMenu({ profileOnly: true, webLogin: access.webLogin, checkoutEnabled }),
    };
  }
  return {
    html: V.menuView(access.identity.name, access.cashbox, access.identity.isAdmin),
    keyboard: mainMenu({ profileOnly: false, webLogin: true, checkoutEnabled }),
  };
}

async function kassamScreen(db: Db, access: StaffAccess): Promise<Screen> {
  if (!access.canCash) return { html: V.noPermission(), keyboard: backToMenu() };
  if (!access.cashbox) return { html: V.noCashbox(), keyboard: backToMenu() };
  const view = await loadKassam(db, access.cashbox);
  return { html: V.kassamView(view, uzDateIso()), keyboard: kassamKeyboard(access.identity.isAdmin, view.stats.pendingInCount) };
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

/**
 * O'Z raqami ulashildi (Telegram egasini tasdiqlagan) — faol xodim topilsa
 * PAROLSIZ kiradi, faqat profil (28.09.2026, foydalanuvchi: "ikkala usul
 * ham bo'lsin"). Xodimlar ro'yxatida yo'q, lekin sayt hisobi bor raqam —
 * odatdagi parol oqimiga o'tadi.
 */
async function acceptContact(db: Db, cfg: StaffBotConfig, chatId: number, rawPhone: string): Promise<void> {
  if (!isValidPhone(rawPhone)) {
    await sendToStaff(cfg, chatId, V.loginFailed("Raqam noto'g'ri — 90 123 45 67 ko'rinishida yozing"), contactKeyboard());
    return;
  }
  const phone = normalizePhone(rawPhone);
  const emp = await findEmployeeByPhone(db, phone);
  if (!emp) {
    if (await hasWebLogin(db, phone)) {
      await acceptPhone(db, cfg, chatId, phone);
      return;
    }
    await sendToStaff(cfg, chatId, V.contactNotFound(), contactKeyboard());
    return;
  }
  await completeContactLogin(db, chatId, { employeeId: emp.id, name: emp.name, phone });
  await dropReplyKeyboard(cfg, chatId);
  const fresh = await getStaffUser(db, chatId);
  if (fresh) await openMenu(db, cfg, chatId, fresh);
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
  await showScreen(db, cfg, chatId, undefined, await menuScreen(db, access.access));
}

// ── Ishga keldim (QR havolasi) ──────────────────────────────────────

/**
 * Telefon kamerasi QR'dagi `t.me/<bot>?start=k_…` havolasini ochdi — Telegram
 * `/start k_…` yubordi. Xodim — bot sessiyasidan (chatId), filial — imzolangan
 * tokendan; yozuvning o'zi Mini App bilan bitta yo'ldan (lib/attendanceCheck.ts).
 */
async function attendanceByLink(
  db: Db,
  cfg: StaffBotConfig,
  chatId: number,
  user: StaffBotUser | null,
  from: TgUser | undefined,
  scanned: { kind: AttendanceKind; token: string },
  defer: AdjustDeps["defer"],
): Promise<void> {
  if (!user || user.stage !== "in") {
    await sendToStaff(cfg, chatId, V.checkinNeedsLogin());
    await askPhone(db, cfg, chatId, from);
    return;
  }
  await touchStaffUser(db, chatId);
  const res = await resolveAccess(db, user);
  if (!res.ok) {
    await logoutStaff(db, chatId);
    await sendToStaff(cfg, chatId, V.sessionInvalid(res.error));
    return;
  }
  const empId = res.access.identity.employeeId;
  const emp = empId === null
    ? null
    : await db.collection<HrEmployee>("hr_employees").findOne({ id: empId }, { projection: { _id: 0 } });
  if (!emp) {
    await sendToStaff(cfg, chatId, V.checkinNoEmployee(), backToMenu());
    return;
  }
  const out = await markAttendance(db, emp, scanned.kind, scanned.token);
  if (!out.ok) {
    await sendToStaff(cfg, chatId, V.checkinFailed(out.error), backToMenu());
    return;
  }
  const r = out.record;
  if (out.fresh && out.kind === "in" && r.lateMinutes > 0) {
    const { branch } = out;
    const turi = emp.turi;
    defer(() => notifyLate(r, branch, turi));
  }
  await sendToStaff(
    cfg,
    chatId,
    V.checkinResult({
      kind: out.kind,
      fresh: out.fresh,
      branchName: out.branch.name,
      enterTime: r.enterTime,
      exitTime: r.exitTime,
      lateMinutes: r.lateMinutes,
      expected: r.expected,
      expectedWhy: r.expectedWhy,
    }),
    backToMenu(),
  );
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

  // `/start k_…` — QR havolasi (telefon kamerasi bilan skanerlangan).
  // Boshqa parametr — oddiy /start kabi.
  const startArg = COMMANDS.startWith.exec(text);
  if (startArg) {
    const scanned = parseScanned(startArg[1]);
    if (scanned) {
      await attendanceByLink(db, cfg, chatId, user, msg.from, scanned, defer);
      return;
    }
  }

  // /start — har qanday holatda: kirgan bo'lsa menyu, aks holda kirish.
  if (COMMANDS.start.test(text) || startArg) {
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
      await acceptContact(db, cfg, chatId, String(msg.contact.phone_number ?? ""));
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
    // Raqamni almashtirish — o'z kontakti (parolsiz profil) yoki raqamga o'xshash matn.
    if (msg.contact && msg.contact.user_id === msg.from.id) {
      await acceptContact(db, cfg, chatId, String(msg.contact.phone_number ?? ""));
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

  // Qoralama matn kutayotgan bo'lsa — unga (har oqim o'z qoralamasini taniydi).
  if (text && !text.startsWith("/")) {
    if (await kirimText(ctx, text)) return;
    if (await chiqimText(ctx, text)) return;
    if (await transferText(ctx, text)) return;
    if (await leadText(ctx, text)) return;
  }

  // Har qanday boshqa matn — bosh menyu. Bot suhbatdosh emas: erkin
  // matnga javob bermaydi, aniq tugmalarni taklif qiladi.
  await showScreen(db, cfg, chatId, undefined, await menuScreen(db, access));
}

async function openMenu(db: Db, cfg: StaffBotConfig, chatId: number, user: StaffBotUser): Promise<void> {
  const res = await resolveAccess(db, user);
  if (!res.ok) {
    await logoutStaff(db, chatId);
    await sendToStaff(cfg, chatId, V.sessionInvalid(res.error));
    return;
  }
  await showScreen(db, cfg, chatId, undefined, await menuScreen(db, res.access));
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

  // Oqim tugmalari — har oqim o'z prefiksini o'zi taniydi.
  if (data.startsWith("s:k:")) {
    const r = await kirimCallback(ctx, data);
    await answerStaff(cfg, cq.id, r.toast ?? "");
    return;
  }
  if (data.startsWith("s:c:")) {
    const r = await chiqimCallback(ctx, data);
    await answerStaff(cfg, cq.id, r.toast ?? "");
    return;
  }
  if (data.startsWith("s:t:")) {
    const r = await transferCallback(ctx, data);
    await answerStaff(cfg, cq.id, r.toast ?? "");
    return;
  }
  if (data.startsWith("s:l:")) {
    const r = await leadCallback(ctx, data);
    await answerStaff(cfg, cq.id, r.toast ?? "");
    return;
  }

  switch (data) {
    case CB.menu:
      await show(await menuScreen(db, access));
      break;
    case CB.kirim:
      await startKirim(ctx);
      break;
    case CB.chiqim:
      await startChiqim(ctx);
      break;
    case CB.transfer:
      await startTransfer(ctx);
      break;
    case CB.lead:
      await startLead(ctx);
      break;
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
    case CB.passwordLogin:
      // Profil rejimidan to'liq kirish: shu raqam uchun parol so'raladi.
      if (!access.profileOnly) {
        await show(await menuScreen(db, access));
        break;
      }
      await setPendingPhone(db, chatId, access.identity.phone);
      await show({ html: V.passwordPrompt(access.identity.phone) });
      break;
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
