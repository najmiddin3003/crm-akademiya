// BIR MARTALIK — Google jadvaldagi ESKI qatorlarni tozalaydi.
//
//   node scripts/sheets-keep-september.mjs            # quruq yurish + zaxira
//   node scripts/sheets-keep-september.mjs --apply    # haqiqatan o'chiradi
//
// ------------------------------------------------------------------
// NIMA VA NEGA (markaz so'rovi, 2026-09-05)
//
// Baza QAYTA BOSHLANGAN: `transaction_entries` da endi atigi 114 yozuv
// bor va ularning HAMMASI 2026-09 dan (eng eskisi id=1, 02.09.2026).
// Jadvalda esa edutizimdan ko'chirilgan BUTUN yillik tarix turibdi —
// 25 569 qator, 09.2025 dan 08.2026 gacha. Markaz: "google sheetsda
// faqat sentabr to'lovlari tursin".
//
// ⚠️ NEGA SHOSHILINCH. Baza id'lari 1 dan QAYTA boshlangan, jadvaldagi
// eski qatorlar esa o'sha id'larni band qilib turibdi. Solishtirish
// (lib/sync/reconcile.ts) qatorni ID bo'yicha topadi — ya'ni tozalanmasa
// u yangi sentabr to'lovini ESKI avgust qatorining ustiga yozadi va
// qolgan 18 700 qator eskirgan holicha qolaveradi. Shu bois jadval
// sinxronizatsiya YOQILISHIDAN OLDIN tozalanishi kerak.
//
// ZAXIRA. Bu tarix bazada YO'Q — jadval uning YAGONA nusxasi. Skript
// o'chirishdan oldin to'rt varaqni ham diskka yozadi.
//
// "Oylik hisobot" varag'iga TEGILMAYDI — u formulali va o'zi qayta
// hisoblanadi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSign } from "node:crypto";

const APPLY = process.argv.includes("--apply");
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
const jwtInput = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify({
  iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
  scope: "https://www.googleapis.com/auth/spreadsheets",
  aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
}))}`;
const signer = createSign("RSA-SHA256");
signer.update(jwtInput);
signer.end();
const tok = await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${jwtInput}.${b64(signer.sign(normKey(process.env.GOOGLE_PRIVATE_KEY)))}`,
  }),
})).json();
if (!tok.access_token) { console.error("Google token olinmadi:", tok); process.exit(1); }

const ID = process.env.SHEET_ID_PAYMENTS.trim();
const AUTH = { Authorization: `Bearer ${tok.access_token}` };

async function api(p, init) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ID}${p}`, {
    ...init,
    headers: { ...AUTH, ...(init?.headers ?? {}) },
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 400));
  return j;
}

/** Tozalanadigan varaqlar. "Oylik hisobot" ataylab yo'q. */
const TABS = ["To'lovlar", "Xodim oyliklari", "Xarajatlar", "Ko'chirmalar"];
/** Shu oydagi qatorlar QOLADI ("DD.MM.YYYY" ning oy.yil qismi). */
const KEEP_MONTH = "09.2026";

const meta = await api("?fields=sheets(properties(sheetId,title,gridProperties(rowCount)))");
const byTitle = new Map(meta.sheets.map((s) => [s.properties.title, s.properties]));

console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===");
console.log("jadval:", ID, "\nqoldiriladigan oy:", KEEP_MONTH, "\n");

const backup = { at: new Date().toISOString(), spreadsheetId: ID, tabs: {} };
const plan = [];

for (const title of TABS) {
  const props = byTitle.get(title);
  if (!props) { console.log(`  "${title}" — varaq yo'q, o'tkazib yuborildi`); continue; }
  const enc = encodeURIComponent(`${title}!A1:Z`);
  const values = (await api(`/values/${enc}?majorDimension=ROWS`)).values ?? [];
  backup.tabs[title] = values;

  const header = values[0] ?? [];
  const body = values.slice(1);
  // Qator raqami: sarlavha 1-qator, ya'ni body[i] -> i + 2.
  const keep = [];
  const drop = [];
  body.forEach((row, i) => {
    if (String(row?.[0] ?? "").trim() === "") return; // bo'sh qator — sanalmaydi
    const d = String(row?.[1] ?? "").trim();
    (d.slice(3, 10) === KEEP_MONTH ? keep : drop).push(i + 2);
  });
  plan.push({ title, sheetId: props.sheetId, header: header.length, keep: keep.length, drop });
  console.log(`  ${title.padEnd(18)} jami ${String(keep.length + drop.length).padStart(6)}  qoladi ${String(keep.length).padStart(4)}  o'chadi ${String(drop.length).padStart(6)}`);
}

const backupPath = path.join("C:/Users/zovaxx/Desktop", `sheets-zaxira-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(backupPath, JSON.stringify(backup));
console.log(`\nzaxira yozildi: ${backupPath} (${(fs.statSync(backupPath).size / 1048576).toFixed(1)} MB)`);

if (!APPLY) {
  console.log("\nHech narsa o'chirilmadi. Qo'llash uchun: --apply");
  process.exit(0);
}

// O'CHIRISH — PASTDAN YUQORIGA. Qator o'chirilganda undan keyingilarining
// raqami suriladi; teskari tartibda yurilsa oldingi raqamlar o'zgarmaydi.
// Ketma-ket qatorlar bitta oraliqqa yig'iladi — 18 000 ta alohida so'rov
// Google limitiga urilardi.
for (const t of plan) {
  if (t.drop.length === 0) { console.log(`  ${t.title}: o'chiradigan qator yo'q`); continue; }
  const rows = [...t.drop].sort((a, b) => a - b);
  const ranges = [];
  let start = rows[0], prev = rows[0];
  for (const r of rows.slice(1)) {
    if (r === prev + 1) { prev = r; continue; }
    ranges.push([start, prev]);
    start = prev = r;
  }
  ranges.push([start, prev]);
  ranges.reverse();

  const requests = ranges.map(([a, b]) => ({
    deleteDimension: {
      range: { sheetId: t.sheetId, dimension: "ROWS", startIndex: a - 1, endIndex: b },
    },
  }));
  // Bir so'rovda hammasi: Sheets API ularni BERILGAN TARTIBDA bajaradi,
  // ya'ni teskari tartib saqlanadi.
  for (let i = 0; i < requests.length; i += 100) {
    await api(":batchUpdate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests: requests.slice(i, i + 100) }),
    });
  }
  console.log(`  ${t.title}: ${t.drop.length} qator o'chirildi (${ranges.length} oraliq)`);
}

console.log("\n=== TEKSHIRUV ===");
for (const title of TABS) {
  const enc = encodeURIComponent(`${title}!A2:B`);
  const v = (await api(`/values/${enc}?majorDimension=ROWS`)).values ?? [];
  const rows = v.filter((r) => String(r?.[0] ?? "").trim() !== "");
  const months = [...new Set(rows.map((r) => String(r?.[1] ?? "").slice(3, 10)))];
  console.log(`  ${title.padEnd(18)} ${String(rows.length).padStart(4)} qator, oylar: ${months.join(", ") || "-"}`);
}
