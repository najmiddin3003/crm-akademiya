import type { Db } from "mongodb";
import { allBranchIds, employeeBranchIds } from "@/lib/branchScope";
import { createOrder } from "@/lib/ordersCreate";
import { formatLessonDays } from "@/lib/ordersData";
import { loadCourseNames, loadPupilHit, searchPupils } from "@/lib/staffBot/data";
import { newNonce, show, type CallbackResult, type FlowCtx } from "@/lib/staffBot/flow";
import {
  LEAD_CB,
  LEAD_DAY_PRESETS,
  afterLeadKeyboard,
  backToMenu,
  leadCancelOnly,
  leadConfirmArg,
  leadConfirmKeyboard,
  leadCourseArg,
  leadCourseKeyboard,
  leadDaysArg,
  leadDaysKeyboard,
  leadNoteKeyboard,
  leadStudentArg,
  leadStudentKeyboard,
} from "@/lib/staffBot/keyboards";
import {
  claimDraftForSave,
  liveDraft,
  releaseDraft,
  setDraft,
  type LeadDraft,
} from "@/lib/staffBot/session";
import * as V from "@/lib/staffBot/views";
import { formatPhone } from "@/lib/studentBot/phone";

// 📋 LID QO'SHISH — botdagi "Yangi buyurtma".
//
// Web'dagi yon oyna (components/orders/AddOrderModal.tsx) bilan bir xil
// MAJBURIY maydonlar: o'quvchi (CRM'da MAVJUD o'quvchi — oyna ham
// ro'yxatdan tanlatadi, telefon o'sha yozuvdan), kurs (Sozlamalar →
// Kurslar), dars kunlari. Ustiga izoh. Oynadagi ixtiyoriy maydonlar
// (referal, boshlanish vaqti, o'qituvchi, yig'ilayotgan guruh, birinchi
// dars sanasi) botda so'ralmaydi — ular keyin CRM'da to'ldiriladi:
// telefonda 9 qadamli so'rov lid qo'shishni sekinlashtirardi, lidning
// maqsadi esa tez qayd etish.
//
// FILIAL — kassaning filiali (web'da navbardagi tanlov). Kassasi yoki
// kassasida filiali yo'q xodimda — xodimning birinchi filiali, u ham
// bo'lmasa bazadagi birinchi filial (lib/branchScope.ts qoidasi).
// Yozishning o'zi yadroda (lib/ordersCreate.ts) — web bilan bitta kod:
// id, filial ichidagi raqam, manba, Telegram "Lidlar" topigi.

async function branchFor(db: Db, ctx: FlowCtx): Promise<{ id: number; name: string }> {
  let id = ctx.access.cashbox?.branchId;
  if (typeof id !== "number") {
    const mine = await employeeBranchIds(db, ctx.access.identity.employeeId);
    id = mine[0] ?? (await allBranchIds(db))[0] ?? 1;
  }
  const row = await db.collection("branches").findOne({ id }, { projection: { _id: 0, name: 1 } });
  return { id, name: typeof row?.name === "string" ? row.name : "" };
}

async function advance(ctx: FlowCtx, d: LeadDraft): Promise<void> {
  await setDraft(ctx.db, ctx.chatId, d);
}

// ── Qadamlar ────────────────────────────────────────────────────────

async function showStudent(ctx: FlowCtx, d: LeadDraft, branchName: string): Promise<void> {
  await show(ctx, { html: V.leadStudentPrompt(d, branchName), keyboard: leadCancelOnly() });
}

async function showCourse(ctx: FlowCtx, d: LeadDraft, branchName: string): Promise<void> {
  const names = await loadCourseNames(ctx.db);
  if (names.length === 0) {
    await setDraft(ctx.db, ctx.chatId, null);
    await show(ctx, { html: V.leadNoCourses(), keyboard: backToMenu() });
    return;
  }
  await show(ctx, { html: V.leadCoursePrompt(d, branchName), keyboard: leadCourseKeyboard(names) });
}

async function showDays(ctx: FlowCtx, d: LeadDraft, branchName: string): Promise<void> {
  await show(ctx, { html: V.leadDaysPrompt(d, branchName), keyboard: leadDaysKeyboard() });
}

async function showNote(ctx: FlowCtx, d: LeadDraft, branchName: string): Promise<void> {
  await show(ctx, { html: V.leadNotePrompt(d, branchName), keyboard: leadNoteKeyboard() });
}

async function showConfirm(ctx: FlowCtx, d: LeadDraft, branchName: string, note?: string): Promise<void> {
  const body = V.leadConfirmView(d, branchName, ctx.access.identity.name);
  await show(ctx, { html: note ? `${note}\n\n${body}` : body, keyboard: leadConfirmKeyboard(d.nonce) });
}

async function showCurrent(ctx: FlowCtx, d: LeadDraft, branchName: string): Promise<void> {
  switch (d.step) {
    case "student": return showStudent(ctx, d, branchName);
    case "course": return showCourse(ctx, d, branchName);
    case "days": return showDays(ctx, d, branchName);
    case "note": return showNote(ctx, d, branchName);
    default: return showConfirm(ctx, d, branchName);
  }
}

async function stale(ctx: FlowCtx, d: LeadDraft, branchName: string, toast = "Bu tugma eskirgan"): Promise<CallbackResult> {
  await showCurrent(ctx, d, branchName);
  return { handled: true, toast };
}

// ── Kirish nuqtalari ────────────────────────────────────────────────

/** "📋 Lid qo'shish" bosildi. */
export async function startLead(ctx: FlowCtx): Promise<void> {
  if (!ctx.access.canLead) {
    await show(ctx, { html: V.noLeadPermission(), keyboard: backToMenu() });
    return;
  }
  const branch = await branchFor(ctx.db, ctx);
  const d: LeadDraft = { kind: "lead", step: "student", nonce: newNonce(), updatedAt: Date.now() };
  await advance(ctx, d);
  await showStudent(ctx, d, branch.name);
}

export async function leadCallback(ctx: FlowCtx, data: string): Promise<CallbackResult> {
  if (!data.startsWith("s:l:")) return { handled: false };

  if (data === LEAD_CB.cancel) {
    await setDraft(ctx.db, ctx.chatId, null);
    await show(ctx, { html: V.leadCancelled(), keyboard: backToMenu() });
    return { handled: true };
  }
  if (data === LEAD_CB.restart) {
    await startLead(ctx);
    return { handled: true };
  }
  if (!ctx.access.canLead) {
    await setDraft(ctx.db, ctx.chatId, null);
    await show(ctx, { html: V.noLeadPermission(), keyboard: backToMenu() });
    return { handled: true };
  }
  const branch = await branchFor(ctx.db, ctx);

  const nonce = leadConfirmArg(data);
  if (nonce) {
    const claimed = await claimDraftForSave(ctx.db, ctx.chatId, nonce, "lead");
    if (!claimed) return { handled: true, toast: V.alreadySaved() };
    await saveLead(ctx, claimed, branch);
    return { handled: true };
  }

  const d = liveDraft(ctx.user);
  if (!d || d.kind !== "lead") {
    await show(ctx, { html: V.draftExpired(), keyboard: backToMenu() });
    return { handled: true };
  }
  if (d.step === "saving") return { handled: true, toast: "Saqlanmoqda…" };

  const pupilId = leadStudentArg(data);
  if (pupilId !== null) {
    if (d.step !== "student") return stale(ctx, d, branch.name);
    const hit = await loadPupilHit(ctx.db, pupilId);
    if (!hit) return stale(ctx, d, branch.name, "O'quvchi topilmadi");
    const next: LeadDraft = { ...d, studentId: hit.id, studentName: hit.name, studentPhone: hit.phone, step: "course" };
    await advance(ctx, next);
    await showCourse(ctx, next, branch.name);
    return { handled: true };
  }

  const courseIdx = leadCourseArg(data);
  if (courseIdx !== null) {
    if (d.step !== "course") return stale(ctx, d, branch.name);
    const names = await loadCourseNames(ctx.db);
    const course = names[courseIdx];
    if (!course) return stale(ctx, d, branch.name, "Bu kurs endi yo'q");
    const next: LeadDraft = { ...d, course, step: "days" };
    await advance(ctx, next);
    await showDays(ctx, next, branch.name);
    return { handled: true };
  }

  const daysKey = leadDaysArg(data);
  if (daysKey !== null) {
    if (d.step !== "days") return stale(ctx, d, branch.name);
    const preset = LEAD_DAY_PRESETS.find((p) => p.key === daysKey);
    if (!preset) return stale(ctx, d, branch.name, "Tugma tanilmadi");
    const next: LeadDraft = { ...d, lessonDay: formatLessonDays(preset.codes), step: "note" };
    await advance(ctx, next);
    await showNote(ctx, next, branch.name);
    return { handled: true };
  }

  if (data === LEAD_CB.noteSkip) {
    if (d.step !== "note") return stale(ctx, d, branch.name);
    const next: LeadDraft = { ...d, note: "", step: "confirm" };
    await advance(ctx, next);
    await showConfirm(ctx, next, branch.name);
    return { handled: true };
  }

  return stale(ctx, d, branch.name, "Tugma tanilmadi");
}

/** Matn keldi. `true` — qoralama uni qabul qildi. */
export async function leadText(ctx: FlowCtx, text: string): Promise<boolean> {
  const d = liveDraft(ctx.user);
  if (!d || d.kind !== "lead") return false;
  if (!ctx.access.canLead) return false;
  const branch = await branchFor(ctx.db, ctx);

  switch (d.step) {
    case "student": {
      const q = text.trim();
      // Qidiruv KASSANING filiali bo'yicha (o'quvchilar hovuzi bilan) —
      // Kirim bilan bir xil; kassasiz xodimda qamrovsiz.
      const found = await searchPupils(ctx.db, q, ctx.access.cashbox?.branchId);
      if (!found) {
        await show(ctx, { html: V.leadQueryTooShort(d, branch.name), keyboard: leadCancelOnly() });
        return true;
      }
      if (found.hits.length === 0) {
        await show(ctx, { html: V.leadStudentNotFound(d, branch.name, q), keyboard: leadCancelOnly() });
        return true;
      }
      await show(ctx, {
        html: V.leadStudentResults(d, branch.name, q, found.hits.length, found.more),
        keyboard: leadStudentKeyboard(
          found.hits.map((h) => ({ id: h.id, label: h.phone ? `${h.name} · ${formatPhone(h.phone)}` : h.name })),
        ),
      });
      return true;
    }
    case "note": {
      const next: LeadDraft = { ...d, note: text.trim().slice(0, 500), step: "confirm" };
      await advance(ctx, next);
      await showConfirm(ctx, next, branch.name);
      return true;
    }
    default:
      await showCurrent(ctx, d, branch.name);
      return true;
  }
}

// ── Yozish ──────────────────────────────────────────────────────────

async function saveLead(ctx: FlowCtx, d: LeadDraft, branch: { id: number; name: string }): Promise<void> {
  if (!d.studentName || !d.course || !d.lessonDay) {
    await releaseDraft(ctx.db, ctx.chatId, d.nonce);
    await showConfirm(ctx, d, branch.name, V.leadFailed("qoralama to'liq emas"));
    return;
  }
  const out = await createOrder(
    ctx.db,
    {
      studentName: d.studentName,
      // Telefon o'quvchining yozuvidan — web oynasi ham shunday (phoneFor).
      phone: d.studentPhone ?? "",
      referral: "",
      course: d.course,
      lessonDay: d.lessonDay,
      lessonStartTime: "",
      teacher: "",
      group: "",
      firstLessonDate: "",
      firstLessonTime: "",
      note: d.note ?? "",
    },
    { authorName: ctx.access.identity.name, branchId: branch.id },
    { defer: ctx.defer },
  );
  if (!out.ok) {
    await releaseDraft(ctx.db, ctx.chatId, d.nonce);
    await showConfirm(ctx, d, branch.name, V.leadFailed(out.error));
    return;
  }
  await setDraft(ctx.db, ctx.chatId, null);
  await show(ctx, {
    html: V.leadSaved(d, branch.name, out.order.id, out.order.branchNo),
    keyboard: afterLeadKeyboard(),
  });
}
