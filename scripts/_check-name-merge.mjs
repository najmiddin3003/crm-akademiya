// FAQAT O'QIYDI — Excel ismlarini API qatorlariga biriktirishda
// (vaqt+summa) kaliti takrorlanmaganini tekshiradi.
import fs from "node:fs";
import XLSX from "xlsx";
const t = (r,i)=>String(r?.[i]??"").trim();
const num = v => { const n=Number(String(v??"").replace(/[^\d.-]/g,"")); return Number.isFinite(n)?n:0; };
const norm = v => String(v??"").replace(/[’ʻʼ`']/g,"'").replace(/\s+/g," ").trim();

const wb = XLSX.readFile(process.argv[2]);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, defval:"" });
const SEC = { "Student Bilan": {amt:5,time:9,who:2,teacher:7}, "Hodim Bilan": {amt:5,time:7,who:2}, "Boshqa": {amt:5,time:7,who:2} };
let cur=null; const keys = new Map();
for (const r of rows) {
  const c1=t(r,1);
  if (SEC[c1] && r.filter(x=>String(x).trim()!=="").length===1) { cur=c1; continue; }
  if (!cur||!SEC[cur]||/^-+$/.test(c1)||c1==="Type"||c1==="Kassadan") continue;
  const L=SEC[cur]; const tm=t(r,L.time).replace(" ","T").slice(0,16); const a=num(t(r,L.amt));
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(tm)||!a) continue;
  const k=`${tm}|${a}`;
  if (!keys.has(k)) keys.set(k, []);
  keys.get(k).push({ sec:cur, who:norm(t(r,L.who)), teacher:L.teacher?norm(t(r,L.teacher)):"" });
}
const dup=[...keys].filter(([,v])=>v.length>1);
console.log(`Excel qatorlari: ${[...keys.values()].reduce((s,v)=>s+v.length,0)} · unikal kalit: ${keys.size} · TAKRORLANGAN kalit: ${dup.length}`);
for (const [k,v] of dup) console.log(`  ${k}  ->  ${v.map(x=>`${x.sec}:${x.who||"(ismsiz)"}`).join("  |  ")}`);

// API tomonida shu kalitlar nechta qatorga to'g'ri keladi
const src = JSON.parse(fs.readFileSync("scripts/data/edutizim-cashbox-rows.json","utf8"));
const localKey = iso => new Date(new Date(iso).getTime()+5*3600*1000).toISOString().slice(0,16);
const apiByKey = new Map();
for (const r of src.rows) { const k=`${localKey(r.at)}|${r.amount}`; if(!apiByKey.has(k)) apiByKey.set(k,[]); apiByKey.get(k).push(r); }
let multi=0;
for (const [k] of keys) { const a=apiByKey.get(k); if (a && a.length>1) { multi++; if(multi<=8) console.log(`  API'da ham ko'p: ${k} -> ${a.length} qator (${a.map(x=>x.type+"/"+(x.category||"-")).join(", ")})`); } }
console.log(`API tomonda bir kalitga bir nechta qator: ${multi}`);

// Chiqimlarda ism qoplami
const pout = src.rows.filter(r=>r.type==="payOut"&&r.category&&/avans|oylik|soliq/i.test(r.category));
let named=0; for (const r of pout) if (keys.has(`${localKey(r.at)}|${r.amount}`)) named++;
console.log(`\nAvans/oylik/soliq chiqimlari: ${pout.length} · Exceldan ism topildi: ${named}`);
