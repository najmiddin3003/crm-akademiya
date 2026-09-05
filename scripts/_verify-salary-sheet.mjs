// FAQAT O'QIYDI. "Xodim oyliklari" varag'i bazaga MOSMI — qator soni
// emas, HAR BIR KATAKCHA bo'yicha.
//
// MUHIM FARQ: bu varaq oylikni HISOBLAMAYDI. U — kassadan HAQIQATAN
// chiqarilgan oylik va avanslarning jurnali. Hisoblash (foiz, soliq,
// qolgan summa) CRM ichida — lib/payrollSources.ts va Moliya -> Oylik
// sahifasida. Shu bois bu skript ikkita boshqa savolga javob beradi:
//   1) jurnal jadvalga to'g'ri ko'chganmi (ism, lavozim, summa, kassa…);
//   2) "Oylik hisobot" varag'idagi "Oylik va avans" ustuni bazadagi
//      yig'indi bilan mos kelyaptimi.
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
const get = async (range, render = "UNFORMATTED_VALUE") =>
  (await (await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${ID}/values/${encodeURIComponent(range)}?valueRenderOption=${render}`,
    { headers: { Authorization: `Bearer ${tok.access_token}` } },
  )).json()).values ?? [];

const c = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await c.connect();
const db = c.db(process.env.MONGODB_DB);

// ── 1) Jurnal <-> varaq, katakcha darajasida ────────────────────────
const rows = await db.collection("transaction_entries")
  .find({ txType: "payOut", txName: { $regex: "oylik|avans", $options: "i" } }, { projection: { _id: 0 } })
  .sort({ id: 1 }).toArray();

const boxes = new Map((await db.collection("cashboxes").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray())
  .map((b) => [b.id, b.name]));
const emps = await db.collection("hr_employees").find({}, { projection: { _id: 0, name: 1, turi: 1, filial: 1 } }).toArray();
const empByName = new Map(emps.map((e) => [String(e.name ?? "").trim().toLowerCase(), e]));

const sheet = await get("Xodim oyliklari!A2:N", "FORMATTED_VALUE");
const byId = new Map(sheet.filter((r) => String(r?.[0] ?? "").trim() !== "").map((r) => [Number(r[0]), r]));

console.log(`bazada oylik/avans yozuvlari: ${rows.length} | varaqda: ${byId.size}\n`);
console.log("ID  | sana        | xodim                    | lavozim    | summa      | kassa                 | holat        | tekshiruv");

let bad = 0;
for (const e of rows) {
  const r = byId.get(e.id);
  if (!r) { console.log(`${String(e.id).padStart(3)} | VARAQDA YO'Q`); bad++; continue; }
  const emp = empByName.get(String(e.studentName ?? "").trim().toLowerCase());
  const expect = {
    xodim: String(e.studentName ?? "").trim(),
    summa: Math.abs(Number(e.amount) || 0),
    kassa: boxes.get(e.cashboxId) ?? "",
    turi: String(e.txName ?? "").trim(),
    usul: String(e.paymentType ?? "").trim(),
    chiqargan: String(e.moderator ?? "").trim(),
    holat: e.status === "cancelled" ? "Bekor qilindi" : e.status === "waiting" ? "Kutilmoqda" : "Faol",
  };
  const got = {
    xodim: String(r[3] ?? "").trim(),
    summa: Number(String(r[7] ?? "").replace(/[^\d-]/g, "")) || 0,
    kassa: String(r[9] ?? "").trim(),
    turi: String(r[6] ?? "").trim(),
    usul: String(r[8] ?? "").trim(),
    chiqargan: String(r[10] ?? "").trim(),
    holat: String(r[12] ?? "").trim(),
  };
  const diffs = Object.keys(expect).filter((k) => String(expect[k]) !== String(got[k]));
  if (diffs.length) bad++;
  console.log(
    `${String(e.id).padStart(3)} | ${String(r[1] ?? "").padEnd(11)} | ${expect.xodim.padEnd(24)} | ` +
    `${String(r[4] ?? "").padEnd(10)} | ${String(expect.summa).padStart(10)} | ${expect.kassa.padEnd(21)} | ` +
    `${expect.holat.padEnd(12)} | ${diffs.length ? "FARQ: " + diffs.map((k) => `${k} kutilgan "${expect[k]}" != "${got[k]}"`).join("; ") : "mos"}`,
  );
  // Lavozim/filial `hr_employees` dan keladi — xodim topilmasa bo'sh bo'ladi.
  if (!emp) console.log(`      ^ DIQQAT: "${expect.xodim}" hr_employees da topilmadi — lavozim/filial bo'sh qoladi`);
}

// ── 2) Xodim bo'yicha yig'indi ──────────────────────────────────────
console.log("\n=== XODIM BO'YICHA YIG'INDI (bekor qilinganlar chiqarilgan) ===");
const perEmp = new Map();
for (const e of rows) {
  if (e.status === "cancelled") continue;
  const k = String(e.studentName ?? "").trim();
  const cur = perEmp.get(k) ?? { oylik: 0, avans: 0, n: 0 };
  const amt = Math.abs(Number(e.amount) || 0);
  if (/avans/i.test(e.txName)) cur.avans += amt; else cur.oylik += amt;
  cur.n += 1;
  perEmp.set(k, cur);
}
let total = 0;
for (const [name, v] of [...perEmp].sort((a, b) => (b[1].oylik + b[1].avans) - (a[1].oylik + a[1].avans))) {
  total += v.oylik + v.avans;
  console.log(`  ${name.padEnd(26)} oylik ${String(v.oylik).padStart(9)} + avans ${String(v.avans).padStart(9)} = ${String(v.oylik + v.avans).padStart(10)}  (${v.n} yozuv)`);
}
console.log(`  ${"JAMI".padEnd(26)} ${String(total).padStart(41)}`);

// ── 3) "Oylik hisobot" varag'idagi ustun ────────────────────────────
console.log("\n=== \"Oylik hisobot\" varag'i: \"Oylik va avans\" ustuni ===");
const rep = await get("Oylik hisobot!A1:J20", "FORMATTED_VALUE");
const head = rep[0] ?? [];
const col = head.findIndex((h) => String(h).toLowerCase().includes("oylik"));
console.log("  ustunlar:", head.filter(Boolean).join(" · "));
for (const r of rep.slice(1)) {
  if (!String(r?.[0] ?? "").trim() && !String(r?.[1] ?? "").trim()) continue;
  const v = col >= 0 ? String(r[col] ?? "") : "?";
  if (String(r[2] ?? "").trim() === "" && String(v).trim() === "") continue;
  console.log(`  ${String(r[1] ?? r[0]).padEnd(16)} oylik va avans: ${v}`);
}
console.log(`\n  bazadagi yig'indi: ${total.toLocaleString("ru-RU")}`);

await c.close();
