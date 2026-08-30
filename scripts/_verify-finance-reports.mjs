// FAQAT O'QISH — FinanceReportsPage dagi totals/dailyPoints qayta yozilishi
// natijani o'zgartirmasligini haqiqiy tranzaksiyalarda tekshiradi.
import fs from "fs";
import { MongoClient } from "mongodb";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/)
  .filter(l=>l.trim()&&!l.startsWith("#")&&l.includes("="))
  .map(l=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5 }); await c.connect();
const tx = await c.db(env.MONGODB_DB||undefined).collection("transactions").find({}).toArray();
console.log("tranzaksiya:", tx.length);

const oldTotals = (rows) => {
  const income = rows.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
  const expense = -rows.filter(t=>t.amount<0).reduce((s,t)=>s+t.amount,0);
  return { income, expense, net: income-expense };
};
const newTotals = (rows) => {
  let income=0, expense=0;
  for (const t of rows) { if (t.amount>0) income+=t.amount; else expense-=t.amount; }
  return { income, expense, net: income-expense };
};
const toIso = (d) => { const p=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; };
const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };

const oldDaily = (current, start, end) => {
  const days = Math.round((end-start)/86400000)+1;
  return Array.from({length: Math.max(days,0)}, (_,i) => {
    const d=addDays(start,i), iso=toIso(d);
    const dayTx = current.filter(t=>t.date===iso);
    const income = dayTx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
    const expense = -dayTx.filter(t=>t.amount<0).reduce((s,t)=>s+t.amount,0);
    return { date: iso, income, expense };
  });
};
const newDaily = (current, start, end) => {
  const days = Math.round((end-start)/86400000)+1;
  const byDay = new Map();
  for (const t of current) {
    let b = byDay.get(t.date);
    if (!b) { b = { income:0, expense:0 }; byDay.set(t.date,b); }
    if (t.amount>0) b.income+=t.amount; else b.expense-=t.amount;
  }
  return Array.from({length: Math.max(days,0)}, (_,i) => {
    const d=addDays(start,i), iso=toIso(d), b=byDay.get(iso);
    return { date: iso, income: b?.income ?? 0, expense: b?.expense ?? 0 };
  });
};

// totals
const o = oldTotals(tx), n = newTotals(tx);
const tOk = o.income===n.income && o.expense===n.expense && o.net===n.net;
console.log("\ntotals:", tOk ? "MOS ✓" : "FARQ ✗");
console.log("  kirim  ", o.income.toLocaleString("ru-RU"), "|", n.income.toLocaleString("ru-RU"));
console.log("  chiqim ", o.expense.toLocaleString("ru-RU"), "|", n.expense.toLocaleString("ru-RU"));
console.log("  qoldiq ", o.net.toLocaleString("ru-RU"), "|", n.net.toLocaleString("ru-RU"));
console.log("  amount === 0 bo'lgan yozuvlar:", tx.filter(t=>t.amount===0).length);

// dailyPoints — bir necha oraliqda
let fail = tOk ? 0 : 1;
for (const [s0,e0,label] of [
  ["2026-08-01","2026-08-31","bir oy"],
  ["2026-01-01","2026-12-31","bir yil"],
  ["2025-01-01","2026-12-31","ikki yil"],
]) {
  const start=new Date(s0+"T00:00:00"), end=new Date(e0+"T00:00:00");
  const t1=performance.now(); const a=oldDaily(tx,start,end); const oldMs=performance.now()-t1;
  const t2=performance.now(); const b=newDaily(tx,start,end); const newMs=performance.now()-t2;
  const same = a.length===b.length && a.every((x,i)=>x.date===b[i].date && x.income===b[i].income && x.expense===b[i].expense);
  if (!same) fail++;
  console.log(`\ndailyPoints ${label} (${a.length} kun):`, same?"MOS ✓":"FARQ ✗",
    "|", oldMs.toFixed(1)+" ms ->", newMs.toFixed(1)+" ms",
    "| tezlashuv:", (oldMs/newMs).toFixed(0)+"x");
}
console.log(fail===0 ? "\n==> HAMMASI MOS." : `\n==> ${fail} ta FARQ!`);
await c.close(); process.exit(fail?1:0);
