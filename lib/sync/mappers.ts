import type { TransactionEntry } from "@/lib/transactionEntries";
import type { SheetCell } from "@/lib/sync/googleSheets";
import type { ExpenseRow, PaymentRow, SalaryRow, SyncKind, TransferRow } from "@/lib/sync/types";
import { esc } from "@/lib/sync/telegram";
import { positionLabel, type SyncContext } from "@/lib/sync/lookups";

// Baza yozuvini Google Sheets qatoriga va Telegram xabariga aylantirish.

// ───────────────────────── Tasnif ─────────────────────────

const SALARY_RE = /avans|oylik/i;

/**
 * Yozuv qaysi oqimga tegishli. `null` — hech qayerga yuborilmaydi.
 *
 *   payIn                        -> "payment"  (kassaga tushgan pul)
 *   payOut + avans/oylik         -> "salary"   (xodimga chiqarilgan pul)
 *   payOut (ijara, kommunal, …)  -> "expense"  (qolgan barcha chiqim)
 *   transfer                     -> "transfer" (kassalar orasida yoki
 *                                               kassa ichida ko'chirish)
 *
 * `null` faqat kutilmagan `txType` uchun qoladi — bunday yozuv jimgina
 * tashlab ketiladi, chunki uni qaysi varaqqa yozishni bilmaymiz.
 */
export function classifyEntry(entry: Pick<TransactionEntry, "txType" | "txName">): SyncKind | null {
  if (entry.txType === "payIn") return "payment";
  if (entry.txType === "payOut") {
    return SALARY_RE.test(String(entry.txName ?? "")) ? "salary" : "expense";
  }
  if (entry.txType === "transfer") return "transfer";
  return null;
}

/**
 * Mongo filtri — tasnif bilan BIR XIL qoida bo'lishi SHART, aks holda
 * solishtirish varaqqa noto'g'ri to'plamni yozadi. To'rt filtr kesishmaydi
 * va birgalikda `transaction_entries` ni to'liq qoplaydi
 * (kutilmagan `txType` dan boshqasini).
 */
export function kindFilter(kind: SyncKind): Record<string, unknown> {
  switch (kind) {
    case "payment":
      return { txType: "payIn" };
    case "salary":
      return { txType: "payOut", txName: { $regex: "avans|oylik", $options: "i" } };
    case "expense":
      // `$not` + RegExp — "salary" filtrining aniq teskarisi. Matnli
      // `$regex` bilan `$not` ishlamaydi, shuning uchun RegExp literal.
      return { txType: "payOut", txName: { $not: /avans|oylik/i } };
    case "transfer":
      return { txType: "transfer" };
  }
}

// ───────────────────────── Formatlash ─────────────────────────

/** "2026-08-26" -> "26.08.2026". TELEGRAM xabari uchun — matn. */
export function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "").trim());
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso ?? "");
}

// ── SANA JADVALGA QANDAY YOZILADI ────────────────────────────────────
// Google Sheets sanani SON bo'lib saqlaydi: 1899-12-30 dan beri o'tgan
// kunlar soni. Ko'rinishini ustunning formati hal qiladi.
//
// Ilgari bu yerga "26.08.2026" degan MATN yozilardi va jadval uni sana
// deb bilmasdi: saralaganda 01.02.2026 03.10.2025 dan oldin turardi
// (harfma-harf taqqoslash), sana bo'yicha filtr va pivot ishlamasdi.
//
// MUHIM: son yozish solishtirishni BUZMAYDI. Modul jadvalni
// UNFORMATTED_VALUE bilan o'qiydi (googleSheets.ts readRows), ya'ni
// katakdan xuddi shu son qaytadi va `signatureOf` ikkalasini teng deb
// topadi. Matn yozilganda ham shunday edi — turi o'zgardi, xolos.
const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" -> Sheets sana seriyasi. Format buzuq bo'lsa matn qaytadi. */
export function dateSerial(iso: string): number | string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "").trim());
  if (!m) return String(iso ?? "");
  return Math.round((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - SHEETS_EPOCH_MS) / DAY_MS);
}

/** 500000 -> "500 000". Telegram xabari uchun (jadvalda xom son turadi). */
export function fmtMoney(n: number): string {
  return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * "Yangilangan" ustuni — hozirgi lahza, Sheets seriyasi bo'lib.
 *
 * Toshkent vaqtiga QO'LDA o'tkaziladi (+5, yil bo'yi o'zgarmaydi):
 * ilgari `new Date()` ning lokal getterlari ishlatilardi, ya'ni Vercel'da
 * UTC chiqib, jadvalda 5 soat orqada ko'rinardi.
 *
 * Bu ustun `signatureOf` ga KIRMAYDI (oxirgi ustun tashlab ketiladi),
 * shuning uchun har yozishda o'zgarishi solishtirishga ta'sir qilmaydi.
 */
function nowStamp(): number {
  return (Date.now() + 5 * 3_600_000 - SHEETS_EPOCH_MS) / DAY_MS;
}

const DASH = "—";
const cell = (v: string): string => (v.trim() ? v.trim() : DASH);

// ───────────────────────── Sheet sarlavhalari ─────────────────────────

export const PAYMENT_HEADERS = [
  "ID", "Sana", "Vaqt", "O'quvchi", "Guruh", "Ustoz", "Turi", "Summa",
  "To'lov usuli", "Kassa", "Qabul qilgan", "Filial", "Izoh", "Status", "Yangilangan",
];

export const SALARY_HEADERS = [
  "ID", "Sana", "Vaqt", "Xodim", "Lavozim", "Filial", "Turi", "Summa",
  "To'lov usuli", "Kassa", "Chiqargan", "Izoh", "Status", "Yangilangan",
];

export const EXPENSE_HEADERS = [
  "ID", "Sana", "Vaqt", "Kim", "Turi", "Summa",
  "To'lov usuli", "Kassa", "Chiqargan", "Izoh", "Status", "Yangilangan",
];

export const TRANSFER_HEADERS = [
  "ID", "Sana", "Vaqt", "Yo'nalish", "Ko'chirish", "Summa",
  "To'lov usuli", "Kassa", "Moderator", "Izoh", "Status", "Yangilangan",
];

export function headersFor(kind: SyncKind): string[] {
  switch (kind) {
    case "payment": return PAYMENT_HEADERS;
    case "salary": return SALARY_HEADERS;
    case "expense": return EXPENSE_HEADERS;
    case "transfer": return TRANSFER_HEADERS;
  }
}

const STATUS_ACTIVE = "Faol";
const STATUS_CANCELLED = "Bekor qilindi";
const STATUS_WAITING = "Kutilmoqda";

/**
 * Yozuv holati. Ilgari faqat "bekor qilinganmi" tekshirilardi va
 * KUTILAYOTGAN ko'chirma jadvalda "Faol" bo'lib ko'rinardi — ya'ni hali
 * qabul qilinmagan pul amalga oshgandek. Ko'chirmalar varag'i qo'shilgach
 * bu holat ommaviy bo'ldi (import qilingan tarixda 24 ta kutilayotgan
 * ko'chirma bor), shuning uchun alohida yorliq kerak.
 */
function statusLabel(status: unknown): string {
  const s = String(status ?? "").trim();
  if (s === "cancelled") return STATUS_CANCELLED;
  if (s === "waiting") return STATUS_WAITING;
  return STATUS_ACTIVE;
}

// ───────────────────────── Yozuv -> qator ma'lumoti ─────────────────────────

export async function toPaymentRow(entry: TransactionEntry, ctx: SyncContext): Promise<PaymentRow> {
  const studentName = String(entry.studentName ?? "").trim();
  return {
    entryId: entry.id,
    date: String(entry.date ?? ""),
    time: String(entry.time ?? ""),
    studentName,
    // Yozuvda guruh ko'rsatilgan bo'lsa o'sha ishlatiladi, aks holda
    // o'quvchining guruhi topiladi (kassa oynasi guruhni to'ldirmaydi).
    groupName: String(entry.group ?? "").trim() || (await ctx.groupOfStudent(studentName)),
    teacherName: String(entry.teacherName ?? "").trim(),
    category: String(entry.txName ?? "").trim(),
    amount: Math.abs(Number(entry.amount) || 0),
    paymentType: String(entry.paymentType ?? "").trim(),
    cashboxName: await ctx.cashboxName(entry.cashboxId),
    moderator: String(entry.moderator ?? "").trim(),
    branch: await ctx.branchOfPayment(String(entry.moderator ?? "")),
    note: String(entry.note ?? "").trim(),
    status: statusLabel(entry.status),
  };
}

export async function toSalaryRow(entry: TransactionEntry, ctx: SyncContext): Promise<SalaryRow> {
  // Chiqim yozuvida XODIM ISMI `studentName` maydonida turadi
  // (app/api/cashboxes/[id]/adjust/route.ts) — bu g'alati ko'rinadi,
  // lekin bazadagi mavjud kelishuv shunday.
  const employeeName = String(entry.studentName ?? "").trim();
  const info = await ctx.employeeInfo(employeeName);
  return {
    entryId: entry.id,
    date: String(entry.date ?? ""),
    time: String(entry.time ?? ""),
    employeeName,
    position: positionLabel(info?.turi ?? ""),
    branch: info?.filial ?? "",
    category: String(entry.txName ?? "").trim(),
    amount: Math.abs(Number(entry.amount) || 0),
    paymentType: String(entry.paymentType ?? "").trim(),
    cashboxName: await ctx.cashboxName(entry.cashboxId),
    issuedBy: String(entry.moderator ?? "").trim(),
    note: String(entry.note ?? "").trim(),
    status: statusLabel(entry.status),
  };
}

/**
 * Oylik/avansdan boshqa chiqim. `ctx` KERAK EMAS: bu yerda xodim
 * lavozimi ham, o'quvchi guruhi ham qidirilmaydi — chiqim ko'pincha
 * odamga umuman bog'liq emas (ijara, soliq, printer). Faqat kassa nomi
 * kerak, u ham arzon (lookups ichida keshlangan).
 */
export async function toExpenseRow(entry: TransactionEntry, ctx: SyncContext): Promise<ExpenseRow> {
  return {
    entryId: entry.id,
    date: String(entry.date ?? ""),
    time: String(entry.time ?? ""),
    // Chiqim yozuvida odam ismi `studentName` da turadi — oylik bilan
    // bir xil kelishuv (toSalaryRow izohiga qarang).
    personName: String(entry.studentName ?? "").trim(),
    category: String(entry.txName ?? "").trim(),
    amount: Math.abs(Number(entry.amount) || 0),
    paymentType: String(entry.paymentType ?? "").trim(),
    cashboxName: await ctx.cashboxName(entry.cashboxId),
    issuedBy: String(entry.moderator ?? "").trim(),
    note: String(entry.note ?? "").trim(),
    status: statusLabel(entry.status),
  };
}

/**
 * Ko'chirma. Yo'nalish summaning ISHORASIDAN olinadi: manfiy — pul shu
 * kassadan chiqdi, musbat — kirdi. Nomi (`txName`) qayerdan qayerga
 * ketganini aytadi, lekin qator QAYSI kassaning daftarida turganini
 * faqat ishora ko'rsatadi.
 */
export async function toTransferRow(entry: TransactionEntry, ctx: SyncContext): Promise<TransferRow> {
  const amount = Number(entry.amount) || 0;
  return {
    entryId: entry.id,
    date: String(entry.date ?? ""),
    time: String(entry.time ?? ""),
    direction: amount < 0 ? "Chiqim" : "Kirim",
    category: String(entry.txName ?? "").trim(),
    amount: Math.abs(amount),
    paymentType: String(entry.paymentType ?? "").trim(),
    cashboxName: await ctx.cashboxName(entry.cashboxId),
    moderator: String(entry.moderator ?? "").trim(),
    note: String(entry.note ?? "").trim(),
    status: statusLabel(entry.status),
  };
}

// ───────────────────────── Qator ma'lumoti -> katakchalar ─────────────────────────

export function paymentCells(r: PaymentRow): SheetCell[] {
  return [
    r.entryId,
    dateSerial(r.date),
    cell(r.time),
    cell(r.studentName),
    cell(r.groupName),
    cell(r.teacherName),
    cell(r.category),
    r.amount, // xom son — jadvalda SUM() ishlashi uchun
    cell(r.paymentType),
    cell(r.cashboxName),
    cell(r.moderator),
    cell(r.branch),
    cell(r.note),
    r.status,
    nowStamp(),
  ];
}

export function salaryCells(r: SalaryRow): SheetCell[] {
  return [
    r.entryId,
    dateSerial(r.date),
    cell(r.time),
    cell(r.employeeName),
    cell(r.position),
    cell(r.branch),
    cell(r.category),
    r.amount,
    cell(r.paymentType),
    cell(r.cashboxName),
    cell(r.issuedBy),
    cell(r.note),
    r.status,
    nowStamp(),
  ];
}

export function expenseCells(r: ExpenseRow): SheetCell[] {
  return [
    r.entryId,
    dateSerial(r.date),
    cell(r.time),
    cell(r.personName),
    cell(r.category),
    r.amount,
    cell(r.paymentType),
    cell(r.cashboxName),
    cell(r.issuedBy),
    cell(r.note),
    r.status,
    nowStamp(),
  ];
}

export function transferCells(r: TransferRow): SheetCell[] {
  return [
    r.entryId,
    dateSerial(r.date),
    cell(r.time),
    r.direction,
    cell(r.category),
    r.amount,
    cell(r.paymentType),
    cell(r.cashboxName),
    cell(r.moderator),
    cell(r.note),
    r.status,
    nowStamp(),
  ];
}

/**
 * Ikki qatorni solishtirish uchun "barmoq izi" — OXIRGI ustun
 * ("Yangilangan") hisobga olinmaydi, chunki u har yozishda joriy
 * vaqtga o'zgaradi. Agar solishtirishga kirsa, har kunlik tekshiruvda
 * BARCHA qatorlar "farq qilyapti" deb topilib, minglab bekorchi yozuv
 * ketardi va Google limitiga urilardik.
 *
 * `columnCount` MAJBURIY, chunki Google qaytargan qator uzunligi bizniki
 * bilan bir xil bo'lmasligi mumkin:
 *   • oxiridagi bo'sh kataklar tashlab yuboriladi (qator kaltaroq),
 *   • kimdir P, Q… ustunlarga qo'lda nimadir yozsa (qator uzunroq).
 * Ikkala holatda ham oddiy slice(0, -1) NOTO'G'RI ustunni kesib, qator
 * abadiy "o'zgargan" bo'lib ko'rinardi va har kuni bekorga qayta
 * yozilaverardi.
 *
 * Ajratgich (U+0001 — matnda hech qachon uchramaydigan belgi) ham shart:
 * ajratgichsiz ["ab","c"] va ["a","bc"] bir xil satr berardi, ya'ni
 * haqiqiy farq sezilmay qolardi.
 */
const SEP = "\u0001";

export function signatureOf(cells: SheetCell[], columnCount: number): string {
  const upto = Math.max(columnCount - 1, 0);
  const parts: string[] = [];
  for (let i = 0; i < upto; i += 1) {
    const c = cells[i];
    parts.push(typeof c === "number" ? String(c) : String(c ?? "").trim());
  }
  return parts.join(SEP);
}

// ───────────────────────── Telegram xabarlari ─────────────────────────

export function paymentMessage(r: PaymentRow): string {
  const lines = [
    `💰 <b>Yangi to'lov</b> <code>#${r.entryId}</code>`,
    "",
    `👤 <b>${esc(r.studentName || DASH)}</b>`,
  ];
  if (r.groupName) lines.push(`👥 ${esc(r.groupName)}`);
  if (r.teacherName) lines.push(`🧑‍🏫 Ustoz: ${esc(r.teacherName)}`);
  lines.push(`💵 <b>${fmtMoney(r.amount)} so'm</b> · ${esc(r.paymentType || DASH)}`);
  if (r.category) lines.push(`📋 ${esc(r.category)}`);
  lines.push(`🏦 ${esc(r.cashboxName)}${r.branch ? ` · ${esc(r.branch)}` : ""}`);
  if (r.moderator) lines.push(`✅ Qabul qildi: ${esc(r.moderator)}`);
  if (r.note) lines.push(`📝 ${esc(r.note)}`);
  lines.push(`🕐 ${fmtDate(r.date)} ${esc(r.time)}`);
  return lines.join("\n");
}

export function salaryMessage(r: SalaryRow): string {
  const lines = [
    `🧾 <b>Xodimga to'lov</b> <code>#${r.entryId}</code>`,
    "",
    `👤 <b>${esc(r.employeeName || DASH)}</b>${r.position && r.position !== DASH ? ` — ${esc(r.position)}` : ""}`,
  ];
  if (r.branch) lines.push(`🏢 ${esc(r.branch)}`);
  lines.push(`📋 ${esc(r.category || DASH)}`);
  lines.push(`💵 <b>${fmtMoney(r.amount)} so'm</b> · ${esc(r.paymentType || DASH)}`);
  lines.push(`🏦 ${esc(r.cashboxName)}`);
  if (r.issuedBy) lines.push(`✅ Chiqardi: ${esc(r.issuedBy)}`);
  if (r.note) lines.push(`📝 ${esc(r.note)}`);
  lines.push(`🕐 ${fmtDate(r.date)} ${esc(r.time)}`);
  return lines.join("\n");
}

/**
 * Bekor qilish xabari — ALOHIDA yangi xabar sifatida ketadi (eski xabar
 * tahrirlanmaydi). Sabab: guruhdagi odam eski xabarni qayta o'qimaydi,
 * shuning uchun tuzatish ko'rinadigan joyda — oxirgi xabar bo'lib
 * turishi kerak.
 */
export function cancelMessage(kind: SyncKind, r: PaymentRow | SalaryRow): string {
  const who = kind === "payment" ? (r as PaymentRow).studentName : (r as SalaryRow).employeeName;
  return [
    `⚠️ <b>BEKOR QILINDI</b> <code>#${r.entryId}</code>`,
    "",
    `👤 ${esc(who || DASH)}`,
    `💵 <s>${fmtMoney(r.amount)} so'm</s>`,
    `📋 ${esc(r.category || DASH)}`,
    `🕐 Asl yozuv: ${fmtDate(r.date)} ${esc(r.time)}`,
  ].join("\n");
}
