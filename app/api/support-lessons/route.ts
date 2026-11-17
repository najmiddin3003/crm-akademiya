import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { createSupport, listSupport, updateSupport, type SupportAction } from "@/lib/supportLessons";
import { uzDateIso } from "@/lib/uzTime";

// Nazorat → Support darslari (34-qism, lib/supportLessons.ts).
// GET ?from&to&course — darslar, ko'rsatkichlar, support ustozlar. POST — yangi dars.
// PATCH {action: enroll | remove | mark | delete, id, …}.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const today = uzDateIso();
  const from = ISO.test(sp.get("from") ?? "") ? sp.get("from")! : `${today.slice(0, 7)}-01`;
  const to = ISO.test(sp.get("to") ?? "") ? sp.get("to")! : `${today.slice(0, 7)}-31`;
  const db = await ensureIndexes();
  return NextResponse.json(await listSupport(db, { from, to, course: sp.get("course") ?? "", branchIds: [scope.branchId] }));
}

export async function POST(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const db = await ensureIndexes();
  const r = await createSupport(db, scope.branchId, await currentAuthorName(), body);
  return NextResponse.json(r, { status: r.ok ? 200 : r.status });
}

export async function PATCH(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as SupportAction;
  if (!["enroll", "remove", "mark", "delete"].includes(body?.action) || !Number(body.id)) return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  const db = await ensureIndexes();
  const r = await updateSupport(db, scope.allowed, { ...body, id: Number(body.id) } as SupportAction);
  return NextResponse.json(r, { status: r.ok ? 200 : r.status });
}
