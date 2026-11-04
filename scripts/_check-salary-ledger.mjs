// FAQAT O'QIYDI. lib/salaryLedger.ts (xodim profilidagi "Qoldiq" ustunlari)
// ni Oylik hisob-kitob bilan solishtiradi:
//   node --import ./scripts/_ts-alias.mjs scripts/_check-salary-ledger.mjs [id ...]
// Har xodim uchun joriy oy daftarining yakuni payrollDue − (bonus − jarima −
// soliq) ga TENG bo'lishi shart (daftar bu uchtasini ko'rmaydi). id berilsa
// qatorlar ham chiqadi. 18.09.2026 (Atlas ko'zgu): 55 xodim, MISMATCH 0.
//
// 04.11.2026 (oylik faqat joriy oydan): oy ochilishi = `carryOver`, butun
// qoldiq shu yerda. Qo'shimcha tekshiruv (OYLAR): `carryMonths` yig'indisi
// `carryOver` ga teng va hammasi bir xil ishorali.
import { MongoClient } from "mongodb";
import fs from "node:fs";
import { buildSalaryLedger } from "@/lib/salaryLedger";
import { buildPayrollRows } from "@/lib/payrollSources";
import { payrollDue, payrollPeriod, payrollTax } from "@/lib/salary";

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

let mismatches = 0;
let monthsBad = 0;
let carryEmps = 0;
for (const emp of emps) {
  const t0 = Date.now();
  const led = await buildSalaryLedger(db, emp);
  const ms = Date.now() - t0;
  const row = byId.get(emp.id);
  const monthKey = `${period.year}-${String(period.month + 1).padStart(2, "0")}`;
  const cur = led.rows.filter((r) => r.month === monthKey);
  const last = cur.length ? cur[cur.length - 1].after : null;
  const owed = row ? payrollDue(row, period) : null;
  const extra = row ? row.bonus - row.jarima - payrollTax(row, period) : 0;
  const expected = owed === null ? null : owed - extra;
  const ok = last === null || expected === null || cur.length === 0 ? "(n/a)" : (last === expected ? "OK" : "MISMATCH");
  if (ok === "MISMATCH") mismatches++;

  // OYLAR: kesim yig'indisi `carryOver` ga teng, hammasi bir xil ishorali.
  const carryMonths = row?.carryMonths ?? [];
  const monthNotes = [];
  if (row) {
    const sum = carryMonths.reduce((s, x) => s + x.amount, 0);
    if (row.carryOver !== sum) monthNotes.push(`carryOver ${row.carryOver} ≠ Σ oylar ${sum}`);
    if (carryMonths.some((x) => x.amount === 0 || (x.amount > 0) !== (carryMonths[0].amount > 0))) monthNotes.push("oylar ishorasi aralash");
  }
  if (carryMonths.length) carryEmps++;
  if (monthNotes.length) monthsBad++;

  if (ids.length || ok === "MISMATCH" || monthNotes.length) {
    const monthStr = carryMonths.length ? ` | oylar ${carryMonths.map((x) => `${x.month}:${x.amount}`).join(", ")}` : "";
    console.log(`\n#${emp.id} ${emp.name} — ${led.salaryType}${led.configured ? "" : " (sozlanmagan)"} ${led.percent}% | ${led.rows.length} qator, ${ms} ms | oy yakuni ${last} vs due−(bonus−jarima−soliq) ${expected} → ${ok}${monthStr}`);
    for (const n of monthNotes) console.log("   OYLAR XATO:", n);
    if (ids.length) for (const r of led.rows) console.log("  ", JSON.stringify(r));
  }
}
console.log(`\nJami xodim: ${emps.length}, MISMATCH: ${mismatches}, qoldig'i bor: ${carryEmps}, OYLAR XATO: ${monthsBad}`);
await client.close();
