// FAQAT O'QISH — qaysi to'plam og'ir ekanini ko'rsatadi (zip.md 4-band uchun).
import fs from "fs";
import { MongoClient } from "mongodb";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const client = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5 });
await client.connect();
const db = client.db(env.MONGODB_DB || undefined);

const cols = await db.listCollections({}, { nameOnly: true }).toArray();
const rows = [];
for (const { name } of cols) {
  const s = await db.command({ collStats: name }).catch(() => null);
  if (!s) continue;
  rows.push({ name, docs: s.count || 0, kb: Math.round((s.size || 0) / 1024) });
}
rows.sort((a, b) => b.kb - a.kb);

console.log("to'plam".padEnd(28), "hujjat".padStart(8), "hajm".padStart(10));
console.log("-".repeat(50));
for (const r of rows.slice(0, 18)) {
  console.log(r.name.padEnd(28), String(r.docs).padStart(8), `${r.kb} KB`.padStart(10));
}
await client.close();
