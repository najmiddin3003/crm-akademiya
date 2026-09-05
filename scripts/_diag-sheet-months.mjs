// FAQAT O'QIYDI — Google jadvaldagi har bir varaqda nechta qator bor va
// ular qaysi oylarga tegishli. Sana "DD.MM.YYYY" MATN bo'lib yozilgan
// (lib/sync/googleSheets.ts RAW bilan yozadi), shu bois oy 4-belgidan.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSign } from "node:crypto";

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
if (!tok.access_token) { console.error("token olinmadi:", tok); process.exit(1); }

const ID = process.env.SHEET_ID_PAYMENTS.trim();
const api = async (p) => {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ID}${p}`, {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
  return j;
};

const meta = await api("?fields=sheets(properties(sheetId,title,gridProperties(rowCount)))");
console.log("jadval:", ID);
console.log("\nvaraqlar:");
for (const s of meta.sheets) {
  console.log(`  #${s.properties.sheetId} "${s.properties.title}" (grid ${s.properties.gridProperties.rowCount} qator)`);
}

for (const s of meta.sheets) {
  const title = s.properties.title;
  if (title === "Oylik hisobot") { console.log(`\n--- ${title}: formulali hisobot, tegilmaydi ---`); continue; }
  const enc = encodeURIComponent(`${title}!A2:B`);
  const v = (await api(`/values/${enc}?majorDimension=ROWS`)).values ?? [];
  const rows = v.filter((r) => String(r?.[0] ?? "").trim() !== "");
  const byMonth = new Map();
  for (const r of rows) {
    const d = String(r?.[1] ?? "").trim();       // "DD.MM.YYYY"
    const key = d.length >= 10 ? d.slice(3, 10) : "(sanasiz)";
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  const sorted = [...byMonth.entries()].sort((a, b) => {
    const k = (x) => x.slice(3) + x.slice(0, 2);
    return k(a[0]) < k(b[0]) ? -1 : 1;
  });
  console.log(`\n--- ${title}: ${rows.length} qator ---`);
  for (const [m, n] of sorted) console.log(`    ${m}: ${n}`);
}
