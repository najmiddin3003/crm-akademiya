import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { sanitizeMonthly, type MonthlyExam } from "@/lib/imtihon";

// Imtihon → Oylik imtihon backend'i (MongoDB `monthly_exams`).
// Demo seed YO'Q — natijalar faqat kiritilganda paydo bo'ladi.

async function readAll(col: Collection): Promise<MonthlyExam[]> {
  const rows = await col.find({}).sort({ id: 1 }).toArray();
  return rows.map(({ _id, ...rest }) => rest as unknown as MonthlyExam);
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("monthly_exams");
  return NextResponse.json({ ok: true, exams: await readAll(col) });
}

// POST — bitta natija (kiritish modali) yoki `{ items: [...] }` (Excel/CSV
// import). Bir xil (o'quvchi + fan + oy) uchligi bo'lsa yozuv YANGILANADI,
// aks holda yangisi qo'shiladi — referensdagi `imSaveEntry`/`imApplyImport`
// bilan bir xil qoida.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const rawItems = Array.isArray((body as { items?: unknown })?.items)
    ? ((body as { items: unknown[] }).items)
    : [body];
  const items = rawItems.map(sanitizeMonthly).filter((x): x is NonNullable<typeof x> => x !== null);
  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: "Yaroqli natija topilmadi" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("monthly_exams");

  const existing = await readAll(col);
  let nextId = Math.max(0, ...existing.map((r) => r.id)) + 1;
  let added = 0;
  let updated = 0;

  for (const n of items) {
    const ex = existing.find(
      (r) =>
        r.student.toLowerCase() === n.student.toLowerCase() &&
        r.subject.toLowerCase() === n.subject.toLowerCase() &&
        r.month === n.month,
    );
    if (ex) {
      const set: Record<string, unknown> = { total: n.total, correct: n.correct, pct: n.pct };
      // Bosqich bo'sh kelsa — eskisi saqlanadi.
      if (n.level) set.level = n.level;
      await col.updateOne({ id: ex.id }, { $set: set });
      Object.assign(ex, set);
      updated++;
    } else {
      const rec: MonthlyExam = { ...n, id: nextId++ };
      await col.insertOne({ ...rec });
      existing.push(rec);
      added++;
    }
  }

  return NextResponse.json({ ok: true, added, updated, exams: await readAll(col) });
}
