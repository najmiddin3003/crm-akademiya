// FAQAT O'QIYDI — to'rt oqim filtri bazani TO'LIQ va KESISHMASDAN
// qoplashini tekshiradi. Bitta yozuv ikki varaqqa tushib qolsa yoki
// umuman tushmay qolsa, shu yerda ko'rinadi.
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

// lib/sync/mappers.ts dagi kindFilter bilan AYNAN bir xil bo'lishi shart.
const FILTERS = {
  payment: { txType: "payIn" },
  salary: { txType: "payOut", txName: { $regex: "avans|oylik", $options: "i" } },
  expense: { txType: "payOut", txName: { $not: /avans|oylik/i } },
  transfer: { txType: "transfer" },
};

const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 });
await client.connect();
const db = client.db(process.env.MONGODB_DB);
const te = db.collection("transaction_entries");

const total = await te.countDocuments();
let sum = 0;
const ids = {};
for (const [kind, f] of Object.entries(FILTERS)) {
  const rows = await te.find(f).project({ id: 1 }).toArray();
  ids[kind] = new Set(rows.map((r) => r.id));
  sum += rows.length;
  console.log(`  ${kind.padEnd(9)} ${String(rows.length).padStart(6)}`);
}
console.log(`  ${"JAMI".padEnd(9)} ${String(sum).padStart(6)}  (bazada ${total})`);

let ok = true;
const check = (label, good, detail) => { if (!good) ok = false; console.log(`${good ? "✓" : "✗"} ${label}${detail ? `: ${detail}` : ""}`); };

check("qoplash to'liq", sum === total, `${sum} vs ${total}`);

const names = Object.keys(FILTERS);
for (let i = 0; i < names.length; i += 1) {
  for (let j = i + 1; j < names.length; j += 1) {
    const a = ids[names[i]], b = ids[names[j]];
    const both = [...a].filter((x) => b.has(x));
    check(`${names[i]} ∩ ${names[j]} bo'sh`, both.length === 0, both.length ? `${both.length} ta: ${both.slice(0, 5)}` : "");
  }
}

// Qamrab olinmagan yozuv bormi (kutilmagan txType)?
const all = new Set((await te.find({}).project({ id: 1 }).toArray()).map((r) => r.id));
for (const k of names) for (const id of ids[k]) all.delete(id);
check("qamrab olinmagan yozuv yo'q", all.size === 0, all.size ? `${all.size} ta` : "");
if (all.size) {
  const sample = await te.find({ id: { $in: [...all].slice(0, 5) } }).toArray();
  for (const d of sample) console.log("   ", d.id, d.txType, d.txName);
}

console.log(ok ? "\n✓ Filtrlar to'g'ri." : "\n✗ Filtrlarda muammo bor.");
await client.close();
