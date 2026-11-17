import type { Db } from "mongodb";
import { AUTO_EVENTS, autoEvent, renderAutoHtml, type AutoKey, type AutoMessagesPayload, type AutoRow, type AutoSetting } from "@/lib/autoMessageTypes";
import { studentBotPushEnabled } from "@/lib/studentBot/config";

// AVTOMATIK XABARLAR (36-qism) — sozlamalar (`auto_messages`: hodisa → yoqilgan, matn) va statistika.
// Yuborish lib/studentBot/notify.ts da: har hodisa oldidan `autoMessageFor` — o'chirilgan bo'lsa jim qaytadi,
// shablon bo'lsa uning matni, bo'lmasa standart (lib/studentBot/views.ts). Kesh — 30 soniya (har davomat
// belgisida bazaga bormaslik uchun); saqlanganda tozalanadi.
// Statistika: To'lov — `sms_messages` (purpose payment); Davomat — `attendance.botNotice`; to'lov eslatmasi va
// guruh xabari jurnalga yozilmaydi (null).

export const AUTO_MESSAGES = "auto_messages";

let cache: { at: number; map: Map<string, AutoSetting> } | null = null;

async function settings(db: Db): Promise<Map<string, AutoSetting>> {
  if (cache && Date.now() - cache.at < 30_000) return cache.map;
  const docs = await db.collection<AutoSetting>(AUTO_MESSAGES).find({}, { projection: { _id: 0 } }).toArray();
  cache = { at: Date.now(), map: new Map(docs.map((d) => [d.key, d])) };
  return cache.map;
}

/**
 * Hodisa xabari: `null` — o'chirilgan (yuborilmaydi); `fallback()` — standart matn; shablon bo'lsa — uning HTML i.
 * `vals` — shablon o'zgaruvchilari.
 */
export async function autoMessageFor(db: Db, key: AutoKey, vals: Record<string, string>, fallback: () => string): Promise<string | null> {
  const s = (await settings(db).catch(() => new Map<string, AutoSetting>())).get(key);
  if (s && s.enabled === false) return null;
  return s?.text?.trim() ? renderAutoHtml(s.text, vals) : fallback();
}

export async function saveAutoSetting(db: Db, key: string, enabled: boolean, text: string, by: string) {
  const ev = autoEvent(key);
  if (!ev) return { ok: false as const, error: "Hodisa topilmadi" };
  if (!ev.wired) return { ok: false as const, error: "Bu hodisaning yuboruvchisi hali ulanmagan" };
  const clean = String(text ?? "").replace(/\r/g, "").trim().slice(0, 1500);
  const unknown = [...clean.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((v) => !ev.vars.includes(v));
  if (unknown.length) return { ok: false as const, error: `Noma'lum o'zgaruvchi: {${unknown[0]}}` };
  const same = clean === ev.def.trim();
  await db.collection(AUTO_MESSAGES).updateOne({ key }, { $set: { key, enabled: !!enabled, text: same ? "" : clean, updatedBy: by, updatedAt: new Date().toISOString() } }, { upsert: true });
  cache = null;
  return { ok: true as const };
}

export async function autoMessagesReport(db: Db, from: string, to: string): Promise<AutoMessagesPayload> {
  const map = await settings(db);
  const [pay, att, pending, sys] = await Promise.all([
    db
      .collection("sms_messages")
      .aggregate([{ $match: { purpose: "payment", date: { $gte: from, $lte: to } } }, { $group: { _id: { ch: "$channel", st: "$status" }, n: { $sum: 1 } } }])
      .toArray(),
    db
      .collection("attendance")
      .aggregate([{ $match: { date: { $gte: from, $lte: to }, botNotice: { $exists: true } } }, { $group: { _id: "$botNotice.reason", n: { $sum: 1 } } }])
      .toArray(),
    db.collection("sms_messages").countDocuments({ status: "Kutilmoqda", date: { $gte: from, $lte: to } }),
    db
      .collection("sms_messages")
      .aggregate([{ $match: { purpose: { $in: ["invite", "password-reset"] }, date: { $gte: from, $lte: to } } }, { $group: { _id: { p: "$purpose", st: "$status" }, n: { $sum: 1 } } }])
      .toArray(),
  ]);
  const payTotal = pay.reduce((a, x) => a + x.n, 0);
  const payFail = pay.filter((x) => x._id.st === "Yuborilmadi").reduce((a, x) => a + x.n, 0);
  const paySms = pay.filter((x) => x._id.ch !== "telegram" && x._id.st !== "Yuborilmadi").reduce((a, x) => a + x.n, 0);
  const attTotal = att.reduce((a, x) => a + x.n, 0);
  const attSent = att.filter((x) => x._id === "sent").reduce((a, x) => a + x.n, 0);
  const stat: Partial<Record<AutoKey, { sent: number; failed: number }>> = {
    payment: { sent: payTotal, failed: payFail },
    attendance: { sent: attTotal, failed: attTotal - attSent },
  };
  const rows: AutoRow[] = AUTO_EVENTS.map((e) => {
    const s = map.get(e.key);
    return { ...e, enabled: e.wired ? s?.enabled !== false : false, text: s?.text?.trim() ? s.text : e.def, custom: !!s?.text?.trim(), sent: stat[e.key]?.sent ?? null, failed: stat[e.key]?.failed ?? null };
  });
  const total = payTotal + attTotal;
  const failed = payFail + (attTotal - attSent);
  return {
    ok: true,
    from,
    to,
    rows,
    kpi: { total, delivered: total - failed, telegram: total - failed - paySms, sms: paySms, failed, pending },
    system: {
      invite: sys.filter((x) => x._id.p === "invite").reduce((a, x) => a + x.n, 0),
      reset: sys.filter((x) => x._id.p === "password-reset").reduce((a, x) => a + x.n, 0),
      failed: sys.filter((x) => x._id.st === "Yuborilmadi").reduce((a, x) => a + x.n, 0),
    },
    pushOn: studentBotPushEnabled(),
  };
}
