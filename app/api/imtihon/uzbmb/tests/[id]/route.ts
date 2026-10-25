import { NextResponse } from "next/server";
import { getBranchScope } from "@/lib/branchScope";
import { ensureIndexes } from "@/lib/mongodb";
import { deleteTest, testData, updateTest } from "@/lib/uzbmbServer";

// UzBMB testi (12-qism): GET — test, uning natijalari, oldingi test natijalari (taqqoslash),
// guruhlarning oxirgi yo'nalishi; PATCH — nomi/sanasi; DELETE — faqat natijasiz test.

type Ctx = { params: Promise<{ id: string }> };
const notLoggedIn = () => NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const scope = await getBranchScope();
  if (!scope) return notLoggedIn();
  const db = await ensureIndexes();
  const r = await testData(db, scope, Number(id));
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, ...r.data });
}

export async function PATCH(req: Request, { params }: Ctx) {
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
  const r = await updateTest(db, scope, Number(id), body);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, test: r.test });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const scope = await getBranchScope();
  if (!scope) return notLoggedIn();
  const db = await ensureIndexes();
  const r = await deleteTest(db, scope, Number(id));
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
