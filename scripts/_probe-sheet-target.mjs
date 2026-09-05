// FAQAT SINOV — production QAYSI jadvalga yozayotganini aniqlaydi.
//
//   node scripts/_probe-sheet-target.mjs remove   # yangi jadvaldan oxirgi
//                                                 # To'lovlar qatorini oladi
//   node scripts/_probe-sheet-target.mjs check    # holatni ko'rsatadi
//
// USUL: ikkala jadval ham hozir to'liq, ya'ni qator sonlari bir xil va
// ular bilan farqni bilib bo'lmaydi. Shuning uchun YANGI jadvaldan bitta
// qator olib tashlanadi. Keyin production'ning cron'i chaqiriladi:
//   • u yangisiga qarasa — o'sha qatorni QAYTA QO'SHADI (added: 1);
//   • eskisiga qarasa — yangisi kam holicha qoladi.
// Ikkala holatda ham ma'lumot yo'qolmaydi: qator bazada turibdi va
// solishtirish uni istalgan vaqtda tiklaydi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSign } from "node:crypto";

const MODE = process.argv[2] ?? "check";
const NEW_ID = "1nX1JEQDI9T5g01V7c_-tnlWVbqOolay4VOYpUypMTIs";
const TAB = "To'lovlar";

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
const AUTH = { Authorization: `Bearer ${tok.access_token}` };

const api = async (p, init) => {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${NEW_ID}${p}`, {
    ...init, headers: { ...AUTH, ...(init?.headers ?? {}) },
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
  return j;
};

const values = (await api(`/values/${encodeURIComponent(`${TAB}!A2:A`)}`)).values ?? [];
const rows = values.filter((r) => String(r?.[0] ?? "").trim() !== "");
console.log(`YANGI jadval "${TAB}": ${rows.length} qator`);
console.log("oxirgi ID lar:", rows.slice(-5).map((r) => r[0]).join(", "));

if (MODE === "remove") {
  const meta = await api("?fields=sheets(properties(sheetId,title))");
  const sheetId = meta.sheets.find((s) => s.properties.title === TAB)?.properties.sheetId;
  const rowNumber = rows.length + 1; // sarlavha 1-qator
  await api(":batchUpdate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber } } }],
    }),
  });
  console.log(`\n${rowNumber}-qator (ID ${rows[rows.length - 1][0]}) olib tashlandi — endi ${rows.length - 1} qator.`);
  console.log("Endi production cron'ini chaqiring va shu skriptni 'check' bilan qayta yurgizing.");
}
