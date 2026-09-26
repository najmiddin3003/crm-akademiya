import type { Db } from "mongodb";
import { GAM, isDupKey, nextSeq, withLock } from "./db";
import { levelIndexOf } from "./rules";
import { loadSettings } from "./settings";
import type { CoinTransaction, GamLevel, StudentWallet, TxCreatorRole, TxType } from "./types";

// HAMYON DVIGATELI (TZ 4.1).
//
// Balansni to'g'ridan-to'g'ri o'zgartirish YO'Q — har harakat
// `coin_transactions` ga yoziladi. Yozuvda ikki miqdor:
//   amount  — so'ralgan (ishorali): reyting, musobaqa, kunlik limit shu bo'yicha;
//   applied — balansga haqiqiy ta'sir: ayirishda −min(|amount|, balans),
//             berishda va xaridda = amount (xariddan oldin balans tekshiriladi).
// Bekor qilishda `reversed` — balansga haqiqiy qaytgan ta'sir (TZ 4.1.5).
//
// INVARIANT: balans = Σ applied (hamma yozuvlar) + Σ reversed (bekor
// qilinganlar) ≥ 0;  jami topilgan = Σ amount (amount > 0, xarid emas, faol).
//
// Hamma balans amallari `withWallet` ichida — o'quvchi bo'yicha qulf
// ostida (db.ts izohi): holat qulf ichida yozuvlardan qayta o'qiladi, oxirida
// kesh (`student_wallets` va `pupils.coin`) yozuvlardan qayta hisoblanadi.

export class GamError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface TxActor {
  userId: string | null;
  name: string;
  role: TxCreatorRole;
}

/** Tizim yozuvlari muallifi — «Davomat (avto)», «Sarhisob (avto)» (TZ 6.4). */
export function systemActor(name: string): TxActor {
  return { userId: null, name, role: "system" };
}

export interface PupilInfo {
  id: number;
  name: string;
  branchId: number;
  status: string;
  /** Markazdan ketgan — hamyoni muzlatilgan (TZ 4.21). */
  frozen: boolean;
}

/** O'quvchi holati «Aktiv» emas (Muzlatilgan yoki Arxiv) — hamyon muzlatilgan. */
export function isFrozenStatus(status: unknown): boolean {
  const s = String(status ?? "Aktiv");
  return s === "Muzlatilgan" || s === "Arxiv";
}

export async function loadPupil(db: Db, pupilId: number): Promise<PupilInfo | null> {
  const p = await db
    .collection("pupils")
    .findOne({ id: pupilId }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, branchId: 1, status: 1 } });
  if (!p) return null;
  const name = `${String(p.firstName ?? "").trim()} ${String(p.lastName ?? "").trim()}`.trim() || `#${pupilId}`;
  return {
    id: pupilId,
    name,
    branchId: Number.isFinite(Number(p.branchId)) && p.branchId !== null ? Number(p.branchId) : 1,
    status: String(p.status ?? "Aktiv"),
    frozen: isFrozenStatus(p.status),
  };
}

/** Hamyon holati — faqat yozuvlardan (kesh ishlatilmaydi). */
export async function computeWallet(db: Db, pupilId: number): Promise<{ balance: number; earnedTotal: number }> {
  const [r] = await db
    .collection(GAM.tx)
    .aggregate<{ applied: number; reversed: number; earned: number }>([
      { $match: { pupilId } },
      {
        $group: {
          _id: null,
          applied: { $sum: "$applied" },
          reversed: { $sum: { $ifNull: ["$reversed", 0] } },
          earned: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ["$amount", 0] }, { $ne: ["$type", "shop"] }, { $eq: ["$status", "active"] }] },
                "$amount",
                0,
              ],
            },
          },
        },
      },
    ])
    .toArray();
  return { balance: (r?.applied ?? 0) + (r?.reversed ?? 0), earnedTotal: r?.earned ?? 0 };
}

/**
 * Keshni yozadi. `pupils.coin` ham yangilanadi — o'quvchilar ro'yxati,
 * guruh sahifasi, o'quvchi boti va Mini App uni o'qiydi.
 *
 * `known` berilmasa — yozuvlardan qayta hisoblanadi. Qulf ostidagi sessiya
 * o'z holatini beradi: u sessiya boshida yozuvlardan o'qilgan va har amalda
 * aniq yuritilgan, qulf esa boshqa yozuvchini kiritmaydi.
 */
export async function syncWallet(
  db: Db,
  pupilId: number,
  levels: GamLevel[],
  known?: { balance: number; earnedTotal: number },
): Promise<StudentWallet> {
  const s = known ?? (await computeWallet(db, pupilId));
  const wallet: StudentWallet = {
    pupilId,
    balance: s.balance,
    earnedTotal: s.earnedTotal,
    levelPosition: levelIndexOf(s.earnedTotal, levels) + 1,
    updatedAt: new Date().toISOString(),
  };
  await db.collection(GAM.wallets).updateOne({ pupilId }, { $set: wallet }, { upsert: true });
  await db.collection("pupils").updateOne({ id: pupilId }, { $set: { coin: wallet.balance } });
  return wallet;
}

export interface NewTx {
  groupId: number | null;
  date: string;
  type: TxType;
  reasonId?: number | null;
  reasonName?: string | null;
  amount: number;
  note: string;
  actor: TxActor;
  /** Takrorlanmasligi shart bo'lgan yozuv kaliti (unique indeks) — masalan davomat. */
  uniqKey?: string;
  examMonth?: string | null;
  examPercent?: number | null;
  examId?: number | null;
  leadId?: number | null;
  shopOrderId?: number | null;
}

export interface LevelUp {
  from: number;
  to: number;
  name: string;
}

/** Qulf ostidagi hamyon — holat xotirada, har amal bazaga darhol yoziladi. */
export class WalletSession {
  constructor(
    readonly db: Db,
    readonly pupil: PupilInfo,
    public balance: number,
    public earnedTotal: number,
  ) {}

  async add(t: NewTx): Promise<CoinTransaction> {
    if (!Number.isInteger(t.amount) || t.amount === 0) throw new GamError(422, "Miqdor butun son bo'lsin");
    let applied: number;
    if (t.type === "shop") {
      const price = -t.amount;
      if (this.balance < price) {
        const balance = this.balance;
        throw new GamError(422, `Tanga yetmaydi (${balance} / ${price})`);
      }
      applied = t.amount;
    } else if (t.amount < 0) {
      applied = -Math.min(-t.amount, this.balance);
    } else {
      applied = t.amount;
    }

    const tx: CoinTransaction = {
      id: await nextSeq(this.db, GAM.tx),
      pupilId: this.pupil.id,
      groupId: t.groupId,
      branchId: this.pupil.branchId,
      date: t.date,
      type: t.type,
      reasonId: t.reasonId ?? null,
      reasonName: t.reasonName ?? null,
      amount: t.amount,
      applied,
      note: t.note,
      createdByUserId: t.actor.userId,
      createdByName: t.actor.name,
      createdByRole: t.actor.role,
      createdAt: new Date().toISOString(),
      status: "active",
      examMonth: t.examMonth ?? null,
      examPercent: t.examPercent ?? null,
      examId: t.examId ?? null,
      leadId: t.leadId ?? null,
      shopOrderId: t.shopOrderId ?? null,
    };
    try {
      await this.db.collection(GAM.tx).insertOne({ ...tx, ...(t.uniqKey ? { uniqKey: t.uniqKey } : {}) });
    } catch (e) {
      if (isDupKey(e)) throw new GamError(409, "Bu yozuv allaqachon bor");
      throw e;
    }
    this.balance += applied;
    if (t.amount > 0 && t.type !== "shop") this.earnedTotal += t.amount;
    return tx;
  }

  /**
   * Yozuvni bekor qilish (storno, TZ 4.1.5): yozuv o'chmaydi, `cancelled`
   * bo'ladi va balansga ta'siri qaytariladi.
   *   • berish: reversed = −min(applied, balans); balans yetmasa (tanga
   *     sarflangan) — `forgive` bo'lsa qolgani kechiriladi (qarz yo'q),
   *     aks holda 403;
   *   • ayirish yoki xarid: reversed = −applied (to'liq qaytadi).
   * `forgive` — faqat direktor va tizim qayta hisobi (davomat/Sarhisob
   * o'zgarishi) uchun.
   */
  async cancel(tx: CoinTransaction, note: string, actor: TxActor, forgive: boolean): Promise<{ reversed: number; notRecovered: number }> {
    if (tx.status === "cancelled") throw new GamError(409, "Yozuv allaqachon bekor qilingan");
    let reversed: number;
    let notRecovered = 0;
    if (tx.applied > 0) {
      reversed = -Math.min(tx.applied, this.balance);
      notRecovered = tx.applied + reversed;
      if (notRecovered > 0 && !forgive) {
        throw new GamError(403, "O'quvchi bu tangalarni sarflagan — bekor qilish uchun direktorga murojaat qiling");
      }
    } else {
      reversed = -tx.applied;
    }
    const now = new Date().toISOString();
    const res = await this.db.collection(GAM.tx).updateOne(
      { id: tx.id, status: "active" },
      {
        $set: { status: "cancelled", cancelledByUserId: actor.userId, cancelledByName: actor.name, cancelledAt: now, cancelNote: note, reversed },
        $unset: { uniqKey: "" },
      },
    );
    if (res.modifiedCount !== 1) throw new GamError(409, "Yozuv allaqachon bekor qilingan");
    this.balance += reversed;
    if (tx.amount > 0 && tx.type !== "shop") this.earnedTotal -= tx.amount;
    return { reversed, notRecovered };
  }
}

/**
 * O'quvchi hamyoni ustida qulf ostida ishlash. Natija bilan birga yangi
 * hamyon keshi va daraja ko'tarilgan bo'lsa — `levelUp` (xabar uchun, TZ 4.2.6).
 * Xato bo'lsa ham kesh qayta hisoblanadi (qisman yozilgan bo'lishi mumkin).
 */
export async function withWallet<T>(
  db: Db,
  pupilId: number,
  fn: (w: WalletSession) => Promise<T>,
): Promise<{ result: T; wallet: StudentWallet; levelUp: LevelUp | null }> {
  return withLock(db, `wallet:${pupilId}`, async () => {
    const pupil = await loadPupil(db, pupilId);
    if (!pupil) throw new GamError(404, "O'quvchi topilmadi");
    const { levels } = await loadSettings(db);
    const state = await computeWallet(db, pupilId);
    const before = levelIndexOf(state.earnedTotal, levels);
    const w = new WalletSession(db, pupil, state.balance, state.earnedTotal);
    let result: T;
    try {
      result = await fn(w);
    } catch (e) {
      await syncWallet(db, pupilId, levels).catch(() => {});
      throw e;
    }
    const wallet = await syncWallet(db, pupilId, levels, { balance: w.balance, earnedTotal: w.earnedTotal });
    const after = wallet.levelPosition - 1;
    const levelUp = after > before ? { from: before + 1, to: after + 1, name: levels[after].name } : null;
    return { result, wallet, levelUp };
  });
}
