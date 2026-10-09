import { withPupilBranch } from "@/lib/branchScope";
import { nameEq } from "@/lib/currentEmployee";
import { pupilEntryMatch, pupilNameOfDoc } from "@/lib/pupilEntries";
import { daysInclusive, optDate, optInt, optString, ToolInputError, type AiTool } from "./types";

// TO'LOVLAR RO'YXATI — Moliya → Tranzaksiyalar jurnali (`transaction_entries`,
// 5-bosqich, 08.10.2026). "Bugun kim to'lov qildi?", "shu hafta qaysi
// chiqimlar bo'ldi?" kabi savollar uchun: finance_summary faqat jamini
// beradi, bu esa qatorlarni (kim, qancha, qaysi to'lov turi, qaysi kassa,
// kim qabul qildi).
//
// QAMROV: Tranzaksiyalar sahifasi ruxsati (yoki admin) — butun jurnal
// (sahifa filialga bo'linmaydi). Faqat Kassalar ruxsati bo'lsa — FAQAT
// xodim mas'ul kassa(lar) yozuvlari (Kassalar sahifasida ham faqat o'z
// kassasini ko'radi). Bekor qilingan yozuvlar sukut bo'yicha chiqmaydi
// (summaga qo'shilmaydi — Tranzaksiyalar route'idagi qoida).

const MAX_RANGE_DAYS = 92;
const DEFAULT_ROWS = 100;
const MAX_ROWS = 150;

const TX_TYPES = { kirim: "payIn", chiqim: "payOut", kochirish: "transfer" } as const;
type TypeKey = keyof typeof TX_TYPES | "all";

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const contains = (v: string) => ({ $regex: escapeRx(v), $options: "i" });

/**
 * Jamiga faqat QABUL QILINGAN qatorlar — /api/transaction-entries?withTotals=1
 * (Kassalar jadvali osti) bilan bir xil qoida: "waiting" — tasdiq kutayotgan
 * ko'chirma (pul hali jo'natuvchi kassada, deductedOnSend:false), "cancelled" —
 * bekor qilingan. Kirim va chiqim ALOHIDA (chiqim musbat) — bitta ishorali
 * yig'indida ko'chirmaning ikki oyog'i (−X va +X) bir-birini 0 qilardi.
 */
const ACCEPTED = { $not: [{ $in: [{ $ifNull: ["$status", ""] }, ["waiting", "cancelled"]] }] };
const WAITING = { $eq: [{ $ifNull: ["$status", ""] }, "waiting"] };
const SUMS = {
  income: { $sum: { $cond: [{ $and: [{ $gt: ["$amount", 0] }, ACCEPTED] }, "$amount", 0] } },
  expense: { $sum: { $cond: [{ $and: [{ $lt: ["$amount", 0] }, ACCEPTED] }, { $abs: "$amount" }, 0] } },
  counted: { $sum: { $cond: [ACCEPTED, 1, 0] } },
} as const;

const money = (n: number) => Math.round(n * 100) / 100;

/** "4 500 000" — panel yozuvi uchun. */
function groupDigits(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export const paymentsList: AiTool = {
  name: "payments_list",
  description:
    "List cash journal entries (Moliya → Tranzaksiyalar): who paid or was paid, amount, payment method, category, cashbox, date/time and " +
    "who recorded it. Default: TODAY's incoming payments (kirim), cancelled ones excluded. Use it for questions like 'who paid today', " +
    "'payments of this student', 'expenses this week', 'transfers between cashboxes'. Covers all cashboxes the user may see (the journal " +
    "is not split by branch). Returns totals — income and expense separately, only ACCEPTED entries (transfers still waiting for the " +
    "receiver are listed but not counted, see awaitingAcceptance), with a split by payment method — and up to 150 rows, newest first. " +
    "Row amounts of chiqim are negative. For ONE student's payments pass pupilId (from search_pupils): the name filter also matches " +
    "other students with the same name.",
  parameters: {
    type: "object",
    properties: {
      from: { type: "string", description: "Start date YYYY-MM-DD (default today)." },
      to: { type: "string", description: "End date YYYY-MM-DD (default = from). At most 92 days." },
      type: { type: "string", enum: ["kirim", "chiqim", "kochirish", "all"], description: "kirim = incoming payments (default), chiqim = expenses and payouts, kochirish = transfers, all = everything." },
      pupilId: { type: "integer", description: "Only this student's entries (id from search_pupils / pupil_details) — namesakes are not mixed in." },
      pupil: { type: "string", description: "Only entries whose student / person name contains this text (may include namesakes)." },
      method: { type: "string", description: "Payment method name, e.g. Naqd, Plastik." },
      category: { type: "string", description: "Category (transaction type) name contains, e.g. Kurs to'lovi." },
      cashboxId: { type: "integer", description: "Only this cashbox (ids from cashbox_balances)." },
      teacher: { type: "string", description: "Only payments of this teacher's students." },
      recordedBy: { type: "string", description: "Only entries recorded by this cashier." },
      includeCancelled: { type: "boolean", description: "Also show cancelled entries (not counted in totals)." },
      limit: { type: "integer", description: `Max rows (default ${DEFAULT_ROWS}, at most ${MAX_ROWS}).` },
    },
    additionalProperties: false,
  },
  pages: ["/finance-transactions", "/finance-cash"],
  async run(ctx, args) {
    const from = optDate(args, "from") || ctx.today;
    const to = optDate(args, "to") || from;
    if (from > to) throw new ToolInputError('"from" must not be after "to"');
    if (daysInclusive(from, to) > MAX_RANGE_DAYS) throw new ToolInputError(`range must be at most ${MAX_RANGE_DAYS} days`);
    const type = (optString(args, "type", 10) || "kirim") as TypeKey;
    if (type !== "all" && !(type in TX_TYPES)) throw new ToolInputError('"type" must be kirim, chiqim, kochirish or all');
    const limit = optInt(args, "limit", 1, MAX_ROWS) ?? DEFAULT_ROWS;
    const cashboxId = optInt(args, "cashboxId", 1, 1_000_000_000);
    const includeCancelled = args.includeCancelled === true;

    // Qaysi kassalar: to'liq jurnal yoki faqat o'z kassasi.
    const fullJournal = ctx.isAdmin || ctx.can("/finance-transactions");
    let allowedBoxes: number[] | null = null;
    if (!fullJournal) {
      if (!ctx.employeeName) return { entries: [], note: "No cashbox is assigned to this user.", page: "/finance-cash" };
      const own = await ctx.db
        .collection("cashboxes")
        .find({ moderator: nameEq(ctx.employeeName) }, { projection: { _id: 0, id: 1 } })
        .toArray();
      allowedBoxes = own.map((c) => Number(c.id));
      if (allowedBoxes.length === 0) return { entries: [], note: "No cashbox is assigned to this user.", page: "/finance-cash" };
      if (cashboxId !== null && !allowedBoxes.includes(cashboxId)) {
        return { error: "This user may only see the journal of their own cashbox.", page: "/finance-cash" };
      }
    }

    const match: Record<string, unknown> = { date: { $gte: from, $lte: to } };
    if (type !== "all") match.txType = TX_TYPES[type];
    if (!includeCancelled) match.status = { $ne: "cancelled" };
    // BITTA o'quvchi — pupilId bo'yicha (lib/pupilEntries.ts → pupilEntryMatch:
    // belgilangan yozuv faqat egasida, eski belgisiz yozuv ism bo'yicha), xuddi
    // pupil_details va profildagi tarix kabi. Ism filtri ismdoshlarni ham oladi.
    const pupilId = optInt(args, "pupilId", 1, 1_000_000_000);
    let pupilName: string | undefined;
    if (pupilId !== null) {
      const doc = await ctx.db
        .collection("pupils")
        .findOne(withPupilBranch({ id: pupilId }, ctx.scope), { projection: { _id: 0, firstName: 1, lastName: 1 } });
      if (!doc) return { error: "No student with this pupilId in the current branch. Use search_pupils first." };
      pupilName = pupilNameOfDoc(doc);
      match.$and = [pupilEntryMatch({ id: pupilId, name: pupilName })];
    }
    const pupil = optString(args, "pupil", 80);
    if (pupil && pupilId === null) match.studentName = contains(pupil);
    const method = optString(args, "method", 40);
    if (method) match.paymentType = contains(method);
    const category = optString(args, "category", 80);
    if (category) match.txName = contains(category);
    const teacher = optString(args, "teacher", 80);
    if (teacher) match.teacherName = contains(teacher);
    const recordedBy = optString(args, "recordedBy", 80);
    if (recordedBy) match.moderator = contains(recordedBy);
    if (cashboxId !== null) match.cashboxId = cashboxId;
    else if (allowedBoxes) match.cashboxId = { $in: allowedBoxes };

    const col = ctx.db.collection("transaction_entries");
    type Sums = { income: number; expense: number; counted: number };
    const [count, totals, byMethod, rows, boxes] = await Promise.all([
      col.countDocuments(match),
      col
        .aggregate<Sums & { waitingN: number; waitingOut: number; waitingIn: number }>([
          { $match: match },
          {
            $group: {
              _id: null,
              ...SUMS,
              waitingN: { $sum: { $cond: [WAITING, 1, 0] } },
              // Ko'chirmaning ikki oyog'i alohida: jo'natilgan (−) va kelayotgan (+).
              waitingOut: { $sum: { $cond: [{ $and: [WAITING, { $lt: ["$amount", 0] }] }, { $abs: "$amount" }, 0] } },
              waitingIn: { $sum: { $cond: [{ $and: [WAITING, { $gt: ["$amount", 0] }] }, "$amount", 0] } },
            },
          },
        ])
        .toArray(),
      col
        .aggregate<Sums & { _id: unknown }>([
          { $match: match },
          { $group: { _id: "$paymentType", ...SUMS } },
          { $match: { counted: { $gt: 0 } } },
          { $sort: { income: -1, expense: -1 } },
        ])
        .toArray(),
      col
        .find(match, {
          projection: {
            _id: 0,
            id: 1,
            date: 1,
            time: 1,
            studentName: 1,
            amount: 1,
            paymentType: 1,
            txName: 1,
            txType: 1,
            cashboxId: 1,
            group: 1,
            teacherName: 1,
            moderator: 1,
            status: 1,
            note: 1,
            periodMonth: 1,
            pupilId: 1,
          },
        })
        .sort({ date: -1, time: -1, id: -1 })
        .limit(limit)
        .toArray(),
      ctx.db.collection("cashboxes").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
    ]);
    const boxName = new Map(boxes.map((b) => [Number(b.id), String(b.name ?? "")]));
    const t = totals[0];
    const income = money(t?.income ?? 0);
    const expense = money(t?.expense ?? 0);
    const waitingN = t?.waitingN ?? 0;

    return {
      scope: fullJournal ? "all cashboxes (as on the Tranzaksiyalar page)" : "only the cashbox(es) this user is responsible for",
      from,
      to,
      type,
      ...(pupilId !== null ? { student: pupilName, pupilId } : {}),
      entries: count,
      countedInTotal: t?.counted ?? 0,
      totalsRule: "only accepted entries; income and expense separately (expense as a positive number)",
      income,
      expense,
      net: money(income - expense),
      ...(waitingN
        ? {
            awaitingAcceptance: {
              entries: waitingN,
              sentNotAccepted: money(t?.waitingOut ?? 0),
              incomingNotAccepted: money(t?.waitingIn ?? 0),
              note: "transfers not yet accepted by the receiver — the money is still in the sending cashbox; not counted in the totals",
            },
          }
        : {}),
      byMethod: byMethod.map((m) => ({
        method: String(m._id ?? "").trim() || "—",
        income: money(m.income),
        expense: money(m.expense),
        entries: m.counted,
      })),
      rows: rows.map((r) => ({
        id: r.id,
        date: r.date,
        time: r.time || undefined,
        person: r.studentName || "—",
        pupilId: typeof r.pupilId === "number" ? r.pupilId : undefined,
        amount: r.amount,
        method: r.paymentType || undefined,
        category: r.txName || undefined,
        type: type === "all" ? r.txType : undefined,
        cashbox: boxName.get(Number(r.cashboxId)) || (r.cashboxId ? `#${r.cashboxId}` : undefined),
        group: r.group || undefined,
        teacher: r.teacherName || undefined,
        recordedBy: r.moderator || undefined,
        forMonth: r.periodMonth || undefined,
        status: r.status === "cancelled" ? "cancelled" : r.status === "waiting" ? "waiting for acceptance" : undefined,
        note: r.note ? String(r.note).slice(0, 120) : undefined,
      })),
      moreRows: count > rows.length ? count - rows.length : undefined,
      page: ctx.can("/finance-transactions") ? "/finance-transactions" : "/finance-cash",
      _ui: {
        note:
          type === "kirim"
            ? `${count} ta yozuv · ${groupDigits(income)} so'm`
            : type === "chiqim"
              ? `${count} ta yozuv · ${groupDigits(expense)} so'm`
              : `${count} ta yozuv · kirim ${groupDigits(income)} · chiqim ${groupDigits(expense)} so'm`,
      },
    };
  },
};
