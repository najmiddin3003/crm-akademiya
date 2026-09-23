// FAQAT O'QIYDI — bazaga hech narsa yozmaydi (`_` prefiksi shuni bildiradi).
//
//   node --import ./scripts/_ts-alias.mjs scripts/_verify-pupil-entries.mjs
//
// Nimani tekshiradi: ismdosh o'quvchilarning to'lovlari HAQIQATAN
// ajraladimi (lib/pupilEntries.ts → pupilEntryMatch).
//
// Qoida bazadagi haqiqiy yozuvlar ustida sinaladi. Yozuvlarga `pupilId`
// QO'YILMAYDI — u quvur ichida `$addFields` bilan SOXTA qo'yiladi, ya'ni
// hujjatlar tegilmaydi, lekin filtr aynan o'zi ishlagandek ishlaydi.
//
// Kutilgan natija:
//   • belgilanmagan (bugungi) holat — ikkala ismdosh BIR XIL qatorlarni
//     ko'radi (eski xatti-harakat, ya'ni hech narsa yo'qolmaydi);
//   • belgilangan holat — A ning yozuvi B ga KO'RINMAYDI.
import fs from "fs";
import { MongoClient } from "mongodb";
import { pupilEntryMatch } from "@/lib/pupilEntries";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const norm = (v) => String(v ?? "").trim().toLowerCase();
const fullName = (p) => `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();

const client = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await client.connect();
const db = client.db(env.MONGODB_DB);
const entries = db.collection("transaction_entries");

// Ismdoshlar.
const pupils = await db.collection("pupils")
  .find({}, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1 } }).toArray();
const byName = new Map();
for (const p of pupils) {
  const k = norm(fullName(p));
  if (!k) continue;
  if (!byName.has(k)) byName.set(k, []);
  byName.get(k).push(p);
}

// To'lovi bor ismdosh juftlik topamiz.
let picked = null;
for (const [k, list] of byName) {
  if (list.length < 2) continue;
  const rows = await entries.find(
    { txType: "payIn", studentName: { $regex: `^\\s*${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, $options: "i" } },
    { projection: { _id: 0, id: 1, amount: 1, studentName: 1 } },
  ).toArray();
  if (rows.length >= 2) { picked = { list, rows }; break; }
}
if (!picked) {
  console.log("Sinov uchun to'lovi bor ismdosh topilmadi — bazada bunday holat yo'q.");
  await client.close();
  process.exit(0);
}

const [A, B] = picked.list;
const nameA = fullName(A);
console.log(`ism: "${nameA}"   o'quvchilar: ${picked.list.map((p) => p.id).join(", ")}`);
console.log(`shu ismdagi payIn yozuvlar: ${picked.rows.length} ta (id: ${picked.rows.map((r) => r.id).join(", ")})\n`);

/** Filtrni ishga tushiradi; `tagged` — shu id'larga soxta `pupilId` qo'yadi. */
async function seenBy(ref, tagged) {
  const pipeline = [];
  if (tagged) {
    pipeline.push({
      $addFields: {
        pupilId: { $cond: [{ $in: ["$id", tagged.ids] }, tagged.pupilId, "$pupilId"] },
      },
    });
  }
  pipeline.push({ $match: pupilEntryMatch(ref) }, { $project: { _id: 0, id: 1 } });
  return (await entries.aggregate(pipeline).toArray()).map((r) => r.id).sort((x, y) => x - y);
}

const refA = { id: A.id, name: nameA };
const refB = { id: B.id, name: fullName(B) };

console.log("--- 1) BELGILANMAGAN (eski yozuvlar) ---");
const a0 = await seenBy(refA, null);
const b0 = await seenBy(refB, null);
console.log(`  #${A.id} ko'radi: ${a0.join(", ")}`);
console.log(`  #${B.id} ko'radi: ${b0.join(", ")}`);
console.log(`  ${JSON.stringify(a0) === JSON.stringify(b0) ? "MOS — eski xatti-harakat saqlangan, hech narsa yo'qolmadi" : "FARQ — kutilmagan!"}\n`);

const firstId = picked.rows[0].id;
console.log(`--- 2) #${firstId} yozuvi #${A.id} ga BELGILANGAN ---`);
const tagged = { ids: [firstId], pupilId: A.id };
const a1 = await seenBy(refA, tagged);
const b1 = await seenBy(refB, tagged);
console.log(`  #${A.id} ko'radi: ${a1.join(", ")}`);
console.log(`  #${B.id} ko'radi: ${b1.join(", ")}`);
console.log(`  ${b1.includes(firstId) ? "XATO — begona yozuv hali ham ko'rinmoqda!" : `TO'G'RI — #${firstId} endi faqat #${A.id} niki`}`);
console.log(`  ${a1.includes(firstId) ? "TO'G'RI — egasi o'z yozuvini ko'ryapti" : "XATO — egasi o'z yozuvini yo'qotdi!"}`);

await client.close();
