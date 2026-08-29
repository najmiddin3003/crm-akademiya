// FAQAT O'QISH — noto'g'ri (UTC) vaqt bilan yozilgan tranzaksiyalarni sanaydi.
import fs from "fs";
import { MongoClient } from "mongodb";
const env = Object.fromEntries(
  fs.readFileSync(".env.local","utf8").split(/\r?\n/)
    .filter(l=>l.trim()&&!l.startsWith("#")&&l.includes("="))
    .map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const c = new MongoClient(env.MONGODB_URI); await c.connect();
const db = c.db(env.MONGODB_DB);
const p = (n) => String(n).padStart(2, "0");
const utcStr  = (d) => `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
const uzStr   = (d) => utcStr(new Date(d.getTime() + 5*3600*1000));

const rows = await db.collection("transaction_entries")
  .find({ createdAt: { $exists: true } }, { projection: { id:1, date:1, time:1, createdAt:1, edutizimId:1 } })
  .toArray();

let utcLike = 0, uzLike = 0, other = 0;
const samples = [];
for (const r of rows) {
  const cd = new Date(r.createdAt);
  if (isNaN(cd.getTime())) { other++; continue; }
  const mine = `${r.date} ${r.time}`;
  if (mine === utcStr(cd)) { utcLike++; if (samples.length < 5) samples.push({ id:r.id, saqlangan:mine, utc:utcStr(cd), uz:uzStr(cd), edutizim: !!r.edutizimId }); }
  else if (mine === uzStr(cd)) uzLike++;
  else other++;
}
console.log("createdAt bor yozuvlar:", rows.length);
console.log("  UTC bo'yicha yozilgan (NOTO'G'RI):", utcLike);
console.log("  UZ (+5) bo'yicha yozilgan (to'g'ri):", uzLike);
console.log("  boshqacha / mos kelmadi:", other);
console.log("\nnamunalar:"); for (const s of samples) console.log(" ", JSON.stringify(s));
await c.close();
