// FAQAT O'QIYDI. lib/salaryLedger.ts (xodim profilidagi "Qoldiq" ustunlari)
// ni Oylik hisob-kitob bilan solishtiradi:
//   node --import ./scripts/_ts-alias.mjs scripts/_check-salary-ledger.mjs [id ...]
// Har xodim uchun joriy oy daftarining yakuni payrollOwedTotal − (bonus −
// jarima − soliq) ga TENG bo'lishi shart (daftar bu uchtasini ko'rmaydi). id
// berilsa qatorlar ham chiqadi. 18.09.2026 (Atlas ko'zgu): 55 xodim, MISMATCH 0.
//
// 04.10.2026 ("faqat o'z oyidan chiqarilsin"): `payrollDue` endi faqat SHU
// OYDA to'lanadigan qoldiqni oladi, o'tgan oylarda to'lanmagani
// `carryPending` da. Daftar esa xodimning JAMI qoldig'i (oy ochilishi =
// `payrollCarryTotal`) — shu bois solishtirish `payrollOwedTotal` bilan.
// Qo'shimcha tekshiruv (PENDING): har bir `carryPendingMonths` summasi
// O'SHA OY sahifasidagi qoldiqqa (`payrollDue`) aynan teng bo'lishi va
// `carryPending` = Σ oylar, har biri > 0.
import { MongoClient } from "mongodb";
import fs from "node:fs";
import { buildSalaryLedger } from "@/lib/salaryLedger";
import { buildPayrollRows } from "@/lib/payrollSources";
import { payrollDue, payrollOwedTotal, payrollPeriod, payrollPeriodOf, payrollTax } from "@/lib/salary";

const env = fs.readFileSync(".env.local", "utf8");
const pick = (k, d) => (new RegExp(`^${k}=(.*)$`, "m").exec(env)?.[1] || "").trim().replace(/^["']|["']$/g, "") || d;
const client = new MongoClient(pick("MONGODB_URI"));
await client.connect();
const db = client.db(pick("MONGODB_DB", "crm_akademiya"));

const ids = process.argv.slice(2).map(Number).filter(Number.isFinite);
const emps = await db.collection("hr_employees").find(ids.length ? { id: { $in: ids } } : {}).sort({ id: 1 }).toArray();
const period = payrollPeriod();
const all = await buildPayrollRows(db, period);
const byId = new Map(all.map((r) => [r.id, r]));

// O'tgan oy sahifalari — pending oylar uchun, har oy bir marta.
const monthRows = new Map();
async function rowOfMonth(month, id) {
  if (!monthRows.has(month)) {
    const p = payrollPeriodOf(month);
    const rows = await buildPayrollRows(db, p);
    monthRows.set(month, { p, byId: new Map(rows.map((r) => [r.id, r])) });
  }
  const m = monthRows.get(month);
  const row = m.byId.get(id);
  return row ? { p: m.p, row } : null;
}

let mismatches = 0;
let pendingBad = 0;
let pendingEmps = 0;
for (const emp of emps) {
  const t0 = Date.now();
  const led = await buildSalaryLedger(db, emp);
  const ms = Date.now() - t0;
  const row = byId.get(emp.id);
  const monthKey = `${period.year}-${String(period.month + 1).padStart(2, "0")}`;
  const cur = led.rows.filter((r) => r.month === monthKey);
  const last = cur.length ? cur[cur.length - 1].after : null;
  const owed = row ? payrollOwedTotal(row, period) : null;
  const extra = row ? row.bonus - row.jarima - payrollTax(row, period) : 0;
  const expected = owed === null ? null : owed - extra;
  const ok = last === null || expected === null || cur.length === 0 ? "(n/a)" : (last === expected ? "OK" : "MISMATCH");
  if (ok === "MISMATCH") mismatches++;

  // PENDING: har oy o'z sahifasidagi qoldiqqa teng.
  const pend = row?.carryPendingMonths ?? [];
  const pendNotes = [];
  if (row) {
    const sum = pend.reduce((s, x) => s + x.amount, 0);
    if ((row.carryPending ?? 0) !== sum) pendNotes.push(`carryPending ${row.carryPending} ≠ Σ ${sum}`);
    for (const x of pend) {
      if (!(x.amount > 0)) pendNotes.push(`${x.month}: summa ${x.amount} ≤ 0`);
      const r = await rowOfMonth(x.month, emp.id);
      const pageDue = r ? payrollDue(r.row, r.p) : null;
      if (pageDue !== x.amount) pendNotes.push(`${x.month}: pending ${x.amount} ≠ o'sha oy sahifasi ${pageDue}`);
    }
  }
  if (pend.length) pendingEmps++;
  if (pendNotes.length) pendingBad++;

  if (ids.length || ok === "MISMATCH" || pendNotes.length) {
    const pendStr = pend.length ? ` | pending ${pend.map((x) => `${x.month}:${x.amount}`).join(", ")}` : "";
    console.log(`\n#${emp.id} ${emp.name} — ${led.salaryType}${led.configured ? "" : " (sozlanmagan)"} ${led.percent}% | ${led.rows.length} qator, ${ms} ms | oy yakuni ${last} vs owedTotal−(bonus−jarima−soliq) ${expected} → ${ok}${pendStr}`);
    for (const n of pendNotes) console.log("   PENDING XATO:", n);
    if (ids.length) for (const r of led.rows) console.log("  ", JSON.stringify(r));
  }
}
console.log(`\nJami xodim: ${emps.length}, MISMATCH: ${mismatches}, pending bor: ${pendingEmps}, PENDING XATO: ${pendingBad}`);
await client.close();
