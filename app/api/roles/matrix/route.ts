import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { ensureRoles } from "@/lib/roles";
import { readPermissions } from "@/lib/permissions";
import { loadStaffAccounts, type LoginState } from "@/lib/staffAccounts";
import { ADMIN_ROLE } from "@/lib/employeeRoleSync";

// GET /api/roles/matrix — «Rollar va huquqlar» jadvali (25-qism, yangi versiya).
//
// Bitta so'rovda: rollar (ustunlar), FAOL xodimlar (ustundagi «N xodim», alohida ruxsatlar va
// panel uchun) va filiallar. Ruxsat — bo'lim (/management-rollar; proxy jadvali). Rollar tizim
// sozlamasi — filialga kesilmaydi (lib/branchScope.ts, /api/hr-employees/ref dagi qaror).
//
// Telefon CHIQMAYDI (u «Login hisoblari» tabida, faqat adminga — /api/roles/logins). `branchIds`
// chiqadi: alohida ruxsat panelidagi «Doira» qatori — xodim qaysi filiallarni ko'radi.

export interface MatrixEmployee {
  id: number;
  name: string;
  turi: string;
  centerRoleId: number | null;
  /** Alohida ruxsat (`hr_employees.permissions`): massiv — istisno bor; `null` — rol bo'yicha. */
  override: string[] | null;
  branchIds: number[];
  /** Administrator (`users.role`) — cheklovdan ozod. */
  admin: boolean;
  login: LoginState;
  kurs: string;
  photoUrl: string;
}

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kiring" }, { status: 401 });
  const db = await ensureIndexes();
  const [roles, rows, branchRows, accounts] = await Promise.all([
    ensureRoles(db),
    db
      .collection("hr_employees")
      .find(
        { $or: [{ archReason: { $exists: false } }, { archReason: "" }, { archReason: null }] },
        { projection: { _id: 0, id: 1, name: 1, turi: 1, centerRoleId: 1, permissions: 1, branchIds: 1, kurs: 1, photoUrl: 1 } },
      )
      .sort({ name: 1 })
      .toArray(),
    db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray(),
    loadStaffAccounts(db),
  ]);

  const employees: MatrixEmployee[] = rows.map((r) => {
    const id = Number(r.id);
    const acc = accounts.get(id);
    return {
      id,
      name: String(r.name ?? ""),
      turi: String(r.turi ?? ""),
      centerRoleId: r.centerRoleId === null || r.centerRoleId === undefined ? null : Number(r.centerRoleId),
      override: Array.isArray(r.permissions) ? (readPermissions(r.permissions) ?? []) : null,
      branchIds: Array.isArray(r.branchIds) ? r.branchIds.map(Number).filter(Number.isFinite) : [],
      admin: Boolean(acc?.admin),
      login: acc?.state ?? "none",
      kurs: String(r.kurs ?? ""),
      photoUrl: typeof r.photoUrl === "string" ? r.photoUrl : "",
    };
  });

  return NextResponse.json({
    ok: true,
    me: { isAdmin: me.role === ADMIN_ROLE, employeeId: me.hrEmployeeId, access: me.role === ADMIN_ROLE ? null : me.permissions },
    roles,
    employees,
    branches: branchRows.map((b) => ({ id: Number(b.id), name: String(b.name ?? `Filial ${b.id}`) })),
  });
}
