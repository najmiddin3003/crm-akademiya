// FAQAT O'QIYDI. Lidlar qamrovi: o'zgarishdan OLDIN va KEYIN kim nechta
// lidni ko'radi. app/api/orders/route.ts dagi filtrni aynan takrorlaydi.
import fs from "fs";
import { MongoClient } from "mongodb";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await c.connect();
const db = c.db(env.MONGODB_DB);
const col = db.collection("orders");

const eski = (b) => b === 1
  ? { $or: [{ branchId: 1 }, { branchId: { $exists: false } }, { branchId: null } ] }
  : { branchId: b };
const yangi = (b) => ({ $or: [{ branchId: b }, { branchId: { $exists: false } }, { branchId: null } ] });

const jami = await col.countDocuments();
console.log(`lidlar jami: ${jami}\n`);
console.log("filial | OLDIN | KEYIN");
for (const b of [1, 2, 3, 4]) {
  const a = await col.countDocuments(eski(b));
  const z = await col.countDocuments(yangi(b));
  console.log(`   ${b}   | ${String(a).padStart(5)} | ${String(z).padStart(5)}`);
}

console.log("\nDilmurod (2-filial) KEYIN ko'radigan lidlar:");
const rows = await col.find(yangi(2), { projection: { _id: 0, id: 1, branchId: 1, created: 1, name: 1 } }).sort({ id: -1 }).limit(6).toArray();
for (const o of rows) console.log(`  #${o.id} b=${o.branchId ?? "-"} ${o.created} ${o.name}`);
console.log(`  ... jami ${await col.countDocuments(yangi(2))} ta`);

console.log("\n1-filialdan HECH KIMGA yo'qolmadimi (Nilufar oldin/keyin):",
  await col.countDocuments(eski(1)), "->", await col.countDocuments(yangi(1)));
console.log("2-filialga yozilgan, 1-filialda KO'RINMAYDIGANLAR:",
  JSON.stringify((await col.find({ branchId: 2 }, { projection: { _id: 0, id: 1, name: 1 } }).toArray()).map((o) => `#${o.id} ${o.name}`)));
await c.close();
