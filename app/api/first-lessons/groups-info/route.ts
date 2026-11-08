import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { sameBranchPool } from "@/lib/branchPools";
import { monthlyPriceFor, type PricedCourse } from "@/lib/coursePrice";
import { loadGroups } from "@/lib/listQueries";
import { roomBranchId, type Room } from "@/lib/rooms";
import { roomLabel } from "@/components/v2/ui/groupStatus";

// «Birinchi darsga yozilganlar» (yangi versiya, 22-qism) uchun guruhlarning
// XONA SIG'IMI va OYLIK NARXI — faqat o'qish.
//
// Nega alohida route: sahifa ruxsati borlar (operatorlar) uchun /api/rooms va
// /api/offline-courses yopiq, ularni shu sahifaga ochish esa xona/kurs
// YARATISH va O'CHIRISH (POST/DELETE) ni ham ochardi — ruxsat route bo'yicha,
// usul bo'yicha emas (lib/apiPermissions.ts). Bu yerdan faqat ikki son chiqadi.
//
// Javob: { ok, info: { [guruhId]: { capacity, price } } } — guruhlar /api/groups
// bilan BIR XIL qamrovda (loadGroups). capacity — guruh xonasining sig'imi
// (xona nomi bo'yicha, guruh filiali yoki uning hovuzidan; 0 yoki topilmasa —
// null), price — kurs/daraja oylik narxi (lib/coursePrice.ts; topilmasa null).

export async function GET() {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const [groups, rooms, courses] = await Promise.all([
    loadGroups(),
    db
      .collection("rooms")
      .find({}, { projection: { _id: 0, name: 1, capacity: 1, branchId: 1 } })
      .toArray() as unknown as Promise<Pick<Room, "name" | "capacity" | "branchId">[]>,
    db
      .collection("offline_courses")
      .find({}, { projection: { _id: 0, name: 1, branches: 1, levels: 1 } })
      .toArray() as unknown as Promise<PricedCourse[]>,
  ]);

  const info: Record<number, { capacity: number | null; price: number | null }> = {};
  for (const g of groups as (typeof groups[number] & { branchId?: number | null })[]) {
    const name = roomLabel(g.room).toLowerCase();
    let capacity: number | null = null;
    if (name) {
      const same = rooms.filter((r) => roomLabel(r.name).toLowerCase() === name);
      const room = same.find((r) => g.branchId == null || sameBranchPool(roomBranchId(r), g.branchId)) ?? (same.length === 1 ? same[0] : undefined);
      if (room && Number(room.capacity) > 0) capacity = Number(room.capacity);
    }
    info[g.id] = { capacity, price: monthlyPriceFor({ course: g.course, level: g.level, branchId: g.branchId }, courses) };
  }
  return NextResponse.json({ ok: true, info });
}
