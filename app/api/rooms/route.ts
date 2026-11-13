import { NextResponse } from "next/server";
import type { Db } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { branchForInsert, getBranchScope, pooledBranchInCondition, withBranch, type BranchScope } from "@/lib/branchScope";
import { expandBranchPools } from "@/lib/branchPools";
import { groupBoundsIso, ROOM_HOLDING_STATUSES } from "@/lib/groupRules";
import { parseRoomBranch, sameNameRoomRefusal } from "@/lib/roomBranch";
import type { OverviewBranch, OverviewGroup, RoomsOverview } from "@/lib/roomOccupancy";
import type { Room } from "@/lib/rooms";
import { uzDateIso } from "@/lib/uzTime";

// Xonalar backend'i (MongoDB `rooms`). Demo seed YO'Q — xonalarni
// foydalanuvchi o'zi qo'shadi.
//
// `?view=overview` (23-qism, yangi «Sozlamalar · Xonalar»): RUXSAT ETILGAN
// barcha filiallarning (hovuz bilan) xonalari + bandlik uchun tirik guruhlar
// (faqat jadval maydonlari va o'quvchilar SONI) + filiallarning ish vaqti.
// Sahifa filial chiplari bilan bino almashtiradi — navbar filialini
// o'zgartirmasdan. Alohida yo'l emas: /groups-rooms ruxsati /api/rooms ga
// bor, /api/groups va /api/branches ga esa yo'q (lib/apiPermissions.generated.ts).
async function roomsOverview(db: Db, scope: BranchScope): Promise<RoomsOverview> {
  const ids = expandBranchPools(scope.allowed);
  const today = uzDateIso();
  const [branchRows, roomRows, groupRows] = await Promise.all([
    db
      .collection("branches")
      .find({ id: { $in: ids } }, { projection: { _id: 0, id: 1, name: 1, openFrom: 1, openTo: 1, workDays: 1 } })
      .sort({ id: 1 })
      .toArray(),
    db.collection("rooms").find(pooledBranchInCondition(scope.allowed), { projection: { _id: 0 } }).toArray(),
    db
      .collection("groups")
      .find(
        { $and: [{ status: { $in: [...ROOM_HOLDING_STATUSES] } }, pooledBranchInCondition(scope.allowed)] },
        {
          projection: {
            _id: 0, id: 1, name: 1, course: 1, day: 1, time: 1, room: 1, status: 1, branchId: 1,
            startDate: 1, endDate: 1, period: 1, studentIds: 1,
          },
        },
      )
      .toArray(),
  ]);
  const groups: OverviewGroup[] = groupRows.map((g) => {
    const end = groupBoundsIso(g as { startDate?: string; endDate?: string; period?: string }).end;
    return {
      id: Number(g.id),
      name: String(g.name ?? ""),
      course: String(g.course ?? ""),
      day: String(g.day ?? ""),
      time: String(g.time ?? ""),
      room: String(g.room ?? ""),
      status: String(g.status ?? ""),
      students: Array.isArray(g.studentIds) ? g.studentIds.length : 0,
      ...(typeof g.branchId === "number" ? { branchId: g.branchId } : {}),
      expired: Boolean(end && end < today),
    };
  });
  return {
    branches: branchRows as unknown as OverviewBranch[],
    rooms: roomRows as unknown as Room[],
    groups,
    allowed: scope.allowed,
    current: scope.branchId,
  };
}

export async function GET(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  if (new URL(req.url).searchParams.get("view") === "overview") {
    return NextResponse.json({ ok: true, ...(await roomsOverview(db, scope)) });
  }
  const col = db.collection("rooms");
  const rows = await col.find(withBranch({}, scope)).sort({ id: -1 }).toArray();
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

  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  // Filial oynada tanlanadi (lib/roomBranch.ts). Berilmasa — navbardagi.
  const branch = body.branchId === undefined
    ? { ok: true as const, branchId: branchForInsert(scope) }
    : parseRoomBranch(body.branchId, scope);
  if (!branch.ok) return NextResponse.json({ ok: false, error: branch.error }, { status: branch.status });
  const { branchId } = branch;

  const db = await ensureIndexes();
  const twin = await sameNameRoomRefusal(db, branchId, name);
  if (twin) return NextResponse.json({ ok: false, error: twin.error }, { status: twin.status });

  const col = db.collection("rooms");
  // `id` GLOBAL ketma-ket — filial bo'yicha kesilmaydi (E11000 xavfi).
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const room: Room = {
    id: nextId,
    name,
    capacity: parseInt(String(body.capacity ?? ""), 10) || 0,
    note: (body.note || "").trim(),
    branchId,
  };
  // Nusxa — `insertOne` obyektga `_id` yozadi, javobga u tushmasin.
  await col.insertOne({ ...room });
  return NextResponse.json({ ok: true, room });
}
