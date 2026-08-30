// FAQAT O'QISH — bazaga hech narsa yozmaydi.
import fs from "fs";
import { MongoClient } from "mongodb";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const t0 = Date.now();
const client = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5 });
await client.connect();
console.log("ulanish:", Date.now() - t0, "ms");
const db = client.db(env.MONGODB_DB);

const ping = [];
for (let i = 0; i < 5; i++) { const t = Date.now(); await db.command({ ping: 1 }); ping.push(Date.now() - t); }
console.log("ping (5x):", ping.join(", "), "ms  -> o'rtacha", Math.round(ping.reduce((a,b)=>a+b)/5));

const stats = await db.command({ dbStats: 1 });
console.log("baza:", (stats.dataSize/1048576).toFixed(1), "MB, kolleksiya:", stats.collections, ", indeks:", (stats.indexSize/1048576).toFixed(1), "MB");

for (const name of ["pupils", "transaction_entries", "hr_employees", "groups"]) {
  const c = db.collection(name);
  const n = await c.countDocuments();
  const idx = (await c.indexes()).map((i) => i.name);
  const t1 = Date.now(); await c.find({}).toArray(); const full = Date.now() - t1;
  console.log(`\n${name}: ${n} hujjat | to'liq o'qish ${full} ms`);
  console.log("  indekslar:", idx.join(", "));
}

// Amaldagi filtrlar indeksdan foydalanadimi?
const ex = await db.collection("transaction_entries")
  .find({ moderator: { $regex: "^Abdulloh Raxmatullayev$", $options: "i" } })
  .explain("executionStats");
const st = ex.executionStats;
console.log("\nexplain: moderator regex ->", st.executionStages.stage,
            "| ko'rilgan:", st.totalDocsExamined, "| topilgan:", st.nReturned,
            "| vaqt:", st.executionTimeMillis, "ms");

const ex2 = await db.collection("pupils").find({}).project({ id: 1, firstName: 1, lastName: 1, phone: 1 }).explain("executionStats");
console.log("explain: pupils projection ->", ex2.executionStats.executionTimeMillis, "ms");

await client.close();
