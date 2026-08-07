import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { EQUIPMENT_SEED } from "@/constants/equipment";
import type { Equipment } from "@/lib/equipment";

// Jihozlar backend'i (MongoDB `equipment`). Referensda seed bo'sh — bo'sh
// kolleksiyani EQUIPMENT_SEED (hozircha []) bilan bir marta to'ldiradi.
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0 && EQUIPMENT_SEED.length > 0) {
    await col.insertMany(JSON.parse(JSON.stringify(EQUIPMENT_SEED)));
  }
}

function fmtNow(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("equipment");
  await seedIfEmpty(col);
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const equipment = rows.map(({ _id, ...rest }) => rest as unknown as Equipment);
  return NextResponse.json({ ok: true, equipment });
}

export async function POST(req: Request) {
  let body: Partial<Equipment>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Jihoz nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("equipment");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const inventoryCode = (body.inventoryCode || "").trim() || `INV-${String(nextId).padStart(4, "0")}`;

  const equipment: Equipment = {
    id: nextId,
    name,
    inventoryCode,
    price: parseFloat(String(body.price ?? "")) || 0,
    createdAt: fmtNow(new Date()),
  };
  await col.insertOne({ ...equipment });
  return NextResponse.json({ ok: true, equipment });
}
