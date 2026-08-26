import type { TransactionEntry } from "@/lib/transactionEntries";
import type { SheetCell } from "@/lib/sync/googleSheets";
import type { PaymentRow, SalaryRow, SyncKind } from "@/lib/sync/types";
import { esc } from "@/lib/sync/telegram";
import { positionLabel, type SyncContext } from "@/lib/sync/lookups";

// Baza yozuvini Google Sheets qatoriga va Telegram xabariga aylantirish.

// ───────────────────────── Tasnif ─────────────────────────

/**
 * Yozuv qaysi oqimga tegishli. `null` — hech qayerga yuborilmaydi.
 *
 *   payIn                        -> "payment" (kassaga tushgan pul)
 *   payOut + avans/oylik         -> "salary"  (xodimga chiqarilgan pul)
 *   payOut (ijara, kommunal, …)  -> null      (kelishuvda yo'q)
 *   transfer                     -> null      (kassalar orasida ko'chirish,
 *                                              yangi pul emas)
 */
export function classifyEntry(entry: Pick<TransactionEntry, "txType" | "txName">): SyncKind | null {
  if (entry.txType === "payIn") return "payment";
  if (entry.txType === "payOut" && /avans|oylik/i.test(String(entry.txName ?? ""))) return "salary";
  return null;
}

/** Mongo filtri — tasnif bilan BIR XIL qoida. Solishtirish shundan foydalanadi. */
export function kindFilter(kind: SyncKind): Record<string, unknown> {
  return kind === "payment"
    ? { txType: "payIn" }
    : { txType: "payOut", txName: { $regex: "avans|oylik", $options: "i" } };
}

// ───────────────────────── Formatlash ─────────────────────────

/** "2026-08-26" -> "26.08.2026". Sana jadvalga MATN bo'lib yoziladi. */
export function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "").trim());
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso ?? "");
}

/** 500000 -> "500 000". Telegram xabari uchun (jadvalda xom son turadi). */
export function fmtMoney(n: number): string {
  return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
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

export function headersFor(kind: SyncKind): string[] {
  return kind === "payment" ? PAYMENT_HEADERS : SALARY_HEADERS;
}

const STATUS_ACTIVE = "Faol";
const STATUS_CANCELLED = "Bekor qilindi";

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
    cancelled: entry.status === "cancelled",
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
    cancelled: entry.status === "cancelled",
  };
}

// ───────────────────────── Qator ma'lumoti -> katakchalar ─────────────────────────

export function paymentCells(r: PaymentRow): SheetCell[] {
  return [
    r.entryId,
    fmtDate(r.date),
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
    r.cancelled ? STATUS_CANCELLED : STATUS_ACTIVE,
    nowStamp(),
  ];
}

export function salaryCells(r: SalaryRow): SheetCell[] {
  return [
    r.entryId,
    fmtDate(r.date),
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
    r.cancelled ? STATUS_CANCELLED : STATUS_ACTIVE,
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
