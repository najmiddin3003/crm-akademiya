// FAQAT O'QIYDI — Google jadvalini BAZA bilan solishtiradi.
//
// Ilovaning o'z hisobotiga ishonmaydi: qatorlarni Google'dan qayta o'qib,
// ID'larni va summalarni mustaqil sanaydi. Har bir oqim (varaq) uchun:
// qator soni, dublikat, yetishmayotgan/ortiqcha ID va summa yig'indisi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSign } from "node:crypto";
import { MongoClient } from "mongodb";

const HERE = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.join(HERE, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

/** `.env` da kalit bir qatorli, `\n` belgilari bilan (lib/sync/config.ts). */
function normKey(raw) {
  let k = (raw || "").trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) k = k.slice(1, -1);
  return k.replace(/\\n/g, "\n");
}
const b64 = (v) => Buffer.from(v).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// lib/sync/mappers.ts dagi kindFilter va sarlavhalar bilan mos bo'lishi
// SHART. `amountCol` — "Summa" ustunining harfi.
const KINDS = [
  { key: "payment", tab: process.env.SHEET_TAB_PAYMENTS || "To'lovlar", sheet: process.env.SHEET_ID_PAYMENTS, amountCol: "H", filter: { txType: "payIn" } },
  { key: "salary", tab: process.env.SHEET_TAB_SALARIES || "Xodim oyliklari", sheet: process.env.SHEET_ID_SALARIES, amountCol: "H", filter: { txType: "payOut", txName: { $regex: "avans|oylik", $options: "i" } } },
  { key: "expense", tab: process.env.SHEET_TAB_EXPENSES || "Xarajatlar", sheet: process.env.SHEET_ID_EXPENSES || process.env.SHEET_ID_PAYMENTS, amountCol: "F", filter: { txType: "payOut", txName: { $not: /avans|oylik/i } } },
  { key: "transfer", tab: process.env.SHEET_TAB_TRANSFERS || "Ko'chirmalar", sheet: process.env.SHEET_ID_TRANSFERS || process.env.SHEET_ID_PAYMENTS, amountCol: "F", filter: { txType: "transfer" } },
];

const EMAIL = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
const KEY = normKey(process.env.GOOGLE_PRIVATE_KEY);

const now = Math.floor(Date.now() / 1000);
const input = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify({
  iss: EMAIL, scope: "https://www.googleapis.com/auth/spreadsheets",
  aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
}))}`;
const signer = createSign("RSA-SHA256");
signer.update(input);
signer.end();
const tokRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${input}.${b64(signer.sign(KEY))}` }),
});
if (!tokRes.ok) {
  console.error("❌ Google token olinmadi:", tokRes.status, (await tokRes.text()).slice(0, 300));
  process.exit(1);
}
const { access_token } = await tokRes.json();

async function getRange(sheetId, range) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${access_token}` } },
  );
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
  return j.values ?? [];
}

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB);
const te = db.collection("transaction_entries");
const fmt = (n) => Math.round(n).toLocaleString("ru-RU");

let allOk = true;
const check = (label, good, detail) => {
  if (!good) allOk = false;
  console.log(`  ${good ? "✓" : "✗"} ${label}${detail ? `: ${detail}` : ""}`);
};

for (const k of KINDS) {
  console.log(`\n=== ${k.tab} ===`);
  const idCol = await getRange(k.sheet, `${k.tab}!A:A`);
  const ids = idCol.slice(1).map((r) => Number(String(r[0] ?? "").trim())).filter((n) => Number.isFinite(n) && n > 0);
  const uniq = new Set(ids);
  const docs = await te.find(k.filter).project({ id: 1, amount: 1 }).toArray();
  const dbIds = new Set(docs.map((d) => d.id));

  const missing = [...dbIds].filter((id) => !uniq.has(id));
  const extra = [...uniq].filter((id) => !dbIds.has(id));

  check("qator soni", ids.length === dbIds.size, `${ids.length} (bazada ${dbIds.size})`);
  check("dublikat yo'q", ids.length === uniq.size, `${ids.length - uniq.size} ta takror`);
  check("yetishmayotgani yo'q", missing.length === 0, missing.length ? `${missing.length} ta (${missing.slice(0, 5)})` : "");
  check("ortiqchasi yo'q", extra.length === 0, extra.length ? `${extra.length} ta (${extra.slice(0, 5)})` : "");

  // Ko'chirmalarda "Yo'nalish" (D ustuni) yozuv summasining ISHORASIDAN
  // olinadi. Jadvaldagi Kirim/Chiqim soni bazadagi musbat/manfiy soniga
  // teng bo'lishi kerak — aks holda ko'chirmaning bir tomoni noto'g'ri
  // yozilgan (ilgari ikkala tomon ham manfiy edi).
  if (k.key === "transfer") {
    const dirs = await getRange(k.sheet, `${k.tab}!D2:D`);
    const cnt = { Kirim: 0, Chiqim: 0 };
    for (const r of dirs) {
      const v = String(r[0] ?? "").trim();
      if (v in cnt) cnt[v] += 1;
    }
    const pos = docs.filter((d) => Number(d.amount) > 0).length;
    const neg = docs.filter((d) => Number(d.amount) < 0).length;
    check("yo'nalish", cnt.Kirim === pos && cnt.Chiqim === neg,
      `jadval Kirim ${cnt.Kirim} / Chiqim ${cnt.Chiqim} · baza ${pos} / ${neg}`);
  }

  const vals = await getRange(k.sheet, `${k.tab}!${k.amountCol}2:${k.amountCol}`);
  const sheetSum = vals.reduce((s, r) => s + (Number(String(r[0] ?? "").replace(/\s/g, "")) || 0), 0);
  // Jadvalda summa doim MUSBAT (mappers.ts Math.abs qiladi).
  const dbSum = docs.reduce((s, d) => s + Math.abs(Number(d.amount) || 0), 0);
  check("summa", Math.round(sheetSum) === Math.round(dbSum), `jadval ${fmt(sheetSum)} · baza ${fmt(dbSum)}`);
}

console.log(allOk ? "\n✓ Jadval baza bilan to'liq mos." : "\n✗ Nomuvofiqlik bor.");
await client.close();
process.exit(allOk ? 0 : 1);
