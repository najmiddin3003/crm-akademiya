// Varaq nomini o'zgartiradi (ma'lumot va formatga TEGMAYDI).
//
//   node scripts/sheets-rename-tab.mjs "Eski nom" "Yangi nom"            # quruq
//   node scripts/sheets-rename-tab.mjs "Eski nom" "Yangi nom" --apply
//
// NEGA QAYTA YARATISH EMAS, NOMNI O'ZGARTIRISH: yangi varaq yaratilsa
// eski qatorlar yetim qolardi va solishtirish ularni yangisiga qaytadan
// yozib, jadvalda ikki nusxa hosil bo'lardi. Nomni o'zgartirish esa
// qatorlarni ham, formatni ham, filtrni ham joyida qoldiradi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSign } from "node:crypto";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const [from, to] = args.filter((a) => a !== "--apply");
if (!from || !to) {
  console.error('Foydalanish: node scripts/sheets-rename-tab.mjs "Eski nom" "Yangi nom" [--apply]');
  process.exit(1);
}

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
  k = k.replace(/\\n/g, "\n");
  const b = k.indexOf("-----BEGIN"), e = k.lastIndexOf("-----");
  return b >= 0 && e > b ? k.slice(b, e + 5) : k;
};
const b64 = (v) => Buffer.from(v).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const now = Math.floor(Date.now() / 1000);
const input = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify({
  iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
  scope: "https://www.googleapis.com/auth/spreadsheets",
  aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
}))}`;
const signer = createSign("RSA-SHA256");
signer.update(input); signer.end();
const tok = await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${input}.${b64(signer.sign(normKey(process.env.GOOGLE_PRIVATE_KEY)))}`,
  }),
})).json();

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

const meta = await api("?fields=sheets(properties(sheetId,title,gridProperties(rowCount)))");
console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===");
console.log("jadval:", ID, "\nvaraqlar:", meta.sheets.map((s) => `"${s.properties.title}"`).join(", "), "\n");

const src = meta.sheets.find((s) => s.properties.title === from);
if (!src) { console.error(`"${from}" varag'i topilmadi.`); process.exit(1); }
if (meta.sheets.some((s) => s.properties.title === to)) {
  console.error(`"${to}" nomli varaq ALLAQACHON bor — nom to'qnashadi.`);
  process.exit(1);
}
console.log(`"${from}" (${src.properties.gridProperties.rowCount} qator) -> "${to}"`);

if (!APPLY) {
  console.log("\nHech narsa o'zgartirilmadi. Qo'llash uchun: --apply");
  process.exit(0);
}
await api(":batchUpdate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    requests: [{
      updateSheetProperties: {
        properties: { sheetId: src.properties.sheetId, title: to },
        fields: "title",
      },
    }],
  }),
});
const after = await api("?fields=sheets(properties(title))");
console.log("\nvaraqlar endi:", after.sheets.map((s) => `"${s.properties.title}"`).join(", "));
