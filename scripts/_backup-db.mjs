// Butun MongoDB bazasining to'liq zaxirasi — bitta JSON fayl.
// Faqat O'QIYDI, hech narsani o'zgartirmaydi.
//
// Ishga tushirish: node scripts/_backup-db.mjs [chiqish-fayli]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const out = process.argv[2] || path.join(ROOT, "..", `crm-zaxira-${stamp}.json`);

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB);

const dump = { database: db.databaseName, takenAt: new Date().toISOString(), collections: {} };
let total = 0;
for (const { name } of (await db.listCollections().toArray()).sort((a, b) => a.name.localeCompare(b.name))) {
  const docs = await db.collection(name).find({}).toArray();
  if (docs.length === 0) continue;
  dump.collections[name] = docs;
  total += docs.length;
  console.log(`  ${name.padEnd(28)} ${docs.length}`);
}
await client.close();

fs.writeFileSync(out, JSON.stringify(dump, null, 2), "utf8");
const kb = (fs.statSync(out).size / 1024).toFixed(1);
console.log(`\nZaxira: ${out}`);
console.log(`Kolleksiya: ${Object.keys(dump.collections).length} · hujjat: ${total} · hajm: ${kb} KB`);
