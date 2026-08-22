// Dars jadvali sahifasining tepasidagi KPI kartalari (referens:
// akademiya.edutizim.uz/home — jadval ustida ikki qatorda 12 ta karta).
//
// MUHIM: sonlar shu yerda mustaqil to'qib chiqarilmaydi. Har biri tegishli
// sahifa qanday hisoblasa, AYNAN shunday hisoblanadi — aks holda kartadagi
// son bilan sahifadagi qatorlar soni bir-biriga to'g'ri kelmay qolardi.
// Shuning uchun quyida o'sha sahifalardagi shartlar takrorlangan va har biri
// yonida qaysi sahifadan olingani yozilgan.

import { createInitialOrders, type Order } from "@/lib/ordersData";

export interface ScheduleKpi {
  key: string;
  label: string;
  value: number;
  /** Ikonka doirasi foni va rangi (referensdagi ranglarga yaqin). */
  bg: string;
  fg: string;
  /** Sidebar sprite'idagi ikonka id (Sidebar.tsx <defs>). */
  icon: string;
  /** Bosilganda o'tadigan sahifa (bo'sh bo'lsa — bosilmaydi). */
  href: string;
}

// components/students/ArchiveStudentsPage.tsx
const ARCHIVE_STATUSES = ["Bekor qilindi", "Yakunlandi", "O'tkazildi"];

// components/students/ActiveStudentsPage.tsx → genBalance()
function genBalance(seed: number): number {
  const magnitude = 1_000_000 + ((seed * 137) % 6_000_000);
  return seed % 5 === 0 ? magnitude : -magnitude;
}

// components/students/ActiveStudentsPage.tsx → buildRows()
function isFrozen(i: number): boolean {
  return i % 13 === 0;
}
function isNewStudent(o: Order, i: number): boolean {
  return Boolean(o.isNew) || i % 5 === 1;
}

/**
 * 12 ta KPI. `groupCount` — /api/groups dan keladigan HAQIQIY guruhlar soni,
 * `firstLessonCount` — /api/orders dagi birinchi darsga yozilganlar soni
 * (/first-lessons sahifasi bilan bir xil shart). Qolganlari hozircha demo
 * generatordan, chunki o'quvchilar uchun status/balans maydonlari backendda
 * hali yo'q.
 */
export function computeScheduleKpis(groupCount: number, firstLessonCount: number): ScheduleKpi[] {
  const orders = createInitialOrders();

  const active = orders.filter((o, i) => !isFrozen(i) && !isNewStudent(o, i));
  const frozen = orders.filter((_, i) => isFrozen(i));
  const newStudents = orders.filter((o) => o.status === "Yangi");
  const archived = orders.filter((o) => ARCHIVE_STATUSES.includes(o.status));
  const debtors = active.filter((o) => genBalance(o.id) < 0);
  const cancelled = orders.filter((o) => o.status === "Bekor qilindi");
  const finished = orders.filter((o) => o.status === "Yakunlandi");
  // "Birinchi to'lovni qilganlar" — balansi musbat bo'lgan yangi o'quvchilar.
  const firstPaid = newStudents.filter((o) => genBalance(o.id) > 0);

  return [
    { key: "orders", label: "Buyurtmalar", value: orders.length, bg: "#dcfce7", fg: "#16a34a", icon: "i-user-plus", href: "/orders-list" },
    { key: "first-lesson", label: "Birinchi darsga keladiganlar", value: firstLessonCount, bg: "#dbeafe", fg: "#2563eb", icon: "i-users-group", href: "/first-lessons" },
    { key: "new", label: "Yangi o'quvchilar", value: newStudents.length, bg: "#f3e8ff", fg: "#9333ea", icon: "i-user", href: "/new-students" },
    { key: "active", label: "Aktiv o'quvchilar", value: active.length, bg: "#dcfce7", fg: "#16a34a", icon: "i-users-group", href: "/active-students" },
    { key: "left-order", label: "Buyurtmadan ketganlar", value: cancelled.length, bg: "#fee2e2", fg: "#dc2626", icon: "i-file-text", href: "/orders-list" },
    { key: "left-new", label: "Yangi o'quvchidan ketganlar", value: 0, bg: "#fee2e2", fg: "#dc2626", icon: "i-user", href: "/new-students" },
    { key: "left-active", label: "Aktiv o'quvchidan ketganlar", value: finished.length, bg: "#fee2e2", fg: "#dc2626", icon: "i-user", href: "/archive-students" },
    { key: "debtors", label: "Qarzdorlar", value: debtors.length, bg: "#e5e7eb", fg: "#111827", icon: "i-wallet", href: "/reports-unpaid" },
    { key: "groups", label: "Guruhlar", value: groupCount, bg: "#dbeafe", fg: "#2563eb", icon: "i-users-group", href: "/groups" },
    { key: "first-paid", label: "Birinchi to'lovni qilganlar", value: firstPaid.length, bg: "#fef9c3", fg: "#ca8a04", icon: "i-wallet", href: "/finance-transactions" },
    { key: "frozen", label: "Muzlatilgan", value: frozen.length, bg: "#cffafe", fg: "#0891b2", icon: "i-archive", href: "/students-list" },
    { key: "archive", label: "Arxivlar", value: archived.length, bg: "#e5e7eb", fg: "#6b7280", icon: "i-archive", href: "/archive-students" },
  ];
}
