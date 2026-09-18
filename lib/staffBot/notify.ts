import type { Db } from "mongodb";
import { nameEq } from "@/lib/currentEmployee";
import { markBlocked, STAFF_BOT_USERS } from "@/lib/staffBot/session";
import { sendToStaff } from "@/lib/staffBot/api";
import { isStaffBotReady, loadStaffBotConfig } from "@/lib/staffBot/config";
import { transferDecisionKeyboard } from "@/lib/staffBot/keyboards";
import { transferPendingPush } from "@/lib/staffBot/views";

// Xodimlar botiga PUSH xabarlar — kassir tugma bosmagan, tizim o'zi yozadi.
//
// Hozircha bittasi: KO'CHIRMA KELDI. Filial kassiri kunlik tushumni
// rahbar kassaga jo'natganda (web'dan ham, botdan ham —
// lib/cashboxTransfer.ts) qabul qiluvchi kassaning egasi botda
// "📥 ko'chirma keldi" xabarini ✓/✗ tugmalari bilan oladi va tasdiqni
// telefondan bosadi (lib/staffBot/transfer.ts → decideTransferAs).
//
// KIMGA: `staff_bot_users` dagi kirgan (stage "in") va bloklamagan
// suhbatlar orasidan qabul qiluvchi kassaga "egalik qiladiganlar":
//   • kassaning `moderator` i (ism bo'yicha, web'dagi GET /api/cashboxes
//     qoidasi — nameEq);
//   • admin — tanlagan kassasi shu bo'lsa, yoki hech narsa tanlamagan
//     bo'lib kassa BOSH kassa bo'lsa (bot uchun sukut, lib/staffBot/auth.ts).
// Tugmani bosganda ruxsat baribir QAYTA tekshiriladi (decideTransferAs →
// ownsCashbox) — xabar kelgani ruxsat degani emas.
//
// HECH QACHON OTMAYDI: chaqiruvchi `defer` ichida, javob allaqachon ketgan.

export interface TransferPendingInfo {
  /** Pul KELAYOTGAN qatorning id'si — ✓/✗ shu id bilan ishlaydi. */
  inEntryId: number;
  toCashboxId: number;
  toCashboxName: string;
  fromCashboxName: string;
  amount: number;
  methodName: string;
  note: string;
}

export async function notifyTransferPending(db: Db, info: TransferPendingInfo): Promise<void> {
  try {
    const cfg = loadStaffBotConfig();
    if (!isStaffBotReady(cfg)) return;

    const cashbox = await db.collection("cashboxes").findOne(
      { id: info.toCashboxId },
      { projection: { _id: 0, moderator: 1, isPrimary: 1 } },
    );
    if (!cashbox) return;
    const moderator = String(cashbox.moderator ?? "").trim();

    const or: Record<string, unknown>[] = [];
    if (moderator) or.push({ name: nameEq(moderator) });
    or.push({ isAdmin: true, cashboxId: info.toCashboxId });
    if (cashbox.isPrimary === true) or.push({ isAdmin: true, cashboxId: { $exists: false } });

    const rows = await db.collection(STAFF_BOT_USERS)
      .find({ stage: "in", blocked: { $ne: true }, $or: or }, { projection: { _id: 0, chatId: 1 } })
      .toArray();
    const chatIds = rows.map((r) => Number(r.chatId)).filter((n) => Number.isFinite(n));
    if (chatIds.length === 0) return;

    const html = transferPendingPush(info);
    const keyboard = transferDecisionKeyboard(info.inEntryId);
    for (const chatId of chatIds) {
      const sent = await sendToStaff(cfg, chatId, html, keyboard);
      if (!sent.ok) {
        if (sent.blocked) await markBlocked(db, chatId);
        else console.error("[staff-bot] ko'chirma xabari ketmadi:", sent.error);
      }
    }
  } catch (e) {
    console.error("[staff-bot] notifyTransferPending:", e instanceof Error ? e.message : e);
  }
}
