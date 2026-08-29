// Unumdorlik o'lchovi — OLDIN/KEYIN taqqoslash uchun. Faqat o'qiydi.
// Ishlatish: node scripts/_bench.mjs [yorliq]
import fs from "fs";
import { MongoClient } from "mongodb";

const label = process.argv[2] || "o'lchov";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
const c = new MongoClient(env.MONGODB_URI);
const t0 = Date.now(); await c.connect(); const connectMs = Date.now() - t0;
const db = c.db(env.MONGODB_DB);

const pings = []; for (let i = 0; i < 5; i++) { const t = Date.now(); await db.command({ ping: 1 }); pings.push(Date.now() - t); }

// ensureIndexes narxi: bitta createIndex round-trip'i x 71
const ix = []; for (let i = 0; i < 5; i++) { const t = Date.now(); await db.collection("pupils").createIndex({ id: 1 }, { unique: true }); ix.push(Date.now() - t); }
const perIndex = med(ix);

async function read(name, projection) {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const t = Date.now();
    const rows = await db.collection(name).find({}, projection ? { projection } : {}).toArray();
    runs.push(Date.now() - t);
    if (i === 0) var bytes = Buffer.byteLength(JSON.stringify(rows));
  }
  return { ms: med(runs), kb: Math.round(bytes / 1024) };
}

const pupilsFull = await read("pupils");
const pupilsProj = await read("pupils", { id: 1, firstName: 1, lastName: 1, phone: 1 });
const txFull = await read("transaction_entries");

console.log(JSON.stringify({
  label,
  vaqt: new Date().toISOString(),
  ulanish_ms: connectMs,
  ping_ms: med(pings),
  createIndex_ms: perIndex,
  ensureIndexes_71x_s: +(perIndex * 71 / 1000).toFixed(1),
  pupils_toliq: pupilsFull,
  pupils_projection: pupilsProj,
  transaction_entries: txFull,
}, null, 2));
await c.close();
