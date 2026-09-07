// FAQAT O'QIYDI (bazaga tegmaydi). "O'QUVCHILAR RO'YXATI.xlsx" dan
// o'quvchilarni ajratib oladi, birlashtiradi va nima chiqqanini ko'rsatadi.
//
//   node scripts/_extract-uchqorgon-pupils.mjs "<fayl yo'li>" [--json <chiqish>]
//
// Varaqlar ikki xil tuzilishda:
//   QABUL              : No | F,I,SH | FAN | KUNI | TEL1 | TEL2
//   IYUL/AVGUST/SENTYABR: No | O'QITUVCHI | F.I.SH | TEL1 | TEL2 | FAN | KUNI | SOAT | KELGAN SANA | TO'LOV | TO'LASH KERAK
// Oylik varaqlarning O'NG TOMONIGA butunlay boshqa jadval (RASXODLAR/CHIQIM/
// KIRIM) yopishtirilgan — shuning uchun faqat kerakli ustunlar o'qiladi.
import XLSX from "xlsx";
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error('Foydalanish: node scripts/_extract-uchqorgon-pupils.mjs "<fayl>"');
  process.exit(1);
}

const wb = XLSX.readFile(file);
const cell = (r, i) => String(r[i] ?? "").trim();

/** Ism kaliti — takrorni topish uchun (registr va ortiqcha bo'shliqsiz). */
const nameKey = (s) => s.toUpperCase().replace(/[’'`]/g, "'").replace(/\s+/g, " ").trim();

/**
 * Telefon -> bazadagi format "94 155 88 55" (2-3-2-2).
 * Excel'da raqamlar son bo'lib saqlangani uchun boshidagi nol yo'qolgan
 * bo'lishi mumkin; 9 xonaga to'ldiriladi. 998 prefiksi olib tashlanadi.
 */
function normPhone(raw) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return { phone: "", note: "" };
  if (d.length === 12 && d.startsWith("998")) d = d.slice(3);
  if (d.length === 10 && d.startsWith("8")) d = d.slice(1);
  if (d.length === 8) d = "0" + d;
  if (d.length !== 9) return { phone: "", note: `yaroqsiz raqam: ${raw}` };
  return { phone: `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`, note: "" };
}

/** "MUXIDDINOVA BARNO" -> { lastName: "MUXIDDINOVA", firstName: "BARNO" } */
function splitName(full) {
  const parts = nameKey(full).split(" ").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return { firstName: title(parts[0]), lastName: "" };
  return { lastName: title(parts[0]), firstName: parts.slice(1).map(title).join(" ") };
}
const title = (w) => w.charAt(0) + w.slice(1).toLowerCase();

const rows = [];
const problems = [];

function push(sheet, rowIdx, full, tel1, tel2, fan, kuni, soat, oqituvchi, kelgan) {
  const name = String(full ?? "").trim();
  if (!name) return;
  // Sarlavha/jami qatorlari o'quvchi emas.
  if (/^(F[.,]?\s*I[.,]?\s*SH|JAMI|UMUMIY|O'?QITUVCHI)/i.test(name)) return;
  if (/^\d+$/.test(name)) return;
  const split = splitName(name);
  if (!split) return;
  const p1 = normPhone(tel1);
  const p2 = normPhone(tel2);
  if (p1.note) problems.push(`${sheet}!${rowIdx + 1} ${name}: ${p1.note}`);
  rows.push({
    sheet,
    row: rowIdx + 1,
    full: nameKey(name),
    ...split,
    phone: p1.phone,
    extraPhone: p2.phone,
    fan: String(fan ?? "").trim().toUpperCase(),
    kuni: String(kuni ?? "").trim(),
    soat: String(soat ?? "").trim(),
    oqituvchi: String(oqituvchi ?? "").trim().toUpperCase(),
    kelgan: String(kelgan ?? "").trim(),
  });
}

for (const sheet of wb.SheetNames) {
  if (sheet === "OQITUVCHILAR") continue;
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "", raw: false });
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.every((c) => String(c).trim() === "")) continue;
    if (sheet === "QABUL") {
      push(sheet, i, cell(r, 1), cell(r, 4), cell(r, 5), cell(r, 2), cell(r, 3), "", "", "");
    } else {
      push(sheet, i, cell(r, 2), cell(r, 3), cell(r, 4), cell(r, 5), cell(r, 6), cell(r, 7), cell(r, 1), cell(r, 8));
    }
  }
}

// ── Birlashtirish ────────────────────────────────────────────────────────
// Kalit: ISM. Telefon ikkinchi darajali tekshiruv (bir xil ismda boshqa
// raqam bo'lsa — ayting, ehtimol ikki xil odam).
const byName = new Map();
for (const r of rows) {
  const k = r.full;
  if (!byName.has(k)) byName.set(k, []);
  byName.get(k).push(r);
}

const merged = [];
const conflicts = [];
for (const [key, list] of byName) {
  const phones = [...new Set(list.map((r) => r.phone).filter(Boolean))];
  if (phones.length > 1) conflicts.push({ name: key, phones, where: list.map((r) => `${r.sheet}!${r.row}`) });
  const best = list.find((r) => r.phone) ?? list[0];
  merged.push({
    firstName: best.firstName,
    lastName: best.lastName,
    full: key,
    phone: phones[0] ?? "",
    extraPhone: [...new Set(list.map((r) => r.extraPhone).filter(Boolean))][0] ?? "",
    fanlar: [...new Set(list.map((r) => r.fan).filter(Boolean))],
    oqituvchilar: [...new Set(list.map((r) => r.oqituvchi).filter(Boolean))],
    kunlar: [...new Set(list.map((r) => r.kuni).filter(Boolean))],
    soatlar: [...new Set(list.map((r) => r.soat).filter(Boolean))],
    manbalar: [...new Set(list.map((r) => `${r.sheet}!${r.row}`))],
  });
}

merged.sort((a, b) => a.full.localeCompare(b.full));

console.log(`=== VARAQLAR ===`);
for (const s of wb.SheetNames) {
  const n = rows.filter((r) => r.sheet === s).length;
  console.log(`  ${s.padEnd(12)} ${s === "OQITUVCHILAR" ? "(o'tkazib yuborildi — o'qituvchilar)" : n + " ta o'quvchi qatori"}`);
}
console.log(`\nJami qator: ${rows.length}   ->   noyob o'quvchi: ${merged.length}`);
console.log(`Telefonsiz: ${merged.filter((m) => !m.phone).length}`);
console.log(`Familiyasiz (bir so'zli ism): ${merged.filter((m) => !m.lastName).length}`);

console.log(`\n=== FANLAR ===`);
const fanCount = new Map();
for (const m of merged) for (const f of m.fanlar) fanCount.set(f, (fanCount.get(f) ?? 0) + 1);
for (const [f, n] of [...fanCount].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${f}`);

console.log(`\n=== O'QITUVCHILAR (oylik varaqlardan) ===`);
const tCount = new Map();
for (const m of merged) for (const t of m.oqituvchilar) tCount.set(t, (tCount.get(t) ?? 0) + 1);
for (const [t, n] of [...tCount].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${t}`);

if (conflicts.length) {
  console.log(`\n=== BIR XIL ISM, BOSHQA RAQAM (${conflicts.length} ta) ===`);
  for (const c of conflicts) console.log(`  ${c.name}: ${c.phones.join(" / ")}   (${c.where.join(", ")})`);
}

console.log(`\n=== BIRINCHI 25 TA (qo'shiladigan ko'rinishda) ===`);
for (const m of merged.slice(0, 25)) {
  console.log(`  ${(m.firstName + " " + m.lastName).trim().padEnd(32)} ${m.phone.padEnd(14)} ${m.fanlar.join("/")}`);
}

if (problems.length) {
  console.log(`\n=== RAQAM MUAMMOLARI (${problems.length} ta) ===`);
  for (const p of problems.slice(0, 20)) console.log("  " + p);
}

const outIdx = process.argv.indexOf("--json");
if (outIdx > 0 && process.argv[outIdx + 1]) {
  fs.writeFileSync(process.argv[outIdx + 1], JSON.stringify(merged, null, 2), "utf8");
  console.log(`\nJSON yozildi: ${process.argv[outIdx + 1]}`);
}
