// FAQAT O'QISH — TEZLIKNING BAZAVIY O'LCHOVI.
//
//   node scripts/_baseline.mjs
//
// NEGA KERAK: "sayt tezlashdimi?" degan savolga faqat TAQQOSLASH javob
// beradi. Bu skript bir xil sharoitda bir xil narsalarni o'lchaydi,
// shuning uchun bugungi natijani keyingi natija bilan yonma-yon qo'yish
// mumkin. Natijani zip.md dagi jadvalga yozib boring.
//
// DIQQAT — ikkita tuzoq:
//  1) SOVUQ START. Vercel funksiyasi nolga tushadi va yangi nusxa Mongo
//     ulanishini noldan ochadi. Shu sabab quyida avval isitiladi, keyin
//     o'lchanadi. Isitmasdan o'lchasangiz son bir necha barobar katta
//     chiqadi va sizni chalg'itadi.
//  2) BU SKRIPT SIZNING KOMPYUTERINGIZDAN o'lchaydi. "Foydalanuvchi ->
//     sayt" qismi sizning internetingizga bog'liq. Taqqoslashda shuni
//     yodda tuting: bir xil joydan o'lchang.
//
// Tizimga KIRISH talab qilinmaydi — shuning uchun kirgandan keyingi og'ir
// sahifalar bu yerda yo'q. Ular uchun oxirdagi brauzer parchasi bor.

import fs from "fs";
import { MongoClient } from "mongodb";

const HOST = process.argv[2] || "tizimli24.uz";
const PROBE = `https://${HOST}/api/auth/verify-token`;
const REGIONS = {
  iad1:"AQSh, Virjiniya", cle1:"AQSh, Ogayo", pdx1:"AQSh, Oregon", sfo1:"AQSh, San-Fransisko",
  fra1:"Frankfurt", dub1:"Dublin", lhr1:"London", cdg1:"Parij", arn1:"Stokgolm",
  sin1:"Singapur", hnd1:"Tokio", icn1:"Seul", syd1:"Sidney", bom1:"Mumbay",
  gru1:"San-Paulu", hkg1:"Gonkong", kix1:"Osaka", cpt1:"Keyptaun", dxb1:"Dubay",
};

const kb = (b) => Math.round(b / 1024);
const min = (a) => Math.round(Math.min(...a));
const line = () => console.log("-".repeat(62));

console.log("=".repeat(62));
console.log("TEZLIK BAZAVIY O'LCHOVI —", new Date().toISOString().slice(0, 16).replace("T", " "));
console.log("sayt:", HOST);
console.log("=".repeat(62));

// ---------- 1) Production: region va baza masofasi ----------
const call = async (body) => {
  const t0 = performance.now();
  const r = await fetch(PROBE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const ms = performance.now() - t0;
  await r.text();
  return { ms, vid: r.headers.get("x-vercel-id") || "" };
};

console.log("\n[1] PRODUCTION — region va server<->baza masofasi");
const cold = await call({ token: "yaroqsiz" });          // birinchi = sovuq
for (let i = 0; i < 8; i++) await call({});               // isitamiz
const noDb = [], withDb = [];
for (let i = 0; i < 8; i++) {
  withDb.push((await call({ token: "yaroqsiz" })).ms);
  noDb.push((await call({})).ms);
}
const codes = [...(cold.vid.matchAll(/\b([a-z]{3}\d)\b/g))].map((m) => m[1]);
const fn = codes[codes.length - 1];
console.log("  edge                :", codes[0], `(${REGIONS[codes[0]] || "?"})`);
console.log("  FUNKSIYA            :", fn, `(${REGIONS[fn] || "?"})`);
console.log("  sovuq so'rov        :", Math.round(cold.ms), "ms   <- birinchi urinish");
console.log("  issiq, bazasiz      :", min(noDb), "ms");
console.log("  issiq, baza bilan   :", min(withDb), "ms");
console.log("  BAZA AMALI          :", min(withDb) - min(noDb), "ms   <- 0 ga yaqin bo'lsin");

// ---------- 2) Atlas: hajm va o'qish vaqtlari ----------
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5 });
await c.connect();
const db = c.db(env.MONGODB_DB || undefined);

console.log("\n[2] BAZA — hajm (o'sishni kuzatish uchun)");
const st = await db.stats();
console.log("  hujjatlar           :", st.objects.toLocaleString("ru-RU"));
console.log("  ma'lumot + indeks   :", ((st.storageSize + st.indexSize) / 1048576).toFixed(1), "MB");
for (const name of ["transaction_entries", "pupils", "transactions", "groups", "attendance"]) {
  const n = await db.collection(name).estimatedDocumentCount().catch(() => 0);
  console.log(`  ${name.padEnd(20)}`, String(n).padStart(7));
}

console.log("\n[3] BAZA — og'ir o'qishlar (SHU kompyuterdan)");
const timeIt = async (label, fn2) => {
  await fn2();                                   // isitish
  const t = [];
  for (let i = 0; i < 3; i++) { const t0 = performance.now(); await fn2(); t.push(performance.now() - t0); }
  const rows = await fn2();
  const size = kb(Buffer.byteLength(JSON.stringify(rows)));
  console.log(`  ${label.padEnd(24)} ${String(min(t)).padStart(6)} ms  ${String(size).padStart(6)} KB`);
};
const PUPILS_MEDIUM = { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, balance: 1, coin: 1,
  createdAt: 1, moderator: 1, source: 1, category: 1, status: 1, statusReason: 1, statusChangedAt: 1,
  paymentDate: 1, birthDate: 1, fatherName: 1, fatherPhone: 1, fatherWork: 1, motherName: 1,
  motherPhone: 1, motherWork: 1, address: 1, addresses: 1 };
await timeIt("pupils (ro'yxat rejimi)", () => db.collection("pupils").find({}, { projection: PUPILS_MEDIUM }).sort({ id: -1 }).toArray());
await timeIt("pupils (light)", () => db.collection("pupils").find({}, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1 } }).sort({ id: -1 }).toArray());
await timeIt("transactions", () => db.collection("transactions").find({}).toArray());
await timeIt("balanslar (aggregation)", () => db.collection("transaction_entries").aggregate([
  { $match: { txType: "payIn", status: { $ne: "cancelled" }, studentName: { $nin: ["", null] } } },
  { $group: { _id: "$studentName", total: { $sum: "$amount" } } }]).toArray());

const ss = await db.admin().serverStatus().catch(() => null);
if (ss) console.log("\n  Atlas ulanishlari   :", ss.connections.current, "band /", ss.connections.available, "bo'sh");
await c.close();

line();
console.log("Kirgandan keyingi sahifalar bu yerda YO'Q — ularni brauzer");
console.log("konsolida o'lchang (zip.md 7-bo'lim) va jadvalga yozing.");
