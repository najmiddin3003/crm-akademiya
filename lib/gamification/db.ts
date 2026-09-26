import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";

// GAMIFIKATSIYA — baza qatlami: kolleksiyalar, indekslar, qulf, hisoblagich.
//
// NEGA TRANZAKSIYA EMAS: TZ (4.1.8) har bir balans amalini bitta
// DB-tranzaksiyada `FOR UPDATE` bilan bajarishni talab qiladi. Prod'dagi
// MongoDB — YAKKA server (26.09.2026 tekshirildi: replica set emas), unda
// ko'p hujjatli tranzaksiya ishlamaydi. O'rniga:
//   • o'quvchi (va guruh–dars) bo'yicha LEASE-QULF (`withLock`) — bir vaqtdagi
//     so'rovlar navbat bilan o'tadi, limit va balans tekshiruvi qulf ostida;
//   • balans keshini har amaldan keyin YOZUVLARDAN qayta hisoblash
//     (wallet.ts) — manba doim `coin_transactions`, kesh faqat nusxa;
//   • takrorlanmasligi shart bo'lgan yozuvlarga `uniqKey` unique indeksi —
//     qulfdan qat'i nazar ikkinchi faol yozuv bazaga tushmaydi.

export const GAM = {
  settings: "gamification_settings",
  reasons: "coin_reasons",
  tx: "coin_transactions",
  wallets: "student_wallets",
  audit: "audit_log",
  locks: "gam_locks",
  counters: "counters",
  /** Nishonlar (TZ 4.19, 6.12). */
  badges: "student_badges",
  /** Oy yakuni — muzlatilgan natijalar (TZ 4.20, 6.13). */
  monthly: "monthly_results",
  /** Do'kon (TZ 4.13–4.18, 6.6–6.11). Ombor soni sovg'a hujjatida (`stock`). */
  shopItems: "shop_items",
  shopOrders: "shop_orders",
  budgets: "branch_gift_budgets",
  wishlist: "wishlist_items",
  discounts: "tuition_discounts",
} as const;

/**
 * Indekslar SHU YERDA va KUTIB yaratiladi (umumiy `ensureIndexes` ular
 * mavjud bazada fonda yaratadi): `uniqKey`/`pupilId` unique indekslari
 * yozuvdan OLDIN turishi kerak, aks holda deploydan keyingi birinchi
 * daqiqalarda takror yozuv o'tib ketishi mumkin edi.
 */
let ready: Promise<void> | null = null;

async function createGamIndexes(db: Db): Promise<void> {
  const text = { $type: "string" };
  await Promise.all([
    // Bitta hujjat `{key: "main"}` — unique: upsert bilan qilinadigan bir
    // martalik belgilar (reasons.ts seed) ikkinchi hujjat ochib yubormasin.
    db.collection(GAM.settings).createIndex({ key: 1 }, { unique: true }),
    db.collection(GAM.reasons).createIndex({ id: 1 }, { unique: true }),
    db.collection(GAM.reasons).createIndex({ code: 1 }, { unique: true, partialFilterExpression: { code: text } }),
    db.collection(GAM.tx).createIndex({ id: 1 }, { unique: true }),
    db.collection(GAM.tx).createIndex({ pupilId: 1, date: -1 }),
    db.collection(GAM.tx).createIndex({ groupId: 1, date: 1 }),
    db.collection(GAM.tx).createIndex({ pupilId: 1, reasonId: 1, date: 1 }),
    db.collection(GAM.tx).createIndex({ uniqKey: 1 }, { unique: true, partialFilterExpression: { uniqKey: text } }),
    db.collection(GAM.wallets).createIndex({ pupilId: 1 }, { unique: true }),
    db.collection(GAM.audit).createIndex({ id: 1 }, { unique: true }),
    db.collection(GAM.audit).createIndex({ entity: 1, createdAt: -1 }),
    // Oddiy nishonda month/groupId = null; «Oy o'quvchisi» — har oy va guruhga bittadan.
    db.collection(GAM.badges).createIndex({ pupilId: 1, code: 1, month: 1, groupId: 1 }, { unique: true }),
    // Oy bir marta yakunlanadi: (oy, guruh) takrorlanmaydi (TZ 6.13).
    db.collection(GAM.monthly).createIndex({ month: 1, groupId: 1 }, { unique: true }),
    db.collection(GAM.shopItems).createIndex({ id: 1 }, { unique: true }),
    // «To'lovga chegirma» — katalogda YAGONA yozuv (TZ 4.13.2).
    db.collection(GAM.shopItems).createIndex({ kind: 1 }, { unique: true, partialFilterExpression: { kind: "discount" } }),
    db.collection(GAM.shopOrders).createIndex({ id: 1 }, { unique: true }),
    db.collection(GAM.shopOrders).createIndex({ branchId: 1, givenDate: -1 }),
    db.collection(GAM.shopOrders).createIndex({ pupilId: 1, givenDate: -1 }),
    db.collection(GAM.budgets).createIndex({ branchId: 1 }, { unique: true }),
    db.collection(GAM.wishlist).createIndex({ pupilId: 1, itemId: 1 }, { unique: true }),
    db.collection(GAM.discounts).createIndex({ id: 1 }, { unique: true }),
    // O'quvchiga oyiga bitta faol/qo'llangan chegirma (TZ 6.9): `activeKey` faqat shu holatlarda.
    db.collection(GAM.discounts).createIndex({ activeKey: 1 }, { unique: true, partialFilterExpression: { activeKey: text } }),
    // Kirim yadrosi har to'lovda so'raydi (pupilId + oy + active); tungi muddat va do'kon jadvali.
    db.collection(GAM.discounts).createIndex({ pupilId: 1, month: 1, status: 1 }),
    db.collection(GAM.discounts).createIndex({ status: 1, month: 1 }),
    db.collection(GAM.discounts).createIndex({ branchId: 1, month: 1 }),
  ]);
}

/** Baza + gamifikatsiya indekslari (jarayon bo'yicha bir marta kutiladi). */
export async function gamDb(): Promise<Db> {
  const db = await ensureIndexes();
  ready ??= createGamIndexes(db).catch((e) => {
    ready = null;
    throw e;
  });
  await ready;
  return db;
}

export function isDupKey(e: unknown): boolean {
  return (e as { code?: number } | null)?.code === 11000;
}

/** Keyingi tartib raqami — atomik `$inc` (max+1 ikki parallel so'rovda to'qnashardi). */
export async function nextSeq(db: Db, name: string): Promise<number> {
  const res = await db
    .collection<{ _id: string; seq: number }>(GAM.counters)
    .findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  return Number(res?.seq);
}

/**
 * Hisoblagichni mavjud eng katta id dan orqada qolmaydigan qiladi (bir
 * marta, boshlashda) — kolleksiyada id lar hisoblagichdan oldin paydo
 * bo'lgan bo'lsa (masalan seed), takror id berilmasin.
 */
export async function raiseSeq(db: Db, name: string, atLeast: number): Promise<void> {
  await db
    .collection<{ _id: string; seq: number }>(GAM.counters)
    .updateOne({ _id: name }, { $max: { seq: atLeast } }, { upsert: true });
}

export class GamBusyError extends Error {
  status = 409;
}

/**
 * Lease-qulf: `key` bo'yicha bir vaqtda faqat bitta `fn` ishlaydi.
 *
 * Qulf hujjati `{_id: key, owner, expiresAt}`. Olish — bitta atomik
 * upsert: muddati o'tgan qulf (yoki yo'g'i) egallanadi, band qulfda esa
 * upsert `_id` to'qnashuvi (E11000) beradi va biz kutib qayta urinamiz.
 * `ttlMs` — jarayon yiqilib qolsa qulf shuncha vaqtdan keyin o'zi bo'shaydi.
 */
export async function withLock<T>(
  db: Db,
  key: string,
  fn: () => Promise<T>,
  opts: { ttlMs?: number; waitMs?: number } = {},
): Promise<T> {
  const col = db.collection<{ _id: string; owner: string; expiresAt: Date }>(GAM.locks);
  const owner = randomUUID();
  const ttl = opts.ttlMs ?? 20_000;
  const deadline = Date.now() + (opts.waitMs ?? 10_000);
  for (;;) {
    const now = new Date();
    try {
      await col.updateOne(
        { _id: key, expiresAt: { $lt: now } },
        { $set: { owner, expiresAt: new Date(now.getTime() + ttl) } },
        { upsert: true },
      );
      break;
    } catch (e) {
      if (!isDupKey(e)) throw e;
      if (Date.now() > deadline) throw new GamBusyError("Tizim band — birozdan keyin qayta urinib ko'ring");
      await new Promise((r) => setTimeout(r, 30 + Math.floor(Math.random() * 60)));
    }
  }
  try {
    return await fn();
  } finally {
    await col.deleteOne({ _id: key, owner }).catch(() => {});
  }
}
