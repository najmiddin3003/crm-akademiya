import type { Db } from "mongodb";
import type { Group } from "@/lib/groups";
import { uzDateIso } from "@/lib/uzTime";
import type { GamActor } from "./actor";
import { GAM, withLock } from "./db";
import type { TuitionDiscount } from "./discounts";
import { groupRanking, pupilName } from "./ranking";
import { levelIndexOf } from "./rules";
import { branchNames, toGamGroup } from "./scope";
import { loadSettings } from "./settings";
import { fitsAudience, itemTitle, listItems, pupilShopInfo } from "./shop";
import { studentHistory, studentProfile, type HistoryFilter } from "./students";
import { GamError, isFrozenStatus } from "./wallet";

// O'QUVCHI SAHIFASI (TZ 5.8; prototipdagi «Mening sahifam» va o'quvchi
// «Do'kon»i) — shaxsiy havola va Telegram Mini App uchun BITTA ma'lumot.
//
// Hisoblar xodim profilinikidan qayta ishlatiladi (daraja, seriya, guruhdagi
// o'rin, nishonlar, istaklar, xaridlar, tarix) — «tizim» nomidan chaqiriladi
// va xodimga oid hamma narsa (amallar, sabablar, qaytarish huquqi, tannarx,
// ombor soni) olib tashlanadi. O'quvchi faqat o'zini ko'radi va faqat
// istak qo'shadi/olib tashlaydi.

/** Faqat o'qish uchun «tizim» — ko'rish huquqi tekshiruvidan o'tadi, amallar ishlatilmaydi. */
const SYSTEM: GamActor = { role: "director", userId: "system", name: "Tizim", employeeId: null, branchIds: [] };

async function loadPupil(db: Db, pupilId: number) {
  const p = await db
    .collection("pupils")
    .findOne({ id: pupilId }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, status: 1, branchId: 1 } });
  if (!p) throw new GamError(404, "O'quvchi topilmadi");
  return p;
}

/**
 * Yengil xulosa — o'quvchilar botidagi «🪙 Koinlar» va kabinet sarlavhasi
 * uchun. Modul yoqilmagan bo'lsa `null` (u yerlar eskicha qoladi).
 */
export async function studentCoinSummary(db: Db, pupilId: number) {
  const settings = await loadSettings(db);
  if (!settings.enabled || !settings.startDate) return null;
  const w = await db.collection(GAM.wallets).findOne({ pupilId }, { projection: { _id: 0, balance: 1, earnedTotal: 1 } });
  const earned = Number(w?.earnedTotal) || 0;
  const li = levelIndexOf(earned, settings.levels);
  const nx = settings.levels[li + 1];
  return {
    balance: Number(w?.balance) || 0,
    earned,
    level: settings.levels[li]?.name ?? "",
    levelIndex: li,
    levels: settings.levels.length,
    nextName: nx?.name ?? null,
    toNext: nx ? nx.minEarned - earned : 0,
  };
}

/** Ro'yxat uchun qisqa ma'lumot (Mini App'dagi farzand tanlovi). */
export async function pupilBrief(db: Db, pupilId: number) {
  const p = await loadPupil(db, pupilId);
  const names = await branchNames(db);
  const b = Number(p.branchId) || 1;
  return { id: pupilId, name: pupilName(p), center: names.get(b) ?? "" };
}

export async function studentPageData(db: Db, pupilId: number) {
  const settings = await loadSettings(db);
  const p = await loadPupil(db, pupilId);
  const names = await branchNames(db);
  const center = names.get(Number(p.branchId) || 1) ?? "";
  const firstName = String(p.firstName ?? "").trim() || pupilName(p);
  // Modul yoqilmaguncha o'quvchiga hech narsa ko'rsatilmaydi (tangalar hali yozilmagan).
  if (!settings.enabled || !settings.startDate) {
    return { enabled: false as const, pupil: { id: pupilId, name: pupilName(p), firstName, center } };
  }

  const [prof, shop, items, groups, discounts] = await Promise.all([
    studentProfile(db, SYSTEM, pupilId),
    pupilShopInfo(db, SYSTEM, pupilId),
    listItems(db),
    db
      .collection("groups")
      .find({ studentIds: pupilId, status: "active" }, { projection: { _id: 0, id: 1, name: 1, course: 1, teacher: 1, branchId: 1, studentIds: 1, status: 1 } })
      .toArray(),
    db.collection(GAM.discounts).find({ pupilId, status: "active" }, { projection: { _id: 0 } }).sort({ month: 1 }).toArray() as unknown as Promise<TuitionDiscount[]>,
  ]);
  const balance = prof.wallet.balance;
  const wished = new Set(shop.wishes.map((w) => w.itemId));

  // Guruh reytingi (TZ 5.8): top-5, o'zi va «Top-5 ga chiqish uchun yana N tanga».
  const month = uzDateIso().slice(0, 7);
  const rankings = [];
  for (const gd of groups) {
    const g = toGamGroup(gd as unknown as Group);
    const rk = await groupRanking(db, g, month);
    const me = rk.find((r) => r.pupilId === pupilId) ?? null;
    const top = rk.filter((r) => r.rank <= 5);
    const minTop = top.length ? Math.min(...top.map((r) => r.points)) : 0;
    rankings.push({
      groupId: g.id,
      label: g.label,
      total: rk.length,
      top: top.map((r) => ({ rank: r.rank, name: r.name, points: r.points, me: r.pupilId === pupilId })),
      me: me ? { rank: me.rank, points: me.points } : null,
      needForTop5: me && me.rank > 5 ? Math.max(1, minTop - me.points) : 0,
    });
  }

  const history = await studentHistory(db, SYSTEM, pupilId, "all", 0);
  return {
    enabled: true as const,
    month,
    pupil: { id: pupilId, name: pupilName(p), firstName, center, grade: prof.pupil.grade, toifa: prof.pupil.toifa, frozen: prof.pupil.frozen },
    wallet: prof.wallet,
    levels: prof.levels,
    levelIndex: prof.levelIndex,
    streakOn: prof.streakOn,
    streakBonus: prof.streakBonus,
    bestStreak: prof.bestStreak,
    groupsCount: prof.groups.length,
    discounts: discounts.map((d) => ({ month: d.month, percent: d.percent, amountSom: d.amountSom, groupLabel: d.groupLabel })),
    wishlistMax: shop.wishlistMax,
    wishes: shop.wishes.map((w) => ({ itemId: w.itemId, title: w.title, imageUrl: w.imageUrl, emoji: w.emoji, price: w.price, addedAt: w.addedAt, ready: w.ready, noStock: w.noStock })),
    orders: shop.orders.map((o) => ({ id: o.id, itemName: o.itemName, priceCoins: o.priceCoins, givenDate: o.givenDate, status: o.status, returnNote: o.returnNote, returnedAt: o.returnedAt })),
    spentTotal: shop.spentTotal,
    // Faqat o'z toifasidagi sovg'alar; tannarx va ombor ko'rinmaydi (TZ 5.5).
    shop: items
      .filter((i) => fitsAudience(i.audience, prof.pupil.toifa))
      .map((i) => ({
        id: i.id,
        title: itemTitle(i),
        kind: i.kind,
        percent: i.discountPercent,
        imageUrl: i.imageUrl,
        emoji: i.emoji,
        price: i.priceCoins,
        wished: wished.has(i.id),
        need: Math.max(0, i.priceCoins - balance),
      })),
    rankings,
    badges: prof.badges,
    history: stripHistory(history),
  };
}

type HistoryPage = Awaited<ReturnType<typeof studentHistory>>;

/** Tarix — o'quvchiga: amallar va xarid havolalari olib tashlanadi. */
function stripHistory(h: HistoryPage) {
  return {
    total: h.total,
    rows: h.rows.map((r) => ({
      id: r.id,
      date: r.date,
      label: r.label,
      note: r.note,
      groupLabel: r.groupLabel,
      amount: r.amount,
      status: r.status,
      cancelNote: r.cancelNote,
      createdByName: r.createdByName,
    })),
  };
}

/** «Yana ko'rsatish» va tarix filtrlari (TZ 5.8 — bekor qilinganlar ham, chizilgan holda). */
export async function studentPageHistory(db: Db, pupilId: number, filter: HistoryFilter, offset: number) {
  return stripHistory(await studentHistory(db, SYSTEM, pupilId, filter, offset));
}

/**
 * Istak qo'shish / olib tashlash (TZ 4.18.1, 5.8): faqat o'z toifasidagi
 * sovg'a, ko'pi bilan `wishlistMax` ta, bittasi ikki marta qo'shilmaydi.
 * Ketgan o'quvchining sahifasi faqat ko'rish uchun.
 */
export async function setWish(db: Db, pupilId: number, itemId: number, on: boolean): Promise<{ wished: boolean; count: number; max: number }> {
  const settings = await loadSettings(db);
  if (!settings.enabled || !settings.startDate) throw new GamError(409, "Gamifikatsiya moduli o'chiq");
  const p = await loadPupil(db, pupilId);
  if (isFrozenStatus(p.status)) throw new GamError(403, "Ketgan o'quvchining sahifasi faqat ko'rish uchun");
  const col = db.collection(GAM.wishlist);
  return withLock(db, `wish:${pupilId}`, async () => {
    if (!on) {
      await col.deleteOne({ pupilId, itemId });
      return { wished: false, count: await col.countDocuments({ pupilId }), max: settings.wishlistMax };
    }
    const item = (await listItems(db)).find((i) => i.id === itemId);
    if (!item) throw new GamError(404, "Sovg'a topilmadi");
    const info = await pupilShopInfo(db, SYSTEM, pupilId);
    if (info.wishes.some((w) => w.itemId === itemId)) return { wished: true, count: info.wishes.length, max: settings.wishlistMax };
    const prof = await studentProfile(db, SYSTEM, pupilId);
    if (!fitsAudience(item.audience, prof.pupil.toifa)) {
      if (item.audience === "kids") throw new GamError(422, "Bu sovg'a kichiklar uchun");
      throw new GamError(422, "Bu sovg'a kattalar uchun");
    }
    if (info.wishes.length >= settings.wishlistMax) {
      const max = settings.wishlistMax;
      throw new GamError(422, `Istaklar ro'yxatiga ko'pi bilan ${max} ta sovg'a qo'shiladi`);
    }
    await col.updateOne({ pupilId, itemId }, { $setOnInsert: { pupilId, itemId, addedAt: uzDateIso() } }, { upsert: true });
    return { wished: true, count: info.wishes.length + 1, max: settings.wishlistMax };
  });
}
