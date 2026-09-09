import type { Db } from "mongodb";
import { pupilFullName, type Pupil } from "@/lib/pupilsData";
import { loadSyncConfig } from "@/lib/sync/config";
import { sendMessage } from "@/lib/sync/telegram";
import type { InlineKeyboard } from "@/lib/telegramApi";
import {
  answerStudent,
  dropReplyKeyboard,
  editStudentMenu,
  sendToStudent,
} from "@/lib/studentBot/api";
import { isStudentBotReady, isSupportReady, type StudentBotConfig } from "@/lib/studentBot/config";
import {
  attendanceMonths,
  branchName,
  loadAttendance,
  loadExams,
  loadGroups,
  loadNews,
  loadPayments,
  loadPupil,
  loadPupilNames,
  loadTasks,
  nextLesson,
} from "@/lib/studentBot/data";
import {
  CB,
  askCancel,
  attendanceNav,
  backOnly,
  contactKeyboard,
  kidArg,
  kidsMenu,
  logoutConfirm,
  mainMenu,
  monthArg,
  notifyArg,
  settingsMenu,
} from "@/lib/studentBot/keyboards";
import { findPupilsByPhone, phoneKey } from "@/lib/studentBot/phone";
import {
  activeLink,
  getBotUser,
  linkBotUser,
  markBlocked,
  setActivePupil,
  setAwaiting,
  setMenuMessage,
  toggleNotify,
  touchBotUser,
  unlinkBotUser,
  type StudentBotUser,
} from "@/lib/studentBot/users";
import * as V from "@/lib/studentBot/views";
import { uzDateIso } from "@/lib/uzTime";

// O'quvchilar boti — kelgan yangilanishni ishlaydigan yagona joy.
//
// XAVFSIZLIK CHEGARASI. Bu modul o'quvchi ID'sini FOYDALANUVCHIDAN
// HECH QACHON OLMAYDI. Har bir so'rovda `chatId` (uni Telegram beradi,
// klient to'qib bo'lmaydi) bo'yicha `student_bot_users` dan bog'lanish
// o'qiladi va faqat o'sha ro'yxatdagi o'quvchi ko'rsatiladi. Yagona
// istisno — "Farzandni almashtirish": u ham `setActivePupil` ichida
// bog'lanish ro'yxatiga tekshiriladi, ya'ni begona id yozib boshqa
// o'quvchining ma'lumotini ochib bo'lmaydi.

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
  message?: { message_id: number; chat?: { id: number } };
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

/** Bo'lim ekrani — matn va tugmalar birga. */
interface Screen {
  html: string;
  keyboard: InlineKeyboard;
}

// ── Bo'lim ekranlarini yig'ish ──────────────────────────────────────

async function homeScreen(db: Db, cfg: StudentBotConfig, user: StudentBotUser, pupil: Pupil): Promise<Screen> {
  const [branch, groups, payments] = await Promise.all([
    branchName(db, (pupil as Pupil & { branchId?: number }).branchId),
    loadGroups(db, pupil.id),
    loadPayments(db, pupil),
  ]);
  const link = activeLink(user);
  return {
    html: V.homeView(pupil, {
      branch,
      groups,
      paid: payments.liveTotal + payments.archiveTotal,
      role: link?.role ?? "student",
    }),
    keyboard: mainMenu({
      hasSupport: isSupportReady(cfg),
      multiKid: user.links.length > 1,
    }),
  };
}

async function attendanceScreen(db: Db, pupil: Pupil, wanted: string | null): Promise<Screen> {
  const months = await attendanceMonths(db, pupil.id);
  if (months.length === 0) {
    return { html: V.attendanceView(pupil, [], uzDateIso().slice(0, 7)), keyboard: backOnly() };
  }
  // So'ralgan oy ro'yxatda bo'lmasa — ENG SO'NGGISI. Eskirgan tugma
  // (masalan xabar bir hafta oldin chizilgan) bo'sh ekran ochmasin.
  const month = wanted && months.includes(wanted) ? wanted : months[months.length - 1];
  const marks = await loadAttendance(db, pupil.id, month);
  return {
    html: V.attendanceView(pupil, marks, month),
    keyboard: attendanceNav(months, month, V.monthLabel),
  };
}

async function sectionScreen(
  db: Db,
  cfg: StudentBotConfig,
  user: StudentBotUser,
  pupil: Pupil,
  data: string,
): Promise<Screen> {
  const month = monthArg(data);
  if (data === CB.attendance || month) return attendanceScreen(db, pupil, month);

  switch (data) {
    case CB.payments:
      return { html: V.paymentsView(pupil, await loadPayments(db, pupil)), keyboard: backOnly() };

    case CB.schedule: {
      const groups = await loadGroups(db, pupil.id);
      return { html: V.scheduleView(pupil, groups, nextLesson(groups)), keyboard: backOnly() };
    }

    case CB.grades:
      return { html: V.gradesView(pupil, await loadAttendance(db, pupil.id)), keyboard: backOnly() };

    case CB.exams:
      return { html: V.examsView(pupil, await loadExams(db, pupil)), keyboard: backOnly() };

    case CB.tasks: {
      const groups = await loadGroups(db, pupil.id);
      const tasks = await loadTasks(db, groups.map((g) => g.id));
      return { html: V.tasksView(pupil, tasks), keyboard: backOnly() };
    }

    case CB.coins:
      return { html: V.coinsView(pupil), keyboard: backOnly() };

    case CB.news:
      return { html: V.newsView(await loadNews(db)), keyboard: backOnly() };

    case CB.settings:
      return { html: V.settingsView(user, pupilFullName(pupil)), keyboard: settingsMenu(user) };

    case CB.logout:
      return { html: V.logoutView(), keyboard: logoutConfirm() };

    case CB.kids: {
      const names = await loadPupilNames(db, user.links.map((l) => l.pupilId));
      return { html: V.kidsView(), keyboard: kidsMenu(user.links, names, user.activePupilId) };
    }

    default:
      return homeScreen(db, cfg, user, pupil);
  }
}

/**
 * Ekranni ko'rsatadi: avval MAVJUD menyu xabarini tahrirlashga urinadi,
 * bo'lmasa yangisini yuboradi va id'sini eslab qoladi.
 */
async function showScreen(
  db: Db,
  cfg: StudentBotConfig,
  chatId: number,
  messageId: number | undefined,
  screen: Screen,
): Promise<void> {
  if (messageId !== undefined) {
    const edited = await editStudentMenu(cfg, chatId, messageId, screen.html, screen.keyboard);
    if (edited) {
      await setMenuMessage(db, chatId, messageId);
      return;
    }
  }
  const sent = await sendToStudent(cfg, chatId, screen.html, screen.keyboard);
  if (sent.ok) await setMenuMessage(db, chatId, sent.messageId);
  else if (sent.blocked) await markBlocked(db, chatId);
}

// ── Kirish (telefon) ────────────────────────────────────────────────

async function handleContact(db: Db, cfg: StudentBotConfig, msg: TgMessage): Promise<void> {
  const chatId = msg.chat?.id;
  const from = msg.from;
  if (chatId === undefined || !from) return;

  // BOSHQA ODAMNING KONTAKTI RAD ETILADI. `request_contact` tugmasi
  // har doim o'z raqamini yuboradi, lekin foydalanuvchi qo'lda istalgan
  // kontakt kartochkasini ham jo'nata oladi — o'shanda `user_id` boshqa
  // bo'ladi (yoki umuman bo'lmaydi, ya'ni Telegramda hisobi yo'q odam).
  // Bu tekshiruvsiz kimningdir raqamini bilgan odam uning balansi va
  // davomatini ko'rib olardi.
  if (msg.contact?.user_id !== from.id) {
    await sendToStudent(cfg, chatId, V.foreignContact(), contactKeyboard());
    return;
  }

  const key = phoneKey(msg.contact?.phone_number);
  if (!key) {
    await sendToStudent(cfg, chatId, V.phoneNotFound(String(msg.contact?.phone_number ?? "")), contactKeyboard());
    return;
  }

  const matches = await findPupilsByPhone(db, key);
  if (matches.length === 0) {
    await sendToStudent(cfg, chatId, V.phoneNotFound(key), contactKeyboard());
    return;
  }

  const user = await linkBotUser(db, chatId, key, matches, {
    name: displayName(from),
    username: from.username ?? "",
  });

  // Telefon tugmasi kirish maydonining ustidan olib tashlanadi — endi
  // u keraksiz va chalg'itadi.
  await dropReplyKeyboard(cfg, chatId, "✅ Raqam qabul qilindi.");

  const pupil = await loadPupil(db, user.activePupilId);
  if (!pupil) {
    await sendToStudent(cfg, chatId, V.phoneNotFound(key));
    return;
  }
  await showScreen(db, cfg, chatId, undefined, await homeScreen(db, cfg, user, pupil));
}

// ── "Ustozga savol" — ichki guruhga yetkazish ───────────────────────

/**
 * Savolni xodimlar guruhiga yuboradi.
 *
 * XODIMLAR BOTI ORQALI, o'quvchilar boti orqali EMAS — u guruhga
 * qo'shilmagan va qo'shilishi ham shart emas (bitta bot kamroq
 * sozlash). Xodimlar boti allaqachon guruhlarda admin.
 *
 * `false` qaytsa o'quvchiga "yuborildi" DEYILMAYDI: bu yolg'on bo'lardi
 * va u javob kutib o'tirardi.
 */
async function deliverSupport(cfg: StudentBotConfig, html: string): Promise<boolean> {
  try {
    await sendMessage(loadSyncConfig(), cfg.supportChatId, html, cfg.supportThreadId);
    return true;
  } catch (e) {
    console.error("[student-bot] savol yetkazilmadi:", e instanceof Error ? e.message : e);
    return false;
  }
}

async function handleSupportText(
  db: Db,
  cfg: StudentBotConfig,
  user: StudentBotUser,
  chatId: number,
  text: string,
  fromName: string,
): Promise<void> {
  await setAwaiting(db, chatId, null);

  const pupil = await loadPupil(db, user.activePupilId);
  if (!pupil) {
    await sendToStudent(cfg, chatId, "Xatolik: o'quvchi topilmadi. /start ni qayta bosing.");
    return;
  }

  const [branch, groups] = await Promise.all([
    branchName(db, (pupil as Pupil & { branchId?: number }).branchId),
    loadGroups(db, pupil.id),
  ]);

  // 1500 belgi — Telegram chekloviga (4096) yetguncha ancha joy qoldiradi:
  // xabarga o'quvchi ma'lumotlari ham qo'shiladi.
  const ok = await deliverSupport(
    cfg,
    V.askForStaff(pupil, { branch, groups, phone: user.phone, text: text.slice(0, 1500), from: fromName }),
  );

  await sendToStudent(
    cfg,
    chatId,
    ok ? V.askSent() : "⚠️ Savol yuborilmadi — texnik nosozlik. Iltimos, markazga qo'ng'iroq qiling.",
  );

  const screen = await homeScreen(db, cfg, user, pupil);
  await showScreen(db, cfg, chatId, undefined, screen);
}

// ── Xabarlar ────────────────────────────────────────────────────────

async function handleMessage(db: Db, cfg: StudentBotConfig, msg: TgMessage): Promise<void> {
  const chatId = msg.chat?.id;
  if (chatId === undefined) return;

  // GURUHLARDA JIM. Bot guruhga qo'shilsa, u yerdagi har bir xabarga
  // javob berib boshlardi — va eng yomoni, guruhdagi hamma bitta
  // o'quvchining ma'lumotini ko'rardi.
  if (msg.chat?.type && msg.chat.type !== "private") return;

  if (msg.contact) {
    await handleContact(db, cfg, msg);
    return;
  }

  const text = (msg.text || "").trim();
  const user = await getBotUser(db, chatId);

  if (!user) {
    // Bog'lanmagan: nima yozishidan qat'i nazar telefon so'raladi.
    await sendToStudent(cfg, chatId, V.startPrompt(), contactKeyboard());
    return;
  }

  await touchBotUser(db, chatId);

  if (user.awaiting === "support" && text && !text.startsWith("/")) {
    await handleSupportText(db, cfg, user, chatId, text, displayName(msg.from));
    return;
  }

  const pupil = await loadPupil(db, user.activePupilId);
  if (!pupil) {
    // Bog'lanish bor, o'quvchi esa bazadan o'chirilgan — qayta ulanish
    // kerak, aks holda bot har bosishda xato bilan qulab tushardi.
    await unlinkBotUser(db, chatId);
    await sendToStudent(cfg, chatId, V.startPrompt(), contactKeyboard());
    return;
  }

  // Har qanday matn (/start, /menu yoki oddiy so'z) — menyuni ko'rsatadi.
  // Bot suhbatdosh emas va shunday bo'lib ko'rinmasligi kerak: erkin
  // matnga javob bermaydi, aniq tugmalarni taklif qiladi.
  const screen = await homeScreen(db, cfg, user, pupil);
  await showScreen(db, cfg, chatId, undefined, screen);
}

// ── Tugmalar ────────────────────────────────────────────────────────

async function handleCallback(db: Db, cfg: StudentBotConfig, cq: TgCallbackQuery): Promise<void> {
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const data = cq.data || "";

  if (chatId === undefined) {
    await answerStudent(cfg, cq.id, "Xabar topilmadi");
    return;
  }

  const user = await getBotUser(db, chatId);
  if (!user) {
    await answerStudent(cfg, cq.id, "Avval telefon raqamingizni yuboring");
    await sendToStudent(cfg, chatId, V.startPrompt(), contactKeyboard());
    return;
  }

  // "Chiqish" — tasdiqdan keyin bog'lanish o'chiriladi.
  if (data === CB.logoutYes) {
    await unlinkBotUser(db, chatId);
    await answerStudent(cfg, cq.id, "Bog'lanish uzildi");
    await sendToStudent(cfg, chatId, V.startPrompt(), contactKeyboard());
    return;
  }

  // Farzandni almashtirish — id RO'YXATGA tekshiriladi (setActivePupil).
  const kid = kidArg(data);
  if (kid !== null) {
    const ok = await setActivePupil(db, chatId, kid);
    if (!ok) {
      await answerStudent(cfg, cq.id, "Bu o'quvchi sizga bog'lanmagan");
      return;
    }
    const fresh = await getBotUser(db, chatId);
    const pupil = fresh ? await loadPupil(db, fresh.activePupilId) : null;
    if (fresh && pupil) {
      await answerStudent(cfg, cq.id, pupilFullName(pupil));
      await showScreen(db, cfg, chatId, messageId, await homeScreen(db, cfg, fresh, pupil));
    } else {
      await answerStudent(cfg, cq.id, "O'quvchi topilmadi");
    }
    return;
  }

  // Xabar sozlamalarini yoqish/o'chirish — ekran o'sha joyida qayta chiziladi.
  const kind = notifyArg(data);
  if (kind !== null) {
    const on = await toggleNotify(db, chatId, kind);
    const fresh = await getBotUser(db, chatId);
    const pupil = fresh ? await loadPupil(db, fresh.activePupilId) : null;
    await answerStudent(cfg, cq.id, on ? "Yoqildi" : "O'chirildi");
    if (fresh && pupil) {
      await showScreen(db, cfg, chatId, messageId, {
        html: V.settingsView(fresh, pupilFullName(pupil)),
        keyboard: settingsMenu(fresh),
      });
    }
    return;
  }

  const pupil = await loadPupil(db, user.activePupilId);
  if (!pupil) {
    await unlinkBotUser(db, chatId);
    await answerStudent(cfg, cq.id, "O'quvchi topilmadi");
    await sendToStudent(cfg, chatId, V.startPrompt(), contactKeyboard());
    return;
  }

  // "Ustozga savol" — keyingi matn xabari savol deb qabul qilinadi.
  if (data === CB.ask) {
    if (!isSupportReady(cfg)) {
      await answerStudent(cfg, cq.id, "Bu bo'lim hozircha ishlamaydi");
      return;
    }
    await setAwaiting(db, chatId, "support");
    await answerStudent(cfg, cq.id, "Savolingizni yozing");
    await showScreen(db, cfg, chatId, messageId, { html: V.askPrompt(), keyboard: askCancel() });
    return;
  }
  if (data === CB.askCancel) {
    await setAwaiting(db, chatId, null);
    await answerStudent(cfg, cq.id, "Bekor qilindi");
    await showScreen(db, cfg, chatId, messageId, await homeScreen(db, cfg, user, pupil));
    return;
  }

  await answerStudent(cfg, cq.id, "");
  await showScreen(db, cfg, chatId, messageId, await sectionScreen(db, cfg, user, pupil, data));
}

// ── Kirish nuqtasi ──────────────────────────────────────────────────

/**
 * Bitta yangilanishni ishlaydi.
 *
 * HECH QACHON OTMAYDI. Webhook Telegramga DOIM 200 qaytarishi kerak:
 * xato javobda Telegram o'sha yangilanishni qayta-qayta yuboraveradi va
 * navbat o'sib ketadi. Xatolar jurnalga yoziladi.
 */
export async function handleStudentUpdate(
  db: Db,
  cfg: StudentBotConfig,
  update: TelegramUpdate,
): Promise<void> {
  if (!isStudentBotReady(cfg)) return;

  try {
    if (update.callback_query?.id) {
      await handleCallback(db, cfg, update.callback_query);
      return;
    }
    // `edited_message` ATAYLAB E'TIBORSIZ: o'quvchi eski xabarini
    // tahrirlaganda bot uni yangi buyruq deb o'qimasin.
    if (update.message) await handleMessage(db, cfg, update.message);
  } catch (e) {
    console.error("[student-bot]", e instanceof Error ? e.message : e);
    const chatId = update.callback_query?.message?.chat?.id ?? update.message?.chat?.id;
    if (update.callback_query?.id) {
      await answerStudent(cfg, update.callback_query.id, "Xatolik — birozdan keyin urinib ko'ring");
    } else if (chatId !== undefined) {
      await sendToStudent(cfg, chatId, "⚠️ Texnik nosozlik. Birozdan keyin qayta urinib ko'ring.");
    }
  }
}
