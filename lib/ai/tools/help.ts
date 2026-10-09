import { SIDEBAR_ITEMS } from "@/constants/sidebar";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { findHelpSections, HELP_SECTIONS } from "../knowledge";
import { optString, ToolInputError, type AiTool } from "./types";
import type { AiContext } from "../context";

// "QANDAY QILAMAN?" — bilimlar bazasidan (lib/ai/knowledge.ts) mos bo'limlar
// va xodim OCHA OLADIGAN sahifalar xaritasi.
//
// Sahifalar ruxsatlar daraxtidan (lib/permissions.ts → PERMISSION_GROUPS)
// olinadi va xodimning ruxsati bilan kesiladi: yordamchi xodimni u kira
// olmaydigan sahifaga yubormasin. Sidebar'da yashirilgan bo'limlar
// (`hidden`, masalan Blok test) ham ko'rsatilmaydi.

const HIDDEN_GROUPS = new Set(
  (SIDEBAR_ITEMS as { key: string; hidden?: boolean }[]).filter((t) => t.hidden).map((t) => t.key),
);

function pageMap(ctx: AiContext) {
  return PERMISSION_GROUPS.filter((g) => !HIDDEN_GROUPS.has(g.key))
    .map((g) => ({
      section: g.label,
      pages: g.items.filter((i) => ctx.can(i.href)).map((i) => `${i.label} (${i.href})`),
    }))
    .filter((g) => g.pages.length > 0);
}

export const crmHelp: AiTool = {
  name: "crm_help",
  description:
    "How to do things in this CRM: step-by-step instructions for common tasks (adding a lead, accepting a payment, attendance, " +
    "salaries, employees, roles, passwords, Telegram bot…) and the list of CRM pages this user can open. " +
    "Call it for any 'how do I…' / 'qanday qilinadi' question before answering.",
  parameters: {
    type: "object",
    properties: { topic: { type: "string", description: "What the user wants to do, in their own words." } },
    required: ["topic"],
    additionalProperties: false,
  },
  pages: [],
  async run(ctx, args) {
    const topic = optString(args, "topic", 200);
    if (!topic) throw new ToolInputError('"topic" is required');
    const sections = findHelpSections(topic);
    return {
      sections: sections.map((s) => ({
        title: s.title,
        steps: s.text,
        pages: s.pages.filter((p) => ctx.can(p)),
      })),
      // Mos bo'lim topilmasa model boshqa so'z bilan qayta so'rashi uchun.
      otherTopics: sections.length ? undefined : HELP_SECTIONS.map((s) => s.title),
      pagesUserCanOpen: pageMap(ctx),
    };
  },
};
