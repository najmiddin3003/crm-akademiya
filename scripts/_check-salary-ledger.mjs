// FAQAT O'QIYDI. lib/salaryLedger.ts (xodim profilidagi "Qoldiq" ustunlari)
// ni Oylik hisob-kitob bilan solishtiradi:
//   node --import ./scripts/_ts-alias.mjs scripts/_check-salary-ledger.mjs [id ...]
// Har xodim uchun joriy oy daftarining yakuni payrollDue − (bonus − jarima −
// soliq) ga TENG bo'lishi shart (daftar bu uchtasini ko'rmaydi). id berilsa
// qatorlar ham chiqadi. 18.09.2026 (Atlas ko'zgu): 55 xodim, MISMATCH 0.
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
for (const emp of emps) {
  const t0 = Date.now();
  const led = await buildSalaryLedger(db, emp);
  const ms = Date.now() - t0;
  const row = byId.get(emp.id);
  const monthKey = `${period.year}-${String(period.month + 1).padStart(2, "0")}`;
  const cur = led.rows.filter((r) => r.month === monthKey);
  const last = cur.length ? cur[cur.length - 1].after : null;
  const due = row ? payrollDue(row, period) : null;
  const extra = row ? row.bonus - row.jarima - payrollTax(row, period) : 0;
  const expected = due === null ? null : due - extra;
  const ok = last === null || expected === null || cur.length === 0 ? "(n/a)" : (last === expected ? "OK" : "MISMATCH");
  if (ok === "MISMATCH") mismatches++;
  if (ids.length || ok === "MISMATCH") {
    console.log(`\n#${emp.id} ${emp.name} — ${led.salaryType}${led.configured ? "" : " (sozlanmagan)"} ${led.percent}% | ${led.rows.length} qator, ${ms} ms | oy yakuni ${last} vs due−(bonus−jarima−soliq) ${expected} → ${ok}`);
    if (ids.length) for (const r of led.rows) console.log("  ", JSON.stringify(r));
  }
}
console.log(`\nJami xodim: ${emps.length}, MISMATCH: ${mismatches}`);
await client.close();
