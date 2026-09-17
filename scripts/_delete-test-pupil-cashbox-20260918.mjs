// 18.09.2026 — sinov o'quvchisi "najmiddin tets" (#17065) va sinov kassasi
// "najmiddin test kassa" (#9) ni izsiz o'chirish.
//
//   node scripts/_delete-test-pupil-cashbox-20260918.mjs            # quruq yurish (Atlas ko'zgusida ham)
//   node scripts/_delete-test-pupil-cashbox-20260918.mjs --apply    # o'chiradi — FAQAT prod (VPS)
//
// O'QUVCHI #17065 — 18.09 01:07 da sinov uchun yaratilgan; to'lovlari
// (#707/#708) _delete-test-20260918.mjs bilan allaqachon o'chirilgan.
// Izlari: pupils hujjati, guruh ro'yxati (bo'lsa), sms_messages, bot
// bog'lanishi (bo'lsa). Jurnalda yozuvi QOLGAN bo'lsa skript to'xtaydi —
// avval o'sha yozuvlar o'chirilishi kerak.
//
// KASSA #9 — 10.09 da sinov: #265 kirim 1 000 (Sabohat Abdunazarova, ustoz
// Abdushukur, sentabr) va #311 avans 500 (Abdulloh Raxmatullayev); balans
// 500 naqd. Kassa bilan birga ikkala yozuv ham ketadi — kassasiz yozuv
// qolmasin. OQIBATI (jonli hisoblanadi, alohida tuzatish yo'q):
//   Sabohat balansi −1 000, Abdushukur sentabr tushumi −1 000,
//   Abdulloh olingan avansi −500.
// Izlari: transaction_entries → transactions → sync_outbox → sms_messages
// (cashboxId 9) → cashboxes hujjati → Telegram to'lov xabari (messageId
// 154, 10.09 — 48 soatdan o'tgan; bot guruhda admin bo'lsa o'chadi, bo'lmasa
// xabar qoladi va shu yerda aytiladi) → Google Sheets qatorlari (To'lovlar
// 265, Xodim avanslari 311).
//
// XAVFSIZLIK: kassada AYNAN shu ikki yozuv, o'quvchi AYNAN shu ism/id
// bo'lishi tekshiriladi; boshqacha bo'lsa hech narsa o'chirilmaydi.
import fs from "fs";
import { createSign } from "node:crypto";
import { MongoClient } from "mongodb";

const APPLY = process.argv.includes("--apply");
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
);
const IS_ATLAS = /mongodb\.net/.test(env.MONGODB_URI || "");
if (APPLY && IS_ATLAS) { console.error("--apply faqat VPS (prod) bazasida. Bu Atlas ko'zgusi."); process.exit(1); }

const PUPIL_ID = 17065;
const PUPIL_RE = /^\s*najmiddin\s+tets\s*$/i;
const CASHBOX = 9;
const CASHBOX_NAME = "najmiddin test kassa";
const ENTRY_IDS = [265, 311];

const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 3, serverSelectionTimeoutMS: 20000 });
await c.connect();
const db = c.db(env.MONGODB_DB);
console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===", IS_ATLAS ? "(Atlas ko'zgusi)" : "(prod)");
const bad = [];

// ── O'QUVCHI ──
const pupil = await db.collection("pupils").findOne({ id: PUPIL_ID }, { projection: { _id: 0, studentPasswordHash: 0, parentPasswordHash: 0 } });
if (!pupil) bad.push(`o'quvchi #${PUPIL_ID} topilmadi (allaqachon o'chirilganmi?)`);
else if (!PUPIL_RE.test(`${pupil.firstName ?? ""} ${pupil.lastName ?? ""}`)) bad.push(`o'quvchi #${PUPIL_ID} ismi kutilganday emas: ${pupil.firstName} ${pupil.lastName}`);
const pupilEntries = await db.collection("transaction_entries").countDocuments({ studentName: PUPIL_RE });
if (pupilEntries > 0) bad.push(`o'quvchining jurnalda ${pupilEntries} ta yozuvi bor — avval ularni o'chiring`);
const pupilGroups = await db.collection("groups").find({ studentIds: PUPIL_ID }).project({ _id: 0, id: 1, name: 1 }).toArray();
const pupilSms = await db.collection("sms_messages").find({ $or: [{ recipientName: PUPIL_RE }, { pupilId: PUPIL_ID }] }).project({ _id: 0, id: 1, purpose: 1, status: 1, date: 1 }).toArray();
const pupilBot = await db.collection("student_bot_users").find({ "links.pupilId": PUPIL_ID }).project({ _id: 0, chatId: 1 }).toArray();
const pupilAtt = await db.collection("attendance").countDocuments({ pupilId: PUPIL_ID });
console.log(`o'quvchi: ${pupil ? `#${pupil.id} ${pupil.firstName} ${pupil.lastName} (${pupil.createdAt}, filial ${pupil.branchId})` : "yo'q"}`);
console.log(`   guruhlar: ${pupilGroups.length}, sms/bot jurnali: ${pupilSms.length}, bot bog'lanishi: ${pupilBot.length}, davomat: ${pupilAtt}`);
if (pupilBot.length) bad.push("o'quvchiga bot bog'langan — skript buni kutmagan, qo'lda ko'ring");
if (pupilAtt) bad.push("o'quvchida davomat yozuvi bor — skript buni kutmagan");

// ── KASSA ──
const box = await db.collection("cashboxes").findOne({ id: CASHBOX }, { projection: { _id: 0 } });
if (!box) bad.push(`kassa #${CASHBOX} topilmadi`);
else if (box.name !== CASHBOX_NAME) bad.push(`kassa #${CASHBOX} nomi kutilganday emas: ${box.name}`);
const entries = await db.collection("transaction_entries").find({ cashboxId: CASHBOX }).project({ _id: 0 }).sort({ id: 1 }).toArray();
const entryIds = entries.map((e) => e.id);
if (entryIds.join(",") !== ENTRY_IDS.join(",")) bad.push(`kassa #${CASHBOX} yozuvlari kutilganday emas: [${entryIds.join(",")}] (kutilgan [${ENTRY_IDS.join(",")}])`);
const e265 = entries.find((e) => e.id === 265);
const e311 = entries.find((e) => e.id === 311);
if (e265 && !(e265.txType === "payIn" && e265.amount === 1000)) bad.push("#265 mazmuni kutilganday emas");
if (e311 && !(e311.txType === "payOut" && e311.amount === -500 && /avans/i.test(e311.txName))) bad.push("#311 mazmuni kutilganday emas");
if (box && !(box.balance === 500 && box.methodTotals?.naqd === 500)) bad.push(`kassa #${CASHBOX} qoldig'i kutilganday emas: ${JSON.stringify(box.methodTotals)}`);
const tx = await db.collection("transactions").find({ cashboxId: CASHBOX }).project({ _id: 0 }).sort({ id: 1 }).toArray();
const outbox = await db.collection("sync_outbox").find({ entryId: { $in: ENTRY_IDS } }).toArray();
const boxSms = await db.collection("sms_messages").find({ cashboxId: CASHBOX }).project({ _id: 0, id: 1, purpose: 1, status: 1, recipientName: 1 }).toArray();
const boxOther = {};
for (const name of ["salary_runs", "planned_expenses", "branches", "sms_messages"]) {
  const n = await db.collection(name).countDocuments({ $or: [{ cashboxId: CASHBOX }, { cashboxIds: CASHBOX }] });
  if (n && name !== "sms_messages") boxOther[name] = n;
}
if (Object.keys(boxOther).length) bad.push(`kassa #${CASHBOX} ga boshqa havolalar bor: ${JSON.stringify(boxOther)}`);
console.log(`kassa: ${box ? `#${box.id} "${box.name}" balans ${box.balance}, mas'ul ${box.moderator}` : "yo'q"}`);
console.log("   jurnal:", entries.map((e) => `#${e.id} ${e.date} ${e.txType} ${e.amount} ${e.txName} — ${e.studentName}`).join("; ") || "yo'q");
console.log("   transactions:", tx.map((t) => `#${t.id} ${t.amount} ${t.category}`).join(", ") || "yo'q");
console.log("   navbat:", outbox.map((o) => `#${o.entryId} ${o.kind}/${o.event} ${o.status}${o.messageId ? " tg:" + o.messageId : ""}`).join(", ") || "yo'q");
console.log("   sms/bot jurnali:", boxSms.map((s) => `#${s.id} ${s.purpose ?? ""} ${s.status ?? ""} ${s.recipientName ?? ""}`).join(", ") || "yo'q");
if (bad.length) { console.error("\nTO'XTADI:\n  " + bad.join("\n  ")); await c.close(); process.exit(1); }

// ── Telegram ──
const tgTargets = { payment: env.TELEGRAM_CHAT_PAYMENTS, salary: env.TELEGRAM_CHAT_SALARIES };
const tgMessages = outbox.filter((o) => o.messageId && tgTargets[o.kind]).map((o) => ({ entryId: o.entryId, kind: o.kind, event: o.event, chatId: tgTargets[o.kind], messageId: o.messageId }));
console.log("Telegram o'chiriladigan xabarlar:", tgMessages.length);

// ── Google Sheets ──
const tab = (v, dflt) => { let t = (v || "").trim(); if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1).trim(); return t || dflt; };
const salaryTab = (v) => { const t = tab(v, ""); return !t || t === "Xodim oyliklari" ? "Xodim avanslari" : t; };
const TABS = [tab(env.SHEET_TAB_PAYMENTS, "To'lovlar"), salaryTab(env.SHEET_TAB_SALARIES), tab(env.SHEET_TAB_EXPENSES, "Xarajatlar")];
let sheetsApi = null;
if (env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_PRIVATE_KEY && env.SHEET_ID_PAYMENTS) {
  const b64 = (v) => Buffer.from(v).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const now = Math.floor(Date.now() / 1000);
  const input = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify({
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(), scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }))}`;
  const signer = createSign("RSA-SHA256"); signer.update(input); signer.end();
  const tok = await (await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${input}.${b64(signer.sign(env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")))}` }),
  })).json();
  if (tok.access_token) {
    const ID = env.SHEET_ID_PAYMENTS.trim();
    sheetsApi = async (p, init) => {
      const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ID}${p}`, { ...init, headers: { Authorization: `Bearer ${tok.access_token}`, ...(init?.headers ?? {}) } });
      const j = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
      return j;
    };
  } else console.log("Google token olinmadi:", JSON.stringify(tok).slice(0, 200));
}
const sheetRows = [];
if (sheetsApi) {
  const meta = await sheetsApi("?fields=sheets(properties(sheetId,title))");
  const sheetIdOf = new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  for (const title of TABS) {
    const sheetId = sheetIdOf.get(title);
    if (sheetId === undefined) { console.log(`Sheets: "${title}" varaq topilmadi`); continue; }
    const values = (await sheetsApi(`/values/${encodeURIComponent(`${title}!A2:F`)}?majorDimension=ROWS`)).values ?? [];
    values.forEach((row, i) => { if (ENTRY_IDS.includes(Number(String(row?.[0] ?? "").trim()))) sheetRows.push({ title, sheetId, row: i + 2, cells: row }); });
  }
  console.log("Sheets qatorlari:", sheetRows.length ? sheetRows.map((r) => `${r.title}!${r.row} ${JSON.stringify(r.cells).slice(0, 80)}`).join("\n                 ") : "yo'q");
} else console.log("Sheets: sozlama yo'q — o'tkazib yuboriladi");

const backup = `scripts/data/_deleted-test-pupil-cashbox-20260918${IS_ATLAS ? "-atlas" : ""}.json`;
fs.writeFileSync(backup, JSON.stringify({ at: new Date().toISOString(), pupil, pupilGroups, pupilSms, box, entries, tx, outbox, boxSms, sheetRows }, null, 1));
console.log("zaxira:", backup);
if (!APPLY) { console.log("\nHech narsa o'chirilmadi. Qo'llash uchun: --apply"); await c.close(); process.exit(0); }

// ── O'CHIRISH ──
const p1 = await db.collection("pupils").deleteOne({ id: PUPIL_ID });
const p2 = await db.collection("groups").updateMany({ studentIds: PUPIL_ID }, { $pull: { studentIds: PUPIL_ID } });
const p3 = pupilSms.length ? await db.collection("sms_messages").deleteMany({ id: { $in: pupilSms.map((s) => s.id) } }) : { deletedCount: 0 };
console.log(`\no'quvchi: hujjat ${p1.deletedCount}, guruhdan chiqarildi ${p2.modifiedCount}, sms/bot jurnali ${p3.deletedCount}`);

const r1 = await db.collection("transaction_entries").deleteMany({ id: { $in: ENTRY_IDS }, cashboxId: CASHBOX });
const r2 = tx.length ? await db.collection("transactions").deleteMany({ id: { $in: tx.map((t) => t.id) }, cashboxId: CASHBOX }) : { deletedCount: 0 };
const r3 = await db.collection("sync_outbox").deleteMany({ entryId: { $in: ENTRY_IDS } });
const r4 = boxSms.length ? await db.collection("sms_messages").deleteMany({ id: { $in: boxSms.map((s) => s.id) } }) : { deletedCount: 0 };
const r5 = await db.collection("cashboxes").deleteOne({ id: CASHBOX, name: CASHBOX_NAME });
console.log(`kassa: jurnal ${r1.deletedCount}, transactions ${r2.deletedCount}, navbat ${r3.deletedCount}, sms/bot ${r4.deletedCount}, kassa hujjati ${r5.deletedCount}`);

for (const m of tgMessages) {
  if (!env.TELEGRAM_BOT_TOKEN) { console.log("Telegram: token yo'q"); break; }
  const u = new URL(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/deleteMessage`);
  u.searchParams.set("chat_id", m.chatId);
  u.searchParams.set("message_id", String(m.messageId));
  const res = await fetch(u).then((r) => r.json()).catch((e) => ({ ok: false, description: String(e) }));
  console.log(`Telegram #${m.entryId} ${m.kind}/${m.event} xabar ${m.messageId}:`, res.ok ? "o'chirildi" : `o'chirilmadi: ${res.description}`);
}

if (sheetsApi && sheetRows.length) {
  const byTitle = new Map();
  for (const r of sheetRows) byTitle.set(r.title, [...(byTitle.get(r.title) ?? []), r]);
  for (const [title, rows] of byTitle) {
    const requests = rows.map((r) => r.row).sort((a, b) => b - a)
      .map((row) => ({ deleteDimension: { range: { sheetId: rows[0].sheetId, dimension: "ROWS", startIndex: row - 1, endIndex: row } } }));
    await sheetsApi(":batchUpdate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requests }) });
    console.log(`Sheets "${title}": ${rows.length} qator o'chirildi`);
  }
}
console.log("\nTayyor. Oqibati (jonli hisob): Sabohat Abdunazarova balansi −1 000, Abdushukur sentabr tushumi −1 000, Abdulloh olingan avansi −500.");
await c.close();
