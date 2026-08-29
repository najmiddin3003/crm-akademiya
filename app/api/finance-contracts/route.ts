import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { FinanceContract } from "@/lib/financeContracts";
import { uzNow } from "@/lib/uzTime";

// Moliya → Shartnoma backend'i (MongoDB `finance_contracts`). Demo seed YO'Q —
// shartnomalar faqat foydalanuvchi qo'shganda paydo bo'ladi.
export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("finance_contracts");
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const contracts = rows.map(({ _id, ...rest }) => rest as unknown as FinanceContract);
  return NextResponse.json({ ok: true, contracts });
}

export async function POST(req: Request) {
  let body: Partial<FinanceContract>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  if (!body.studentOrderId || !body.studentName) {
    return NextResponse.json({ ok: false, error: "O'quvchini tanlang" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("finance_contracts");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const now = uzNow();
  const pad = (n: number) => String(n).padStart(2, "0");
  const createdAt = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} | ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const contract: FinanceContract = {
    id: nextId,
    studentOrderId: body.studentOrderId,
    studentName: body.studentName,
    moderatorId: body.moderatorId ?? 0,
    moderatorName: body.moderatorName ?? "—",
    comment: body.comment ?? "",
    archived: false,
    createdAt,
    parts: Array.isArray(body.parts) ? body.parts : [],
  };
  await col.insertOne({ ...contract });
  return NextResponse.json({ ok: true, contract });
}
