// Xulosaning TAKRORLANMASLIK belgisini tekshiradi — vaqtinchalik
// kolleksiyada, haqiqiy `sync_digests` ga tegmasdan va Telegram'ga
// hech narsa yubormasdan.
//
//   node scripts/_digest-claim-check.mjs
//
// Nima sinaladi: `lib/sync/salaryDigest.ts` dagi band qilish naqshi —
// `findOneAndUpdate` + `upsert` + `returnDocument: "before"`. Butun
// himoya shunga tayanadi: hujjatni YARATGAN chaqiruvda `before` null
// qaytishi kerak, keyingilarida esa hujjatning o'zi.
//
// Nega muhim: `sync_runs` da bir kunda 25 ta cron yugurishi bor, 11
// tasi olti daqiqa ichida. Belgi ishlamasa guruhga 11 ta bir xil
// xulosa tushardi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const HERE = path.dirname(fileURLToPath(import.meta.url));
for (const l of fs.readFileSync(path.join(HERE, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const s = l.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB);
const COL = "_sinov_digest_claim";
const col = db.collection(COL);
await col.drop().catch(() => {});
await col.createIndex({ period: 1 }, { unique: true });

const PERIOD = "SINOV-2026-08-15";
const nowIso = () => new Date().toISOString();

/** salaryDigest.ts dagi band qilish bilan AYNAN bir xil ketma-ketlik. */
async function claim(staleMs = 10 * 60_000) {
  const before = await col.findOneAndUpdate(
    { period: PERIOD },
    { $setOnInsert: { period: PERIOD, claimedAt: nowIso(), sentAt: null, messageIds: [], attempts: 0, error: null } },
    { upsert: true, returnDocument: "before" },
  );
  if (before === null) return "yaratdi";
  if (before.sentAt) return "allaqachon yuborilgan";
  const stale = new Date(Date.now() - staleMs).toISOString();
  const taken = await col.findOneAndUpdate(
    { period: PERIOD, sentAt: null, claimedAt: { $lt: stale } },
    { $set: { claimedAt: nowIso() }, $inc: { attempts: 1 } },
    { returnDocument: "after" },
  );
  return taken !== null ? "eskirganini oldi" : "band";
}

let ok = true;
const check = (label, got, want) => {
  const good = got === want;
  if (!good) ok = false;
  console.log(`  ${good ? "✓" : "✗"} ${label}: "${got}"${good ? "" : ` (kutilgan "${want}")`}`);
};

console.log("KETMA-KET CHAQIRUV");
check("1-chaqiruv hujjatni yaratadi", await claim(), "yaratdi");
check("2-chaqiruv band deb qaytadi", await claim(), "band");
check("3-chaqiruv ham band", await claim(), "band");

console.log("\nBIR VAQTDA 10 CHAQIRUV (ikki Vercel nusxasi holati)");
await col.deleteMany({});
const results = await Promise.all(Array.from({ length: 10 }, () => claim()));
const created = results.filter((r) => r === "yaratdi").length;
check("faqat BITTASI yaratadi", String(created), "1");
console.log(`     natijalar: ${results.join(", ")}`);

console.log("\nYUBORILGANDAN KEYIN");
await col.updateOne({ period: PERIOD }, { $set: { sentAt: nowIso() } });
check("qayta yubormaydi", await claim(), "allaqachon yuborilgan");

console.log("\nURINISH UZILIB QOLGAN HOLAT (yuborilmagan, belgi eskirgan)");
await col.updateOne({ period: PERIOD }, { $set: { sentAt: null, claimedAt: new Date(Date.now() - 60 * 60_000).toISOString() } });
check("eskirgan belgini qayta oladi", await claim(0), "eskirganini oladi".replace("oladi", "oldi"));

await col.drop();
console.log(ok ? "\n✓ Belgi ishonchli." : "\n✗ Belgida muammo bor.");
await client.close();
process.exit(ok ? 0 : 1);
