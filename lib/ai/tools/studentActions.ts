import {
  prepareAttendance,
  prepareLeadStage,
  prepareMembership,
  preparePupilCreate,
  preparePupilStatus,
} from "../actions/prepareStudents";
import { propose, REPLACES_PARAM } from "./actions";
import type { AiTool } from "./types";

// 5-BOSQICH AMAL VOSITALARI (08.10.2026, foydalanuvchi tanlovi): yangi
// o'quvchi, guruhga qo'shish/chiqarish, davomat, o'quvchi holati, lid
// bosqichi. 2–3-bosqich bilan bir xil: HECH BIRI YOZMAYDI — qoralama
// tuziladi, yozuv xodim kartadagi «Tasdiqlash» ni bosganda
// (lib/ai/actions/executeStudents.ts). Ruxsat — web'dagi o'sha amal
// sahifasi (lib/ai/actions/pages.ts).

const GROUP_PARAMS = {
  group: { type: "string", description: "Group number, course or teacher to search in the current branch (when groupId is not known)." },
  groupId: { type: "integer", description: "Group id from list_groups or from the candidates of a previous call." },
} as const;

const PUPIL_PARAMS = {
  pupil: { type: "string", description: "Student name or phone to search (when pupilId is not known)." },
  pupilId: { type: "integer", description: "Student id from the candidates of a previous call." },
} as const;

export const proposeNewPupil: AiTool = {
  name: "propose_new_pupil",
  description:
    "Prepare a DRAFT of a new student card (O'quvchi qo'shish), optionally adding them to a group right away. Nothing is saved until the user " +
    "presses Confirm. First name and source are required; never invent a phone, birth date or source. If a student with the same phone " +
    "exists, you get it back — ask the user; for an existing student use propose_group_membership instead.",
  parameters: {
    type: "object",
    properties: {
      firstName: { type: "string" },
      lastName: { type: "string" },
      phone: { type: "string", description: "Uzbek phone number as the user said it (9 digits, +998 optional)." },
      extraPhone: { type: "string" },
      birthDate: { type: "string", description: "YYYY-MM-DD" },
      category: { type: "string", description: "Education category name (optional)." },
      source: { type: "string", description: "Where the student heard about the center (required; from the list returned when missing)." },
      customSource: { type: "boolean", description: "true only if the user insists on a source that is not in the list." },
      allowDuplicatePhone: { type: "boolean", description: "true only after the user confirmed it is a different person with the same phone." },
      ...GROUP_PARAMS,
      joinedAt: { type: "string", description: "First lesson date in the group, YYYY-MM-DD (default today)." },
      ...REPLACES_PARAM,
    },
    additionalProperties: false,
  },
  pages: ["/students-list"],
  action: true,
  run: async (ctx, args) => propose(ctx, "pupil", await preparePupilCreate(ctx, args), args),
};

export const proposeGroupMembership: AiTool = {
  name: "propose_group_membership",
  description:
    "Prepare a DRAFT to add an EXISTING student to a group (op: add) or remove them from a group (op: remove). Lessons are counted from " +
    "joinedAt (default today); on removal the membership ends today and past lessons stay in the debt calculation.",
  parameters: {
    type: "object",
    properties: {
      op: { type: "string", enum: ["add", "remove"] },
      ...PUPIL_PARAMS,
      ...GROUP_PARAMS,
      joinedAt: { type: "string", description: "op add: first lesson date, YYYY-MM-DD (default today)." },
      ...REPLACES_PARAM,
    },
    required: ["op"],
    additionalProperties: false,
  },
  pages: ["/groups"],
  action: true,
  run: async (ctx, args) => propose(ctx, "membership", await prepareMembership(ctx, args), args),
};

export const proposeAttendance: AiTool = {
  name: "propose_attendance",
  description:
    "Prepare a DRAFT of attendance marks for ONE group on ONE lesson day (default today; not in the future). Statuses: keldi (present), " +
    "kechikdi (late), birinchi (first lesson), sababli (excused, optional reason), sababsiz (absent without reason). Use `others` for " +
    "everyone not listed, e.g. 'all present except Ali' → others: keldi, marks: [{pupil: 'Ali', status: 'sababsiz'}]. Without marks and " +
    "others you get the group's student list to ask about.",
  parameters: {
    type: "object",
    properties: {
      ...GROUP_PARAMS,
      date: { type: "string", description: "YYYY-MM-DD (default today)." },
      others: { type: "string", enum: ["keldi", "kechikdi", "birinchi", "sababli", "sababsiz"], description: "Status for every student not in marks." },
      marks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            pupil: { type: "string", description: "Student name as in the group." },
            pupilId: { type: "integer" },
            status: { type: "string", enum: ["keldi", "kechikdi", "birinchi", "sababli", "sababsiz"] },
            reason: { type: "string", description: "Only for sababli: the user's reason." },
            note: { type: "string" },
          },
          required: ["status"],
          additionalProperties: false,
        },
      },
      ...REPLACES_PARAM,
    },
    additionalProperties: false,
  },
  pages: ["/groups"],
  action: true,
  run: async (ctx, args) => propose(ctx, "attendance", await prepareAttendance(ctx, args), args),
};

export const proposePupilStatus: AiTool = {
  name: "propose_pupil_status",
  description:
    "Prepare a DRAFT to change a student's status: Aktiv (active), Muzlatilgan (frozen) or Arxiv (archived). A reason is required for " +
    "Muzlatilgan and Arxiv — use the user's words. Archiving removes the student from all groups.",
  parameters: {
    type: "object",
    properties: {
      ...PUPIL_PARAMS,
      status: { type: "string", enum: ["Aktiv", "Muzlatilgan", "Arxiv"] },
      reason: { type: "string" },
      ...REPLACES_PARAM,
    },
    required: ["status"],
    additionalProperties: false,
  },
  pages: ["/students-list"],
  action: true,
  run: async (ctx, args) => propose(ctx, "status", await preparePupilStatus(ctx, args), args),
};

export const proposeLeadStage: AiTool = {
  name: "propose_lead_stage",
  description:
    "Prepare a DRAFT to move a lead (Lidlar) to the next stage: bog (contacted), sinov (trial lesson — date, time, optional teacher), " +
    "guruh (joined a group — the student is found by phone/name or created from the lead, then added to the group), rad (refused — reason " +
    "from the settings list). The funnel only goes forward; a lead in a group is final.",
  parameters: {
    type: "object",
    properties: {
      lead: { type: "string", description: "Lead name, phone or #number (when leadId is not known)." },
      leadId: { type: "integer" },
      to: { type: "string", enum: ["bog", "sinov", "guruh", "rad"] },
      date: { type: "string", description: "sinov: trial lesson date YYYY-MM-DD." },
      time: { type: "string", description: "sinov: HH:MM." },
      teacher: { type: "string", description: "sinov: teacher name (optional)." },
      reason: { type: "string", description: "rad: rejection reason." },
      ...GROUP_PARAMS,
      joinedAt: { type: "string", description: "guruh: first lesson date YYYY-MM-DD (default today)." },
      ...REPLACES_PARAM,
    },
    required: ["to"],
    additionalProperties: false,
  },
  pages: ["/orders-list"],
  action: true,
  run: async (ctx, args) => propose(ctx, "stage", await prepareLeadStage(ctx, args), args),
};
