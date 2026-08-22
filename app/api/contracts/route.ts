import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Contract } from "@/lib/contracts";

// O'quv bo'limi → Shartnoma backend'i (MongoDB `contracts`). Demo seed YO'Q —
// kolleksiya bo'sh bo'lsa ro'yxat ham bo'sh qaytadi.
function todayUz(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("contracts");
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const contracts = rows.map(({ _id, ...rest }) => rest as unknown as Contract);
  return NextResponse.json({ ok: true, contracts });
}

export async function POST(req: Request) {
  let body: Partial<Contract>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const title = (body.title || "").trim();
  if (!title) {
    return NextResponse.json({ ok: false, error: "Sarlavhani kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("contracts");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const contract: Contract = {
    id: nextId,
    title,
    type: body.type || "student",
    content: body.content || "",
    createdAt: todayUz(),
  };
  await col.insertOne({ ...contract });
  return NextResponse.json({ ok: true, contract });
}
