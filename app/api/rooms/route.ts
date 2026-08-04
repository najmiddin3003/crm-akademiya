import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { ROOM_SEED } from "@/constants/rooms";
import type { Room } from "@/lib/rooms";

// Xonalar backend'i (MongoDB `rooms`). Bo'sh bo'lsa demo xonalarni seed qiladi.
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(ROOM_SEED)));
  }
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("rooms");
  await seedIfEmpty(col);
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const rooms = rows.map(({ _id, ...rest }) => rest as unknown as Room);
  return NextResponse.json({ ok: true, rooms });
}

export async function POST(req: Request) {
  let body: Partial<Room>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Xona nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("rooms");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const room: Room = {
    id: nextId,
    name,
    capacity: parseInt(String(body.capacity ?? ""), 10) || 0,
    note: (body.note || "").trim(),
  };
  await col.insertOne({ ...room });
  return NextResponse.json({ ok: true, room });
}
