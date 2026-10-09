import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, pooledBranchInCondition } from "@/lib/branchScope";
import { groupsInRoom, parseRoomBranch, renameRoomInGroups, roomInUseRefusal, sameNameRoomRefusal } from "@/lib/roomBranch";
import { roomBranchId, type Room } from "@/lib/rooms";
import { sameBranchPool } from "@/lib/branchPools";

// Hamma metodlar faqat foydalanuvchiga RUXSAT ETILGAN filiallardagi
// xonaga tegadi (`scope.allowed`, navbardagisi emas — tahrirda filial
// almashadi). Boshqa filialning xonasi — "Xona topilmadi".

// PATCH /api/rooms/:id — xonani yangilaydi (Xonalar → tahrirlash).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roomId = Number(id);
  if (!Number.isFinite(roomId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<Room>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const set: { name?: string; capacity?: number; note?: string; branchId?: number } = {};
  if (typeof body.name === "string") {
    set.name = body.name.trim();
    if (!set.name) return NextResponse.json({ ok: false, error: "Xona nomini kiriting" }, { status: 400 });
  }
  if (body.capacity !== undefined) set.capacity = parseInt(String(body.capacity), 10) || 0;
  if (typeof body.note === "string") set.note = body.note.trim();
  if (body.branchId !== undefined) {
    const branch = parseRoomBranch(body.branchId, scope);
    if (!branch.ok) return NextResponse.json({ ok: false, error: branch.error }, { status: branch.status });
    set.branchId = branch.branchId;
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("rooms");
  const mine = { $and: [{ id: roomId }, pooledBranchInCondition(scope.allowed)] };
  const cur = await col.findOne(mine, { projection: { _id: 0, name: 1, branchId: 1 } });
  if (!cur) {
    return NextResponse.json({ ok: false, error: "Xona topilmadi" }, { status: 404 });
  }

  // Nom yoki filial o'zgarsagina tekshiriladi — eski yozuvlardagi
  // nomuvofiqlik sig'imni tuzatishga to'sqinlik qilmasin.
  const fromBranch = roomBranchId(cur as Pick<Room, "branchId">);
  const toBranch = set.branchId ?? fromBranch;
  const curName = String(cur.name ?? "");
  const newName = set.name ?? curName;
  if (toBranch !== fromBranch || newName !== curName) {
    const twin = await sameNameRoomRefusal(db, toBranch, newName, roomId);
    if (twin) return NextResponse.json({ ok: false, error: twin.error }, { status: twin.status });
  }
  // Hovuz ichida (1 ↔ 2, lib/branchPools.ts) ko'chirish guruhlarni xonasiz
  // qoldirmaydi — ular xonani baribir ko'radi, ya'ni to'silmaydi.
  if (!sameBranchPool(toBranch, fromBranch)) {
    const busy = await roomInUseRefusal(db, fromBranch, curName);
    if (busy) return NextResponse.json({ ok: false, error: busy.error }, { status: busy.status });
  }

  const res = await col.findOneAndUpdate(mine, { $set: set }, { returnDocument: "after" });
  if (!res) {
    return NextResponse.json({ ok: false, error: "Xona topilmadi" }, { status: 404 });
  }
  // Yangi nom guruhlarga ham o'tadi. Filial almashsa ERGASHMAYDI: tirik
  // guruh bo'lsa ko'chirish yuqorida to'silgan, arxivdagilar esa eski
  // filial tarixida o'sha paytdagi nomi bilan qoladi.
  const movedGroups = sameBranchPool(toBranch, fromBranch) ? await renameRoomInGroups(db, fromBranch, curName, newName) : 0;
  const { _id, ...room } = res;
  return NextResponse.json({ ok: true, room: room as unknown as Room, movedGroups });
}

// GET /api/rooms/:id — xonada dars o'tadigan tirik guruhlar. O'chirish
// oynasi shuni ko'rsatib ogohlantiradi (o'chirishni TO'SMAYDI — 27.09.2026
// qarori: guruhlarda eski xona nomi qoladi, ma'lumot yo'qolmaydi).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roomId = Number(id);
  if (!Number.isFinite(roomId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const room = await db
    .collection("rooms")
    .findOne({ $and: [{ id: roomId }, pooledBranchInCondition(scope.allowed)] }, { projection: { _id: 0, name: 1, branchId: 1 } });
  if (!room) {
    return NextResponse.json({ ok: false, error: "Xona topilmadi" }, { status: 404 });
  }
  const groups = await groupsInRoom(db, roomBranchId(room as Pick<Room, "branchId">), String(room.name ?? ""));
  return NextResponse.json({ ok: true, groups });
}

// DELETE /api/rooms/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roomId = Number(id);
  if (!Number.isFinite(roomId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const res = await db.collection("rooms").deleteOne({ $and: [{ id: roomId }, pooledBranchInCondition(scope.allowed)] });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Xona topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
