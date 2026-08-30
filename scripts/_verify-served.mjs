// FAQAT O'QISH — "Xizmat ko'rsatilgan" hisoboti: eski klient hisobi va
// yangi served-summary aggregation'i bir xil natija berishini tekshiradi.
import fs from "fs";
import { MongoClient } from "mongodb";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/)
  .filter(l=>l.trim()&&!l.startsWith("#")&&l.includes("="))
  .map(l=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5 }); await c.connect();
const col = c.db(env.MONGODB_DB||undefined).collection("transaction_entries");
const nameKey = (v) => String(v ?? "").trim().toLowerCase();

// ---- ESKI YO'L: limitsiz ro'yxat, keyin brauzerda filtr + yig'indi ----
let t0 = performance.now();
const all = await col.find({ txType: "payIn", status: { $ne: "cancelled" } }).toArray();
const oldMs = Math.round(performance.now() - t0);
const oldBytes = Buffer.byteLength(JSON.stringify({ ok: true, entries: all.map(({_id,...r})=>r) }));

function oldWay(from, to) {
  const range = all.filter((e) => {
    const d = String(e.date ?? "");
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
  const attributed = range.filter((e) => nameKey(e.teacherName) !== "");
  const earned = new Map();
  for (const e of attributed) { const k = nameKey(e.teacherName); earned.set(k, (earned.get(k) ?? 0) + (e.amount || 0)); }
  const unattributed = range.filter((e) => nameKey(e.teacherName) === "").reduce((s,e)=>s+(e.amount||0),0);
  return { earned, unattributed, hasAttribution: attributed.length > 0 };
}

// ---- YANGI YO'L: aggregation ----
async function newWay(from, to) {
  const date = { $nin: ["", null] };
  if (from) date.$gte = from;
  if (to) date.$lte = to;
  const grouped = await col.aggregate([
    { $match: { txType: "payIn", status: { $ne: "cancelled" }, date } },
    { $group: { _id: "$teacherName", amount: { $sum: "$amount" } } },
    { $sort: { _id: 1 } },
  ]).toArray();
  const rows = grouped.map((r) => ({
    teacherName: r._id === null || r._id === undefined ? "" : String(r._id),
    amount: Number(r.amount) || 0,
  }));
  const attributed = rows.filter((r) => nameKey(r.teacherName) !== "");
  const earned = new Map();
  for (const r of attributed) { const k = nameKey(r.teacherName); earned.set(k, (earned.get(k) ?? 0) + (r.amount || 0)); }
  const unattributed = rows.filter((r) => nameKey(r.teacherName) === "").reduce((s,r)=>s+(r.amount||0),0);
  return { earned, unattributed, hasAttribution: attributed.length > 0, bytes: Buffer.byteLength(JSON.stringify({ok:true,rows})) };
}

const CASES = [
  ["2026-08-01","2026-08-31"], ["2026-07-01","2026-07-31"], ["2026-05-01","2026-05-31"],
  ["2025-12-01","2025-12-31"], ["2026-01-01","2026-12-31"], ["",""],
];
let fail = 0, newTotalMs = 0, newBytes = 0;
for (const [from,to] of CASES) {
  const o = oldWay(from,to);
  const t1 = performance.now();
  const n = await newWay(from,to);
  newTotalMs += Math.round(performance.now()-t1);
  newBytes = n.bytes;
  const keys = [...new Set([...o.earned.keys(), ...n.earned.keys()])];
  const bad = keys.filter((k) => (o.earned.get(k) ?? 0) !== (n.earned.get(k) ?? 0));
  const same = bad.length === 0 && o.unattributed === n.unattributed && o.hasAttribution === n.hasAttribution;
  if (!same) fail++;
  const label = from ? `${from}..${to}` : "oraliqsiz (hammasi)";
  console.log(
    label.padEnd(24), same ? "MOS ✓" : "FARQ ✗",
    "| o'qituvchi:", String(o.earned.size).padStart(3),
    "| jami:", [...o.earned.values()].reduce((a,b)=>a+b,0).toLocaleString("ru-RU").padStart(16),
    "| bog'lanmagan:", o.unattributed.toLocaleString("ru-RU"),
  );
  for (const k of bad.slice(0,5)) console.log("    FARQ:", k, o.earned.get(k), "vs", n.earned.get(k));
}
console.log("\no'lchov:  eski", oldMs, "ms /", Math.round(oldBytes/1024), "KB (bir marta, keyin brauzerda filtr)");
console.log("         yangi", Math.round(newTotalMs/CASES.length), "ms /", Math.round(newBytes/1024), "KB (har oraliq uchun)");
console.log(fail === 0 ? "\n==> HAMMA HOLATDA MOS." : `\n==> ${fail} ta FARQ!`);
await c.close();
process.exit(fail?1:0);
