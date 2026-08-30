// Excel'dan ommaviy import: o'quvchilar + xodimlar.
//
// Sukut bo'yicha QURUQ YURISH — bazaga hech narsa yozilmaydi. Haqiqatan
// bajarish uchun `--yes` kerak.
//
//   node scripts/import-from-excel.mjs             → nima bo'lishini ko'rsatadi
//   node scripts/import-from-excel.mjs --yes       → bajaradi
//
// Oldin ALBATTA zaxira oling: node scripts/_backup-db.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { MongoClient } from "mongodb";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const APPLY = process.argv.includes("--yes");
const PUPILS_XLSX = "C:/Users/zovaxx/Downloads/2026-08-25_03-22-43_672baaafbb66a0508f7647fa.xlsx";
const STAFF_XLSX = "C:/Users/zovaxx/Downloads/1787628231430.xlsx";
const HELD_OUT_XLSX = path.join(ROOT, "..", "tekshirish-kerak-oquvchilar.xlsx");

// O'quvchi id'lari 10001 dan boshlanadi. SABABI: /student-edit/[id] sahifasi
// `?src=list` bo'lmasa avval DEMO buyurtma generatoridan qidiradi
// (lib/ordersData.ts, 502 ta id, oralig'i 2098–6013). Bir nechta sahifa
// (Tug'ilgan kunlar, Guruh o'quvchilari, Nazorat davomat, Ota-onalar)
// havolani src=list SIZ yasaydi, shuning uchun id'si o'sha oraliqqa tushgan
// o'quvchi ochilganda BOSHQA odamning demo kartochkasi ko'rinardi.
const PUPIL_ID_START = 10001;

// ---------------------------------------------------------------- yordamchilar

/** Uch xil apostrof bir xillashtiriladi, ortiqcha bo'shliq olib tashlanadi. */
const norm = (v) => String(v ?? "").replace(/[\u2019\u02BB\u02BC`]/g, "'").replace(/\s+/g, " ").trim();

/** Familiya qo'shimchalari — ism/familiya tartibini aniqlash uchun. */
const SUR = /(ov|ova|ev|eva|yev|yeva)$/i;

/**
 * "+998941558855" → "94 155 88 55" (ilova saqlaydigan mahalliy format).
 * Formatga tushmagan qiymat bo'sh satr sifatida qaytadi — soxta raqam
 * yasalmaydi.
 */
function localPhone(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  const d = digits.startsWith("998") ? digits.slice(3) : digits;
  if (d.length !== 9) return "";
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}

/** "2024-11-12 11:44:27" → "12.11.2024 | 11:44" */
function fmtCreated(raw) {
  const m = String(raw ?? "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]} | ${m[4]}:${m[5]}`;
}

function fmtNow(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * ISM/FAMILIYA TARTIBI. Fayl bir xil emas: 1–1350-qatorlar (2024-11-12 dagi
 * ommaviy import) A=FAMILIYA, B=ism; 1351-qatordan boshlab A=ism,
 * B=FAMILIYA — ya'ni sarlavha faqat ikkinchi blok uchun to'g'ri.
 * O'lchov: 1-blokda A ustunining 99.0% i familiya qo'shimchali, 2-blokda 6.4%.
 *
 * Shu bois tartib qatorma-qator, qo'shimchaga qarab aniqlanadi; ikkalasi ham
 * (yoki hech biri) qo'shimchali bo'lsa — o'sha blokning odatiy tartibi.
 */
function resolveName(a, b, rowNo) {
  const legacy = rowNo <= 1350;
  if (!b) {
    const toks = a.split(" ").filter(Boolean);
    if (toks.length === 2) {
      const s0 = SUR.test(toks[0]);
      const s1 = SUR.test(toks[1]);
      if (s0 && !s1) return { firstName: toks[1], lastName: toks[0], rule: "A ichida bo'lindi" };
      if (!s0 && s1) return { firstName: toks[0], lastName: toks[1], rule: "A ichida bo'lindi" };
    }
    return { firstName: a, lastName: "", rule: "B bo'sh" };
  }
  const sa = SUR.test(a);
  const sb = SUR.test(b);
  if (sa && !sb) return { firstName: b, lastName: a, rule: "A = familiya" };
  if (!sa && sb) return { firstName: a, lastName: b, rule: "B = familiya" };
  return legacy
    ? { firstName: b, lastName: a, rule: "blok odatiysi (legacy)" }
    : { firstName: a, lastName: b, rule: "blok odatiysi (modern)" };
}

/** Eski tizim holati → ilovadagi PUPIL_STATUSES. Bo'sh holat "Aktiv". */
const STATUS_MAP = {
  "": "Aktiv",
  active: "Aktiv",
  new: "Aktiv",
  archive: "Arxiv",
  "pro-archive": "Arxiv",
  graduated: "Arxiv",
};

/**
 * Import qilinmaydigan qatorlar: ism o'rnida axlat yoki bitta yozuvda bir
 * necha bola. Ular alohida Excel'ga chiqariladi — o'chirilmaydi, egasi
 * ko'rib chiqib qo'lda qo'shadi.
 */
function heldOutReason(a, b) {
  const full = `${a} ${b}`.trim();
  if (a.includes(",") || b.includes(",")) return "bitta yozuvda bir necha bola";
  if (!/[A-Za-z\u0400-\u04FF]/.test(full)) return "ismda harf yo'q";
  if (/\d/.test(full)) return "ismda raqam bor";
  if (/^student\s*\d*$/i.test(full)) return "haqiqiy ism emas (Student N)";
  // Bo'lakning HAR BIRI tekshiriladi: "N | Abdumalikova" va "A. | Azizbek"
  // kabi qatorlarda familiya to'g'ri, ammo ism bosh harfgacha qisqargan.
  const toks = full.split(" ").filter(Boolean);
  if (toks.some((t) => t.replace(/[^A-Za-z\u0400-\u04FF]/g, "").length <= 2)) return "ism chala (bosh harf yoki bo'lak)";
  if (/^(salom|test|sinov)$/i.test(full)) return "haqiqiy ism emas";
  return null;
}

// ---------------------------------------------------------------- o'quvchilar

const pupilRows = XLSX.utils.sheet_to_json(
  XLSX.readFile(PUPILS_XLSX).Sheets["Students (Simplified)"],
  { header: 1, defval: "" },
);

const pupils = [];
const heldOut = [];
const ruleCounts = {};
const statusCounts = {};
let nextPupilId = PUPIL_ID_START;

for (let i = 1; i < pupilRows.length; i++) {
  const r = pupilRows[i];
  const a = norm(r[0]);
  const b = norm(r[1]);
  const reason = heldOutReason(a, b);
  if (reason) {
    heldOut.push([i + 1, r[0], r[1], r[2], r[5], r[6], r[7], r[10], reason]);
    continue;
  }
  const { firstName, lastName, rule } = resolveName(a, b, i);
  ruleCounts[rule] = (ruleCounts[rule] ?? 0) + 1;

  const rawStatus = norm(r[5]).toLowerCase();
  const status = STATUS_MAP[rawStatus] ?? "Aktiv";
  statusCounts[status] = (statusCounts[status] ?? 0) + 1;

  pupils.push({
    id: nextPupilId++,
    firstName,
    lastName,
    phone: localPhone(r[2]),
    extraPhone: "",
    category: "",
    birthDate: "",
    createdAt: fmtCreated(r[6]) || fmtNow(),
    // Balansi ustuni ATAYLAB olinmaydi (egasining qarori): ilovada balans
    // transaction_entries dan hisoblanadi, pupils.balance ko'rsatilmaydi.
    balance: 0,
    // Tanga balansi esa TO'G'RIDAN-TO'G'RI o'qiladi (O'quvchilar ro'yxatidagi
    // amber nishon, Guruh tafsilotidagi "Coin" ustuni), shuning uchun olinadi.
    coin: Number(r[4]) || 0,
    moderator: norm(r[7]),
    source: "",
    status,
    statusChangedAt: "",
    // Eski holat nomi yo'qolmasin — Arxivga tushish sababi shu yerda qoladi.
    statusReason: status === "Aktiv" ? "" : `${rawStatus} (eski tizimdan)`,
    address: norm(r[10]),
    addresses: [],
    email: "",
    tags: "",
    lessonTime: "",
    paymentDate: "",
    note: "",
    fatherName: "",
    fatherPhone: "",
    fatherWork: "",
    motherName: "",
    motherPhone: "",
    motherWork: "",
    language: "",
    studyPlace: "",
    survey: "",
    targetUniversity: "",
    debtLimit: 0,
  });
}

// ------------------------------------------------------------------ xodimlar

const staffRows = XLSX.utils.sheet_to_json(
  XLSX.readFile(STAFF_XLSX).Sheets["excelSheet"],
  { header: 1, defval: "" },
);

const employees = [];
const courseSet = new Set();
for (let i = 1; i < staffRows.length; i++) {
  const r = staffRows[i];
  const name = norm(r[0]);
  if (!name) continue;
  const kurs = norm(r[2]);
  for (const c of kurs.split(",").map((x) => norm(x)).filter(Boolean)) courseSet.add(c);
  employees.push({
    id: employees.length + 1,
    name,
    // Jinsi va Turi ustunlari ilovadagi qiymatlar bilan AYNAN bir xil
    // (constants/employees.js → GENDER_LABELS male/female, EMP_ROLES
    // teacher/moderator/admin), shuning uchun tarjima kerak emas.
    gender: norm(r[3]),
    aktivOq: 0,
    groups: 0,
    turi: norm(r[4]),
    filial: norm(r[5]) || "Akademiya",
    phone: localPhone(r[1]),
    // Kurslar ro'yxati BUTUNLIGICHA saqlanadi ("Biologiya, Sertifikat").
    // Bitta fan tanlansa 17 o'qituvchining ikkinchi fani yo'qolardi.
    kurs,
    created: fmtNow(),
    lastActive: "",
    archReason: "",
    archDate: "",
    email: "",
    percent: "",
    degree: "",
    photoUrl: "",
    branchAssignments: [],
  });
}

// --------------------------------------------------------------------- hisobot

const WIPE = [
  "pupils", "hr_employees", "groups", "tasks", "orders", "cashboxes",
  "transactions", "transaction_entries", "salary_runs", "attendance_history",
  "sms_templates", "task_types",
];
const TARGETED = [
  { collection: "settings_payment_methods", ids: [9], why: "'test tolov turi'" },
  { collection: "transaction_types", ids: [5, 10], why: "'test kirim', 'test avgust'" },
];

console.log(APPLY ? "=== BAJARILMOQDA ===\n" : "=== QURUQ YURISH — bazaga hech narsa yozilmaydi ===\n");

console.log("O'QUVCHILAR");
console.log(`  fayldagi qatorlar : ${pupilRows.length - 1}`);
console.log(`  import qilinadi   : ${pupils.length}`);
console.log(`  ajratib qo'yiladi : ${heldOut.length}`);
console.log(`  id oralig'i       : ${PUPIL_ID_START} … ${nextPupilId - 1}`);
console.log(`  ism tartibi qoidasi:`, JSON.stringify(ruleCounts));
console.log(`  holati            :`, JSON.stringify(statusCounts));
console.log(`  telefonsiz        : ${pupils.filter((p) => !p.phone).length}`);
console.log(`  manzilli          : ${pupils.filter((p) => p.address).length}`);
console.log(`  tangasi bor       : ${pupils.filter((p) => p.coin > 0).length}`);
console.log(`  moderatorli       : ${pupils.filter((p) => p.moderator).length}`);

console.log("\nXODIMLAR");
console.log(`  import qilinadi   : ${employees.length}  (id 1…${employees.length})`);
const byTuri = {};
employees.forEach((e) => { byTuri[e.turi] = (byTuri[e.turi] ?? 0) + 1; });
console.log(`  turi              :`, JSON.stringify(byTuri));
console.log(`  telefonsiz        : ${employees.filter((e) => !e.phone).length}`);
console.log(`  fanlar (${courseSet.size} ta)    : ${[...courseSet].join(", ")}`);

console.log("\nNAMUNALAR (o'quvchi)");
for (const idx of [0, 1, 1347, 1348, 1349, 1350, 6000]) {
  const p = pupils[idx];
  if (p) console.log(`  #${p.id}  ism="${p.firstName}"  familiya="${p.lastName}"  ${p.phone}  ${p.status}  ${p.createdAt}`);
}
console.log("NAMUNALAR (xodim)");
for (const e of employees.slice(0, 3)) console.log(`  #${e.id} ${e.name} | ${e.phone} | ${e.turi} | ${e.gender} | ${e.kurs || "—"}`);

console.log("\nO'CHIRILADI");
const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 });
await client.connect();
const db = client.db(process.env.MONGODB_DB);
for (const c of WIPE) {
  const n = await db.collection(c).countDocuments();
  console.log(`  ${c.padEnd(24)} ${String(n).padStart(4)} hujjat`);
}
for (const t of TARGETED) {
  const n = await db.collection(t.collection).countDocuments({ id: { $in: t.ids } });
  console.log(`  ${t.collection.padEnd(24)} ${String(n).padStart(4)} hujjat  (faqat ${t.why})`);
}
console.log("\nTEGILMAYDI: users (login!), user_sessions, branches, settings, offline_courses,");
console.log("            settings_payment_methods (qolgani), transaction_types (qolgani)");

// -------------------------------------------------------------------- bajarish

if (!APPLY) {
  console.log(`\nAjratilgan ${heldOut.length} qator "${path.basename(HELD_OUT_XLSX)}" ga yoziladi.`);
  console.log("Ajratilganlarga misol:");
  for (const h of heldOut.slice(0, 12)) console.log(`  qator ${h[0]}: "${h[1]}" | "${h[2]}"  → ${h[8]}`);
  console.log("\nHaqiqatan bajarish uchun: node scripts/import-from-excel.mjs --yes");
  await client.close();
  process.exit(0);
}

for (const c of WIPE) await db.collection(c).deleteMany({});
for (const t of TARGETED) await db.collection(t.collection).deleteMany({ id: { $in: t.ids } });

// O'chirilgan guruhga ishora qilib qolmasin.
await db.collection("settings").updateOne(
  { key: "nazorat.davomat" },
  { $set: { "values.archived": [] } },
);

// Kurs filtri va "Xodim qo'shish" oynasi shu ro'yxatdan oziqlanadi
// (hooks/useOfflineCourseList.ts), shuning uchun yangi fanlar qo'shiladi.
const courseCol = db.collection("offline_courses");
const branches = await db.collection("branches").find({}).sort({ id: 1 }).toArray();
const existing = new Set((await courseCol.find({}).toArray()).map((c) => norm(c.name).toLowerCase()));
let courseId = (await courseCol.find({}).sort({ id: -1 }).limit(1).toArray())[0]?.id ?? 0;
let addedCourses = 0;
for (const name of courseSet) {
  if (existing.has(name.toLowerCase())) continue;
  await courseCol.insertOne({
    id: ++courseId,
    name,
    color: "#000000",
    branches: branches.map((b) => ({ id: b.id, name: b.name, enabled: true, price: 0 })),
  });
  addedCourses++;
}

await db.collection("pupils").insertMany(pupils, { ordered: false });
await db.collection("hr_employees").insertMany(employees, { ordered: false });

console.log(`\n✓ o'quvchi: ${await db.collection("pupils").countDocuments()}`);
console.log(`✓ xodim   : ${await db.collection("hr_employees").countDocuments()}`);
console.log(`✓ yangi fan qo'shildi: ${addedCourses}`);
await client.close();

const ws = XLSX.utils.aoa_to_sheet([
  ["Excel qator", "Ismi (A)", "Familiyasi (B)", "Tel.", "Holati", "Yaratilgan sana", "Hodim", "Manzil", "Nega ajratildi"],
  ...heldOut,
]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Tekshirish kerak");
XLSX.writeFile(wb, HELD_OUT_XLSX);
console.log(`✓ ajratilgan ${heldOut.length} qator: ${HELD_OUT_XLSX}`);
