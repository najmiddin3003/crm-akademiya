import { NextResponse } from "next/server";
import { currentAuthorName } from "@/lib/currentEmployee";
import { ensureIndexes } from "@/lib/mongodb";
import { computeExceptions, createException, decideException, exceptionPrefill } from "@/lib/priceExceptions";
import { reportCtx } from "@/lib/reportRoute";

// Hisobotlar → «Chegirma va istisnolar» (35-qism, lib/priceExceptions.ts).
//   GET ?month&branch&by — hisobot; GET ?prefill=<pupilId> — imtiyoz oynasi uchun guruhlar va narx.
//   POST {action: "create", type, pupilId, groupId, …} — yangi imtiyoz (katta bo'lsa — tasdiq kutadi);
//   POST {action: "decide", id, approve, note} — direktor (admin) tasdiqlaydi yoki rad etadi.
export async function GET(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const db = await ensureIndexes();
  const pid = Number(c.sp.get("prefill"));
  if (pid) {
    const r = await exceptionPrefill(db, c.scope.allowed, pid);
    return NextResponse.json(r, { status: r.ok ? 200 : r.status });
  }
  return NextResponse.json({ branch: c.br.branch, ...(await computeExceptions(db, c.br.ids, c.month, { isAdmin: c.scope.isAdmin }, c.sp.get("by") || undefined)) });
}

export async function POST(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = await ensureIndexes();
  const who = { name: await currentAuthorName(), isAdmin: c.scope.isAdmin };
  const r =
    b.action === "create"
      ? await createException(db, c.scope.allowed, who, b)
      : b.action === "decide"
        ? await decideException(db, c.scope.allowed, who, Number(b.id), b.approve === true, String(b.note ?? ""))
        : ({ ok: false, error: "Noma'lum amal", status: 400 } as const);
  return NextResponse.json(r, { status: r.ok ? 200 : r.status });
}
