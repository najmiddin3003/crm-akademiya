import type { StudentRow } from "@/lib/studentsData";
import type { StudentListRow } from "@/lib/studentListsTypes";

/** Ro'yxat qatori → eski oynalar kutadigan `StudentRow` (To'lov qabul qilish, Holatni o'zgartirish). */
export function toStudentRow(r: StudentListRow): StudentRow {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    // Kartadagi balans — to'langan − hisoblangan (qarz manfiy), o'quvchi sahifasidagi kabi.
    balance: -r.debt,
    coin: 0,
    createdAt: r.createdAt,
    moderator: "",
    source: r.source,
    groups: r.groups.map((g) => g.name).join(", "),
    category: "",
    status: r.status,
    statusReason: r.statusReason,
    statusChangedAt: r.statusChangedAt,
  };
}
