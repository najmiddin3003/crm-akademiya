// Xodimlarga QAT'IY OYLIKNI (oklad) biriktiradi: ro'yxatdagi har bir xodimning
// `hr_employees.branchAssignments` massivini filial bo'yicha qayta yozadi.
// Oylik hisobi (lib/payrollSources.ts -> fixedSalaryOf) aynan shu yig'indiga
// tayanadi.
//
// Sukut bo'yicha QURUQ YURISH. Yozish uchun `--yes`.
//
//   node scripts/import-employee-salaries.mjs scripts/data/moderator-salaries.txt
//   node scripts/import-employee-salaries.mjs scripts/data/moderator-salaries.txt --yes
//
// RO'YXAT FORMATI — har qatorda bitta xodim:
//
//   #53 = Akademiya: 2 000 000; Akademiya 2-filial: 2 000 000
//   #50 = Akademiya: 3 500 000
//   #50 = 3 500 000                  <- filial ko'rsatilmasa `--branch` oladi
//
// Chapda xodim (`#id` yoki to'liq ism), o'ngda `;` bilan ajratilgan filial
// qatorlari: `<filial nomi>: <summa>`. `//` bilan boshlangan qatorlar va
// bo'sh qatorlar o'tkazib yuboriladi (`#` faqat raqam oldidan kelsa id
// hisoblanadi, aks holda u ham izoh).
//
// XODIMNING BUTUN OKLAD RO'YXATI QATOR BILAN ALMASHTIRILADI. Ya'ni qatorda
// ko'rsatilmagan filialdagi eski summa O'CHADI. Bu ataylab: ro'yxat manbasi
// (edutizim kartasi) xodimning to'liq holatini beradi, qo'shimcha qilmaydi.
// Ilgari yozilgan rol va ish jadvali esa saqlanadi.
//
// NIMA UCHUN ID AFZAL: bazada ismlari deyarli bir xil xodimlar bor
// (#29 "Shohruh Ahmadjanov" va #43 "Shohruh Axmadjanov" — turli telefon,
// turli odam). Ism bo'yicha moslashtirish noto'g'ri odamga oylik yozib
// qo'yishi mumkin, shuning uchun ism takrorlansa skript qatorni
// O'TKAZIB YUBORADI va uni muammo sifatida ko'rsatadi.
//
// YETISHMAYDIGAN FILIAL: nomi `branches` da topilmasa skript to'xtaydi.
// `--create-branches` bilan esa uni ro'yxatga qo'shadi (yozish, avvalgidek,
// faqat `--yes` bo'lganda).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const argv = process.argv.slice(2);
const APPLY = argv.includes("--yes");
const CREATE_BRANCHES = argv.includes("--create-branches");
// Sukut bo'yicha faqat moderatorlarga yoziladi — ro'yxatdagi ism tasodifan
// o'qituvchiga mos kelib qolsa, uning foizli oyligi okladga aylanib ketmasin.
const ti = argv.indexOf("--turi");
const TURI = ti > -1 ? argv[ti + 1] : "moderator";
const bi = argv.indexOf("--branch");
const DEFAULT_BRANCH = bi > -1 ? argv[bi + 1] : null;
// DIQQAT: `ti`/`bi` = -1 bo'lsa argv[0] — ya'ni fayl yo'li — tasodifan
// "option qiymati" deb hisoblanib, fayl argumenti yo'qolib qoladi.
const optionValues = new Set([ti > -1 ? argv[ti + 1] : null, bi > -1 ? argv[bi + 1] : null].filter(Boolean));
const FILE = argv.find((a) => !a.startsWith("--") && !optionValues.has(a));

if (!FILE) {
  console.error('Foydalanish: node scripts/import-employee-salaries.mjs "<royxat.txt>" [--turi moderator|teacher|any] [--branch "<nom>"] [--create-branches] [--yes]');
  process.exit(1);
}

const norm = (v) => String(v ?? "").replace(/[’ʻʼ`]/g, "'").replace(/\s+/g, " ").trim();
const key = (v) => norm(v).toLowerCase();
const fmt = (n) => n.toLocaleString("ru-RU");

// ------------------------------------------------------------- ro'yxat

const wanted = [];
const problems = [];
const rawLines = fs.readFileSync(FILE, "utf8").split(/\r?\n/);
for (let i = 0; i < rawLines.length; i++) {
  const row = i + 1;
  const line = rawLines[i].trim();
  if (!line || line.startsWith("//")) continue;
  // Izoh: `#` dan keyin darhol raqam kelmasa — bu izoh qatori.
  if (line.startsWith("#") && !/^#\s*\d/.test(line)) continue;

  const m = line.match(/^(.*?)\s*=\s*(.+)$/);
  if (!m) { problems.push(`${row}-qator: "=" topilmadi -> "${line}"`); continue; }

  const left = m[1].trim();
  const idm = left.match(/^#\s*(\d+)$/);

  const parts = [];
  let bad = false;
  for (const chunk of m[2].split(";")) {
    const s = chunk.trim();
    if (!s) continue;
    // "Akademiya 2-filial: 2 000 000" — oxirgi ":" dan keyingisi summa.
    const c = s.lastIndexOf(":");
    const branchName = c > -1 ? s.slice(0, c).trim() : "";
    const amountRaw = c > -1 ? s.slice(c + 1) : s;
    const amount = Number(String(amountRaw).replace(/[^\d]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      problems.push(`${row}-qator: summa o'qilmadi -> "${s}"`);
      bad = true;
      break;
    }
    if (!branchName && !DEFAULT_BRANCH) {
      problems.push(`${row}-qator: filial ko'rsatilmagan va --branch berilmagan -> "${s}"`);
      bad = true;
      break;
    }
    parts.push({ branchName: branchName || DEFAULT_BRANCH, amount });
  }
  if (bad || !parts.length) continue;

  wanted.push({ row, id: idm ? Number(idm[1]) : null, name: idm ? "" : norm(left), parts });
}

console.log(`Ro'yxat: ${FILE}`);
console.log(`${wanted.length} ta xodim qatori, tur filtri: ${TURI}\n`);

// --------------------------------------------------------------- baza

const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 });
await client.connect();
const db = client.db(process.env.MONGODB_DB || "crm_akademiya");
const employees = db.collection("hr_employees");
const branchesCol = db.collection("branches");

// 1) Filiallar. Ro'yxatda yangi nom uchrasa — `--create-branches` bilan
//    rejalashtiramiz, haqiqiy yozish 4-bosqichda (faqat --yes bo'lganda).
const branchPool = await branchesCol.find({}).sort({ id: 1 }).toArray();
let nextBranchId = Math.max(0, ...branchPool.map((b) => Number(b.id) || 0)) + 1;
const missingBranches = [];
function resolveBranch(name) {
  const found = branchPool.find((b) => key(b.name) === key(name));
  if (found) return found;
  if (!CREATE_BRANCHES) {
    if (!missingBranches.includes(norm(name))) missingBranches.push(norm(name));
    return null;
  }
  const made = { id: nextBranchId++, name: norm(name), location: "", __create: true };
  branchPool.push(made);
  return made;
}

// 2) Xodimlarni moslashtirish.
const all = await employees.find({}).sort({ id: 1 }).toArray();
const byId = new Map(all.map((e) => [Number(e.id), e]));
const byName = new Map();
for (const e of all) {
  const k = key(e.name);
  byName.set(k, byName.has(k) ? "AMBIGUOUS" : e);
}

const plan = [];
const seen = new Set();
for (const w of wanted) {
  let emp;
  if (w.id !== null) {
    emp = byId.get(w.id);
    if (!emp) { problems.push(`${w.row}-qator: #${w.id} — bunday id li xodim yo'q`); continue; }
  } else {
    const found = byName.get(key(w.name));
    if (!found) { problems.push(`${w.row}-qator: "${w.name}" — bazada topilmadi`); continue; }
    if (found === "AMBIGUOUS") { problems.push(`${w.row}-qator: "${w.name}" — ism bir necha xodimda uchradi, id bilan yozing (#N)`); continue; }
    emp = found;
  }
  if (TURI !== "any" && emp.turi !== TURI) {
    problems.push(`${w.row}-qator: ${emp.name} — bazada "${emp.turi}", "${TURI}" emas`);
    continue;
  }
  if (seen.has(emp.id)) { problems.push(`${w.row}-qator: ${emp.name} (#${emp.id}) ro'yxatda takrorlangan`); continue; }

  const before = Array.isArray(emp.branchAssignments) ? emp.branchAssignments : [];
  const next = [];
  let bad = false;
  for (const p of w.parts) {
    const branch = resolveBranch(p.branchName);
    if (!branch) { bad = true; continue; }
    if (next.some((a) => a.branchId === branch.id)) {
      problems.push(`${w.row}-qator: "${branch.name}" filiali qatorda ikki marta`);
      bad = true;
      continue;
    }
    const cur = before.find((a) => Number(a?.branchId) === branch.id);
    next.push({
      branchId: branch.id,
      roleId: cur?.roleId ?? null,      // rol va ish jadvali tegilmaydi
      scheduleId: cur?.scheduleId ?? null,
      salary: Math.trunc(p.amount),
    });
  }
  if (bad) continue;
  next.sort((a, b) => a.branchId - b.branchId);
  seen.add(emp.id);

  const nameOf = (id) => branchPool.find((b) => b.id === id)?.name ?? `id=${id}`;
  const sum = (rows) => rows.reduce((s, a) => s + (Number(a?.salary) || 0), 0);
  plan.push({ emp, before, next, beforeTotal: sum(before), afterTotal: sum(next), nameOf });
}

// Filial nomi topilmasa — hech narsa yozmaymiz, chunki summa noto'g'ri
// filialga tushib ketishi mumkin.
if (missingBranches.length) {
  console.error(`XATO: quyidagi filial(lar) "branches" da yo'q:`);
  for (const n of missingBranches) console.error(`  - "${n}"`);
  console.error(`\nMavjudlari: ${branchPool.map((b) => `${b.id}="${b.name}"`).join(", ")}`);
  console.error(`Ularni avtomatik qo'shish uchun --create-branches qo'shing.`);
  await client.close();
  process.exit(1);
}

// ------------------------------------------------------------- hisobot

const eq = (a, b) =>
  a.length === b.length &&
  a.every((x) => b.some((y) => Number(y.branchId) === Number(x.branchId) && (Number(y.salary) || 0) === (Number(x.salary) || 0)));
const changed = plan.filter((p) => !eq(p.before, p.next));
const same = plan.filter((p) => eq(p.before, p.next));

const newBranches = branchPool.filter((b) => b.__create);
if (newBranches.length) {
  console.log(`Yangi filial(lar) yaratiladi:`);
  for (const b of newBranches) console.log(`  id=${b.id}  "${b.name}"`);
  console.log("");
}

console.log(`Moslashtirildi: ${plan.length}/${wanted.length}`);
for (const p of plan) {
  const mark = eq(p.before, p.next) ? "o'zgarishsiz" : `${p.beforeTotal ? fmt(p.beforeTotal) : "sozlanmagan"} -> ${fmt(p.afterTotal)}`;
  console.log(`  #${String(p.emp.id).padStart(3)} ${String(p.emp.name).padEnd(28)} ${mark}`);
  // Filial bo'yicha tafsilot: yo'qolayotgan qatorlar ham ko'rinsin.
  const ids = [...new Set([...p.before.map((a) => Number(a.branchId)), ...p.next.map((a) => a.branchId)])].sort((a, b) => a - b);
  for (const id of ids) {
    const b = Number(p.before.find((a) => Number(a.branchId) === id)?.salary) || 0;
    const n = Number(p.next.find((a) => a.branchId === id)?.salary) || 0;
    if (b === n) continue;
    const arrow = b === 0 ? `(yo'q) -> ${fmt(n)}` : n === 0 ? `${fmt(b)} -> O'CHADI` : `${fmt(b)} -> ${fmt(n)}`;
    console.log(`        ${String(p.nameOf(id)).padEnd(22)} ${arrow}`);
  }
}

if (problems.length) {
  console.log(`\nMUAMMOLAR (${problems.length}) — bu qatorlar O'TKAZIB YUBORILADI:`);
  for (const s of problems) console.log(`  ${s}`);
}

// Ro'yxatga tushmagan xodimlar — e'tibordan chetda qolmasin.
if (TURI !== "any") {
  const missing = all.filter((e) => e.turi === TURI && !seen.has(e.id));
  if (missing.length) {
    console.log(`\nRo'yxatda YO'Q "${TURI}" xodimlar (${missing.length}) — ularga tegilmaydi:`);
    for (const e of missing) {
      const t = (e.branchAssignments ?? []).reduce((s, a) => s + (Number(a?.salary) || 0), 0);
      console.log(`  #${String(e.id).padStart(3)} ${String(e.name).padEnd(28)} hozirgi oklad: ${t ? fmt(t) : "sozlanmagan"}`);
    }
  }
}

// -------------------------------------------------------------- yozish

if (!APPLY) {
  console.log(`\nQURUQ YURISH — hech narsa yozilmadi. Yozish uchun --yes qo'shing.`);
  console.log(`Yoziladi: ${changed.length} ta xodim${newBranches.length ? ` + ${newBranches.length} ta filial` : ""} (${same.length} tasi allaqachon shunday).`);
  await client.close();
  process.exit(0);
}

for (const b of newBranches) {
  const { __create, ...doc } = b;
  await branchesCol.insertOne(doc);
  console.log(`Filial qo'shildi: id=${doc.id} "${doc.name}"`);
}
let n = 0;
for (const p of changed) {
  const res = await employees.updateOne({ id: p.emp.id }, { $set: { branchAssignments: p.next } });
  n += res.modifiedCount;
}
console.log(`\nYOZILDI: ${n} ta xodimning okladi yangilandi, ${same.length} tasi o'zgarishsiz qoldi.`);
if (problems.length) console.log(`${problems.length} ta qator o'tkazib yuborildi — yuqoridagi muammolarga qarang.`);
await client.close();
