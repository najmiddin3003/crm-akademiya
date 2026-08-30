// Moliyaviy holatni NOLGA tushiradi — edutizim to'lov tarixini yuklashdan
// oldingi tozalash qadami.
//
// Nima o'chadi va NEGA aynan shular:
//   transaction_entries — Tranzaksiyalar jurnali. Barcha to'lov/chiqim
//                         yozuvlari SHU YERDA. O'quvchi to'lovi ham,
//                         xodimga avans/oylik ham. Oylik hisobi alohida
//                         jadvalda saqlanmaydi — u shu yozuvlardan
//                         hisoblanadi (lib/payrollSources.ts), shuning
//                         uchun "chiqarilgan oyliklar"ni o'chirish
//                         demak — shu kolleksiyani tozalash demak.
//   transactions        — Moliya analitikasi/hisobotlari o'qiydigan
//                         parallel jurnal (logTransaction). Yuqoridagisi
//                         bilan JUFT yoziladi, shuning uchun birgalikda
//                         tozalanadi. Aks holda hisobotlarda o'chirilgan
//                         pul ko'rinib turaverardi.
//   salary_runs         — "Oylik chiqarish" partiyalari. Bu yerdagi
//                         `items[].amount` KEYINGI OYGA qoldiq bo'lib
//                         o'tadi (loadCarryOver). Qolsa — o'chirilgan
//                         to'lovlardan tug'ilgan qarz/qoldiq yangi
//                         bazaga sudralib kirardi.
//   sync_outbox         — Google Sheets / Telegram yetkazish navbati.
//                         Yozuvlar o'chgach navbat "yo'q yozuv"ga
//                         ishora qilib qoladi; tozalanmasa import paytida
//                         eski hodisalar qayta yuborilishga urinardi.
//
// Nima QOLADI (ataylab): kassalarning O'ZI, to'lov turlari, soliqlar,
// oylik foizlari, xodimlar, o'quvchilar, guruhlar — bular sozlama va
// roster, pul harakati emas.
//
// Kassalar o'chirilmaydi, faqat NOLLANADI: balance = 0 va methodTotals
// dagi HAR BIR kalit = 0. Kalitlar Sozlamalardagi to'lov turlaridan VA
// hujjatning o'zida bor kalitlardan birlashtiriladi — ro'yxatdan olib
// tashlangan eski tur (masalan "testTolovTuri") hujjatda qolib, unda pul
// osilib qolmasin.
//
//   node scripts/reset-finance.mjs          → quruq yurish, hech nima yozilmaydi
//   node scripts/reset-finance.mjs --yes    → haqiqatan tozalaydi
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const apply = process.argv.includes("--yes");

// To'liq tozalanadigan kolleksiyalar.
const WIPE = ["transaction_entries", "transactions", "salary_runs", "sync_outbox"];
// Bo'sh bo'lishi KUTILADI — bo'sh bo'lmasa ogohlantiramiz, lekin o'z-o'zidan
// tegmaymiz (bonus/jarima qo'lda kiritilgan bo'lishi mumkin).
const EXPECT_EMPTY = ["bonuses", "penalties", "pupil_activity"];

const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 });
await client.connect();
const db = client.db(process.env.MONGODB_DB);

console.log(`Baza: ${db.databaseName}`);
console.log(apply ? "TOZALANADI\n" : "QURUQ YURISH — hech narsa yozilmaydi\n");

console.log("O'chiriladigan yozuvlar:");
for (const name of WIPE) {
  const n = await db.collection(name).countDocuments();
  console.log(`  ${name.padEnd(24)} ${String(n).padStart(6)} → 0`);
  if (apply && n > 0) await db.collection(name).deleteMany({});
}

console.log("\nKassalar (o'chirilmaydi, nollanadi):");
const methodKeys = (await db.collection("settings_payment_methods").find({}).toArray())
  .map((m) => m.key)
  .filter(Boolean);
for (const c of await db.collection("cashboxes").find({}).sort({ id: 1 }).toArray()) {
  const keys = [...new Set([...methodKeys, ...Object.keys(c.methodTotals ?? {})])];
  const zero = Object.fromEntries(keys.map((k) => [k, 0]));
  console.log(`  id=${c.id} "${c.name}"  balance ${c.balance} → 0  (${keys.length} to'lov turi nollandi)`);
  if (apply) {
    await db.collection("cashboxes").updateOne({ id: c.id }, { $set: { balance: 0, methodTotals: zero } });
  }
}

console.log("\nBo'sh bo'lishi kutilganlar:");
for (const name of EXPECT_EMPTY) {
  const n = await db.collection(name).countDocuments();
  console.log(`  ${name.padEnd(24)} ${String(n).padStart(6)}${n ? "  ← TEGILMADI, ko'zdan kechiring" : ""}`);
}

if (apply) {
  console.log("\n— Tekshiruv —");
  let ok = true;
  for (const name of WIPE) {
    const n = await db.collection(name).countDocuments();
    if (n !== 0) { ok = false; console.log(`  ✗ ${name} = ${n}`); }
  }
  for (const c of await db.collection("cashboxes").find({}).toArray()) {
    const sum = Object.values(c.methodTotals ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
    if (c.balance !== 0 || sum !== 0) { ok = false; console.log(`  ✗ kassa ${c.id}: balance=${c.balance} totals=${sum}`); }
  }
  console.log(ok ? "  ✓ Barcha to'lov, oylik va kassa qoldiqlari 0." : "  Yuqoridagi nomuvofiqliklarni tekshiring.");
}

await client.close();
console.log(apply ? "\nTayyor — endi Excel import qilsa bo'ladi." : "\n--yes qo'shsangiz haqiqatan tozalanadi.");
