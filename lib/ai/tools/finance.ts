import { nameEq } from "@/lib/currentEmployee";
import { loadPaymentMethods } from "@/lib/paymentMethods";
import { daysInclusive, optDate, optInt, optString, ToolInputError, type AiTool } from "./types";

// MOLIYA — kirim/chiqim jamlanmasi va kassa qoldiqlari.
//
// QAMROV SAHIFALAR BILAN AYNAN BIR XIL — AI bitta raqamni sahifadan
// boshqacha aytmasin va ko'proq ham ko'rsatmasin:
//
//   finance_summary  — Moliya hisobotlari / analitikasi bilan bir xil
//                      manba (`transactions`) va qoidalar
//                      (app/api/transactions/summary): FILIALGA BO'LINMAYDI,
//                      ixtiyoriy ravishda bitta kassa bo'yicha.
//   cashbox_balances — Kassalar sahifasi qoidasi (app/api/cashboxes):
//                      admin — hamma kassa, xodim — faqat o'zi mas'ul
//                      kassa (`moderator` = uning ismi).

const MAX_RANGE_DAYS = 366;
const TOP = 12;

/** Decimal128 → son (yig'indi aniq hisoblangan, bu faqat uzatish uchun). */
function toNum(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(String(v));
}

export const financeSummary: AiTool = {
  name: "finance_summary",
  description:
    "Income and expenses (kirim / chiqim) for a date range, the same numbers as the 'Moliya hisobotlari' page: " +
    "ALL branches together (finance pages are not split by branch), optionally one cashbox. " +
    "Returns totals and a breakdown by transaction category or payment method.",
  parameters: {
    type: "object",
    properties: {
      from: { type: "string", description: "Start date YYYY-MM-DD (inclusive)." },
      to: { type: "string", description: "End date YYYY-MM-DD (inclusive). Range at most 366 days." },
      breakdown: { type: "string", enum: ["category", "method", "none"], description: "Group totals by transaction category (default) or payment method." },
      cashboxId: { type: "integer", description: "Optional: only this cashbox (id from cashbox_balances)." },
    },
    required: ["from", "to"],
    additionalProperties: false,
  },
  // `/api/transactions/summary` ni ishlatadigan sahifalar (lib/apiPermissions.generated.ts).
  pages: ["/finance-reports", "/finance-analytics", "/finance-cashflow", "/finance-flow", "/finance-pnl"],
  async run(ctx, args) {
    const from = optDate(args, "from");
    const to = optDate(args, "to");
    if (!from || !to) throw new ToolInputError('"from" and "to" are required');
    if (from > to) throw new ToolInputError('"from" must not be after "to"');
    if (daysInclusive(from, to) > MAX_RANGE_DAYS) throw new ToolInputError(`range must be at most ${MAX_RANGE_DAYS} days`);
    const breakdown = optString(args, "breakdown", 10) || "category";
    if (!["category", "method", "none"].includes(breakdown)) throw new ToolInputError('"breakdown" must be category, method or none');
    const cashboxId = optInt(args, "cashboxId", 1, 1_000_000);

    const match: Record<string, unknown> = { date: { $gte: from, $lte: to } };
    if (cashboxId !== null) match.cashboxId = cashboxId;

    // Ishora UCH qiymatli va kategoriya XOM guruhlanadi — summary route'idagi
    // qoidalar (izohlari o'sha faylda): aks holda sahifadagi raqamdan farq chiqadi.
    const sign = { $cond: [{ $gt: ["$amount", 0] }, "pos", { $cond: [{ $lt: ["$amount", 0] }, "neg", "zero"] }] };
    const key = breakdown === "category" ? "$category" : breakdown === "method" ? "$method" : null;
    const [rows, cashbox] = await Promise.all([
      ctx.db
        .collection("transactions")
        .aggregate<{ _id: { sign: string; key?: unknown }; amount: unknown; n: number }>([
          { $match: match },
          { $group: { _id: { sign, ...(key ? { key } : {}) }, amount: { $sum: { $toDecimal: "$amount" } }, n: { $sum: 1 } } },
        ])
        .toArray(),
      cashboxId !== null
        ? ctx.db.collection("cashboxes").findOne({ id: cashboxId }, { projection: { _id: 0, name: 1 } })
        : Promise.resolve(null),
    ]);

    let income = 0;
    let expense = 0;
    let count = 0;
    const inc: { name: string; amount: number }[] = [];
    const exp: { name: string; amount: number }[] = [];
    for (const r of rows) {
      const amount = toNum(r.amount);
      count += r.n;
      const name = key ? String(r._id.key ?? "").trim() || "—" : "";
      if (r._id.sign === "pos") {
        income += amount;
        if (key) inc.push({ name, amount });
      } else if (r._id.sign === "neg") {
        expense += -amount;
        if (key) exp.push({ name, amount: -amount });
      }
    }
    const top = (list: { name: string; amount: number }[]) =>
      list.sort((a, b) => b.amount - a.amount).slice(0, TOP).map((x) => ({ ...x, amount: Math.round(x.amount * 100) / 100 }));
    const round = (n: number) => Math.round(n * 100) / 100;

    return {
      scope: cashboxId !== null ? `cashbox: ${cashbox?.name ?? `#${cashboxId}`}` : "all branches (as on the finance report pages)",
      from,
      to,
      transactions: count,
      income: round(income),
      expense: round(expense),
      net: round(income - expense),
      ...(key ? { [`incomeBy_${breakdown}`]: top(inc), [`expenseBy_${breakdown}`]: top(exp) } : {}),
      page: "/finance-reports",
    };
  },
};

export const cashboxBalances: AiTool = {
  name: "cashbox_balances",
  description:
    "Current balances of cashboxes (kassalar) with the split by payment method. " +
    "An administrator sees every cashbox; any other employee only the cashbox they are responsible for.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  pages: ["/finance-cash"],
  async run(ctx) {
    // Kassaga biriktirilmagan xodim hech qanday kassa ko'rmaydi (Kassalar sahifasidagidek).
    if (!ctx.isAdmin && !ctx.employeeName) {
      return { cashboxes: [], note: "No cashbox is assigned to this user.", page: "/finance-cash" };
    }
    const filter = ctx.isAdmin ? {} : { moderator: nameEq(ctx.employeeName) };
    const [rows, methods] = await Promise.all([
      ctx.db
        .collection("cashboxes")
        .find(filter, { projection: { _id: 0, id: 1, name: 1, balance: 1, methodTotals: 1, isPrimary: 1, archived: 1, moderator: 1 } })
        .sort({ id: 1 })
        .toArray(),
      loadPaymentMethods(ctx.db),
    ]);
    const methodName = new Map(methods.map((m) => [m.key, m.name]));
    const active = rows.filter((c) => !c.archived);

    return {
      scope: ctx.isAdmin ? "all cashboxes (administrator)" : "cashboxes this user is responsible for",
      cashboxes: active.map((c) => ({
        id: c.id,
        name: c.name,
        mainCashbox: c.isPrimary === true || undefined,
        responsible: c.moderator || "—",
        balance: Number(c.balance) || 0,
        byMethod: Object.entries((c.methodTotals ?? {}) as Record<string, unknown>)
          .map(([k, v]) => ({ method: methodName.get(k) ?? k, amount: Number(v) || 0 }))
          .filter((x) => x.amount !== 0),
      })),
      archivedCashboxes: rows.length - active.length || undefined,
      total: active.reduce((s, c) => s + (Number(c.balance) || 0), 0),
      page: "/finance-cash",
    };
  },
};
