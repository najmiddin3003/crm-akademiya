import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { SALARY_RUN_SEED, demoAvans, demoAkladi } from "@/constants/salary";
import type { SalaryRun } from "@/lib/salary";
import type { HrEmployee } from "@/lib/hrEmployees";
import type { Bonus } from "@/lib/bonuses";
import type { Penalty } from "@/lib/penalties";

// Moliya → Oylik chiqarish backend'i (MongoDB `salary_runs`). Bo'sh bo'lsa
// demo yozuvni seed qiladi.
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(SALARY_RUN_SEED)));
  }
}

function fmtNow(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("salary_runs");
  await seedIfEmpty(col);
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const runs = rows.map(({ _id, ...rest }) => rest as unknown as SalaryRun);
  return NextResponse.json({ ok: true, runs });
}

// POST — "Oylik chiqarish": tanlangan xodimlar bo'yicha OYLIK/DAVOMAT (hali
// real manba yo'q — 0) + BONUS/JARIMA (real, Moliya → Bonus/Jarima'dan, bekor
// qilinmagan yozuvlar) + AVANS/AKLADI (demo, xodim id'sidan deterministik)
// umumlashtirilib bitta hisobot yozuvi yaratiladi.
export async function POST(req: Request) {
  let body: { employeeIds?: number[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const employeeIds = Array.isArray(body.employeeIds) ? body.employeeIds.map(Number).filter(Number.isFinite) : [];
  if (employeeIds.length === 0) {
    return NextResponse.json({ ok: false, error: "Kamida bitta xodimni tanlang" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const employees = await db.collection<HrEmployee>("hr_employees").find({ id: { $in: employeeIds } }).toArray();
  const [bonusRows, penaltyRows] = await Promise.all([
    db.collection<Bonus>("bonuses").find({ type: "employee", status: { $ne: "cancelled" } }).toArray(),
    db.collection<Penalty>("penalties").find({ type: "employee", status: { $ne: "cancelled" } }).toArray(),
  ]);

  let bonus = 0;
  let jarima = 0;
  let avans = 0;
  let akladi = 0;
  let tolanmagan = 0;
  for (const emp of employees) {
    const empBonus = bonusRows.filter((b) => b.recipientName === emp.name).reduce((s, b) => s + b.amount, 0);
    const empJarima = penaltyRows.filter((p) => p.recipientName === emp.name).reduce((s, p) => s + p.amount, 0);
    const empAvans = demoAvans(emp.id);
    const empAkladi = demoAkladi(emp.id);
    const ishHaqi = empAkladi - empAvans + empBonus - empJarima;
    bonus += empBonus;
    jarima += empJarima;
    avans += empAvans;
    akladi += empAkladi;
    tolanmagan += Math.max(ishHaqi, 0);
  }

  const col = db.collection("salary_runs");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const run: SalaryRun = {
    id: nextId,
    employeeCount: employees.length,
    oylik: 0,
    davomat: 0,
    davomatFoizi: 0,
    bonus,
    avans,
    jarima,
    akladi,
    tolanmagan,
    createdAt: fmtNow(new Date()),
  };
  await col.insertOne({ ...run });
  return NextResponse.json({ ok: true, run });
}
