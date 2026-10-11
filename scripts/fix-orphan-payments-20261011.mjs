// «YETIM» TO'LOVLARNI TO'G'RI KARTAGA BOG'LASH (11.10.2026).
//
// Foydalanuvchi: «filial 4 da Mushtariybonu Manyazova to'lov qilgan ammo guruh
// sahifasida balansi chiqmayapti» → scripts/_check-orphan-payments.mjs (prod,
// faqat o'qib) topdi; foydalanuvchi «xa 1 … ni qil» dedi:
//   • #2172, #2173 (02.10, 225 000 + 225 000) — O'CHIRILGAN karta #16989 ga
//     bog'langan; o'quvchi 07.10 da #17347 bo'lib qayta kiritilgan;
//   • #620 (420 000) — `pupilId` siz, ismi xato yozilgan («Noila Asadulayeva»),
//     karta — #17045 «Noila Asadullayeva».
// Faqat `pupilId` yoziladi; yozuvdagi ism (kassir yozgani) o'zgarmaydi.
//
//   node --env-file=.env.local scripts/fix-orphan-payments-20261011.mjs            # faqat ko'rsatadi
//   node --env-file=.env.local scripts/fix-orphan-payments-20261011.mjs --apply    # yozadi (+ kvitansiya)
//   node --env-file=.env.local scripts/fix-orphan-payments-20261011.mjs --undo     # kvitansiyadan qaytaradi
//
// Har yozuv yozishdan OLDIN tekshiriladi (kutilgan holatda bo'lmasa — tegilmaydi).
// Kvitansiya: RECEIPT (eski qiymatlar). Amal `action_log` ga «Skript» nomidan.
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { MongoClient } = require("mongodb");

const RECEIPT = process.env.RECEIPT || "/var/www/crm/shared/fix-orphan-payments-20261011.json";
const apply = process.argv.includes("--apply");
const undo = process.argv.includes("--undo");

/** entryId → { from: kutilgan pupilId (null — yo'q), to: yangi pupilId, name: yozuvdagi ism (normallashgan) } */
const PLAN = [
  { entryId: 2172, from: 16989, to: 17347, name: "mushtariybonu manyazova" },
  { entryId: 2173, from: 16989, to: 17347, name: "mushtariybonu manyazova" },
  { entryId: 620, from: null, to: 17045, name: "noila asadulayeva" },
];

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
const hasPupilId = (e) => e.pupilId !== undefined && e.pupilId !== null && Number.isFinite(Number(e.pupilId));

if (!process.env.MONGODB_URI) {
  console.log("MONGODB_URI yo'q");
  process.exit(1);
}
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB || "crm_akademiya");
const entries = db.collection("transaction_entries");

async function audit(action, details) {
  await db.collection("action_log").insertOne({
    at: new Date(),
    actor: { kind: "system", name: "Skript" },
    source: "cron",
    section: "transaction-entries",
    action,
    status: 200,
    details: { script: "scripts/fix-orphan-payments-20261011.mjs", ...details },
  });
}

if (undo) {
  if (!fs.existsSync(RECEIPT)) {
    console.log(`Kvitansiya yo'q: ${RECEIPT}`);
    process.exit(1);
  }
  const rec = JSON.parse(fs.readFileSync(RECEIPT, "utf8"));
  for (const r of rec.changed) {
    const res = await entries.updateOne(
      { id: r.entryId, pupilId: r.to },
      r.from === null ? { $unset: { pupilId: "" } } : { $set: { pupilId: r.from } },
    );
    console.log(`#${r.entryId}: ${res.modifiedCount ? `qaytarildi → ${r.from ?? "(pupilId yo'q)"}` : "o'zgarmadi (holat boshqa)"}`);
  }
  await audit("relink_pupil_undo", { entries: rec.changed });
  await client.close();
  process.exit(0);
}

const ok = [];
for (const p of PLAN) {
  const e = await entries.findOne({ id: p.entryId }, { projection: { _id: 0, id: 1, date: 1, studentName: 1, pupilId: 1, amount: 1, txType: 1, status: 1, cashboxId: 1 } });
  const card = await db.collection("pupils").findOne({ id: p.to }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, branchId: 1, status: 1 } });
  const problems = [];
  if (!e) problems.push("yozuv topilmadi");
  else {
    if (e.txType !== "payIn") problems.push(`txType ${e.txType}`);
    if (e.status === "cancelled") problems.push("bekor qilingan");
    if (norm(e.studentName) !== p.name) problems.push(`ism «${e.studentName}»`);
    if (p.from === null ? hasPupilId(e) : Number(e.pupilId) !== p.from) problems.push(`pupilId hozir ${e.pupilId ?? "yo'q"}`);
  }
  if (!card) problems.push(`karta #${p.to} topilmadi`);
  if (p.from !== null && (await db.collection("pupils").findOne({ id: p.from }, { projection: { _id: 1 } }))) problems.push(`eski karta #${p.from} hali bor`);
  const cardName = card ? `${card.firstName ?? ""} ${card.lastName ?? ""}`.trim() : "?";
  console.log(
    `#${p.entryId} ${e?.date ?? "?"} «${e?.studentName ?? "?"}» ${e?.amount ?? "?"} so'm: ${p.from ?? "pupilId yo'q"} → #${p.to} «${cardName}» f${card?.branchId ?? "?"}` +
      (problems.length ? `  ✗ ${problems.join("; ")}` : "  ✓"),
  );
  if (!problems.length) ok.push({ ...p, amount: e.amount, date: e.date, studentName: e.studentName });
}

if (!apply) {
  console.log(`\nQuruq yurish: ${ok.length}/${PLAN.length} yozuv tayyor. Yozish uchun --apply.`);
  await client.close();
  process.exit(0);
}
if (ok.length !== PLAN.length) {
  console.log("\nHammasi kutilgan holatda emas — hech narsa yozilmadi.");
  await client.close();
  process.exit(1);
}
fs.writeFileSync(RECEIPT, JSON.stringify({ at: new Date().toISOString(), changed: ok }, null, 1), "utf8");
for (const p of ok) {
  const res = await entries.updateOne(
    { id: p.entryId, ...(p.from === null ? { pupilId: { $in: [null] } } : { pupilId: p.from }) },
    { $set: { pupilId: p.to } },
  );
  console.log(`#${p.entryId}: ${res.modifiedCount ? `yozildi → #${p.to}` : "O'ZGARMADI"}`);
}
await audit("relink_pupil", { entries: ok.map((p) => ({ entryId: p.entryId, from: p.from, to: p.to, amount: p.amount })) });
console.log(`\nKvitansiya: ${RECEIPT}`);
await client.close();
