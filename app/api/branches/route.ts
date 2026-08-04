import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { MANAGEMENT_BRANCH_SEED } from "@/constants/managementBranches";
import type { ManagementBranch } from "@/lib/managementBranches";

// Boshqaruv → Filiallar backend'i (MongoDB `branches`). Bo'sh bo'lsa demo
// filiallarni seed qiladi.
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(MANAGEMENT_BRANCH_SEED)));
  }
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("branches");
  await seedIfEmpty(col);
  const rows = await col.find({}).sort({ id: 1 }).toArray();
  const branches = rows.map(({ _id, ...rest }) => rest as unknown as ManagementBranch);
  return NextResponse.json({ ok: true, branches });
}

export async function POST(req: Request) {
  let body: Partial<ManagementBranch>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Filial nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("branches");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const branch: ManagementBranch = { id: nextId, name, location: (body.location || "").trim() };
  await col.insertOne({ ...branch });
  return NextResponse.json({ ok: true, branch });
}
