// FAQAT O'QIYDI — jadval haqiqatan joyidami, egasi kim va kimlarga
// ulashilgan. "Sorry, unable to open the file" xatosining sababini
// aniqlash uchun.
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
  k = k.replace(/\\n/g, "\n");
  const b = k.indexOf("-----BEGIN"), e = k.lastIndexOf("-----");
  return b >= 0 && e > b ? k.slice(b, e + 5) : k;
};
const b64 = (v) => Buffer.from(v).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function token(scope) {
  const now = Math.floor(Date.now() / 1000);
  const input = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify({
    iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
    scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }))}`;
  const s = createSign("RSA-SHA256");
  s.update(input); s.end();
  const j = await (await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${input}.${b64(s.sign(normKey(process.env.GOOGLE_PRIVATE_KEY)))}`,
    }),
  })).json();
  return j.access_token;
}

const ID = process.env.SHEET_ID_PAYMENTS.trim();
console.log("kutilgan jadval ID:", ID);
console.log("uzunligi:", ID.length);
console.log("service account:", process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim());

// 1) Sheets API — fayl ochiladimi?
const t1 = await token("https://www.googleapis.com/auth/spreadsheets");
const meta = await (await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${ID}?fields=properties(title),sheets(properties(title))`,
  { headers: { Authorization: `Bearer ${t1}` } },
)).json();
console.log("\n--- Sheets API ---");
console.log(meta.error ? JSON.stringify(meta.error).slice(0, 300) : `nomi: "${meta.properties?.title}"`);
if (meta.sheets) console.log("varaqlar:", meta.sheets.map((s) => s.properties.title).join(" · "));

// 2) Drive API — egasi va ruxsatlar.
const t2 = await token("https://www.googleapis.com/auth/drive");
const info = await (await fetch(
  `https://www.googleapis.com/drive/v3/files/${ID}?fields=id,name,trashed,owners(emailAddress,displayName),permissions(id,type,role,emailAddress),capabilities(canShare)&supportsAllDrives=true`,
  { headers: { Authorization: `Bearer ${t2}` } },
)).json();
console.log("\n--- Drive API ---");
if (info.error) {
  console.log("xato:", JSON.stringify(info.error).slice(0, 400));
} else {
  console.log("nomi:", info.name, "| savatdami:", info.trashed);
  console.log("egasi:", (info.owners ?? []).map((o) => `${o.displayName} <${o.emailAddress}>`).join(", ") || "-");
  console.log("ulasha oladimi (service account):", info.capabilities?.canShare);
  console.log("ruxsatlar:");
  for (const p of info.permissions ?? []) {
    console.log(`  ${String(p.type).padEnd(8)} ${String(p.role).padEnd(8)} ${p.emailAddress ?? "-"}`);
  }
}
