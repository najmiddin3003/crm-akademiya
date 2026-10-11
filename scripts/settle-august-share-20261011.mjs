// AVGUST KIRIMLARINING USTOZ ULUSHI «BERILGAN» (11.10.2026).
//
// Foydalanuvchi: «sentabr oyiga oylik chiqarilishidan oldingi avgust
// to'lovlari turgan bo'lsa ularni 0 qilib chiqamiz, chunki u to'lovlar
// berilgan bo'ladi; sentabr oyligi to'liq berilgandan keyin avgustni
// tanlab yozilgan to'lov bo'lsa — qolaversin». Tekshiruv
// (scripts/_check-august-share.mjs, prod 11.10): avgust «nol-yopish» oyi
// kirimlaridan 9 ustozga 2 586 507 so'm ulush sentabrga «O'tgan oydan» bo'lib
// o'tib turgan edi; 21 kirimning HAMMASI 30.09.2026 21:50–21:53 dagi sentabr
// oyligi chiqarilishidan OLDIN (02.09–30.09) yozilgan; chiqarish chekida
// «O'tgan oydan» 0 — ya'ni ulush tizim orqali emas, qo'lda berilgan.
// Foydalanuvchi tanlovi: «Ha, hammasini 0 qil».
//
// Har kirimga `teacherShareSettled` yoziladi (lib/transactionEntries.ts) —
// ulush oylikka kirmaydi. O'quvchi to'lovi, balans, kassa, tushum — o'zgarmaydi.
// 4-filial (sentabr chiqarilmagan) va keyin yozilganlar — tegilmaydi.
//
//   node --env-file=.env.local scripts/settle-august-share-20261011.mjs            # faqat ko'rsatadi
//   node --env-file=.env.local scripts/settle-august-share-20261011.mjs --apply    # yozadi (+ kvitansiya)
//   node --env-file=.env.local scripts/settle-august-share-20261011.mjs --undo     # kvitansiyadan qaytaradi
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { MongoClient } = require("mongodb");

const RECEIPT = process.env.RECEIPT || "/var/www/crm/shared/settle-august-share-20261011.json";
const apply = process.argv.includes("--apply");
const undo = process.argv.includes("--undo");
const REASON = "Avgust kirimi ulushi sentabr oyligi chiqarilishidan (30.09.2026) oldin qo'lda berilgan — 11.10.2026, foydalanuvchi qarori";
/** Sentabr oyligining eng erta chiqarilishi (30.09.2026 21:50, Toshkent) — hamma kirim shundan oldin yozilgan bo'lishi shart. */
const PAYOUT_AT = new Date("2026-09-30T21:50:00+05:00");

/** entryId → kutilgan ustoz va summa (amount + chegirma). */
const PLAN = [
  { id: 19, teacher: "Abdushukur Abdug'aniyev", sum: 270000 },
  { id: 78, teacher: "Abdushukur Abdug'aniyev", sum: 270000 },
  { id: 377, teacher: "Abdushukur Abdug'aniyev", sum: 250000 },
  { id: 1695, teacher: "Abdushukur Abdug'aniyev", sum: 250000 },
  { id: 432, teacher: "Umidjon Jaloliddinov", sum: 300000 },
  { id: 20, teacher: "Muhammadjon Ahmadjanov", sum: 230000 },
  { id: 115, teacher: "Muhammadjon Ahmadjanov", sum: 230000 },
  { id: 1890, teacher: "Muhammadjon Ahmadjanov", sum: 230000 },
  { id: 2016, teacher: "Muhammadjon Ahmadjanov", sum: 460000 },
  { id: 37, teacher: "Yaxyoxo'ja Yigitaliyev", sum: 135000 },
  { id: 528, teacher: "Yaxyoxo'ja Yigitaliyev", sum: 270000 },
  { id: 112, teacher: "Musoxon Maxamadaliyev", sum: 270000 },
  { id: 280, teacher: "Musoxon Maxamadaliyev", sum: 250000 },
  { id: 1674, teacher: "Musoxon Maxamadaliyev", sum: 250000 },
  { id: 76, teacher: "Odina Yuldasheva", sum: 100000 },
  { id: 269, teacher: "Odina Yuldasheva", sum: 208000 },
  { id: 22, teacher: "Gulnoza Abdurahimova", sum: 195000 },
  { id: 48, teacher: "Dilnoza Nabijanova", sum: 270000 },
  { id: 143, teacher: "Dilnoza Nabijanova", sum: 85000 },
  { id: 213, teacher: "Dilnoza Nabijanova", sum: 185000 },
  { id: 361, teacher: "Shahlo Bahriddinova", sum: 20 },
];

const key = (v) => String(v ?? "").trim().toLowerCase();

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
    details: { script: "scripts/settle-august-share-20261011.mjs", ...details },
  });
}

if (undo) {
  if (!fs.existsSync(RECEIPT)) {
    console.log(`Kvitansiya yo'q: ${RECEIPT}`);
    process.exit(1);
  }
  const rec = JSON.parse(fs.readFileSync(RECEIPT, "utf8"));
  let n = 0;
  for (const r of rec.changed) {
    const res = await entries.updateOne({ id: r.id, "teacherShareSettled.at": rec.at }, { $unset: { teacherShareSettled: "" } });
    n += res.modifiedCount;
    console.log(`#${r.id}: ${res.modifiedCount ? "belgi olindi" : "o'zgarmadi (holat boshqa)"}`);
  }
  await audit("settle_teacher_share_undo", { entries: rec.changed.map((r) => r.id), undone: n });
  await client.close();
  process.exit(0);
}

const ok = [];
let total = 0;
for (const p of PLAN) {
  const e = await entries.findOne(
    { id: p.id },
    { projection: { _id: 0, id: 1, date: 1, createdAt: 1, txType: 1, status: 1, periodMonth: 1, teacherName: 1, studentName: 1, amount: 1, discountSom: 1, teacherShareSettled: 1 } },
  );
  const problems = [];
  if (!e) problems.push("yozuv topilmadi");
  else {
    const sum = Math.abs(Number(e.amount) || 0) + Math.abs(Number(e.discountSom) || 0);
    if (e.txType !== "payIn") problems.push(`txType ${e.txType}`);
    if (e.status === "cancelled") problems.push("bekor qilingan");
    if (e.periodMonth !== "2026-08") problems.push(`davr ${e.periodMonth ?? "yo'q"}`);
    if (key(e.teacherName) !== key(p.teacher)) problems.push(`ustoz «${e.teacherName}»`);
    if (sum !== p.sum) problems.push(`summa ${sum}`);
    const at = e.createdAt ? new Date(e.createdAt) : null;
    if (!at || Number.isNaN(at.getTime()) || at >= PAYOUT_AT) problems.push(`yozilgan ${e.createdAt ?? "?"}`);
    if (e.teacherShareSettled) problems.push("belgi allaqachon bor");
  }
  console.log(
    `#${p.id} ${e?.date ?? "?"} «${e?.studentName ?? "?"}» ${p.teacher} ${p.sum.toLocaleString("ru-RU")}` + (problems.length ? `  ✗ ${problems.join("; ")}` : "  ✓"),
  );
  if (!problems.length) {
    ok.push({ id: p.id, teacher: p.teacher, sum: p.sum, studentName: e.studentName, date: e.date });
    total += p.sum;
  }
}
console.log(`\n${ok.length}/${PLAN.length} yozuv tayyor, kirim summasi ${total.toLocaleString("ru-RU")}.`);

if (!apply) {
  console.log("Quruq yurish. Yozish uchun --apply.");
  await client.close();
  process.exit(0);
}
if (ok.length !== PLAN.length) {
  console.log("Hammasi kutilgan holatda emas — hech narsa yozilmadi.");
  await client.close();
  process.exit(1);
}
const at = new Date().toISOString();
fs.writeFileSync(RECEIPT, JSON.stringify({ at, reason: REASON, changed: ok }, null, 1), "utf8");
let written = 0;
for (const p of ok) {
  const res = await entries.updateOne(
    { id: p.id, teacherShareSettled: { $exists: false } },
    { $set: { teacherShareSettled: { at, reason: REASON } } },
  );
  written += res.modifiedCount;
  console.log(`#${p.id}: ${res.modifiedCount ? "belgilandi" : "O'ZGARMADI"}`);
}
await audit("settle_teacher_share", { entries: ok.map((p) => p.id), written, reason: REASON });
console.log(`\nYozildi: ${written}. Kvitansiya: ${RECEIPT}`);
await client.close();
