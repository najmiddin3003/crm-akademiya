import { NextResponse } from "next/server";
import { getBranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { ensureIndexes } from "@/lib/mongodb";
import { createTest, listTests } from "@/lib/uzbmbServer";

// UzBMB testlari (12-qism): GET — navbardagi filial (hovuzi bilan) testlari, natijalar soni bilan;
// POST — yangi test `{ name?, date }` (raqami filialda keyingisi, ball tuzilishi sozlamadan).

const notLoggedIn = () => NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

export async function GET() {
  const scope = await getBranchScope();
  if (!scope) return notLoggedIn();
  const db = await ensureIndexes();
  const { tests, legacyCount } = await listTests(db, scope);
  return NextResponse.json({ ok: true, tests, legacyCount });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const scope = await getBranchScope();
  if (!scope) return notLoggedIn();
  const db = await ensureIndexes();
  const r = await createTest(db, scope, body, await currentAuthorName());
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, test: r.test });
}
