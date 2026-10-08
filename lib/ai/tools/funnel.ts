import { withLeadScope } from "@/lib/leadScope";
import type { Order } from "@/lib/ordersData";
import { buildFunnelReport, buildFunnelSteps, buildStageSummary } from "@/lib/salesFunnel";
import { authorNameOf } from "../context";
import { leadCreatedIso } from "./leads";
import { optDate, optString, ToolInputError, type AiTool } from "./types";

// SOTUV VORONKASI — Hisobotlar → Sotuv voronkasi (/reports-funnel) bilan
// BIR XIL: o'sha buyurtmalar (`withLeadScope` — joriy filial + xodim o'zi
// qo'shgan lidlar, /api/orders) va o'sha hisob (lib/salesFunnel.ts).
// Vosita o'zi hisoblamaydi — sahifadagi funksiyalarni chaqiradi.
//
// Qo'shimchasi — MANBALAR KESIMI: har manba uchun o'sha voronka qadamlari
// (sahifada manba filtri bilan bittalab ko'riladigan raqamlar).

const TOP = 8;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Aniq nom (katta-kichik harfsiz), bo'lmasa YAGONA qisman moslik — taxmin yo'q. */
function pickValue(options: readonly string[], wanted: string): string | null {
  const w = wanted.trim().toLowerCase();
  const exact = options.filter((o) => o.toLowerCase() === w);
  if (exact.length === 1) return exact[0];
  const partial = options.filter((o) => o.toLowerCase().includes(w));
  return partial.length === 1 ? partial[0] : null;
}

const valuesOf = (orders: readonly Order[], pick: (o: Order) => unknown) =>
  [...new Set(orders.map((o) => String(pick(o) ?? "").trim()).filter(Boolean))].sort();

/** Sof hisob (sinov shu orqali). */
export function funnelSummary(orders: Order[]) {
  const steps = buildFunnelSteps(buildFunnelReport(orders));
  const stepOf = (subset: Order[]) => {
    const s = buildFunnelSteps(buildFunnelReport(subset));
    return { leads: s[0].count, trialBooked: s[1].count, cameToTrial: s[2].count, firstPayment: s[3].count, paidPercent: r1(s[3].percent) };
  };
  const groupBy = (key: (o: Order) => unknown) => {
    const m = new Map<string, Order[]>();
    for (const o of orders) {
      const k = String(key(o) ?? "").trim() || "—";
      const list = m.get(k);
      if (list) list.push(o);
      else m.set(k, [o]);
    }
    return [...m].sort((a, b) => b[1].length - a[1].length).slice(0, TOP);
  };
  return {
    total: orders.length,
    steps: steps.map((s) => ({ step: s.label, count: s.count, percentOfAll: r1(s.percent) })),
    report: buildFunnelReport(orders).map((r) => ({ row: r.label, count: r.count })),
    stages: buildStageSummary(orders).map((s) => ({ stage: s.label, count: s.count })),
    bySource: groupBy((o) => o.source).map(([source, list]) => ({ source, ...stepOf(list) })),
    byCourse: groupBy((o) => o.course).map(([course, list]) => ({ course, ...stepOf(list) })),
  };
}

export const salesFunnel: AiTool = {
  name: "sales_funnel",
  description:
    "Sales funnel (Sotuv voronkasi) — the same numbers as the Reports → Sales funnel page: all leads → booked a trial lesson → " +
    "came to the trial → made the first payment, with percentages; the 11-row report (left, transferred, finished…), " +
    "lead stages, and the same funnel per lead source and per course. Scope: leads of the current branch plus leads " +
    "this user added. Optional date range on the lead creation date, course and source filters.",
  parameters: {
    type: "object",
    properties: {
      from: { type: "string", description: "Optional start date YYYY-MM-DD (lead created on or after)." },
      to: { type: "string", description: "Optional end date YYYY-MM-DD (lead created on or before)." },
      course: { type: "string", description: "Optional course name." },
      source: { type: "string", description: "Optional lead source (as stored, e.g. bot, Sayt, survey)." },
    },
    additionalProperties: false,
  },
  pages: ["/reports-funnel"],
  async run(ctx, args) {
    const from = optDate(args, "from");
    const to = optDate(args, "to");
    if (from && to && from > to) throw new ToolInputError('"from" must not be after "to"');

    const all = (await ctx.db
      .collection("orders")
      .find(withLeadScope({}, ctx.scope, authorNameOf(ctx)), {
        projection: {
          _id: 0, status: 1, stage: 1, course: 1, subcourse: 1, source: 1, created: 1,
          fromBranch: 1, toBranch: 1, moderator: 1, teacher: 1,
        },
      })
      .toArray()) as unknown as Order[];

    // Kurs/manba — sahifadagi kabi bazadagi haqiqiy qiymatlardan, aniq moslik bilan.
    const courseIn = optString(args, "course", 100);
    const sourceIn = optString(args, "source", 60);
    const courses = valuesOf(all, (o) => o.course);
    const sources = valuesOf(all, (o) => o.source);
    const course = courseIn ? pickValue(courses, courseIn) : "";
    if (courseIn && !course) return { problem: `Unknown or ambiguous course "${courseIn}".`, courses };
    const source = sourceIn ? pickValue(sources, sourceIn) : "";
    if (sourceIn && !source) return { problem: `Unknown or ambiguous source "${sourceIn}".`, sources };

    const orders = all.filter((o) => {
      if (course && String(o.course ?? "").trim() !== course) return false;
      if (source && String(o.source ?? "").trim() !== source) return false;
      if (!from && !to) return true;
      // Sana o'qib bo'lmasa oraliqqa tushmaydi (sahifadagi inRange qoidasi).
      const d = leadCreatedIso(o.created);
      return !!d && (!from || d >= from) && (!to || d <= to);
    });

    return {
      branch: ctx.branchName,
      scope: "leads of the current branch plus leads added by this user",
      from: from || undefined,
      to: to || undefined,
      course: course || undefined,
      source: source || undefined,
      ...funnelSummary(orders),
      page: "/reports-funnel",
    };
  },
};
