// 12.09.2026 (shanba) — filial 1 (Nilufar) kunlik ishini Google Sheet
// qatorlaridan prod (VPS) bazasiga tiklash.
//
//   node scripts/_import-sheet-rows-20260912.mjs [rows.json]            # quruq yurish
//   node scripts/_import-sheet-rows-20260912.mjs [rows.json] --apply    # yozadi
//
// NIMA BO'LGAN: Nilufar 12.09 da (prod VPS'ga ko'chgan kun) hali Vercel
// orqali Atlas'ga yozgan (id 357–376, 20 ta yozuv); o'sha kechasi zaxira
// ko'zgusi Atlas'ni VPS nusxasi bilan `--drop` qilib ULARNI O'CHIRGAN.
// Hech qaysi bazada yo'q. Iz faqat Google Sheet'da qolgan: Sheets qatori
// yozuv id'si bilan yoziladi, VPS o'sha id'larni o'z yozuvlariga bergani
// uchun bir xil turdagi qatorlar ustidan yozilgan (357, 360, 367, 368,
// 369, 371 — bular ham ko'rinib turibdi, chunki VPS'niki ERTAROQ yozilgan
// va kechki solishtirish hali tiklamagan), boshqa turdagilar esa o'z
// varag'ida yetim bo'lib qolgan. Ikkitasi tiklanmadi: #362 (xarajat) va
// #370 (avans) — varaqda VPS mazmuni bilan ustidan yozilgan va 13.09 03:00
// solishtirish VPS'nikini qaytargan. Ular qo'lda kiritiladi.
//
// MANBA: scripts/data/sheet-rows-2026-09-12.json (scripts/_sheets-rows.mjs
// chiqargan, 12.09 sanali barcha qatorlar). Bu yerdan faqat Nilufar
// kassasiga tegishli qatorlar olinadi; ko'chirmaning "Kirim" (rahbar
// kassa) tomoni chiquvchi qatordan qayta tuziladi (#373 varaqda yo'q).
//
// QOIDALAR (14.09 ko'chirishi bilan bir xil, scripts/_merge-atlas-20260914.mjs):
//   • yangi id = max+1, Atlas tartibida; asl id `migratedFrom` da;
//   • `before/after` VPS kassa qoldig'idan (kiritish tartibida) hisoblanadi,
//     kassa 4 har yozuvdan keyin `$inc` (ilova qanday qilsa shunday);
//   • ko'chirma: `status: "waiting"`, `deductedOnSend: false` — pul kassada
//     turadi, rahbar ✓ bosganda o'tadi (app/api/cashboxes/[id]/transfer-to);
//   • navbat: Telegram 12.09 da Atlas'dan ketgan — qayta yuborilmaydi
//     (`telegramDone: true`, messageId noma'lum); Sheets qatori yangi id
//     bilan qo'shiladi (`sheetDone: false`);
//   • `createdAt` — 12.09 dagi haqiqiy vaqt (Toshkent → UTC), navbat va
//     "oxirgi topshiruvdan beri" hisoblari uchun.
// Idempotent: `migratedFrom.source + id` bo'yicha bor yozuv qayta yozilmaydi.
import fs from "fs";
import { MongoClient } from "mongodb";

const APPLY = process.argv.includes("--apply");
const rowsPath = process.argv.find((a) => a.endsWith(".json")) || "/var/www/crm/shared/sheet-rows-2026-09-12.json";
const SOURCE = "sheet-2026-09-12";
const CASHBOX = 4;
const PRIMARY = 3;
const DATE = "2026-09-12";
const MODERATOR = "Nilufar Sharipova";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
if (/mongodb\.net/.test(env.MONGODB_URI)) {
  console.error("MONGODB_URI Atlas'ga qaragan — bu skript faqat VPS (prod) bazasi uchun."); process.exit(1);
}

const { rows } = JSON.parse(fs.readFileSync(rowsPath, "utf8"));
const money = (s) => Number(String(s).replace(/[^\d.-]/g, "")) || 0;
const dash = (s) => (String(s ?? "").trim() === "—" ? "" : String(s ?? "").trim());
// Izohdan oy: "sentabr" → 2026-09, "avgust" → 2026-08; boshqasi yozilmaydi
// (oylik hisobi yozuv sanasining oyiga tayanadi, lib/payrollSources.ts).
const periodOf = (note) => (/sentabr/i.test(note) ? "2026-09" : /avgust/i.test(note) ? "2026-08" : null);
const isoAt = (time) => new Date(`${DATE}T${time}:00+05:00`).toISOString();

// ── Varaq qatorlari → yozuvlar (Atlas id bilan) ──
const items = [];
for (const r of rows) {
  const c = r.cells;
  const atlasId = Number(c[0]);
  if (r.tab === "To'lovlar" && c[10] === MODERATOR) {
    items.push({ atlasId, row: r.row, kind: "payIn", time: c[2], studentName: dash(c[3]), teacherName: dash(c[5]), txName: c[6], amount: money(c[7]), methodLabel: c[8], note: dash(c[12]) });
  } else if (r.tab === "Xodim avanslari" && c[10] === MODERATOR) {
    items.push({ atlasId, row: r.row, kind: "payOut", time: c[2], studentName: dash(c[3]), teacherName: dash(c[3]), txName: c[6], amount: -money(c[7]), methodLabel: c[8], note: dash(c[11]) });
  } else if (r.tab === "Xarajatlar" && c[8] === MODERATOR) {
    items.push({ atlasId, row: r.row, kind: "payOut", time: c[2], studentName: dash(c[3]), teacherName: "", txName: c[4], amount: -money(c[5]), methodLabel: c[6], note: dash(c[9]) });
  } else if (r.tab === "Ko'chirmalar" && c[3] === "Chiqim" && c[8] === MODERATOR) {
    items.push({ atlasId, row: r.row, kind: "transfer", time: c[2], txName: c[4], amount: money(c[5]), methodLabel: c[6], note: dash(c[9]), status: c[10] });
  }
}
items.sort((a, b) => a.atlasId - b.atlasId);
if (!items.length) { console.error("Nilufar qatorlari topilmadi"); process.exit(1); }
const known = new Set(items.map((i) => i.atlasId));
const missing = [];
for (let id = items[0].atlasId; id <= items.at(-1).atlasId; id += 1) {
  // Ko'chirmaning "Kirim" tomoni (id+1) chiquvchidan tuziladi — yo'q sanalmaydi.
  if (!known.has(id) && !(known.has(id - 1) && items.find((i) => i.atlasId === id - 1)?.kind === "transfer")) missing.push(id);
}

const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await c.connect();
const db = c.db(env.MONGODB_DB);
const maxId = async (name) => Number((await db.collection(name).find({}).sort({ id: -1 }).limit(1).toArray())[0]?.id) || 0;

console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===");
console.log("manba:", rowsPath, "| qatorlar:", rows.length, "| Nilufar yozuvlari:", items.length, "| tiklanmagan id'lar:", missing.join(", ") || "yo'q");

// Idempotentlik — bu manbadan allaqachon kirgan Atlas id'lar.
const done = new Set((await db.collection("transaction_entries").find({ "migratedFrom.source": SOURCE }, { projection: { _id: 0, "migratedFrom.id": 1 } }).toArray()).map((d) => d.migratedFrom.id));
const todo = items.filter((i) => !done.has(i.atlasId));
if (done.size) console.log("allaqachon kirgan:", [...done].sort((a, b) => a - b).join(", "));
if (!todo.length) { console.log("Yangi yozuv yo'q."); await c.close(); process.exit(0); }

// To'lov turlari — Sozlamalardan (nom → kalit).
const methods = await db.collection("settings_payment_methods").find({}).toArray();
const keyOf = (label) => methods.find((m) => m.name === label)?.key;
for (const i of todo) if (!keyOf(i.methodLabel)) { console.error(`To'lov turi topilmadi: "${i.methodLabel}" (#${i.atlasId})`); process.exit(1); }

const box = await db.collection("cashboxes").findOne({ id: CASHBOX });
const primary = await db.collection("cashboxes").findOne({ id: PRIMARY });
if (!box || !primary) { console.error("Kassa topilmadi"); process.exit(1); }
console.log(`\nKassa 4 hozir: balance ${box.balance}, ${JSON.stringify(box.methodTotals)}`);

// Ismlar bazada bormi (faqat ogohlantirish — yozuv ism bilan ishlaydi).
const pupilNames = new Set((await db.collection("pupils").find({}, { projection: { _id: 0, firstName: 1, lastName: 1 } }).toArray()).map((p) => `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()));
const empNames = new Set((await db.collection("hr_employees").find({}, { projection: { _id: 0, name: 1 } }).toArray()).map((e) => e.name));
for (const i of todo) {
  if (i.kind === "payIn" && i.studentName && !pupilNames.has(i.studentName)) console.log(`  ! o'quvchi bazada yo'q: ${i.studentName} (#${i.atlasId}) — 12.09 da Atlas'da yaratilgan bo'lishi mumkin`);
  if (i.kind === "payOut" && i.studentName && !empNames.has(i.studentName)) console.log(`  ! xodim bazada yo'q: ${i.studentName} (#${i.atlasId})`);
  if (i.kind === "payIn" && i.teacherName && !empNames.has(i.teacherName)) console.log(`  ! ustoz bazada yo'q: ${i.teacherName} (#${i.atlasId})`);
}

// ── Reja: yangi id'lar, before/after, kassa yig'indisi ──
let nextId = (await maxId("transaction_entries")) + 1;
let nextTx = (await maxId("transactions")) + 1;
const running = { ...(box.methodTotals ?? {}) };
const incByMethod = {};
let incBalance = 0;
const plan = [];
for (const i of todo) {
  const key = keyOf(i.methodLabel);
  if (i.kind === "transfer") {
    const outId = nextId; nextId += 2;
    plan.push({ ...i, key, outId, inId: outId + 1, before: Number(running[key] ?? 0), beforeIn: Number(primary.methodTotals?.[key] ?? 0) });
    continue;
  }
  const before = Number(running[key] ?? 0);
  const after = before + i.amount;
  if (after < 0) { console.error(`MANFIY: #${i.atlasId} (${key}) ${before} + ${i.amount} = ${after}`); process.exit(1); }
  running[key] = after;
  incByMethod[key] = (incByMethod[key] ?? 0) + i.amount;
  incBalance += i.amount;
  plan.push({ ...i, key, newId: nextId, txId: nextTx, before, after });
  nextId += 1; nextTx += 1;
}
console.log("\nKassa 4 ga qo'shiladi:", JSON.stringify(incByMethod), "| balans +" + incBalance, "→", box.balance + incBalance);
console.log("Kutilayotgan ko'chirma (rahbar tasdiqlaydi):", plan.filter((p) => p.kind === "transfer").map((p) => `${p.amount} ${p.key}`).join(", ") || "yo'q");
console.log("\n#Atlas → #VPS | vaqt | tur | kim | summa | tur | before→after | izoh");
for (const p of plan) {
  if (p.kind === "transfer") console.log(`  ${p.atlasId}(+${p.atlasId + 1}) → ${p.outId}(+${p.inId}) | ${p.time} | transfer → Raxbar | ${p.amount} | ${p.key} | ${p.before}→(kutilmoqda) | ${p.note}`);
  else console.log(`  ${p.atlasId} → ${p.newId} | ${p.time} | ${p.kind} ${p.txName} | ${p.studentName || "-"}${p.teacherName && p.kind === "payIn" ? " (ustoz " + p.teacherName + ")" : ""} | ${p.amount} | ${p.key} | ${p.before}→${p.after} | ${p.note}`);
}
if (missing.length) console.log(`\nDIQQAT: Atlas #${missing.join(", #")} varaqdan tiklanmadi — qo'lda kiritiladi (sana 12.09.2026).`);

if (!APPLY) { console.log("\nHech narsa yozilmadi. Qo'llash uchun: --apply"); await c.close(); process.exit(0); }

// ── YOZISH ──
const stamp = { source: SOURCE, at: new Date().toISOString() };
const entries = db.collection("transaction_entries");
const common = (p) => ({ date: DATE, time: p.time, group: "", lessonDate: "", moderator: MODERATOR, reason: "-", note: p.note, paymentType: p.methodLabel, paymentMethodKey: p.key, createdAt: isoAt(p.time) });
const outbox = (kind, entryId, notifyTelegram, createdAt) => ({
  kind, entryId, event: "created", notifyTelegram, status: "pending", sheetDone: false, telegramDone: true,
  messageId: null, attempts: 0, lastError: null, nextAttemptAt: null, createdAt, updatedAt: new Date().toISOString(), doneAt: null,
  migratedFrom: { ...stamp },
});
let n = 0;
for (const p of plan) {
  if (p.kind === "transfer") {
    const base = { ...common(p), studentName: "", after: null, txType: "transfer", txName: p.txName, status: "waiting" };
    await entries.insertOne({ ...base, id: p.outId, amount: -p.amount, before: p.before, cashboxId: CASHBOX, transferRole: "out", transferId: p.outId, deductedOnSend: false, migratedFrom: { ...stamp, id: p.atlasId, row: p.row } });
    await entries.insertOne({ ...base, id: p.inId, amount: p.amount, before: p.beforeIn, cashboxId: PRIMARY, moderator: primary.moderator || "", transferRole: "in", transferId: p.outId, migratedFrom: { ...stamp, id: p.atlasId + 1, row: null } });
    await db.collection("sync_outbox").insertMany([outbox("transfer", p.outId, false, base.createdAt), outbox("transfer", p.inId, false, base.createdAt)]);
    n += 2;
    continue;
  }
  const isSalary = p.kind === "payOut" && /oylik|avans/i.test(p.txName);
  const period = p.kind === "payIn" && p.txName !== "Kitob sotuvi" ? periodOf(p.note) : null;
  await entries.insertOne({
    ...common(p), id: p.newId, studentName: p.studentName, amount: p.amount, before: p.before, after: p.after,
    txType: p.kind, txName: p.txName, teacherName: p.teacherName, status: "", cashboxId: CASHBOX,
    ...(period ? { periodMonth: period } : {}),
    migratedFrom: { ...stamp, id: p.atlasId, row: p.row },
  });
  await db.collection("cashboxes").updateOne({ id: CASHBOX }, { $inc: { [`methodTotals.${p.key}`]: p.amount, balance: p.amount } });
  await db.collection("transactions").insertOne({ id: p.txId, date: DATE, time: p.time, amount: p.amount, category: p.txName, method: p.key, methodLabel: p.methodLabel, cashboxId: CASHBOX, migratedFrom: { ...stamp, id: p.atlasId } });
  const kind = p.kind === "payIn" ? "payment" : isSalary ? "salary" : "expense";
  await db.collection("sync_outbox").insertOne(outbox(kind, p.newId, kind === "payment", common(p).createdAt));
  n += 1;
}
console.log("\njurnal yozildi:", n);
const boxAfter = await db.collection("cashboxes").findOne({ id: CASHBOX }, { projection: { _id: 0, balance: 1, methodTotals: 1 } });
console.log("Kassa 4 endi:", JSON.stringify(boxAfter));
await c.close();
