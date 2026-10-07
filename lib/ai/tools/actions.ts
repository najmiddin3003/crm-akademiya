import { listCashboxesForAdmin } from "@/lib/staffBot/auth";
import { loadActiveMethods, loadChiqimTypes, loadCourseNames, loadKirimTypes } from "@/lib/staffBot/data";
import { isEmployeePayoutCategory } from "@/lib/teacherOfStudent";
import { txAudience, txTarget } from "@/lib/txTarget";
import { authorNameOf, type AiContext } from "../context";
import { ACTION_PAGES } from "../actions/pages";
import { allowedMonths, prepareChiqim, prepareKirim, prepareLead, resolveCashbox, usableKirimTypes, type PrepareResult } from "../actions/prepare";
import { createDraft, DRAFT_TTL_MS, viewOf } from "../actions/store";
import type { AiActionKind } from "../protocol";
import { DraftCreated, optString, ToolInputError, type AiTool, type ToolArgs } from "./types";

// AMAL VOSITALARI (2-bosqich) — lid qo'shish, kirim, chiqim.
//
// HECH BIRI YOZMAYDI. `propose_*` faqat qoralama tuzadi va panelda karta
// chiqadi; yozuv xodim «Tasdiqlash» ni bosgandagina (app/api/ai/actions/[id]).
// Model "saqlandi" deyishi mumkin emas — tizim ko'rsatmasida va har
// javobning `instruction` maydonida aytiladi.
//
// Faqat Sozlamalarda amallar yoqilganda ko'rinadi (`action: true` →
// lib/ai/tools/index.ts). Ruxsat — web oynalari bilan bir xil sahifa
// kalitlari (lib/ai/actions/pages.ts → ACTION_PAGES).

const CONFIRM_INSTRUCTION =
  "A confirmation card is now shown to the user. NOTHING IS SAVED YET. Tell the user to check the card and press " +
  "«Tasdiqlash» (Confirm) to save it or «Bekor qilish» (Cancel). Never say it was saved, paid or added.";

async function propose(ctx: AiContext, kind: AiActionKind, prepared: PrepareResult): Promise<unknown> {
  if (!prepared.ok) return prepared.reply;
  const { draft } = prepared;
  const doc = await createDraft(ctx.db, {
    userId: ctx.userId,
    userName: authorNameOf(ctx),
    kind,
    payload: draft.payload,
    fields: draft.fields,
  });
  return new DraftCreated(viewOf(doc), {
    draftId: doc.id,
    status: "awaiting_user_confirmation",
    expiresInMinutes: Math.round(DRAFT_TTL_MS / 60_000),
    ...draft.forModel,
    instruction: CONFIRM_INSTRUCTION,
  });
}

const PERSON_PARAMS = {
  pupil: { type: "string", description: "Student name or phone to search (when the pupilId is not known yet)." },
  pupilId: { type: "integer", description: "Student id from the candidates list of a previous call." },
} as const;

export const actionOptions: AiTool = {
  name: "action_options",
  description:
    "Valid values for preparing an action draft: for 'lead' — courses and lesson-day options; for 'kirim'/'chiqim' — " +
    "the user's cashbox with available money per payment method, transaction types (and who they are for), " +
    "payment methods and allowed months. Call it before propose_* when you are not sure about a value.",
  parameters: {
    type: "object",
    properties: { kind: { type: "string", enum: ["lead", "kirim", "chiqim"] } },
    required: ["kind"],
    additionalProperties: false,
  },
  pages: ["/orders-list", "/finance-cash"],
  action: true,
  async run(ctx, args) {
    const kind = optString(args, "kind", 10) as AiActionKind;
    if (!["lead", "kirim", "chiqim"].includes(kind)) throw new ToolInputError('"kind" must be lead, kirim or chiqim');
    if (!ctx.can(ACTION_PAGES[kind])) return { problem: "The user has no access to this action." };

    if (kind === "lead") {
      return {
        branch: ctx.branchName,
        courses: await loadCourseNames(ctx.db),
        days: ["toq (Du, Ch, Ju)", "juft (Se, Pa, Sh)", "har kuni (Du–Sh)", "or specific days: Du, Se, Ch, Pa, Ju, Sh, Ya"],
        required: ["student (existing in CRM)", "course", "days"],
      };
    }

    const cashbox = await resolveCashbox(ctx, null);
    const methods = await loadActiveMethods(ctx.db);
    const cashboxes = ctx.isAdmin
      ? (await listCashboxesForAdmin(ctx.db)).map((c) => ({ cashboxId: c.id, name: c.name, primary: c.isPrimary || undefined }))
      : undefined;
    const box = cashbox.ok
      ? {
          name: cashbox.value.name,
          available: methods.map((m) => ({ method: m.name, amount: cashbox.value.methodTotals[m.key] ?? 0 })),
        }
      : cashbox.reply;

    if (kind === "kirim") {
      return {
        cashbox: box,
        otherCashboxes: cashboxes,
        types: usableKirimTypes(await loadKirimTypes(ctx.db)).map((t) => {
          const a = txAudience(t);
          return { name: t.name, needsStudent: !a.thirdParty && (a.student || a.unset), needsMonth: !a.thirdParty };
        }),
        methods: methods.map((m) => m.name),
        months: allowedMonths("kirim"),
      };
    }

    return {
      cashbox: box,
      otherCashboxes: cashboxes,
      types: (await loadChiqimTypes(ctx.db)).map((t) => {
        const target = txTarget(t);
        const salary = target === "employee" && isEmployeePayoutCategory(t.name);
        return {
          name: t.name,
          recipient: target ?? "none",
          salaryPayout: salary || undefined,
          amountIsRemainingSalary: (salary && /oylik/i.test(t.name)) || undefined,
        };
      }),
      methods: methods.map((m) => m.name),
      salaryMonths: allowedMonths("payout"),
    };
  },
};

export const proposeLead: AiTool = {
  name: "propose_lead",
  description:
    "Prepare a DRAFT of a new lead (buyurtma) for an EXISTING student: course and lesson days are required. " +
    "Nothing is saved: the user confirms the draft on a card. If several students match, the result lists candidates.",
  parameters: {
    type: "object",
    properties: {
      ...PERSON_PARAMS,
      course: { type: "string", description: "Course name from action_options." },
      days: { type: "string", description: "toq | juft | har kuni, or day codes like 'Du,Ch'." },
      note: { type: "string", description: "Optional note, only if the user gave one." },
    },
    additionalProperties: false,
  },
  pages: [ACTION_PAGES.lead],
  action: true,
  run: async (ctx: AiContext, args: ToolArgs) => propose(ctx, "lead", await prepareLead(ctx, args)),
};

export const proposeKirim: AiTool = {
  name: "propose_kirim",
  description:
    "Prepare a DRAFT of money coming INTO the user's cashbox (kirim), e.g. a student's course payment. " +
    "Required: type, amount, payment method; the student when the type needs one; month defaults to the current month. " +
    "Nothing is saved: the user confirms the draft on a card.",
  parameters: {
    type: "object",
    properties: {
      type: { type: "string", description: "Income type name from action_options." },
      ...PERSON_PARAMS,
      amount: { type: "integer", description: "Exact amount in so'm, as the user said it." },
      method: { type: "string", description: "Payment method name (e.g. Naqd)." },
      month: { type: "string", description: "Which month the payment is for, YYYY-MM." },
      note: { type: "string" },
      cashboxId: { type: "integer", description: "Administrators only: another cashbox." },
    },
    additionalProperties: false,
  },
  pages: [ACTION_PAGES.kirim],
  action: true,
  run: async (ctx: AiContext, args: ToolArgs) => propose(ctx, "kirim", await prepareKirim(ctx, args)),
};

export const proposeChiqim: AiTool = {
  name: "propose_chiqim",
  description:
    "Prepare a DRAFT of money going OUT of the user's cashbox (chiqim): salary or advance to an employee, a refund to a " +
    "student, or another expense. Required: type, payment method, amount (for «Oylik» the amount is the remaining salary), " +
    "and the employee or student when the type needs one. Nothing is saved: the user confirms the draft on a card.",
  parameters: {
    type: "object",
    properties: {
      type: { type: "string", description: "Expense type name from action_options." },
      employee: { type: "string", description: "Employee name to search (for salary/advance types)." },
      employeeId: { type: "integer", description: "Employee id from the candidates list of a previous call." },
      ...PERSON_PARAMS,
      amount: { type: "integer", description: "Exact amount in so'm, as the user said it." },
      method: { type: "string", description: "Payment method name (e.g. Naqd, Plastik)." },
      month: { type: "string", description: "Salary/advance: which month it is for, YYYY-MM (previous or current)." },
      note: { type: "string" },
      cashboxId: { type: "integer", description: "Administrators only: another cashbox." },
    },
    additionalProperties: false,
  },
  pages: [ACTION_PAGES.chiqim],
  action: true,
  run: async (ctx: AiContext, args: ToolArgs) => propose(ctx, "chiqim", await prepareChiqim(ctx, args)),
};
