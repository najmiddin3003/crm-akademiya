import { branchInCondition, withPupilBranch } from "@/lib/branchScope";
import { groupLabel, type Group } from "@/lib/groups";
import { pupilEntryMatch, pupilNameOfDoc } from "@/lib/pupilEntries";
import { pupilSearchFilter } from "@/lib/pupilSearch";
import { pupilStatusOf, type Pupil } from "@/lib/pupilsData";
import { studentPaidBalance } from "@/lib/pupilsDb";
import { maskPhone } from "../mask";
import { optInt, optString, ToolInputError, type AiTool } from "./types";

// O'QUVCHILAR — qidirish va bitta o'quvchining qisqa kartasi.
//
// Qamrov "O'quvchilar ro'yxati" bilan AYNAN bir xil: `withPupilBranch`
// (1 va 2-filial umumiy hovuz — lib/branchScope.ts). Ruxsat — o'sha
// sahifaning ruxsati (`/students-list`), ya'ni xodim ro'yxatda ko'ra
// olmaydigan o'quvchini AI orqali ham topa olmaydi.
//
// O'QUVCHI GURUHLARI xodimga RUXSAT ETILGAN filiallar bo'yicha
// (`scope.allowed`): hovuzdagi o'quvchi boshqa binodagi guruhda o'qishi
// mumkin va "qaysi guruhda o'qiydi?" savoliga javob bo'sh qolmasin; lekin
// xodim umuman kira olmaydigan filialning guruhi ko'rsatilmaydi.

const SEARCH_LIMIT = 10;

/** Profil havolasi — `?src=list` SHART: usiz buyurtma va o'quvchi id'lari chalkashadi (README). */
const profileHref = (id: number) => `/student-edit/${id}?src=list`;

const groupProjection = { _id: 0, id: 1, name: 1, course: 1, level: 1, teacher: 1, day: 1, time: 1, room: 1, status: 1, studentIds: 1 };

export const searchPupils: AiTool = {
  name: "search_pupils",
  description:
    "Find students (o'quvchilar) in the current branch by first/last name, phone digits or student ID. " +
    "Returns up to 10 matches with id, status and groups. Use it before pupil_details when only a name is known; " +
    "if several students share the name, list them and ask which one is meant.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Name, surname, phone digits or student ID (at least 2 characters)." },
    },
    required: ["query"],
    additionalProperties: false,
  },
  pages: ["/students-list"],
  async run(ctx, args) {
    const query = optString(args, "query", 60);
    const filter = pupilSearchFilter(query);
    if (!filter) throw new ToolInputError('"query" must have at least 2 characters');

    const rows = await ctx.db
      .collection("pupils")
      .find(withPupilBranch(filter, ctx.scope), {
        projection: { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, status: 1, statusReason: 1 },
      })
      .sort({ id: -1 })
      .limit(SEARCH_LIMIT + 1)
      .toArray();
    const list = rows.slice(0, SEARCH_LIMIT);
    const ids = list.map((p) => Number(p.id));
    const groups = ids.length
      ? await ctx.db
          .collection("groups")
          .find({ $and: [{ studentIds: { $in: ids } }, branchInCondition(ctx.scope.allowed)] }, { projection: groupProjection })
          .toArray()
      : [];

    return {
      branch: ctx.branchName,
      found: list.length,
      moreNotShown: rows.length > SEARCH_LIMIT,
      pupils: list.map((p) => {
        const id = Number(p.id);
        return {
          id,
          name: pupilNameOfDoc(p),
          status: pupilStatusOf(p as Pick<Pupil, "status">),
          statusReason: p.statusReason || undefined,
          phone: maskPhone(p.phone),
          groups: groups
            .filter((g) => Array.isArray(g.studentIds) && g.studentIds.includes(id))
            .map((g) => `${groupLabel(g as unknown as Group)} — ${g.teacher || "—"}`),
          page: profileHref(id),
        };
      }),
    };
  },
};

export const pupilDetails: AiTool = {
  name: "pupil_details",
  description:
    "Details of ONE student by id: status, groups (course, teacher, days, time), total amount paid, " +
    "last 5 payments and attendance counts for the last 30 days. Get the id from search_pupils first.",
  parameters: {
    type: "object",
    properties: { pupilId: { type: "integer", description: "Student id (pupils.id)." } },
    required: ["pupilId"],
    additionalProperties: false,
  },
  pages: ["/students-list"],
  async run(ctx, args) {
    const id = optInt(args, "pupilId", 1, 1_000_000_000);
    if (id === null) throw new ToolInputError('"pupilId" is required');

    const p = await ctx.db.collection("pupils").findOne(withPupilBranch({ id }, ctx.scope), {
      projection: {
        _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, status: 1, statusReason: 1, statusChangedAt: 1,
        createdAt: 1, category: 1, source: 1, moderator: 1, grade: 1,
      },
    });
    if (!p) return { found: false, message: "No such student in the current branch (or the user has no access)." };

    const ref = { id, name: pupilNameOfDoc(p) };
    const since = new Date(Date.parse(`${ctx.today}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10);

    const [groups, totalPaid, payments, attendance] = await Promise.all([
      ctx.db
        .collection("groups")
        .find({ $and: [{ studentIds: id }, branchInCondition(ctx.scope.allowed)] }, { projection: groupProjection })
        .toArray(),
      // Balansning yagona qoidasi (lib/pupilsDb.ts): to'lovlar − qaytarilgan pul,
      // tanga evaziga chegirma ham to'langan hisoblanadi.
      studentPaidBalance(ctx.db, ref),
      ctx.db
        .collection("transaction_entries")
        .find(
          { $and: [pupilEntryMatch(ref), { txType: "payIn", status: { $ne: "cancelled" } }] },
          { projection: { _id: 0, date: 1, amount: 1, discountSom: 1, txName: 1, paymentType: 1, periodMonth: 1, teacherName: 1 } },
        )
        .sort({ date: -1, id: -1 })
        .limit(5)
        .toArray(),
      ctx.db
        .collection("attendance")
        .aggregate<{ _id: string; n: number }>([
          { $match: { pupilId: id, date: { $gte: since, $lte: ctx.today } } },
          { $group: { _id: "$status", n: { $sum: 1 } } },
        ])
        .toArray(),
    ]);

    return {
      found: true,
      id,
      name: ref.name,
      phone: maskPhone(p.phone),
      status: pupilStatusOf(p as Pick<Pupil, "status">),
      statusReason: p.statusReason || undefined,
      statusChangedAt: p.statusChangedAt || undefined,
      createdAt: p.createdAt || undefined,
      category: p.category || undefined,
      source: p.source || undefined,
      responsible: p.moderator || undefined,
      schoolGrade: p.grade ?? undefined,
      groups: groups.map((g) => ({
        group: groupLabel(g as unknown as Group),
        level: g.level || undefined,
        teacher: g.teacher || "—",
        days: g.day || "—",
        time: g.time || "—",
        room: g.room || undefined,
        status: g.status,
        page: `/groups/${g.id}`,
      })),
      totalPaid,
      totalPaidRule: "all payments minus refunds; coin discounts count as paid",
      lastPayments: payments.map((e) => ({
        date: e.date,
        amount: Number(e.amount) || 0,
        discount: Number(e.discountSom) || undefined,
        forMonth: e.periodMonth || String(e.date ?? "").slice(0, 7),
        type: e.txName || undefined,
        method: e.paymentType || undefined,
        teacher: e.teacherName || undefined,
      })),
      attendanceLast30Days: attendance.length
        ? Object.fromEntries(attendance.map((a) => [a._id, a.n]))
        : "no attendance records",
      page: profileHref(id),
    };
  },
};
