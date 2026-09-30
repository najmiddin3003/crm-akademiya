import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import {
  FINES_COL,
  loadClosedMonths,
  loadSettings,
  loadViewer,
  saveSettings,
  syncFinePenalties,
  type StaffFineDoc,
} from "@/lib/staffTasksServer";
import { normalizeSettings, uzMonthOf } from "@/lib/staffTasks";
import { CLOSING_SALARY_RUN } from "@/lib/salary";

// Sozlamalar → Topshiriqlar (faqat direktor).
//
//   GET — sozlamalar + «Oylik holati» (oxirgi oylar: oyligi chiqarilganmi).
//         Oylik holati QO'LDA belgilanmaydi — Moliya → Oylik chiqarishdan
//         keladi (`salary_runs`).
//   PUT — saqlash. Jarima summasi topshiriq berilgan paytda unga yozib
//         olinadi, ya'ni yangi summa mavjud topshiriqlarga ta'sir qilmaydi.
//         Oylik limiti (%) o'zgarsa esa OCHIQ oylardagi jarimalar qayta
//         taqsimlanadi — Moliya → Jarima dagi summa ham yangilanadi.

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

function lastMonths(n: number): string[] {
  const out: string[] = [];
  const [y, m] = uzMonthOf(Date.now()).split("-").map(Number);
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return bad("Tizimga kirmagansiz", 401);
  const db = await ensureIndexes();
  const v = await loadViewer(db, me);
  if (v.role !== "direktor") return bad("Sozlamalar faqat direktorga ochiq", 403);

  const [settings, runs, fineMonths] = await Promise.all([
    loadSettings(db),
    // «Faqat karta» chiqarish oyni yopmaydi (lib/salary.ts → SalaryRun.kind).
    db.collection("salary_runs").find({ month: { $type: "string" }, ...CLOSING_SALARY_RUN }, { projection: { _id: 0, month: 1, branchId: 1 } }).toArray(),
    db.collection<StaffFineDoc>(FINES_COL).distinct("month"),
  ]);
  const runsBy = new Map<string, number>();
  for (const r of runs) runsBy.set(String(r.month), (runsBy.get(String(r.month)) ?? 0) + 1);
  const months = [...new Set([...lastMonths(3), ...fineMonths.map(String)])]
    .sort()
    .reverse()
    .map((m) => ({ month: m, closed: (runsBy.get(m) ?? 0) > 0, runs: runsBy.get(m) ?? 0 }));
  return NextResponse.json({ ok: true, settings, months });
}

export async function PUT(req: Request) {
  const me = await getCurrentUser();
  if (!me) return bad("Tizimga kirmagansiz", 401);
  const db = await ensureIndexes();
  const v = await loadViewer(db, me);
  if (v.role !== "direktor") return bad("Sozlamalarni faqat direktor o'zgartiradi", 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Noto'g'ri so'rov");
  }
  const next = normalizeSettings(body);
  const prev = await loadSettings(db);
  await saveSettings(db, next);

  if (next.limitPercent !== prev.limitPercent) {
    const closed = await loadClosedMonths(db);
    const pairs = await db
      .collection<StaffFineDoc>(FINES_COL)
      .aggregate<{ _id: { e: number; m: string } }>([{ $match: { status: "kuchda" } }, { $group: { _id: { e: "$employeeId", m: "$month" } } }])
      .toArray();
    for (const p of pairs) {
      if (closed(p._id.e, p._id.m)) continue;
      await syncFinePenalties(db, p._id.e, p._id.m);
    }
  }
  return NextResponse.json({ ok: true, settings: next });
}
