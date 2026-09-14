// 14.09.2026 — rahbarning 100 so'mlik SINOV yozuvlarini izsiz o'chirish.
//
//   node scripts/_delete-test-100-20260914.mjs            # quruq yurish
//   node scripts/_delete-test-100-20260914.mjs --apply    # o'chiradi
//
// Sinov: 18:31 da Nilufar kassasiga 100 so'm inkassa kirim (#451,
// "Najmiddin oquvchi profil", ustoz Najmiddin turgunpolatov), 18:37 da
// 100 so'm Raxbar kassaga ko'chirma (#452 out / #453 in) va uning ✓ si.
// Ilovaning o'zida yozuvni o'chirish yo'q (faqat bekor qilish), sinov esa
// hisobotlarda, ustoz oyligida va jadvalda umuman ko'rinmasligi kerak.
//
// TO'LIQ RO'YXAT (memory: kassa-minus-balans, 09.09 dagi tozalash tajribasi):
//   transaction_entries → transactions (kirimning jufti) → sync_outbox
//   ({entryId} bo'yicha HAMMA hodisalar: created/confirmed) → sms_messages
//   (bot jurnali) → cashboxes (Raxbar kassadan qabul qilingan +100 ni qaytarish;
//   Nilufar kassasi sof 0: +100 kirim, −100 ko'chirma) → Telegram guruhidagi
//   "Yangi to'lov #451" xabari (deleteMessage — 48 soat o'tmagan, bot o'z
//   xabarini o'chira oladi) → Google Sheets qatorlari (451, 452, 453) —
//   ular bazadan yo'qolgach `sheets-drop-orphans.mjs --apply` bilan.
// Ustoz oyligi va o'quvchi tarixi jurnaldan JONLI hisoblanadi — alohida
// tuzatish shart emas.
//
// XAVFSIZLIK: har hujjat aynan kutilgan mazmunda ekani tekshiriladi
// (id, summa, tur, kassa); mos kelmasa hech narsa o'chirilmaydi.
import fs from "fs";
import { MongoClient } from "mongodb";

const APPLY = process.argv.includes("--apply");
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
);
if (/mongodb\.net/.test(env.MONGODB_URI)) { console.error("Bu skript faqat VPS (prod) bazasi uchun."); process.exit(1); }

const ENTRY_IDS = [451, 452, 453];
const TX_ID = 340;
const SMS_ID = 151;
const PRIMARY = 3;

const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 3 });
await c.connect();
const db = c.db(env.MONGODB_DB);
console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===");

// ── Kutilgan mazmun tekshiruvi ──
const entries = await db.collection("transaction_entries").find({ id: { $in: ENTRY_IDS } }).toArray();
const byId = new Map(entries.map((e) => [e.id, e]));
const expect = [
  [451, (e) => e.txType === "payIn" && e.amount === 100 && e.cashboxId === 4 && e.studentName === "Najmiddin oquvchi profil"],
  [452, (e) => e.txType === "transfer" && e.amount === -100 && e.cashboxId === 4 && e.transferRole === "out"],
  [453, (e) => e.txType === "transfer" && e.amount === 100 && e.cashboxId === PRIMARY && e.transferRole === "in" && e.transferId === 452],
];
const bad = [];
for (const [id, ok] of expect) {
  const e = byId.get(id);
  if (!e) bad.push(`#${id} topilmadi (allaqachon o'chirilganmi?)`);
  else if (!ok(e)) bad.push(`#${id} kutilgan mazmunda emas: ${JSON.stringify(e).slice(0, 160)}`);
}
const tx = await db.collection("transactions").findOne({ id: TX_ID });
if (tx && !(tx.amount === 100 && tx.cashboxId === 4 && tx.date === "2026-09-14")) bad.push(`transactions #${TX_ID} kutilgan mazmunda emas`);
const sms = await db.collection("sms_messages").findOne({ id: SMS_ID });
if (sms && sms.recipientName !== "Najmiddin oquvchi profil") bad.push(`sms_messages #${SMS_ID} kutilgan mazmunda emas`);
const primary = await db.collection("cashboxes").findOne({ id: PRIMARY });
const accepted = byId.get(453)?.status === "" && byId.get(453)?.decidedAt;
if (bad.length) { console.error("TO'XTADI:\n  " + bad.join("\n  ")); await c.close(); process.exit(1); }

const outbox = await db.collection("sync_outbox").find({ entryId: { $in: ENTRY_IDS } }).toArray();
const payTask = outbox.find((o) => o.kind === "payment" && o.entryId === 451 && o.event === "created");
console.log("jurnal:", entries.map((e) => `#${e.id} ${e.txType} ${e.amount}`).join(", "));
console.log("transactions:", tx ? `#${TX_ID} ${tx.amount}` : "yo'q");
console.log("navbat:", outbox.length, "ta vazifa", payTask?.messageId ? `(Telegram xabar id ${payTask.messageId})` : "");
console.log("bot jurnali:", sms ? `#${SMS_ID} ${sms.status}` : "yo'q");
console.log(`Raxbar kassa: balance ${primary.balance}, inkassa ${primary.methodTotals?.inkassa} → ${accepted ? "−100 qaytariladi" : "ko'chirma qabul qilinmagan, kassa o'zgarmaydi"}`);
console.log("Nilufar kassasi: +100 kirim va −100 qabul qilingan ko'chirma — sof 0, o'zgarmaydi");

if (!APPLY) { console.log("\nHech narsa o'chirilmadi. Qo'llash uchun: --apply"); await c.close(); process.exit(0); }

// ── O'chirish ──
const r1 = await db.collection("transaction_entries").deleteMany({ id: { $in: ENTRY_IDS } });
const r2 = await db.collection("transactions").deleteMany({ id: TX_ID, amount: 100, cashboxId: 4 });
const r3 = await db.collection("sync_outbox").deleteMany({ entryId: { $in: ENTRY_IDS } });
const r4 = await db.collection("sms_messages").deleteMany({ id: SMS_ID, recipientName: "Najmiddin oquvchi profil" });
let r5 = { modifiedCount: 0 };
if (accepted) {
  r5 = await db.collection("cashboxes").updateOne(
    { id: PRIMARY, "methodTotals.inkassa": { $gte: 100 }, balance: { $gte: 100 } },
    { $inc: { "methodTotals.inkassa": -100, balance: -100 } },
  );
}
console.log(`\no'chirildi: jurnal ${r1.deletedCount}, transactions ${r2.deletedCount}, navbat ${r3.deletedCount}, bot jurnali ${r4.deletedCount}; Raxbar kassa tuzatildi: ${r5.modifiedCount}`);

// ── Telegram guruhidagi xabar ──
if (payTask?.messageId && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_PAYMENTS) {
  const u = new URL(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/deleteMessage`);
  u.searchParams.set("chat_id", env.TELEGRAM_CHAT_PAYMENTS);
  u.searchParams.set("message_id", String(payTask.messageId));
  const res = await fetch(u).then((r) => r.json()).catch((e) => ({ ok: false, description: String(e) }));
  console.log("Telegram xabar", payTask.messageId, res.ok ? "o'chirildi" : `o'chirilmadi: ${res.description}`);
} else {
  console.log("Telegram: xabar id yoki sozlama yo'q — o'tkazib yuborildi");
}
const after = await db.collection("cashboxes").findOne({ id: PRIMARY }, { projection: { _id: 0, balance: 1, "methodTotals.inkassa": 1 } });
console.log("Raxbar kassa endi:", JSON.stringify(after));
console.log("Keyin: node scripts/_verify-cashbox-invariant.mjs va node scripts/sheets-drop-orphans.mjs (451/452/453 qatorlari)");
await c.close();
