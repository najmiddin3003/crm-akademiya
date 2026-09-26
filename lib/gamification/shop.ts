import type { Db, Document } from "mongodb";
import { uzDateIso } from "@/lib/uzTime";
import { writeAudit, type GamActor } from "./actor";
import { toTxActor } from "./attendance";
import { GAM, isDupKey, nextSeq, raiseSeq, withLock } from "./db";
import { pupilName } from "./ranking";
import { canReturnOrder } from "./rights";
import { intIn } from "./rules";
import { branchNames } from "./scope";
import { loadSettings } from "./settings";
import { canSeePupil, gradeOf, toifaOf, type Toifa } from "./students";
import type { CoinTransaction } from "./types";
import { GamError, isFrozenStatus, withWallet } from "./wallet";

// DO'KON (TZ 4.13–4.18, 5.5, 6.6–6.11).
//
// Katalog — `shop_items` (ombor soni sovg'a hujjatida: `stock: {filialId: n}`,
// kamaytirish atomik `$inc` sharti bilan — oxirgi dona ikki xodimga
// berilmaydi). Berish — o'quvchi hamyoni qulfi ostida: balans → ombor →
// byudjet tartibida (TZ 4.1.8). Xarid `shop` yozuvi (`amount = −narx`,
// guruhsiz) + `shop_orders`. Qaytarish — yozuv «Sovg'a qaytarildi: …» bilan
// bekor, tanga TO'LIQ qaytadi (kechirilgan farqdan qat'i nazar), ombor +1,
// byudjet sarfi kamayadi (sarf buyurtmalardan hisoblanadi).
// Katalogni faqat direktor o'zgartiradi; berish — admin (o'z filiali) va direktor.

export type Audience = "all" | "kids" | "older";
export type ItemKind = "item" | "service" | "discount";

export interface ShopItem {
  id: number;
  name: string;
  imageUrl: string | null;
  emoji: string;
  priceCoins: number;
  audience: Audience;
  kind: ItemKind;
  /** Faqat buyumda — dona tannarxi (so'm), faqat direktorga ko'rinadi. */
  costPriceSom: number | null;
  /** Faqat chegirmada — 1–5 %. */
  discountPercent: number | null;
  /** Faqat buyumda — filial bo'yicha ombor soni. */
  stock: Record<string, number>;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShopOrder {
  id: number;
  pupilId: number;
  itemId: number;
  branchId: number;
  itemName: string;
  kind: ItemKind;
  priceCoins: number;
  costPriceSom: number | null;
  givenByUserId: string | null;
  givenByName: string;
  givenAt: string;
  givenDate: string;
  status: "given" | "returned";
  returnedByUserId?: string | null;
  returnedByName?: string | null;
  returnedAt?: string | null;
  returnNote?: string | null;
  transactionId: number;
  discountId: number | null;
}

export const AUDIENCE_LABELS: Record<Audience, string> = { all: "Hammaga", kids: "Kichiklar", older: "Kattalar" };
export const KIND_LABELS: Record<ItemKind, string> = { item: "Buyum", service: "Xizmat", discount: "To'lovga chegirma" };

const PROJ = { projection: { _id: 0 } } as const;

/** Sovg'a o'quvchi toifasiga mosmi (TZ 4.21.4). */
export const fitsAudience = (a: Audience, t: Toifa) => a === "all" || a === t;

/** Chegirma sovg'asining ko'rinadigan nomi (TZ 6.8). */
export function itemTitle(i: Pick<ShopItem, "kind" | "name" | "discountPercent">): string {
  return i.kind === "discount" ? `Keyingi oy to'loviga ${i.discountPercent ?? 5}% chegirma` : i.name;
}

// ── Katalog ────────────────────────────────────────────────────────────

let seeded: Promise<void> | null = null;
/** Maxsus yagona «To'lovga chegirma» yozuvi (TZ 4.13.2, 4.16.1): narx 500, 5%, kattalar. */
function ensureDiscountItem(db: Db): Promise<void> {
  seeded ??= (async () => {
    const col = db.collection(GAM.shopItems);
    if (await col.findOne({ kind: "discount" })) return;
    const maxId = Number((await col.find({}).sort({ id: -1 }).limit(1).toArray())[0]?.id) || 0;
    await raiseSeq(db, GAM.shopItems, maxId);
    const now = new Date().toISOString();
    await col
      .insertOne({
        id: await nextSeq(db, GAM.shopItems), name: "To'lovga chegirma", imageUrl: null, emoji: "🏷️", priceCoins: 500,
        audience: "older", kind: "discount", costPriceSom: null, discountPercent: 5, stock: {}, deletedAt: null, createdAt: now, updatedAt: now,
      })
      .catch((e) => {
        // Boshqa jarayon allaqachon yaratgan (yagona indeks) — shu yetarli.
        if (!isDupKey(e)) throw e;
      });
  })().catch((e) => {
    seeded = null;
    throw e;
  });
  return seeded;
}

export async function listItems(db: Db): Promise<ShopItem[]> {
  await ensureDiscountItem(db);
  let rows = (await db.collection(GAM.shopItems).find({ deletedAt: null }, PROJ).toArray()) as unknown as ShopItem[];
  if (!rows.some((r) => r.kind === "discount")) {
    // Jarayon davomida yozuv yo'qolgan (kolleksiya tozalangan) — qayta yaratiladi.
    seeded = null;
    await ensureDiscountItem(db);
    rows = (await db.collection(GAM.shopItems).find({ deletedAt: null }, PROJ).toArray()) as unknown as ShopItem[];
  }
  // Chegirma oxirida (prototipdagidek), qolganlari qo'shilish tartibida.
  return rows.sort((a, b) => Number(a.kind === "discount") - Number(b.kind === "discount") || a.id - b.id);
}

async function getItem(db: Db, id: number): Promise<ShopItem> {
  const it = (await db.collection(GAM.shopItems).findOne({ id, deletedAt: null }, PROJ)) as unknown as ShopItem | null;
  if (!it) throw new GamError(404, "Sovg'a topilmadi");
  return it;
}

type ItemInput = Record<string, unknown>;

/** Katalog maydonlari (TZ 4.13.1) — direktor formasi. */
async function checkItem(db: Db, raw: ItemInput, selfId: number | null) {
  const name = String(raw.name ?? "").trim().replace(/\s+/g, " ");
  if (!name || name.length > 60) throw new GamError(422, "Sovg'a nomi 1–60 belgi bo'lsin");
  const others = await db.collection(GAM.shopItems).find({ deletedAt: null, kind: { $ne: "discount" } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray();
  if (others.some((o) => o.id !== selfId && String(o.name).toLowerCase() === name.toLowerCase())) throw new GamError(422, "Bu nomli sovg'a bor");
  const price = intIn(raw.priceCoins, 1, 100_000);
  if (price === null) throw new GamError(422, "Narx 1–100 000 tanga oralig'ida butun son bo'lsin");
  const audience = (["all", "kids", "older"] as Audience[]).includes(raw.audience as Audience) ? (raw.audience as Audience) : "all";
  const kind: ItemKind = raw.kind === "service" ? "service" : "item";
  let cost: number | null = null;
  const stock: Record<string, number> = {};
  if (kind === "item") {
    cost = intIn(raw.costPriceSom ?? "0", 0, 100_000_000);
    if (cost === null) throw new GamError(422, "Tannarx 0 yoki musbat butun son bo'lsin (so'm)");
    const names = await branchNames(db);
    const src = (raw.stock && typeof raw.stock === "object" ? raw.stock : {}) as Record<string, unknown>;
    for (const [b, bn] of names) {
      const v = intIn(src[String(b)] ?? "0", 0, 100_000);
      if (v === null) {
        const branch = bn;
        throw new GamError(422, `${branch}: ombor soni 0 yoki musbat butun son bo'lsin`);
      }
      stock[String(b)] = v;
    }
  }
  const imageUrl = typeof raw.imageUrl === "string" && /^https:\/\//.test(raw.imageUrl) ? raw.imageUrl.slice(0, 500) : null;
  const emoji = String(raw.emoji ?? "").trim().slice(0, 8) || "🎁";
  return { name, priceCoins: price, audience, kind, costPriceSom: cost, stock, imageUrl, emoji };
}

export async function createItem(db: Db, actor: GamActor, raw: ItemInput) {
  const v = await checkItem(db, raw, null);
  const now = new Date().toISOString();
  const id = await nextSeq(db, GAM.shopItems);
  const doc = { id, ...v, discountPercent: null, deletedAt: null, createdByName: actor.name, createdAt: now, updatedAt: now };
  await db.collection(GAM.shopItems).insertOne({ ...doc });
  await writeAudit(db, actor, GAM.shopItems, id, "create", null, v as unknown as Record<string, unknown>);
  return { item: doc, removedWishes: 0 };
}

export async function updateItem(db: Db, actor: GamActor, id: number, raw: ItemInput) {
  const cur = await getItem(db, id);
  let set: Record<string, unknown>;
  if (cur.kind === "discount") {
    // Chegirmada faqat narx, foiz (1–5) va «kimlar uchun» (TZ 4.13.2).
    const price = intIn(raw.priceCoins, 1, 100_000);
    if (price === null) throw new GamError(422, "Narx 1–100 000 tanga oralig'ida butun son bo'lsin");
    const pct = intIn(raw.discountPercent, 1, 5);
    if (pct === null) throw new GamError(422, "Chegirma foizi 1 dan 5 gacha butun son bo'lsin (qaror: maksimum 5%)");
    const audience = (["all", "kids", "older"] as Audience[]).includes(raw.audience as Audience) ? (raw.audience as Audience) : cur.audience;
    set = { priceCoins: price, discountPercent: pct, audience };
  } else {
    set = { ...(await checkItem(db, raw, id)) };
  }
  set.updatedAt = new Date().toISOString();
  await db.collection(GAM.shopItems).updateOne({ id }, { $set: set });
  const before: Record<string, unknown> = {};
  for (const k of Object.keys(set)) before[k] = (cur as unknown as Record<string, unknown>)[k] ?? null;
  await writeAudit(db, actor, GAM.shopItems, id, "update", before, set);
  const removedWishes = set.audience !== cur.audience ? await cleanWishes(db) : 0;
  return { item: { ...cur, ...set }, removedWishes };
}

export async function deleteItem(db: Db, actor: GamActor, id: number) {
  const cur = await getItem(db, id);
  if (cur.kind === "discount") throw new GamError(422, "Chegirmani o'chirib bo'lmaydi — narxi va foizini tahrirlang");
  await db.collection(GAM.shopItems).updateOne({ id }, { $set: { deletedAt: new Date().toISOString() } });
  const removed = await db.collection(GAM.wishlist).deleteMany({ itemId: id });
  await writeAudit(db, actor, GAM.shopItems, id, "delete", { name: cur.name }, null);
  return { removedWishes: removed.deletedCount };
}

// ── Istaklar (TZ 4.18) ─────────────────────────────────────────────────

/**
 * Mos kelmay qolgan istaklarni olib tashlaydi — sovg'a o'chirilgan yoki
 * toifa mos emas (sovg'a toifasi, `kidsMaxGrade` yoki o'quvchi sinfi
 * o'zgargan). `pupilIds` berilsa faqat o'shalar. Olib tashlanganlar soni.
 */
export async function cleanWishes(db: Db, pupilIds?: number[]): Promise<number> {
  const col = db.collection(GAM.wishlist);
  const wishes = await col.find(pupilIds ? { pupilId: { $in: pupilIds } } : {}, { projection: { _id: 1, pupilId: 1, itemId: 1 } }).toArray();
  if (!wishes.length) return 0;
  const [items, settings] = await Promise.all([listItems(db), loadSettings(db)]);
  const byItem = new Map(items.map((i) => [i.id, i]));
  const pupils = await db
    .collection("pupils")
    .find({ id: { $in: [...new Set(wishes.map((w) => Number(w.pupilId)))] } }, { projection: { _id: 0, id: 1, grade: 1, category: 1 } })
    .toArray();
  const toifa = new Map(pupils.map((p) => [Number(p.id), toifaOf(gradeOf(p), p.category, settings.kidsMaxGrade)]));
  const drop = wishes.filter((w) => {
    const it = byItem.get(Number(w.itemId));
    return !it || !fitsAudience(it.audience, toifa.get(Number(w.pupilId)) ?? "older");
  });
  if (!drop.length) return 0;
  await col.deleteMany({ _id: { $in: drop.map((w) => w._id) } });
  return drop.length;
}

// ── Byudjet (TZ 4.17) ──────────────────────────────────────────────────

/** Oyda berilgan (qaytarilmagan) BUYUMLAR tannarxi — xizmat va chegirma kirmaydi. */
export async function spentSom(db: Db, branchId: number, month: string): Promise<number> {
  const [r] = await db
    .collection(GAM.shopOrders)
    .aggregate<{ s: number }>([
      { $match: { branchId, kind: "item", status: "given", givenDate: { $gte: `${month}-01`, $lte: `${month}-31` } } },
      { $group: { _id: null, s: { $sum: { $ifNull: ["$costPriceSom", 0] } } } },
    ])
    .toArray();
  return r?.s ?? 0;
}

export async function budgetOf(db: Db, branchId: number): Promise<number | null> {
  const b = await db.collection(GAM.budgets).findOne({ branchId }, { projection: { _id: 0, monthlyLimitSom: 1 } });
  return b && b.monthlyLimitSom !== null && Number.isFinite(Number(b.monthlyLimitSom)) ? Number(b.monthlyLimitSom) : null;
}

export async function setBudget(db: Db, actor: GamActor, branchId: number, raw: unknown) {
  const names = await branchNames(db);
  if (!names.has(branchId)) throw new GamError(404, "Filial topilmadi");
  const s = String(raw ?? "").trim();
  let limit: number | null = null;
  if (s !== "") {
    limit = intIn(s, 0, 10_000_000_000);
    if (limit === null) throw new GamError(422, "Byudjet 0 yoki musbat butun son bo'lsin (so'm), bo'sh — cheklanmagan");
  }
  const before = await budgetOf(db, branchId);
  await db
    .collection(GAM.budgets)
    .updateOne({ branchId }, { $set: { branchId, monthlyLimitSom: limit, updatedByName: actor.name, updatedAt: new Date().toISOString() } }, { upsert: true });
  await writeAudit(db, actor, GAM.budgets, branchId, "update", { monthlyLimitSom: before }, { monthlyLimitSom: limit });
  return { branchId, monthlyLimitSom: limit };
}

// ── Kim qaysi filial bilan ishlaydi ────────────────────────────────────

/** Do'kondagi filiallar: admin — o'ziniki, direktor — hammasi (filtr bilan), ustoz — katalogni ko'radi xolos. */
export async function shopBranches(db: Db, actor: GamActor, filter: number | null): Promise<number[]> {
  const all = [...(await branchNames(db)).keys()];
  if (actor.role === "director") return filter !== null && all.includes(filter) ? [filter] : all;
  if (actor.role === "branch_admin") return actor.branchIds.filter((b) => filter === null || b === filter);
  return [];
}

const branchOfPupil = (p: { branchId?: unknown } | Document) =>
  Number.isFinite(Number(p.branchId)) && p.branchId !== null && p.branchId !== undefined ? Number(p.branchId) : 1;

// ── Berish (TZ 4.14) ───────────────────────────────────────────────────

interface GiveCtx {
  item: ShopItem;
  pupil: { id: number; name: string; branchId: number; frozen: boolean; toifa: Toifa };
  balance: number;
  budget: number | null;
  spent: number;
}

/**
 * Berib bo'lmaslik sababi (o'quvchi ro'yxatida va serverda — bitta qoida,
 * TZ 4.14.3). `null` — mumkin. Xato obyekt ko'rinishida: server uni
 * to'g'ridan-to'g'ri tashlaydi, ro'yxat esa matnini ko'rsatadi (tarjima
 * skaneri `new GamError(…)` matnlarini lug'atga so'raydi).
 */
export function giveError(c: GiveCtx): GamError | null {
  if (c.pupil.frozen) return new GamError(422, "Ketgan o'quvchiga sovg'a berilmaydi");
  if (!fitsAudience(c.item.audience, c.pupil.toifa)) {
    return c.item.audience === "kids" ? new GamError(422, "Bu sovg'a kichiklar uchun") : new GamError(422, "Bu sovg'a kattalar uchun");
  }
  if (c.balance < c.item.priceCoins) {
    const balance = c.balance;
    const price = c.item.priceCoins;
    return new GamError(422, `Tanga yetmaydi (${balance} / ${price})`);
  }
  if (c.item.kind === "item" && !((c.item.stock[String(c.pupil.branchId)] ?? 0) > 0)) return new GamError(422, "Filial omborida qolmagan");
  if (c.item.kind === "item" && c.budget !== null && c.spent + (c.item.costPriceSom ?? 0) > c.budget) {
    const left = Math.max(0, c.budget - c.spent);
    return new GamError(422, `Filial sovg'a byudjeti yetmaydi (qoldi ${left} so'm)`);
  }
  return null;
}

async function pupilCtx(db: Db, pupilId: number) {
  const settings = await loadSettings(db);
  const p = await db
    .collection("pupils")
    .findOne({ id: pupilId }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, status: 1, branchId: 1, grade: 1, category: 1 } });
  if (!p) throw new GamError(404, "O'quvchi topilmadi");
  return {
    id: pupilId,
    name: pupilName(p),
    branchId: branchOfPupil(p),
    frozen: isFrozenStatus(p.status),
    toifa: toifaOf(gradeOf(p), p.category, settings.kidsMaxGrade),
  };
}

export async function giveGift(db: Db, actor: GamActor, input: { pupilId: number; itemId: number }) {
  const settings = await loadSettings(db);
  if (!settings.enabled) throw new GamError(409, "Gamifikatsiya moduli o'chiq");
  if (actor.role === "teacher") throw new GamError(403, "Sovg'ani filial admini yoki direktor beradi");
  const item = await getItem(db, input.itemId);
  if (item.kind === "discount") throw new GamError(409, "Chegirma alohida beriladi — kursni tanlang");
  const pupil = await pupilCtx(db, input.pupilId);
  if (actor.role === "branch_admin" && !actor.branchIds.includes(pupil.branchId)) throw new GamError(403, "O'quvchi sizning filialingizda emas");
  const today = uzDateIso();
  const month = today.slice(0, 7);

  const { result, wallet, levelUp, badges } = await withWallet(db, input.pupilId, async (w) =>
    // Byudjet bir nechta xodimga umumiy — filial–oy qulfi (TZ 4.1.8: hamyon → ombor → byudjet).
    withLock(db, `budget:${pupil.branchId}:${month}`, async () => {
      const fresh = await getItem(db, input.itemId);
      const budget = fresh.kind === "item" ? await budgetOf(db, pupil.branchId) : null;
      const spent = fresh.kind === "item" && budget !== null ? await spentSom(db, pupil.branchId, month) : 0;
      const err = giveError({ item: fresh, pupil: { ...pupil, frozen: w.pupil.frozen || pupil.frozen }, balance: w.balance, budget, spent });
      if (err) throw err;
      // Ombor: atomik kamaytirish — oxirgi donani ikki xodim bir vaqtda bera olmaydi.
      const key = `stock.${pupil.branchId}`;
      if (fresh.kind === "item") {
        const r = await db.collection(GAM.shopItems).updateOne({ id: fresh.id, [key]: { $gte: 1 } }, { $inc: { [key]: -1 } });
        if (r.modifiedCount !== 1) throw new GamError(409, "Filial omborida qolmagan");
      }
      const orderId = await nextSeq(db, GAM.shopOrders);
      let tx: CoinTransaction;
      try {
        tx = await w.add({ groupId: null, date: today, type: "shop", amount: -fresh.priceCoins, note: itemTitle(fresh), actor: toTxActor(actor), shopOrderId: orderId });
      } catch (e) {
        if (fresh.kind === "item") await db.collection(GAM.shopItems).updateOne({ id: fresh.id }, { $inc: { [key]: 1 } });
        throw e;
      }
      const order: ShopOrder = {
        id: orderId, pupilId: pupil.id, itemId: fresh.id, branchId: pupil.branchId, itemName: itemTitle(fresh), kind: fresh.kind,
        priceCoins: fresh.priceCoins, costPriceSom: fresh.kind === "item" ? fresh.costPriceSom : null,
        givenByUserId: actor.userId, givenByName: actor.name, givenAt: new Date().toISOString(), givenDate: today,
        status: "given", transactionId: tx.id, discountId: null,
      };
      await db.collection(GAM.shopOrders).insertOne({ ...order });
      const wished = (await db.collection(GAM.wishlist).deleteOne({ pupilId: pupil.id, itemId: fresh.id })).deletedCount > 0;
      return { order, wished };
    }),
  );
  return { ...result, balance: wallet.balance, levelUp, badges };
}

// ── Qaytarish (TZ 4.15) ────────────────────────────────────────────────

export async function returnGift(db: Db, actor: GamActor, input: { orderId: number; note: string }) {
  const settings = await loadSettings(db);
  if (!settings.enabled) throw new GamError(409, "Gamifikatsiya moduli o'chiq");
  const note = String(input.note ?? "").trim().slice(0, 500);
  if (!note) throw new GamError(422, "Izoh yozish majburiy");
  const first = (await db.collection(GAM.shopOrders).findOne({ id: input.orderId }, PROJ)) as unknown as ShopOrder | null;
  if (!first) throw new GamError(404, "Xarid topilmadi");

  const { wallet } = await withWallet(db, first.pupilId, async (w) => {
    const o = (await db.collection(GAM.shopOrders).findOne({ id: input.orderId }, PROJ)) as unknown as ShopOrder;
    const disc = o.discountId !== null ? await db.collection(GAM.discounts).findOne({ id: o.discountId }, { projection: { _id: 0, status: 1 } }) : null;
    if (o.status !== "given") throw new GamError(409, "Sovg'a allaqachon qaytarilgan");
    if (!canReturnOrder(actor, o, uzDateIso(), disc ? String(disc.status) : null)) {
      throw new GamError(403, o.discountId !== null && disc?.status === "applied"
        ? "Qo'llangan chegirmani qaytarib bo'lmaydi — u Moliyada to'lovga kirib bo'lgan"
        : "Sovg'ani admin faqat shu kuni qaytaradi — keyin direktor");
    }
    const tx = (await db.collection(GAM.tx).findOne({ id: o.transactionId }, PROJ)) as unknown as CoinTransaction | null;
    // Xarid bekor — tanga to'liq qaytadi (reversed = −applied).
    if (tx && tx.status === "active") await w.cancel(tx, `Sovg'a qaytarildi: ${note}`, toTxActor(actor), true);
    const r = await db
      .collection(GAM.shopOrders)
      .updateOne(
        { id: o.id, status: "given" },
        { $set: { status: "returned", returnedByUserId: actor.userId, returnedByName: actor.name, returnedAt: new Date().toISOString(), returnNote: note } },
      );
    if (r.modifiedCount !== 1) throw new GamError(409, "Sovg'a allaqachon qaytarilgan");
    if (o.kind === "item") await db.collection(GAM.shopItems).updateOne({ id: o.itemId }, { $inc: { [`stock.${o.branchId}`]: 1 } });
    if (o.discountId !== null) {
      await db.collection(GAM.discounts).updateOne({ id: o.discountId, status: "active" }, { $set: { status: "cancelled", updatedAt: new Date().toISOString() }, $unset: { activeKey: "" } });
    }
    return o;
  });
  return { balance: wallet.balance };
}

// ── Ko'rinishlar ───────────────────────────────────────────────────────

/** Do'kon sahifasi (xodim ko'rinishi, TZ 5.5). */
export async function shopView(db: Db, actor: GamActor, branchFilter: number | null) {
  const settings = await loadSettings(db);
  const today = uzDateIso();
  const month = today.slice(0, 7);
  const [items, names, branches] = await Promise.all([listItems(db), branchNames(db), shopBranches(db, actor, branchFilter)]);
  const dir = actor.role === "director";
  const adm = dir || actor.role === "branch_admin";

  // Istaklar (faqat admin/direktor): tanlangan filiallarning faol o'quvchilari.
  let wishCount = new Map<number, number>();
  let wishRows: { itemId: number; title: string; price: number; wanted: number; ready: { pupilId: number; name: string; balance: number }[]; stock: number | null }[] = [];
  if (adm && branches.length) {
    const wishes = await db.collection(GAM.wishlist).find({}, { projection: { _id: 0, pupilId: 1, itemId: 1 } }).toArray();
    const pids = [...new Set(wishes.map((w) => Number(w.pupilId)))];
    const pupils = await db
      .collection("pupils")
      .find({ id: { $in: pids } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, status: 1, branchId: 1, grade: 1, category: 1 } })
      .toArray();
    const inScope = new Map(pupils.filter((p) => !isFrozenStatus(p.status) && branches.includes(branchOfPupil(p))).map((p) => [Number(p.id), p]));
    const wallets = new Map(
      (await db.collection(GAM.wallets).find({ pupilId: { $in: [...inScope.keys()] } }, { projection: { _id: 0, pupilId: 1, balance: 1 } }).toArray()).map((w) => [Number(w.pupilId), Number(w.balance) || 0]),
    );
    wishCount = new Map();
    const byItem = new Map<number, number[]>();
    for (const w of wishes) {
      const pid = Number(w.pupilId);
      const p = inScope.get(pid);
      const it = items.find((i) => i.id === Number(w.itemId));
      if (!p || !it || !fitsAudience(it.audience, toifaOf(gradeOf(p), p.category, settings.kidsMaxGrade))) continue;
      wishCount.set(it.id, (wishCount.get(it.id) ?? 0) + 1);
      byItem.set(it.id, [...(byItem.get(it.id) ?? []), pid]);
    }
    wishRows = [...byItem.entries()]
      .map(([itemId, pidsOf]) => {
        const it = items.find((i) => i.id === itemId)!;
        const ready = pidsOf
          .filter((pid) => (wallets.get(pid) ?? 0) >= it.priceCoins)
          .map((pid) => ({ pupilId: pid, name: pupilName(inScope.get(pid)!), balance: wallets.get(pid) ?? 0 }));
        const stock = it.kind === "item" ? branches.reduce((a, b) => a + (it.stock[String(b)] ?? 0), 0) : null;
        return { itemId, title: itemTitle(it), price: it.priceCoins, wanted: pidsOf.length, ready, stock };
      })
      .sort((a, b) => b.wanted - a.wanted || b.ready.length - a.ready.length);
  }

  // Byudjet kartasi (admin/direktor).
  const budget = adm
    ? await Promise.all(
        branches.map(async (b) => {
          const limit = await budgetOf(db, b);
          const spent = await spentSom(db, b, month);
          return { branchId: b, name: names.get(b) ?? `#${b}`, spent, limit, left: limit === null ? null : limit - spent };
        }),
      )
    : [];

  // Joriy oyda berilganlar (admin/direktor, filial doirasida).
  const orders = adm
    ? ((await db
        .collection(GAM.shopOrders)
        .find({ branchId: { $in: branches }, givenDate: { $gte: `${month}-01`, $lte: `${month}-31` } }, PROJ)
        .sort({ givenAt: -1 })
        .toArray()) as unknown as ShopOrder[])
    : [];
  const discIds = orders.map((o) => o.discountId).filter((x): x is number => x !== null);
  const discStatus = new Map(
    (discIds.length ? await db.collection(GAM.discounts).find({ id: { $in: discIds } }, { projection: { _id: 0, id: 1, status: 1 } }).toArray() : []).map((d) => [
      Number(d.id),
      String(d.status),
    ]),
  );
  const orderPupils = new Map(
    (orders.length
      ? await db.collection("pupils").find({ id: { $in: [...new Set(orders.map((o) => o.pupilId))] } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1 } }).toArray()
      : []
    ).map((p) => [Number(p.id), pupilName(p)]),
  );

  return {
    enabled: settings.enabled && !!settings.startDate,
    role: actor.role,
    month,
    kidsMaxGrade: settings.kidsMaxGrade,
    branchOptions: dir ? [...names.entries()].map(([id, name]) => ({ id, name })) : [],
    items: items.map((i) => ({
      id: i.id,
      title: itemTitle(i),
      name: i.name,
      imageUrl: i.imageUrl,
      emoji: i.emoji,
      priceCoins: i.priceCoins,
      audience: i.audience,
      kind: i.kind,
      discountPercent: i.discountPercent,
      // Ombor — admin va direktorga; dona tannarxi — faqat direktorga (TZ 3, 4.17.4).
      stock: adm && i.kind === "item" ? Object.fromEntries(branches.map((b) => [String(b), i.stock[String(b)] ?? 0])) : null,
      stockAll: dir && i.kind === "item" ? i.stock : null,
      costPriceSom: dir ? i.costPriceSom : null,
      wished: wishCount.get(i.id) ?? 0,
    })),
    budget,
    wishRows,
    orders: orders.map((o) => ({
      id: o.id,
      pupilId: o.pupilId,
      pupilName: orderPupils.get(o.pupilId) ?? `#${o.pupilId}`,
      itemName: o.itemName,
      kind: o.kind,
      priceCoins: o.priceCoins,
      branchName: names.get(o.branchId) ?? "",
      costPriceSom: dir ? o.costPriceSom : null,
      givenDate: o.givenDate,
      status: o.status,
      canReturn: canReturnOrder(actor, o, today, o.discountId !== null ? discStatus.get(o.discountId) ?? null : null),
    })),
  };
}

/** Berish oynasi uchun o'quvchilar (TZ 4.14.2): avval berish mumkinlar, ♥ istaganlar, balans kamayishida. */
export async function eligiblePupils(db: Db, actor: GamActor, itemId: number, branchFilter: number | null) {
  const item = await getItem(db, itemId);
  const settings = await loadSettings(db);
  const branches = await shopBranches(db, actor, branchFilter);
  const month = uzDateIso().slice(0, 7);
  // Hovuz: filial(lar)dagi faol guruh a'zolari va hamyoni borlar.
  const groups = await db.collection("groups").find({ status: "active" }, { projection: { _id: 0, studentIds: 1 } }).toArray();
  const walletIds = (await db.collection(GAM.wallets).distinct("pupilId")).map(Number);
  const ids = [...new Set([...groups.flatMap((g) => (Array.isArray(g.studentIds) ? g.studentIds.map(Number) : [])), ...walletIds])];
  const pupils = (
    await db
      .collection("pupils")
      .find({ id: { $in: ids } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, status: 1, branchId: 1, grade: 1, category: 1 } })
      .toArray()
  ).filter((p) => !isFrozenStatus(p.status) && branches.includes(branchOfPupil(p)));
  const wallets = new Map(
    (await db.collection(GAM.wallets).find({ pupilId: { $in: pupils.map((p) => Number(p.id)) } }, { projection: { _id: 0, pupilId: 1, balance: 1 } }).toArray()).map((w) => [Number(w.pupilId), Number(w.balance) || 0]),
  );
  const wished = new Set((await db.collection(GAM.wishlist).find({ itemId }, { projection: { _id: 0, pupilId: 1 } }).toArray()).map((w) => Number(w.pupilId)));
  const names = await branchNames(db);
  const budgets = new Map<number, { limit: number | null; spent: number }>();
  for (const b of branches) {
    const limit = await budgetOf(db, b);
    budgets.set(b, { limit, spent: limit === null ? 0 : await spentSom(db, b, month) });
  }
  return pupils
    .map((p) => {
      const pid = Number(p.id);
      const branchId = branchOfPupil(p);
      const grade = gradeOf(p);
      const toifa = toifaOf(grade, p.category, settings.kidsMaxGrade);
      const balance = wallets.get(pid) ?? 0;
      const bud = budgets.get(branchId) ?? { limit: null, spent: 0 };
      const error = item.kind === "discount" ? null : giveError({ item, pupil: { id: pid, name: "", branchId, frozen: false, toifa }, balance, budget: bud.limit, spent: bud.spent })?.message ?? null;
      return { pupilId: pid, name: pupilName(p), grade, branchName: names.get(branchId) ?? "", balance, wished: wished.has(pid), error };
    })
    .sort((a, b) => Number(!!a.error) - Number(!!b.error) || Number(b.wished) - Number(a.wished) || b.balance - a.balance || a.name.localeCompare(b.name, "uz"));
}

/** Profil uchun: istaklar va sotib olganlar (TZ 5.4). */
export async function pupilShopInfo(db: Db, actor: GamActor, pupilId: number) {
  const p = await pupilCtx(db, pupilId);
  if (!(await canSeePupil(db, actor, { id: pupilId, branchId: p.branchId }))) throw new GamError(404, "O'quvchi topilmadi");
  const settings = await loadSettings(db);
  const [items, wishes, orders, wallet] = await Promise.all([
    listItems(db),
    db.collection(GAM.wishlist).find({ pupilId }, { projection: { _id: 0, itemId: 1, addedAt: 1 } }).sort({ addedAt: 1 }).toArray(),
    db.collection(GAM.shopOrders).find({ pupilId }, PROJ).sort({ givenAt: -1 }).toArray() as unknown as Promise<ShopOrder[]>,
    db.collection(GAM.wallets).findOne({ pupilId }, { projection: { _id: 0, balance: 1 } }),
  ]);
  const balance = Number(wallet?.balance) || 0;
  const discIds = orders.map((o) => o.discountId).filter((x): x is number => x !== null);
  const discStatus = new Map(
    (discIds.length ? await db.collection(GAM.discounts).find({ id: { $in: discIds } }, { projection: { _id: 0, id: 1, status: 1 } }).toArray() : []).map((d) => [Number(d.id), String(d.status)]),
  );
  const today = uzDateIso();
  // «Berish» — admin (o'z filiali) va direktor, faol o'quvchiga, modul yoqilganda (TZ 5.4).
  const canGive =
    settings.enabled && !p.frozen && (actor.role === "director" || (actor.role === "branch_admin" && actor.branchIds.includes(p.branchId)));
  return {
    wishlistMax: settings.wishlistMax,
    balance,
    canGive,
    enabled: settings.enabled,
    wishes: wishes
      .map((w) => {
        const it = items.find((i) => i.id === Number(w.itemId));
        if (!it || !fitsAudience(it.audience, p.toifa)) return null;
        return {
          itemId: it.id,
          title: itemTitle(it),
          imageUrl: it.imageUrl,
          emoji: it.emoji,
          price: it.priceCoins,
          audience: it.audience,
          kind: it.kind,
          addedAt: String(w.addedAt ?? ""),
          ready: balance >= it.priceCoins,
          noStock: it.kind === "item" && !((it.stock[String(p.branchId)] ?? 0) > 0),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
    orders: orders.map((o) => ({
      id: o.id,
      itemName: o.itemName,
      kind: o.kind,
      priceCoins: o.priceCoins,
      givenDate: o.givenDate,
      givenByName: o.givenByName,
      status: o.status,
      returnNote: o.returnNote ?? null,
      returnedAt: o.returnedAt ? uzDateIso(new Date(o.returnedAt)) : null,
      canReturn: canReturnOrder(actor, o, today, o.discountId !== null ? discStatus.get(o.discountId) ?? null : null),
    })),
    spentTotal: orders.filter((o) => o.status === "given").reduce((a, o) => a + o.priceCoins, 0),
  };
}

/** Sozlamalar → «Filiallar va byudjet» (TZ 5.7): filial, oylik byudjet, joriy oy sarfi, guruhlar soni. */
export async function budgetsView(db: Db) {
  const names = await branchNames(db);
  const month = uzDateIso().slice(0, 7);
  const counts = await db
    .collection("groups")
    .aggregate<{ _id: number; n: number }>([{ $match: { status: "active" } }, { $group: { _id: { $ifNull: ["$branchId", 1] }, n: { $sum: 1 } } }])
    .toArray();
  const byBranch = new Map(counts.map((c) => [Number(c._id), c.n]));
  const rows = [];
  for (const [branchId, name] of names) {
    rows.push({ branchId, name, limit: await budgetOf(db, branchId), spent: await spentSom(db, branchId, month), groups: byBranch.get(branchId) ?? 0 });
  }
  return { month, rows };
}
