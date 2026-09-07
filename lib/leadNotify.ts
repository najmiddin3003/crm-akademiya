import type { Db } from "mongodb";
import { loadSyncConfig } from "@/lib/sync/config";
import { esc, sendMessage } from "@/lib/sync/telegram";
import type { Order } from "@/lib/ordersData";

// YANGI LID -> TELEGRAM ("Lidlar" topigi).
//
// Foydalanuvchi so'rovi (07.09.2026): "qaysi filialdan bo'lsa ham yangi lid
// kiritilgan paytda telegramga notification yuborilishi kerak" — shu bois
// FILIAL BO'YICHA KESILMAYDI, xabarda filial nomi ko'rsatiladi.
//
// NEGA SyncKind EMAS: lib/sync dagi oqim (payment/salary/expense/transfer)
// kuniga bir marta cron bilan ketadi va har biri Google Sheets varag'iga
// ham yozadi. Lid bildirishnomasi ikkalasiga ham to'g'ri kelmaydi: u
// DARHOL kerak va jadvalga yozilmaydi. `SyncKind` ga beshinchi qiymat
// qo'shilsa outbox, reconcile, dispatch va Sinxronizatsiya sahifasi
// hammasi "lid uchun qaysi jadval?" degan savolga javob berishi kerak
// bo'lardi. Shu bois faqat YUBORUVCHI qayta ishlatiladi
// (lib/sync/telegram.ts — 429 va 5xx uchun qayta urinish o'sha yerda).
//
// SOZLAMA:
//   TELEGRAM_TOPIC_LEADS — "Lidlar" topigining raqami. BO'SH BO'LSA
//     xabar YUBORILMAYDI: umumiy oqimga tushib, to'lovlar bilan
//     aralashib ketgandan ko'ra jim turgani yaxshi.
//   TELEGRAM_CHAT_LEADS  — guruh id'si. Ko'rsatilmasa TELEGRAM_CHAT_PAYMENTS
//     ishlatiladi: uchala topik ham bitta forum-guruhda
//     ([[sync-module-decisions]] dagi qaror), ya'ni Vercel'ga yangi
//     o'zgaruvchi qo'shish shart emas.

const DASH = "—";

/**
 * Raqamni BOSILADIGAN ko'rinishga keltiradi: "94 050 95 26" -> "+998940509526".
 *
 * Telegram raqamni O'ZI taniydi va ustiga bosilganda "Qo'ng'iroq qilish"
 * menyusini chiqaradi — lekin FAQAT xalqaro formatda va PROBELSIZ bo'lsa.
 * O'lchandi (guruhga sinov xabari yuborib, javobdagi `entities` ga qarab):
 *
 *   "94 050 95 26"        -> tanilmadi
 *   "+998 94 050 95 26"   -> tanilmadi (probel to'sadi)
 *   "+998940509526"       -> phone_number  ✅
 *   <a href="tel:...">    -> havola umuman yaratilmadi (Telegram bu sxemani
 *                            qo'llab-quvvatlamaydi, xato ham bermaydi)
 *
 * Ya'ni o'qishga chiroyliroq bo'lgan probelli variant BOSILMAYDI — shu bois
 * xabarda raqam ataylab yopishtirilgan holda turadi.
 *
 * Formatga tushmagan raqam O'ZGARTIRILMASDAN qaytadi: to'qib "+998" qo'shish
 * noto'g'ri raqam yasab qo'yishi mumkin, borini ko'rsatgan afzal.
 */
export function phoneForCall(raw: string): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 9) return `+998${d}`;
  if (d.length === 12 && d.startsWith("998")) return `+${d}`;
  return String(raw ?? "").trim();
}

/** Filial nomi (`branches`). Topilmasa bo'sh satr — xabar baribir ketadi. */
async function branchName(db: Db, branchId: number | null | undefined): Promise<string> {
  if (typeof branchId !== "number") return "";
  const row = await db.collection("branches").findOne({ id: branchId }, { projection: { _id: 0, name: 1 } });
  return typeof row?.name === "string" ? row.name : "";
}

/** Telegram xabarining matni — mappers.ts dagi to'lov xabari uslubida. */
export function leadMessage(order: Order, branch: string): string {
  const lines = [
    `🆕 <b>Yangi lid</b> <code>#${order.id}</code>`,
    "",
    `👤 <b>${esc(order.name || DASH)}</b>`,
  ];
  // Raqam ESKAPE QILINMAYDI — `phoneForCall` dan faqat raqam, "+" va
  // (formatga tushmasa) xom satr chiqadi. Xom satrda "<" bo'lsa Telegram
  // butun xabarni rad etardi, shuning uchun u ham eskape qilinadi.
  if (order.phone) lines.push(`📞 ${esc(phoneForCall(order.phone))}`);
  lines.push(`📚 ${esc(order.course || DASH)}`);

  // Dars kuni va vaqti bitta qatorda — ikkalasi ham bo'lmasa qator
  // umuman qo'shilmaydi ("— · —" degan bo'sh qator foyda bermaydi).
  const when = [order.lessonDay, order.lessonStartTime].filter(Boolean).map(esc).join(" · ");
  if (when) lines.push(`🗓 ${when}`);

  if (order.teacher) lines.push(`🧑‍🏫 Ustoz: ${esc(order.teacher)}`);
  if (order.group) lines.push(`👥 Guruh: ${esc(order.group)}`);
  if (order.firstLesson) lines.push(`🎯 Birinchi dars: ${esc(order.firstLesson)}`);
  if (order.source) lines.push(`📣 Manba: ${esc(order.source)}`);
  if (branch) lines.push(`🏢 ${esc(branch)}`);
  if (order.moderator) lines.push(`✅ Qo'shdi: ${esc(order.moderator)}`);
  if (order.note) lines.push(`📝 ${esc(order.note)}`);
  if (order.created) lines.push(`🕐 ${esc(order.created)}`);
  return lines.join("\n");
}

/**
 * Yangi lid haqida guruhga xabar beradi.
 *
 * HECH QACHON OTILMAYDI. Chaqiruvchi buni `after()` ichida ishlatadi, ya'ni
 * javob allaqachon foydalanuvchiga ketgan bo'ladi — bu yerdagi xato lidni
 * yaratishni bekor qila olmaydi va qilmasligi ham kerak: Telegram ishlamay
 * qolgani uchun moderator lid qo'sha olmay qolsa, bu ancha battar bo'lardi.
 */
export async function notifyNewLead(db: Db, order: Order, branchId: number | null): Promise<void> {
  try {
    const cfg = loadSyncConfig();
    const chatId = (process.env.TELEGRAM_CHAT_LEADS || "").trim() || cfg.targets.payment.chatId;
    const threadId = (process.env.TELEGRAM_TOPIC_LEADS || "").trim();

    if (!cfg.enabled || !cfg.telegramToken || !chatId || !threadId) return;

    await sendMessage(cfg, chatId, leadMessage(order, await branchName(db, branchId)), threadId);
  } catch (e) {
    // Faqat jurnalga — lid allaqachon bazada.
    console.error("[leadNotify] yuborilmadi:", e instanceof Error ? e.message : e);
  }
}
