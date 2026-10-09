import type { Db } from "mongodb";
import { findRoomConflict, roomConflictText, ROOM_HOLDING_STATUSES, type RoomSlot } from "@/lib/groupRules";
import { uzDateIso } from "@/lib/uzTime";
import { pooledBranchInCondition } from "@/lib/branchScope";

// Xona bandligi — SERVER tomoni (POST /api/groups, PATCH /api/groups/:id).
// Qoida lib/groupRules.ts da (klient bilan bir xil); bu yerda faqat
// nomzod bilan bir filialdagi, bir xonadagi tirik guruhlar o'qiladi.
//
// Filial bo'yicha kesiladi: xona jismoniy, "201 - xona" ikki filialda ham
// bo'lishi mumkin va ular bir-biriga xalaqit bermaydi.

/** To'qnashgan guruh haqida 409 javobga qo'shiladigan ma'lumot. */
export interface RoomClash {
  error: string;
  conflict: { id: number; name: string; day: string; time: string };
}

export async function findRoomClashInDb(
  db: Db,
  branchId: number,
  candidate: RoomSlot,
  excludeId?: number,
): Promise<RoomClash | null> {
  if (!candidate.room || !candidate.day || !candidate.time) return null;
  const rows = await db
    .collection("groups")
    // HOVUZ (09.10.2026): 1+2 da xona umumiy — 2-filial guruhi 1-binodagi
    // xonani ham oladi, bandlik ikkala filial guruhlariga qaraydi (lib/roomBranch.ts).
    .find({ $and: [{ room: candidate.room, status: { $in: [...ROOM_HOLDING_STATUSES] } }, pooledBranchInCondition([branchId])] })
    .project<{ id: number; name: string; room: string; day: string; time: string; status: string; period?: string; startDate?: string; endDate?: string }>({
      _id: 0, id: 1, name: 1, room: 1, day: 1, time: 1, status: 1, period: 1, startDate: 1, endDate: 1,
    })
    .toArray();
  const g = findRoomConflict(candidate, rows, uzDateIso(), excludeId);
  if (!g) return null;
  return {
    error: roomConflictText(candidate.room, g),
    conflict: { id: g.id, name: g.name, day: g.day, time: g.time },
  };
}
