// FAQAT O'QIYDI — edutizim "cashbox" eksportini bo'limlarga ajratib tahlil qiladi.
//
// Bo'limlarning ustun tartibi HAR XIL (fayldan aniqlangan):
//   Ko'chirmalar  : 1=Kassadan 2=Kassaga 3=Comment 4=Amount 5=PaymentType 6=Time
//   Student Bilan : 1=Type 2=Kim 3=Tel 4=Comment 5=Amount 6=PaymentType
//                   7=Teacher 8=TeacherTel 9=Time 10=Groups 11=Courses
//                   12=Sub 13=Price 14=LessonTime 15=Holat
//   Hodim Bilan   : 1=Type 2=Kim 3=Tel 4=Comment 5=Amount 6=PaymentType 7=Time … 15=Holat
//   Boshqa        : Hodim Bilan bilan bir xil
import XLSX from "xlsx";
const wb = XLSX.readFile(process.argv[2]);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
const t = (r, i) => String(r?.[i] ?? "").trim();
const num = (v) => Number(String(v ?? "").replace(/[^\d.-]/g, "")) || 0;
const fmt = (n) => n.toLocaleString("ru-RU");
const blank = (r) => !r.some((c) => String(c).trim() !== "");

const LAYOUT = {
  "Ko'chirmalar": { amt: 4, pt: 5, time: 6, who: 1, to: 2, note: 3, status: 7 },
  "Student Bilan": { amt: 5, pt: 6, time: 9, type: 1, who: 2, phone: 3, note: 4, teacher: 7, tphone: 8, group: 10, course: 11, sub: 12, price: 13, lesson: 14, status: 15 },
  "Hodim Bilan": { amt: 5, pt: 6, time: 7, type: 1, who: 2, phone: 3, note: 4, status: 15 },
  "Boshqa": { amt: 5, pt: 6, time: 7, type: 1, who: 2, phone: 3, note: 4, status: 15 },
};

const marks = [];
rows.forEach((r, i) => {
  const c = r.map((x) => String(x).trim());
  if (i > 9 && c.filter(Boolean).length === 1 && LAYOUT[c[1]]) marks.push({ i, name: c[1] });
});

const HDR = {};
for (let i = 0; i <= 8; i++) HDR[t(rows[i], 4)] = { out: num(t(rows[i], 5)), net: num(t(rows[i], 6)), in: num(t(rows[i], 7)) };
console.log(`Kassa: "${t(rows[3],1)}" · filial: ${t(rows[2],1)} · davr: ${t(rows[0],1)} — ${t(rows[1],1)}`);
console.log(`Fayl sarlavhasidagi jamlanma: kirim ${fmt(HDR.NetIncome.in)} · chiqim ${fmt(HDR.NetIncome.out)} · SOF ${fmt(HDR.NetIncome.net)}\n`);

const all = {};
for (let k = 0; k < marks.length; k++) {
  const { i, name } = marks[k];
  const L = LAYOUT[name];
  const end = marks[k + 1]?.i ?? rows.length;
  const body = rows.slice(i + 1, end).filter((r) => !blank(r) && !/^-+$/.test(t(r, 1)) && t(r, 1) !== "Type");
  all[name] = { body, L };

  const byType = {}, byStatus = {}, byKind = {};
  let sum = 0;
  for (const r of body) {
    const a = num(t(r, L.amt));
    sum += a;
    byType[t(r, L.pt) || "(bo'sh)"] = (byType[t(r, L.pt) || "(bo'sh)"] ?? 0) + a;
    const st = t(r, L.status) || "(normal)";
    byStatus[st] = (byStatus[st] ?? 0) + 1;
    if (L.type) byKind[t(r, L.type)] = (byKind[t(r, L.type)] ?? 0) + a;
  }
  const times = body.map((r) => t(r, L.time)).filter(Boolean).sort();
  console.log(`=== "${name}" — ${body.length} qator · jami ${fmt(sum)} · ${times[0]} … ${times.at(-1)} ===`);
  console.log("   holat:", Object.entries(byStatus).map(([a, b]) => `${a}=${b}`).join(" · "));
  console.log("   to'lov turi:", Object.entries(byType).map(([a, b]) => `${a}=${fmt(b)}`).join(" · "));
  if (L.type) console.log("   turi:", Object.entries(byKind).map(([a, b]) => `${a}=${fmt(b)}`).join(" · "));
  console.log();
}

// ── Sarlavhadagi jamlanma bilan solishtirish ────────────────────────────
// Faraz: Ko'chirmalar + Student = kirim, Hodim = chiqim, Boshqa = aralash.
const live = (name) => all[name].body.filter((r) => !/bekor/i.test(t(r, all[name].L.status)));
const sumOf = (name, rs) => rs.reduce((s, r) => s + num(t(r, all[name].L.amt)), 0);

console.log("=== SARLAVHA BILAN SOLISHTIRISH ===");
const koch = sumOf("Ko'chirmalar", live("Ko'chirmalar"));
const stud = sumOf("Student Bilan", live("Student Bilan"));
const hodim = sumOf("Hodim Bilan", live("Hodim Bilan"));
const bosh = sumOf("Boshqa", live("Boshqa"));
console.log(`  Ko'chirmalar (bekor qilinmagan) : ${fmt(koch)}`);
console.log(`  Student Bilan                   : ${fmt(stud)}`);
console.log(`  Hodim Bilan                     : ${fmt(hodim)}`);
console.log(`  Boshqa                          : ${fmt(bosh)}`);
console.log(`  KIRIM sarlavhada                : ${fmt(HDR.NetIncome.in)}`);
console.log(`  Ko'chirmalar + Student          : ${fmt(koch + stud)}   farq: ${fmt(koch + stud - HDR.NetIncome.in)}`);
console.log(`  CHIQIM sarlavhada               : ${fmt(Math.abs(HDR.NetIncome.out))}`);
console.log(`  Hodim + Boshqa                  : ${fmt(hodim + bosh)}   farq: ${fmt(hodim + bosh - Math.abs(HDR.NetIncome.out))}`);

console.log("\n=== 'Boshqa' bo'limi to'liq (yo'nalishini aniqlash uchun) ===");
for (const r of all["Boshqa"].body) {
  const L = all["Boshqa"].L;
  console.log(`  ${t(r,L.time).padEnd(17)} ${t(r,L.type).padEnd(16)} ${fmt(num(t(r,L.amt))).padStart(15)} ${t(r,L.pt).padEnd(17)} ${t(r,L.note)}${t(r,L.status) ? "  ["+t(r,L.status)+"]" : ""}`);
}
