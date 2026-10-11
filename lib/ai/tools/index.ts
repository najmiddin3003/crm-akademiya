import type { AiContext } from "../context";
import { branchPool, buildingNo, sameBranchPool } from "@/lib/branchPools";
import { MAX_TOOL_RESULT_CHARS } from "../config";
import type { ResponseToolSpec, ToolSpec } from "../openai";
import type { AiActionView, AiPlanStep, AiQuestion } from "../protocol";
import {
  actionOptions,
  proposeChiqim,
  proposeKirim,
  proposeLead,
  proposePupilComment,
  proposeTask,
  proposeTransfer,
} from "./actions";
import { askUser } from "./ask";
import { attendanceReport, staffAttendance } from "./attendance";
import { queryData } from "./dataQuery";
import { cashboxBalances, financeSummary } from "./finance";
import { salesFunnel } from "./funnel";
import { listGroups } from "./groups";
import { crmHelp } from "./help";
import { leadsSummary } from "./leads";
import { paymentsList } from "./payments";
import { payrollSummary } from "./payroll";
import { updatePlan } from "./plan";
import { pupilDetails, searchPupils } from "./pupils";
import { debtorsReport, overview } from "./reports";
import { proposeAttendance, proposeGroupMembership, proposeLeadStage, proposeNewPupil, proposePupilStatus } from "./studentActions";
import { staffTasks } from "./tasks";
import { DraftCreated, ToolInputError, type AiTool, type ToolArgs } from "./types";

// VOSITALAR RO'YXATI va ularni ishga tushirish.
//
// O'qish vositalari + amal vositalari (2–3–5-bosqich). Amal vositalari ham
// HECH NARSA YOZMAYDI — faqat qoralama tuzadi (lib/ai/tools/actions.ts,
// studentActions.ts); yozuv xodim panelda «Tasdiqlash» ni bosgandagina
// bo'ladi. 5-bosqichda: to'lovlar ro'yxati, admin uchun istalgan ma'lumot
// (query_data) va vazifa rejasi (update_plan, Cowork kabi).

export const AI_TOOLS: readonly AiTool[] = [
  updatePlan,
  askUser,
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
  paymentsList,
  payrollSummary,
  queryData,
  crmHelp,
  actionOptions,
  proposeLead,
  proposeKirim,
  proposeChiqim,
  proposeTransfer,
  proposePupilComment,
  proposeTask,
  proposeNewPupil,
  proposeGroupMembership,
  proposeAttendance,
  proposePupilStatus,
  proposeLeadStage,
];

/** Panelda vosita belgisi chiqmaydigan vositalar — reja va intervyu kartasi o'zi ko'rinadi. */
const SILENT_TOOLS = new Set(["update_plan", "ask_user"]);
export function isSilentTool(name: string): boolean {
  return SILENT_TOOLS.has(name);
}

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

// ── FILIAL ARGUMENTI (11.10.2026) ────────────────────────────────────────
//
// NIMA NOTO'G'RI EDI: hisobot vositalari faqat NAVBARDAGI filialni ko'rardi.
// Admin navbarda Uychi'da turib «barcha filiallar bo'yicha» so'rasa, model
// faqat Uychi raqamini aytar yoki «hisoblab bo'lmaydi» deb to'xtardi
// (10.10.2026 suhbatlari). Endi `branchAware` vositaga `branch` argumenti
// qo'shiladi: xodim OCHA OLADIGAN boshqa filial id'si yoki "all". Vosita
// o'zgarmaydi — unga filiali almashtirilgan kontekst beriladi, ya'ni ruxsat
// navbarda o'sha filialni tanlagandagidek (`scope.allowed`).

const BRANCH_PARAM = {
  type: "string",
  description:
    'Optional branch: a branch id from the list in your instructions, or "all" for every branch the user can open ' +
    "(the result then has one entry per branch). Default: the user's current branch.",
};

/** Modelga ko'rsatiladigan argumentlar — `branchAware` vositaga `branch` qo'shiladi. */
export function toolParameters(t: AiTool): Record<string, unknown> {
  if (!t.branchAware) return t.parameters;
  const props = (t.parameters as { properties?: Record<string, unknown> }).properties ?? {};
  return { ...t.parameters, properties: { ...props, branch: BRANCH_PARAM } };
}

export function toolSpecs(tools: readonly AiTool[]): ToolSpec[] {
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: toolParameters(t) },
  }));
}

/** Responses API shakli — `function` ichiga o'ralmagan, `strict: false` (lib/ai/openai.ts → ResponseToolSpec). */
export function responseToolSpecs(tools: readonly AiTool[]): ResponseToolSpec[] {
  return tools.map((t) => ({ type: "function", name: t.name, description: t.description, parameters: toolParameters(t), strict: false }));
}

/**
 * `branch` argumenti → qaysi filiallar. "all" — xodim ocha oladiganlarning
 * hammasi (hovuz bitta: `ctx.branches`); id — faqat `scope.allowed` ichida.
 */
export function resolveBranchArg(ctx: Pick<AiContext, "scope" | "branches">, raw: unknown): number[] {
  const list = ctx.branches ?? [];
  if (String(raw).trim().toLowerCase() === "all") {
    const ids = list.map((b) => b.id);
    return ids.length ? ids : [ctx.scope.branchId];
  }
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new ToolInputError('"branch" must be a branch id or "all"');
  if (!ctx.scope.allowed.includes(id)) throw new ToolInputError("This branch is not available to the user");
  return [id];
}

/** Filiali almashtirilgan kontekst (navbarda o'sha filial tanlangandagidek). */
function contextForBranch(ctx: AiContext, id: number): AiContext {
  const pool = branchPool(id);
  const name = (ctx.branches ?? []).find((b) => sameBranchPool(b.id, id))?.name ?? `#${id}`;
  return {
    ...ctx,
    scope: { ...ctx.scope, branchId: id },
    branchName: name,
    building: buildingNo(id),
    buildingCount: pool.length > 1 ? pool.length : 0,
  };
}

async function runForBranches(ctx: AiContext, tool: AiTool, raw: unknown, args: ToolArgs): Promise<unknown> {
  const ids = resolveBranchArg(ctx, raw);
  if (ids.length === 1) return tool.run(contextForBranch(ctx, ids[0]), args);
  const perBranch = await Promise.all(
    ids.map(async (id) => {
      const sub = contextForBranch(ctx, id);
      const { result } = takeUi(await tool.run(sub, args));
      return { branchId: id, branch: sub.branchName, result };
    }),
  );
  return {
    perBranch,
    note: "One result per branch. When the user wants one number, add the branch totals and say it is the sum of these branches.",
  };
}

export interface ToolRunResult {
  ok: boolean;
  /** Modelga ketadigan JSON matn (hajmi cheklangan). */
  content: string;
  /** Amal vositasi qoralama tuzdi — panel kartasi (lib/ai/chat.ts uzatadi). */
  action?: AiActionView;
  /** Shu qoralama almashtirgan eski kartalarning yangi holati (`action_update`). */
  updates?: AiActionView[];
  /**
   * Natija ko'rinadigan CRM sahifasi (4-bosqich): panel kichrayib, ekranda
   * shu sahifani ochadi — "AI nima qilyapti" ko'rinib tursin. Faqat ichki
   * yo'l va faqat xodim ocha oladigan sahifa.
   */
  screen?: string;
  /** Ish jarayoni ro'yxatida qadam ostidagi qisqa yozuv ("23 ta yozuv · 4 500 000 so'm"). */
  note?: string;
  /** `update_plan` — panelga ketadigan reja. */
  plan?: AiPlanStep[];
  /** `ask_user` — xodimga intervyu savollari; javob shu yerda tugaydi (lib/ai/chat.ts). */
  questions?: AiQuestion[];
}

/**
 * Natijadagi PANEL qismi (`_ui`: note, plan) ajratiladi — modelga ketmaydi.
 * Vositalar shu kalit bilan panelga qisqa yozuv yoki reja beradi.
 */
function takeUi(result: unknown): { result: unknown; note?: string; plan?: AiPlanStep[]; questions?: AiQuestion[] } {
  if (!result || typeof result !== "object" || Array.isArray(result) || !("_ui" in result)) return { result };
  const { _ui, ...rest } = result as Record<string, unknown> & {
    _ui?: { note?: unknown; plan?: AiPlanStep[]; questions?: AiQuestion[] };
  };
  const note = typeof _ui?.note === "string" && _ui.note ? _ui.note.slice(0, 160) : undefined;
  return {
    result: rest,
    ...(note ? { note } : {}),
    ...(_ui?.plan ? { plan: _ui.plan } : {}),
    ...(_ui?.questions?.length ? { questions: _ui.questions } : {}),
  };
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
  // Sinov uchun (scripts/_replay-ai-chat.mjs): model qaysi vositani qanday
  // argument bilan chaqirgani. Prod'da o'rnatilmagan — hech narsa chiqmaydi.
  if (process.env.AI_DEBUG_TOOLS === "1") console.log(`[ai-tool] ${name} ${rawArgs}`);
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
    // `branch` — faqat `branchAware` vositada (boshqasida e'tiborsiz qoladi).
    const branchArg = tool.branchAware ? args.branch : undefined;
    let raw: unknown;
    if (branchArg !== undefined && branchArg !== null && branchArg !== "") {
      const { branch: _omit, ...rest } = args;
      void _omit;
      raw = await runForBranches(ctx, tool, branchArg, rest);
    } else {
      raw = await tool.run(ctx, args);
    }
    if (raw instanceof DraftCreated) {
      return {
        ok: true,
        content: clip(JSON.stringify(raw.forModel)),
        action: raw.view,
        ...(raw.replaced.length ? { updates: raw.replaced } : {}),
        ...screenOf(ctx, raw.screen),
      };
    }
    const { result, note, plan, questions } = takeUi(raw);
    // Vosita "xato" natijasi (`{error}`) — ruxsat yoki qamrov sababi: panelda qizil belgi.
    const failed = !!result && typeof result === "object" && "error" in (result as object);
    return {
      ok: !failed,
      content: clip(JSON.stringify(result ?? null)),
      ...(failed ? {} : screenOf(ctx, (result as { page?: unknown } | null)?.page)),
      ...(note ? { note } : {}),
      ...(plan ? { plan } : {}),
      ...(questions ? { questions } : {}),
    };
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
