// Moliya → Sinxronizatsiya. Kassadagi har bir Kirim/Chiqim yozuvi ikki
// tashqi manzilga ko'chiriladi: Google Sheets (to'liq tarix) va Telegram
// guruh (faqat YANGI yozuvlar — eski/import qilingan tarix guruhga
// yuborilmaydi, foydalanuvchi bilan kelishilgan).
//
// To'rt oqim bir-biridan mustaqil, har birining o'z varag'i bor:
//   • "payment"  — o'quvchi to'lovlari (kassaga tushgan pul, txType payIn)
//   • "salary"   — xodimga chiqarilgan oylik/avans (txType payOut, kategoriya
//                  "avans"/"oylik" bo'lganlar)
//   • "expense"  — qolgan barcha chiqimlar (ijara, kommunal, kanselyariya,
//                  soliq, o'quvchiga qaytarilgan pul, …)
//   • "transfer" — kassalar orasidagi va kassa ichidagi ko'chirmalar
//
// TELEGRAM FAQAT BIRINCHI IKKITASIGA. Xarajat va ko'chirma guruhga
// yuborilmaydi — kelishuv "o'quvchi to'lovlari va xodim oyliklari"
// haqida edi. Bu qoida `config.ts` dagi TELEGRAM_KINDS bilan
// TUZILMAVIY ta'minlangan: yangi oqimlarda `chatId` doim bo'sh va
// `enqueue` ularning `notifyTelegram` bayrog'ini majburan o'chiradi.

/** Qaysi oqim — har biri o'z varag'iga boradi. */
export type SyncKind = "payment" | "salary" | "expense" | "transfer";

/**
 * Navbatdagi hodisa turi.
 *   • "created"   — yangi yozuv qo'shildi (Sheet'ga qator + guruhga xabar)
 *   • "cancelled" — yozuv bekor qilindi (Sheet qatori yangilanadi +
 *                   guruhga ALOHIDA tuzatish xabari ketadi; eski xabar
 *                   tahrirlanmaydi, chunki kassir eski xabarni ko'rmay
 *                   qolishi mumkin)
 */
export type SyncEvent = "created" | "cancelled";

export type SyncStatus = "pending" | "done" | "failed";

/**
 * `sync_outbox` kolleksiyasidagi hujjat — bitta yetkazib berish vazifasi.
 *
 * Nega alohida navbat kerak? To'lov bazaga yozilishi bilan Google yoki
 * Telegram javob bermasligi mumkin (internet uzildi, API limiti, bot
 * bloklandi). Navbat bo'lmasa o'sha yozuv butunlay yo'qoladi va buni
 * hech kim sezmaydi. Navbat bilan esa: yozuv `pending` bo'lib qoladi,
 * keyingi urinishda (yangi to'lov kelganda yoki kunlik cron'da) qayta
 * yuboriladi.
 */
export interface SyncTask {
  kind: SyncKind;
  /** `transaction_entries.id` — Sheet'dagi birinchi ustun ham shu. */
  entryId: number;
  event: SyncEvent;
  /**
   * Telegram guruhiga xabar ketsinmi. Kassadan kelgan HAQIQIY yangi
   * yozuvda `true`; eski tarixni Sheets'ga ko'chirishda (backfill /
   * edutizim importi) `false` — aks holda guruh minglab xabar bilan
   * to'lib ketardi.
   */
  notifyTelegram: boolean;
  status: SyncStatus;
  /** Sheet qatori yozildimi. Qisman muvaffaqiyatni ajratish uchun. */
  sheetDone: boolean;
  /** Telegram xabari ketdimi (`notifyTelegram: false` bo'lsa darhol true). */
  telegramDone: boolean;
  /** Yuborilgan xabar id'si — kelajakda tahrirlash kerak bo'lsa. */
  messageId: number | null;
  attempts: number;
  lastError: string | null;
  /** ISO — shu vaqtdan oldin qayta urinilmaydi (eksponensial kutish). */
  nextAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
  doneAt: string | null;
}

/** Sheet qatoriga va Telegram xabariga aylantiriladigan tayyor ma'lumot. */
export interface PaymentRow {
  entryId: number;
  date: string;        // "YYYY-MM-DD"
  time: string;        // "HH:mm"
  studentName: string;
  groupName: string;
  teacherName: string;
  category: string;    // txName — "O'quvchi to'ladi", "Boshqa kirim", ...
  amount: number;      // musbat
  paymentType: string; // "Naqd" | "Plastik" | ...
  cashboxName: string;
  moderator: string;   // to'lovni qabul qilgan kassir
  branch: string;      // kassir filiali (izohga qarang: kelishilgan yechim)
  note: string;
  status: string;      // "Faol" | "Kutilmoqda" | "Bekor qilindi"
}

export interface SalaryRow {
  entryId: number;
  date: string;
  time: string;
  employeeName: string;
  position: string;    // "O'qituvchi" | "Moderator" | "Admin"
  branch: string;      // xodimning o'z filiali
  category: string;    // "Hodimga oylik" | "Hodimga avans"
  amount: number;      // musbat
  paymentType: string;
  cashboxName: string;
  issuedBy: string;    // pulni chiqargan kassir
  note: string;
  status: string;
}

/**
 * Oylik/avansdan BOSHQA har qanday chiqim. Xodim ismi bo'lishi ham,
 * bo'lmasligi ham mumkin (ijarada yo'q, o'quvchiga qaytarishda bor).
 */
export interface ExpenseRow {
  entryId: number;
  date: string;
  time: string;
  personName: string;  // yozuvda ko'rsatilgan odam (bo'lmasligi mumkin)
  category: string;    // "Ijara" | "Soliq" | "Printer" | ...
  amount: number;      // musbat
  paymentType: string;
  cashboxName: string;
  issuedBy: string;
  note: string;
  status: string;
}

/**
 * Ko'chirma. HAR BIR ko'chirma IKKI qator beradi — jo'natgan kassada
 * "Chiqim", qabul qilganda "Kirim".
 *
 * `Summa` ustuni DOIM MUSBAT (mappers.ts `Math.abs`), shuning uchun
 * varaqning SUM() i nolga teng emas — u ko'chirilgan pulning IKKI
 * BARAVARINI beradi. Netto uchun `Yo'nalish` ustuni bo'yicha ajratish
 * kerak: Kirim − Chiqim = 0. Har qanday holatda bu varaqni daromad yoki
 * xarajatga qo'shib bo'lmaydi — u pulning qayerdan qayerga o'tgani
 * jurnali, yangi pul emas.
 */
export interface TransferRow {
  entryId: number;
  date: string;
  time: string;
  direction: string;   // "Kirim" | "Chiqim"
  category: string;    // txName — "Ko'chirish: X -> Y"
  amount: number;      // musbat
  paymentType: string;
  cashboxName: string; // qaysi kassaning daftaridagi qator
  moderator: string;
  note: string;
  status: string;
}

export type SyncRow = PaymentRow | SalaryRow | ExpenseRow | TransferRow;

/** Kunlik solishtirish natijasi — `sync_runs` va CRM sahifasi uchun. */
export interface ReconcileReport {
  kind: SyncKind;
  /** Bazadagi shu oqimga tegishli yozuvlar soni. */
  dbCount: number;
  /** Sheet'da topilgan qatorlar soni (sarlavhasiz). */
  sheetCount: number;
  /** Sheet'da umuman yo'q edi — qo'shildi. */
  added: number;
  /** Bor edi, lekin mazmuni farq qilardi — yangilandi. */
  updated: number;
  /** Bir xil ID takrorlangan qatorlar — tozalandi. */
  duplicates: number;
  /** Sheet'da bor, lekin bazada yo'q (qo'lda qo'shilgan) — faqat xabar. */
  orphans: number;
  /**
   * Shu yugurishda tuzatishga ULGURILMAGAN farqlar soni. Vercel'da
   * funksiya vaqti cheklangan, shuning uchun juda katta farq bir necha
   * kunga bo'linadi. 0 dan katta bo'lsa CRM sahifasida ogohlantirish
   * chiqadi.
   */
  remaining: number;
  errors: string[];
}

export interface SyncRunDoc {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  /** "cron" — kunlik jadval, "manual" — CRM sahifasidagi tugma. */
  trigger: "cron" | "manual";
  /** Navbatdan qayta yuborilganlar. */
  flushed: number;
  flushFailed: number;
  reports: ReconcileReport[];
  ok: boolean;
  error: string | null;
}
