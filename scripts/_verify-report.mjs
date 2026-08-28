// FAQAT O'QIYDI — "Oylik hisobot" varag'idagi formulalar hisoblagan
// raqamlarni BAZADAN mustaqil hisoblangan raqamlar bilan solishtiradi.
//
// Jadvalning o'z hisobiga ishonmaydi: har bir ustun uchun Mongo'da
// alohida so'rov bajariladi va oyma-oy taqqoslanadi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSign } from "node:crypto";
import { MongoClient } from "mongodb";

const HERE = path.dirname(fileURLToPath(import.meta.url));
for (const l of fs.readFileSync(path.join(HERE, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const s = l.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}
const normKey = (raw) => {
  let k = (raw || "").trim();
  if (k.startsWith('"') && k.endsWith('"')) k = k.slice(1, -1);
  return k.replace(/\\n/g, "\n");
};
const b64 = (v) => Buffer.from(v).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const now = Math.floor(Date.now() / 1000);
const jwtInput = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify({
  iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
  scope: "https://www.googleapis.com/auth/spreadsheets",
  aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
}))}`;
const signer = createSign("RSA-SHA256");
signer.update(jwtInput);
signer.end();
const { access_token } = await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${jwtInput}.${b64(signer.sign(normKey(process.env.GOOGLE_PRIVATE_KEY)))}`,
  }),
})).json();

const ID = process.env.SHEET_ID_PAYMENTS.trim();
const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ID}/values/${encodeURIComponent("Oylik hisobot!A1:J40")}?valueRenderOption=UNFORMATTED_VALUE`,
  { headers: { Authorization: `Bearer ${access_token}` } });
const sheet = (await r.json()).values ?? [];

// Sheets sana seriyasi -> "YYYY-MM"
const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30);
const monthKey = (serial) => new Date(SHEETS_EPOCH_MS + serial * 86_400_000).toISOString().slice(0, 7);

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB);
const te = db.collection("transaction_entries");
const byMonth = async (match) => Object.fromEntries(
  (await te.aggregate([
    { $match: { status: "", ...match } },
    { $group: { _id: { $substr: ["$date", 0, 7] }, s: { $sum: { $abs: "$amount" } }, n: { $sum: 1 } } },
  ]).toArray()).map((x) => [x._id, x]),
);

const payIn = await byMonth({ txType: "payIn" });
const refund = await byMonth({ txType: "payOut", txName: "O'quvchiga pul qaytarildi" });
const invest = await byMonth({ txType: "payOut", txName: "F - INVEST" });
const expAll = await byMonth({ txType: "payOut", txName: { $not: /avans|oylik/i } });
const salary = await byMonth({ txType: "payOut", txName: { $regex: "avans|oylik", $options: "i" } });
await client.close();

const g = (o, m) => o[m]?.s ?? 0;
const fmt = (n) => Math.round(n).toLocaleString("ru-RU");
let ok = true;
const cmp = (label, got, want) => {
  const same = Math.round(Number(got) || 0) === Math.round(want);
  if (!same) ok = false;
  return same ? "" : ` ✗${label}(jadval ${fmt(Number(got) || 0)} ≠ baza ${fmt(want)})`;
};

console.log("oy               tushum          xarajat        oylik            sof       F-INVEST   mos");
let tot = { c: 0, d: 0, e: 0, f: 0, gg: 0, n: 0 };
for (let i = 2; i < sheet.length; i += 1) {
  const row = sheet[i];
  if (!row || typeof row[0] !== "number" || row[2] === "" || row[2] === undefined) continue;
  const m = monthKey(row[0]);
  const wTushum = g(payIn, m) - g(refund, m);
  const wXarajat = g(expAll, m) - g(invest, m) - g(refund, m);
  const wOylik = g(salary, m);
  const wSof = wTushum - wXarajat - wOylik;
  const wInv = g(invest, m);
  const wN = payIn[m]?.n ?? 0;
  tot = { c: tot.c + wTushum, d: tot.d + wXarajat, e: tot.e + wOylik, f: tot.f + wSof, gg: tot.gg + wInv, n: tot.n + wN };
  const bad = cmp("tushum", row[2], wTushum) + cmp("xarajat", row[3], wXarajat) + cmp("oylik", row[4], wOylik)
    + cmp("sof", row[5], wSof) + cmp("invest", row[6], wInv) + cmp("soni", row[8], wN);
  console.log(`${String(row[1]).padEnd(14)} ${fmt(row[2]).padStart(14)} ${fmt(row[3]).padStart(16)} ${fmt(row[4]).padStart(12)} ${fmt(row[5]).padStart(14)} ${fmt(row[6]).padStart(14)}   ${bad || "✓"}`);
}

const jami = sheet[1] ?? [];
console.log("\nJAMI qatori:");
const badTot = cmp("tushum", jami[2], tot.c) + cmp("xarajat", jami[3], tot.d) + cmp("oylik", jami[4], tot.e)
  + cmp("sof", jami[5], tot.f) + cmp("invest", jami[6], tot.gg) + cmp("qolgan", jami[7], tot.f - tot.gg) + cmp("soni", jami[8], tot.n);
console.log(`  tushum=${fmt(jami[2])} xarajat=${fmt(jami[3])} oylik=${fmt(jami[4])} sof=${fmt(jami[5])} F-INVEST=${fmt(jami[6])} qolgan=${fmt(jami[7])}${badTot || "   ✓"}`);

console.log(ok ? "\n✓ Hisobot baza bilan to'liq mos." : "\n✗ Nomuvofiqlik bor.");
process.exit(ok ? 0 : 1);
