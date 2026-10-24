import type { Db, Document } from "mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { branchPool } from "@/lib/branchPools";
import { uzDateIso } from "@/lib/uzTime";
import { writeAudit, type GamActor } from "./actor";
import { GAM, nextSeq, withLock } from "./db";
import { pupilName } from "./ranking";
import { canReturnOrder } from "./rights";
import { branchBuildingNames } from "./scope";
import { loadSettings } from "./settings";
import { budgetOf, fitsAudience, giveError, giveGift, itemTitle, listItems, spentSom, type ShopItem, type ShopOrder } from "./shop";
import { gradeOf, toifaOf } from "./students";
import { GamError, isFrozenStatus } from "./wallet";

// DO'KON · SO'ROVLAR (yangi versiya, rasm «Do'kon · So'rovlar», 24.10.2026).
//
// So'rov — o'quvchi kabinetida «♡ Istakka» qo'shgan sovg'asi (wishlist_items), TANGASI
// YETADIGANI: tangasi yetmagani hali maqsad — «so'rov» emas, alohida sanaladi (`waiting`).
//   • Tasdiqlash — oddiy berish (shop.ts → giveGift: balans, toifa, ombor, byudjet; tanga
//     ayiriladi, ombor −1, istak olinadi), buyum/xizmatda buyurtma «Topshirish kutilmoqda»
//     (`handover: "pending"`) — o'quvchi keyin olib ketadi; «Topshirildi» — `done`.
//   • Rad etish — sababi bilan: istak olinadi, `shop_request_rejections` ga yoziladi,
//     o'quvchi kabinetida 30 kun ko'rinadi; tanga joyida qoladi.
// Kim: filial admini (o'z filiali) va direktor; ustozga bo'lim ko'rinmaydi (TZ 3 — berish
// huquqi). Direktor — navbardagi filial (1+2 hovuzi bilan), admin — o'z filiallari.

const PROJ = { projection: { _id: 0 } } as const;

const branchOfPupil = (p: { branchId?: unknown } | Document) =>
  Number.isFinite(Number(p.branchId)) && p.branchId !== null && p.branchId !== undefined ? Number(p.branchId) : 1;

/** So'rovlar qaysi binolar bo'yicha ko'rinadi. */
export async function requestBranches(db: Db, actor: GamActor): Promise<number[]> {
  if (actor.role === "teacher") return [];
  const all = [...(await branchBuildingNames(db)).keys()];
  const scope = await getBranchScope().catch(() => null);
  const pool = scope ? branchPool(scope.branchId).filter((b) => all.includes(b)) : all;
  if (actor.role === "director") return pool.length ? [...pool] : all;
  const mine = actor.branchIds.filter((b) => pool.includes(b));
  return mine.length ? mine : [...actor.branchIds];
}

/** «Ingliz tili · 2-bosqich» — o'quvchining faol guruhlari (bir nechta bo'lsa vergul bilan). */
export async function pupilGroupLabels(db: Db, pupilIds: number[]): Promise<Map<number, string>> {
  if (!pupilIds.length) return new Map();
  const rows = await db
    .collection("groups")
    .find({ status: "active", studentIds: { $in: pupilIds } }, { projection: { _id: 0, id: 1, name: 1, course: 1, level: 1, studentIds: 1 } })
    .toArray();
  const want = new Set(pupilIds);
  const out = new Map<number, string[]>();
  for (const g of rows) {
    const label = courseLevel(g);
    for (const pid of (Array.isArray(g.studentIds) ? g.studentIds : []).map(Number)) {
      if (want.has(pid)) out.set(pid, [...(out.get(pid) ?? []), label]);
    }
  }
  return new Map([...out].map(([k, v]) => [k, [...new Set(v)].join(", ")]));
}

/** Guruh yorlig'i rasmdagidek: kurs · bosqich (kurs yo'q — «128-guruh»). */
export function courseLevel(g: { id?: unknown; name?: unknown; course?: unknown; level?: unknown } | Document): string {
  const course = String(g.course ?? "").trim();
  const level = String(g.level ?? "").trim();
  if (course) return [course, level].filter(Boolean).join(" · ");
  const name = String(g.name ?? "").trim();
  return name ? `${name}-guruh` : `#${g.id}`;
}

export async function requestsView(db: Db, actor: GamActor) {
  const settings = await loadSettings(db);
  const branches = await requestBranches(db, actor);
  const names = await branchBuildingNames(db);
  const base = {
    enabled: settings.enabled && !!settings.startDate,
    role: actor.role,
    canManage: actor.role !== "teacher",
    branches: branches.map((b) => ({ id: b, name: names.get(b) ?? `#${b}` })),
  };
  if (!branches.length) return { ...base, requests: [], waiting: 0, awaiting: [] };

  const today = uzDateIso();
  const month = today.slice(0, 7);
  const [items, wishes, pending] = await Promise.all([
    listItems(db),
    db.collection(GAM.wishlist).find({}, { projection: { _id: 0, pupilId: 1, itemId: 1, addedAt: 1, addedAtTs: 1 } }).toArray(),
    db
      .collection(GAM.shopOrders)
      .find({ handover: "pending", status: "given", branchId: { $in: branches } }, PROJ)
      .sort({ givenAt: -1 })
      .toArray() as unknown as Promise<ShopOrder[]>,
  ]);
  const byItem = new Map(items.map((i) => [i.id, i]));
  const pids = [...new Set([...wishes.map((w) => Number(w.pupilId)), ...pending.map((o) => o.pupilId)])];
  const pupils = await db
    .collection("pupils")
    .find({ id: { $in: pids } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, status: 1, branchId: 1, grade: 1, category: 1 } })
    .toArray();
  const pupilBy = new Map(pupils.map((p) => [Number(p.id), p]));
  const inScope = new Map(pupils.filter((p) => !isFrozenStatus(p.status) && branches.includes(branchOfPupil(p))).map((p) => [Number(p.id), p]));
  const [wallets, labels] = await Promise.all([
    db
      .collection(GAM.wallets)
      .find({ pupilId: { $in: [...inScope.keys()] } }, { projection: { _id: 0, pupilId: 1, balance: 1 } })
      .toArray()
      .then((rows) => new Map(rows.map((w) => [Number(w.pupilId), Number(w.balance) || 0]))),
    pupilGroupLabels(db, pids),
  ]);
  const budgets = new Map<number, { limit: number | null; spent: number }>();
  for (const b of branches) {
    const limit = await budgetOf(db, b);
    budgets.set(b, { limit, spent: limit === null ? 0 : await spentSom(db, b, month) });
  }

  let waiting = 0;
  const requests = [];
  for (const w of wishes) {
    const pid = Number(w.pupilId);
    const p = inScope.get(pid);
    const it = byItem.get(Number(w.itemId));
    if (!p || !it) continue;
    const toifa = toifaOf(gradeOf(p), p.category, settings.kidsMaxGrade);
    if (!fitsAudience(it.audience, toifa)) continue;
    const balance = wallets.get(pid) ?? 0;
    // Tangasi yetmagan istak — maqsad, so'rov emas.
    if (balance < it.priceCoins) {
      waiting += 1;
      continue;
    }
    const branchId = branchOfPupil(p);
    const bud = budgets.get(branchId) ?? { limit: null, spent: 0 };
    const err = giveError({ item: it, pupil: { id: pid, name: "", branchId, frozen: false, toifa }, balance, budget: bud.limit, spent: bud.spent });
    requests.push({
      key: `${pid}:${it.id}`,
      pupilId: pid,
      pupilName: pupilName(p),
      groupLabel: labels.get(pid) ?? "",
      itemId: it.id,
      title: itemTitle(it),
      name: it.name,
      kind: it.kind,
      imageUrl: it.imageUrl,
      emoji: it.emoji,
      price: it.priceCoins,
      stockLeft: it.kind === "item" ? (it.stock[String(branchId)] ?? 0) : null,
      balance,
      after: balance - it.priceCoins,
      requestedAt: String(w.addedAtTs ?? w.addedAt ?? ""),
      error: err?.message ?? null,
    });
  }
  // Eng yangisi tepada, eng eskisi pastda (rasmdagidek).
  requests.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt) || a.pupilName.localeCompare(b.pupilName, "uz"));

  const awaiting = pending.map((o) => {
    const p = pupilBy.get(o.pupilId);
    const it = byItem.get(o.itemId);
    return {
      orderId: o.id,
      pupilId: o.pupilId,
      pupilName: p ? pupilName(p) : `#${o.pupilId}`,
      groupLabel: labels.get(o.pupilId) ?? "",
      itemId: o.itemId,
      title: o.itemName,
      name: it?.name ?? o.itemName,
      kind: o.kind,
      imageUrl: it?.imageUrl ?? null,
      emoji: it?.emoji ?? "🎁",
      price: o.priceCoins,
      stockLeft: it && it.kind === "item" ? (it.stock[String(o.branchId)] ?? 0) : null,
      approvedAt: o.givenAt,
      approvedByName: o.givenByName,
      branchName: names.get(o.branchId) ?? "",
      givenDate: o.givenDate,
      canReturn: canReturnOrder(actor, o, today, null),
    };
  });

  return { ...base, requests, waiting, awaiting };
}

function wishLockKey(pupilId: number, itemId: number) {
  return `wishreq:${pupilId}:${itemId}`;
}

/**
 * Tasdiqlash: so'rov hali turganini qulf ostida tekshiradi (ikki xodim bir vaqtda
 * bosganda ikki marta berilmasin), keyin oddiy berish — giveGift istakni o'zi oladi.
 */
export async function approveRequest(db: Db, actor: GamActor, input: { pupilId: number; itemId: number; groupId?: number | null }) {
  if (actor.role === "teacher") throw new GamError(403, "Sovg'ani filial admini yoki direktor beradi");
  return withLock(db, wishLockKey(input.pupilId, input.itemId), async () => {
    const wish = await db.collection(GAM.wishlist).findOne({ pupilId: input.pupilId, itemId: input.itemId }, { projection: { _id: 1 } });
    if (!wish) throw new GamError(409, "So'rov allaqachon ko'rib chiqilgan");
    const item = (await listItems(db)).find((i) => i.id === input.itemId);
    if (!item) throw new GamError(404, "Sovg'a topilmadi");
    // Chegirma to'lovga qo'llanadi — qo'lga beriladigan narsa yo'q.
    return giveGift(db, actor, input, { handover: item.kind !== "discount" });
  });
}

export async function rejectRequest(db: Db, actor: GamActor, input: { pupilId: number; itemId: number; reason: string }) {
  const settings = await loadSettings(db);
  if (!settings.enabled) throw new GamError(409, "Gamifikatsiya moduli o'chiq");
  if (actor.role === "teacher") throw new GamError(403, "So'rovni filial admini yoki direktor ko'rib chiqadi");
  const reason = String(input.reason ?? "").trim().replace(/\s+/g, " ").slice(0, 300);
  if (!reason) throw new GamError(422, "Rad etish sababini yozing");
  const p = await db.collection("pupils").findOne({ id: input.pupilId }, { projection: { _id: 0, id: 1, branchId: 1 } });
  if (!p) throw new GamError(404, "O'quvchi topilmadi");
  const branchId = branchOfPupil(p);
  if (actor.role === "branch_admin" && !actor.branchIds.includes(branchId)) throw new GamError(403, "O'quvchi sizning filialingizda emas");

  return withLock(db, wishLockKey(input.pupilId, input.itemId), async () => {
    const wish = await db.collection(GAM.wishlist).findOne({ pupilId: input.pupilId, itemId: input.itemId });
    if (!wish) throw new GamError(409, "So'rov allaqachon ko'rib chiqilgan");
    const item = (await db.collection(GAM.shopItems).findOne({ id: input.itemId }, PROJ)) as unknown as ShopItem | null;
    const id = await nextSeq(db, GAM.rejections);
    const doc = {
      id,
      pupilId: input.pupilId,
      itemId: input.itemId,
      itemName: item ? itemTitle(item) : `#${input.itemId}`,
      priceCoins: item?.priceCoins ?? 0,
      branchId,
      reason,
      requestedAt: String(wish.addedAtTs ?? wish.addedAt ?? ""),
      rejectedByUserId: actor.userId,
      rejectedByName: actor.name,
      rejectedAt: new Date().toISOString(),
    };
    await db.collection(GAM.rejections).insertOne({ ...doc });
    await db.collection(GAM.wishlist).deleteOne({ pupilId: input.pupilId, itemId: input.itemId });
    await writeAudit(db, actor, GAM.rejections, id, "create", null, { pupilId: input.pupilId, itemId: input.itemId, reason });
    return { rejection: doc };
  });
}

export async function markHandedOver(db: Db, actor: GamActor, orderId: number) {
  if (actor.role === "teacher") throw new GamError(403, "Sovg'ani filial admini yoki direktor topshiradi");
  const o = (await db.collection(GAM.shopOrders).findOne({ id: orderId }, PROJ)) as unknown as ShopOrder | null;
  if (!o) throw new GamError(404, "Xarid topilmadi");
  if (actor.role === "branch_admin" && !actor.branchIds.includes(o.branchId)) throw new GamError(403, "Xarid sizning filialingizda emas");
  const now = new Date().toISOString();
  const r = await db
    .collection(GAM.shopOrders)
    .updateOne({ id: orderId, status: "given", handover: "pending" }, { $set: { handover: "done", handedAt: now, handedByName: actor.name, handedByUserId: actor.userId } });
  if (r.modifiedCount !== 1) throw new GamError(409, o.status !== "given" ? "Sovg'a qaytarilgan" : "Sovg'a allaqachon topshirilgan");
  await writeAudit(db, actor, GAM.shopOrders, orderId, "update", { handover: "pending" }, { handover: "done" });
  return { orderId, handedAt: now };
}

/** Tarix: topshirilgan / berilgan va qaytarilgan xaridlar + rad etilgan so'rovlar (oxirgi `days` kun). */
export async function requestsHistory(db: Db, actor: GamActor, days = 90) {
  const branches = await requestBranches(db, actor);
  if (!branches.length) return { rows: [] };
  const names = await branchBuildingNames(db);
  const today = uzDateIso();
  const sinceMs = Date.now() - days * 86_400_000;
  const sinceDate = uzDateIso(new Date(sinceMs));
  const [orders, rejections] = await Promise.all([
    db
      .collection(GAM.shopOrders)
      .find({ branchId: { $in: branches }, givenDate: { $gte: sinceDate }, $or: [{ handover: { $ne: "pending" } }, { status: "returned" }] }, PROJ)
      .sort({ givenAt: -1 })
      .limit(300)
      .toArray() as unknown as Promise<ShopOrder[]>,
    db
      .collection(GAM.rejections)
      .find({ branchId: { $in: branches }, rejectedAt: { $gte: new Date(sinceMs).toISOString() } }, PROJ)
      .sort({ rejectedAt: -1 })
      .limit(300)
      .toArray(),
  ]);
  const pids = [...new Set([...orders.map((o) => o.pupilId), ...rejections.map((r) => Number(r.pupilId))])];
  const pupils = new Map(
    (await db.collection("pupils").find({ id: { $in: pids } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1 } }).toArray()).map((p) => [Number(p.id), pupilName(p)]),
  );
  const discIds = orders.map((o) => o.discountId).filter((x): x is number => x !== null);
  const discStatus = new Map(
    (discIds.length ? await db.collection(GAM.discounts).find({ id: { $in: discIds } }, { projection: { _id: 0, id: 1, status: 1 } }).toArray() : []).map((d) => [
      Number(d.id),
      String(d.status),
    ]),
  );
  const rows = [
    ...orders.map((o) => ({
      key: `o${o.id}`,
      kind: "order" as const,
      id: o.id,
      pupilId: o.pupilId,
      pupilName: pupils.get(o.pupilId) ?? `#${o.pupilId}`,
      title: o.itemName,
      itemKind: o.kind,
      price: o.priceCoins,
      status: o.status === "returned" ? ("returned" as const) : o.handover === "done" ? ("handed" as const) : ("given" as const),
      at: o.status === "returned" ? (o.returnedAt ?? o.givenAt) : (o.handedAt ?? o.givenAt),
      byName: o.status === "returned" ? (o.returnedByName ?? "") : (o.handedByName ?? o.givenByName),
      note: o.status === "returned" ? (o.returnNote ?? null) : null,
      branchName: names.get(o.branchId) ?? "",
      givenDate: o.givenDate,
      canReturn: canReturnOrder(actor, o, today, o.discountId !== null ? (discStatus.get(o.discountId) ?? null) : null),
    })),
    ...rejections.map((r) => ({
      key: `r${r.id}`,
      kind: "rejection" as const,
      id: Number(r.id),
      pupilId: Number(r.pupilId),
      pupilName: pupils.get(Number(r.pupilId)) ?? `#${r.pupilId}`,
      title: String(r.itemName ?? ""),
      itemKind: "item" as const,
      price: Number(r.priceCoins) || 0,
      status: "rejected" as const,
      at: String(r.rejectedAt ?? ""),
      byName: String(r.rejectedByName ?? ""),
      note: String(r.reason ?? ""),
      branchName: names.get(Number(r.branchId)) ?? "",
      givenDate: "",
      canReturn: false,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return { rows };
}
