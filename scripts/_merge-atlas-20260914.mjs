// 14.09.2026 — Vercel (Atlas) ga adashib tushgan filial 1 (Nilufar) kunlik
// ishini prod (VPS) bazasiga ko'chirish.
//
//   node scripts/_merge-atlas-20260914.mjs [diff.json]            # quruq yurish
//   node scripts/_merge-atlas-20260914.mjs [diff.json] --apply    # yozadi
//
// NIMA BO'LGAN: prod 12.09 da VPS'ga ko'chdi, lekin Vercel loyihasi va
// unga biriktirilgan tizimli24.uz domeni o'chirilmagan. Nilufarning
// kompyuteri DNS'ni eskicha hal qilib Vercel'ga kirgan, Vercel esa Atlas
// (endi faqat zaxira ko'zgusi) ga yozgan. Telegram/SMS o'sha yerdan ketgan.
//
// KIRISH: scripts/_diff-atlas-baseline.mjs natijasi — Atlas'ni kechagi
// zaxira (Atlas'ning kun boshidagi holati) bilan solishtirib topilgan
// YANGI hujjatlar: transaction_entries, transactions, sync_outbox,
// sms_messages, orders, pupils. O'zgartirilgan hujjat faqat kassa 4 edi
// (u qayta hisoblanadi).
//
// ID'LAR: VPS bugun o'z yozuvlariga o'sha raqamlarni berib bo'lgan
// (jurnal 375–393 Dilmurod/Abdulvoris, o'quvchi 16985–16995, buyurtma
// 158–159). Shuning uchun har hujjat prod'da YANGI id oladi (max+1,
// Atlas tartibida); asl id `migratedFrom` da qoladi. `_id` saqlanadi —
// shu bilan skript idempotent: bor hujjat qayta yozilmaydi.
//
// KASSA 4: Atlas'da 11.09 dagi ko'chirmalar hali tasdiqlanmagan edi
// (naqd 3 012 000 turgan), VPS'da esa rahbar ularni bugun qabul qilgan
// (kassa 0). Shu bois har yozuvning `before/after` VPS qoldig'idan qayta
// hisoblanadi; kassa hujjati har yozuvdan keyin `$inc` bilan yangilanadi
// (ilova qanday qilsa shunday).
//
// NAVBAT: Telegram xabari allaqachon ketgan (Atlas messageId saqlanadi,
// qayta yuborilmaydi); Sheets qatori esa ESKI id bilan yozilgan — vazifa
// `pending/sheetDone:false` qilib qo'yiladi, keyingi flush yangi id bilan
// qator qo'shadi. VPS'ning o'z 375+ yozuvlari ham qayta yoziladi: ikki
// server bir jadvalga bir xil id bilan yozib bir-birinikini ustidan
// bosgan. Noto'g'ri varaqda qolgan eski qatorlar — alohida tozalash.
import fs from "fs";
import { MongoClient, ObjectId } from "mongodb";

const APPLY = process.argv.includes("--apply");
const diffPath = process.argv.find((a) => a.endsWith(".json")) || "/var/www/crm/shared/atlas-diff-20260914.json";
const SOURCE = "atlas-vercel-2026-09-14";
const CASHBOX = 4;

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
if (/mongodb\.net/.test(env.MONGODB_URI)) {
  console.error("MONGODB_URI Atlas'ga qaragan — bu skript faqat VPS (prod) bazasi uchun."); process.exit(1);
}
const diff = JSON.parse(fs.readFileSync(diffPath, "utf8"));
const added = (name) => (diff.collections[name]?.added ?? []).map((d) => ({ ...d, _id: new ObjectId(d._id.$oid ?? d._id) }));

const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await c.connect();
const db = c.db(env.MONGODB_DB);

// QAYTA YURITISH: Nilufar kun davomida Vercel'da ishlashda davom etgan,
// diff har safar HAMMA yangi hujjatni beradi. Allaqachon ko'chirilganlar
// (`_id` prod'da bor) id hisoblashdan va kassa yig'indisidan OLDIN
// chiqarib tashlanadi — aks holda id'larda bo'shliq qolar va qolganlarning
// `before/after` i ikki marta sanalgan bo'lardi.
const fresh = async (name, docs) => {
  const have = new Set((await db.collection(name).find({ _id: { $in: docs.map((d) => d._id) } }, { projection: { _id: 1 } }).toArray()).map((d) => String(d._id)));
  return docs.filter((d) => !have.has(String(d._id)));
};
const entriesIn = await fresh("transaction_entries", added("transaction_entries").sort((a, b) => a.id - b.id));
const txIn = await fresh("transactions", added("transactions").sort((a, b) => a.id - b.id));
const outboxIn = await fresh("sync_outbox", added("sync_outbox").sort((a, b) => a.entryId - b.entryId));
const smsIn = await fresh("sms_messages", added("sms_messages").sort((a, b) => a.id - b.id));
const ordersIn = await fresh("orders", added("orders").sort((a, b) => a.id - b.id));
const pupilsIn = await fresh("pupils", added("pupils").sort((a, b) => a.id - b.id));
// Navbat vazifasi jurnal yozuvi bilan birga keladi; yozuv oldingi
// yurishda ko'chgan bo'lsa uning vazifasi ham ko'chgan — xaritada
// bo'lmaganlari quyida o'tkazib yuboriladi.

// Kutilgan hajm — boshqa narsa chiqsa to'xtaymiz (skript aynan shu hodisa uchun).
//
// KO'CHIRMA (kun oxiridagi topshiruv, 17:57): juft qator — chiquvchi
// (kassa 4, manfiy, `deductedOnSend: false`) va kiruvchi (rahbar kassa 3,
// musbat), ikkalasi ham `waiting`, `transferId` = chiquvchining Atlas id'si.
// Pul tasdiqlangunicha kassa 4 da turadi — kassa hujjatiga tegilmaydi,
// `transferId` yangi id'ga xaritalanadi (app/api/cashboxes/[id]/transfer-to).
const PRIMARY = 3;
const isTransfer = (e) => e.txType === "transfer";
const bad = [];
if (!entriesIn.every((e) => (e.cashboxId === CASHBOX && e.moderator === "Nilufar Sharipova") || (isTransfer(e) && e.transferRole === "in" && e.cashboxId === PRIMARY))) bad.push("jurnalda kassa 4 / Nilufar bo'lmagan yozuv bor");
if (!entriesIn.every((e) => typeof e.paymentMethodKey === "string" && e.paymentMethodKey)) bad.push("paymentMethodKey yo'q yozuv bor");
if (!entriesIn.every((e) => e.txType === "payIn" || e.txType === "payOut" || isTransfer(e))) bad.push("noma'lum txType bor");
const atlasIds = new Set(entriesIn.map((e) => e.id));
for (const e of entriesIn.filter(isTransfer)) {
  if (e.status !== "waiting") bad.push(`ko'chirma #${e.id} holati "${e.status}" — faqat "waiting" kutilgan edi`);
  if (e.transferRole === "out" && e.deductedOnSend !== false) bad.push(`ko'chirma #${e.id} eski qoidada (deductedOnSend yo'q)`);
  if (!atlasIds.has(e.transferId)) bad.push(`ko'chirma #${e.id} jufti (transferId ${e.transferId}) diff'da yo'q`);
}
if (!txIn.every((t) => t.cashboxId === CASHBOX)) bad.push("transactions'da kassa 4 bo'lmagan yozuv bor");
if (!ordersIn.every((o) => o.branchId === 1) || !pupilsIn.every((p) => p.branchId === 1)) bad.push("filial 1 bo'lmagan buyurtma/o'quvchi bor");
const changedOther = Object.entries(diff.collections).filter(([n, r]) => (r.changed.length || r.deleted.length) && !["cashboxes", "user_sessions"].includes(n));
if (changedOther.length) bad.push("kutilmagan o'zgargan/o'chgan hujjatlar: " + changedOther.map(([n]) => n).join(","));
if (bad.length) { console.error("TO'XTADI:\n  " + bad.join("\n  ")); process.exit(1); }
if (!entriesIn.length && !txIn.length && !smsIn.length && !ordersIn.length && !pupilsIn.length) {
  console.log("Ko'chiriladigan yangi hujjat yo'q — hammasi allaqachon prod'da."); await c.close(); process.exit(0);
}
const maxId = async (name, field = "id", filter = {}) =>
  Number((await db.collection(name).find(filter).sort({ [field]: -1 }).limit(1).toArray())[0]?.[field]) || 0;
const exists = async (name, _id) => Boolean(await db.collection(name).findOne({ _id }, { projection: { _id: 1 } }));

console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===");
console.log("manba:", diffPath, "| yaratilgan:", diff.generatedAt);

// ── Kassa 4 hozirgi holati ──
const box = await db.collection("cashboxes").findOne({ id: CASHBOX });
if (!box) { console.error("Kassa 4 topilmadi"); process.exit(1); }
console.log(`\nKassa 4 hozir: balance ${box.balance}, ${JSON.stringify(box.methodTotals)}`);
const accepted = await db.collection("transaction_entries")
  // Qabul qilingan ko'chirma — `status: ""` (lib/transferDecision.ts).
  .find({ cashboxId: CASHBOX, txType: "transfer", transferRole: "out", status: "" }, { projection: { _id: 0, id: 1, amount: 1, decidedAt: 1, createdAt: 1 } })
  .sort({ id: -1 }).limit(6).toArray();
console.log("Kassa 4 oxirgi qabul qilingan ko'chirmalar (decidedAt — 'oxirgi topshiruv' lahzasi):");
for (const t of accepted) console.log("  ", JSON.stringify(t));

// ── Yangi id'lar ──
const entryStart = (await maxId("transaction_entries")) + 1;
const txStart = (await maxId("transactions")) + 1;
const pupilStart = (await maxId("pupils")) + 1;
const orderStart = (await maxId("orders")) + 1;
const branchNoStart = (await maxId("orders", "branchNo", { branchId: 1 })) + 1;
const smsStart = (await maxId("sms_messages")) + 1;
const vpsOwnMax = entryStart - 1;

const entryMap = new Map(entriesIn.map((e, i) => [e.id, entryStart + i]));
console.log(`\nJurnal: ${entriesIn.length} ta, Atlas ${entriesIn[0]?.id}–${entriesIn.at(-1)?.id} → VPS ${entryStart}–${entryStart + entriesIn.length - 1}`);
console.log(`transactions: ${txIn.length} ta → ${txStart}+ | o'quvchilar: ${pupilsIn.length} ta → ${pupilStart}+ | buyurtmalar: ${ordersIn.length} ta → ${orderStart}+ (filial № ${branchNoStart}+) | sms: ${smsIn.length} ta → ${smsStart}+`);

// ── before/after va kassa yig'indilari ──
const running = { ...(box.methodTotals ?? {}) };
const primary = await db.collection("cashboxes").findOne({ id: PRIMARY }, { projection: { methodTotals: 1 } });
const incByMethod = {};
let incBalance = 0;
const plan = [];
for (const e of entriesIn) {
  const key = e.paymentMethodKey;
  if (isTransfer(e)) {
    // Balans o'zgarmaydi; `before` — ilova yozganidek, o'sha kassaning joriy qoldig'i.
    const before = Number((e.transferRole === "out" ? running : primary?.methodTotals ?? {})[key] ?? 0);
    if (e.transferRole === "out" && before < -Number(e.amount)) console.log(`  ! ko'chirma #${e.id}: ${key} qoldig'i (${before}) summadan (${-e.amount}) kam — tasdiqlashda yetmaydi`);
    plan.push({ ...e, newId: entryMap.get(e.id), before, after: null });
    continue;
  }
  const before = Number(running[key] ?? 0);
  const after = before + Number(e.amount);
  if (after < 0) { console.error(`MANFIY: yozuv ${e.id} (${key}) ${before} + ${e.amount} = ${after}`); process.exit(1); }
  running[key] = after;
  incByMethod[key] = (incByMethod[key] ?? 0) + Number(e.amount);
  incBalance += Number(e.amount);
  plan.push({ ...e, newId: entryMap.get(e.id), before, after });
}
console.log("\nKassa 4 ga qo'shiladi:", JSON.stringify(incByMethod), "| balans +" + incBalance, "→", box.balance + incBalance);
console.log("\n#Atlas → #VPS | sana vaqt | tur | kim | summa | tur | before→after");
for (const p of plan) {
  if (isTransfer(p)) console.log(`  ${p.id} → ${p.newId} | ${p.date} ${p.time} | transfer/${p.transferRole} k${p.cashboxId} (juft ${p.transferId} → ${entryMap.get(p.transferId)}) | ${p.amount} | ${p.paymentMethodKey} | ${p.before}→(kutilmoqda)`);
  else console.log(`  ${p.id} → ${p.newId} | ${p.date} ${p.time} | ${p.txType} ${p.txName} | ${p.studentName || "-"} | ${p.amount} | ${p.paymentMethodKey} | ${p.before}→${p.after}`);
}

if (!APPLY) { console.log("\nHech narsa yozilmadi. Qo'llash uchun: --apply"); await c.close(); process.exit(0); }

// ── YOZISH (har biri idempotent: _id bo'lsa o'tkazib yuboriladi) ──
const stamp = { source: SOURCE, at: new Date().toISOString() };
let n = 0;

for (let i = 0; i < pupilsIn.length; i += 1) {
  const p = pupilsIn[i];
  if (await exists("pupils", p._id)) continue;
  await db.collection("pupils").insertOne({ ...p, id: pupilStart + i, migratedFrom: { ...stamp, id: p.id } });
  n += 1;
}
console.log("o'quvchilar yozildi:", n); n = 0;

for (let i = 0; i < ordersIn.length; i += 1) {
  const o = ordersIn[i];
  if (await exists("orders", o._id)) continue;
  await db.collection("orders").insertOne({ ...o, id: orderStart + i, branchNo: branchNoStart + i, migratedFrom: { ...stamp, id: o.id, branchNo: o.branchNo } });
  n += 1;
}
console.log("buyurtmalar yozildi:", n); n = 0;

for (let i = 0; i < smsIn.length; i += 1) {
  const m = smsIn[i];
  if (await exists("sms_messages", m._id)) continue;
  await db.collection("sms_messages").insertOne({ ...m, id: smsStart + i, migratedFrom: { ...stamp, id: m.id } });
  n += 1;
}
console.log("sms jurnali yozildi:", n); n = 0;

for (let i = 0; i < txIn.length; i += 1) {
  const t = txIn[i];
  if (await exists("transactions", t._id)) continue;
  await db.collection("transactions").insertOne({ ...t, id: txStart + i, migratedFrom: { ...stamp, id: t.id } });
  n += 1;
}
console.log("transactions yozildi:", n); n = 0;

// Jurnal + kassa: yozuv avval (idempotent), keyin kassa $inc. Ikkisi
// orasida uzilsa — invariant skripti (balance < jurnal) ko'rsatadi.
for (const p of plan) {
  const { newId, before, after, ...e } = p;
  if (await exists("transaction_entries", e._id)) continue;
  if (isTransfer(e)) {
    // Kutilayotgan juft: kassa hujjatiga tegilmaydi, faqat `transferId` yangi id.
    await db.collection("transaction_entries").insertOne({
      ...e, id: newId, before, after: null, transferId: entryMap.get(e.transferId),
      migratedFrom: { ...stamp, id: e.id, transferId: e.transferId, before: e.before },
    });
    n += 1;
    continue;
  }
  await db.collection("transaction_entries").insertOne({
    ...e, id: newId, before, after,
    migratedFrom: { ...stamp, id: e.id, before: e.before, after: e.after },
  });
  await db.collection("cashboxes").updateOne(
    { id: CASHBOX },
    { $inc: { [`methodTotals.${e.paymentMethodKey}`]: Number(e.amount), balance: Number(e.amount) } },
  );
  n += 1;
}
console.log("jurnal yozildi:", n); n = 0;

for (const o of outboxIn) {
  if (await exists("sync_outbox", o._id)) continue;
  const entryId = entryMap.get(o.entryId);
  if (!entryId) continue;
  await db.collection("sync_outbox").insertOne({
    ...o, entryId,
    // Telegram ketgan (xabar id saqlanadi), Sheets yangi id bilan qayta yoziladi.
    status: "pending", sheetDone: false, telegramDone: true,
    attempts: 0, lastError: null, nextAttemptAt: null, doneAt: null,
    updatedAt: new Date().toISOString(),
    migratedFrom: { ...stamp, entryId: o.entryId },
  });
  n += 1;
}
console.log("navbat yozildi:", n);

// VPS'ning o'z bugungi yozuvlari — Sheets qatorini qayta yozdirish
// (Atlas o'sha id'lar bilan ustidan bosgan bo'lishi mumkin).
const reset = await db.collection("sync_outbox").updateMany(
  { entryId: { $gte: 375, $lte: vpsOwnMax }, status: "done", migratedFrom: { $exists: false } },
  { $set: { status: "pending", sheetDone: false, nextAttemptAt: null, updatedAt: new Date().toISOString() } },
);
console.log(`VPS 375–${vpsOwnMax} navbat qayta ochildi (faqat Sheets):`, reset.modifiedCount);

const boxAfter = await db.collection("cashboxes").findOne({ id: CASHBOX }, { projection: { _id: 0, balance: 1, methodTotals: 1 } });
console.log("\nKassa 4 endi:", JSON.stringify(boxAfter));
fs.writeFileSync("/var/www/crm/shared/atlas-merge-20260914-map.json", JSON.stringify({ ...stamp, entryMap: Object.fromEntries(entryMap), entryStart, txStart, pupilStart, orderStart, smsStart, vpsOwnMax }, null, 1));
console.log("Xarita: /var/www/crm/shared/atlas-merge-20260914-map.json");
await c.close();
