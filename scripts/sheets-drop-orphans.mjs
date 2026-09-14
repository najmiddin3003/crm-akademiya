// Jadvalda bor, LEKIN bazada yo'q qatorlarni o'chiradi ("yetim" qatorlar).
//
//   node scripts/sheets-drop-orphans.mjs                     # quruq yurish
//   node scripts/sheets-drop-orphans.mjs --apply             # o'chiradi
//   node scripts/sheets-drop-orphans.mjs --by-tab [--apply]  # varaq bo'yicha
//
// `--by-tab` — yetimlik VARAQ bo'yicha: id bazada bo'lsa ham, SHU varaqning
// turiga (to'lov / oylik / xarajat / ko'chirma) tegishli bo'lmasa qator
// yetim. 14.09.2026 hodisasi: ikki server (Vercel→Atlas va VPS) bir
// jadvalga bir xil id'lar bilan yozgan; Atlas yozuvlari prod'ga yangi id
// bilan ko'chirilgach, eski id'li qatorlar boshqa turdagi yozuvlarning
// varag'ida qolib ketdi. Solishtirish (`reconcile.ts`) to'g'ri varaqqa
// to'g'ri qatorni qo'shadi, lekin noto'g'ri varaqdagini o'chirmaydi —
// oddiy rejim esa "id bazada bor" deb uni yetim sanamaydi.
//
// ------------------------------------------------------------------
// NEGA ALOHIDA SKRIPT, SOLISHTIRISHNING O'ZI EMAS
//
// `lib/sync/reconcile.ts` yetim qatorni ATAYLAB o'chirmaydi — faqat
// sanaydi. Sabab o'sha faylda yozilgan: qatorga kimdir qo'lda izoh
// qo'shgan bo'lishi mumkin va uni yo'q qilish ma'lumot yo'qotish bo'lardi.
// Ya'ni bu — kunlik avtomatika emas, QO'LDA, ko'rib chiqib bajariladigan
// amal. Shuning uchun har bir o'chiriladigan qator ekranga chiqariladi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSign } from "node:crypto";
import { MongoClient } from "mongodb";

const APPLY = process.argv.includes("--apply");
const BY_TAB = process.argv.includes("--by-tab");
const HERE = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.join(HERE, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const s = line.trim();
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
const input = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify({
  iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
  scope: "https://www.googleapis.com/auth/spreadsheets",
  aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
}))}`;
const signer = createSign("RSA-SHA256");
signer.update(input);
signer.end();
const tok = await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${input}.${b64(signer.sign(normKey(process.env.GOOGLE_PRIVATE_KEY)))}`,
  }),
})).json();
if (!tok.access_token) { console.error("Google token olinmadi:", tok); process.exit(1); }

const ID = process.env.SHEET_ID_PAYMENTS.trim();
const AUTH = { Authorization: `Bearer ${tok.access_token}` };
const api = async (p, init) => {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ID}${p}`, {
    ...init, headers: { ...AUTH, ...(init?.headers ?? {}) },
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
  return j;
};

// Varaq -> shu varaqqa tushadigan yozuvlarning baza filtri.
// `lib/sync/reconcile.ts` dagi `kindFilter` bilan bir xil ma'noda.
// Varaq nomlari `lib/sync/config.ts` bilan bir xil qoidada: muhitdan,
// bo'lmasa sukut. Oylik JURNALI "Xodim avanslari" — "Xodim oyliklari"
// esa oylik HISOBI varag'i (SALARY_SUMMARY_TAB), unda id ustuni yo'q;
// config.ts dagi qo'riqchi kabi bu qiymat e'tiborsiz qoldiriladi.
// Next.js .env o'quvchisi qiymat atrofidagi qo'shtirnoqni olib tashlaydi,
// yuqoridagi oddiy o'quvchi esa yo'q — serverdagi `.env.local` da
// SHEET_TAB_SALARIES qo'shtirnoq bilan yozilgan, shuni tenglashtiramiz.
const tab = (v, dflt) => {
  let t = (v || "").trim();
  if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1).trim();
  return t || dflt;
};
const salaryTab = (v) => { const t = tab(v, ""); return !t || t === "Xodim oyliklari" ? "Xodim avanslari" : t; };
const TABS = [
  { title: tab(process.env.SHEET_TAB_PAYMENTS, "To'lovlar"), filter: { txType: "payIn" } },
  { title: salaryTab(process.env.SHEET_TAB_SALARIES), filter: { txType: "payOut", txName: { $regex: "oylik|avans", $options: "i" } } },
  { title: tab(process.env.SHEET_TAB_EXPENSES, "Xarajatlar"), filter: { txType: "payOut", txName: { $not: { $regex: "oylik|avans", $options: "i" } } } },
  { title: tab(process.env.SHEET_TAB_TRANSFERS, "Ko'chirmalar"), filter: { txType: "transfer" } },
];

const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await client.connect();
const db = client.db(process.env.MONGODB_DB);
const entries = db.collection("transaction_entries");

// Oddiy rejim: bazadagi BARCHA id'lar — varaqma-varaq ajratmaymiz.
// Yetimlik "shu id bazada umuman yo'q" degani. `--by-tab` da esa har
// varaq uchun faqat o'z turidagi id'lar olinadi (yuqoridagi izoh).
const idsOf = async (filter) =>
  new Set((await entries.find(filter, { projection: { _id: 0, id: 1 } }).toArray()).map((r) => Number(r.id)));
const dbIds = await idsOf({});
console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===", BY_TAB ? "— varaq bo'yicha" : "");
console.log("bazadagi yozuvlar:", dbIds.size, "\n");

const meta = await api("?fields=sheets(properties(sheetId,title))");
const sheetIdOf = new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));

for (const t of TABS) {
  const sheetId = sheetIdOf.get(t.title);
  if (sheetId === undefined) { console.log(`--- ${t.title}: varaq topilmadi ---`); continue; }
  const values = (await api(`/values/${encodeURIComponent(`${t.title}!A2:D`)}?majorDimension=ROWS`)).values ?? [];
  const known = BY_TAB ? await idsOf(t.filter) : dbIds;
  const orphans = [];
  values.forEach((row, i) => {
    const id = Number(String(row?.[0] ?? "").trim());
    if (!Number.isFinite(id) || id <= 0) return;
    if (!known.has(id)) orphans.push({ row: i + 2, cells: row });
  });
  console.log(`--- ${t.title}: ${orphans.length} yetim ---`);
  for (const o of orphans) console.log(`    ${o.row}-qator: ${JSON.stringify(o.cells)}`);
  if (!APPLY || orphans.length === 0) continue;

  // Pastdan yuqoriga: qator o'chirilganda keyingilarining raqami suriladi.
  const requests = orphans
    .map((o) => o.row)
    .sort((a, b) => b - a)
    .map((r) => ({ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: r - 1, endIndex: r } } }));
  await api(":batchUpdate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  console.log(`    -> ${orphans.length} qator o'chirildi`);
}

if (!APPLY) console.log("\nHech narsa o'chirilmadi. Qo'llash uchun: --apply");
await client.close();
