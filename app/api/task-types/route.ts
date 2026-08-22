import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { sanitizeTaskType, type TaskType } from "@/lib/taskTypes";

// Topshiriq turlari backend'i (MongoDB `task_types`) — Topshiriqlar sahifasidagi
// "⋮ → Topshiriq turi" oynasi boshqaradi. Demo seed YO'Q: ro'yxat bo'sh
// holatdan boshlanadi va faqat foydalanuvchi qo'shgan turlar chiqadi.

export async function GET() {
  const db = await ensureIndexes();
  const rows = await db.collection("task_types").find({}).sort({ id: 1 }).toArray();
  const types = rows.map(({ _id, ...rest }) => rest as unknown as TaskType);
  return NextResponse.json({ ok: true, types });
}

export async function POST(req: Request) {
  let body: Partial<TaskType>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const { name, color, icon } = sanitizeTaskType(body);
  if (!name) {
    return NextResponse.json({ ok: false, error: "Tur nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("task_types");

  // Bir xil nomli tur ikki marta qo'shilmasin (katta-kichik harf farqsiz).
  const existing = await col.find({}).toArray();
  if (existing.some((t) => String(t.name).trim().toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ ok: false, error: "Bunday nomli tur allaqachon bor" }, { status: 409 });
  }

  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const type: TaskType = { id: (last[0]?.id ?? 0) + 1, name, color, icon };
  // insertOne argumentga _id qo'shib yuboradi — nusxa yozamiz.
  await col.insertOne({ ...type });

  return NextResponse.json({ ok: true, type });
}
