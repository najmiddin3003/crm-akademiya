// BIR MARTALIK TUZATISH — 2026-08-29.
//
// 29.08.2026 06:42 (UTC) da "Nilufar Akademiya 1 → 2025 - 2026" ko'chirmasi
// XATO qilingan: 1 000 000 so'm. Foydalanuvchi tasdig'i bilan qaytariladi.
//
// Ko'chirish juft yozuv sifatida saqlanadi va /cancel endpoint'i uni
// ataylab qabul qilmaydi (app/api/transaction-entries/[id]/cancel izohiga
// qarang), shu sabab qo'lda qaytariladi.
//
// XAVFSIZ: har bir shart tekshiriladi, mos kelmasa HECH NARSA
// o'zgartirilmaydi. Ikkinchi marta ishga tushirilsa yozuvlar topilmaydi
// va skript to'xtaydi — ikki marta qo'llanmaydi.
import fs from "fs";
import { MongoClient } from "mongodb";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

const OUT_ID = 49179;   // Nilufar Akademiya 1 (kassa 4) — chiqim, -1 000 000
const IN_ID  = 49180;   // 2025 - 2026        (kassa 3) — kirim,  +1 000 000
const AMOUNT = 1000000;
const METHOD = "naqd";
const FROM_CB = 4;      // pul QAYTADIGAN kassa
const TO_CB   = 3;      // pul QAYTARIB OLINADIGAN kassa

const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5 });
await c.connect();
const db = c.db(env.MONGODB_DB);
const entries = db.collection("transaction_entries");
const boxes = db.collection("cashboxes");

const fail = (m) => { console.error("TO'XTATILDI:", m); process.exitCode = 1; };

const out = await entries.findOne({ id: OUT_ID });
const inn = await entries.findOne({ id: IN_ID });
if (!out || !inn) { fail(`yozuvlar topilmadi (${OUT_ID}/${IN_ID}) — ehtimol allaqachon qaytarilgan`); }
else if (out.amount !== -AMOUNT || out.cashboxId !== FROM_CB) { fail(`${OUT_ID} kutilganidek emas: ${out.amount} / kassa ${out.cashboxId}`); }
else if (inn.amount !== AMOUNT || inn.cashboxId !== TO_CB) { fail(`${IN_ID} kutilganidek emas: ${inn.amount} / kassa ${inn.cashboxId}`); }
else {
  const before3 = await boxes.findOne({ id: TO_CB });
  const before4 = await boxes.findOne({ id: FROM_CB });
  if ((before3.methodTotals?.[METHOD] ?? 0) < AMOUNT) fail(`kassa ${TO_CB} da ${METHOD} yetarli emas`);
  else {
    console.log("OLDIN:");
    console.log(`  ${before3.name}: balans ${before3.balance}, ${METHOD} ${before3.methodTotals[METHOD]}`);
    console.log(`  ${before4.name}: balans ${before4.balance}, ${METHOD} ${before4.methodTotals[METHOD]}`);

    await boxes.updateOne({ id: TO_CB },   { $inc: { [`methodTotals.${METHOD}`]: -AMOUNT, balance: -AMOUNT } });
    await boxes.updateOne({ id: FROM_CB }, { $inc: { [`methodTotals.${METHOD}`]:  AMOUNT, balance:  AMOUNT } });

    const delE = await entries.deleteMany({ id: { $in: [OUT_ID, IN_ID] } });
    // Navbatdagi yozuvlar `failed` edi — Sheets/Telegram'ga hech qachon
    // ketmagan, shu sabab tuzatish xabari kerak emas, shunchaki tozalanadi.
    const delQ = await db.collection("sync_outbox").deleteMany({ entryId: { $in: [OUT_ID, IN_ID] } });

    const after3 = await boxes.findOne({ id: TO_CB });
    const after4 = await boxes.findOne({ id: FROM_CB });
    console.log("KEYIN:");
    console.log(`  ${after3.name}: balans ${after3.balance}, ${METHOD} ${after3.methodTotals[METHOD]}`);
    console.log(`  ${after4.name}: balans ${after4.balance}, ${METHOD} ${after4.methodTotals[METHOD]}`);
    console.log(`o'chirildi: ${delE.deletedCount} ta tranzaksiya, ${delQ.deletedCount} ta navbat yozuvi`);
  }
}
await c.close();
