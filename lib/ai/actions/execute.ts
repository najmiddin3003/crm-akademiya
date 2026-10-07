import type { Db } from "mongodb";
import { applyCashboxAdjust, type AdjustDeps } from "@/lib/cashboxAdjust";
import { createOrder } from "@/lib/ordersCreate";
import { findBotCashbox } from "@/lib/staffBot/auth";
import { uzDateIso } from "@/lib/uzTime";
import type { AiContext } from "../context";
import { ACTION_PAGES } from "./pages";
import type { ActionDoc, ActionOutcome } from "./store";

// TASDIQLANGAN QORALAMANI YOZISH — web va xodimlar boti chaqiradigan
// O'SHA yadrolar (lib/ordersCreate.ts, lib/cashboxAdjust.ts). Chegaralar
// (kassa qoldig'i, oylik qoldig'i, o'quvchi balansi, yopilgan oy, izohdagi
// oy) yadroda YANA bir bor tekshiriladi: qoralama tuzilgandan beri kassa
// yoki oylik o'zgargan bo'lishi mumkin.
//
// RUXSAT TASDIQ PAYTIDA QAYTA tekshiriladi (`checkAccess`) — qoralama
// tuzilgandan keyin admin xodimning ruxsatini olib qo'ygan yoki kassasini
// boshqa odamga bergan bo'lishi mumkin.

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
  // Kassa: admin — har qanday faol kassa; xodim — faqat o'zi mas'ul kassa (bot bilan bir xil qoida).
  const cashboxId = num(doc.payload.cashboxId);
  const cashbox = await findBotCashbox(ctx.db, {
    isAdmin: ctx.isAdmin,
    name: ctx.employeeName,
    ...(ctx.isAdmin ? { cashboxId } : {}),
  });
  return cashbox && cashbox.id === cashboxId ? null : { error: "Bu kassa sizga biriktirilmagan yoki arxivlangan" };
}

export async function executeAction(db: Db, doc: ActionDoc, deps: AdjustDeps): Promise<ActionOutcome> {
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
