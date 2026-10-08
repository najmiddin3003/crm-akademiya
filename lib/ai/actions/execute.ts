import { withPupilBranch } from "@/lib/branchScope";
import { applyCashboxAdjust, type AdjustDeps } from "@/lib/cashboxAdjust";
import { applyCashboxTransferTo } from "@/lib/cashboxTransfer";
import { createOrder } from "@/lib/ordersCreate";
import { addPupilComment } from "@/lib/pupilComments";
import { findBotCashbox } from "@/lib/staffBot/auth";
import { createStaffTasks } from "@/lib/staffTasksServer";
import { uzDateIso } from "@/lib/uzTime";
import { taskViewerOf, type AiContext } from "../context";
import { ACTION_PAGES } from "./pages";
import type { ActionDoc, ActionOutcome } from "./store";

// TASDIQLANGAN QORALAMANI YOZISH — web va xodimlar boti chaqiradigan
// O'SHA yadrolar (lib/ordersCreate.ts, lib/cashboxAdjust.ts,
// lib/cashboxTransfer.ts, lib/pupilComments.ts, lib/staffTasksServer.ts).
// Chegaralar (kassa qoldig'i, tasdiq kutayotgan ko'chirmalar, oylik
// qoldig'i, o'quvchi balansi, yopilgan oy, izohdagi oy, topshiriq muddati)
// yadroda YANA bir bor tekshiriladi: qoralama tuzilgandan beri kassa yoki
// oylik o'zgargan bo'lishi mumkin.
//
// RUXSAT TASDIQ PAYTIDA QAYTA tekshiriladi (`checkAccess`) — qoralama
// tuzilgandan keyin admin xodimning ruxsatini olib qo'ygan, kassasini
// boshqa odamga bergan yoki filial almashgan bo'lishi mumkin.

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);

/**
 * `null` — ruxsat bor; aks holda xodimga ko'rsatiladigan sabab. Sabab
 * "error" nomli maydonda: i18n skaneri backend xabarlarini shundan taniydi.
 */
export async function checkAccess(ctx: AiContext, doc: ActionDoc): Promise<{ error: string } | null> {
  if (!ctx.can(ACTION_PAGES[doc.kind])) return { error: "Bu amalga ruxsatingiz yo'q" };
  if (doc.kind === "lead") {
    return ctx.scope.allowed.includes(num(doc.payload.branchId)) ? null : { error: "Bu filialga ruxsatingiz yo'q" };
  }
  if (doc.kind === "comment") {
    // Izoh route'i bilan bir xil qamrov: o'quvchi joriy filialda bo'lishi shart.
    const found = await ctx.db
      .collection("pupils")
      .findOne(withPupilBranch({ id: num(doc.payload.pupilId) }, ctx.scope), { projection: { _id: 1 } });
    return found ? null : { error: "O'quvchi joriy filialda topilmadi" };
  }
  if (doc.kind === "task") {
    // Xodimlar qamrovini yadro (createStaffTasks) yana bir bor tekshiradi.
    const v = await taskViewerOf(ctx);
    return v.role === "xodim" ? { error: "Topshiriq berish uchun ruxsatingiz yo'q" } : null;
  }
  // Kassa: admin — har qanday faol kassa; xodim — faqat o'zi mas'ul kassa (bot bilan bir xil qoida).
  const cashboxId = num(doc.payload.cashboxId);
  const cashbox = await findBotCashbox(ctx.db, {
    isAdmin: ctx.isAdmin,
    name: ctx.employeeName,
    ...(ctx.isAdmin ? { cashboxId } : {}),
  });
  if (!cashbox || cashbox.id !== cashboxId) return { error: "Bu kassa sizga biriktirilmagan yoki arxivlangan" };
  if (doc.kind === "transfer") {
    const dest = await ctx.db
      .collection("cashboxes")
      .findOne({ id: num(doc.payload.toCashboxId), archived: { $ne: true } }, { projection: { _id: 1 } });
    if (!dest) return { error: "Qabul qiluvchi kassa topilmadi yoki arxivlangan" };
  }
  return null;
}

export async function executeAction(ctx: AiContext, doc: ActionDoc, deps: AdjustDeps): Promise<ActionOutcome> {
  const db = ctx.db;
  const p = doc.payload;
  if (doc.kind === "lead") {
    const out = await createOrder(
      db,
      {
        studentName: str(p.studentName),
        phone: str(p.phone),
        referral: "",
        course: str(p.course),
        lessonDay: str(p.lessonDay),
        lessonStartTime: "",
        teacher: "",
        group: "",
        firstLessonDate: "",
        firstLessonTime: "",
        note: str(p.note),
      },
      { authorName: str(p.authorName), branchId: num(p.branchId) },
      deps,
    );
    if (!out.ok) return { ok: false, error: out.error };
    return {
      ok: true,
      resultText: `#${out.order.branchNo}`,
      resultHref: "/orders-list",
      result: { orderId: out.order.id, branchNo: out.order.branchNo },
    };
  }

  if (doc.kind === "transfer") {
    // Sana — tasdiqlangan kun; pul qabul qiluvchi ✓ bosmaguncha jo'natuvchida.
    const out = await applyCashboxTransferTo(
      db,
      {
        fromId: num(p.cashboxId),
        toCashboxId: num(p.toCashboxId),
        method: str(p.method),
        amount: num(p.amount),
        date: uzDateIso(),
        note: str(p.note),
        origin: "ai",
      },
      deps,
    );
    if (!out.ok) return { ok: false, error: out.error };
    return {
      ok: true,
      resultText: `#${out.outId}`,
      resultHref: "/finance-cash",
      result: { outEntryId: out.outId, inEntryId: out.inId },
    };
  }

  if (doc.kind === "comment") {
    // Muallif — tasdiqlayotgan xodim (qoralama faqat egasiga tasdiqlanadi), route bilan bir xil `users.fullName`.
    const out = await addPupilComment(db, { pupilId: num(p.pupilId), text: str(p.text), by: ctx.userName });
    if (!out.ok) return { ok: false, error: out.error };
    return { ok: true, resultText: `#${out.comment.id}`, resultHref: "", result: { commentId: out.comment.id } };
  }

  if (doc.kind === "task") {
    const v = await taskViewerOf(ctx);
    const out = await createStaffTasks(db, v, {
      title: p.title,
      desc: p.desc,
      deadline: p.deadline,
      priority: p.priority,
      link: p.link,
      employeeIds: p.employeeIds,
    });
    if (!out.ok) return { ok: false, error: out.error };
    const [first] = out.docs;
    return {
      ok: true,
      resultText: out.docs.length > 1 ? `#${first.id} … #${out.docs[out.docs.length - 1].id}` : `#${first.id}`,
      resultHref: "/tasks",
      result: { taskIds: out.docs.map((d) => d.id), batchId: first.batchId },
    };
  }

  const studentId = num(p.studentId);
  const out = await applyCashboxAdjust(
    db,
    {
      cashboxId: num(p.cashboxId),
      mode: doc.kind,
      method: str(p.method),
      amount: num(p.amount),
      category: str(p.category),
      teacherName: str(p.teacherName),
      studentName: str(p.studentName),
      ...(Number.isFinite(studentId) ? { studentId } : {}),
      // Sana — tasdiqlangan kun (pul hozir kirdi/chiqdi), bot bilan bir xil.
      date: uzDateIso(),
      note: str(p.note),
      ...(str(p.periodMonth) ? { periodMonth: str(p.periodMonth) } : {}),
      origin: "ai",
    },
    deps,
  );
  if (!out.ok) return { ok: false, error: out.error };
  return {
    ok: true,
    resultText: `#${out.entryId}`,
    resultHref: "/finance-cash",
    result: { entryId: out.entryId, cashboxBalance: out.cashbox.balance },
  };
}
