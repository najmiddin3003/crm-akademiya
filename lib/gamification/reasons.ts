import type { Db } from "mongodb";
import { diffFields, writeAudit, type GamActor } from "./actor";
import { GAM, isDupKey, nextSeq, raiseSeq } from "./db";
import { intIn } from "./rules";
import { loadSettings } from "./settings";
import {
  PER_DAY_LIMITS,
  SEED_REASONS,
  SYSTEM_REASONS,
  type CoinReason,
  type ReasonAllowedRoles,
  type SystemReasonCode,
} from "./types";

// TANGA SABABLARI (TZ 4.4, 4.9, 5.7, 6.3).
//
// Ikki xil: TIZIM sabablari (9 ta, `code` bilan — avtomatik jarayon yoki
// dars tugmasiga bog'langan; nomi o'zgarmaydi, o'chirilmaydi, miqdori
// sozlamalarda, faqat yoqish/to'xtatish shu yerda) va QO'SHIMCHA sabablar
// (direktor yaratadi — to'liq boshqariladi, o'chirish yumshoq `deletedAt`).
// Yozuvlar sabab nomining NUSXASINI saqlaydi (`reasonName`), shuning uchun
// nomni o'zgartirish yoki o'chirish tarixga tegmaydi.

type Fail = { ok: false; status: number; error: string };

let ensured: Promise<void> | null = null;

/** Tizim sabablari va boshlang'ich qo'shimcha sabablar (bir marta). */
export function ensureReasons(db: Db): Promise<void> {
  ensured ??= doEnsure(db).catch((e) => {
    ensured = null;
    throw e;
  });
  return ensured;
}

async function doEnsure(db: Db): Promise<void> {
  const col = db.collection(GAM.reasons);
  const maxId = Number((await col.find({}).sort({ id: -1 }).limit(1).toArray())[0]?.id) || 0;
  await raiseSeq(db, GAM.reasons, maxId);
  const now = new Date().toISOString();

  const have = new Set(
    (await col.find({ isSystem: true }, { projection: { _id: 0, code: 1 } }).toArray()).map((r) => r.code),
  );
  for (const s of SYSTEM_REASONS) {
    if (have.has(s.code)) continue;
    const id = await nextSeq(db, GAM.reasons);
    try {
      await col.insertOne({
        id, code: s.code, name: s.name, direction: s.direction, amountMin: null, amountMax: null,
        allowedRoles: null, perDayLimit: 0, noteRequired: false, isSystem: true, isActive: true,
        deletedAt: null, createdByUserId: null, createdAt: now, updatedAt: now,
      });
    } catch (e) {
      if (!isDupKey(e)) throw e; // parallel so'rov allaqachon yozgan
    }
  }

  // Boshlang'ich qo'shimcha sabablar — FAQAT BIR MARTA. Belgi sozlamalar
  // hujjatida; unique `key` indeksi tufayli ikkinchi urinish E11000 beradi.
  try {
    await db
      .collection(GAM.settings)
      .updateOne({ key: "main", reasonsSeededAt: { $exists: false } }, { $set: { reasonsSeededAt: now } }, { upsert: true });
  } catch (e) {
    if (isDupKey(e)) return;
    throw e;
  }
  for (const r of SEED_REASONS) {
    const id = await nextSeq(db, GAM.reasons);
    await col.insertOne({ id, code: null, ...r, isSystem: false, deletedAt: null, createdByUserId: null, createdAt: now, updatedAt: now });
  }
}

const SYSTEM_ORDER = SYSTEM_REASONS.map((r) => r.code);

/** O'chirilmagan sabablar: avval tizim sabablari (belgilangan tartibda), keyin qo'shimchalar. */
export async function listReasons(db: Db): Promise<CoinReason[]> {
  await ensureReasons(db);
  const rows = (await db
    .collection(GAM.reasons)
    .find({ deletedAt: null }, { projection: { _id: 0 } })
    .toArray()) as unknown as CoinReason[];
  const custom = rows.filter((r) => !r.isSystem).map((r) => r.id);
  const usage = custom.length
    ? await db
        .collection(GAM.tx)
        .aggregate<{ _id: number; n: number }>([
          { $match: { reasonId: { $in: custom }, status: "active" } },
          { $group: { _id: "$reasonId", n: { $sum: 1 } } },
        ])
        .toArray()
    : [];
  const used = new Map(usage.map((u) => [u._id, u.n]));
  const rank = (r: CoinReason) => (r.isSystem ? SYSTEM_ORDER.indexOf(r.code as SystemReasonCode) : 100);
  return rows
    .map((r) => (r.isSystem ? r : { ...r, usedCount: used.get(r.id) ?? 0 }))
    .sort((a, b) => rank(a) - rank(b) || a.id - b.id);
}

export async function getReason(db: Db, id: number): Promise<CoinReason | null> {
  return (await db.collection(GAM.reasons).findOne({ id, deletedAt: null }, { projection: { _id: 0 } })) as CoinReason | null;
}

/** Tizim sababi yoqilganmi (hodisa kelganda yozuv yaratish-yaratmaslik uchun). */
export async function systemReason(db: Db, code: SystemReasonCode): Promise<CoinReason | null> {
  await ensureReasons(db);
  return (await db.collection(GAM.reasons).findOne({ code, isSystem: true }, { projection: { _id: 0 } })) as CoinReason | null;
}

type ReasonFields = Pick<
  CoinReason,
  "name" | "direction" | "amountMin" | "amountMax" | "allowedRoles" | "perDayLimit" | "noteRequired" | "isActive"
>;

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** Qo'shimcha sabab maydonlari (TZ 4.9.1). `others` — o'chirilmagan boshqa sabablar. */
function checkReason(
  raw: Record<string, unknown>,
  ctx: { dailyDeductionLimit: number; others: CoinReason[] },
): { ok: true; value: ReasonFields } | Fail {
  const d = Number(raw.direction);
  if (d !== 1 && d !== -1) return { ok: false, status: 422, error: "Yo'nalishni tanlang" };
  const direction = d as 1 | -1;

  const name = String(raw.name ?? "").trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) return { ok: false, status: 422, error: "Sabab nomi 1–80 belgi bo'lsin" };
  const key = norm(name);
  const clash =
    SYSTEM_REASONS.some((s) => norm(s.name) === key) ||
    ctx.others.some((r) => norm(r.name) === key && (r.isSystem || r.direction === direction));
  if (clash) return { ok: false, status: 422, error: "Bu nomli sabab bor" };

  // Ayirishda maksimum — kunlik ayirish limiti (TZ 4.9.1).
  const cap = direction < 0 ? ctx.dailyDeductionLimit : 1000;
  const amountMin = intIn(raw.amountMin, 1, cap);
  if (amountMin === null) return { ok: false, status: 422, error: `Miqdor 1–${cap} oralig'ida butun son bo'lsin` };
  const rawMax = raw.amountMax === null || raw.amountMax === undefined || raw.amountMax === "" ? amountMin : raw.amountMax;
  const amountMax = intIn(rawMax, amountMin, cap);
  if (amountMax === null) return { ok: false, status: 422, error: `Maksimum ${amountMin}–${cap} oralig'ida butun son bo'lsin` };

  const roles = String(raw.allowedRoles ?? "");
  if (roles !== "teacher" && roles !== "branch_admin" && roles !== "both") {
    return { ok: false, status: 422, error: "Kim berishini tanlang" };
  }
  const perDayLimit = Number(raw.perDayLimit ?? 0);
  if (!(PER_DAY_LIMITS as readonly number[]).includes(perDayLimit)) {
    return { ok: false, status: 422, error: "Kunlik cheklov noto'g'ri" };
  }
  return {
    ok: true,
    value: {
      name,
      direction,
      amountMin,
      amountMax,
      allowedRoles: roles as ReasonAllowedRoles,
      perDayLimit,
      // Ayirishda izoh har doim majburiy (TZ 4.9.1).
      noteRequired: direction < 0 ? true : raw.noteRequired === true,
      isActive: raw.isActive !== false,
    },
  };
}

async function othersExcept(db: Db, id: number | null): Promise<CoinReason[]> {
  return (await db
    .collection(GAM.reasons)
    .find({ deletedAt: null, ...(id !== null ? { id: { $ne: id } } : {}) }, { projection: { _id: 0 } })
    .toArray()) as unknown as CoinReason[];
}

export async function createReason(db: Db, actor: GamActor, raw: Record<string, unknown>): Promise<{ ok: true; reason: CoinReason } | Fail> {
  await ensureReasons(db);
  const settings = await loadSettings(db);
  const checked = checkReason(raw, { dailyDeductionLimit: settings.dailyDeductionLimit, others: await othersExcept(db, null) });
  if (!checked.ok) return checked;
  const now = new Date().toISOString();
  const reason: CoinReason = {
    id: await nextSeq(db, GAM.reasons),
    code: null,
    ...checked.value,
    isSystem: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(GAM.reasons).insertOne({ ...reason, createdByUserId: actor.userId });
  await writeAudit(db, actor, GAM.reasons, reason.id, "create", null, { ...checked.value });
  return { ok: true, reason: { ...reason, usedCount: 0 } };
}

export async function updateReason(
  db: Db,
  actor: GamActor,
  id: number,
  raw: Record<string, unknown>,
): Promise<{ ok: true; reason: CoinReason; renamed: boolean } | Fail> {
  const cur = await getReason(db, id);
  if (!cur) return { ok: false, status: 404, error: "Sabab topilmadi" };
  if (cur.isSystem) return { ok: false, status: 403, error: "Tizim sababining miqdori Sozlamalarda o'zgartiriladi" };
  const settings = await loadSettings(db);
  const checked = checkReason(raw, { dailyDeductionLimit: settings.dailyDeductionLimit, others: await othersExcept(db, id) });
  if (!checked.ok) return checked;
  const updatedAt = new Date().toISOString();
  await db.collection(GAM.reasons).updateOne({ id }, { $set: { ...checked.value, updatedAt } });
  const d = diffFields(cur as unknown as Record<string, unknown>, { ...checked.value });
  if (d) await writeAudit(db, actor, GAM.reasons, id, "update", d.before, d.after);
  return { ok: true, reason: { ...cur, ...checked.value, updatedAt }, renamed: cur.name !== checked.value.name };
}

export async function deleteReason(db: Db, actor: GamActor, id: number): Promise<{ ok: true } | Fail> {
  const cur = await getReason(db, id);
  if (!cur) return { ok: false, status: 404, error: "Sabab topilmadi" };
  if (cur.isSystem) return { ok: false, status: 403, error: "Tizim sababini o'chirib bo'lmaydi — to'xtatish mumkin" };
  const deletedAt = new Date().toISOString();
  await db.collection(GAM.reasons).updateOne({ id }, { $set: { deletedAt, updatedAt: deletedAt } });
  await writeAudit(db, actor, GAM.reasons, id, "delete", { name: cur.name }, null);
  return { ok: true };
}

/**
 * Yoqish/to'xtatish. «Uzluksiz davomat bonusi» qayta yoqilsa — yangi qoida
 * shu paytdan qo'llanadi (TZ 4.6.5): `streakRuleChangedAt` yoziladi.
 */
export async function setReasonActive(
  db: Db,
  actor: GamActor,
  id: number,
  on: boolean,
): Promise<{ ok: true; reason: CoinReason; streakRuleChanged: boolean } | Fail> {
  const cur = await getReason(db, id);
  if (!cur) return { ok: false, status: 404, error: "Sabab topilmadi" };
  if (cur.isActive === on) return { ok: true, reason: cur, streakRuleChanged: false };
  const now = new Date().toISOString();
  await db.collection(GAM.reasons).updateOne({ id }, { $set: { isActive: on, updatedAt: now } });
  const streakRuleChanged = cur.code === "streak" && on;
  if (streakRuleChanged) {
    await db
      .collection(GAM.settings)
      .updateOne({ key: "main" }, { $set: { streakRuleChangedAt: now } }, { upsert: true });
  }
  await writeAudit(db, actor, GAM.reasons, id, on ? "activate" : "deactivate", { isActive: cur.isActive }, { isActive: on });
  return { ok: true, reason: { ...cur, isActive: on, updatedAt: now }, streakRuleChanged };
}
