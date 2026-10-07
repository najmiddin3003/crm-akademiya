import { holatMeta, holatOf, type HolatSource } from "@/lib/leadHolat";
import { withLeadScope } from "@/lib/leadScope";
import { authorNameOf } from "../context";
import { optDate, ToolInputError, type AiTool } from "./types";

// LIDLAR — "Lidlar ro'yxati" bilan bir xil qamrov: joriy filial YOKI
// xodimning o'zi qo'shgan lidlar (lib/leadScope.ts).
//
// Holat `holatOf` bilan (lib/leadHolat.ts): eski lidlarda `holat` maydoni
// yo'q va u boshqa maydonlardan hisoblanadi — to'g'ridan-to'g'ri
// `holat` ni sanash eski lidlarni "Yangi" deb ko'rsatardi.

const TOP = 8;

/** "08.04.2026 | 14:08" → "2026-04-08"; tanilmasa bo'sh satr. */
export function leadCreatedIso(created: unknown): string {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(String(created ?? "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

function topCounts(values: string[]): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, TOP);
}

export const leadsSummary: AiTool = {
  name: "leads_summary",
  description:
    "Leads (lidlar / buyurtmalar) of the current branch plus leads this user added: counts by status " +
    "(Yangi → Bog'lanildi → Sinov darsiga yozildi → Guruhga qo'shildi, or Rad etdi), by course, source and responsible employee. " +
    "Optional date range on the lead creation date.",
  parameters: {
    type: "object",
    properties: {
      from: { type: "string", description: "Optional start date YYYY-MM-DD (lead created on or after)." },
      to: { type: "string", description: "Optional end date YYYY-MM-DD (lead created on or before)." },
    },
    additionalProperties: false,
  },
  pages: ["/orders-list"],
  async run(ctx, args) {
    const from = optDate(args, "from");
    const to = optDate(args, "to");
    if (from && to && from > to) throw new ToolInputError('"from" must not be after "to"');

    const rows = await ctx.db
      .collection("orders")
      .find(withLeadScope({}, ctx.scope, authorNameOf(ctx)), {
        projection: {
          _id: 0, holat: 1, groupId: 1, status: 1, leadStatus: 1, firstLesson: 1, firstLessonStatus: 1, stage: 1,
          created: 1, course: 1, source: 1, moderator: 1,
        },
      })
      .toArray();

    // Sana `created` da "DD.MM.YYYY | HH:mm" satri — Mongo'da solishtirib
    // bo'lmaydi, filtr JS'da (lidlar soni yuzlab, og'ir emas).
    const inRange = rows.filter((o) => {
      if (!from && !to) return true;
      const d = leadCreatedIso(o.created);
      if (!d) return false;
      return (!from || d >= from) && (!to || d <= to);
    });

    const statuses = inRange.map((o) => holatMeta(holatOf(o as HolatSource)).nom);
    return {
      branch: ctx.branchName,
      scope: "leads of the current branch plus leads added by this user",
      from: from || undefined,
      to: to || undefined,
      total: inRange.length,
      byStatus: topCounts(statuses),
      byCourse: topCounts(inRange.map((o) => String(o.course || "—"))),
      bySource: topCounts(inRange.map((o) => String(o.source || "—"))),
      byResponsible: topCounts(inRange.map((o) => String(o.moderator || "—"))),
      page: "/orders-list",
    };
  },
};
