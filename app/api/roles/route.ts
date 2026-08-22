import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Role } from "@/lib/roles";

// Boshqaruv → Rollar backend'i (MongoDB `roles`). Demo seed YO'Q — rollarni
// foydalanuvchi o'zi qo'shadi.
export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("roles");
  const rows = await col.find({}).sort({ id: 1 }).toArray();
  const roles = rows.map(({ _id, ...rest }) => rest as unknown as Role);
  return NextResponse.json({ ok: true, roles });
}

export async function POST(req: Request) {
  let body: Partial<Role>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Rol nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("roles");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const role: Role = { id: nextId, name, description: (body.description || "").trim() };
  await col.insertOne({ ...role });
  return NextResponse.json({ ok: true, role });
}
