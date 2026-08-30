// UCHDAN-UCHIGACHA SINOV — jonli bazaga bitta kirim va bitta chiqim
// qo'shib, ularning o'qituvchi oyligiga, Google Sheets'ga va Telegram'ga
// yetib borishini tekshiradi.
//
//   node scripts/_e2e-smoke-test.mjs <dev-url> --run
//   node scripts/_e2e-smoke-test.mjs <dev-url> --rollback
//
// Yaratilgan yozuvlar `scripts/data/_e2e-state.json` ga yoziladi —
// orqaga qaytarish TAXMIN QILMAYDI, aynan o'sha id'larni o'chiradi.
//
// NEGA HAQIQIY ENDPOINT: to'g'ridan-to'g'ri Mongo'ga yozish `logEntry`
// ni chetlab o'tardi, ya'ni navbat ham, Sheets ham, Telegram ham
// ishlamasdi — sinov hech narsani isbotlamagan bo'lardi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSign } from "node:crypto";
import { MongoClient } from "mongodb";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
for (const l of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const s = l.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const MODE = process.argv.includes("--rollback") ? "rollback" : process.argv.includes("--run") ? "run" : "";
if (!MODE) { console.error("--run yoki --rollback kerak"); process.exit(1); }
const STATE = path.join(HERE, "data", "_e2e-state.json");

// ── Sinov parametrlari ───────────────────────────────────────────────
// Kassa 3: naqd qoldig'i eng katta, chiqim uchun yetarli.
// Shoxsanam Obidova: 50% foizli o'qituvchi, bu oy avans OLMAGAN —
//   ya'ni "oldin/keyin" farqi aralashmasdan ko'rinadi.
// 1000 so'm: hisobi aniq (50% -> 500), lekin hisobotlarga sezilarli
//   ta'sir qilmaydi.
const CASHBOX = 3;
const METHOD = "naqd";
const TEACHER = "Shoxsanam Obidova";
const AMOUNT = 1000;
const MONTH = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 7);
const TAG = "SINOV — o'chiriladi";

const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 });
await client.connect();
const db = client.db(process.env.MONGODB_DB);
const te = db.collection("transaction_entries");
const txs = db.collection("transactions");
const ob = db.collection("sync_outbox");
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("ru-RU");

// ── Google Sheets (faqat o'qish / qator o'chirish) ────────────────────
const normKey = (raw) => {
  let k = (raw || "").trim();
  if (k.startsWith('"') && k.endsWith('"')) k = k.slice(1, -1);
  return k.replace(/\\n/g, "\n");
};
const b64 = (v) => Buffer.from(v).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const nowSec = Math.floor(Date.now() / 1000);
const jwtInput = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify({
  iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
  scope: "https://www.googleapis.com/auth/spreadsheets",
  aud: "https://oauth2.googleapis.com/token", iat: nowSec, exp: nowSec + 3600,
}))}`;
const sg = createSign("RSA-SHA256");
sg.update(jwtInput);
sg.end();
const { access_token } = await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${jwtInput}.${b64(sg.sign(normKey(process.env.GOOGLE_PRIVATE_KEY)))}`,
  }),
})).json();
const SHEET = process.env.SHEET_ID_PAYMENTS.trim();
const gapi = async (m, u, b) => {
  const r = await fetch(u, {
    method: m,
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: b ? JSON.stringify(b) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
  return j;
};
/** Qatorni ID ustuni bo'yicha topadi. Topilmasa null. */
const sheetRowOf = async (tab, id) => {
  const col = await gapi("GET", `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/${encodeURIComponent(`${tab}!A2:A`)}?valueRenderOption=UNFORMATTED_VALUE`);
  const idx = (col.values ?? []).map((r) => Number(r[0])).indexOf(id);
  return idx < 0 ? null : idx + 2;
};
const sheetRowValues = async (tab, row) => {
  const r = await gapi("GET", `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/${encodeURIComponent(`${tab}!A${row}:O${row}`)}`);
  return r.values?.[0] ?? [];
};

const tg = async (method, params) => {
  const u = new URL(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN.trim()}/${method}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return (await u && fetch(u).then((r) => r.json()));
};

const api = async (p, opts) => {
  const r = await fetch(`${BASE}${p}`, opts);
  const j = await r.json();
  return { status: r.status, j };
};

/** Navbat shu yozuv uchun tugagunicha kutadi. */
async function waitDelivered(kind, entryId, label) {
  for (let i = 0; i < 30; i += 1) {
    const t = await ob.findOne({ kind, entryId, event: "created" });
    if (t?.status === "done") return t;
    if (t?.status === "failed") return t;
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log(`   ⚠️  ${label}: navbat 60 s ichida tugamadi`);
  return await ob.findOne({ kind, entryId, event: "created" });
}

const payrollOf = async (name) => {
  const { j } = await api("/api/salary-runs/employees-payroll");
  const list = j.employees ?? j.rows ?? j.data ?? [];
  return list.find((e) => String(e.name ?? e.fullName ?? "").trim() === name) ?? null;
};

// ─────────────────────────── ROLLBACK ───────────────────────────
if (MODE === "rollback") {
  if (!fs.existsSync(STATE)) { console.error("holat fayli yo'q — o'chiradigan narsa topilmadi"); process.exit(1); }
  const st = JSON.parse(fs.readFileSync(STATE, "utf8"));
  console.log("ORQAGA QAYTARISH\n");

  for (const step of st.steps) {
    console.log(`  ${step.label} (entry id=${step.entryId})`);
    // 1) Google Sheets qatori. Reconcile bazada yo'q qatorni O'CHIRMAYDI
    //    (faqat "begona" deb sanaydi), shuning uchun qo'lda olib tashlanadi.
    const row = await sheetRowOf(step.tab, step.entryId);
    if (row) {
      const meta = await gapi("GET", `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}?fields=sheets(properties(sheetId,title))`);
      const sid = meta.sheets.find((s) => s.properties.title === step.tab).properties.sheetId;
      await gapi("POST", `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}:batchUpdate`, {
        requests: [{ deleteDimension: { range: { sheetId: sid, dimension: "ROWS", startIndex: row - 1, endIndex: row } } }],
      });
      console.log(`    ✓ jadval qatori ${step.tab}!${row} o'chirildi`);
    } else console.log("    · jadvalda qator topilmadi");

    // 2) Telegram xabari.
    const task = await ob.findOne({ kind: step.kind, entryId: step.entryId, event: "created" });
    if (task?.messageId) {
      const chat = (step.kind === "payment" ? process.env.TELEGRAM_CHAT_PAYMENTS : process.env.TELEGRAM_CHAT_SALARIES).trim();
      const d = await tg("deleteMessage", { chat_id: chat, message_id: task.messageId });
      console.log(`    ${d.ok ? "✓" : "✗"} Telegram xabari #${task.messageId}${d.ok ? " o'chirildi" : ` — ${d.description}`}`);
    } else console.log("    · Telegram xabari yo'q");

    // 3) Navbat, hisobot yozuvi, tranzaksiya.
    await ob.deleteMany({ entryId: step.entryId });
    if (step.txId) await txs.deleteOne({ id: step.txId });
    await te.deleteOne({ id: step.entryId });
    console.log("    ✓ baza yozuvlari o'chirildi");
  }

  // 4) Kassa balansi. adjust `$inc` qilgan edi — teskarisini qo'llaymiz.
  const back = -st.steps.reduce((s, x) => s + x.signedAmount, 0);
  await db.collection("cashboxes").updateOne({ id: CASHBOX }, { $inc: { [`methodTotals.${METHOD}`]: back, balance: back } });
  const cb = await db.collection("cashboxes").findOne({ id: CASHBOX });
  console.log(`\n  ✓ kassa tiklandi: balans=${fmt(cb.balance)} naqd=${fmt(cb.methodTotals[METHOD])}`);

  const ok = cb.balance === st.before.balance && cb.methodTotals[METHOD] === st.before.method;
  console.log(`  ${ok ? "✓" : "✗"} boshlang'ich holat bilan mos (kutilgan balans=${fmt(st.before.balance)} naqd=${fmt(st.before.method)})`);
  console.log(`  navbatda qoldi: ${await ob.countDocuments()}`);
  fs.unlinkSync(STATE);
  await client.close();
  process.exit(ok ? 0 : 1);
}

// ─────────────────────────── RUN ───────────────────────────
console.log("UCHDAN-UCHIGACHA SINOV\n");
console.log(`  server   : ${BASE}`);
console.log(`  kassa    : ${CASHBOX} · ${METHOD} · ${fmt(AMOUNT)} so'm`);
console.log(`  o'qituvchi: ${TEACHER}\n`);

// Birinchi so'rov indekslarni quradi — o'lchovga aralashmasin.
process.stdout.write("Serverni isitish… ");
await api(`/api/employee-salary-summary?name=${encodeURIComponent(TEACHER)}&month=${MONTH}`);
console.log("tayyor\n");

const cbBefore = await db.collection("cashboxes").findOne({ id: CASHBOX });
const before = {
  balance: cbBefore.balance,
  method: cbBefore.methodTotals[METHOD],
  payroll: await payrollOf(TEACHER),
  summary: (await api(`/api/employee-salary-summary?name=${encodeURIComponent(TEACHER)}&month=${MONTH}`)).j,
};
console.log("── OLDIN ──");
console.log(`  kassa balans   : ${fmt(before.balance)} · naqd ${fmt(before.method)}`);
if (before.payroll) {
  console.log(`  ${TEACHER}: yiqqan=${fmt(before.payroll.collected ?? before.payroll.tushum)} · hisoblangan oylik=${fmt(before.payroll.oylik ?? before.payroll.total)}`);
} else console.log(`  ⚠️  ${TEACHER} oylik ro'yxatida topilmadi`);
console.log(`  bu oy olgan avans/oylik: ${fmt(before.summary?.paid ?? before.summary?.total ?? 0)}`);

const steps = [];

// ── 1-QADAM: KIRIM ──
console.log("\n── 1-QADAM: KIRIM (o'quvchi to'lovi) ──");
const kirim = await api(`/api/cashboxes/${CASHBOX}/adjust`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    mode: "kirim", method: METHOD, amount: AMOUNT,
    category: "O'quvchi to'ladi",
    studentName: "SINOV TO'LOV",
    teacherName: TEACHER,
    note: TAG,
  }),
});
console.log(`  javob: ${kirim.status} ${kirim.j.ok ? "✓" : "✗ " + kirim.j.error}`);
if (!kirim.j.ok) { await client.close(); process.exit(1); }

const eIn = await te.find({ txType: "payIn", note: TAG }).sort({ id: -1 }).limit(1).next();
const tIn = await txs.find({ date: eIn.date, time: eIn.time, amount: eIn.amount, cashboxId: CASHBOX }).limit(1).next();
console.log(`  yozuv: id=${eIn.id} · ${eIn.date} ${eIn.time} · ${fmt(eIn.amount)} · ustoz="${eIn.teacherName}"`);
steps.push({ label: "kirim", kind: "payment", entryId: eIn.id, txId: tIn?.id ?? null, signedAmount: eIn.amount, tab: process.env.SHEET_TAB_PAYMENTS || "To'lovlar" });

const tIn2 = await waitDelivered("payment", eIn.id, "kirim");
console.log(`  navbat: status=${tIn2?.status} · sheetDone=${tIn2?.sheetDone} · Telegram xabar=${tIn2?.messageId ?? "yo'q"}${tIn2?.lastError ? ` · xato=${tIn2.lastError}` : ""}`);

// ── 2-QADAM: CHIQIM (avans) ──
console.log("\n── 2-QADAM: CHIQIM (xodimga avans) ──");
const chiqim = await api(`/api/cashboxes/${CASHBOX}/adjust`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    mode: "chiqim", method: METHOD, amount: AMOUNT,
    category: "Hodimga avans",
    studentName: TEACHER,
    note: TAG,
  }),
});
console.log(`  javob: ${chiqim.status} ${chiqim.j.ok ? "✓" : "✗ " + chiqim.j.error}`);
if (chiqim.j.ok) {
  const eOut = await te.find({ txType: "payOut", note: TAG }).sort({ id: -1 }).limit(1).next();
  const tOut = await txs.find({ date: eOut.date, time: eOut.time, amount: eOut.amount, cashboxId: CASHBOX }).limit(1).next();
  console.log(`  yozuv: id=${eOut.id} · ${fmt(eOut.amount)} · kim="${eOut.studentName}" · turi="${eOut.txName}"`);
  steps.push({ label: "chiqim", kind: "salary", entryId: eOut.id, txId: tOut?.id ?? null, signedAmount: eOut.amount, tab: process.env.SHEET_TAB_SALARIES || "Xodim oyliklari" });
  const tOut2 = await waitDelivered("salary", eOut.id, "chiqim");
  console.log(`  navbat: status=${tOut2?.status} · sheetDone=${tOut2?.sheetDone} · Telegram xabar=${tOut2?.messageId ?? "yo'q"}${tOut2?.lastError ? ` · xato=${tOut2.lastError}` : ""}`);
}

fs.writeFileSync(STATE, JSON.stringify({ before, steps, at: new Date().toISOString() }, null, 1));

// ── NATIJA ──
console.log("\n── KEYIN ──");
const cbAfter = await db.collection("cashboxes").findOne({ id: CASHBOX });
const afterPayroll = await payrollOf(TEACHER);
const afterSummary = (await api(`/api/employee-salary-summary?name=${encodeURIComponent(TEACHER)}&month=${MONTH}`)).j;
console.log(`  kassa balans   : ${fmt(cbAfter.balance)} · naqd ${fmt(cbAfter.methodTotals[METHOD])}`);
if (afterPayroll) console.log(`  ${TEACHER}: yiqqan=${fmt(afterPayroll.collected ?? afterPayroll.tushum)} · hisoblangan oylik=${fmt(afterPayroll.oylik ?? afterPayroll.total)}`);
console.log(`  bu oy olgan avans/oylik: ${fmt(afterSummary?.paid ?? afterSummary?.total ?? 0)}`);

console.log("\n── JADVAL ──");
for (const s of steps) {
  const row = await sheetRowOf(s.tab, s.entryId);
  if (row) {
    const v = await sheetRowValues(s.tab, row);
    console.log(`  ✓ ${s.tab}!${row}: ${v.slice(0, 8).join(" | ")}`);
  } else console.log(`  ✗ ${s.tab}: id=${s.entryId} qatori TOPILMADI`);
}

console.log("\n── TELEGRAM ──");
for (const s of steps) {
  const t = await ob.findOne({ kind: s.kind, entryId: s.entryId, event: "created" });
  const topic = s.kind === "payment" ? process.env.TELEGRAM_TOPIC_PAYMENTS : process.env.TELEGRAM_TOPIC_SALARIES;
  console.log(`  ${t?.messageId ? "✓" : "✗"} ${s.label}: xabar=${t?.messageId ?? "YUBORILMADI"} · topic=${topic}`);
}

console.log(`\nHolat saqlandi: ${STATE}`);
console.log("Orqaga qaytarish: node scripts/_e2e-smoke-test.mjs " + BASE + " --rollback");
await client.close();
