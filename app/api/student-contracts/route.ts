import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { createContract, listContracts, prefill, updateContract, type ContractAction } from "@/lib/studentContracts";

// Moliya → Shartnomalar (32-qism, lib/studentContracts.ts).
// GET — ro'yxat (ruxsat etilgan filiallar); GET ?prefill=<pupilId> — tuzish oynasi uchun o'quvchi, ota-ona,
// guruhlar va narx. POST — yangi shartnoma. PATCH {action: sign | cancel | extend, id, …}.

export async function GET(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const db = await ensureIndexes();
  const pid = Number(new URL(req.url).searchParams.get("prefill"));
  if (pid) {
    const r = await prefill(db, pid, scope.allowed);
    return NextResponse.json(r, { status: r.ok ? 200 : r.status });
  }
  const branches = await db.collection("branches").find({ id: { $in: scope.allowed } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray();
  return NextResponse.json({ ok: true, contracts: await listContracts(db, scope.allowed), branches });
}

export async function POST(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const db = await ensureIndexes();
  const r = await createContract(db, scope.allowed, await currentAuthorName(), body);
  return NextResponse.json(r, { status: r.ok ? 200 : r.status });
}

export async function PATCH(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as ContractAction;
  if (!["sign", "cancel", "extend"].includes(body?.action) || !Number(body.id)) return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  const db = await ensureIndexes();
  const r = await updateContract(db, scope.allowed, await currentAuthorName(), { ...body, id: Number(body.id) } as ContractAction);
  return NextResponse.json(r, { status: r.ok ? 200 : r.status });
}
