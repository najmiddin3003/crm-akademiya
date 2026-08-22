import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { sanitizeUzbmb, type UzbmbExam } from "@/lib/imtihon";

// Imtihon → UzBMB backend'i (MongoDB `uzbmb_exams`).
// Ballar serverda qayta hisoblanadi (`sanitizeUzbmb` → `ubCalc`), shuning
// uchun mijozdan kelgan `total` ga ishonilmaydi.

async function readAll(col: Collection): Promise<UzbmbExam[]> {
  const rows = await col.find({}).sort({ id: 1 }).toArray();
  return rows.map(({ _id, ...rest }) => rest as unknown as UzbmbExam);
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("uzbmb_exams");
  return NextResponse.json({ ok: true, exams: await readAll(col) });
}

// POST — bitta natija yoki `{ items: [...] }` (import). Bir o'quvchining bir
// oydagi natijasi bitta bo'ladi: mavjud bo'lsa to'liq almashtiriladi.
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
  const items = rawItems.map(sanitizeUzbmb).filter((x): x is NonNullable<typeof x> => x !== null);
  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: "Yaroqli natija topilmadi" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("uzbmb_exams");

  const existing = await readAll(col);
  let nextId = Math.max(0, ...existing.map((r) => r.id)) + 1;
  let added = 0;
  let updated = 0;

  for (const n of items) {
    const ex = existing.find(
      (r) => r.student.toLowerCase() === n.student.toLowerCase() && r.month === n.month,
    );
    if (ex) {
      await col.updateOne({ id: ex.id }, { $set: { ...n } });
      Object.assign(ex, n);
      updated++;
    } else {
      const rec: UzbmbExam = { ...n, id: nextId++ };
      await col.insertOne({ ...rec });
      existing.push(rec);
      added++;
    }
  }

  return NextResponse.json({ ok: true, added, updated, exams: await readAll(col) });
}
