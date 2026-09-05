// FAQAT O'QIYDI. Edutizimdan yig'ilgan xom qatorlarni tahlil qiladi:
// nechtasi o'quvchi to'lovi, qaysi oylarga tegishli, telefon bo'yicha
// bazadagi o'quvchiga qanchasi bog'lanadi.
import fs from "node:fs";
import { MongoClient } from "mongodb";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const FILES = ["nilufar-rows.json", "dilmurod-rows.json", "edutizim-cashbox-rows.json"];
const all = [];
for (const f of FILES) {
  const j = JSON.parse(fs.readFileSync(`scripts/data/${f}`, "utf8"));
  for (const r of j.rows) all.push({ ...r, _cashbox: j.cashbox, _file: f });
}
console.log("xom qatorlar jami:", all.length);

const byType = new Map();
for (const r of all) byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
console.log("turi bo'yicha:", JSON.stringify([...byType]));

/** Toshkent (UTC+5) devor-sanasi — "YYYY-MM-DD". */
const uzDate = (iso) => new Date(new Date(iso).getTime() + 5 * 3600_000).toISOString().slice(0, 10);

// Bizga kerakli qatorlar: O'QUVCHIGA tegishli va 2026-09 dan OLDIN.
const wanted = all.filter((r) =>
  (r.type === "payIn" || r.type === "payOut") &&
  String(r.student ?? "").trim() !== "" &&
  uzDate(r.at) < "2026-09-01");
console.log("\no'quvchiga tegishli va 09.2026 dan oldingi:", wanted.length);

const byMonth = new Map();
for (const r of wanted) {
  const m = uzDate(r.at).slice(0, 7);
  const cur = byMonth.get(m) ?? { n: 0, sum: 0 };
  cur.n += 1; cur.sum += Number(r.amount) || 0;
  byMonth.set(m, cur);
}
console.log("\noyma-oy:");
for (const [m, v] of [...byMonth].sort()) console.log(`  ${m}: ${String(v.n).padStart(5)} ta, ${v.sum.toLocaleString("ru-RU")}`);

const byT = new Map();
for (const r of wanted) byT.set(r.type, (byT.get(r.type) ?? 0) + 1);
console.log("\nturi:", JSON.stringify([...byT]));
console.log("holati:", JSON.stringify([...new Set(wanted.map((r) => r.state))]));
console.log("takrorsiz o'quvchi ismi:", new Set(wanted.map((r) => r.student.trim())).size);
console.log("takrorsiz telefon:", new Set(wanted.map((r) => String(r.studentPhone ?? "").replace(/\D/g, "").slice(-9)).filter((p) => p.length === 9)).size);
console.log("telefonsiz qator:", wanted.filter((r) => String(r.studentPhone ?? "").replace(/\D/g, "").length < 9).length);

// Bazadagi o'quvchilar bilan solishtirish.
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await c.connect();
const db = c.db(env.MONGODB_DB);
const pupils = await db.collection("pupils").find({}, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1 } }).toArray();
const d9 = (v) => String(v ?? "").replace(/\D/g, "").slice(-9);
const byPhone = new Map();
for (const p of pupils) { const k = d9(p.phone); if (k.length === 9 && !byPhone.has(k)) byPhone.set(k, p); }
const byName = new Map();
for (const p of pupils) {
  const k = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim().toLowerCase().replace(/\s+/g, " ");
  if (k && !byName.has(k)) byName.set(k, p);
}
console.log("\nbazadagi o'quvchilar:", pupils.length, "| telefonli:", byPhone.size);

let okPhone = 0, okName = 0, none = 0;
for (const r of wanted) {
  if (byPhone.has(d9(r.studentPhone))) okPhone++;
  else if (byName.has(r.student.trim().toLowerCase().replace(/\s+/g, " "))) okName++;
  else none++;
}
console.log(`bog'landi: telefon bo'yicha ${okPhone}, ism bo'yicha ${okName}, topilmadi ${none}`);
await c.close();
