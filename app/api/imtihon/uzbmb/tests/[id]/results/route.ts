import { NextResponse } from "next/server";
import { getBranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { ensureIndexes } from "@/lib/mongodb";
import { saveSheet } from "@/lib/uzbmbServer";

// PUT /api/imtihon/uzbmb/tests/:id/results — guruh varag'ini saqlash (12-qism, «Natijalarni saqlash»):
// `{ groupId, date, rows: [{ pupilId, b1s, b2s, b1c, b1cert, b1m, b2c, b2cert, b2m, m1, m2, m3 }] }`.
// Faqat o'zgargan qatorlar; bo'sh qator — natija o'chadi. Ballar serverda qayta hisoblanadi.

const notLoggedIn = () => NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const scope = await getBranchScope();
  if (!scope) return notLoggedIn();
  const db = await ensureIndexes();
  const r = await saveSheet(db, scope, Number(id), body, await currentAuthorName());
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
