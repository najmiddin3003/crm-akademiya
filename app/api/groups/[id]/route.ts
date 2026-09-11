import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { groupScopeFilter } from "@/lib/groupScope";
import { validateGroupInput, type GroupFormInput } from "@/lib/groupRules";
import { findRoomClashInDb } from "@/lib/groupRoomClash";
import type { Group } from "@/lib/groups";

// FILIAL QAMROVI har uchala amalda (lib/groupScope.ts). Kesilmasa, boshqa
// filialning guruhini id bo'yicha ochish ham, tahrirlash ham, O'CHIRISH
// ham mumkin bo'lardi — guruh id'si oddiy son, terib ko'rish oson.
const notLoggedIn = () => NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

// GET /api/groups/:id — bitta guruh (detail sahifasi uchun).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const where = await groupScopeFilter({ id: groupId });
  if (!where) return notLoggedIn();
  const db = await ensureIndexes();
  const row = await db.collection("groups").findOne(where);
  if (!row) {
    return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }
  const { _id, ...group } = row;
  return NextResponse.json({ ok: true, group: group as unknown as Group });
}

// PATCH /api/groups/:id — guruh maydonlarini qisman yangilaydi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<Group>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const { id: _ignore, ...set } = body as Partial<Group> & { _id?: unknown };
  delete (set as { _id?: unknown })._id;

  // Kelgan maydonlar modal bilan bir xil qoidada tekshiriladi
  // (lib/groupRules.ts, `partial`): {status:"archive"} yolg'iz o'tadi,
  // lekin majburiy maydonni bo'shatib bo'lmaydi.
  const valid = validateGroupInput(set as GroupFormInput, { partial: true });
  if (!valid.ok) {
    return NextResponse.json({ ok: false, error: valid.error, field: valid.field }, { status: 400 });
  }

  const where = await groupScopeFilter({ id: groupId });
  if (!where) return notLoggedIn();
  const db = await ensureIndexes();

  // Xona/kun/vaqt/muddat/holat o'zgarsa — yangilangan jadval bo'lagi boshqa
  // tirik guruh bilan to'qnashmasligi tekshiriladi (POST dagi qoida).
  // Ko'chirish uchun hozirgi hujjat kerak: o'zgarmagan maydonlar undan olinadi.
  if (["room", "day", "time", "startDate", "endDate", "status"].some((k) => k in set)) {
    const cur = await db.collection("groups").findOne(where, { projection: { _id: 0 } });
    if (!cur) return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
    const merged = { ...cur, ...set } as unknown as Group & { branchId?: number | null };
    if ((merged.status === "active" || merged.status === "frozen") && typeof merged.branchId === "number") {
      const clash = await findRoomClashInDb(
        db,
        merged.branchId,
        { room: merged.room || "", day: merged.day || "", time: merged.time || "", startDate: merged.startDate, endDate: merged.endDate },
        groupId,
      );
      if (clash) {
        return NextResponse.json({ ok: false, error: clash.error, field: "room", conflict: clash.conflict }, { status: 409 });
      }
    }
  }

  const res = await db.collection("groups").findOneAndUpdate(
    where,
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }
  const { _id, ...group } = res;
  return NextResponse.json({ ok: true, group: group as unknown as Group });
}

// DELETE /api/groups/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const where = await groupScopeFilter({ id: groupId });
  if (!where) return notLoggedIn();
  const db = await ensureIndexes();
  const res = await db.collection("groups").deleteOne(where);
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
