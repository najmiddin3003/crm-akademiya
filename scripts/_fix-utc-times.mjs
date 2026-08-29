// BIR MARTALIK TUZATISH — 2026-08-29.
//
// Ilova Vercel'da UTC serverda ishlagani uchun bir necha tranzaksiyaga
// `date`/`time` 5 soat orqada yozilgan (lib/uzTime.ts izohiga qarang).
// Faqat AYNAN shunday yozuvlar tuzatiladi: saqlangan "sana vaqt" o'sha
// yozuvning `createdAt` ining UTC ko'rinishiga TENG bo'lsa. Boshqasiga
// tegilmaydi — edutizim importidagi 25 561 yozuv allaqachon to'g'ri.
import fs from "fs";
import { MongoClient } from "mongodb";
const env = Object.fromEntries(
  fs.readFileSync(".env.local","utf8").split(/\r?\n/)
    .filter(l=>l.trim()&&!l.startsWith("#")&&l.includes("="))
    .map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const c = new MongoClient(env.MONGODB_URI); await c.connect();
const db = c.db(env.MONGODB_DB);
const col = db.collection("transaction_entries");
const p = (n) => String(n).padStart(2, "0");
const parts = (d) => ({
  date: `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())}`,
  time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
});

const rows = await col.find({ createdAt: { $exists: true }, edutizimId: { $exists: false } },
  { projection: { id:1, date:1, time:1, createdAt:1 } }).toArray();

let fixed = 0;
for (const r of rows) {
  const cd = new Date(r.createdAt);
  if (isNaN(cd.getTime())) continue;
  const utc = parts(cd);
  if (r.date !== utc.date || r.time !== utc.time) continue;   // allaqachon to'g'ri
  const uz = parts(new Date(cd.getTime() + 5 * 3600 * 1000));
  await col.updateOne({ id: r.id }, { $set: { date: uz.date, time: uz.time } });
  console.log(`  ${r.id}: ${r.date} ${r.time}  ->  ${uz.date} ${uz.time}`);
  fixed++;
}
console.log(`\ntuzatildi: ${fixed} ta yozuv`);
await c.close();
