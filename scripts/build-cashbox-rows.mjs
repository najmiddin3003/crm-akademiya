// Brauzerdan yig'ilgan XOM API qatorlarini (.ndjson) import-cashbox-api.mjs
// kutadigan JSON shakliga o'giradi.
//
//   node scripts/build-cashbox-rows.mjs --in scripts/data/nilufar.ndjson \
//        --cashbox "Nilufar Akademiya 1" --moderator "Nilufar Sharipova" \
//        --out scripts/data/nilufar-rows.json
//
// ── NIMA UCHUN ALOHIDA QADAM ──────────────────────────────────────────
// "2025 - 2026" kassasida API ism qaytarmagan (u yerda faqat ko'chirma va
// kategoriyali chiqim bor edi), shuning uchun ismlar Exceldan olingan.
// Moderator kassalarida esa API'ning O'ZIDA hamma narsa bor:
//   • `student`  — to'lagan o'quvchi,
//   • `employee` — payIn'da o'quvchining USTOZI (foizli oylik asosi),
//                  payOut'da avans/oylik olgan xodim,
//   • `shiftTransaction.name` — kategoriya nomi.
// Demak Excel kerak emas; bu skript xom qatorni shunchaki qayta shakllantiradi.
//
// ── HOLAT (state) ─────────────────────────────────────────────────────
// Kirim/chiqimda `state` maydoni umuman bo'lmaydi — ular doim amalga
// oshgan. Faqat ko'chirmada bo'ladi: accepted / waiting / rejected /
// cancelled. Yo'qligi "" ga, `accepted` ham "" ga o'giriladi — importer
// shu ikkalasini "faol" deb biladi.
import fs from "node:fs";

const argv = process.argv.slice(2);
const arg = (n, d = "") => { const i = argv.indexOf(n); return i >= 0 ? String(argv[i + 1] ?? "").trim() : d; };
const IN = arg("--in"), OUT = arg("--out"), CASHBOX = arg("--cashbox"), MODERATOR = arg("--moderator");
if (!IN || !OUT || !CASHBOX) {
  console.error('Foydalanish: node scripts/build-cashbox-rows.mjs --in <.ndjson> --cashbox "Nom" --moderator "Ism" --out <.json>');
  process.exit(1);
}

const raw = fs.readFileSync(IN, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));

// Sahifalash paytida yangi to'lov qo'shilsa qator ikki sahifaga tushishi
// mumkin — _id bo'yicha bir marta olinadi.
const seen = new Set();
const uniq = [];
for (const r of raw) { if (seen.has(r._id)) continue; seen.add(r._id); uniq.push(r); }

const problems = [];
let inner = 0;
const rows = uniq.map((r) => {
  const state = r.state === "accepted" || r.state == null || r.state === "" ? "" : r.state;
  if (!["", "waiting", "rejected", "cancelled"].includes(state)) problems.push(`${r._id}: holat "${r.state}"`);
  // Kategoriyasiz kirim/chiqim — kassa ICHIDA to'lov turlari orasidagi
  // ko'chirish (doim juft, yig'indisi nol). Importer uni `transfer` deb
  // yozadi, shuning uchun bu xato emas — faqat sanaladi.
  if (r.type !== "transfer" && !r.cat) inner++;
  const isIn = r.type === "payIn";
  return {
    id: r._id,
    at: r.createdAt,
    amount: r.amount,
    type: r.type,
    state,
    method: r.method,
    category: r.type === "transfer" ? "" : r.cat,
    comment: r.comment ?? "",
    student: isIn ? r.student ?? "" : "",
    studentPhone: isIn ? r.studentPhone ?? "" : "",
    // payIn'dagi `employee` — to'lagan o'quvchining ustozi.
    teacher: isIn ? r.employee ?? "" : "",
    employee: r.type === "payOut" ? r.employee ?? "" : "",
    employeePhone: r.type === "payOut" ? r.employeePhone ?? "" : "",
    moderator: r.moderator ?? "",
    fromCashbox: r.fromCashbox ?? "",
    toCashbox: r.toCashbox ?? "",
    incoming: r.type === "transfer" ? (r.toCashbox === CASHBOX ? 1 : 0) : r.type === "payIn" ? 1 : 0,
    number: r.number,
  };
});

if (problems.length) {
  console.error(`❌ ${problems.length} ta muammoli qator:`);
  for (const p of problems.slice(0, 15)) console.error("   " + p);
  process.exit(1);
}

rows.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
const period = { from: rows[0]?.at ?? "", to: rows[rows.length - 1]?.at ?? "" };
fs.writeFileSync(OUT, JSON.stringify({ cashbox: CASHBOX, moderator: MODERATOR, period, total: rows.length, rows }, null, 0));

const by = (f) => Object.entries(rows.reduce((m, r) => ((m[f(r)] = (m[f(r)] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
console.log(`${IN}: ${raw.length} xom -> ${rows.length} noyob qator (${raw.length - rows.length} takror tashlandi)`);
console.log(`Davr: ${period.from.slice(0, 10)} … ${period.to.slice(0, 10)}`);
console.log("Turlari:", JSON.stringify(Object.fromEntries(by((r) => r.type))));
console.log("Holatlar:", JSON.stringify(Object.fromEntries(by((r) => r.state || "(faol)"))));
if (inner) console.log(`Kassa ichida to'lov turlari orasidagi ko'chirish: ${inner} ta yozuv (${inner / 2} juft)`);
console.log("Ko'chirmalar:", JSON.stringify(Object.fromEntries(by((r) => (r.type === "transfer" ? `${r.fromCashbox} -> ${r.toCashbox}` : "-")).filter(([k]) => k !== "-"))));
const live = rows.filter((r) => r.state === "");
const sum = live.reduce((s, r) => s + (r.type === "transfer" ? (r.incoming ? r.amount : -r.amount) : r.type === "payIn" ? r.amount : -r.amount), 0);
console.log("Faol yozuvlar qoldig'i:", Math.round(sum).toLocaleString("ru-RU"));
console.log("Yozildi:", OUT);
