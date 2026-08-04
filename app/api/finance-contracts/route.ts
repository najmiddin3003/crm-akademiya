import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { CONTRACT_SEED } from "@/constants/financeContracts";
import { EMPLOYEES_DATA } from "@/constants/employees";
import { createInitialOrders } from "@/lib/ordersData";
import type { FinanceContract, ContractPart } from "@/lib/financeContracts";

// Moliya → Shartnoma backend'i (MongoDB `finance_contracts`). Bo'sh bo'lsa
// CONTRACT_SEED'ni to'liq FinanceContract'ga aylantirib (studentName/
// moderatorName createInitialOrders()/EMPLOYEES_DATA'dan topiladi) seed qiladi.
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) > 0) return;
  const orders = createInitialOrders();
  const seeded: FinanceContract[] = CONTRACT_SEED.map((s, i) => {
    const order = orders.find((o) => o.id === s.studentOrderId);
    const moderator = EMPLOYEES_DATA.find((e) => e.id === s.moderatorId);
    return {
      id: i + 1,
      studentOrderId: s.studentOrderId,
      studentName: order?.name ?? "—",
      moderatorId: s.moderatorId,
      moderatorName: moderator?.name ?? "—",
      comment: s.comment,
      archived: s.archived,
      createdAt: s.createdAt,
      parts: s.parts as ContractPart[],
    };
  });
  await col.insertMany(JSON.parse(JSON.stringify(seeded)));
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("finance_contracts");
  await seedIfEmpty(col);
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

  const now = new Date();
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
