// GURUH A'ZOLIGI TARIXINI TO'LDIRISH — bazaga YOZADI.
// (`_` bilan boshlanmaydi: `scripts/_*.mjs` faqat o'lchov degani.)
//
//   node scripts/backfill-group-memberships.mjs            # quruq yurish
//   node scripts/backfill-group-memberships.mjs --apply    # haqiqatan yozadi
//
// ------------------------------------------------------------------
// NIMA VA NEGA (20.09.2026, Qarzdorlar hisoboti — lib/debtors.ts)
//
// Hisobot darslarni guruh jadvali bo'yicha A'ZOLIK ORALIG'IDA sanaydi
// (`group_memberships`, lib/groupMembership.ts). Kolleksiya yangi:
// 20.09.2026 dan API guruhga qo'shish/chiqarishda yozadi. Undan oldin
// qo'shilgan o'quvchilar faqat `groups.studentIds` da — ular uchun ochiq
// a'zolik yozuvi yaratiladi:
//   joinedAt: null  — sanasi noma'lum; hisobot GURUHNING boshlanish
//                     sanasini oladi (startDate / period). Guruhda u ham
//                     bo'lmasa — hisobotda "boshlanish sanasi yo'q".
//   source: "backfill"
// IDEMPOTENT: (guruh, o'quvchi) uchun ochiq yozuv bo'lsa qayta yozilmaydi;
// `studentIds` da yo'q, lekin ochiq yozuvi bor o'quvchi (API'siz
// chiqarilgan) — hisobot uchun yopiladi (leftAt = bugun) va chiqishda
// ko'rsatiladi. Arxiv kolleksiyasiga (arxivTugaganGuruhlarimiz) tegilmaydi.
import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";

const ROOT = path.resolve(import.meta.dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const APPLY = process.argv.includes("--apply");
const COL = "group_memberships";

/** Toshkent kuni "YYYY-MM-DD" (lib/uzTime.ts → uzDateIso bilan bir xil). */
function todayUz() {
  const d = new Date(Date.now() + 5 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await client.connect();
const db = client.db(process.env.MONGODB_DB || "crm_akademiya");

try {
  const groups = await db
    .collection("groups")
    .find({}, { projection: { _id: 0, id: 1, name: 1, course: 1, studentIds: 1, startDate: 1, period: 1, branchId: 1 } })
    .sort({ id: 1 })
    .toArray();
  const existing = await db.collection(COL).find({}, { projection: { _id: 0, groupId: 1, pupilId: 1, leftAt: 1 } }).toArray();
  const openKey = new Set(existing.filter((m) => m.leftAt === null).map((m) => `${m.groupId}:${m.pupilId}`));

  const last = await db.collection(COL).find({}, { projection: { id: 1, _id: 0 } }).sort({ id: -1 }).limit(1).toArray();
  let nextId = (last[0]?.id ?? 0) + 1;

  const toInsert = [];
  const toClose = [];
  const groupIds = new Set(groups.map((g) => g.id));
  for (const g of groups) {
    const ids = Array.isArray(g.studentIds) ? g.studentIds : [];
    const hasStart = !!(g.startDate || (g.period && /\d{2}\.\d{2}\.\d{4}/.test(g.period)));
    let added = 0;
    for (const pupilId of ids) {
      if (openKey.has(`${g.id}:${pupilId}`)) continue;
      toInsert.push({ id: nextId++, groupId: g.id, pupilId, joinedAt: null, leftAt: null, source: "backfill", createdAt: new Date().toISOString() });
      added += 1;
    }
    console.log(`  f${g.branchId ?? "?"} #${g.id} ${g.name} (${g.course}): ${ids.length} a'zo, yangi yozuv ${added}${hasStart ? "" : "  ! boshlanish sanasi yo'q"}`);
  }
  // Ochiq yozuvi bor, lekin endi ro'yxatda yo'q (yoki guruhi o'chirilgan/arxivlangan).
  const idSet = new Map(groups.map((g) => [g.id, new Set(g.studentIds ?? [])]));
  for (const m of existing) {
    if (m.leftAt !== null) continue;
    const members = idSet.get(m.groupId);
    if (!groupIds.has(m.groupId) || !members.has(m.pupilId)) toClose.push({ groupId: m.groupId, pupilId: m.pupilId });
  }

  console.log(`\n${APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ==="}  yangi: ${toInsert.length}, yopiladi: ${toClose.length}`);
  for (const c of toClose) console.log(`  yopiladi: guruh #${c.groupId}, o'quvchi #${c.pupilId}`);
  if (!APPLY) {
    console.log("Hech narsa o'zgartirilmadi. Qo'llash uchun: --apply");
  } else {
    if (toInsert.length) await db.collection(COL).insertMany(toInsert);
    const today = todayUz();
    for (const c of toClose) {
      await db.collection(COL).updateMany({ groupId: c.groupId, pupilId: c.pupilId, leftAt: null }, { $set: { leftAt: today } });
    }
    console.log(`YOZILDI: ${toInsert.length} ta yangi, ${toClose.length} ta yopildi.`);
  }
} finally {
  await client.close();
}
