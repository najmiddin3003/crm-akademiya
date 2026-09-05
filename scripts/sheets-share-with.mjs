// Google jadvalni ODAMGA ulashadi (service account nomidan).
//
//   node scripts/sheets-share-with.mjs <email>            # quruq yurish
//   node scripts/sheets-share-with.mjs <email> --apply    # ulashadi
//
// ══════════════════════════════════════════════════════════════════
// NIMA UCHUN KERAK
//
// Jadval Claude'ning Google Drive konnektori orqali yaratilgan, ya'ni
// egasi — o'sha paytda ulangan hisob. Foydalanuvchining o'z hisobida
// fayl "Recent" ro'yxatida ko'rinadi (bir marta havola ochilgan), lekin
// ochilmaydi: "Sorry, unable to open the file at this time" — bu
// Google'ning "ruxsatingiz yo'q" degani.
//
// Service account faylga MUHARRIR sifatida ulangan. Muharrir odatda
// boshqalarga ham ulasha oladi (agar ega buni cheklab qo'ymagan bo'lsa),
// shuning uchun ruxsatni shu yerdan qo'shsa bo'ladi.
//
// DIQQAT: Drive API loyihada YOQILGAN bo'lishi kerak. CRM'ning o'zi
// faqat Sheets API bilan ishlaydi, shu bois u odatda o'chiq turadi:
//   console.cloud.google.com -> akademiya-crm-sync -> APIs & Services
//   -> Google Drive API -> Enable
//
// FAQAT KO'RSATILGAN ODAMGA. Havola bo'yicha ochiq qilinmaydi ("anyone
// with the link") — jadvalda o'quvchilarning ismi, telefoni va to'lov
// summalari bor.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSign } from "node:crypto";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const email = args.find((a) => a.includes("@"));
if (!email) {
  console.error("Foydalanish: node scripts/sheets-share-with.mjs <email> [--apply]");
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
  scope: "https://www.googleapis.com/auth/drive",
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

console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===");
console.log("jadval:", ID);
console.log("kimga :", email, "(muharrir)\n");

const info = await (await fetch(
  `https://www.googleapis.com/drive/v3/files/${ID}?fields=name,trashed,owners(emailAddress),permissions(id,type,role,emailAddress),capabilities(canShare)`,
  { headers: AUTH },
)).json();

if (info.error) {
  console.error("Drive API xatosi:", JSON.stringify(info.error).slice(0, 400));
  if (String(info.error.message ?? "").includes("has not been used")) {
    console.error("\n-> Drive API yoqilmagan. Yoqing va qayta urinib ko'ring:");
    console.error("   console.cloud.google.com -> akademiya-crm-sync -> APIs & Services -> Google Drive API -> Enable");
  }
  process.exit(1);
}

console.log("nomi:", info.name, "| savatdami:", info.trashed);
console.log("egasi:", (info.owners ?? []).map((o) => o.emailAddress).join(", ") || "-");
console.log("service account ulasha oladimi:", info.capabilities?.canShare);
console.log("hozirgi ruxsatlar:");
for (const p of info.permissions ?? []) {
  console.log(`  ${String(p.type).padEnd(8)} ${String(p.role).padEnd(8)} ${p.emailAddress ?? "-"}`);
}

const already = (info.permissions ?? []).some(
  (p) => String(p.emailAddress ?? "").toLowerCase() === email.toLowerCase(),
);
if (already) {
  console.log(`\n${email} allaqachon ro'yxatda — qo'shish shart emas.`);
  process.exit(0);
}
if (info.capabilities?.canShare === false) {
  console.error("\nService account ULASHA OLMAYDI — faylning egasi buni cheklab qo'ygan.");
  console.error("Bu holda ruxsatni faqat EGASI bera oladi.");
  process.exit(1);
}

if (!APPLY) {
  console.log("\nHech narsa o'zgartirilmadi. Qo'llash uchun: --apply");
  process.exit(0);
}

const res = await fetch(
  // `sendNotificationEmail=false` — foydalanuvchi o'ziga ulashyapti,
  // Google'dan "sizga fayl ulashildi" xati kerak emas.
  `https://www.googleapis.com/drive/v3/files/${ID}/permissions?sendNotificationEmail=false`,
  {
    method: "POST",
    headers: { ...AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "user", role: "writer", emailAddress: email }),
  },
);
const out = await res.json();
if (!res.ok) {
  console.error("ulashilmadi:", JSON.stringify(out).slice(0, 400));
  process.exit(1);
}
console.log(`\nulashildi: ${email} -> ${out.role}`);
console.log(`Endi shu havola ochilishi kerak:\nhttps://docs.google.com/spreadsheets/d/${ID}/edit`);
