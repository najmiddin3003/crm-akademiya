import type { Db } from "mongodb";
import type { BranchScope } from "@/lib/branchScope";
import { branchPool, sameBranchPool } from "@/lib/branchPools";
import { computeDebtors } from "@/lib/debtors";
import { roomBranchId, type Room } from "@/lib/rooms";
import { roomLabel } from "@/components/v2/ui/groupStatus";

// HISOBOTLAR → «FAOL O'QUVCHILAR» (27-qism, rasmlar 47–50) — o'rinning TO'LOV HOLATI va
// guruh SIG'IMI. Hisobning o'zi — lib/reportStudents.ts → computeActiveStudents.
//
// TO'LOV HOLATI — Qarzdorlar hisoboti (/reports-unpaid, lib/debtors.ts → computeDebtors)
// bilan AYNAN bir manba, hovuz (1+2) bo'yicha alohida chaqiriladi — o'sha hisobot ham
// bitta filial (hovuzi bilan) ko'radi:
//   • Qarzdor          — hisob sanasida `debt > 0` (o'tgan darslar to'lanmagan yoki qisman);
//   • To'lagan         — qarz yo'q VA shu oy oxirigacha bo'ladigan darslar ham to'langan
//                        (to'langan ≥ oy oxirigacha hisob, to'lovi bor);
//   • Muddati kelmagan — qolgani: qarz yo'q, lekin oyning qolgan darslari hali to'lanmagan
//                        (to'lov o'tgan darslarni qoplaydi), darsi boshlanmagan guruh ham.
// To'lov guruhga emas, o'quvchiga yoziladi (lib/debtors.ts izohi) — holat o'quvchining shu
// hovuzdagi HAMMA o'rniga bir xil. Narxi/jadvali noma'lum guruhda hisob 0 — u yerdagi
// qarzsiz o'rin alohida sanaladi (`unknown`, holati taxminiy).
//
// SIG'IM — O'quv bo'limi → Birinchi darslar → «Bo'sh o'rinlar» bilan bir xil qoida
// (app/api/first-lessons/groups-info): guruh xonasining sig'imi — xona nomi bo'yicha,
// guruh filiali yoki uning hovuzidan; 0 yoki topilmasa — noma'lum (null).

export type SeatPay = "paid" | "debt" | "notDue";

/** Hovuz vakili (1+2 → 1); hovuzsiz filial — o'zi. */
export function poolKey(branchId: number): number {
  return branchPool(branchId)[0] ?? branchId;
}

export interface PayLookup {
  /** O'quvchining shu hovuzdagi holati; `unknown` — shu guruhda narx/jadval/boshlanish noma'lum. */
  of(pool: number, pupilId: number, groupId: number): { pay: SeatPay; unknown: boolean };
  /** Qarzdorlar hisobotidagi qarzdorlar soni (hovuzlar yig'indisi) — guruhdan chiqqanlari ham. */
  reportDebtors: number;
}

interface PupilPay {
  pay: SeatPay;
  /** Narxi/jadvali noma'lum guruhlar. */
  unknownGroups: Set<number>;
}

/**
 * @param pools  hovuz vakillari (`poolKey`)
 * @param asOf   hisob sanasi (qarz shu kungacha)
 * @param monthEnd shu oyning oxirgi kuni («To'lagan» chegarasi)
 */
export async function loadPayStatus(db: Db, scope: BranchScope, pools: readonly number[], asOf: string, monthEnd: string): Promise<PayLookup> {
  const per = await Promise.all(
    pools.map(async (pool) => {
      const s: BranchScope = { ...scope, branchId: pool };
      const [now, end] = await Promise.all([computeDebtors(db, s, asOf), monthEnd > asOf ? computeDebtors(db, s, monthEnd) : Promise.resolve(null)]);
      const chargedEnd = new Map((end ?? now).rows.map((r) => [r.id, r.charged]));
      const map = new Map<number, PupilPay>();
      let debtors = 0;
      for (const r of now.rows) {
        const unknownGroups = new Set(r.groups.filter((g) => g.issues.length > 0).map((g) => g.groupId));
        let pay: SeatPay;
        if (r.debt > 0) {
          pay = "debt";
          debtors += 1;
        } else {
          const need = Math.max(chargedEnd.get(r.id) ?? r.charged, r.charged);
          pay = r.paid > 0 && r.paid >= need ? "paid" : "notDue";
        }
        map.set(r.id, { pay, unknownGroups });
      }
      return { pool, map, debtors };
    }),
  );
  const byPool = new Map(per.map((p) => [p.pool, p.map]));
  return {
    of(pool, pupilId, groupId) {
      const x = byPool.get(pool)?.get(pupilId);
      // Qatori yo'q — hali darsi bo'lmagan (yangi qo'shilgan yoki guruh yig'ilmoqda).
      if (!x) return { pay: "notDue", unknown: false };
      return { pay: x.pay, unknown: x.pay !== "debt" && x.unknownGroups.has(groupId) };
    },
    reportDebtors: per.reduce((s, p) => s + p.debtors, 0),
  };
}

type CapRoom = Pick<Room, "name" | "capacity" | "branchId">;

/** Guruh → xonasining sig'imi (yoki null). Xonalar bir marta o'qiladi. */
export async function loadRoomCapacity(db: Db): Promise<(g: { room?: string; branchId?: number | null }) => number | null> {
  const rooms = (await db
    .collection("rooms")
    .find({}, { projection: { _id: 0, name: 1, capacity: 1, branchId: 1 } })
    .toArray()) as unknown as CapRoom[];
  const byName = new Map<string, CapRoom[]>();
  for (const r of rooms) {
    const key = roomLabel(r.name).toLowerCase();
    if (!key) continue;
    const list = byName.get(key);
    if (list) list.push(r);
    else byName.set(key, [r]);
  }
  return (g) => {
    const name = roomLabel(g.room).toLowerCase();
    if (!name) return null;
    const same = byName.get(name) ?? [];
    const room = same.find((r) => g.branchId == null || sameBranchPool(roomBranchId(r), g.branchId)) ?? (same.length === 1 ? same[0] : undefined);
    return room && Number(room.capacity) > 0 ? Number(room.capacity) : null;
  };
}
