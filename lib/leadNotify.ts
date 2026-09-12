import type { Db } from "mongodb";
import { loadSyncConfig } from "@/lib/sync/config";
import { esc, sendMessage } from "@/lib/sync/telegram";
import { leadKeyboard, leadStatusLine } from "@/lib/leadStatus";
import { orderNo, type Order } from "@/lib/ordersData";

// YANGI LID -> TELEGRAM (filialning o'z topigi).
//
// Foydalanuvchi so'rovi (07.09.2026): "qaysi filialdan bo'lsa ham yangi lid
// kiritilgan paytda telegramga notification yuborilishi kerak" — shu bois
// FILIAL BO'YICHA KESILMAYDI, xabarda filial nomi ko'rsatiladi.
//
// FILIAL → TOPIK (12.09.2026): "1-filialdan tushayotgan lidlar filial 1
// lidlar topigiga tushishi kerak, filial 2 dagi lidlar filial 2 ga" —
// lidlar uchun ALOHIDA forum-guruh ochildi, har filialga o'z topigi.
// Topik raqami filialning o'zida turadi (`branches.leadTopicId`, Boshqaruv →
// Filiallar sahifasidan tahrirlanadi), muhit o'zgaruvchisida emas: yangi
// filial qo'shilganda serverga kirib .env tahrirlash shart bo'lmasin.
// Topigi yo'q filialning lidi `TELEGRAM_TOPIC_LEADS` ga (umumiy topik)
// tushadi, u ham bo'sh bo'lsa — yuborilmaydi va jurnalga ogohlantirish
// yoziladi (jimgina yo'qolmasin).
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
//   TELEGRAM_CHAT_LEADS  — "Lidlar" guruhining id'si (filial topiklari shu
//     guruhda). Ko'rsatilmasa TELEGRAM_CHAT_PAYMENTS ishlatiladi — eski
//     o'rnatma, lid topigi to'lovlar guruhida bo'lgan payt uchun.
//   branches.leadTopicId — filialning topigi (bazada, sahifadan sozlanadi).
//   TELEGRAM_TOPIC_LEADS — topigi yo'q filiallar uchun UMUMIY topik. Bo'sh
//     bo'lsa bunday lid YUBORILMAYDI: guruhning umumiy oqimiga tushib
//     boshqa xabarlar bilan aralashib ketgandan ko'ra jim turgani yaxshi.
//     DIQQAT: topik raqami GURUHGA bog'liq — guruh almashtirilsa bu
//     qiymat ham yangi guruhdagi topikka o'zgartirilishi (yoki
//     bo'shatilishi) kerak, aks holda "message thread not found" bo'ladi.
//   Topiklarni ochish va biriktirish: node scripts/telegram-branch-topics.mjs

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

interface BranchInfo {
  /** Filial nomi — xabar ichida. Topilmasa bo'sh satr, xabar baribir ketadi. */
  name: string;
  /** Filialning topigi (`branches.leadTopicId`). Yo'q bo'lsa null. */
  leadTopicId: number | null;
}

/** Filial nomi va topigi (`branches`) — bitta so'rov. */
async function branchInfo(db: Db, branchId: number | null | undefined): Promise<BranchInfo> {
  if (typeof branchId !== "number") return { name: "", leadTopicId: null };
  const row = await db
    .collection("branches")
    .findOne({ id: branchId }, { projection: { _id: 0, name: 1, leadTopicId: 1 } });
  const topic = row?.leadTopicId;
  return {
    name: typeof row?.name === "string" ? row.name : "",
    leadTopicId: typeof topic === "number" && Number.isInteger(topic) && topic > 0 ? topic : null,
  };
}

/**
 * Lid qaysi topikka tushadi: filialning o'z topigi, bo'lmasa umumiy
 * (`TELEGRAM_TOPIC_LEADS`), u ham bo'lmasa bo'sh satr — yuborilmaydi.
 * Filial topigi ustun: umumiy topik faqat "hali biriktirilmagan" holat uchun.
 */
export function leadThreadId(branchTopic: number | null): string {
  return branchTopic ? String(branchTopic) : (process.env.TELEGRAM_TOPIC_LEADS || "").trim();
}

/**
 * Telegram xabarining matni — mappers.ts dagi to'lov xabari uslubida.
 *
 * Status qatori sarlavhaning ostida turadi va HAR DOIM chiziladi: tugma
 * bosilganda aynan shu matn qayta yig'iladi (app/api/telegram/webhook),
 * ya'ni xabarning qolgan qismi bazadagi joriy holatdan chiqadi.
 */
export function leadMessage(order: Order, branch: string): string {
  const lines = [
    `🆕 <b>Yangi lid</b> <code>#${orderNo(order)}</code>`,
    leadStatusLine(order.leadStatus),
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
    if (!cfg.enabled || !cfg.telegramToken || !chatId) return;

    const branch = await branchInfo(db, branchId);
    const threadId = leadThreadId(branch.leadTopicId);
    if (!threadId) {
      // Sozlama kamchiligi — jim yo'qolmasin: Boshqaruv → Filiallar da shu
      // filialga topik biriktirilmagan va umumiy topik ham yo'q.
      console.warn(
        `[leadNotify] lid #${orderNo(order)} yuborilmadi: ${branch.name || `filial ${branchId}`} uchun Telegram topigi yo'q`,
      );
      return;
    }

    // Tugmalar HAR DOIM qo'shiladi — webhook sozlanmagan bo'lsa ham. Ular
    // bosilganda hech narsa bo'lmaydi (Telegram javobsiz qoladi), lekin
    // xabarning shakli bir xil qoladi va webhook ulangan zahoti eski
    // lidlar ham ishlay boshlaydi. Aks holda tugmalarning bor-yo'qligi
    // yashirin sozlamaga bog'liq bo'lib qolardi.
    await sendMessage(cfg, chatId, leadMessage(order, branch.name), threadId, leadKeyboard(order.id));
  } catch (e) {
    // Faqat jurnalga — lid allaqachon bazada.
    console.error("[leadNotify] yuborilmadi:", e instanceof Error ? e.message : e);
  }
}
