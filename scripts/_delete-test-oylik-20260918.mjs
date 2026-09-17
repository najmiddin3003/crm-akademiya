// 18.09.2026 — Abdulloh Raxmatullayevga 11.09 da SINOV uchun chiqarilgan
// "Oylik" yozuvlarini (#321 −1 000 "test", #322 −1; Raxbar kassa, plastik)
// izsiz o'chirish va pulni kassaga qaytarish.
//
//   node scripts/_delete-test-oylik-20260918.mjs            # quruq yurish (Atlas ko'zgusida ham)
//   node scripts/_delete-test-oylik-20260918.mjs --apply    # o'chiradi — FAQAT prod (VPS)
//
// Natija: Oylik hisob-kitobda Abdullohning "To'langan oylik"i 1 001 → 0,
// Raxbar kassa plastik va balansi +1 001. Yozuvlar "Oylik chiqarish"
// partiyasidan emas (salaryRunId yo'q) — salary_runs ga tegilmaydi.
// Izlari: transaction_entries → transactions → sync_outbox (Telegram
// xabari yo'q, messageId null) → Google Sheets "Xodim avanslari" qatorlari.
//
// XAVFSIZLIK: aynan shu ikki yozuv, shu kassa, shu summalar; boshqacha
// bo'lsa hech narsa o'chirilmaydi.
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

const CASHBOX = 3;
const EXPECT = [
  { id: 321, amount: -1000 },
  { id: 322, amount: -1 },
];
const IDS = EXPECT.map((e) => e.id);
const NET = 1001; // kassaga qaytariladigan summa (plastik)

const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 3, serverSelectionTimeoutMS: 20000 });
await c.connect();
const db = c.db(env.MONGODB_DB);
console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===", IS_ATLAS ? "(Atlas ko'zgusi)" : "(prod)");

const entries = await db.collection("transaction_entries").find({ id: { $in: IDS } }).project({ _id: 0 }).sort({ id: 1 }).toArray();
const bad = [];
for (const x of EXPECT) {
  const e = entries.find((r) => r.id === x.id);
  if (!e) { bad.push(`#${x.id} topilmadi (allaqachon o'chirilganmi?)`); continue; }
  const ok = e.txType === "payOut" && e.amount === x.amount && e.cashboxId === CASHBOX && e.txName === "Oylik"
    && /abdulloh\s+raxmatullayev/i.test(e.studentName || "") && e.paymentMethodKey === "plastik" && e.status !== "cancelled" && !e.salaryRunId;
  if (!ok) bad.push(`#${x.id} kutilgan mazmunda emas: ${JSON.stringify(e).slice(0, 200)}`);
}
const others = await db.collection("transaction_entries").countDocuments({
  txType: "payOut", txName: "Oylik", studentName: /abdulloh\s+raxmatullayev/i, status: { $ne: "cancelled" }, id: { $nin: IDS },
});
if (others > 0) bad.push(`Abdullohga yana ${others} ta faol "Oylik" yozuvi bor — skript faqat #321/#322 ni biladi, qo'lda ko'ring`);
const box = await db.collection("cashboxes").findOne({ id: CASHBOX }, { projection: { _id: 0, id: 1, name: 1, balance: 1, methodTotals: 1 } });
if (!box) bad.push(`kassa #${CASHBOX} topilmadi`);
if (bad.length) { console.error("TO'XTADI:\n  " + bad.join("\n  ")); await c.close(); process.exit(1); }

const tx = await db.collection("transactions").find({
  cashboxId: CASHBOX, category: "Oylik", $or: entries.map((e) => ({ date: e.date, time: e.time, amount: e.amount })),
}).project({ _id: 0 }).sort({ id: 1 }).toArray();
const outbox = await db.collection("sync_outbox").find({ entryId: { $in: IDS } }).toArray();
const tgTargets = { payment: env.TELEGRAM_CHAT_PAYMENTS, salary: env.TELEGRAM_CHAT_SALARIES };
const tgMessages = outbox.filter((o) => o.messageId && tgTargets[o.kind]).map((o) => ({ entryId: o.entryId, kind: o.kind, event: o.event, chatId: tgTargets[o.kind], messageId: o.messageId }));
console.log("jurnal:", entries.map((e) => `#${e.id} ${e.date} ${e.time} ${e.amount} ${e.paymentType} [${e.status || "faol"}] "${e.note}"`).join("; "));
console.log("transactions:", tx.map((t) => `#${t.id} ${t.amount}`).join(", ") || "yo'q");
if (tx.length > 2) { console.error("TO'XTADI: transactions da kutilganidan ko'p mos qator"); await c.close(); process.exit(1); }
console.log("navbat:", outbox.map((o) => `#${o.entryId} ${o.kind}/${o.event} ${o.status}${o.messageId ? " tg:" + o.messageId : ""}`).join(", ") || "yo'q");
console.log("Telegram o'chiriladigan xabarlar:", tgMessages.length);
console.log(`kassa #${CASHBOX} "${box.name}": balance ${box.balance}, plastik ${box.methodTotals?.plastik} → +${NET} qaytariladi`);

// ── Google Sheets ──
const tab = (v, dflt) => { let t = (v || "").trim(); if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1).trim(); return t || dflt; };
const salaryTab = (v) => { const t = tab(v, ""); return !t || t === "Xodim oyliklari" ? "Xodim avanslari" : t; };
const TABS = [salaryTab(env.SHEET_TAB_SALARIES), tab(env.SHEET_TAB_PAYMENTS, "To'lovlar"), tab(env.SHEET_TAB_EXPENSES, "Xarajatlar")];
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
    values.forEach((row, i) => { if (IDS.includes(Number(String(row?.[0] ?? "").trim()))) sheetRows.push({ title, sheetId, row: i + 2, cells: row }); });
  }
  console.log("Sheets qatorlari:", sheetRows.length ? sheetRows.map((r) => `${r.title}!${r.row} ${JSON.stringify(r.cells).slice(0, 80)}`).join("\n                 ") : "yo'q");
} else console.log("Sheets: sozlama yo'q — o'tkazib yuboriladi");

const backup = `scripts/data/_deleted-test-oylik-20260918${IS_ATLAS ? "-atlas" : ""}.json`;
fs.writeFileSync(backup, JSON.stringify({ at: new Date().toISOString(), entries, tx, outbox, cashbox: box, sheetRows }, null, 1));
console.log("zaxira:", backup);
if (!APPLY) { console.log("\nHech narsa o'chirilmadi. Qo'llash uchun: --apply"); await c.close(); process.exit(0); }

const r1 = await db.collection("transaction_entries").deleteMany({ id: { $in: IDS }, cashboxId: CASHBOX });
const r2 = tx.length ? await db.collection("transactions").deleteMany({ id: { $in: tx.map((t) => t.id) }, cashboxId: CASHBOX }) : { deletedCount: 0 };
const r3 = await db.collection("sync_outbox").deleteMany({ entryId: { $in: IDS } });
// Pul kassaga QAYTADI: chiqim yozuvlari yo'qolgani uchun plastik va balans +1 001.
const r4 = await db.collection("cashboxes").updateOne({ id: CASHBOX }, { $inc: { "methodTotals.plastik": NET, balance: NET } });
console.log(`\no'chirildi: jurnal ${r1.deletedCount}, transactions ${r2.deletedCount}, navbat ${r3.deletedCount}; kassaga qaytarildi (+${NET}): ${r4.modifiedCount}`);

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

const b = await db.collection("cashboxes").findOne({ id: CASHBOX }, { projection: { _id: 0, balance: 1, methodTotals: 1 } });
const totals = Object.values(b?.methodTotals ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
const rows = await db.collection("transaction_entries").find({ cashboxId: CASHBOX, status: { $ne: "cancelled" } }, { projection: { _id: 0, amount: 1, status: 1 } }).toArray();
const journal = rows.filter((r) => !(r.status === "waiting" && Number(r.amount) > 0)).reduce((s, r) => s + (Number(r.amount) || 0), 0);
console.log(`\nkassa #${CASHBOX}: balance=${b.balance} turlar=${totals} jurnal=${journal}  ${b.balance === totals && b.balance === journal ? "MOS" : "!!! FARQ — qo'lda ko'ring"}`);
await c.close();
