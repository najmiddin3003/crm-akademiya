// FAQAT O.QISH — aggregation.ga ko.chirilgan uchta hisob eski mantiq bilan
// AYNAN bir xil natija berishini tekshiradi (perf o.zgarishlari uchun).
//   1) /api/sales-plans      — paymentsCount moderator bo.yicha
//   2) /api/students/balances — o.quvchi balanslari
//   3) studentPaidBalanceByName (lib/pupilsDb.ts)
// FAQAT O'QISH — eski va yangi mantiq bir xil natija berishini tekshiradi.
import fs from "fs";
import { MongoClient } from "mongodb";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/)
  .filter(l=>l.trim()&&!l.startsWith("#")&&l.includes("="))
  .map(l=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5 }); await c.connect();
const db = c.db(env.MONGODB_DB||undefined);
const col = db.collection("transaction_entries");
const MATCH = { txType:"payIn", status:{$ne:"cancelled"}, studentName:{$nin:["",null]} };
let fail = 0;
const t = (ms) => String(ms).padStart(6)+" ms";

// ---------- 1) sales-plans: paymentsCount ----------
let t0 = performance.now();
const entries = await col.find({ txType:"payIn" }).toArray();
const oldCounts = new Map();
for (const e of entries) { if (!e.moderator) continue; oldCounts.set(e.moderator,(oldCounts.get(e.moderator)??0)+1); }
const oldMs = Math.round(performance.now()-t0);

t0 = performance.now();
const agg = await col.aggregate([
  { $match: { txType:"payIn", moderator:{$nin:["",null]} } },
  { $group: { _id:"$moderator", n:{$sum:1} } },
  { $sort: { _id: 1 } },
]).toArray();
const newCounts = new Map(agg.map(r=>[String(r._id), Number(r.n)||0]));
const newMs = Math.round(performance.now()-t0);

const same1 = oldCounts.size===newCounts.size &&
  [...oldCounts].every(([k,v])=>newCounts.get(k)===v);
console.log("1) sales-plans paymentsCount :", same1?"MOS":"FARQ", "|", t(oldMs),"->",t(newMs),
            "| moderatorlar:", oldCounts.size);
for (const [k,v] of oldCounts) console.log("     ", k.padEnd(24), String(v).padStart(6), newCounts.get(k)===v?"":"  <-- FARQ");
if(!same1) fail++;

// ---------- 2) /api/students/balances ----------
t0 = performance.now();
const rowsOld = await col.find(MATCH).project({studentName:1,amount:1}).toArray();
const balOld = {};
for (const r of rowsOld) { const k=String(r.studentName??"").trim().toLowerCase(); if(!k) continue;
  balOld[k]=(balOld[k]??0)+(Number(r.amount)||0); }
const oldMs2 = Math.round(performance.now()-t0);

t0 = performance.now();
const rowsNew = await col.aggregate([{ $match: MATCH },
  { $group: { _id:"$studentName", total:{$sum:"$amount"} } }]).toArray();
const balNew = {};
for (const r of rowsNew) { const k=String(r._id??"").trim().toLowerCase(); if(!k) continue;
  balNew[k]=(balNew[k]??0)+(Number(r.total)||0); }
const newMs2 = Math.round(performance.now()-t0);

const kOld=Object.keys(balOld).sort(), kNew=Object.keys(balNew).sort();
const diffs = kOld.filter(k=>balOld[k]!==balNew[k]);
const same2 = kOld.length===kNew.length && kOld.every((k,i)=>k===kNew[i]) && diffs.length===0;
console.log("\n2) students/balances        :", same2?"MOS":"FARQ", "|", t(oldMs2),"->",t(newMs2),
            "| kalitlar:", kOld.length, "| Node'ga kelgan qator:", rowsOld.length,"->",rowsNew.length);
if (diffs.length) { console.log("   FARQ QILGANLAR:"); for(const k of diffs.slice(0,10)) console.log("     ",k,balOld[k],"vs",balNew[k]); }
const sumOld=Object.values(balOld).reduce((a,b)=>a+b,0), sumNew=Object.values(balNew).reduce((a,b)=>a+b,0);
console.log("   umumiy yig'indi:", sumOld.toLocaleString("ru-RU"), "vs", sumNew.toLocaleString("ru-RU"), sumOld===sumNew?"— AYNAN":"— FARQ");
if(!same2) fail++;

// ---------- 3) studentPaidBalanceByName ----------
const sample = [...new Set(rowsOld.map(r=>String(r.studentName)))].slice(0,400);
sample.push("  Abdulloh Sharofiddinov  ", "ABDULLOH SHAROFIDDINOV", "yo'q-bunday-odam");
let bad = 0;
for (const name of sample) {
  const wanted = name.trim().toLowerCase();
  let o = 0; for (const r of rowsOld) { if (String(r.studentName??"").trim().toLowerCase()!==wanted) continue; o += Number(r.amount)||0; }
  let n = 0; for (const r of rowsNew) { if (String(r._id??"").trim().toLowerCase()!==wanted) continue; n += Number(r.total)||0; }
  if (o!==n) { bad++; if(bad<6) console.log("   FARQ:", JSON.stringify(name), o, "vs", n); }
}
console.log("\n3) studentPaidBalanceByName  :", bad===0?"MOS":"FARQ", "|", sample.length, "ta ism tekshirildi");
if(bad) fail++;

console.log("\n" + (fail===0 ? "==> HAMMASI MOS. Uchala o'zgarish natijani o'zgartirmaydi."
                             : "==> " + fail + " ta FARQ topildi!"));
await c.close();
process.exit(fail?1:0);
