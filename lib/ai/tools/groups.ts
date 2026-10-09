import { withBranch } from "@/lib/branchScope";
import { GROUP_STATUS_LABELS, type GroupStatus } from "@/lib/groupRules";
import { groupLabel, type Group } from "@/lib/groups";
import { optString, type AiTool } from "./types";

// GURUHLAR — joriy filial, "Guruh" sahifasi bilan bir xil qamrov.
//
// O'quvchilar soni `studentIds.length` dan: `groups.students` maydonini
// hech bir API yangilamaydi va u yolg'on son beradi (README, "Hech qachon
// o'qilmasligi kerak bo'lgan maydonlar").

const LIMIT = 40;

export const listGroups: AiTool = {
  name: "list_groups",
  description:
    "Groups (guruhlar) of the current branch: course, level, teacher, lesson days and time, room, status and number of students. " +
    "Optional text filter by course, group number or teacher name.",
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "Optional filter: course, group number or teacher name." } },
    additionalProperties: false,
  },
  pages: ["/groups"],
  async run(ctx, args) {
    const q = optString(args, "query", 60).toLowerCase();
    const rows = await ctx.db
      .collection("groups")
      .find(withBranch({}, ctx.scope), {
        projection: {
          _id: 0, id: 1, name: 1, course: 1, level: 1, teacher: 1, assistant: 1,
          day: 1, time: 1, room: 1, status: 1, studentIds: 1, startDate: 1, endDate: 1,
        },
      })
      .sort({ id: 1 })
      .toArray();

    const label = (g: (typeof rows)[number]) => groupLabel(g as unknown as Group);
    const hit = q
      ? rows.filter((g) => [g.name, g.course, g.teacher, g.assistant, label(g)].some((v) => String(v ?? "").toLowerCase().includes(q)))
      : rows;
    const size = (g: (typeof rows)[number]) => (Array.isArray(g.studentIds) ? g.studentIds.length : 0);
    const byStatus: Record<string, number> = {};
    for (const g of hit) {
      const s = GROUP_STATUS_LABELS[g.status as GroupStatus] ?? String(g.status || "—");
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }

    return {
      branch: ctx.branchName,
      filter: q || undefined,
      total: hit.length,
      shown: Math.min(hit.length, LIMIT),
      byStatus,
      // Bitta o'quvchi bir nechta guruhda bo'lishi mumkin — bu a'zoliklar soni.
      memberships: hit.reduce((s, g) => s + size(g), 0),
      groups: hit.slice(0, LIMIT).map((g) => ({
        id: g.id,
        group: label(g),
        level: g.level || undefined,
        teacher: g.teacher || "—",
        assistant: g.assistant || undefined,
        days: g.day || "—",
        time: g.time || "—",
        room: g.room || undefined,
        status: GROUP_STATUS_LABELS[g.status as GroupStatus] ?? g.status,
        students: size(g),
        startDate: g.startDate || undefined,
        endDate: g.endDate || undefined,
        page: `/groups/${g.id}`,
      })),
      page: "/groups",
    };
  },
};
