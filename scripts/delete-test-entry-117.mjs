// BIR MARTALIK — 117-raqamli SINOV to'lovini butunlay o'chiradi.
//
//   node scripts/delete-test-entry-117.mjs            # quruq yurish
//   node scripts/delete-test-entry-117.mjs --apply    # o'chiradi
//
// ══════════════════════════════════════════════════════════════════
// NIMA (markaz so'rovi, 2026-09-05)
//
// "najmiddin test" kassasida (id 6) 10 so'mlik sinov to'lovi qilingan:
// #117, 05.09.2026 17:41, Yoqubjanov Diyorbek, Naqd.
//
// Bitta to'lov BESHTA joyda iz qoldiradi. Hammasi birga o'chirilmasa
// keyin tushunarsiz nosozliklar chiqadi:
//
//   1) transaction_entries #117   — jurnal yozuvi
//   2) transactions #86           — juft hujjat (kirim/chiqimda bo'ladi,
//                                   ko'chirmalarda yo'q)
//   3) sync_outbox {entryId:117}  — TUZOQ. Bu kolleksiyada
//      `{kind, entryId, event}` unikal indeksi bor, `logEntry` esa yangi
//      id ni `max(id)+1` bilan beradi. Yozuv o'chirilib navbat qatori
//      qolsa, o'sha id qayta ishlatilganda YANGI to'lovning sinxroni
//      jimgina bloklanadi (2026-09-03 dagi hodisadan olingan saboq).
//   4) cashboxes #6               — `balance` va `methodTotals.naqd`
//   5) sms_messages #10           — shu to'lov uchun yozilgan SMS jurnali
//      ("10 so'm to'lovingiz qabul qilindi"). SMS YUBORILMAGAN
//      ("Yuborilmadi"), ya'ni tashqariga hech narsa ketmagan — lekin
//      qator SMS analitikasida sanalib turardi.
//
// GOOGLE JADVAL alohida: qator u yerga allaqachon yozilgan
// (`sheetDone: true`). Bu skript bazani tozalagach, jadvaldagi qator
// "yetim" bo'lib qoladi va uni `scripts/sheets-drop-orphans.mjs` oladi.
//
// TELEGRAM: xabar allaqachon guruhga KETGAN (`telegramDone: true`,
// messageId 20). Uni qaytarib bo'lmaydi — bu skript xabar yubormaydi ham,
// o'chirmaydi ham. Markazga aytilishi kerak.
//
// BALANS JURNALDAN QAYTA HISOBLANADI, ayirish bilan emas: ayirish
// buzilgan hujjatni "tuzatgandek" ko'rsatib, xatoni ichkariga bekitardi.
import fs from "fs";
import { MongoClient } from "mongodb";

const APPLY = process.argv.includes("--apply");
const ENTRY_ID = 117;
const CASHBOX_ID = 6;

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await c.connect();
const db = c.db(env.MONGODB_DB);

const entry = await db.collection("transaction_entries").findOne({ id: ENTRY_ID }, { projection: { _id: 0 } });
if (!entry) {
  console.log(`#${ENTRY_ID} topilmadi — allaqachon o'chirilgan bo'lishi mumkin.`);
  await c.close();
  process.exit(0);
}

// Juft hujjat: bir xil kassa, sana, vaqt va summa bo'yicha topiladi —
// `transactions` da jurnal yozuvining id'si saqlanmaydi.
const tx = await db.collection("transactions").findOne(
  { cashboxId: entry.cashboxId, date: entry.date, time: entry.time, amount: entry.amount },
  { projection: { _id: 0 } },
);
const outbox = await db.collection("sync_outbox").find({ entryId: ENTRY_ID }, { projection: { _id: 0 } }).toArray();
const sms = await db.collection("sms_messages").find(
  { purpose: "payment", recipientName: entry.studentName, date: entry.date },
  { projection: { _id: 0 } },
).toArray();
const box = await db.collection("cashboxes").findOne({ id: CASHBOX_ID }, { projection: { _id: 0 } });

console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===");
console.log("\njurnal yozuvi :", JSON.stringify(entry));
console.log("juft hujjat   :", tx ? JSON.stringify(tx) : "TOPILMADI");
console.log("navbat qatori :", outbox.length ? JSON.stringify(outbox.map((o) => ({ entryId: o.entryId, event: o.event, status: o.status, sheetDone: o.sheetDone, telegramDone: o.telegramDone }))) : "yo'q");
console.log("SMS jurnali   :", sms.length ? JSON.stringify(sms.map((s) => ({ id: s.id, status: s.status, text: String(s.text).slice(0, 45) + "…" }))) : "yo'q");
console.log("kassa #" + CASHBOX_ID + "     :", `balance=${box?.balance}`, JSON.stringify(box?.methodTotals));

const backup = { at: new Date().toISOString(), entry, tx, outbox, sms, cashbox: box };
const path = `C:/Users/zovaxx/Desktop/ochirilgan-tolov-${ENTRY_ID}-${new Date().toISOString().slice(0, 10)}.json`;
fs.writeFileSync(path, JSON.stringify(backup, null, 1));
console.log("\nzaxira:", path);

if (!APPLY) {
  console.log("\nHech narsa o'chirilmadi. Qo'llash uchun: --apply");
  await c.close();
  process.exit(0);
}

await db.collection("transaction_entries").deleteOne({ id: ENTRY_ID });
if (tx) await db.collection("transactions").deleteOne({ id: tx.id });
const ob = await db.collection("sync_outbox").deleteMany({ entryId: ENTRY_ID });
let smsDeleted = 0;
for (const s of sms) smsDeleted += (await db.collection("sms_messages").deleteOne({ id: s.id })).deletedCount;

// BALANSNI JURNALDAN QAYTA HISOBLASH. Kassada boshqa yozuv qolmagan
// bo'lsagina nol qo'yiladi; qolgan bo'lsa skript TO'XTAYDI va qo'lda
// ko'rib chiqishni so'raydi — noto'g'ri hisoblab, pulni jimgina
// o'zgartirib qo'ymaslik uchun.
const left = await db.collection("transaction_entries").countDocuments({ cashboxId: CASHBOX_ID, status: { $ne: "cancelled" } });
console.log(`\no'chirildi: jurnal 1, juft ${tx ? 1 : 0}, navbat ${ob.deletedCount}, SMS ${smsDeleted}`);
console.log(`kassa #${CASHBOX_ID} da qolgan yozuvlar: ${left}`);

if (left > 0) {
  console.error("\nDIQQAT: kassada boshqa yozuvlar bor — balans QAYTA HISOBLANMADI.");
  console.error("Qo'lda ko'rib chiqing (invariant: balance = methodTotals yig'indisi).");
} else {
  const zeroTotals = Object.fromEntries(Object.keys(box?.methodTotals ?? {}).map((k) => [k, 0]));
  await db.collection("cashboxes").updateOne({ id: CASHBOX_ID }, { $set: { balance: 0, methodTotals: zeroTotals } });
  console.log("kassa balansi nolga tushirildi (yozuv qolmadi).");
}

console.log("\n=== TEKSHIRUV ===");
const after = await db.collection("cashboxes").findOne({ id: CASHBOX_ID }, { projection: { _id: 0, id: 1, name: 1, balance: 1, methodTotals: 1 } });
const sum = Object.values(after?.methodTotals ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
console.log(`  #${after.id} ${after.name}: balance=${after.balance}, turlar=${sum} ${after.balance === sum ? "MOS" : "!!! FARQ"}`);
console.log("  jurnalda #117:", (await db.collection("transaction_entries").countDocuments({ id: ENTRY_ID })) === 0 ? "yo'q" : "HALI BOR");
console.log("  navbatda #117:", (await db.collection("sync_outbox").countDocuments({ entryId: ENTRY_ID })) === 0 ? "yo'q" : "HALI BOR");
console.log("\nENDI JADVALDAN: node scripts/sheets-drop-orphans.mjs --apply");

await c.close();
