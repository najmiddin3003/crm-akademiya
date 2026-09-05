// BIR MARTALIK — edutizimdagi ESKI o'quvchi to'lovlarini `legacy_entries`
// kolleksiyasiga ko'chiradi (o'quvchi profilida ko'rsatish uchun).
//
//   node scripts/import-legacy-entries.mjs            # quruq yurish
//   node scripts/import-legacy-entries.mjs --apply    # yozadi
//
// ══════════════════════════════════════════════════════════════════
// NIMA UCHUN VA QAYSI CHEGARALAR BILAN (markaz talabi, 2026-09-05)
//
// Maqsad BITTA: o'quvchi profilidagi "Tranzaksiyalar tarixi" da uning
// oldin qilgan to'lovlari ko'rinsin. Boshqa hech narsa.
//
// SHUNING UCHUN:
//   • yozuvlar `transaction_entries` GA TUSHMAYDI — alohida
//     `legacy_entries` kolleksiyasiga (sabab lib/legacyEntries.ts da);
//   • 2026-09-01 DAN OLDINGI yozuvlargina olinadi — sentabrdan boshlab
//     haqiqiy CRM ishlayapti, ikkalasi ustma-ust tushmasin;
//   • faqat O'QUVCHI ismi bor KIRIM yozuvlari: oylik, avans, xarajat va
//     kassalararo ko'chirmalar UMUMAN olinmaydi;
//   • `sync_outbox` ga hech narsa qo'yilmaydi — Google Sheets ham,
//     Telegram ham bu yozuvlarni ko'rmaydi;
//   • kassa balansiga, o'quvchi balansiga, oylik hisobiga TEGMAYDI.
//
// MANBA: `scripts/data/*.json` — 2026-08-28 da edutizim API'sidan
// yig'ilgan xom qatorlar (usuli xotirada: edutizim-migration).
import fs from "node:fs";
import { MongoClient } from "mongodb";

const APPLY = process.argv.includes("--apply");
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const FILES = ["nilufar-rows.json", "dilmurod-rows.json", "edutizim-cashbox-rows.json"];
/** Shu sanadan boshlab CRM'ning O'ZI yuritadi — arxivga kirmaydi. */
const CUTOFF = "2026-09-01";

/** Toshkent (UTC+5) devor-vaqti. Edutizim ham shu mintaqada ishlaydi. */
function uzParts(iso) {
  const d = new Date(new Date(iso).getTime() + 5 * 3600_000);
  const s = d.toISOString();
  return { date: s.slice(0, 10), time: s.slice(11, 16) };
}
const digits9 = (v) => String(v ?? "").replace(/\D/g, "").slice(-9);
const normName = (v) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const raw = [];
for (const f of FILES) {
  const j = JSON.parse(fs.readFileSync(`scripts/data/${f}`, "utf8"));
  for (const r of j.rows) raw.push({ ...r, _cashbox: j.cashbox });
}

/**
 * ATAYLAB TASHLAB KETILADIGAN yozuvlar (edutizimdagi `_id` bo'yicha).
 *
 * NEGA KERAK: bu ro'yxatsiz skript qayta ishga tushirilganda markaz
 * qarori bilan o'chirilgan qator TIRILIB kelardi — `sourceId` unikal
 * bo'lgani uchun takror qo'shilmasdi, lekin O'CHIRILGANIDAN keyin
 * bemalol qaytadi. Xuddi shu tuzoq Sheets urug'ida ham bo'lgan.
 *
 *   6949297eed325e86243703f0 — 22.12.2025, Abdulaxat Abdullayev,
 *     27 000 000 000. Edutizimning O'Z xato kirimi; o'sha kuni "Xato
 *     kirim" chiqimi bilan qaytarilgan, lekin u chiqimda o'quvchi ismi
 *     yo'q, ya'ni arxivga tushmaydi va profilda 27 mlrd yolg'iz turib
 *     qolardi. scripts/legacy-drop-bad-row.mjs bilan o'chirilgan.
 */
const SKIP_SOURCE_IDS = new Set(["6949297eed325e86243703f0"]);

const wanted = raw.filter((r) =>
  r.type === "payIn" &&
  String(r.student ?? "").trim() !== "" &&
  !SKIP_SOURCE_IDS.has(String(r.id)) &&
  uzParts(r.at).date < CUTOFF);

const client = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await client.connect();
const db = client.db(env.MONGODB_DB);

// O'quvchini TELEFON bo'yicha topamiz; ism faqat zaxira (izohi
// lib/legacyEntries.ts da).
const pupils = await db.collection("pupils")
  .find({}, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1 } }).toArray();
const byPhone = new Map();
for (const p of pupils) { const k = digits9(p.phone); if (k.length === 9 && !byPhone.has(k)) byPhone.set(k, p.id); }
const byName = new Map();
for (const p of pupils) {
  const k = normName(`${p.firstName ?? ""} ${p.lastName ?? ""}`);
  if (k && !byName.has(k)) byName.set(k, p.id);
}

let nextId = 0;
const docs = [];
const seen = new Set();
for (const r of wanted) {
  if (seen.has(r.id)) continue; // xom fayllarda takror bo'lsa
  seen.add(r.id);
  const { date, time } = uzParts(r.at);
  const pupilId = byPhone.get(digits9(r.studentPhone)) ?? byName.get(normName(r.student)) ?? null;
  docs.push({
    id: ++nextId,
    sourceId: String(r.id),
    date, time,
    at: new Date(r.at).toISOString(),
    amount: Number(r.amount) || 0,
    txType: "payIn",
    txName: String(r.category ?? "").trim(),
    paymentType: String(r.method ?? "").trim(),
    note: String(r.comment ?? "").trim(),
    status: r.state === "cancelled" ? "cancelled" : "",
    studentName: String(r.student ?? "").trim(),
    studentPhone: String(r.studentPhone ?? "").trim(),
    pupilId,
    teacherName: String(r.teacher ?? "").trim(),
    moderator: String(r.moderator ?? "").trim(),
    cashboxName: String(r._cashbox ?? "").trim(),
  });
}

console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===");
console.log(`xom qatorlar: ${raw.length}  ->  ko'chiriladi: ${docs.length}`);
console.log(`chegara: ${CUTOFF} dan oldingilar; faqat o'quvchi ismi bor KIRIM`);

const byMonth = new Map();
for (const d of docs) {
  const m = d.date.slice(0, 7);
  const c = byMonth.get(m) ?? { n: 0, sum: 0 };
  c.n++; c.sum += d.amount;
  byMonth.set(m, c);
}
console.log("\noyma-oy:");
for (const [m, v] of [...byMonth].sort()) console.log(`  ${m}: ${String(v.n).padStart(5)} ta`);
console.log("\nbog'landi:", docs.filter((d) => d.pupilId !== null).length,
  "| bog'lanmadi:", docs.filter((d) => d.pupilId === null).length,
  "| bekor qilingan:", docs.filter((d) => d.status === "cancelled").length);
console.log("takrorsiz o'quvchi (pupilId):", new Set(docs.map((d) => d.pupilId).filter((x) => x !== null)).size);

if (!APPLY) {
  console.log("\nHech narsa yozilmadi. Qo'llash uchun: --apply");
  await client.close();
  process.exit(0);
}

const col = db.collection("legacy_entries");
// `sourceId` UNIKAL: skript ikki marta ishlasa ham yozuv takrorlanmaydi.
await col.createIndex({ sourceId: 1 }, { unique: true });
// O'quvchi profili aynan shu bo'yicha so'raydi.
await col.createIndex({ pupilId: 1, at: -1 });

let inserted = 0;
for (let i = 0; i < docs.length; i += 500) {
  const chunk = docs.slice(i, i + 500);
  try {
    const r = await col.insertMany(chunk, { ordered: false });
    inserted += r.insertedCount;
  } catch (e) {
    // Takror `sourceId` — kutilgan holat (qayta ishga tushirish).
    inserted += e?.result?.insertedCount ?? 0;
    const dup = (e?.writeErrors ?? []).filter((w) => w.code === 11000).length;
    const other = (e?.writeErrors ?? []).filter((w) => w.code !== 11000);
    if (other.length) { console.error("KUTILMAGAN XATO:", other.slice(0, 3)); throw e; }
    if (dup) console.log(`  (${dup} ta takror o'tkazib yuborildi)`);
  }
}
console.log(`\nyozildi: ${inserted}`);
console.log("kolleksiyadagi jami:", await col.countDocuments());

console.log("\n=== TEGILMAGANINI TEKSHIRISH ===");
console.log("transaction_entries:", await db.collection("transaction_entries").countDocuments(), "(o'zgarmagan bo'lishi kerak)");
console.log("sync_outbox:", await db.collection("sync_outbox").countDocuments(), "(0 bo'lishi kerak)");

await client.close();
