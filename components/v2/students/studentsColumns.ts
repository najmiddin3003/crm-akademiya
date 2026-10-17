"use client";

import { useColumnPrefs, type ColumnDef } from "@/components/v2/ui/columnPrefs";

// YANGI O'QUVCHILAR RO'YXATI — «Ustunlar» tanlovi (design/v2/DESIGN.md →
// «Ustunlar oynasi»). «O'quvchi» (avatar + ism + telefon) qulflangan — doim
// birinchi; belgilash va «⋯» ham doim bor; qolganini xodim o'zi yoqadi,
// o'chiradi va SURIB TARTIBLAYDI; qator zichligi ham shu yerda. Saqlash —
// components/v2/ui/columnPrefs.ts (har brauzerda).
//
// Eski sahifadagi «To'lov sanasi», «Taklif qilganlari», «Ilovani yuklab olish
// sanasi», «Shartnoma», «Kelmagan davri» bu yerda YO'Q: o'quvchi modelida
// ularning maydoni yo'q, eski jadvalda ham doim «—» turardi (SAVOLLAR 30).

export type StudentColumnKey =
  | "name"
  | "id"
  | "groups"
  | "teacher"
  | "balance"
  | "coin"
  | "status"
  | "source"
  | "moderator"
  | "category"
  | "createdAt";

export type StudentSortKey = "name" | "balance" | "coin" | "createdAt";

export interface StudentColumn extends ColumnDef<StudentColumnKey> {
  /** Saralash kaliti — sarlavha bosilsa shu bo'yicha. */
  sort?: StudentSortKey;
}

/**
 * Jadvaldagi sukut tartib. 18.10.2026 dagi «O'quvchi · Tezkor panel» rasmida
 * jadval boshi ko'rindi: O'quvchi → Guruh (kurs, fan rangidagi nuqta bilan) →
 * O'qituvchi. Shu sabab «Guruh» kursni ko'rsatadi (alohida «Kurs» ustuni
 * ortiqcha bo'ldi), ID va Manba esa sukutda o'chiq — 1366 px noutbukda jadval
 * aylantirishsiz sig'sin.
 */
export const STUDENT_COLUMNS: StudentColumn[] = [
  { key: "name", label: "O'quvchi", on: true, locked: true, sort: "name" },
  { key: "groups", label: "Guruh", on: true },
  { key: "teacher", label: "O'qituvchi", on: true },
  { key: "balance", label: "Balans", on: true, sort: "balance", align: "right" },
  { key: "coin", label: "Tanga", on: true, sort: "coin", align: "right" },
  { key: "status", label: "Holati", on: true },
  { key: "createdAt", label: "Qo'shilgan", on: true, sort: "createdAt" },
  { key: "id", label: "ID", on: false },
  { key: "source", label: "Manba", on: false },
  { key: "moderator", label: "Moderator", on: false },
  { key: "category", label: "Kategoriya", on: false },
];

/**
 * «2» — 18.10.2026 da sukut o'zgardi (Guruh/O'qituvchi): eski tanlov hammada
 * yangi sukutga qaytsin. Shu kalitdagi oddiy massiv (tartib bilan) yangi
 * shaklga o'zi o'tadi — qayta boshlash shart emas.
 */
const KEY = "v2:students-list:columns:2";

export function useStudentColumns() {
  return useColumnPrefs(KEY, STUDENT_COLUMNS);
}
