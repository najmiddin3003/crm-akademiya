// FAQAT O'QIYDI. Sinxronizatsiya HOZIR ishlayaptimi:
// navbat holati, oxirgi yozuvlar va ular jadvalga tushganmi.
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

const c = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await c.connect();
const db = c.db(process.env.MONGODB_DB);

console.log("=== NAVBAT (sync_outbox) ===");
const ob = db.collection("sync_outbox");
const total = await ob.countDocuments();
console.log("jami:", total);
for (const r of await ob.aggregate([
  { $group: { _id: { s: "$status", k: "$kind" }, n: { $sum: 1 } } }, { $sort: { n: -1 } },
]).toArray()) console.log(`  ${String(r._id.k).padEnd(9)} ${String(r._id.s).padEnd(8)} ${r.n}`);
const errs = (await ob.distinct("lastError")).filter(Boolean);
console.log("xatolar:", errs.length ? JSON.stringify(errs).slice(0, 300) : "yo'q");

console.log("\noxirgi 6 navbat qatori:");
for (const r of await ob.find({}, { projection: { _id: 0, entryId: 1, kind: 1, status: 1, sheetDone: 1, telegramDone: 1, doneAt: 1, lastError: 1 } })
  .sort({ createdAt: -1 }).limit(6).toArray()) {
  console.log(`  #${r.entryId} ${String(r.kind).padEnd(8)} ${String(r.status).padEnd(8)} sheet=${r.sheetDone} telegram=${r.telegramDone} ${r.doneAt ?? ""} ${r.lastError ?? ""}`);
}

console.log("\n=== SO'NGGI SINXRONIZATSIYA (sync_runs) ===");
for (const r of await db.collection("sync_runs").find({}).sort({ id: -1 }).limit(3).toArray()) {
  const errs2 = (r.reports ?? []).flatMap((x) => x.errors ?? []);
  console.log(`  #${r.id} ${r.startedAt} trigger=${r.trigger} flushed=${r.flushed} xato=${errs2.length ? JSON.stringify(errs2).slice(0, 120) : "yo'q"}`);
}

// Jadvaldagi ID'lar bilan solishtirish.
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
const TABS = [
  ["To'lovlar", { txType: "payIn" }],
  ["Xodim oyliklari", { txType: "payOut", txName: { $regex: "oylik|avans", $options: "i" } }],
  ["Xarajatlar", { txType: "payOut", txName: { $not: { $regex: "oylik|avans", $options: "i" } } }],
  ["Ko'chirmalar", { txType: "transfer" }],
];

console.log("\n=== BAZA <-> JADVAL ===");
console.log("varaq              baza  jadval  yetishmayapti");
for (const [tab, filter] of TABS) {
  const dbIds = new Set((await db.collection("transaction_entries")
    .find(filter, { projection: { _id: 0, id: 1 } }).toArray()).map((r) => Number(r.id)));
  const v = (await (await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${ID}/values/${encodeURIComponent(`${tab}!A2:A`)}`,
    { headers: { Authorization: `Bearer ${tok.access_token}` } },
  )).json()).values ?? [];
  const sheetIds = new Set(v.map((r) => Number(String(r?.[0] ?? "").trim())).filter(Number.isFinite));
  const missing = [...dbIds].filter((id) => !sheetIds.has(id));
  console.log(
    `${tab.padEnd(18)} ${String(dbIds.size).padStart(4)} ${String(sheetIds.size).padStart(7)}` +
    `  ${missing.length === 0 ? "yo'q — TO'LIQ MOS" : missing.join(", ")}`,
  );
}

await c.close();
