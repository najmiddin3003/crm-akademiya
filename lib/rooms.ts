// Guruh → Xonalar (group/rooms). MongoDB `rooms` kolleksiyasi.
export interface Room {
  id: number;
  name: string; // Sarlavha — xona nomi
  capacity: number; // O'quvchi sig'imi
  note: string; // Izoh
  // Filial (branches.id). Xona jismoniy — bino bilan birga, shu bois aniq
  // bitta filialda turadi; "201 - xona" ikki filialda ham bo'lishi mumkin.
  // Maydoni yo'q eski yozuv — 1-filial (lib/branchScope.ts qoidasi).
  branchId?: number;
}

/** Xona qaysi filialda — maydoni yo'q eski yozuv 1-filial. */
export function roomBranchId(room: Pick<Room, "branchId">): number {
  return typeof room.branchId === "number" ? room.branchId : 1;
}
