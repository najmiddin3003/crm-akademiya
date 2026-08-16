import type { Equipment } from "./equipment";
import type { Room } from "./rooms";

// Guruh → Xonalar sahifasidagi "Analitika" tabi uchun hisob-kitob.
//
// Referensda bu tab 4 ta ko'rsatkich va ikkita jadvaldan iborat:
// "Texnik holati bo'yicha" va "Xonalar bo'yicha".
//
// MUHIM: referensning "Jihoz qo'shish" formasi ham bizniki kabi FAQAT uch
// maydondan iborat (Jihoz nomi / Inventar kodi / Narxi (dona uchun)) — unda
// na texnik holat, na xona tanlanadi. Shuning uchun:
//   • texnik holat maydoni ixtiyoriy, ko'rsatilmagan jihoz "Alo" deb sanaladi;
//   • xona bog'lanishi umuman yo'q, shu sababli "Xonalar bo'yicha" jadvali
//     bo'sh qoladi — referensda ham shunday ("Jihozlar mavjud emas").
// Model shu maydonlarga ega bo'lgach, quyidagi funksiyalar o'zgarmaydi.

export const EQUIPMENT_CONDITIONS = ["Alo", "Ta'mirtalab", "Yaroqsiz / Singan"] as const;

export type EquipmentCondition = (typeof EQUIPMENT_CONDITIONS)[number];

// `Equipment` da hozircha bu maydonlar yo'q — kelajakda qo'shilsa avtomatik
// hisobga olinadi.
type EquipmentExtras = Equipment & { condition?: EquipmentCondition; room?: string };

export interface ConditionStat {
  condition: EquipmentCondition;
  count: number;
  value: number;
}

export interface RoomStat {
  room: string;
  count: number;
  value: number;
}

export function conditionStats(items: Equipment[]): ConditionStat[] {
  return EQUIPMENT_CONDITIONS.map((condition) => {
    const rows = (items as EquipmentExtras[]).filter(
      (r) => (r.condition ?? "Alo") === condition,
    );
    return {
      condition,
      count: rows.length,
      value: rows.reduce((s, r) => s + (r.price || 0), 0),
    };
  });
}

export function roomEquipmentStats(items: Equipment[], rooms: Room[]): RoomStat[] {
  const byRoom = new Map<string, RoomStat>();
  for (const r of items as EquipmentExtras[]) {
    if (!r.room) continue;
    const cur = byRoom.get(r.room) ?? { room: r.room, count: 0, value: 0 };
    cur.count += 1;
    cur.value += r.price || 0;
    byRoom.set(r.room, cur);
  }
  // Xona tartibi ro'yxatdagidek bo'lsin.
  return rooms.map((rm) => byRoom.get(rm.name)).filter((x): x is RoomStat => Boolean(x));
}

// "Ta'mirtalab & Singan" ko'rsatkichi — Alo dan boshqa hamma holat.
export function brokenCount(items: Equipment[]): number {
  return conditionStats(items)
    .filter((s) => s.condition !== "Alo")
    .reduce((s, r) => s + r.count, 0);
}

export function totalValue(items: Equipment[]): number {
  return items.reduce((s, r) => s + (r.price || 0), 0);
}
