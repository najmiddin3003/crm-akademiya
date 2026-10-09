import { computeDebtors } from "@/lib/debtors";
import type { DebtIssue } from "@/lib/debtorsTypes";
import { computeHomeKpis } from "@/lib/homeStats";
import { authorNameOf } from "../context";
import { maskPhone } from "../mask";
import { optDate, optInt, optMonth, type AiTool } from "./types";

// HISOBOTLAR — qarzdorlar va bosh sahifa ko'rsatkichlari.
//
// Ikkalasi ham sahifa bilan BITTA funksiyani chaqiradi (lib/debtors.ts,
// lib/homeStats.ts), ya'ni AI aytgan son sahifadagi son bilan hech
// qachon farq qilmaydi — xodim havolani bosib tekshirsa, o'sha raqamni
// ko'radi.

const ISSUE_TEXT: Record<DebtIssue, string> = {
  price: "course has no monthly price for this branch",
  start: "no start date (neither join date nor group start)",
  schedule: "group lesson days not recognised",
};

export const debtorsReport: AiTool = {
  name: "debtors_report",
  description:
    "Debtor students (qarzdorlar) of the current branch, computed exactly like the 'Qarzdor o'quvchilar' report: " +
    "lessons held by the group schedule × price of one lesson − amount paid, as of a date. " +
    "Returns totals and the biggest debtors; with `month` also expected vs received money for that month.",
  parameters: {
    type: "object",
    properties: {
      asOf: { type: "string", description: "Calculation date YYYY-MM-DD. Default: today." },
      month: { type: "string", description: "Optional month YYYY-MM: how much was expected from students that month and how much came in." },
      limit: { type: "integer", minimum: 1, maximum: 30, description: "How many top debtors to list. Default 10." },
    },
    additionalProperties: false,
  },
  pages: ["/reports-unpaid"],
  async run(ctx, args) {
    const asOf = optDate(args, "asOf") || ctx.today;
    const month = optMonth(args, "month");
    const limit = optInt(args, "limit", 1, 30) ?? 10;

    const r = await computeDebtors(ctx.db, ctx.scope, asOf, month || undefined);
    // Qatorlar qarz bo'yicha kamayish tartibida keladi (lib/debtorsTypes.ts).
    const debtors = r.rows.filter((x) => x.debt > 0);

    return {
      branch: ctx.branchName,
      asOf: r.asOf,
      rule: "debt = lessons held × lesson price − paid; positive means the student owes",
      studentsCounted: r.rows.length,
      debtorsCount: debtors.length,
      totalDebt: debtors.reduce((s, x) => s + x.debt, 0),
      prepaidCount: r.rows.filter((x) => x.debt < 0).length,
      rowsWithIncompleteData: r.rows.filter((x) => x.incomplete).length,
      groupsThatCannotBeCalculated: r.issues.slice(0, 10).map((i) => ({ group: i.group, reason: ISSUE_TEXT[i.issue] })),
      topDebtors: debtors.slice(0, limit).map((d) => ({
        id: d.id,
        name: d.name,
        phone: maskPhone(d.phone),
        debt: d.debt,
        charged: d.charged,
        paid: d.paid,
        groups: d.groups.map((g) => g.group),
        incompleteData: d.incomplete || undefined,
        page: `/student-edit/${d.id}?src=list`,
      })),
      month: r.month ?? undefined,
      page: "/reports-unpaid",
    };
  },
};

export const overview: AiTool = {
  name: "overview",
  description:
    "Key counts of the current branch from the home page: leads, first-lesson sign-ups, new / active / frozen / archived students, " +
    "debtors, groups. Only cards this user may see are returned. A null value means there is NO data source — show '—', never 0.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  // Bosh sahifa hammaga ochiq; har bir karta ichida alohida kesiladi (`can`).
  pages: [],
  async run(ctx) {
    const cards = await computeHomeKpis({ db: ctx.db, scope: ctx.scope, author: authorNameOf(ctx), can: ctx.can });
    return {
      branch: ctx.branchName,
      date: ctx.today,
      cards: cards.map((c) => ({
        label: c.label,
        value: c.value,
        page: c.value === null ? undefined : c.href,
        note: c.note,
      })),
    };
  },
};
