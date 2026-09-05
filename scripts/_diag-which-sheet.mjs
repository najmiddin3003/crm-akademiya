// FAQAT O'QIYDI. Production QAYSI jadvalga yozayotganini aniqlaydi:
// baza, ESKI jadval va YANGI jadvaldagi qator sonlarini solishtiradi.
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
const s = createSign("RSA-SHA256");
s.update(input); s.end();
const tok = await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${input}.${b64(s.sign(normKey(process.env.GOOGLE_PRIVATE_KEY)))}`,
  }),
})).json();

const SHEETS = {
  ESKI: "1NOlPLD0gjo2RvTtJkBjPMqLlb3B7rKuBt56ppipTbFQ",
  YANGI: "1nX1JEQDI9T5g01V7c_-tnlWVbqOolay4VOYpUypMTIs",
};
const TABS = [
  ["To'lovlar", { txType: "payIn" }],
  ["Xodim oyliklari", { txType: "payOut", txName: { $regex: "oylik|avans", $options: "i" } }],
  ["Xarajatlar", { txType: "payOut", txName: { $not: { $regex: "oylik|avans", $options: "i" } } }],
  ["Ko'chirmalar", { txType: "transfer" }],
];

async function ids(sheetId, tab) {
  const r = await (await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`${tab}!A2:A`)}`,
    { headers: { Authorization: `Bearer ${tok.access_token}` } },
  )).json();
  if (r.error) return null;
  return new Set((r.values ?? []).map((x) => Number(String(x?.[0] ?? "").trim())).filter(Number.isFinite));
}

const c = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await c.connect();
const db = c.db(process.env.MONGODB_DB);

console.log("varaq                baza    ESKI   YANGI   izoh");
for (const [tab, filter] of TABS) {
  const dbIds = new Set((await db.collection("transaction_entries")
    .find(filter, { projection: { _id: 0, id: 1 } }).toArray()).map((r) => Number(r.id)));
  const oldIds = await ids(SHEETS.ESKI, tab);
  const newIds = await ids(SHEETS.YANGI, tab);
  const missOld = oldIds ? [...dbIds].filter((i) => !oldIds.has(i)) : null;
  const missNew = newIds ? [...dbIds].filter((i) => !newIds.has(i)) : null;
  const note = missNew?.length === 0 && missOld?.length > 0
    ? "YANGIDA to'liq, eskida yetishmayapti"
    : missOld?.length === 0 && missNew?.length === 0
      ? "ikkalasi ham to'liq"
      : `eskida yo'q: ${missOld?.join(",") || "-"} | yangida yo'q: ${missNew?.join(",") || "-"}`;
  console.log(
    `${tab.padEnd(18)} ${String(dbIds.size).padStart(5)} ${String(oldIds?.size ?? "-").padStart(7)} ` +
    `${String(newIds?.size ?? "-").padStart(7)}   ${note}`,
  );
}

await c.close();
