import type { Db, Filter } from "mongodb";
import type { InlineKeyboard } from "@/lib/telegramApi";
import { sendToStaff } from "@/lib/staffBot/api";
import { isStaffBotReady, loadStaffBotConfig, type StaffBotConfig } from "@/lib/staffBot/config";
import { taskAssigneePushKeyboard, taskGiverPushKeyboard } from "@/lib/staffBot/keyboards";
import { markBlocked, STAFF_BOT_USERS } from "@/lib/staffBot/session";
import * as V from "@/lib/staffBot/views";
import type { StaffTaskAction } from "@/lib/staffTaskActions";
import type { StaffTaskEvent } from "@/lib/staffTasks";
import { TASKS_COL, type StaffTaskDoc } from "@/lib/staffTasksServer";

// TOPSHIRIQLAR — XODIMLAR BOTIGA PUSH (17.10.2026). Foydalanuvchi:
// «topshiriqlarni botga ham qo'sh». Kim nima oladi:
//   ijrochi  — yangi topshiriq (✅ Bajardim tugmasi bilan), qaytarildi
//              (sabab, yangi muddat), tasdiqlandi, bekor qilindi;
//   bergan   — ijrochi «Bajardim» bosdi (✅ Tasdiqlash / ↩️ Qaytarish).
// Amal web'da (/tasks) yoki botda bajarilganidan qat'i nazar — chaqiruvlar
// app/api/staff-tasks/*, lib/ai/actions/execute.ts va lib/staffBot/tasks.ts da.
//
// KIMGA: `staff_bot_users` dagi kirgan (stage "in") va bloklamagan
// suhbatlar — ijrochi `employeeId` bo'yicha (parol bilan ham, raqam ulashib
// ham kirgan), bergan esa `users._id` bo'yicha (parol bilan kirgan) yoki
// xodim yozuvi bo'yicha raqam ulashib kirgan — unga tasdiqlash o'rniga parol
// bilan kirish taklif qilinadi (tasdiq rahbar huquqi, profil rejimida yo'q).
// Botni ochmagan odamga yozib bo'lmaydi (403) — `blocked` belgilanadi, u
// botga yozgach olinadi (touchStaffUser).
//
// HECH QACHON OTMAYDI: chaqiruvchi javobdan keyin (`after`/`defer`).

interface Target {
  chatId: number;
  viaContact: boolean;
}

async function targets(db: Db, filter: Filter<Record<string, unknown>>): Promise<Target[]> {
  const rows = await db
    .collection(STAFF_BOT_USERS)
    .find({ stage: "in", blocked: { $ne: true }, ...filter }, { projection: { _id: 0, chatId: 1, viaContact: 1 } })
    .toArray();
  return rows
    .map((r) => ({ chatId: Number(r.chatId), viaContact: r.viaContact === true }))
    .filter((t) => Number.isFinite(t.chatId));
}

async function sendAll(db: Db, cfg: StaffBotConfig, list: Target[], html: string, keyboard: (t: Target) => InlineKeyboard | undefined) {
  for (const t of list) {
    const sent = await sendToStaff(cfg, t.chatId, html, keyboard(t));
    if (!sent.ok) {
      if (sent.blocked) await markBlocked(db, t.chatId);
      else console.error("[staff-bot] topshiriq xabari ketmadi:", sent.error);
    }
  }
}

/** Yangi topshiriq(lar) — har biri o'z ijrochisiga. */
export async function notifyStaffTasksCreated(db: Db, docs: StaffTaskDoc[]): Promise<void> {
  try {
    const cfg = loadStaffBotConfig();
    if (!isStaffBotReady(cfg)) return;
    const nowMs = Date.now();
    for (const t of docs) {
      const list = await targets(db, { employeeId: t.employeeId });
      await sendAll(db, cfg, list, V.taskNewPush(t, nowMs), () => taskAssigneePushKeyboard(t.id));
    }
  } catch (e) {
    console.error("[staff-bot] notifyStaffTasksCreated:", e instanceof Error ? e.message : e);
  }
}

/**
 * Amaldan keyin. `actorChatId` — amal botda bajarilgan bo'lsa o'sha suhbat:
 * o'z amali haqida xabar olmasin (o'ziga bergan topshiriqda bo'lishi mumkin).
 */
export async function notifyStaffTaskAction(
  db: Db,
  taskId: number,
  action: StaffTaskAction,
  event: StaffTaskEvent,
  actorChatId?: number,
): Promise<void> {
  try {
    const cfg = loadStaffBotConfig();
    if (!isStaffBotReady(cfg)) return;
    const t = (await db.collection<StaffTaskDoc>(TASKS_COL).findOne({ id: taskId }, { projection: { _id: 0 } })) as StaffTaskDoc | null;
    if (!t) return;
    const notMe = (x: Target) => x.chatId !== actorChatId;

    if (action === "done") {
      const author = t.createdBy;
      const or: Filter<Record<string, unknown>>[] = [];
      if (author?.userId) or.push({ userId: author.userId });
      if (author?.employeeId !== null && author?.employeeId !== undefined) or.push({ employeeId: author.employeeId, viaContact: true });
      if (!or.length) return;
      const list = (await targets(db, { $or: or })).filter(notMe);
      await sendAll(db, cfg, list, V.taskDonePush(t), (x) => taskGiverPushKeyboard(t.id, !x.viaContact));
      return;
    }

    const list = (await targets(db, { employeeId: t.employeeId })).filter(notMe);
    if (action === "approve") {
      await sendAll(db, cfg, list, V.taskApprovedPush(t), () => undefined);
    } else if (action === "return") {
      await sendAll(db, cfg, list, V.taskReturnedPush(t, event.text ?? "", Date.now()), () => taskAssigneePushKeyboard(t.id));
    } else if (action === "cancel") {
      await sendAll(db, cfg, list, V.taskCancelledPush(t, event.text ?? ""), () => undefined);
    }
  } catch (e) {
    console.error("[staff-bot] notifyStaffTaskAction:", e instanceof Error ? e.message : e);
  }
}
