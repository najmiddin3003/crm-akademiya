import type { AiContext } from "../context";
import { MAX_TOOL_RESULT_CHARS } from "../config";
import type { ToolSpec } from "../openai";
import { cashboxBalances, financeSummary } from "./finance";
import { listGroups } from "./groups";
import { crmHelp } from "./help";
import { leadsSummary } from "./leads";
import { payrollSummary } from "./payroll";
import { pupilDetails, searchPupils } from "./pupils";
import { debtorsReport, overview } from "./reports";
import { ToolInputError, type AiTool, type ToolArgs } from "./types";

// VOSITALAR RO'YXATI va ularni ishga tushirish.
//
// Faqat O'QISH. Ma'lumotni o'zgartiradigan vosita bu bosqichda yo'q —
// yozish amallari keyingi bosqichda alohida tasdiq oynasi bilan keladi.

export const AI_TOOLS: readonly AiTool[] = [
  overview,
  searchPupils,
  pupilDetails,
  debtorsReport,
  listGroups,
  leadsSummary,
  financeSummary,
  cashboxBalances,
  payrollSummary,
  crmHelp,
];

const BY_NAME = new Map(AI_TOOLS.map((tool) => [tool.name, tool]));

/** Xodim ishlata oladimi: `pages` dan biri ochiq bo'lsa (bo'sh — hammaga). */
export function toolAllowed(tool: Pick<AiTool, "pages">, can: (href: string) => boolean): boolean {
  return tool.pages.length === 0 || tool.pages.some((p) => can(p));
}

/**
 * Modelga ko'rsatiladigan vositalar. Ruxsati yo'q vosita UMUMAN
 * ko'rsatilmaydi — model uni chaqirishga urinmaydi ham, va "bunday
 * ma'lumot bor" degan taxminni ham bermaydi.
 */
export function toolsFor(ctx: AiContext): AiTool[] {
  return AI_TOOLS.filter((t) => toolAllowed(t, ctx.can));
}

export function toolSpecs(tools: readonly AiTool[]): ToolSpec[] {
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export interface ToolRunResult {
  ok: boolean;
  /** Modelga ketadigan JSON matn (hajmi cheklangan). */
  content: string;
}

/**
 * Vositani bajaradi. HECH QACHON OTMAYDI: xato ham modelga natija
 * sifatida qaytadi ("ruxsat yo'q", "argument noto'g'ri") va u javobni
 * shunga qarab yozadi.
 *
 * Ruxsat bu yerda QAYTA tekshiriladi — model ro'yxatda bo'lmagan nomni
 * yozib yuborishi mumkin (ko'rsatilmagan vositani "eslab qolgan" bo'lsa).
 */
export async function runTool(ctx: AiContext, name: string, rawArgs: string): Promise<ToolRunResult> {
  const tool = BY_NAME.get(name);
  if (!tool) return fail(`Unknown tool "${name}".`);
  if (!toolAllowed(tool, ctx.can)) return fail("The user has no access to this data. Tell them it is outside their permissions.");

  let args: ToolArgs;
  try {
    const parsed = rawArgs.trim() ? JSON.parse(rawArgs) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    args = parsed as ToolArgs;
  } catch {
    return fail("Arguments must be a JSON object.");
  }

  try {
    const result = await tool.run(ctx, args);
    return { ok: true, content: clip(JSON.stringify(result ?? null)) };
  } catch (e) {
    if (e instanceof ToolInputError) return fail(`Invalid arguments: ${e.message}`);
    console.error("[ai] vosita xatosi", name, e);
    return fail("The data could not be loaded because of a server error. Tell the user to try again later.");
  }
}

/** Bir qadamda juda ko'p vosita so'raldi — ortiqchasiga shu javob qaytadi (lib/ai/chat.ts). */
export function tooManyCallsResult(max: number): string {
  return fail(`At most ${max} tools per step; ask again for the rest.`).content;
}

function fail(error: string): ToolRunResult {
  return { ok: false, content: JSON.stringify({ error }) };
}

function clip(s: string): string {
  if (s.length <= MAX_TOOL_RESULT_CHARS) return s;
  // JSON'ni o'rtasidan kesish uni buzadi — model buni ko'rsin va kamroq so'rasin.
  return JSON.stringify({
    truncated: true,
    note: "Result too large; ask for a narrower range or fewer items.",
    partial: s.slice(0, MAX_TOOL_RESULT_CHARS - 200),
  });
}
