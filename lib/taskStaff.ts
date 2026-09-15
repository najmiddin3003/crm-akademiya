import type { Db } from "mongodb";
import type { CurrentUser } from "@/lib/auth";
import { employeeNameById, nameEq } from "@/lib/currentEmployee";
import type { TaskAuthor } from "@/lib/tasksData";

// Topshiriq YOZUVCHILARI uchun umumiy yordamchilar (POST /api/tasks va
// PATCH /api/tasks/[id]) — mas'ul xodimni id'ga bog'lash va muallifni
// qayd etish. Ikkala route ham bir xil qoidada ishlashi shart, aks holda
// bir joydan yaratilgan topshiriq xodim oynasiga tushib, boshqasidan
// yaratilgani tushmasdi.

/**
 * Mas'ul xodimning `hr_employees.id` si.
 *
 * Mijoz aniq id yuborsa (Topshiriqlar sahifasi — tanlov ro'yxati id'ni
 * biladi) u ISHONILADI, faqat mavjudligi tekshiriladi. Yubormasa ism
 * bo'yicha topiladi: o'quvchi profilidagi "Eslatma qo'shish" oynasi
 * faqat ism yuboradi (components/students/VazifaTabContent.tsx).
 *
 * Ism bo'yicha qidiruv katta-kichik harfni farqlamaydi (`nameEq`), lekin
 * ARXIVDAGI xodimni chetlab o'tadi: bazada bir odam ikki yozuvda uchraydi
 * (42 va 56 — "Najmiddin Turgunpolatov"), tirigi kerak. Topilmasa
 * `undefined` — topshiriq baribir yoziladi, faqat xodim oynasiga
 * tushmaydi (ism satri o'z holicha qoladi).
 */
export async function resolveStaffId(db: Db, staffId: unknown, staffName: unknown): Promise<number | undefined> {
  const id = Number(staffId);
  if (Number.isFinite(id) && id > 0) {
    const found = await db.collection("hr_employees").findOne({ id }, { projection: { _id: 1 } });
    if (found) return id;
  }
  const name = String(staffName ?? "").trim();
  if (!name) return undefined;
  const rows = await db
    .collection("hr_employees")
    .find({ name: nameEq(name) }, { projection: { _id: 0, id: 1, archReason: 1 } })
    .toArray();
  const live = rows.find((r) => !String(r.archReason ?? "").trim()) ?? rows[0];
  const n = Number(live?.id);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Joriy foydalanuvchi — topshiriq MUALLIFI sifatida.
 *
 * Ism `hr_employees` dan (lib/currentEmployee.ts izohi: admin hisobining
 * `fullName` i "Admin", xodim yozuvi esa haqiqiy ismga olib boradi);
 * bog'lanmagan hisobda `users.fullName` ga tushadi.
 */
export async function taskAuthorOf(db: Db, me: CurrentUser): Promise<TaskAuthor> {
  const name = (await employeeNameById(db, me.hrEmployeeId)) || String(me.fullName ?? "").trim();
  return { userId: me.id, employeeId: me.hrEmployeeId, name };
}
