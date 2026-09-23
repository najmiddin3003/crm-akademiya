// BIR MARTALIK MA'LUMOT KO'CHIRISHI — bazaga YOZADI.
// (`_` bilan boshlanmaydi: `scripts/_*.mjs` faqat o'lchov degani.)
//
//   node scripts/backfill-entry-pupil-id.mjs           # quruq yurish
//   node scripts/backfill-entry-pupil-id.mjs --apply   # haqiqatan yozadi
//
// ------------------------------------------------------------------
// NIMA VA NEGA
//
// 23.09.2026 dan har bir to'lov yozuviga o'quvchining ID'si yoziladi
// (`transaction_entries.pupilId`, lib/transactionEntries.ts). Sababi
// foydalanuvchining shikoyati: bazada 545 ta ism takrorlanadi va ismdosh
// o'quvchilar bir-birining to'lovini ko'rardi — profilda ham, balansda
// ham, qarzdorlik hisobida ham, o'quvchilar botida ham.
//
// Bu o'zgarishdan OLDIN yozilgan yozuvlarda ID yo'q. Ular eskicha, ism
// bo'yicha topiladi (lib/pupilEntries.ts dagi zaxira shox), ya'ni ismdosh
// muammosi AYNAN O'SHA eski qatorlarda qolib ketadi. Skript ularni
// imkon boricha egasiga biriktiradi.
//
// QAYSI YOZUVLAR KO'RILADI:
//   • `txType: "payIn"` — o'quvchining to'lovi;
//   • `txType: "payOut"` + `studentRefund: true` — o'quvchiga qaytarilgan pul.
// Oddiy chiqim KO'RILMAYDI: u yerda `studentName` — XODIM ismi
// (avans/oylik), va uni o'quvchiga bog'lash yangi xato tug'dirardi.
//
// QANDAY ANIQLANADI (birinchi ishlagani olinadi):
//   0. OLDIN SARALASH: yozuv bazaga TUSHGANDAN KEYIN yaratilgan o'quvchi
//      nomzodlikdan chiqadi — u paytda bunday o'quvchi hali yo'q edi.
//      Taqqoslash `entry.createdAt` (tizim qo'ygan o'zgarmas tamg'a) bilan,
//      u bo'lmasa `entry.date` ning oxiri bilan. Saralash HAMMASINI
//      chiqarib yuborsa bekor qilinadi (to'liq ro'yxatga qaytiladi).
//   1. ism bo'yicha YAGONA o'quvchi topilsa — o'sha;
//   2. ism takrorlansa, yozuvdagi `teacherName` — nomzodlardan faqat
//      bittasi o'sha ustozning guruhida bo'lsa, o'sha;
//   3. filial — yozuv kassasining filiali nomzodlardan faqat bittasining
//      filialiga to'g'ri kelsa, o'sha.
// Hech biri yakkalab bermasa yozuv BELGILANMAYDI. Taxmin qilinmaydi:
// noto'g'ri ID yozilsa xato MUHRLANIB qolardi va uni keyin ajratib
// bo'lmasdi, belgilanmagan yozuv esa bugungidek ishlayveradi.
//
// IDEMPOTENT: `pupilId` bor yozuvlar umuman ko'rilmaydi.
//
// QAYTARISH: o'zgargan yozuvlarning id'lari zaxira faylga yoziladi;
// qaytarish uchun har biriga `$unset: { pupilId: "" }` kifoya.
import fs from "fs";
import { MongoClient } from "mongodb";

const APPLY = process.argv.includes("--apply");
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const norm = (v) => String(v ?? "").trim().toLowerCase();
const digits = (v) => String(v ?? "").replace(/\D/g, "");
const fullName = (p) => `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();

/** `pupils.createdAt` — "DD.MM.YYYY | HH:mm". Tanib bo'lmasa null. */
function pupilCreatedAt(v) {
  const m = String(v ?? "").match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? Date.parse(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`) : null;
}

/** Yozuv bazaga qachon tushgan. `createdAt` bo'lmasa — sanasining oxiri. */
function entryWrittenAt(e) {
  const iso = Date.parse(String(e.createdAt ?? ""));
  if (Number.isFinite(iso)) return iso;
  const d = Date.parse(`${String(e.date ?? "")}T23:59:59Z`);
  return Number.isFinite(d) ? d : null;
}

const client = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await client.connect();
const db = client.db(env.MONGODB_DB);
const entries = db.collection("transaction_entries");

// --- ma'lumotnomalar -------------------------------------------------
const pupils = await db.collection("pupils")
  .find({}, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, branchId: 1, createdAt: 1, phone: 1, status: 1 } })
  .toArray();
const byName = new Map();
for (const p of pupils) {
  const k = norm(fullName(p));
  if (!k) continue;
  if (!byName.has(k)) byName.set(k, []);
  byName.get(k).push(p);
}

// O'quvchi -> uning ustozlari (guruh a'zoligi ID bo'yicha yuritiladi).
const groups = await db.collection("groups")
  .find({}, { projection: { _id: 0, teacher: 1, studentIds: 1 } })
  .toArray();
const teachersOfPupil = new Map();
for (const g of groups) {
  const t = norm(g.teacher);
  if (!t) continue;
  for (const sid of g.studentIds ?? []) {
    if (!teachersOfPupil.has(sid)) teachersOfPupil.set(sid, new Set());
    teachersOfPupil.get(sid).add(t);
  }
}

// Kassa -> filial (uchinchi belgi).
const cashboxes = await db.collection("cashboxes")
  .find({}, { projection: { _id: 0, id: 1, branchId: 1 } })
  .toArray();
const branchOfCashbox = new Map(cashboxes.map((c) => [c.id, c.branchId]));

// --- nomzodlar -------------------------------------------------------
const candidates = await entries
  .find(
    {
      pupilId: { $exists: false },
      studentName: { $nin: ["", null] },
      $or: [{ txType: "payIn" }, { txType: "payOut", studentRefund: true }],
    },
    { projection: { _id: 0, id: 1, date: 1, createdAt: 1, studentName: 1, teacherName: 1, cashboxId: 1, amount: 1, txType: 1 } },
  )
  .sort({ id: 1 })
  .toArray();

const plan = [];
const skipped = { topilmadi: [], ajratilmadi: [] };

for (const e of candidates) {
  const all = byName.get(norm(e.studentName)) ?? [];
  if (all.length === 0) { skipped.topilmadi.push(e); continue; }

  // 0) Yozuv yozilgandan KEYIN paydo bo'lgan o'quvchini tashlaymiz — u
  // paytda bunday karta hali yo'q edi. Hammasi tushib qolsa saralashdan
  // voz kechamiz: demak sana ishonchsiz (import qilingan yozuv) va uni
  // dalil sifatida ishlatib bo'lmaydi.
  const writtenAt = entryWrittenAt(e);
  const fresh = writtenAt === null ? all : all.filter((p) => {
    const c = pupilCreatedAt(p.createdAt);
    return c === null || c <= writtenAt;
  });
  const hits = fresh.length > 0 ? fresh : all;

  if (hits.length === 1) {
    plan.push({ e, pupil: hits[0], how: all.length === 1 ? "ism yagona" : "sana" });
    continue;
  }

  // 2) USTOZ bo'yicha.
  const teacher = norm(e.teacherName);
  if (teacher) {
    const m = hits.filter((p) => teachersOfPupil.get(p.id)?.has(teacher));
    if (m.length === 1) { plan.push({ e, pupil: m[0], how: "ustoz" }); continue; }
  }

  // 3) FILIAL bo'yicha.
  const branch = branchOfCashbox.get(e.cashboxId);
  if (branch !== undefined && branch !== null) {
    const m = hits.filter((p) => p.branchId === branch);
    if (m.length === 1) { plan.push({ e, pupil: m[0], how: "filial" }); continue; }
  }

  skipped.ajratilmadi.push({ e, hits });
}

// --- hisobot ---------------------------------------------------------
console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===");
console.log(`baza: ${db.databaseName}   o'quvchi: ${pupils.length}   belgilanmagan yozuv: ${candidates.length}\n`);

const byHow = plan.reduce((a, p) => ((a[p.how] = (a[p.how] ?? 0) + 1), a), {});
console.log("belgilanadi:", plan.length, JSON.stringify(byHow));
console.log("o'quvchi topilmadi:", skipped.topilmadi.length, "(ism `pupils` da yo'q — o'chirilgan yoki xodim)");
console.log("ismdoshlar ajratilmadi:", skipped.ajratilmadi.length, "(eskicha, ism bo'yicha ishlayveradi)\n");

// Ajratilmaganlar ichida BITTA ODAM ikki marta kiritilgan holat ham bor —
// nomzodlarning telefoni bir xil. Ularni ajratishga urinishning ma'nosi
// yo'q: to'g'ri yechim o'quvchi kartalarini BIRLASHTIRISH, undan keyin
// ism yagona bo'lib qoladi va skript ularni o'zi belgilaydi.
const isSamePerson = (hits) => {
  const ph = new Set(hits.map((p) => digits(p.phone)).filter(Boolean));
  return ph.size === 1 && hits.every((p) => digits(p.phone));
};
const merge = skipped.ajratilmadi.filter((x) => isSamePerson(x.hits));
if (merge.length > 0) {
  console.log(`  shundan ${merge.length} tasi — NOMZODLAR TELEFONI BIR XIL, ya'ni bitta o'quvchi`);
  console.log("  ikki marta kiritilgan. Kartalarni birlashtirgach skript ularni o'zi belgilaydi.\n");
}

for (const { e, hits } of skipped.ajratilmadi.slice(0, 40)) {
  console.log(`  ? #${String(e.id).padStart(6)} ${e.date}  ${String(e.studentName).padEnd(28)}` +
    `  ustoz: ${e.teacherName || "—"}  nomzod: ${hits.map((p) => p.id).join(", ")}` +
    `${isSamePerson(hits) ? "  [bitta odam — birlashtirish kerak]" : ""}`);
}
if (skipped.ajratilmadi.length > 40) console.log(`  … va yana ${skipped.ajratilmadi.length - 40} ta (to'liq ro'yxat faylda)`);

// AJRATILMAGANLAR RO'YXATI FAYLGA — bu qo'lda ko'rib chiqiladigan qoldiq.
// Ekranga hammasini chiqarish foydasiz: qaysi to'lov kimniki ekanini
// kassirning o'zi biladi, unga ro'yxat kerak.
if (skipped.ajratilmadi.length > 0 || skipped.topilmadi.length > 0) {
  const stamp0 = new Date().toISOString().replace(/[:.]/g, "-");
  const openPath = `scripts/data/backfill-entry-pupil-id-QOLDIQ-${stamp0}.json`;
  fs.writeFileSync(openPath, JSON.stringify({
    at: new Date().toISOString(),
    ajratilmadi: skipped.ajratilmadi.map(({ e, hits }) => ({
      entryId: e.id, date: e.date, amount: e.amount, studentName: e.studentName,
      teacherName: e.teacherName ?? "", cashboxId: e.cashboxId,
      bittaOdam: isSamePerson(hits),
      nomzodlar: hits.map((h) => ({ id: h.id, phone: h.phone ?? "", status: h.status ?? "Aktiv", branchId: h.branchId })),
    })),
    topilmadi: skipped.topilmadi.map((e) => ({ entryId: e.id, date: e.date, studentName: e.studentName, amount: e.amount })),
  }, null, 2));
  console.log("\nqoldiq ro'yxati:", openPath);
}

if (plan.length > 0) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `scripts/data/backfill-entry-pupil-id-${stamp}.json`;
  fs.writeFileSync(backupPath, JSON.stringify({
    at: new Date().toISOString(),
    rows: plan.map((p) => ({ id: p.e.id, studentName: p.e.studentName, pupilId: p.pupil.id, how: p.how })),
  }, null, 2));
  console.log("\nzaxira:", backupPath);
}

if (!APPLY) {
  console.log("\nHech narsa o'zgartirilmadi. Qo'llash uchun: --apply");
} else {
  // Guruhlab yoziladi: 25 561 to'lovda bittalab yozish uzoq davom etardi.
  const ops = plan.map((p) => ({
    updateOne: {
      // Shart takroran ishga tushirishdan himoya qiladi: oradan boshqa
      // jarayon `pupilId` yozib ulgursa, bu yozuv o'tkazib yuboriladi.
      filter: { id: p.e.id, pupilId: { $exists: false } },
      update: { $set: { pupilId: p.pupil.id } },
    },
  }));
  let n = 0;
  for (let i = 0; i < ops.length; i += 500) {
    const r = await entries.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    n += r.modifiedCount;
  }
  console.log(`\nyangilandi: ${n}`);
  console.log("qoldi (belgilanmagan):", await entries.countDocuments({
    pupilId: { $exists: false },
    studentName: { $nin: ["", null] },
    $or: [{ txType: "payIn" }, { txType: "payOut", studentRefund: true }],
  }));
}

await client.close();
