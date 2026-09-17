// 18.09.2026 — rahbarning "Akademiya 2 Chortoq (Dilmurod)" kassasidagi
// (id 5) uchta SINOV yozuvini izsiz o'chirish.
//
//   node scripts/_delete-test-20260918.mjs            # quruq yurish (Atlas ko'zgusida ham bo'ladi)
//   node scripts/_delete-test-20260918.mjs --apply    # o'chiradi — FAQAT prod (VPS) bazasida
//
// Sinov (18.09.2026, Toshkent):
//   01:09  #707  kirim  1 000 plastik  "najmiddin tets", ustoz Abdushukur  (faol)
//   01:11  #708  chiqim   500 plastik  "najmiddin tets" — o'quvchiga pul qaytarildi (faol)
//   01:34  #?    chiqim   100 plastik  "Najmiddin Turg'unpo'latov" — Oylik   (BEKOR QILINGAN)
//
// TO'LIQ RO'YXAT (14.09 dagi _delete-test-100-20260914.mjs tajribasi):
//   transaction_entries → transactions (kirim/chiqim jufti; bekor qilingan
//   Oylikda IKKI qator: −100 va +100 "(bekor qilindi)") → sync_outbox
//   ({entryId} bo'yicha HAMMA hodisalar) → sms_messages (to'lov SMS +
//   o'quvchilar boti jurnali, "najmiddin tets") → cashboxes (#5: faol
//   +1 000 kirim va −500 chiqim = sof +500 plastik, u qaytariladi; bekor
//   qilingan Oylik kassaga allaqachon qaytgan) → Telegram guruhidagi
//   xabarlar (navbatdagi messageId: to'lov — To'lovlar guruhi, oylik —
//   Oyliklar guruhi; bekor qilish xabari ham) → Google Sheets qatorlari
//   (To'lovlar / Xarajatlar / Xodim avanslari varaqlarida id bo'yicha).
// Ustoz oyligi va o'quvchi balansi jurnaldan JONLI hisoblanadi — alohida
// tuzatish shart emas.
//
// XAVFSIZLIK: har hujjat aynan kutilgan mazmunda ekani tekshiriladi
// (kassa, sana, summa, tur, ism); mos kelmasa hech narsa o'chirilmaydi.
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

const CASHBOX = 5;
const DATE = "2026-09-18";
const STUDENT = "najmiddin tets";

const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 3, serverSelectionTimeoutMS: 20000 });
await c.connect();
const db = c.db(env.MONGODB_DB);
console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===", IS_ATLAS ? "(Atlas ko'zgusi)" : "(prod)");

// ── Yozuvlarni topish va mazmunini tekshirish ──
const nameEq = (s) => ({ $regex: `^\\s*${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, $options: "i" });
const kirim = await db.collection("transaction_entries").findOne(
  { cashboxId: CASHBOX, date: DATE, txType: "payIn", amount: 1000, studentName: nameEq(STUDENT) },
);
const qaytarim = await db.collection("transaction_entries").findOne(
  { cashboxId: CASHBOX, date: DATE, txType: "payOut", amount: -500, studentName: nameEq(STUDENT) },
);
const oylik = await db.collection("transaction_entries").findOne(
  { cashboxId: CASHBOX, date: DATE, txType: "payOut", amount: -100, txName: "Oylik", status: "cancelled", studentName: nameEq("Najmiddin Turg'unpo'latov") },
);
const bad = [];
if (!kirim) bad.push("kirim #? (1 000, najmiddin tets) topilmadi");
if (!qaytarim) bad.push("qaytarim #? (−500, najmiddin tets) topilmadi");
else if (!/qaytar/i.test(qaytarim.txName || "")) bad.push(`#${qaytarim.id} tur kutilganday emas: ${qaytarim.txName}`);
if (!oylik) bad.push("bekor qilingan Oylik (−100, Najmiddin Turg'unpo'latov) topilmadi");
if (kirim && kirim.status === "cancelled") bad.push(`#${kirim.id} bekor qilingan — kassa hisobi boshqacha, skript kutmagan`);
if (qaytarim && qaytarim.status === "cancelled") bad.push(`#${qaytarim.id} bekor qilingan — kassa hisobi boshqacha, skript kutmagan`);
// Shu kassada, shu kunda, shu ismlar bilan BOSHQA yozuv bo'lmasin (adashmaslik uchun).
const others = await db.collection("transaction_entries").countDocuments({
  cashboxId: CASHBOX, date: DATE,
  $or: [{ studentName: nameEq(STUDENT) }, { txName: "Oylik", studentName: nameEq("Najmiddin Turg'unpo'latov") }],
  id: { $nin: [kirim?.id, qaytarim?.id, oylik?.id].filter(Boolean) },
});
if (others > 0) bad.push(`kassa ${CASHBOX} da ${DATE} kuni shu ismlar bilan yana ${others} ta yozuv bor — qo'lda ko'ring`);
if (bad.length) { console.error("TO'XTADI:\n  " + bad.join("\n  ")); await c.close(); process.exit(1); }

const ENTRIES = [kirim, qaytarim, oylik];
const IDS = ENTRIES.map((e) => e.id);
console.log("jurnal:", ENTRIES.map((e) => `#${e.id} ${e.time} ${e.txType} ${e.amount} [${e.status || "faol"}] ${e.txName} — ${e.studentName}`).join("\n        "));

// ── transactions juftlari ──
const tx = await db.collection("transactions").find({
  cashboxId: CASHBOX, date: DATE,
  $or: [
    { amount: 1000, category: kirim.txName },
    { amount: -500, category: qaytarim.txName },
    { amount: -100, category: "Oylik" },
    { amount: 100, category: "Oylik (bekor qilindi)" },
  ],
}).sort({ id: 1 }).toArray();
console.log("transactions:", tx.length ? tx.map((t) => `#${t.id} ${t.amount} ${t.category}`).join(", ") : "yo'q");
if (tx.length > 4) { console.error("TO'XTADI: transactions da kutilganidan ko'p mos qator"); await c.close(); process.exit(1); }

// ── sync_outbox va Telegram xabarlari ──
const outbox = await db.collection("sync_outbox").find({ entryId: { $in: IDS } }).toArray();
const tgTargets = { payment: env.TELEGRAM_CHAT_PAYMENTS, salary: env.TELEGRAM_CHAT_SALARIES };
const tgMessages = outbox
  .filter((o) => o.messageId && tgTargets[o.kind])
  .map((o) => ({ entryId: o.entryId, kind: o.kind, event: o.event, chatId: tgTargets[o.kind], messageId: o.messageId }));
console.log("navbat:", outbox.map((o) => `#${o.entryId} ${o.kind}/${o.event} ${o.status}${o.messageId ? " tg:" + o.messageId : ""}`).join(", ") || "yo'q");
console.log("Telegram o'chiriladigan xabarlar:", tgMessages.length);

// ── SMS / bot jurnali ──
const sms = await db.collection("sms_messages").find({ date: DATE, recipientName: nameEq(STUDENT) }).toArray();
console.log("sms_messages:", sms.length ? sms.map((s) => `#${s.id} ${s.purpose ?? s.channel ?? ""} ${s.status ?? ""}`).join(", ") : "yo'q");

// ── Kassa ──
const box = await db.collection("cashboxes").findOne({ id: CASHBOX });
const NET = 1000 - 500; // faol kirim va faol chiqim; bekor qilingan Oylik allaqachon qaytgan
console.log(`kassa #${CASHBOX} "${box?.name}": balance ${box?.balance}, plastik ${box?.methodTotals?.plastik} → −${NET} qaytariladi`);

// ── Google Sheets: qatorlar id bo'yicha ──
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
  const key = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const tok = await (await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${input}.${b64(signer.sign(key))}` }),
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
const sheetRows = []; // { title, sheetId, row, cells }
if (sheetsApi) {
  const meta = await sheetsApi("?fields=sheets(properties(sheetId,title))");
  const sheetIdOf = new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  for (const title of TABS) {
    const sheetId = sheetIdOf.get(title);
    if (sheetId === undefined) { console.log(`Sheets: "${title}" varaq topilmadi`); continue; }
    const values = (await sheetsApi(`/values/${encodeURIComponent(`${title}!A2:F`)}?majorDimension=ROWS`)).values ?? [];
    values.forEach((row, i) => {
      const id = Number(String(row?.[0] ?? "").trim());
      if (IDS.includes(id)) sheetRows.push({ title, sheetId, row: i + 2, cells: row });
    });
  }
  console.log("Sheets qatorlari:", sheetRows.length ? sheetRows.map((r) => `${r.title}!${r.row} ${JSON.stringify(r.cells).slice(0, 80)}`).join("\n                 ") : "yo'q");
} else console.log("Sheets: sozlama yo'q — o'tkazib yuboriladi");

const backup = `scripts/data/_deleted-test-20260918${IS_ATLAS ? "-atlas" : ""}.json`;
fs.writeFileSync(backup, JSON.stringify({ at: new Date().toISOString(), entries: ENTRIES, tx, outbox, sms, cashbox: box, sheetRows }, null, 1));
console.log("zaxira:", backup);

if (!APPLY) { console.log("\nHech narsa o'chirilmadi. Qo'llash uchun: --apply"); await c.close(); process.exit(0); }

// ── O'chirish ──
const r1 = await db.collection("transaction_entries").deleteMany({ id: { $in: IDS } });
const r2 = tx.length ? await db.collection("transactions").deleteMany({ id: { $in: tx.map((t) => t.id) } }) : { deletedCount: 0 };
const r3 = await db.collection("sync_outbox").deleteMany({ entryId: { $in: IDS } });
const r4 = sms.length ? await db.collection("sms_messages").deleteMany({ id: { $in: sms.map((s) => s.id) } }) : { deletedCount: 0 };
const r5 = await db.collection("cashboxes").updateOne(
  { id: CASHBOX, "methodTotals.plastik": { $gte: NET }, balance: { $gte: NET } },
  { $inc: { "methodTotals.plastik": -NET, balance: -NET } },
);
console.log(`\no'chirildi: jurnal ${r1.deletedCount}, transactions ${r2.deletedCount}, navbat ${r3.deletedCount}, sms/bot ${r4.deletedCount}; kassa tuzatildi: ${r5.modifiedCount}`);

// ── Telegram ──
for (const m of tgMessages) {
  if (!env.TELEGRAM_BOT_TOKEN) { console.log("Telegram: token yo'q"); break; }
  const u = new URL(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/deleteMessage`);
  u.searchParams.set("chat_id", m.chatId);
  u.searchParams.set("message_id", String(m.messageId));
  const res = await fetch(u).then((r) => r.json()).catch((e) => ({ ok: false, description: String(e) }));
  console.log(`Telegram #${m.entryId} ${m.kind}/${m.event} xabar ${m.messageId}:`, res.ok ? "o'chirildi" : `o'chirilmadi: ${res.description}`);
}

// ── Sheets (pastdan yuqoriga, varaq bo'yicha) ──
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

// ── Invariant ──
const b = await db.collection("cashboxes").findOne({ id: CASHBOX }, { projection: { _id: 0, balance: 1, methodTotals: 1 } });
const totals = Object.values(b?.methodTotals ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
const rows = await db.collection("transaction_entries").find({ cashboxId: CASHBOX, status: { $ne: "cancelled" } }, { projection: { _id: 0, amount: 1, status: 1 } }).toArray();
const journal = rows.filter((r) => !(r.status === "waiting" && Number(r.amount) > 0)).reduce((s, r) => s + (Number(r.amount) || 0), 0);
console.log(`\nkassa #${CASHBOX}: balance=${b.balance} turlar=${totals} jurnal=${journal}  ${b.balance === totals && b.balance === journal ? "MOS" : "!!! FARQ — qo'lda ko'ring"}`);
await c.close();
