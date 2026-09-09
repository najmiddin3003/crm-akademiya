// O'QUVCHILAR BOTI sozlamalari — hammasi muhit o'zgaruvchilaridan
// (.env.local lokalda, Vercel > Environment Variables serverda).
//
// XODIMLAR BOTIDAN BUTUNLAY AJRATILGAN. Alohida token, alohida webhook
// (`/api/telegram/student`), alohida maxfiy kalit. Sabab shakliy emas:
//
//   • xodimlar botining webhook'i `allowed_updates: ["callback_query"]`
//     bilan ro'yxatdan o'tgan, ya'ni u begona odamning xabarini UMUMAN
//     ko'rmaydi. O'quvchilar botiga esa `message` kerak — bir botda
//     birlashtirilsa, ichki guruhlarga yozadigan bot dunyodagi har
//     kimning xabarini qabul qiladigan bo'lib qolardi;
//   • o'quvchilar botidagi xato (masalan cheksiz halqa yoki 429) ichki
//     to'lov xabarlarini ham to'xtatib qo'yardi.
//
// Modul TO'LIQ IXTIYORIY: token bo'lmasa `isStudentBotReady()` false
// qaytaradi, webhook so'rovlarni jimgina rad etadi va CRM avvalgidek
// ishlayveradi. Bu sinxronizatsiya modulidagi bilan bir xil chegara.

export interface StudentBotConfig {
  enabled: boolean;
  token: string;
  webhookSecret: string;
  /**
   * O'quvchining savoli tushadigan ichki guruh. Bo'sh bo'lsa "Ustozga
   * savol" bo'limi menyuda UMUMAN ko'rsatilmaydi — tugma bosilib,
   * savol hech qayerga bormasligidan ko'ra yo'qligi ma'qul.
   */
  supportChatId: string;
  supportThreadId: string;
}

/**
 * "Rost" qiymatlar BAG'RIKENG o'qiladi — lib/paymentSms.ts dagi bilan
 * bir xil sabab: qiymatni odam Vercel oynasiga qo'lda yozadi va "True",
 * "1" yoki oxirida bo'sh joy bilan "true " bo'lishi tabiiy.
 */
function isEnvTrue(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "on";
}

export function loadStudentBotConfig(): StudentBotConfig {
  const env = process.env;
  return {
    // Aniq "false" yozilgandagina o'chadi (SYNC_ENABLED bilan bir xil
    // qolip) — sozlanmagan holatda quyidagi tayyorlik tekshiruvi to'xtatadi.
    enabled: env.STUDENT_BOT_ENABLED !== "false",
    token: (env.TELEGRAM_STUDENT_BOT_TOKEN || "").trim(),
    webhookSecret: (env.TELEGRAM_STUDENT_WEBHOOK_SECRET || "").trim(),
    supportChatId: (env.TELEGRAM_CHAT_SUPPORT || "").trim(),
    supportThreadId: (env.TELEGRAM_TOPIC_SUPPORT || "").trim(),
  };
}

/** Bot yozishga tayyormi (token bor va o'chirilmagan). */
export function isStudentBotReady(cfg: StudentBotConfig): boolean {
  return Boolean(cfg.enabled && cfg.token);
}

/** "Ustozga savol" bo'limi ishlaydimi. */
export function isSupportReady(cfg: StudentBotConfig): boolean {
  return isStudentBotReady(cfg) && Boolean(cfg.supportChatId);
}

/**
 * AVTOMATIK XABARLAR yoqilganmi (davomat belgilanganda / to'lov kelganda).
 *
 * SUKUT BO'YICHA O'CHIQ — ataylab. Bot ishga tushirilgan zahoti hamma
 * ulangan o'quvchiga xabar yog'ilib ketmasin: avval bir necha kishi
 * bilan sinab ko'riladi, keyin yoqiladi. `PAYMENT_SMS_ENABLED` bilan
 * bir xil qolip.
 *
 * Yoqish: STUDENT_BOT_PUSH_ENABLED=true (Vercel'da qayta deploy SHART —
 * muhit o'zgaruvchilari ishlab turgan nusxalarga qayta uzatilmaydi).
 */
export function studentBotPushEnabled(): boolean {
  return isEnvTrue(process.env.STUDENT_BOT_PUSH_ENABLED);
}

/** O'zgaruvchi UMUMAN qo'yilganmi — "qo'yilmagan" va "noto'g'ri" ni ajratish uchun. */
export function studentBotPushVarSet(): boolean {
  return typeof process.env.STUDENT_BOT_PUSH_ENABLED === "string";
}

/**
 * Sozlamalardagi kamchiliklar — diagnostika skripti va kelajakdagi CRM
 * sahifasi uchun. MAXFIY QIYMATLAR QAYTARILMAYDI, faqat qaysi kalit
 * to'ldirilmagani aytiladi.
 */
export function studentBotIssues(cfg: StudentBotConfig): string[] {
  const issues: string[] = [];
  if (!cfg.enabled) issues.push("STUDENT_BOT_ENABLED=false — o'quvchilar boti o'chirilgan");
  if (!cfg.token) issues.push("TELEGRAM_STUDENT_BOT_TOKEN to'ldirilmagan");
  if (!cfg.webhookSecret) {
    issues.push("TELEGRAM_STUDENT_WEBHOOK_SECRET to'ldirilmagan — webhook hamma so'rovni rad etadi");
  }
  if (!cfg.supportChatId) {
    issues.push("TELEGRAM_CHAT_SUPPORT to'ldirilmagan — \"Ustozga savol\" bo'limi ko'rinmaydi");
  }
  if (!studentBotPushEnabled()) {
    issues.push(
      studentBotPushVarSet()
        ? "STUDENT_BOT_PUSH_ENABLED rost emas — avtomatik xabarlar o'chiq"
        : "STUDENT_BOT_PUSH_ENABLED qo'yilmagan — avtomatik xabarlar o'chiq",
    );
  }
  return issues;
}
