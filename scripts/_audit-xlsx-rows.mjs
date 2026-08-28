// FAQAT O'QIYDI — Excel faylning HAR BIR qatorini turkumlaydi.
// Maqsad: import biror qatorni tashlab ketmaganini isbotlash.
import XLSX from "xlsx";
const wb = XLSX.readFile(process.argv[2]);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
const t = (r, i) => String(r?.[i] ?? "").trim();
const blank = (r) => !r.some((c) => String(c).trim() !== "");

console.log("Varaqlar:", wb.SheetNames.join(", "), "(faqat birinchisi o'qiladi)");
console.log("!ref  :", sheet["!ref"]);
console.log("Jami qator (sheet_to_json):", rows.length);

const SECTIONS = ["Ko'chirmalar", "Student Bilan", "Hodim Bilan", "Boshqa"];
let nBlank = 0, nSep = 0, nHeader = 0, nMarker = 0, nSummary = 0, nData = 0;
const dataByCat = {};
let current = "(bo'limdan oldingi)";
const unclassified = [];

rows.forEach((r, i) => {
  if (i <= 8) { nSummary++; return; }                       // jamlanma
  if (blank(r)) { nBlank++; return; }
  const c1 = t(r, 1);
  if (/^-+$/.test(c1)) { nSep++; return; }                  // ajratuvchi chiziq
  if (c1 === "Kassadan" || c1 === "Type") { nHeader++; return; } // ustun sarlavhasi
  if (SECTIONS.includes(c1) && r.filter((x) => String(x).trim() !== "").length === 1) {
    nMarker++; current = c1; return;                         // bo'lim nomi
  }
  nData++;
  dataByCat[current] = (dataByCat[current] ?? 0) + 1;
  if (current === "(bo'limdan oldingi)") unclassified.push(i);
});

console.log("\n=== Qatorlar turkumi ===");
console.log(`  jamlanma (0-8)        ${String(nSummary).padStart(5)}`);
console.log(`  bo'sh                 ${String(nBlank).padStart(5)}`);
console.log(`  ajratuvchi chiziq     ${String(nSep).padStart(5)}`);
console.log(`  ustun sarlavhasi      ${String(nHeader).padStart(5)}`);
console.log(`  bo'lim nomi           ${String(nMarker).padStart(5)}`);
console.log(`  MA'LUMOT QATORI       ${String(nData).padStart(5)}  <- import qilinishi kerak bo'lgani`);
console.log(`  ---------------------------`);
console.log(`  jami                  ${String(nSummary + nBlank + nSep + nHeader + nMarker + nData).padStart(5)}`);

console.log("\n=== Bo'lim bo'yicha ma'lumot qatorlari ===");
for (const [k, v] of Object.entries(dataByCat)) console.log(`  ${k.padEnd(24)} ${String(v).padStart(5)}`);
if (unclassified.length) console.log("  ⚠️  bo'limsiz qatorlar:", unclassified.slice(0, 20).join(", "));

// Summasi yoki vaqti o'qilmaydigan qatorlar bormi (import ularni to'xtatardi).
const LAYOUT = { "Ko'chirmalar": { amt: 4, time: 6 }, "Student Bilan": { amt: 5, time: 9 }, "Hodim Bilan": { amt: 5, time: 7 }, "Boshqa": { amt: 5, time: 7 } };
let cur = null, bad = 0;
rows.forEach((r, i) => {
  if (i <= 8 || blank(r)) return;
  const c1 = t(r, 1);
  if (SECTIONS.includes(c1) && r.filter((x) => String(x).trim() !== "").length === 1) { cur = c1; return; }
  if (/^-+$/.test(c1) || c1 === "Kassadan" || c1 === "Type" || !cur) return;
  const L = LAYOUT[cur];
  const a = Number(String(t(r, L.amt)).replace(/[^\d.-]/g, ""));
  const ok = Number.isFinite(a) && a !== 0 && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(t(r, L.time));
  if (!ok) { bad++; if (bad <= 10) console.log(`  ⚠️  ${i + 1}-qator (${cur}): summa="${t(r, L.amt)}" vaqt="${t(r, L.time)}"`); }
});
console.log(`\nO'qib bo'lmaydigan ma'lumot qatori: ${bad} ta`);

// Sana bo'yicha taqsimot — davr chetlari tekshiruvi uchun.
const dates = [];
cur = null;
rows.forEach((r, i) => {
  if (i <= 8 || blank(r)) return;
  const c1 = t(r, 1);
  if (SECTIONS.includes(c1) && r.filter((x) => String(x).trim() !== "").length === 1) { cur = c1; return; }
  if (/^-+$/.test(c1) || c1 === "Kassadan" || c1 === "Type" || !cur) return;
  const tm = t(r, LAYOUT[cur].time);
  if (/^\d{4}-\d{2}/.test(tm)) dates.push(tm.slice(0, 7));
});
const byMonth = {};
for (const m of dates) byMonth[m] = (byMonth[m] ?? 0) + 1;
console.log("\n=== Oylar bo'yicha qatorlar ===");
for (const m of Object.keys(byMonth).sort()) console.log(`  ${m}  ${String(byMonth[m]).padStart(5)}`);
console.log(`  eng erta: ${dates.slice().sort()[0]} · eng kech: ${dates.slice().sort().at(-1)}`);
