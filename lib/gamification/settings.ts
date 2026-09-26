import type { AnyBulkWriteOperation, Db, Document } from "mongodb";
import { uzDateIso } from "@/lib/uzTime";
import { diffFields, writeAudit, type GamActor } from "./actor";
import { GAM } from "./db";
import { checkLevels, checkSettingsPatch, levelIndexOf } from "./rules";
import { DEFAULT_LEVELS, DEFAULT_SETTINGS, type GamLevel, type GamSettings } from "./types";

// Sozlamalar → Gamifikatsiya (TZ 5.7, 6.1): butun markaz bo'yicha bitta
// hujjat `{key: "main"}`. O'zgartirishni faqat direktor qiladi (route'da
// tekshiriladi), har o'zgarish audit jurnaliga yoziladi.

const KEY = "main";

type Fail = { ok: false; status: number; error: string };

export async function loadSettings(db: Db): Promise<GamSettings> {
  const doc = await db
    .collection(GAM.settings)
    .findOne({ key: KEY }, { projection: { _id: 0, key: 0, reasonsSeededAt: 0 } });
  const merged = { ...DEFAULT_SETTINGS, ...(doc ?? {}) } as GamSettings;
  if (!Array.isArray(merged.levels) || merged.levels.length !== DEFAULT_LEVELS.length) merged.levels = DEFAULT_LEVELS;
  return merged;
}

/** O'chirilmagan ayiriladigan qo'shimcha sabablar maksimumining eng kattasi (TZ 4.10.4). */
async function maxNegativeReasonMax(db: Db): Promise<number> {
  const top = await db
    .collection(GAM.reasons)
    .find({ isSystem: false, direction: -1, deletedAt: null }, { projection: { _id: 0, amountMax: 1 } })
    .sort({ amountMax: -1 })
    .limit(1)
    .toArray();
  return Number(top[0]?.amountMax) || 0;
}

/** Raqamli sozlamalar yamog'i (Umumiy tab va tizim sabablari oynasi). */
export async function saveSettings(
  db: Db,
  actor: GamActor,
  patch: Record<string, unknown>,
): Promise<{ ok: true; settings: GamSettings; streakRuleChanged: boolean } | Fail> {
  const current = await loadSettings(db);
  const checked = checkSettingsPatch(current, patch, await maxNegativeReasonMax(db));
  if (!checked.ok) return { ok: false, status: 422, error: checked.error };
  const next = checked.value;

  const set: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) {
    const key = k as keyof GamSettings;
    if (key in next && next[key] !== current[key]) set[key] = next[key];
  }
  if (Object.keys(set).length === 0) return { ok: true, settings: current, streakRuleChanged: false };

  // Seriya qoidasi o'zgarsa — yangi N faqat shu paytdan keyingi darslarga
  // qo'llanadi, avvalgi bonuslar va joriy seriyalar tegilmaydi (TZ 4.6.5).
  const streakRuleChanged = "streakLessons" in set;
  if (streakRuleChanged) set.streakRuleChangedAt = new Date().toISOString();
  const d = diffFields(current as unknown as Record<string, unknown>, { ...set });

  set.updatedByName = actor.name;
  set.updatedAt = new Date().toISOString();
  await db.collection(GAM.settings).updateOne({ key: KEY }, { $set: set }, { upsert: true });
  if (d) await writeAudit(db, actor, GAM.settings, KEY, "update", d.before, d.after);
  return { ok: true, settings: await loadSettings(db), streakRuleChanged };
}

/** Modulni yoqish/o'chirish. Birinchi yoqilgan kun — `startDate` (TZ 6.1). */
export async function setEnabled(db: Db, actor: GamActor, on: boolean): Promise<GamSettings> {
  const current = await loadSettings(db);
  if (current.enabled === on) return current;
  const set: Record<string, unknown> = { enabled: on, updatedByName: actor.name, updatedAt: new Date().toISOString() };
  if (on && !current.startDate) set.startDate = uzDateIso();
  await db.collection(GAM.settings).updateOne({ key: KEY }, { $set: set }, { upsert: true });
  await writeAudit(db, actor, GAM.settings, KEY, on ? "activate" : "deactivate", { enabled: current.enabled }, { enabled: on });
  return loadSettings(db);
}

/** Chegara o'zgarsa nechta o'quvchi darajasi pasayadi / ko'tariladi (TZ 4.2.5). */
async function levelImpact(db: Db, from: GamLevel[], to: GamLevel[]): Promise<{ down: number; up: number }> {
  let down = 0;
  let up = 0;
  const cur = db.collection(GAM.wallets).find({}, { projection: { _id: 0, earnedTotal: 1 } });
  for await (const w of cur) {
    const e = Number(w.earnedTotal) || 0;
    const a = levelIndexOf(e, from);
    const b = levelIndexOf(e, to);
    if (b < a) down++;
    else if (b > a) up++;
  }
  return { down, up };
}

export async function saveLevels(
  db: Db,
  actor: GamActor,
  raw: unknown,
  preview: boolean,
): Promise<{ ok: true; levels: GamLevel[]; down: number; up: number; saved: boolean } | Fail> {
  const checked = checkLevels(raw);
  if (!checked.ok) return { ok: false, status: 422, error: checked.error };
  const current = await loadSettings(db);
  const impact = await levelImpact(db, current.levels, checked.value);
  if (preview) return { ok: true, levels: checked.value, ...impact, saved: false };

  await db.collection(GAM.settings).updateOne(
    { key: KEY },
    { $set: { levels: checked.value, updatedByName: actor.name, updatedAt: new Date().toISOString() } },
    { upsert: true },
  );
  const d = diffFields({ levels: current.levels }, { levels: checked.value });
  if (d) await writeAudit(db, actor, "levels", KEY, "update", d.before, d.after);

  // Hamyonlardagi keshlangan daraja yangi chegaralarga moslanadi.
  const ops: AnyBulkWriteOperation<Document>[] = [];
  const cur = db.collection(GAM.wallets).find({}, { projection: { _id: 0, pupilId: 1, earnedTotal: 1, levelPosition: 1 } });
  for await (const w of cur) {
    const pos = levelIndexOf(Number(w.earnedTotal) || 0, checked.value) + 1;
    if (pos !== w.levelPosition) ops.push({ updateOne: { filter: { pupilId: w.pupilId }, update: { $set: { levelPosition: pos } } } });
  }
  if (ops.length) await db.collection(GAM.wallets).bulkWrite(ops, { ordered: false });
  return { ok: true, levels: checked.value, ...impact, saved: true };
}
