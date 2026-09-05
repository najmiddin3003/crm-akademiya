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

/**
 * Hisoblangan oylik varag'ining nomi (lib/sync/salarySheet.ts to'ldiradi).
 *
 * Sozlanmaydi va jurnal varaqlaridan farqli o'laroq muhit o'zgaruvchisi
 * bilan almashtirilmaydi: varaqning ustunlari kodga qattiq bog'langan.
 */
export const SALARY_SUMMARY_TAB = "Xodim oyliklari";

/**
 * Oylik JURNALI varag'ining nomi.
 *
 * NEGA QO'RIQCHI BOR: bu varaq ilgari "Xodim oyliklari" deb atalardi va
 * eski o'rnatmalarda `SHEET_TAB_SALARIES` hali ham shu qiymatni ushlab
 * turishi mumkin (masalan Vercel'da). O'sha holda jurnal qatorlari
 * HISOB varag'ining ustiga yozilib, ikkalasi ham buzilardi. Shuning
 * uchun aynan shu qiymat e'tiborsiz qoldiriladi — sozlamani qo'lda
 * tuzatish esdan chiqsa ham modul to'g'ri varaqqa yozadi.
 */
function journalTabName(raw: string | undefined): string {
  const v = (raw || "").trim();
  return !v || v === SALARY_SUMMARY_TAB ? "Xodim avanslari" : v;
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
  key = key.replace(/\\n/g, "\n");

  // PEM BLOKINI KESIB OLAMIZ — chetidagi hamma narsa tashlanadi.
  //
  // NIMA NOTO'G'RI EDI: yuqoridagi qo'shtirnoq tekshiruvi faqat IKKALA
  // uchi ham qo'shtirnoq bo'lgandagina ishlaydi. Vercel oynasiga
  // nusxalaganda esa oldiga qo'shtirnoq, orqasiga qo'shtirnoq + yangi
  // qator tushib qoladi — juftlik topilmaydi, qo'shtirnoq kalit ichida
  // qolib ketadi va imzolash yiqiladi. O'lchandi: production'da kalit
  // to'liq edi (1711 belgi, 29 qator), lekin `-----BEGIN` boshida emas
  // edi.
  //
  // Bir marta yozilgan bu uch qator ko'rinmaydigan bo'shliq, BOM va
  // qo'shtirnoqning hammasini birdaniga hal qiladi.
  const begin = key.indexOf("-----BEGIN");
  const end = key.lastIndexOf("-----");
  if (begin >= 0 && end > begin) key = key.slice(begin, end + 5);

  return key.trim();
}

/** Faqat sinov uchun (scripts/_verify-key-describe.mjs). */
export const normalizePrivateKeyForTest = normalizePrivateKey;

/**
 * Kalitning SHAKLI haqida qisqacha ma'lumot — imzolash yiqilganda
 * xabarga qo'shiladi.
 *
 * NEGA KERAK: xato "GOOGLE_PRIVATE_KEY noto'g'ri" deb turardi va bu
 * o'nlab sababga to'g'ri kelardi — kalit qisqa nusxalanganmi, `\n` lar
 * qatorga aylanmaganmi, umuman boshqa qiymat qo'yilganmi. Vercel'dagi
 * qiymatni tashqaridan ko'rib bo'lmaydi, ya'ni topishning yagona yo'li
 * taxmin qilib ko'rish edi. Endi xabarning o'zi aytadi.
 *
 * MAXFIY QISM CHIQMAYDI: faqat uzunlik, chegara satrlari bor-yo'qligi va
 * qator sonlari — kalitning birorta belgisi qaytarilmaydi.
 */
export function describePrivateKey(key: string): string {
  if (!key) return "bo'sh";
  const trimmed = key.trim();
  const parts = [
    `uzunlik ${trimmed.length}`,
    trimmed.startsWith("-----BEGIN") ? "BEGIN bor" : "BEGIN YO'Q",
    trimmed.endsWith("-----") ? "END bor" : "END YO'Q",
    `qatorlar ${trimmed.split("\n").length}`,
  ];
  // TESKARI CHIZIQ tekshiruvi, "\n" qidirish EMAS.
  //
  // To'g'ri PEM kalitida teskari chiziq UMUMAN bo'lmaydi. Qiymat ikki
  // marta ekranlangan bo'lsa (Vercel oynasiga nusxalashda eng ko'p
  // uchraydigan xato), `normalizePrivateKey` ikkinchi chiziq bilan "n" ni
  // yangi qatorga aylantiradi va BIRINCHI chiziq osilib qoladi — ya'ni
  // "\n" ni qidirish uni topmasdi, teskari chiziqni qidirish esa topadi.
  if (trimmed.includes("\\")) parts.push("ORTIQCHA TESKARI CHIZIQ — qiymat ikki marta ekranlangan");
  // Chegara satri MATNDA bor, lekin boshida emas — demak oldida ortiqcha
  // belgi bor (qo'shtirnoq, bo'shliq, BOM). `normalizePrivateKey` endi
  // buni o'zi kesib tashlaydi; xabar esa qiymat qanday kiritilganini
  // aytadi, ya'ni Vercel'dagi qatorni tozalash kerakligi bilinadi.
  if (!trimmed.startsWith("-----BEGIN") && trimmed.includes("-----BEGIN")) {
    parts.push("BEGIN matn ICHIDA bor — oldida ortiqcha belgi");
  }
  // Odatdagi 2048-bitli service account kaliti ~1700 belgi.
  if (trimmed.length < 1000) parts.push("JUDA QISQA — to'liq nusxalanmagan");
  return parts.join(", ");
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
        // "Xodim AVANSLARI" — "oyliklari" EMAS (markaz so'rovi 2026-09-05).
        //
        // Bu varaq hech narsa hisoblamaydi: u kassadan HAQIQATAN
        // chiqarilgan pulning jurnali (oylik ham, avans ham). Nomi
        // "Xodim oyliklari" bo'lgani chalkashlik tug'dirardi — odam u
        // yerda xodimning OYLIGI qancha ekanini ko'rmoqchi bo'lardi.
        // Hisoblangan oylik endi alohida varaqda: lib/sync/salarySheet.ts.
        tabName: journalTabName(env.SHEET_TAB_SALARIES),
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
 * Guruhga HAR BIR YOZUV uchun xabar boradigan oqimlar. Faqat o'quvchi
 * to'lovlari.
 *
 * "salary" 2026-08-28 da ro'yxatdan CHIQARILDI. Ilgari har bir avans va
 * oylik alohida xabar bo'lib "O'qituvchilar oyliklari" topikiga tushardi
 * — avgust oyida bu 231 ta xabar degani. Foydalanuvchi o'sha topikni
 * boshqa maqsad uchun ochgan: oyda IKKI MARTA umumiy oylik holatini
 * ko'rish uchun. Endi u yerga faqat `lib/sync/salaryDigest.ts` yozadi.
 *
 * DIQQAT: `TELEGRAM_CHAT_SALARIES` va `TELEGRAM_TOPIC_SALARIES` ni bo'sh
 * qoldirib "o'chirish" MUMKIN EMAS — u holda navbatdagi vazifa
 * `isTelegramReady` da yiqilib, har 6 soatda abadiy qayta urinilardi va
 * Sinxronizatsiya sahifasidagi "muammolar" ro'yxatini to'ldirardi.
 * Ustiga xulosa ham aynan o'sha chat va topikka yoziladi.
 *
 * Bu shunchaki sozlama emas — `outbox.enqueue` shu ro'yxatga qaramay
 * kelgan `notifyTelegram: true` ni ham o'chiradi, ya'ni kelajakda
 * kimdir chaqiruv joyida xato qilsa ham guruh himoyalangan.
 */
const TELEGRAM_KINDS: readonly SyncKind[] = ["payment"];

export function kindNotifiesTelegram(kind: SyncKind): boolean {
  return TELEGRAM_KINDS.includes(kind);
}
