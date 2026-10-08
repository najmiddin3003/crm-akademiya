import type { AiPlanStep } from "../protocol";
import { ToolInputError, type AiTool } from "./types";

// VAZIFA REJASI — Claude Cowork'dagi kabi (5-bosqich, 08.10.2026). Model
// ko'p qadamli ishni boshlashdan oldin rejani yozadi va har qadam
// boshlanganda/tugaganda yangilaydi; panel uni belgilanadigan ro'yxat qilib
// ko'rsatadi — xodim AI hozir qaysi qadamda ekanini ko'rib turadi.
//
// Ma'lumotga tegmaydi (ruxsat kerak emas). Natija modelga — oddiy "ok",
// reja esa panelga `{type: "plan"}` hodisasi bo'lib ketadi (lib/ai/chat.ts).

const MAX_STEPS = 8;
const MAX_TITLE = 80;
const STATUSES: readonly AiPlanStep["status"][] = ["pending", "active", "done"];

export function parsePlan(raw: unknown): AiPlanStep[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new ToolInputError('"steps" must be a non-empty array');
  if (raw.length > MAX_STEPS) throw new ToolInputError(`at most ${MAX_STEPS} steps`);
  return raw.map((s) => {
    const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim().slice(0, MAX_TITLE) : "";
    if (!title) throw new ToolInputError("each step needs a title");
    const status = STATUSES.includes(o.status as AiPlanStep["status"]) ? (o.status as AiPlanStep["status"]) : "pending";
    return { title, status };
  });
}

export const updatePlan: AiTool = {
  name: "update_plan",
  description:
    "Show the user a short checklist plan of a MULTI-STEP task and keep it updated, so they can watch your progress. Call it before " +
    "starting a task that needs 3 or more steps, then again each time a step starts (active) or finishes (done). Every call replaces the " +
    "whole plan. Step titles: short, in the user's language. Do not use it for simple one-step questions.",
  parameters: {
    type: "object",
    properties: {
      steps: {
        type: "array",
        maxItems: MAX_STEPS,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            status: { type: "string", enum: ["pending", "active", "done"] },
          },
          required: ["title", "status"],
          additionalProperties: false,
        },
      },
    },
    required: ["steps"],
    additionalProperties: false,
  },
  pages: [],
  async run(_ctx, args) {
    const steps = parsePlan(args.steps);
    return { ok: true, _ui: { plan: steps } };
  },
};
