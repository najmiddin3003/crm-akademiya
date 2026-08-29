// Kassalar sahifasi: server tomondagi filtr klient filtri bilan AYNAN bir
// xil qatorlarni (va ular ustidagi Kirim/Chiqim yig'indisini) berishini
// tekshiradi.
import fs from "fs";
import { MongoClient } from "mongodb";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const c = new MongoClient(env.MONGODB_URI); await c.connect();
const col = c.db(env.MONGODB_DB).collection("transaction_entries");

const all = await col.find({}).sort({ id: -1 }).toArray();
const totals = (rows) => {
  let income = 0, expense = 0;
  for (const e of rows) { if (e.amount > 0) income += e.amount; else expense += -e.amount; }
  return { qatorlar: rows.length, kirim: income, chiqim: expense };
};

const cases = [
  { cashboxId: 4, from: "2026-08-29", to: "2026-08-29" },
  { cashboxId: 4, from: "2026-08-01", to: "2026-08-31" },
  { cashboxId: 5, from: "2026-07-01", to: "2026-07-31" },
  { cashboxId: 3, from: "2026-01-01", to: "2026-12-31" },
];
let ok = true;
for (const { cashboxId, from, to } of cases) {
  // ESKI: hammasini olib, klientdagidek filtrlash
  const eski = all.filter((e) => e.cashboxId === cashboxId && e.date >= from && e.date <= to);
  // YANGI: server filtri (route bilan bir xil)
  const yangi = await col.find({ cashboxId, date: { $gte: from, $lte: to } }).sort({ id: -1 }).toArray();
  const A = totals(eski), B = totals(yangi);
  const idsSame = JSON.stringify(eski.map(e=>e.id)) === JSON.stringify(yangi.map(e=>e.id));
  const same = JSON.stringify(A) === JSON.stringify(B) && idsSame;
  if (!same) ok = false;
  console.log(`kassa ${cashboxId}  ${from}..${to}   ${same ? "MOS ✓" : "FARQ ✗"}`);
  console.log(`   eski:  ${JSON.stringify(A)}`);
  console.log(`   yangi: ${JSON.stringify(B)}`);
}
console.log(`\nNATIJA: ${ok ? "qatorlar ham, yig'indilar ham AYNAN bir xil" : "FARQ BOR"}`);
await c.close();
process.exit(ok ? 0 : 1);
