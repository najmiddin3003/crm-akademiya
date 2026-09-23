// FAQAT O'QIYDI — bazaga hech narsa yozmaydi (`_` prefiksi shuni bildiradi).
//
//   node --import ./scripts/_ts-alias.mjs scripts/_verify-unassigned-route.mjs
//
// Nimani tekshiradi: "egasi aniqlanmagan to'lovlar" oqimining IKKALA
// route'ini — HTTP'siz, handler funksiyalarini to'g'ridan-to'g'ri chaqirib.
//
//   GET  /api/transaction-entries/unassigned   — javob shakli to'liqmi;
//   PATCH /api/transaction-entries/:id/pupil   — QOROVULLAR ishlaydimi.
//
// PATCH sinovlari ATAYLAB faqat RAD ETILADIGAN holatlar: har biri
// yozishdan OLDIN to'xtaydi, ya'ni skript bazani o'zgartirmaydi. Eng
// muhimi — "xodim chiqimi" qorovuli: `studentName` da xodim ismi
// turadigan avans/oylik yozuvini o'quvchiga bog'lab bo'lmasligi kerak,
// aks holda xodimning puli bolaning balansiga qo'shilib ketardi.
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const s = line.trim(); if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("="); if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const { GET } = await import("@/app/api/transaction-entries/unassigned/route");
const { PATCH } = await import("@/app/api/transaction-entries/[id]/pupil/route");
const { MongoClient } = await import("mongodb");

console.log("=== GET /unassigned ===");
const d = await (await GET()).json();
console.log("ok:", d.ok, "| count:", d.count);
if (d.ok && d.count > 0) {
  const withC = d.entries.filter((e) => e.candidates.length > 0);
  console.log(
    "nomzodli:", withC.length,
    "| nomzodsiz:", d.entries.length - withC.length,
    "| telefoni bir xil:", d.entries.filter((e) => e.samePerson).length,
  );
  const keys = ["id","date","time","amount","studentName","teacherName","txName","paymentType","moderator","note","samePerson","candidates"];
  const bad = d.entries.filter((x) => keys.some((k) => x[k] === undefined));
  console.log("maydoni tushib qolgan yozuv:", bad.length, "(0 bo'lishi kerak)");
  const e = withC[0];
  if (e) {
    console.log(`namuna #${e.id} ${e.date} "${e.studentName}" ${e.amount} | ustoz: ${e.teacherName || "—"}`);
    for (const c of e.candidates) {
      console.log(`   nomzod #${c.id} ${c.phone || "tel yo'q"} ${c.status} f${c.branchId}` +
        ` | guruh: ${c.groups.join(" · ") || "yo'q"} | to'lov: ${c.paidCount} ta`);
    }
  }
}

console.log("\n=== PATCH /:id/pupil — qorovullar ===");
const cl = new MongoClient(process.env.MONGODB_URI); await cl.connect();
const db = cl.db(process.env.MONGODB_DB);
const te = db.collection("transaction_entries");
const payout = await te.findOne(
  { txType: "payOut", studentRefund: { $ne: true }, studentName: { $nin: ["", null] } },
  { projection: { _id: 0, id: 1 } },
);
const payin = await te.findOne({ txType: "payIn" }, { projection: { _id: 0, id: 1 } });
const pupil = await db.collection("pupils").findOne({}, { projection: { _id: 0, id: 1 } });

const call = async (id, body) => {
  const req = new Request("http://x", {
    method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
  });
  const r = await PATCH(req, { params: Promise.resolve({ id: String(id) }) });
  return { status: r.status, body: await r.json() };
};

const cases = [
  ["id harf", "abc", { pupilId: pupil.id }],
  ["pupilId berilmagan", payin.id, {}],
  ["yozuv yo'q", 999999, { pupilId: pupil.id }],
  ["XODIM chiqimi", payout?.id ?? 999999, { pupilId: pupil.id }],
  ["o'quvchi yo'q", payin.id, { pupilId: 999999 }],
];
for (const [name, id, body] of cases) {
  const r = await call(id, body);
  const ok = r.status >= 400 && !r.body.ok;
  console.log(`  ${ok ? "RAD" : "O'TDI!"}  ${String(r.status).padEnd(4)} ${name.padEnd(20)} ${r.body.error ?? ""}`);
}

console.log("\nxodim chiqimida pupilId bormi:",
  await te.countDocuments({ txType: "payOut", studentRefund: { $ne: true }, pupilId: { $exists: true } }),
  "(0 bo'lishi kerak)");
await cl.close();
process.exit(0);
