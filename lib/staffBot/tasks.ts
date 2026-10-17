import type { Db } from "mongodb";
import type { StaffAccess } from "@/lib/staffBot/auth";
import { publicSiteUrl } from "@/lib/staffBot/config";
import { auditBot, newNonce, show, type CallbackResult, type FlowCtx } from "@/lib/staffBot/flow";
import {
  TASK_CB,
  TASK_LIST_MAX,
  afterTaskKeyboard,
  backToMenu,
  taskApproveSureKeyboard,
  taskCardKeyboard,
  taskCbArg,
  taskDoneNoteKeyboard,
  taskListKeyboard,
  taskReturnDeadlineKeyboard,
  taskReturnNoteKeyboard,
} from "@/lib/staffBot/keyboards";
import { liveDraft, setDraft, type TaskDraft } from "@/lib/staffBot/session";
import { notifyStaffTaskAction } from "@/lib/staffBot/taskNotify";
import * as V from "@/lib/staffBot/views";
import { applyStaffTaskAction, markStaffTaskSeen } from "@/lib/staffTaskActions";
import { ACTIVE_STATUSES, OPEN_STATUSES, STATUS_RANK, isActive, ms, quickDeadlines } from "@/lib/staffTasks";
import {
  TASKS_COL,
  TEXT_MAX,
  canManage,
  canSee,
  isAssignee,
  loadViewer,
  runAutomation,
  type StaffTaskDoc,
  type StaffTaskViewer,
} from "@/lib/staffTasksServer";

// 📌 TOPSHIRIQLAR — xodimlar botida (17.10.2026). Foydalanuvchi: «topshiriqlarni
// botga ham qo'sh hamda rahbar oynasiga o'zi bergan topshiriqlarni ham
// ko'rinadigan qil».
//
//   📥 Menga berilgan — ochiq topshiriqlarim; kartada «✅ Bajardim» (izoh
//      ixtiyoriy — web'dagi kabi; fayl/havola saytda).
//   📤 Men bergan    — rahbar o'zi bergan ochiq topshiriqlar; tasdiq
//      kutayotganida «✅ Tasdiqlash» (ikki bosish) va «↩️ Qaytarish» (sabab
//      majburiy + yangi muddat tugmasi).
//
// QOIDALAR WEB BILAN BITTA: kim ko'radi/boshqaradi — lib/staffTasksServer.ts
// (canSee/canManage, loadViewer), amallar — lib/staffTaskActions.ts. Amal
// oldidan avtomatika majburiy yuritiladi (web route bilan bir xil). Raqam
// ulashib kirgan (parolsiz) xodim — oddiy ijrochi: o'z topshirig'ini ko'radi
// va «Bajardim» bosadi; tasdiqlash/qaytarish uchun parol bilan kiriladi.
//
// Push xabarlar (yangi topshiriq, Bajardim, tasdiq …) — lib/staffBot/taskNotify.ts.

/** Bot foydalanuvchisi topshiriqlar qoidasida kim — web'dagi `loadViewer` dan. */
export async function taskViewerFor(db: Db, access: StaffAccess): Promise<StaffTaskViewer> {
  const id = access.identity;
  if (access.profileOnly || !id.userId) {
    return { role: "xodim", userId: "", employeeId: id.employeeId, name: id.name, branchIds: [] };
  }
  return loadViewer(db, {
    id: id.userId,
    role: id.isAdmin ? "admin" : "employee",
    permissions: access.permissions,
    hrEmployeeId: id.employeeId,
    fullName: id.name,
  });
}

/** Bosh menyu tugmasidagi son: menga berilgan faollar + tasdig'imni kutayotganlar. */
export async function taskMenuCount(db: Db, access: StaffAccess): Promise<number> {
  try {
    const id = access.identity;
    const col = db.collection(TASKS_COL);
    const [mine, waiting] = await Promise.all([
      id.employeeId === null ? 0 : col.countDocuments({ employeeId: id.employeeId, status: { $in: [...ACTIVE_STATUSES] } }),
      access.profileOnly || !id.userId ? 0 : col.countDocuments({ "createdBy.userId": id.userId, status: "tasdiq_kutilmoqda" }),
    ]);
    return mine + waiting;
  } catch {
    return 0; // son — bezak; menyu sonsiz ham chiziladi
  }
}

const byRank = (a: StaffTaskDoc, b: StaffTaskDoc) =>
  STATUS_RANK[a.status] - STATUS_RANK[b.status] || ms(a.deadline) - ms(b.deadline);

async function loadMine(db: Db, v: StaffTaskViewer): Promise<StaffTaskDoc[]> {
  if (v.employeeId === null) return [];
  const rows = await db
    .collection<StaffTaskDoc>(TASKS_COL)
    .find({ employeeId: v.employeeId, status: { $in: [...OPEN_STATUSES] } }, { projection: { _id: 0 } })
    .toArray();
  return (rows as StaffTaskDoc[]).sort(byRank);
}

async function loadGiven(db: Db, v: StaffTaskViewer): Promise<StaffTaskDoc[]> {
  if (!v.userId) return [];
  const rows = await db
    .collection<StaffTaskDoc>(TASKS_COL)
    .find({ "createdBy.userId": v.userId, status: { $in: [...OPEN_STATUSES] } }, { projection: { _id: 0 } })
    .toArray();
  return (rows as StaffTaskDoc[]).sort(byRank);
}

/** Ko'rinadigan topshiriq — bo'lmasa (yoki huquq yo'q) null. `force` — amal oldidan avtomatika. */
async function loadVisible(db: Db, v: StaffTaskViewer, id: number, force: boolean): Promise<StaffTaskDoc | null> {
  await runAutomation(db, { force });
  const doc = (await db.collection<StaffTaskDoc>(TASKS_COL).findOne({ id }, { projection: { _id: 0 } })) as StaffTaskDoc | null;
  return doc && canSee(v, doc) ? doc : null;
}

const siteLink = (id: number) => `${publicSiteUrl()}/tasks?open=${id}`;
const withPrefix = (prefix: string | undefined, html: string) => (prefix ? `${prefix}\n\n${html}` : html);

async function clearTaskDraft(ctx: FlowCtx): Promise<void> {
  if (ctx.user.draft?.kind === "task") await setDraft(ctx.db, ctx.chatId, null);
}

// ── Ekranlar ────────────────────────────────────────────────────────

async function showMine(ctx: FlowCtx, v: StaffTaskViewer, prefix?: string): Promise<void> {
  await runAutomation(ctx.db);
  const tasks = await loadMine(ctx.db, v);
  const shown = tasks.slice(0, TASK_LIST_MAX);
  await show(ctx, {
    html: withPrefix(prefix, V.myTasksView(tasks, shown.length)),
    keyboard: taskListKeyboard(
      shown.map((t) => ({ id: t.id, label: V.taskButtonLabel(t, false) })),
      { switchTo: v.role === "xodim" ? null : "given" },
    ),
  });
}

async function showGiven(ctx: FlowCtx, v: StaffTaskViewer): Promise<void> {
  if (v.role === "xodim") {
    // Raqam ulashib kirgan rahbar — parol bilan kirsin; oddiy xodim — o'z ro'yxatiga.
    if (ctx.access.profileOnly && ctx.access.webLogin) {
      await show(ctx, { html: V.taskNeedsPassword(), keyboard: backToMenu() });
      return;
    }
    await showMine(ctx, v);
    return;
  }
  await runAutomation(ctx.db);
  const tasks = await loadGiven(ctx.db, v);
  const shown = tasks.slice(0, TASK_LIST_MAX);
  await show(ctx, {
    html: V.givenTasksView(tasks, shown.length),
    keyboard: taskListKeyboard(
      shown.map((t) => ({ id: t.id, label: V.taskButtonLabel(t, true) })),
      { switchTo: "mine" },
    ),
  });
}

async function showCard(ctx: FlowCtx, v: StaffTaskViewer, doc: StaffTaskDoc, prefix?: string): Promise<void> {
  const mine = isAssignee(v, doc);
  // Ijrochi birinchi marta ochdi — «Ko'rildi» (web'dagi `?seen=1` bilan bir xil).
  if (mine) await markStaffTaskSeen(ctx.db, v, doc);
  await show(ctx, {
    html: withPrefix(prefix, V.taskCardView(doc, mine ? "mine" : "given", Date.now())),
    keyboard: taskCardKeyboard({
      id: doc.id,
      canDone: mine && isActive(doc.status),
      canDecide: canManage(v, doc) && doc.status === "tasdiq_kutilmoqda",
      back: mine ? "mine" : "given",
      site: siteLink(doc.id),
    }),
  });
}

// ── Amallar ─────────────────────────────────────────────────────────

/** Amal rad etildi — topshiriq yangilangan holda, xato bilan ko'rsatiladi. */
async function failed(ctx: FlowCtx, v: StaffTaskViewer, id: number, error: string): Promise<void> {
  const fresh = await loadVisible(ctx.db, v, id, false);
  if (fresh) await showCard(ctx, v, fresh, V.taskActionFailed(error));
  else await show(ctx, { html: V.taskNotFound(), keyboard: afterTaskKeyboard("mine") });
}

async function submitDone(ctx: FlowCtx, v: StaffTaskViewer, doc: StaffTaskDoc, note: string): Promise<void> {
  const out = await applyStaffTaskAction(ctx.db, v, doc, "done", { note });
  await clearTaskDraft(ctx);
  if (!out.ok) {
    await failed(ctx, v, doc.id, out.error);
    return;
  }
  const late = out.event.late === true;
  auditBot(ctx, "tasks", "staff_task_done", { taskId: doc.id, title: doc.title, late }, doc.id);
  ctx.defer(() => notifyStaffTaskAction(ctx.db, doc.id, "done", out.event, ctx.chatId));
  await show(ctx, { html: V.taskDoneSent(doc, late), keyboard: afterTaskKeyboard("mine") });
}

async function submitApprove(ctx: FlowCtx, v: StaffTaskViewer, doc: StaffTaskDoc): Promise<boolean> {
  const out = await applyStaffTaskAction(ctx.db, v, doc, "approve", {});
  if (!out.ok) {
    await failed(ctx, v, doc.id, out.error);
    return false;
  }
  auditBot(ctx, "tasks", "staff_task_approve", { taskId: doc.id, title: doc.title, employee: doc.employeeName }, doc.id);
  ctx.defer(() => notifyStaffTaskAction(ctx.db, doc.id, "approve", out.event, ctx.chatId));
  await show(ctx, { html: V.taskApprovedView(doc), keyboard: afterTaskKeyboard("given") });
  return true;
}

async function submitReturn(ctx: FlowCtx, v: StaffTaskViewer, doc: StaffTaskDoc, note: string, deadline: string): Promise<void> {
  const out = await applyStaffTaskAction(ctx.db, v, doc, "return", { note, deadline });
  await clearTaskDraft(ctx);
  if (!out.ok) {
    await failed(ctx, v, doc.id, out.error);
    return;
  }
  auditBot(ctx, "tasks", "staff_task_return", { taskId: doc.id, title: doc.title, employee: doc.employeeName, deadline }, doc.id);
  ctx.defer(() => notifyStaffTaskAction(ctx.db, doc.id, "return", out.event, ctx.chatId));
  await show(ctx, { html: V.taskReturnedView(doc, deadline), keyboard: afterTaskKeyboard("given") });
}

/** Rahbar amali — profil rejimida parol so'raladi, huquq bo'lmasa sababi aytiladi. */
async function denyDecision(ctx: FlowCtx, v: StaffTaskViewer, doc: StaffTaskDoc): Promise<boolean> {
  if (ctx.access.profileOnly) {
    await show(ctx, { html: V.taskNeedsPassword(), keyboard: backToMenu() });
    return true;
  }
  if (!canManage(v, doc)) {
    await showCard(ctx, v, doc, V.taskActionFailed("Bu amal uchun ruxsatingiz yo'q"));
    return true;
  }
  if (doc.status !== "tasdiq_kutilmoqda") {
    await showCard(ctx, v, doc, V.taskActionFailed("Faqat tasdiq kutayotgan topshiriqda — holati o'zgargan"));
    return true;
  }
  return false;
}

// ── Kirish nuqtalari (lib/staffBot/router.ts) ──────────────────────

export async function tasksCallback(ctx: FlowCtx, data: string): Promise<CallbackResult> {
  if (!data.startsWith("s:v:")) return { handled: false };
  const v = await taskViewerFor(ctx.db, ctx.access);

  if (data === TASK_CB.mine) {
    await clearTaskDraft(ctx);
    await showMine(ctx, v);
    return { handled: true };
  }
  if (data === TASK_CB.given) {
    await clearTaskDraft(ctx);
    await showGiven(ctx, v);
    return { handled: true };
  }

  const arg = taskCbArg(data);
  if (!arg) return { handled: true, toast: "Tugma tanilmadi" };

  const doc = await loadVisible(ctx.db, v, arg.id, arg.op !== "open");
  if (!doc) {
    await clearTaskDraft(ctx);
    await show(ctx, { html: V.taskNotFound(), keyboard: afterTaskKeyboard("mine") });
    return { handled: true };
  }

  switch (arg.op) {
    case "open":
      await clearTaskDraft(ctx);
      await showCard(ctx, v, doc);
      return { handled: true };

    case "done": {
      if (!isAssignee(v, doc)) {
        await showCard(ctx, v, doc, V.taskActionFailed("«Bajardim» ni faqat topshiriq berilgan xodim bosadi"));
        return { handled: true };
      }
      if (!isActive(doc.status)) {
        await showCard(ctx, v, doc, V.taskActionFailed("Bu topshiriq allaqachon yopilgan yoki tasdiq kutmoqda"));
        return { handled: true };
      }
      const draft: TaskDraft = { kind: "task", step: "done_note", taskId: doc.id, nonce: newNonce(), updatedAt: Date.now() };
      await setDraft(ctx.db, ctx.chatId, draft);
      await show(ctx, { html: V.taskDonePrompt(doc), keyboard: taskDoneNoteKeyboard(doc.id) });
      return { handled: true };
    }

    case "doneNoNote":
      await submitDone(ctx, v, doc, "");
      return { handled: true };

    case "approve":
      if (await denyDecision(ctx, v, doc)) return { handled: true };
      await show(ctx, { html: V.taskApproveSure(doc), keyboard: taskApproveSureKeyboard(doc.id) });
      return { handled: true };

    case "approveSure": {
      if (await denyDecision(ctx, v, doc)) return { handled: true };
      const ok = await submitApprove(ctx, v, doc);
      return { handled: true, toast: ok ? "Tasdiqlandi" : "" };
    }

    case "return": {
      if (await denyDecision(ctx, v, doc)) return { handled: true };
      const draft: TaskDraft = { kind: "task", step: "return_note", taskId: doc.id, nonce: newNonce(), updatedAt: Date.now() };
      await setDraft(ctx.db, ctx.chatId, draft);
      await show(ctx, { html: V.taskReturnPrompt(doc), keyboard: taskReturnNoteKeyboard(doc.id) });
      return { handled: true };
    }

    case "returnAt": {
      if (await denyDecision(ctx, v, doc)) return { handled: true };
      const d = liveDraft(ctx.user);
      const pick = d?.kind === "task" && d.step === "return_deadline" && d.taskId === doc.id && arg.arg !== undefined
        ? d.deadlines?.[arg.arg]
        : undefined;
      if (!d || d.kind !== "task" || !pick || !d.note) {
        // Eski xabardagi tugma yoki qoralama eskirgan — qaytadan boshlansin.
        await clearTaskDraft(ctx);
        await showCard(ctx, v, doc, V.taskActionFailed("Bu tugma eskirgan — «↩️ Qaytarish» ni qaytadan bosing"));
        return { handled: true };
      }
      await submitReturn(ctx, v, doc, d.note, pick.at);
      return { handled: true };
    }
  }
}

/**
 * Matn — faqat topshiriq qoralamasi bor bo'lsa (izoh yoki qaytarish sababi).
 * `false` — bu oqimga tegishli emas, router boshqa oqimlarga beradi.
 */
export async function tasksText(ctx: FlowCtx, text: string): Promise<boolean> {
  const d = liveDraft(ctx.user);
  if (!d || d.kind !== "task") return false;
  const v = await taskViewerFor(ctx.db, ctx.access);
  const doc = await loadVisible(ctx.db, v, d.taskId, true);
  if (!doc) {
    await setDraft(ctx.db, ctx.chatId, null);
    await show(ctx, { html: V.taskNotFound(), keyboard: afterTaskKeyboard("mine") });
    return true;
  }
  const clean = text.trim().slice(0, TEXT_MAX);

  if (d.step === "done_note") {
    await submitDone(ctx, v, doc, clean);
    return true;
  }

  if (d.step === "return_note") {
    if (await denyDecision(ctx, v, doc)) {
      await setDraft(ctx.db, ctx.chatId, null);
      return true;
    }
    if (!clean) {
      await show(ctx, { html: V.taskReturnPrompt(doc), keyboard: taskReturnNoteKeyboard(doc.id) });
      return true;
    }
    const options = quickDeadlines(Date.now()).map((q) => ({ label: q.label, at: new Date(q.at).toISOString() }));
    await setDraft(ctx.db, ctx.chatId, { ...d, step: "return_deadline", note: clean, deadlines: options });
    await show(ctx, {
      html: V.taskReturnDeadlinePrompt(doc, clean, options.length > 0),
      keyboard: taskReturnDeadlineKeyboard(doc.id, options),
    });
    return true;
  }

  // return_deadline — tugma o'rniga matn yozildi: tanlov qayta ko'rsatiladi.
  const options = d.deadlines ?? [];
  await show(ctx, {
    html: V.taskReturnDeadlinePrompt(doc, d.note ?? "", options.length > 0),
    keyboard: taskReturnDeadlineKeyboard(doc.id, options),
  });
  return true;
}
