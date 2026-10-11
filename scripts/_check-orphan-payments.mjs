// FAQAT O'QIYDI — «yetim» o'quvchi to'lovlari (11.10.2026).
//
//   node --env-file=.env.local scripts/_check-orphan-payments.mjs [--branch=4] [--json=fayl]
//
// Sabab (foydalanuvchi: «filial 4 da Mushtariybonu Manyazova to'lov qilgan ammo
// guruh sahifasida balansi chiqmayapti, boshqa o'quvchilarda ham tekshir»):
// guruh sahifasidagi balans (GET /api/students/balances) to'lovni `pupilId`
// bo'yicha o'quvchiga bog'laydi. O'quvchi kartasi O'CHIRILIB, keyin qayta
// kiritilsa, eski to'lovlar o'chirilgan kartaning id'si bilan qoladi va yangi
// kartada balans 0 ko'rinadi.
//
// Uch toifa:
//   A) `pupilId` — bazada YO'Q karta (o'chirilgan). Shu ismli tirik karta
//      bo'lsa — «qayta kiritilgan» nomzod (bir xil filialdagisi ustun).
//   B) `pupilId` siz va ismi hech bir kartaga mos kelmaydi — hech qayerda
//      ko'rinmaydi.
//   C) `pupilId` bor, lekin yozuvdagi ism kartadagidan farq qiladi — ma'lumot
//      uchun (ism keyin o'zgargan bo'lishi mumkin; balans to'g'ri kartada).
//
// Hisob guruh sahifasi bilan bir xil shartda: lib/studentRefund.ts →
// studentBalanceMatch (payIn + o'quvchiga qaytarim, bekor qilinmagan).
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { MongoClient } = require("mongodb");

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const onlyBranch = arg("branch") ? Number(arg("branch")) : null;
const jsonOut = arg("json");

if (!process.env.MONGODB_URI) {
  console.log("MONGODB_URI yo'q");
  process.exit(1);
}
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB || "crm_akademiya");

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
const fullName = (p) => norm(`${p.firstName ?? ""} ${p.lastName ?? ""}`);

const pupils = await db
  .collection("pupils")
  .find({}, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, branchId: 1, status: 1, createdAt: 1 } })
  .toArray();
const byId = new Map(pupils.map((p) => [Number(p.id), p]));
const byName = new Map();
for (const p of pupils) {
  const k = fullName(p);
  if (!k) continue;
  byName.set(k, [...(byName.get(k) ?? []), p]);
}
const cashboxes = new Map(
  (await db.collection("cashboxes").find({}, { projection: { _id: 0, id: 1, name: 1, branchId: 1 } }).toArray()).map((c) => [Number(c.id), c]),
);

const entries = await db
  .collection("transaction_entries")
  .find(
    {
      $or: [{ txType: "payIn" }, { txType: "payOut", studentRefund: true }],
      status: { $ne: "cancelled" },
      studentName: { $nin: ["", null] },
    },
    { projection: { _id: 0, id: 1, date: 1, studentName: 1, pupilId: 1, amount: 1, discountSom: 1, txName: 1, cashboxId: 1, teacherName: 1 } },
  )
  .toArray();

const paid = (e) => (Number(e.amount) || 0) + (Number(e.discountSom) || 0);
const branchOfEntry = (e) => cashboxes.get(Number(e.cashboxId))?.branchId ?? null;

const A = new Map(); // o'chirilgan pupilId → {name, sum, n, entries, candidates}
const B = new Map(); // ism → {sum, n}
const C = []; // ism farqi
for (const e of entries) {
  const pid = Number(e.pupilId);
  const name = norm(e.studentName);
  if (Number.isFinite(pid) && e.pupilId !== null && e.pupilId !== undefined) {
    const p = byId.get(pid);
    if (!p) {
      const x = A.get(pid) ?? { pupilId: pid, name: e.studentName, sum: 0, n: 0, entryIds: [], branches: new Set(), first: e.date, last: e.date };
      x.sum += paid(e);
      x.n++;
      x.entryIds.push(e.id);
      x.branches.add(branchOfEntry(e));
      if (e.date < x.first) x.first = e.date;
      if (e.date > x.last) x.last = e.date;
      A.set(pid, x);
    } else if (fullName(p) !== name) {
      C.push({ entryId: e.id, pupilId: pid, entryName: e.studentName, cardName: `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim(), amount: paid(e) });
    }
  } else if (!byName.has(name)) {
    const x = B.get(name) ?? { name: e.studentName, sum: 0, n: 0, branches: new Set(), entryIds: [] };
    x.sum += paid(e);
    x.n++;
    x.entryIds.push(e.id);
    x.branches.add(branchOfEntry(e));
    B.set(name, x);
  }
}

const fmt = (n) => Math.round(n).toLocaleString("ru-RU");
const branchOk = (set) => onlyBranch === null || [...set].includes(onlyBranch);

console.log(`To'lov yozuvlari: ${entries.length} (payIn + qaytarim, bekor qilinmagan). Kartalar: ${pupils.length}.`);

const aList = [...A.values()]
  .map((x) => {
    const cands = (byName.get(norm(x.name)) ?? []).map((p) => ({ id: p.id, branchId: p.branchId ?? 1, status: p.status ?? "Aktiv", createdAt: p.createdAt }));
    return { ...x, branches: [...x.branches], candidates: cands };
  })
  .filter((x) => branchOk(new Set(x.branches)))
  .sort((a, b) => b.sum - a.sum);
console.log(`\nA) O'CHIRILGAN kartaga bog'langan to'lovlar: ${aList.length} ta karta, ${aList.reduce((s, x) => s + x.n, 0)} yozuv, ${fmt(aList.reduce((s, x) => s + x.sum, 0))} so'm`);
for (const x of aList) {
  const cand = x.candidates.length
    ? x.candidates.map((c) => `#${c.id} (f${c.branchId}, ${c.status}, ${c.createdAt ?? "?"})`).join("; ")
    : "SHU ISMLI TIRIK KARTA YO'Q";
  console.log(`   #${x.pupilId} «${x.name}» f${x.branches.join("/")} — ${x.n} ta, ${fmt(x.sum)} so'm (${x.first}…${x.last}) → ${cand}`);
}

const bList = [...B.values()].map((x) => ({ ...x, branches: [...x.branches] })).filter((x) => branchOk(new Set(x.branches))).sort((a, b) => b.sum - a.sum);
console.log(`\nB) pupilId siz va ismi hech bir kartaga mos kelmaydi: ${bList.length} ta ism, ${bList.reduce((s, x) => s + x.n, 0)} yozuv, ${fmt(bList.reduce((s, x) => s + x.sum, 0))} so'm`);
for (const x of bList.slice(0, 40)) console.log(`   «${x.name}» f${x.branches.join("/")} — ${x.n} ta, ${fmt(x.sum)} so'm (yozuv #${x.entryIds.join(", #")})`);
if (bList.length > 40) console.log(`   … yana ${bList.length - 40} ta`);

console.log(`\nC) Yozuvdagi ism kartadagidan farq qiladi (ma'lumot uchun): ${C.length} yozuv`);
for (const x of C.slice(0, 15)) console.log(`   yozuv #${x.entryId}: «${x.entryName}» → karta #${x.pupilId} «${x.cardName}» (${fmt(x.amount)})`);
if (C.length > 15) console.log(`   … yana ${C.length - 15} ta`);

if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify({ deletedCards: aList, unmatchedNames: bList, nameDiffs: C }, null, 1), "utf8");
  console.log(`\nJSON: ${jsonOut}`);
}
await client.close();
