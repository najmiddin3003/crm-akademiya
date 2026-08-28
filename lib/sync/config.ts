import type { SyncKind } from "@/lib/sync/types";

// Sinxronizatsiya sozlamalari — hammasi muhit o'zgaruvchilaridan (.env.local
// lokalda, Vercel > Environment Variables serverda). Kalitlar KODGA
// yozilmaydi.
//
// MUHIM: `SYNC_ENABLED=false` (yoki kalitlar to'ldirilmagan) bo'lsa butun
// modul jim turadi va CRM avvalgidek ishlayveradi. Ya'ni Google yoki
// Telegram tomonida nima bo'lishidan qat'i nazar KASSA ISHDAN TO'XTAMAYDI —
// bu qasddan qo'yilgan xavfsizlik chegarasi.

export interface SheetTarget {
  spreadsheetId: string;
  /** Jadval ichidagi varaq nomi — kod o'zi yaratadi, qo'lda kerak emas. */
  tabName: string;
  chatId: string;
  /**
   * Guruh ichidagi TOPIC (mavzu) raqami — Telegram'da `message_thread_id`.
   *
   * Ikkala oqim uchun alohida guruh ochish shart emas: bitta forum-guruhda
   * ikkita topic ochib, `chatId` ni bir xil qoldirib, shu yerda ularni
   * ajratish kifoya. Bo'sh bo'lsa xabar guruhning umumiy ("General")
   * oqimiga tushadi — oddiy (forum bo'lmagan) guruhda ham shunday.
   */
  threadId: string;
}

export interface SyncConfig {
  enabled: boolean;
  google: {
    clientEmail: string;
    privateKey: string;
  };
  telegramToken: string;
  targets: Record<SyncKind, SheetTarget>;
  cronSecret: string;
}

/**
 * Service account JSON'idagi `private_key` bir qatorli matn bo'lib, ichidagi
 * yangi qatorlar `\n` belgilari bilan yozilgan. `.env` ga qo'yilganda ular
 * HAQIQIY yangi qatorga aylanmaydi — shu bois qo'lda almashtiriladi.
 * Qo'shtirnoq bilan o'ralgan bo'lsa ham tozalanadi.
 */
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  // `\\n` — ikki belgi (teskari chiziq va "n"), HAQIQIY yangi qator emas.
  // Aynan shularni almashtirish kerak; `/\n/` yozilsa hech narsa
  // o'zgarmaydi va kalit bir qatorli bo'lib qolib, imzolash "DECODER
  // routines::unsupported" xatosi bilan yiqiladi.
  return key.replace(/\\n/g, "\n");
}

export function loadSyncConfig(): SyncConfig {
  const env = process.env;
  return {
    // Aniq "false" yozilgandagina o'chadi — sozlanmagan holatda ham
    // ishlashga urinadi, lekin quyidagi isSyncReady() uni to'xtatadi.
    enabled: env.SYNC_ENABLED !== "false",
    google: {
      clientEmail: (env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim(),
      privateKey: normalizePrivateKey(env.GOOGLE_PRIVATE_KEY || ""),
    },
    telegramToken: (env.TELEGRAM_BOT_TOKEN || "").trim(),
    targets: {
      payment: {
        spreadsheetId: (env.SHEET_ID_PAYMENTS || "").trim(),
        tabName: (env.SHEET_TAB_PAYMENTS || "To'lovlar").trim(),
        chatId: (env.TELEGRAM_CHAT_PAYMENTS || "").trim(),
        threadId: (env.TELEGRAM_TOPIC_PAYMENTS || "").trim(),
      },
      salary: {
        spreadsheetId: (env.SHEET_ID_SALARIES || "").trim(),
        tabName: (env.SHEET_TAB_SALARIES || "Xodim oyliklari").trim(),
        chatId: (env.TELEGRAM_CHAT_SALARIES || "").trim(),
        threadId: (env.TELEGRAM_TOPIC_SALARIES || "").trim(),
      },
      // Xarajat va ko'chirma odatda to'lovlar bilan BITTA jadvalda,
      // alohida varaqda turadi — shuning uchun id ko'rsatilmasa
      // SHEET_ID_PAYMENTS ga tushadi. Shu bois Vercel'ga yangi
      // o'zgaruvchi qo'shish shart emas.
      expense: {
        spreadsheetId: (env.SHEET_ID_EXPENSES || env.SHEET_ID_PAYMENTS || "").trim(),
        tabName: (env.SHEET_TAB_EXPENSES || "Xarajatlar").trim(),
        // chatId ATAYLAB bo'sh: xarajat guruhga yuborilmaydi (types.ts).
        chatId: "",
        threadId: "",
      },
      transfer: {
        spreadsheetId: (env.SHEET_ID_TRANSFERS || env.SHEET_ID_PAYMENTS || "").trim(),
        tabName: (env.SHEET_TAB_TRANSFERS || "Ko'chirmalar").trim(),
        chatId: "",
        threadId: "",
      },
    },
    cronSecret: (env.CRON_SECRET || "").trim(),
  };
}

/** Google Sheets tomoni ishlashga tayyormi. */
export function isSheetsReady(cfg: SyncConfig, kind: SyncKind): boolean {
  return Boolean(
    cfg.enabled && cfg.google.clientEmail && cfg.google.privateKey && cfg.targets[kind].spreadsheetId,
  );
}

/** Telegram tomoni ishlashga tayyormi. */
export function isTelegramReady(cfg: SyncConfig, kind: SyncKind): boolean {
  return Boolean(cfg.enabled && cfg.telegramToken && cfg.targets[kind].chatId);
}

/**
 * Sozlamalardagi kamchiliklar ro'yxati — CRM'dagi Sinxronizatsiya
 * sahifasida ko'rsatiladi, shunda "nega ishlamayapti" degan savol
 * javobsiz qolmaydi. MAXFIY QIYMATLAR QAYTARILMAYDI, faqat qaysi kalit
 * to'ldirilmagani aytiladi.
 */
export function syncConfigIssues(cfg: SyncConfig): string[] {
  const issues: string[] = [];
  if (!cfg.enabled) issues.push("SYNC_ENABLED=false — sinxronizatsiya o'chirilgan");
  if (!cfg.google.clientEmail) issues.push("GOOGLE_SERVICE_ACCOUNT_EMAIL to'ldirilmagan");
  if (!cfg.google.privateKey) issues.push("GOOGLE_PRIVATE_KEY to'ldirilmagan");
  if (!cfg.telegramToken) issues.push("TELEGRAM_BOT_TOKEN to'ldirilmagan");
  if (!cfg.targets.payment.spreadsheetId) issues.push("SHEET_ID_PAYMENTS to'ldirilmagan");
  if (!cfg.targets.salary.spreadsheetId) issues.push("SHEET_ID_SALARIES to'ldirilmagan");
  if (!cfg.targets.payment.chatId) issues.push("TELEGRAM_CHAT_PAYMENTS to'ldirilmagan");
  if (!cfg.targets.salary.chatId) issues.push("TELEGRAM_CHAT_SALARIES to'ldirilmagan");
  return issues;
}

export const KIND_LABEL: Record<SyncKind, string> = {
  payment: "O'quvchi to'lovlari",
  salary: "Xodim oyliklari",
  expense: "Xarajatlar",
  transfer: "Ko'chirmalar",
};

/** Solishtirish va sozlamalar sahifasi shu tartibda aylanadi. */
export const SYNC_KINDS: readonly SyncKind[] = ["payment", "salary", "expense", "transfer"];

/**
 * Telegram guruhiga BORADIGAN oqimlar. Ro'yxat qasddan qisqa: kelishuv
 * faqat o'quvchi to'lovlari va xodim oyliklari haqida edi. Xarajat va
 * ko'chirma soni ko'p va guruhga foydasi yo'q.
 *
 * Bu shunchaki sozlama emas — `outbox.enqueue` shu ro'yxatga qaramay
 * kelgan `notifyTelegram: true` ni ham o'chiradi, ya'ni kelajakda
 * kimdir chaqiruv joyida xato qilsa ham guruh himoyalangan.
 */
const TELEGRAM_KINDS: readonly SyncKind[] = ["payment", "salary"];

export function kindNotifiesTelegram(kind: SyncKind): boolean {
  return TELEGRAM_KINDS.includes(kind);
}
