import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { ROLE_SEED } from "@/constants/roles";
import type { Role } from "@/lib/roles";

// Boshqaruv → Rollar backend'i (MongoDB `roles`). Bo'sh bo'lsa demo
// rollarni seed qiladi.
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(ROLE_SEED)));
  }
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("roles");
  await seedIfEmpty(col);
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
