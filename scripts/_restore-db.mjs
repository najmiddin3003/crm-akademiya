// _backup-db.mjs olgan zaxiradan bazani TIKLAYDI.
//
// XAVFLI: tiklanadigan kolleksiyalar avval to'liq tozalanadi. Shuning uchun
// `--yes` bayrog'isiz hech narsa yozmaydi — faqat nima bo'lishini ko'rsatadi.
//
//   node scripts/_restore-db.mjs <zaxira.json>                 → quruq yurish
//   node scripts/_restore-db.mjs <zaxira.json> --yes           → hammasini tiklaydi
//   node scripts/_restore-db.mjs <zaxira.json> --yes pupils    → faqat sanab o'tilganini
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

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const apply = args.includes("--yes");
const only = args.filter((a) => !a.startsWith("--") && a !== file);

if (!file) {
  console.error("Foydalanish: node scripts/_restore-db.mjs <zaxira.json> [--yes] [kolleksiya...]");
  process.exit(1);
}

const dump = JSON.parse(fs.readFileSync(file, "utf8"));
const names = Object.keys(dump.collections).filter((n) => only.length === 0 || only.includes(n));

console.log(`Zaxira: ${file}`);
console.log(`Olingan vaqt: ${dump.takenAt} · baza: ${dump.database}`);
console.log(`${apply ? "TIKLANADI" : "QURUQ YURISH — hech narsa yozilmaydi"}\n`);

const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 });
await client.connect();
const db = client.db(process.env.MONGODB_DB);

for (const name of names) {
  const docs = dump.collections[name];
  const current = await db.collection(name).countDocuments();
  console.log(`  ${name.padEnd(28)} hozir ${String(current).padStart(5)} → tiklangach ${docs.length}`);
  if (!apply) continue;
  await db.collection(name).deleteMany({});
  // _id maydonlari JSON'da satrga aylangan — Mongo o'zi yangisini bersin.
  await db.collection(name).insertMany(docs.map(({ _id, ...rest }) => rest));
}

await client.close();
console.log(apply ? "\nTiklandi." : "\n--yes qo'shsangiz haqiqatan tiklanadi.");
