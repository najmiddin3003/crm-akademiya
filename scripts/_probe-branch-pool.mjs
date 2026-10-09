// FAQAT O'QIYDI — 1+2 HOVUZI (lib/branchPools.ts, 09.10.2026): har filialda
// turib nechta yozuv ko'rinadi. Filtrni NUSXALAMAYDI — haqiqiy funksiyalar
// (branchCondition, strictBranchCondition, employeeBranchCondition,
// buildPayrollRows) chaqiriladi, ya'ni kod o'zgarsa natija ham o'zgaradi.
//
//   node --env-file=.env.local --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/_probe-branch-pool.mjs
//
// Kutiladigani: 1- va 2-filial ustunlari BIR XIL (guruh, xona, lid, o'quvchi,
// xodim), «qat'iy» ustunlar — har filialniki alohida; oylik — har filial
// o'zicha, hovuz (ko'rish) = hovuz A'ZOLARI (Xodimlar ro'yxati bilan bir
// qamrov), takrorsiz, ro'yxatdagi har faol xodimning qatori bor.
// Audit tuzatishlari (09.10.2026): qarzdorlar narxi hovuzdosh filialdan
// (monthlyPriceFor), ustoz kechikishi xonasi turgan bino bo'yicha
// (groupsInBuilding) — har guruh aynan bitta binoga tushadi.

if (!process.env.MONGODB_URI) {
  console.log("MONGODB_URI yo'q (.env.local)");
  process.exit(1);
}
const { getDb } = await import("@/lib/mongodb");
const { branchCondition, strictBranchCondition, pupilBranchCondition } = await import("@/lib/branchScope");
const { employeeBranchCondition, strictScopedEmployeeFilter } = await import("@/lib/employeeBranches");
const { buildPayrollRows } = await import("@/lib/payrollSources");
const { payrollPeriod } = await import("@/lib/salary");
const { branchPool } = await import("@/lib/branchPools");
const { monthlyPriceFor } = await import("@/lib/debtors");
const { groupsInBuilding } = await import("@/lib/attendanceCheck");

const db = await getDb();
const branches = await db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray();
const scopeOf = (id) => ({ branchId: id, allowed: branches.map((b) => b.id), isAdmin: true });
const count = (col, filter) => db.collection(col).countDocuments(filter);
const active = { $or: [{ archReason: { $exists: false } }, { archReason: null }, { archReason: "" }] };

const rows = [];
for (const b of branches) {
  const s = scopeOf(b.id);
  const [groups, groupsStrict, rooms, roomsStrict, leads, leadsStrict, pupils, staff, staffStrict] = await Promise.all([
    count("groups", branchCondition(s)),
    count("groups", strictBranchCondition(s)),
    count("rooms", branchCondition(s)),
    count("rooms", strictBranchCondition(s)),
    count("orders", branchCondition(s)),
    count("orders", strictBranchCondition(s)),
    count("pupils", pupilBranchCondition(s)),
    count("hr_employees", { $and: [active, employeeBranchCondition(s)] }),
    count("hr_employees", strictScopedEmployeeFilter(active, s)),
  ]);
  rows.push({ filial: `${b.id} ${b.name}`, guruh: `${groups} (${groupsStrict})`, xona: `${rooms} (${roomsStrict})`, lid: `${leads} (${leadsStrict})`, oquvchi: pupils, xodim: `${staff} (${staffStrict})` });
}
console.log("Hovuz bilan (qavsda — qat'iy, faqat shu filial):");
console.table(rows);

// Oylik: filial bo'yicha (qat'iy) va hovuz ko'rinishi (Xodimlar ro'yxati uchun).
const period = payrollPeriod();
const pay = {};
for (const id of [1, 2]) pay[id] = (await buildPayrollRows(db, period, { payrollBranchId: id })).map((r) => r.id);
const pooled = (await buildPayrollRows(db, period, { memberOfBranchIds: branchPool(1) })).map((r) => r.id);
const union = new Set([...pay[1], ...pay[2]]);
const dup = pooled.length - new Set(pooled).size;
console.log(
  `Oylik qatorlari: 1-filial ${pay[1].length}, 2-filial ${pay[2].length}, hovuz ${pooled.length} ` +
    `(yig'indi ${pay[1].length + pay[2].length}, takror ${dup}, farq ${[...union].filter((x) => !pooled.includes(x)).length})`,
);

// Xona nomlari hovuzda noyobmi (guruh xonaga NOMI bilan bog'lanadi).
const roomRows = await db.collection("rooms").find(branchCondition(scopeOf(1)), { projection: { _id: 0, name: 1, branchId: 1 } }).toArray();
const seen = new Map();
for (const r of roomRows) {
  const k = String(r.name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  seen.set(k, [...(seen.get(k) ?? []), r.branchId]);
}
const twins = [...seen].filter(([, v]) => v.length > 1);
console.log(`Hovuzdagi xonalar: ${roomRows.length}, bir xil nomli: ${twins.length ? JSON.stringify(twins) : "yo'q"}`);

// Hovuz oylik qatorlari ro'yxatdagi HAR faol xodimni qamraydimi.
const poolStaff = (await db
  .collection("hr_employees")
  .find({ $and: [active, employeeBranchCondition(scopeOf(1))] }, { projection: { _id: 0, id: 1 } })
  .toArray()).map((e) => e.id);
const noRow = poolStaff.filter((id) => !pooled.includes(id));
console.log(`Hovuz xodimlari: ${poolStaff.length}, oylik qatori yo'q: ${noRow.length ? noRow.join(", ") : "0"}`);

// Qarzdorlar narxi: o'z filiali qatori yo'q guruhga hovuzdosh filial narxi.
const live = { status: { $in: ["active", "gathering", "frozen"] } };
const poolGroups = await db
  .collection("groups")
  .find({ $and: [live, branchCondition(scopeOf(1))] }, { projection: { _id: 0, id: 1, course: 1, level: 1, branchId: 1, room: 1, status: 1 } })
  .toArray();
const courses = await db.collection("offline_courses").find({}, { projection: { _id: 0, name: 1, branches: 1, levels: 1 } }).toArray();
const onlyBranch = (b) =>
  courses.map((c) => ({
    ...c,
    branches: (c.branches ?? []).filter((x) => Number(x.id) === b),
    levels: (c.levels ?? []).map((l) => ({ ...l, branches: (l.branches ?? []).filter((x) => Number(x.id) === b) })),
  }));
const ownCourses = { 1: onlyBranch(1), 2: onlyBranch(2) };
let priced = 0, viaPool = 0, mismatch = 0, none = 0;
for (const g of poolGroups) {
  const own = Number(g.branchId) || 1;
  const p = monthlyPriceFor(g, courses);
  const strict = monthlyPriceFor(g, ownCourses[own] ?? courses);
  if (p === null) none++;
  else if (strict === null) viaPool++;
  else if (strict !== p) mismatch++;
  else priced++;
}
console.log(
  `Qarzdorlar narxi (${poolGroups.length} tirik guruh): o'z filialidan ${priced}, hovuzdoshdan ${viaPool}, ` +
    `o'z narxidan farqli ${mismatch} (0 bo'lishi kerak), narxsiz ${none}`,
);

// Ustoz kechikishi: guruh qaysi binoga tushadi (xonasi bo'yicha).
const active2 = poolGroups.filter((g) => g.status === "active");
const in1 = await groupsInBuilding(db, 1, active2);
const in2 = await groupsInBuilding(db, 2, active2);
const both = in1.filter((g) => in2.includes(g)).length;
const moved = [...in1.filter((g) => (Number(g.branchId) || 1) !== 1), ...in2.filter((g) => (Number(g.branchId) || 1) !== 2)].length;
console.log(
  `Faol guruhlar binosi: 1-bino ${in1.length}, 2-bino ${in2.length}, jami ${active2.length} ` +
    `(ikkalasida ${both}, hech birida ${active2.length - in1.length - in2.length + both} — ikkalasi 0 bo'lishi kerak); ` +
    `xonasi boshqa binoda: ${moved}`,
);
process.exit(0);
