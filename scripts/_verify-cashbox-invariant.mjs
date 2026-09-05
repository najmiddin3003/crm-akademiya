// FAQAT O'QIYDI. Kassalarning ASOSIY INVARIANTI:
//
//     balance  ===  methodTotals yig'indisi  ===  jurnal yig'indisi
//
// Uchalasi ham bir xil bo'lishi SHART. 2026-09-03 da Nilufar kassasi
// minusga tushgan edi: `methodTotals.plastik` da jurnalsiz soxta +1
// turgan, ya'ni birinchi tenglik buzilgan edi va buni hech narsa
// sezmasdi. Shundan beri qoida — pulga tegadigan har amaldan KEYIN
// shu skriptni yurgizish.
//
// KUTILAYOTGAN ko'chirma (`status: "waiting"`) jurnal yig'indisiga
// KIRMAYDI: pul jo'natuvchi kassadan chiqib bo'lgan, qabul qiluvchida
// esa hali yo'q. Shuning uchun jo'natuvchi tomonda manfiy qator DARHOL
// hisoblanadi, qabul qiluvchidagi musbat qator esa tasdiqlangunicha
// hisobga olinmaydi.
import fs from "fs";
import { MongoClient } from "mongodb";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await c.connect();
const db = c.db(env.MONGODB_DB);

const boxes = await db.collection("cashboxes")
  .find({}, { projection: { _id: 0, id: 1, name: 1, balance: 1, methodTotals: 1 } }).sort({ id: 1 }).toArray();

let bad = 0;
console.log("kassa                              balance      turlar     jurnal   holat");
for (const b of boxes) {
  const totals = Object.values(b.methodTotals ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
  // Jurnal: bekor qilinganlar chiqadi; kutilayotgan ko'chirmaning
  // MUSBAT (qabul qiluvchi) tomoni ham hali hisobga olinmaydi.
  const rows = await db.collection("transaction_entries")
    .find({ cashboxId: b.id, status: { $ne: "cancelled" } }, { projection: { _id: 0, amount: 1, status: 1 } })
    .toArray();
  const journal = rows
    .filter((r) => !(r.status === "waiting" && Number(r.amount) > 0))
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const ok = b.balance === totals && b.balance === journal;
  if (!ok) bad++;
  console.log(
    `#${b.id} ${String(b.name).padEnd(30)} ${String(b.balance).padStart(10)} ` +
    `${String(totals).padStart(10)} ${String(journal).padStart(10)}   ${ok ? "MOS" : "!!! FARQ"}`,
  );
}

console.log(bad === 0 ? "\nHammasi mos." : `\n${bad} ta kassada farq bor — qo'lda ko'rib chiqing.`);
await c.close();
process.exit(bad === 0 ? 0 : 1);
