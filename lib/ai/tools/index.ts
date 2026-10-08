import type { AiContext } from "../context";
import { MAX_TOOL_RESULT_CHARS } from "../config";
import type { ResponseToolSpec, ToolSpec } from "../openai";
import type { AiActionView } from "../protocol";
import {
  actionOptions,
  proposeChiqim,
  proposeKirim,
  proposeLead,
  proposePupilComment,
  proposeTask,
  proposeTransfer,
} from "./actions";
import { attendanceReport, staffAttendance } from "./attendance";
import { cashboxBalances, financeSummary } from "./finance";
import { salesFunnel } from "./funnel";
import { listGroups } from "./groups";
import { crmHelp } from "./help";
import { leadsSummary } from "./leads";
import { payrollSummary } from "./payroll";
import { pupilDetails, searchPupils } from "./pupils";
import { debtorsReport, overview } from "./reports";
import { staffTasks } from "./tasks";
import { DraftCreated, ToolInputError, type AiTool, type ToolArgs } from "./types";

// VOSITALAR RO'YXATI va ularni ishga tushirish.
//
// O'qish vositalari + amal vositalari (2–3-bosqich). Amal vositalari ham
// HECH NARSA YOZMAYDI — faqat qoralama tuzadi (lib/ai/tools/actions.ts);
// yozuv xodim panelda «Tasdiqlash» ni bosgandagina bo'ladi.

export const AI_TOOLS: readonly AiTool[] = [
  overview,
  searchPupils,
  pupilDetails,
  debtorsReport,
  listGroups,
  attendanceReport,
  staffAttendance,
  staffTasks,
  leadsSummary,
  salesFunnel,
  financeSummary,
  cashboxBalances,
  payrollSummary,
  crmHelp,
  actionOptions,
  proposeLead,
  proposeKirim,
  proposeChiqim,
  proposeTransfer,
  proposePupilComment,
  proposeTask,
];

const BY_NAME = new Map(AI_TOOLS.map((tool) => [tool.name, tool]));

/**
 * Xodim ishlata oladimi: `pages` dan biri ochiq bo'lsa (bo'sh — hammaga).
 * Amal vositasi — faqat Sozlamalarda amallar yoqilgan bo'lsa (`actions`).
 */
export function toolAllowed(
  tool: Pick<AiTool, "pages" | "action">,
  can: (href: string) => boolean,
  actions = false,
): boolean {
  if (tool.action && !actions) return false;
  return tool.pages.length === 0 || tool.pages.some((p) => can(p));
}

/**
 * Modelga ko'rsatiladigan vositalar. Ruxsati yo'q vosita UMUMAN
 * ko'rsatilmaydi — model uni chaqirishga urinmaydi ham, va "bunday
 * ma'lumot bor" degan taxminni ham bermaydi.
 */
export function toolsFor(ctx: AiContext): AiTool[] {
  return AI_TOOLS.filter((t) => toolAllowed(t, ctx.can, ctx.actions) && (!t.visible || t.visible(ctx)));
}

export function toolSpecs(tools: readonly AiTool[]): ToolSpec[] {
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

/** Responses API shakli — `function` ichiga o'ralmagan, `strict: false` (lib/ai/openai.ts → ResponseToolSpec). */
export function responseToolSpecs(tools: readonly AiTool[]): ResponseToolSpec[] {
  return tools.map((t) => ({ type: "function", name: t.name, description: t.description, parameters: t.parameters, strict: false }));
}

export interface ToolRunResult {
  ok: boolean;
  /** Modelga ketadigan JSON matn (hajmi cheklangan). */
  content: string;
  /** Amal vositasi qoralama tuzdi — panel kartasi (lib/ai/chat.ts uzatadi). */
  action?: AiActionView;
  /**
   * Natija ko'rinadigan CRM sahifasi (4-bosqich): panel kichrayib, ekranda
   * shu sahifani ochadi — "AI nima qilyapti" ko'rinib tursin. Faqat ichki
   * yo'l va faqat xodim ocha oladigan sahifa.
   */
  screen?: string;
}

/** `/finance-cash`, `/student-edit/12?src=list` — components/ai/aiMarkdown.ts → isInternalHref bilan bir xil. */
const INTERNAL_PATH = /^\/(?!\/)[A-Za-z0-9\-._~%/?=&#]*$/;

/** Vosita natijasidagi `page` (yoki qoralama sahifasi) → ekranda ochiladigan sahifa. */
export function screenOf(ctx: Pick<AiContext, "can">, page: unknown): { screen?: string } {
  return typeof page === "string" && INTERNAL_PATH.test(page) && ctx.can(page) ? { screen: page } : {};
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
  if (tool.action && !ctx.actions) return fail("Actions are turned off by the administrator. Explain how to do it in the CRM instead.");
  if (!toolAllowed(tool, ctx.can, ctx.actions) || (tool.visible && !tool.visible(ctx))) {
    return fail("The user has no access to this data. Tell them it is outside their permissions.");
  }

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
    if (result instanceof DraftCreated) {
      return { ok: true, content: clip(JSON.stringify(result.forModel)), action: result.view, ...screenOf(ctx, result.screen) };
    }
    return { ok: true, content: clip(JSON.stringify(result ?? null)), ...screenOf(ctx, (result as { page?: unknown } | null)?.page) };
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
