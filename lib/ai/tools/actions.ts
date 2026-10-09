import { hasSectionPermission } from "@/lib/permissions";
import { listCashboxesForAdmin } from "@/lib/staffBot/auth";
import { loadActiveMethods, loadChiqimTypes, loadCourseNames, loadKirimTypes, loadTransferDestinations } from "@/lib/staffBot/data";
import { PRIORITIES } from "@/lib/staffTasks";
import { fineFor, loadPickableEmployees, loadSettings } from "@/lib/staffTasksServer";
import { isEmployeePayoutCategory } from "@/lib/teacherOfStudent";
import { loadPendingOut } from "@/lib/transferPending";
import { txAudience, txTarget } from "@/lib/txTarget";
import { uzStamp } from "@/lib/uzTime";
import { authorNameOf, taskViewerOf, type AiContext } from "../context";
import { ACTION_PAGES } from "../actions/pages";
import {
  allowedMonths,
  prepareChiqim,
  prepareKirim,
  prepareLead,
  preparePupilComment,
  prepareTask,
  prepareTransfer,
  resolveCashbox,
  usableKirimTypes,
  type PrepareResult,
} from "../actions/prepare";
import { alreadySavedWarning, createDraft, draftSubject, DRAFT_TTL_MS, recentlySaved, supersedeDrafts, viewOf } from "../actions/store";
import type { AiActionKind } from "../protocol";
import { DraftCreated, optString, ToolInputError, type AiTool, type ToolArgs } from "./types";

// AMAL VOSITALARI — 2-bosqich: lid qo'shish, kirim, chiqim; 3-bosqich:
// boshqa kassaga ko'chirish, o'quvchiga izoh, xodimga topshiriq.
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

/**
 * Qoralama tuzilganda ekranda ochiladigan sahifa — yozuv saqlangach o'sha
 * yerda ko'rinadi (lid — Lidlar, pul — Kassalar, izoh — o'quvchi profili).
 * Xodim ocha olmasa runTool uni tashlaydi.
 */
function draftScreen(kind: AiActionKind, payload: Record<string, unknown>): string | undefined {
  if (kind === "comment" || kind === "status") {
    return Number.isInteger(payload.pupilId) ? `/student-edit/${payload.pupilId}?src=list` : undefined;
  }
  if (kind === "membership" || kind === "attendance") {
    return Number.isInteger(payload.groupId) ? `/groups/${payload.groupId}` : ACTION_PAGES[kind];
  }
  return ACTION_PAGES[kind];
}

/**
 * Har `propose_*` vositasida: xodim kutayotgan qoralamani O'ZGARTIRSA,
 * model eskisining id'sini beradi — u bekor qilinadi (lib/ai/actions/store.ts →
 * supersedeDrafts). Aks holda ikkala karta ham «Tasdiqlash» bilan turardi.
 */
export const REPLACES_PARAM = {
  replacesDraftId: {
    type: "string",
    description:
      "Only when the user CHANGES a draft that is still waiting for confirmation (other amount, student, month, group…): " +
      "the draftId of that old draft. The old card is cancelled and replaced by the new one.",
  },
} as const;

/** Shu turlarda amal yaqinda saqlangan bo'lsa yangi kartada qizil ogohlantirish (ikkinchi marta pul / dublikat o'quvchi). */
const WARN_IF_SAVED: ReadonlySet<AiActionKind> = new Set(["kirim", "chiqim", "transfer", "lead", "pupil"]);
const RECENT_SAVED_MS = 60 * 60_000;

/** Qoralamani saqlaydi va karta + modelga xulosa qaytaradi (5-bosqich vositalari ham shuni ishlatadi). */
export async function propose(ctx: AiContext, kind: AiActionKind, prepared: PrepareResult, args: ToolArgs = {}): Promise<unknown> {
  if (!prepared.ok) return prepared.reply;
  const { draft } = prepared;
  const subject = draftSubject(kind, draft.payload);
  const replaces = typeof args.replacesDraftId === "string" ? args.replacesDraftId.trim().slice(0, 64) : "";

  // Xodim "saqlandi"dan keyin "aslida 350 000 edi" desa — model eskisini
  // tuzatish o'rniga ikkinchisini tuzishi mumkin. Kartada ko'rinib tursin.
  const saved = WARN_IF_SAVED.has(kind) ? await recentlySaved(ctx.db, { userId: ctx.userId, kind, subject, sinceMs: RECENT_SAVED_MS }) : null;
  const savedAt = saved?.finishedAt ? uzStamp(new Date(saved.finishedAt)) : "";
  const fields = saved
    ? [...draft.fields, { key: "warning" as const, value: alreadySavedWarning(savedAt, saved.resultText || "—").text }]
    : draft.fields;

  const doc = await createDraft(ctx.db, {
    userId: ctx.userId,
    userName: authorNameOf(ctx),
    kind,
    payload: draft.payload,
    fields,
    subject,
  });
  // Yangisi yozilgandan KEYIN — yaratib bo'lmasa eskisi tegilmay qoladi.
  const replaced = await supersedeDrafts(ctx.db, {
    userId: ctx.userId,
    kind,
    replacedBy: doc.id,
    ids: replaces ? [replaces] : [],
    subject,
    before: ctx.startedAt ?? new Date(0),
  });
  return new DraftCreated(
    viewOf(doc),
    {
      draftId: doc.id,
      status: "awaiting_user_confirmation",
      expiresInMinutes: Math.round(DRAFT_TTL_MS / 60_000),
      ...draft.forModel,
      ...(replaced.length
        ? {
            replacedDrafts: replaced.map((d) => d.id),
            replacedNote: "The earlier waiting draft of this operation was cancelled; tell the user this new card replaces it.",
          }
        : {}),
      ...(saved
        ? {
            alreadySaved:
              `The same operation was already confirmed and saved at ${savedAt} (${saved.resultText || "ok"}). ` +
              "Warn the user that confirming this card writes it a SECOND time; to correct the saved one they should fix it in the CRM.",
          }
        : {}),
      instruction: CONFIRM_INSTRUCTION,
    },
    draftScreen(kind, draft.payload),
    replaced.map((d) => viewOf(d)),
  );
}

const PERSON_PARAMS = {
  pupil: { type: "string", description: "Student name or phone to search (when the pupilId is not known yet)." },
  pupilId: { type: "integer", description: "Student id from the candidates list of a previous call." },
} as const;

/**
 * Topshiriq BERISH — faqat rahbar (/tasks bo'lim ruxsati) va direktor
 * (lib/staffTasksServer.ts → loadViewer bilan bir xil shart). /tasks
 * sahifasi esa hammaga ochiq — `pages` buni ajrata olmaydi.
 */
export function canAssignTasks(ctx: Pick<AiContext, "isAdmin" | "permissions">): boolean {
  return ctx.isAdmin === true || hasSectionPermission("/tasks", ctx.permissions ?? null);
}

const OPTION_KINDS = ["lead", "kirim", "chiqim", "transfer", "task"] as const;
type OptionKind = (typeof OPTION_KINDS)[number];

export const actionOptions: AiTool = {
  name: "action_options",
  description:
    "Valid values for preparing an action draft: for 'lead' — courses and lesson-day options; for 'kirim'/'chiqim' — " +
    "the user's cashbox with available money per payment method, transaction types (and who they are for), " +
    "payment methods and allowed months; for 'transfer' — the user's cashbox, money available to send per payment method " +
    "and the cashboxes it can be sent to; for 'task' — employees the user can assign tasks to, priorities and their fines. " +
    "Call it before propose_* when you are not sure about a value.",
  parameters: {
    type: "object",
    properties: { kind: { type: "string", enum: [...OPTION_KINDS] } },
    required: ["kind"],
    additionalProperties: false,
  },
  pages: ["/orders-list", "/finance-cash", "/tasks"],
  action: true,
  async run(ctx, args) {
    const kind = optString(args, "kind", 10) as OptionKind;
    if (!OPTION_KINDS.includes(kind)) throw new ToolInputError(`"kind" must be one of ${OPTION_KINDS.join(", ")}`);
    if (!ctx.can(ACTION_PAGES[kind])) return { problem: "The user has no access to this action." };

    if (kind === "task") {
      if (!canAssignTasks(ctx)) return { problem: "Only managers and administrators can assign tasks." };
      const v = await taskViewerOf(ctx);
      const [employees, settings] = await Promise.all([loadPickableEmployees(ctx.db, v), loadSettings(ctx.db)]);
      return {
        employees: employees.slice(0, 80).map((e) => ({ employeeId: e.id, name: e.name, position: e.pos || undefined })),
        moreEmployees: employees.length > 80 || undefined,
        priorities: PRIORITIES.map((p) => ({ priority: p, fineIfNotDone: fineFor(settings, p) })),
        deadlineFormat: "YYYY-MM-DD HH:mm, Tashkent time (today is " + ctx.today + ")",
      };
    }

    if (kind === "transfer") {
      const cashbox = await resolveCashbox(ctx, null);
      if (!cashbox.ok) return cashbox.reply;
      const from = cashbox.value;
      const [methods, pendingMap, dests] = await Promise.all([
        loadActiveMethods(ctx.db),
        loadPendingOut(ctx.db, [from.id]),
        loadTransferDestinations(ctx.db, from.id),
      ]);
      const pending = pendingMap.get(from.id) ?? {};
      return {
        from: from.name,
        availableToSend: methods.map((m) => ({
          method: m.name,
          amount: Math.max(0, (from.methodTotals[m.key] ?? 0) - (pending[m.key] ?? 0)),
        })),
        to: dests.map((d) => ({ cashboxId: d.id, name: d.name, primary: d.isPrimary || undefined })),
        otherSourceCashboxes: ctx.isAdmin
          ? (await listCashboxesForAdmin(ctx.db)).map((c) => ({ cashboxId: c.id, name: c.name, primary: c.isPrimary || undefined }))
          : undefined,
      };
    }

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
      ...REPLACES_PARAM,
    },
    additionalProperties: false,
  },
  pages: [ACTION_PAGES.lead],
  action: true,
  run: async (ctx: AiContext, args: ToolArgs) => propose(ctx, "lead", await prepareLead(ctx, args), args),
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
      ...REPLACES_PARAM,
    },
    additionalProperties: false,
  },
  pages: [ACTION_PAGES.kirim],
  action: true,
  run: async (ctx: AiContext, args: ToolArgs) => propose(ctx, "kirim", await prepareKirim(ctx, args), args),
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
      paidLaterChecked: {
        type: "boolean",
        description:
          "true only after the user checked the journal and confirmed that the possibly already paid part (possiblyAlreadyPaid) was NOT this salary.",
      },
      note: { type: "string" },
      cashboxId: { type: "integer", description: "Administrators only: another cashbox." },
      ...REPLACES_PARAM,
    },
    additionalProperties: false,
  },
  pages: [ACTION_PAGES.chiqim],
  action: true,
  run: async (ctx: AiContext, args: ToolArgs) => propose(ctx, "chiqim", await prepareChiqim(ctx, args), args),
};

export const proposeTransfer: AiTool = {
  name: "propose_transfer",
  description:
    "Prepare a DRAFT of sending money from the user's cashbox to ANOTHER cashbox (ko'chirish), e.g. the daily takings to the " +
    "main cashbox. Required: receiving cashbox, payment method and amount; optional note. The money stays in the sender's " +
    "cashbox until the receiver accepts it. Nothing is saved: the user confirms the draft on a card.",
  parameters: {
    type: "object",
    properties: {
      to: { type: "string", description: "Receiving cashbox name from action_options." },
      toCashboxId: { type: "integer", description: "Receiving cashbox id from action_options or a previous call." },
      method: { type: "string", description: "Payment method name (e.g. Naqd)." },
      amount: { type: "integer", description: "Exact amount in so'm, as the user said it." },
      note: { type: "string", description: "Optional note, only if the user gave one." },
      cashboxId: { type: "integer", description: "Administrators only: send from another cashbox." },
      ...REPLACES_PARAM,
    },
    additionalProperties: false,
  },
  pages: [ACTION_PAGES.transfer],
  action: true,
  run: async (ctx: AiContext, args: ToolArgs) => propose(ctx, "transfer", await prepareTransfer(ctx, args), args),
};

export const proposePupilComment: AiTool = {
  name: "propose_pupil_comment",
  description:
    "Prepare a DRAFT of a comment (izoh) on a student — the same comments as the «Izoh» button on the group page. " +
    "The text must be the user's own words (you may fix spelling, never add facts). Nothing is saved: the user confirms " +
    "the draft on a card.",
  parameters: {
    type: "object",
    properties: {
      ...PERSON_PARAMS,
      text: { type: "string", description: "The comment text, as the user said it." },
      ...REPLACES_PARAM,
    },
    additionalProperties: false,
  },
  pages: [ACTION_PAGES.comment],
  action: true,
  run: async (ctx: AiContext, args: ToolArgs) => propose(ctx, "comment", await preparePupilComment(ctx, args), args),
};

export const proposeTask: AiTool = {
  name: "propose_task",
  description:
    "Prepare a DRAFT of a staff task (topshiriq) for one or more employees — the same as «Topshiriq berish» on the " +
    "Topshiriqlar page; each employee gets a separate task. Required: title, employee(s), deadline (Tashkent time) and " +
    "priority 1–5 (it sets the fine if the task is not done). Optional description and link. Nothing is saved: the user " +
    "confirms the draft on a card.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short task title." },
      description: { type: "string", description: "Optional details, only what the user said." },
      employees: { type: "array", items: { type: "string" }, description: "Employee names to search." },
      employeeIds: { type: "array", items: { type: "integer" }, description: "Employee ids from action_options or a previous call." },
      deadline: { type: "string", description: "YYYY-MM-DD HH:mm in Tashkent time (YYYY-MM-DD alone means 18:00)." },
      priority: { type: "integer", description: "1 (low) … 5 (high), as the user said it." },
      link: { type: "string", description: "Optional http(s) link." },
      ...REPLACES_PARAM,
    },
    additionalProperties: false,
  },
  pages: [ACTION_PAGES.task],
  action: true,
  visible: canAssignTasks,
  run: async (ctx: AiContext, args: ToolArgs) => propose(ctx, "task", await prepareTask(ctx, args), args),
};
