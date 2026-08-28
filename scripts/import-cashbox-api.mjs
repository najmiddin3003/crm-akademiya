// edutizim kassasini TO'LIQ import qiladi: API'dan olingan xom qatorlar +
// Excel eksportidagi ism-familiyalar.
//
//   node scripts/import-cashbox-api.mjs --json scripts/data/edutizim-cashbox-rows.json \
//        --xlsx "C:/.../cashbox (2).xlsx" --moderator "Abdulloh Raxmatullayev" [--replace] [--yes]
//
// Sukut bo'yicha QURUQ YURISH. Oldin zaxira: node scripts/_backup-db.mjs
//
// ── NEGA IKKI MANBA ───────────────────────────────────────────────────
// Excel eksporti TO'LIQ EMAS: unda faqat "qabul qilingan" ko'chirmalar va
// kategoriyali kirim/chiqimlar bor — 1941 tadan 1825 tasi. Yetishmagani:
//   • 11 ta kutilayotgan ko'chirma (hali qabul qilinmagan),
//   • 28 ta rad etilgan, 21 ta bekor qilingan ko'chirma,
//   • 56 ta (28 juft) kassa ICHIDA to'lov turlari orasidagi ko'chirish.
// Oxirgisi eng muhimi: u balansni o'zgartirmaydi, lekin TO'LOV TURLARI
// kesimini siljitadi. Ularsiz Naqd/Terminal/Plastik summalari edutizim
// ko'rsatgan raqamlarga mos kelmasdi (Korporativ karta hatto manfiy
// chiqardi). Ular bilan — tiyinigacha mos tushadi.
//
// API esa ism saqlamaydi: 39 ta kirimning HECH BIRIDA ustoz, 145 ta
// chiqimning hech birida xodim ko'rsatilmagan. Excelda esa bor. Shuning
// uchun ikkalasi (vaqt + summa bo'yicha) birlashtiriladi — aks holda
// o'qituvchi foizi va xodim avansi egasiz qolib, oylik hisobi buzilardi.
//
// ── VAQT MINTAQASI ────────────────────────────────────────────────────
// API `at` ni UTC beradi, edutizim ekranda +05:00 ko'rsatadi. Bazaga
// KO'RINADIGAN vaqt (+05:00) yoziladi — chunki `date`/`time` maydonlari
// interfeys uchun. Aniq lahza esa `createdAt` da UTC bo'lib qoladi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { MongoClient } from "mongodb";

const HERE = path.dirname(fileURLToPath(import.meta.url));
for (const l of fs.readFileSync(path.join(HERE, "..", ".env.local"), "utf8").split("\n")) {
  const s = l.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? String(argv[i + 1] ?? "").trim() : ""; };
const JSON_PATH = arg("--json");
const XLSX_PATH = arg("--xlsx");
const MODERATOR = arg("--moderator");
const APPLY = argv.includes("--yes");
const REPLACE = argv.includes("--replace");
if (!JSON_PATH || !MODERATOR) {
  console.error('Foydalanish: node scripts/import-cashbox-api.mjs --json <fayl.json> [--xlsx <fayl.xlsx>] --moderator "Ism" [--replace] [--yes]');
  process.exit(1);
}

const fmt = (n) => Math.round(n).toLocaleString("ru-RU");
const norm = (v) => String(v ?? "").replace(/[’ʻʼ`']/g, "'").replace(/\s+/g, " ").trim();
const nkey = (v) => norm(v).toLowerCase();
const t = (r, i) => String(r?.[i] ?? "").trim();
const num = (v) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };

/** UTC ISO -> ko'rinadigan +05:00 sana/vaqt. */
function local(iso) {
  const d = new Date(iso);
  const s = new Date(d.getTime() + 5 * 3600 * 1000).toISOString();
  return { date: s.slice(0, 10), time: s.slice(11, 16), key: s.slice(0, 16) };
}

// ─────────────── Exceldan ism lug'ati (vaqt+summa -> odam) ───────────────
const people = new Map();
if (XLSX_PATH) {
  const wb = XLSX.readFile(XLSX_PATH);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  const SEC = { "Student Bilan": { amt: 5, time: 9, who: 2, teacher: 7 }, "Hodim Bilan": { amt: 5, time: 7, who: 2 }, "Boshqa": { amt: 5, time: 7, who: 2 } };
  let cur = null;
  for (const r of rows) {
    const c1 = t(r, 1);
    if (SEC[c1] && r.filter((x) => String(x).trim() !== "").length === 1) { cur = c1; continue; }
    if (!cur || !SEC[cur] || /^-+$/.test(c1) || c1 === "Type" || c1 === "Kassadan") continue;
    const L = SEC[cur];
    const tm = t(r, L.time).replace(" ", "T").slice(0, 16);
    const a = num(t(r, L.amt));
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(tm) || !a) continue;
    // NAVBAT, bitta qiymat emas. Bazada 5 juft holat bor: ikki XODIM
    // bir xil daqiqada bir xil summa olgan (masalan 2026-03-31 08:36 da
    // Abdushukur ham, Umidjon ham 216 000). Bitta qiymat saqlansa
    // ikkalasiga ham oxirgi ism tegib, biri noto'g'ri, ikkinchisi
    // egasiz qolardi. Navbat bilan har bir API qatori o'z ismini oladi.
    // Summalar teng bo'lgani uchun tartib almashsa ham har bir xodimning
    // yig'indisi to'g'ri chiqadi.
    const key = `${tm}|${a}`;
    if (!people.has(key)) people.set(key, []);
    people.get(key).push({ person: norm(t(r, L.who)), teacher: L.teacher ? norm(t(r, L.teacher)) : "" });
  }
}

// ─────────────────────────── Xom qatorlar ───────────────────────────
const src = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
const CASHBOX_NAME = src.cashbox;
console.log(`Manba   : ${JSON_PATH} (${src.rows.length} qator)`);
if (XLSX_PATH) console.log(`Ismlar  : ${XLSX_PATH} (${people.size} ta yozuv)`);
console.log(`Kassa   : "${CASHBOX_NAME}" · moderator ${MODERATOR}`);
console.log(APPLY ? "\nIMPORT QILINADI\n" : "\nQURUQ YURISH — bazaga hech narsa yozilmaydi\n");

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB);
const methods = await db.collection("settings_payment_methods").find({}).toArray();
const ALIAS = { "karparativ karta": "korporativ karta" };
const byName = new Map(methods.map((m) => [nkey(m.name), m]));
const resolveMethod = (raw) => { const k = nkey(raw); return byName.get(ALIAS[k] ?? k) ?? byName.get(k) ?? null; };

const STATE = { "": "", accepted: "", waiting: "waiting", rejected: "cancelled", cancelled: "cancelled" };
const entries = [];
const problems = [];
let matchedNames = 0;

for (const r of src.rows) {
  const m = resolveMethod(r.method);
  if (!m) { problems.push(`${r.id}: to'lov turi "${r.method}" ro'yxatda yo'q`); continue; }
  if (!(r.state in STATE)) { problems.push(`${r.id}: noma'lum holat "${r.state}"`); continue; }
  const when = local(r.at);
  // Navbatdan BITTA ism olinadi va qaytarilmaydi — ikki xodim bir xil
  // daqiqada bir xil summa olgan holatda har biri o'zinikini oladi.
  //
  // Ismni FAQAT ism kutadigan yozuv oladi (kategoriyali kirim/chiqim).
  // Aks holda o'sha daqiqada tasodifan bir xil summali ko'chirma navbatdan
  // ismni o'g'irlab ketib, haqiqiy egasi ismsiz qolardi.
  const wantsName = r.type !== "transfer" && !!r.category;
  const queue = wantsName ? people.get(`${when.key}|${r.amount}`) : null;
  const hit = queue && queue.length ? queue.shift() : null;
  if (hit) matchedNames++;

  let txType, txName, studentName = "", teacherName = "", amount;

  if (r.type === "transfer") {
    txType = "transfer";
    txName = `Ko'chirish: ${r.fromCashbox} -> ${r.toCashbox}`;
    amount = r.incoming ? r.amount : -r.amount;
  } else if (!r.category) {
    // Kategoriyasiz kirim/chiqim — kassa ICHIDA to'lov turlari orasidagi
    // ko'chirish (28 juft, jami nolga teng). `transfer` bo'lishi SHART:
    // aks holda 172,8 mln so'm soxta daromad/xarajat bo'lib hisobotlarga
    // tushardi. Turi esa methodTotals'ni to'g'ri siljitadi.
    txType = "transfer";
    txName = "Ko'chirish: to'lov turlari orasida";
    amount = r.type === "payIn" ? r.amount : -r.amount;
  } else if (r.type === "payIn") {
    txType = "payIn";
    txName = nkey(r.category) === "o'quvchi to'ladi" ? "o'quvchi to'ladi" : r.category;
    studentName = r.student || hit?.person || "";
    // Ustoz — foizli oylikning asosi (lib/payrollSources.ts).
    teacherName = r.teacher || hit?.teacher || "";
    amount = r.amount;
  } else {
    txType = "payOut";
    txName = /avans/i.test(r.category) ? "xodimga avans" : /oylik/i.test(r.category) ? "xodimga oylik" : r.category;
    studentName = r.employee || hit?.person || "";
    if (/avans|oylik/i.test(txName)) teacherName = studentName;
    amount = -r.amount;
  }

  entries.push({
    date: when.date, time: when.time, createdAt: r.at,
    studentName, amount,
    txType, txName,
    paymentType: m.name, paymentMethodKey: m.key,
    group: "", lessonDate: "", teacherName,
    reason: "-", note: norm(r.comment),
    status: STATE[r.state],
    edutizimId: r.id,
  });
}

if (problems.length) {
  console.error(`\n❌ ${problems.length} ta muammoli qator — TO'XTATILDI:`);
  for (const p of problems.slice(0, 20)) console.error("   " + p);
  await client.close(); process.exit(1);
}

entries.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));

const live = entries.filter((e) => e.status === "");
const balance = live.reduce((s, e) => s + e.amount, 0);
const totals = Object.fromEntries(methods.map((m) => [m.key, 0]));
for (const e of live) totals[e.paymentMethodKey] += e.amount;

console.log(`Ismlar mos keldi: ${matchedNames} ta qatorga Exceldan ism biriktirildi`);
console.log("\nYozuv turlari:");
for (const [k, v] of Object.entries(entries.reduce((m, e) => (m[e.txType] = (m[e.txType] ?? 0) + 1, m), {}))) console.log(`  ${k.padEnd(10)} ${String(v).padStart(5)}`);
console.log("\nHolatlar:");
for (const [k, v] of Object.entries(entries.reduce((m, e) => (m[e.status || "(faol)"] = (m[e.status || "(faol)"] ?? 0) + 1, m), {}))) console.log(`  ${k.padEnd(10)} ${String(v).padStart(5)}`);
console.log(`\nHisoblangan qoldiq: ${fmt(balance)}`);
console.log("To'lov turi bo'yicha:");
for (const m of methods) console.log(`  ${m.name.padEnd(18)} ${fmt(totals[m.key]).padStart(16)}`);

const cashCol = db.collection("cashboxes");
const entCol = db.collection("transaction_entries");
const txCol = db.collection("transactions");
let cashbox = await cashCol.findOne({ name: CASHBOX_NAME });
const taken = await cashCol.findOne({ moderator: MODERATOR, name: { $ne: CASHBOX_NAME } });
if (taken) { console.error(`\n❌ "${MODERATOR}" allaqachon "${taken.name}" kassasiga biriktirilgan.`); await client.close(); process.exit(1); }

const existing = cashbox ? await entCol.countDocuments({ cashboxId: cashbox.id }) : 0;
console.log(`\nKassa: ${cashbox ? `bor (id=${cashbox.id}), hozir ${existing} ta yozuv` : "yangi yaratiladi"}`);
if (existing > 0 && !REPLACE) {
  console.error("❌ Kassada yozuv bor. Almashtirish uchun --replace qo'shing.");
  await client.close(); process.exit(1);
}
if (existing > 0) console.log(`   --replace: eski ${existing} ta yozuv o'chiriladi va ${entries.length} tasi yoziladi`);

const typeCol = db.collection("transaction_types");
const have = new Set((await typeCol.find({}).toArray()).map((x) => nkey(x.name)));
const newTypes = [...new Set(entries.filter((e) => e.txType === "payOut").map((e) => e.txName))].filter((n) => !have.has(nkey(n)));
if (newTypes.length) console.log(`Yangi tranzaksiya turi: ${newTypes.join(", ")}`);

const txCount = live.filter((e) => e.txType !== "transfer").length;
console.log(`\nYoziladi: ${entries.length} -> transaction_entries · ${txCount} -> transactions · 0 -> sync_outbox`);

if (!APPLY) { await client.close(); console.log("\n--yes qo'shsangiz haqiqatan import qilinadi."); process.exit(0); }

if (!cashbox) {
  const last = await cashCol.find({}).sort({ id: -1 }).limit(1).toArray();
  cashbox = { id: (last[0]?.id ?? 0) + 1, name: CASHBOX_NAME, balance: 0, moderator: MODERATOR, onlinePayment: false, archived: false, isPrimary: false, methodTotals: Object.fromEntries(methods.map((m) => [m.key, 0])) };
  await cashCol.insertOne({ ...cashbox });
}
if (existing > 0) {
  await entCol.deleteMany({ cashboxId: cashbox.id });
  await txCol.deleteMany({ cashboxId: cashbox.id });
}
if (newTypes.length) {
  const lastT = await typeCol.find({}).sort({ id: -1 }).limit(1).toArray();
  let tid = (lastT[0]?.id ?? 0) + 1;
  await typeCol.insertMany(newTypes.map((name) => ({ id: tid++, name, minAmount: 0, maxAmount: 0, customerType: "Boshqa", mainType: "chiqim", category: "Chiqim" })));
}

const lastE = await entCol.find({}).sort({ id: -1 }).limit(1).toArray();
let eid = (lastE[0]?.id ?? 0) + 1;
const lastTx = await txCol.find({}).sort({ id: -1 }).limit(1).toArray();
let txid = (lastTx[0]?.id ?? 0) + 1;

// before/after — shu kassa+to'lov turi juftligining yugurib boruvchi qoldig'i.
// Faol bo'lmagan (kutilmoqda / bekor) yozuv qoldiqni o'zgartirmaydi.
const running = Object.fromEntries(methods.map((m) => [m.key, 0]));
const entDocs = [], txDocs = [];
for (const e of entries) {
  const before = running[e.paymentMethodKey];
  const after = e.status === "" ? before + e.amount : before;
  if (e.status === "") running[e.paymentMethodKey] = after;
  entDocs.push({ id: eid++, ...e, before, after, moderator: MODERATOR, cashboxId: cashbox.id });
  if (e.txType !== "transfer" && e.status === "") {
    txDocs.push({ id: txid++, date: e.date, time: e.time, amount: e.amount, category: e.txName, method: e.paymentMethodKey, methodLabel: e.paymentType, cashboxId: cashbox.id });
  }
}
for (let i = 0; i < entDocs.length; i += 500) await entCol.insertMany(entDocs.slice(i, i + 500));
for (let i = 0; i < txDocs.length; i += 500) await txCol.insertMany(txDocs.slice(i, i + 500));
await cashCol.updateOne({ id: cashbox.id }, { $set: { balance, methodTotals: totals } });

console.log("\n— Tekshiruv (bazadan qayta o'qib) —");
const c = await cashCol.findOne({ id: cashbox.id });
const agg = await entCol.aggregate([{ $match: { cashboxId: cashbox.id, status: "" } }, { $group: { _id: null, s: { $sum: "$amount" } } }]).toArray();
let ok = true;
const check = (l, got, want) => { const g = Math.round(got) === Math.round(want); if (!g) ok = false; console.log(`  ${g ? "✓" : "✗"} ${l}: ${fmt(got)}${g ? "" : ` (kutilgan ${fmt(want)})`}`); };
check("yozuvlar soni", await entCol.countDocuments({ cashboxId: cashbox.id }), entries.length);
check("hisobot yozuvlari", await txCol.countDocuments({ cashboxId: cashbox.id }), txDocs.length);
check("yozuvlar yig'indisi", agg[0]?.s ?? 0, balance);
check("kassa balansi", c.balance, balance);
check("methodTotals yig'indisi", Object.values(c.methodTotals).reduce((s, v) => s + v, 0), balance);
check("sync_outbox bo'sh", await db.collection("sync_outbox").countDocuments(), 0);
console.log(ok ? "\n✓ Import tugadi va tekshiruvdan o'tdi." : "\n✗ Nomuvofiqlik bor.");
await client.close();
