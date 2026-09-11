// GURUHLARNI ARXIVGA KO'CHIRISH — `groups` -> `arxivTugaganGuruhlarimiz`.
//
// 11.09.2026, yangi o'quv mavsumi: eski guruhlar bazadan O'CHIRILMAYDI,
// alohida kolleksiyaga ko'chiriladi va kerak bo'lgandagina qaraladi.
// Yangi guruhlar avvalgidek `groups` da yaratiladi; ularning `id`si
// arxivdagi eng katta raqamdan davom etadi (lib/groupIds.ts) — shuning
// uchun bu skriptni ishlatishdan OLDIN ilova o'sha kod bilan deploy
// qilingan bo'lishi kerak, aks holda birinchi yangi guruh id=1 oladi.
//
//   node scripts/archive-groups.mjs            -> quruq sinov: nima bo'lishini ko'rsatadi, YOZMAYDI
//   node scripts/archive-groups.mjs --apply    -> ko'chiradi
//   node scripts/archive-groups.mjs --undo     -> arxivdagilarning HAMMASINI `groups` ga qaytaradi
//
// Tartib (--apply): avval scripts/data/ ga mahalliy JSON nusxa (git'ga
// tushmaydi) -> arxivga yozish (id unique, takror ishga tushsa dublikat
// qilmaydi) -> arxivda HAR BIR id borligini tekshirish -> faqat
// tasdiqlanganlarini `groups` dan o'chirish. Hujjat `_id` bilan birga,
// o'zgarishsiz ko'chadi; ustiga faqat `archivedAt` qo'shiladi.
import { MongoClient } from "mongodb";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const pick = (k, d) => (new RegExp(`^${k}=(.*)$`, "m").exec(env)?.[1] || "").trim().replace(/^["']|["']$/g, "") || d;

// lib/groups.ts dagi ARCHIVED_GROUPS_COLLECTION bilan bir xil bo'lishi SHART.
const LIVE = "groups";
const ARCHIVE = "arxivTugaganGuruhlarimiz";

const APPLY = process.argv.includes("--apply");
const UNDO = process.argv.includes("--undo");

const client = new MongoClient(pick("MONGODB_URI"));
await client.connect();
const db = client.db(pick("MONGODB_DB", "crm_akademiya"));

const byBranch = (docs) => docs.reduce((a, g) => ((a[g.branchId ?? "?"] = (a[g.branchId ?? "?"] || 0) + 1), a), {});
const idRange = (docs) => (docs.length ? `${Math.min(...docs.map((g) => g.id))}..${Math.max(...docs.map((g) => g.id))}` : "—");

/** `from` dagi hammasini `to` ga ko'chiradi (yoki quruq sinovda faqat ko'rsatadi). */
async function move(from, to, transform) {
  const src = db.collection(from);
  const dst = db.collection(to);
  const docs = await src.find({}).sort({ id: 1 }).toArray();
  const memberships = docs.reduce((s, g) => s + (Array.isArray(g.studentIds) ? g.studentIds.length : 0), 0);

  console.log(`${from}: ${docs.length} ta guruh, id ${idRange(docs)}, filial bo'yicha ${JSON.stringify(byBranch(docs))}, o'quvchi a'zoliklari ${memberships}`);
  console.log(`${to}: hozir ${await dst.countDocuments()} ta hujjat`);
  if (!docs.length) { console.log("Ko'chiradigan narsa yo'q."); return; }

  if (!APPLY && !UNDO) {
    console.log("\nQURUQ SINOV — hech narsa yozilmadi. Haqiqiy ko'chirish: --apply");
    return;
  }

  // 1) Mahalliy nusxa — git'ga tushmaydi (.gitignore: scripts/data/*.json).
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const dumpPath = path.join(ROOT, "scripts", "data", `archive-groups-${UNDO ? "undo" : "dump"}-${stamp}.json`);
  fs.mkdirSync(path.dirname(dumpPath), { recursive: true });
  fs.writeFileSync(dumpPath, JSON.stringify({ from, to, takenAt: new Date().toISOString(), count: docs.length, docs }, null, 1));
  console.log(`\nMahalliy nusxa: ${dumpPath}`);

  // 2) Manzilga yozish. `id` unique — takror ishga tushsa allaqachon
  //    borlari 11000 bilan o'tkazib yuboriladi, qolganlari yoziladi.
  await dst.createIndex({ id: 1 }, { unique: true });
  let inserted = 0, already = 0;
  try {
    const r = await dst.insertMany(docs.map(transform), { ordered: false });
    inserted = r.insertedCount;
  } catch (e) {
    if (e?.code !== 11000 && !(e?.writeErrors?.length && e.writeErrors.every((w) => w.code === 11000))) throw e;
    inserted = e.result?.insertedCount ?? e.insertedCount ?? 0;
    already = docs.length - inserted;
  }
  console.log(`${to} ga yozildi: ${inserted} ta yangi, ${already} ta allaqachon bor edi`);

  // 3) Tekshiruv: manbadagi HAR BIR id manzilda bormi. Yo'qlari o'chirilmaydi.
  const ids = docs.map((g) => g.id);
  const present = new Set((await dst.find({ id: { $in: ids } }, { projection: { _id: 0, id: 1 } }).toArray()).map((g) => g.id));
  const verified = ids.filter((id) => present.has(id));
  const missing = ids.filter((id) => !present.has(id));
  if (missing.length) console.error(`DIQQAT: ${missing.length} ta id manzilda topilmadi, ular manbada QOLDIRILDI: ${missing.join(", ")}`);

  // 4) Faqat tasdiqlanganlarini manbadan o'chirish.
  const del = await src.deleteMany({ id: { $in: verified } });
  console.log(`${from} dan o'chirildi: ${del.deletedCount} ta (tasdiqlangan ${verified.length})`);
  console.log(`\nNATIJA: ${from} = ${await src.countDocuments()} ta, ${to} = ${await dst.countDocuments()} ta`);
}

try {
  if (UNDO) {
    // archivedAt olib tashlanadi — hujjat `groups` dagi asl shakliga qaytadi.
    await move(ARCHIVE, LIVE, (g) => { const { archivedAt, ...rest } = g; void archivedAt; return rest; });
  } else {
    await move(LIVE, ARCHIVE, (g) => ({ ...g, archivedAt: new Date() }));
  }
} finally {
  await client.close();
}
