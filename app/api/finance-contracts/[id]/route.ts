import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { FinanceContract } from "@/lib/financeContracts";

// PATCH /api/finance-contracts/:id — tahrirlash va arxivga
// olish/arxivdan chiqarish (`{ archived: boolean }`) ikkalasi ham shu bir
// endpoint orqali (cashboxes'dagi bilan bir xil pattern).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contractId = Number(id);
  if (!Number.isFinite(contractId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<FinanceContract>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (body.studentOrderId !== undefined) set.studentOrderId = body.studentOrderId;
  if (typeof body.studentName === "string") set.studentName = body.studentName;
  if (body.moderatorId !== undefined) set.moderatorId = body.moderatorId;
  if (typeof body.moderatorName === "string") set.moderatorName = body.moderatorName;
  if (typeof body.comment === "string") set.comment = body.comment;
  if (typeof body.archived === "boolean") set.archived = body.archived;
  if (Array.isArray(body.parts)) set.parts = body.parts;
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("finance_contracts").findOneAndUpdate(
    { id: contractId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Shartnoma topilmadi" }, { status: 404 });
  }
  const { _id, ...contract } = res;
  return NextResponse.json({ ok: true, contract: contract as unknown as FinanceContract });
}
