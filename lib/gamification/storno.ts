import type { Db } from "mongodb";
import { uzDateIso } from "@/lib/uzTime";
import type { GamActor } from "./actor";
import { toTxActor } from "./attendance";
import { GAM } from "./db";
import { pupilName } from "./ranking";
import { cancelDenial } from "./rights";
import { levelIndexOf } from "./rules";
import { loadSettings } from "./settings";
import { canSeePupil } from "./students";
import { txLabel, type CoinTransaction } from "./types";
import { computeWallet, GamError, isFrozenStatus, withWallet } from "./wallet";

// YOZUVNI BEKOR QILISH — STORNO (TZ 4.1.5, 4.11, 5.4).
//
// Yozuv o'chmaydi: «bekor qilindi» holatiga o'tadi, balansga ta'siri
// qaytariladi. Izoh majburiy. Oyna natijani OLDINDAN ko'rsatadi: balans
// X → Y, kechiriladigan qism (faqat direktor — tanga sarflangan bo'lsa),
// daraja o'zgarishi. Huquq — lib/gamification/rights.ts (bitta qoida).

async function loadTx(db: Db, id: number): Promise<CoinTransaction> {
  const tx = (await db.collection(GAM.tx).findOne({ id }, { projection: { _id: 0 } })) as unknown as CoinTransaction | null;
  if (!tx) throw new GamError(404, "Yozuv topilmadi");
  return tx;
}

async function loadCtx(db: Db, actor: GamActor, tx: CoinTransaction) {
  const p = await db
    .collection("pupils")
    .findOne({ id: tx.pupilId }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, status: 1, branchId: 1 } });
  if (!p || !(await canSeePupil(db, actor, { id: Number(p.id), branchId: p.branchId }))) throw new GamError(404, "Yozuv topilmadi");
  const branchId = Number.isFinite(Number(p.branchId)) && p.branchId !== null ? Number(p.branchId) : 1;
  return { p, branchId, frozen: isFrozenStatus(p.status) };
}

export async function cancelPreview(db: Db, actor: GamActor, txId: number) {
  const settings = await loadSettings(db);
  if (!settings.enabled) throw new GamError(409, "Gamifikatsiya moduli o'chiq");
  const tx = await loadTx(db, txId);
  const { p, branchId, frozen } = await loadCtx(db, actor, tx);
  if (tx.status === "cancelled") throw new GamError(409, "Yozuv allaqachon bekor qilingan");
  const w = await computeWallet(db, tx.pupilId);
  const deny = cancelDenial(actor, tx, { balance: w.balance, pupilBranchId: branchId, frozen, settings }, uzDateIso());
  const base = {
    pupilName: pupilName(p),
    tx: { id: tx.id, date: tx.date, label: txLabel(tx), amount: tx.amount, applied: tx.applied },
  };
  if (deny && deny.kind !== "spent") return { ...base, allowed: false, spent: false, message: deny.message };

  const after = tx.applied > 0 ? Math.max(0, w.balance - tx.applied) : w.balance - tx.applied;
  const notRecovered = tx.applied > 0 && w.balance < tx.applied ? tx.applied - w.balance : 0;
  const before = levelIndexOf(w.earnedTotal, settings.levels);
  const lvAfter = tx.amount > 0 && tx.type !== "shop" ? levelIndexOf(w.earnedTotal - tx.amount, settings.levels) : before;
  return {
    ...base,
    // Tanga sarflangan: admin/ustozga oyna bloklangan holda sababini yozadi (TZ 4.11.4).
    allowed: !deny,
    spent: deny?.kind === "spent",
    message: deny?.message ?? null,
    balanceBefore: w.balance,
    balanceAfter: after,
    notRecovered,
    levelBefore: settings.levels[before]?.name ?? "",
    levelAfter: settings.levels[lvAfter]?.name ?? "",
  };
}

export async function cancelTx(db: Db, actor: GamActor, txId: number, rawNote: unknown) {
  const settings = await loadSettings(db);
  if (!settings.enabled) throw new GamError(409, "Gamifikatsiya moduli o'chiq");
  const note = String(rawNote ?? "").trim().slice(0, 500);
  if (!note) throw new GamError(422, "Izoh yozish majburiy");
  const first = await loadTx(db, txId);
  const { branchId, frozen } = await loadCtx(db, actor, first);
  const { result, wallet } = await withWallet(db, first.pupilId, async (w) => {
    const tx = await loadTx(db, txId);
    if (tx.status === "cancelled") throw new GamError(409, "Yozuv allaqachon bekor qilingan");
    const deny = cancelDenial(actor, tx, { balance: w.balance, pupilBranchId: branchId, frozen, settings }, uzDateIso());
    if (deny) throw new GamError(403, deny.message);
    return w.cancel(tx, note, toTxActor(actor), actor.role === "director");
  });
  return { reversed: result.reversed, notRecovered: result.notRecovered, balance: wallet.balance };
}
