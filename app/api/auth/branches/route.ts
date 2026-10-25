import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { BRANCH_COOKIE, getBranchScope } from "@/lib/branchScope";
import { branchPool, collapseBranchPools } from "@/lib/branchPools";
import { ensureIndexes } from "@/lib/mongodb";
import { shellRoleLabel } from "@/lib/uiVersionServer";

// GET /api/auth/branches — kirishdan keyingi «Filial tanlash» (yangi kirish sahifasi, rasm «Filial
// tanlash», 25.10.2026, 14-qism): «Xush kelibsiz, Abdulloh! Qaysi filialda ishlaysiz?».
//
//   name          — ismi (salomlashish uchun);
//   branches      — ruxsat etilgan filiallar (1+2 hovuzi BITTA qator — navbardagi tanlagich kabi),
//                   har birida lavozim: filial biriktiruvidagi rol (Rollar), bo'lmasa umumiy lavozim;
//   lastBranchId  — shu qurilmada oxirgi tanlangani (navbar cookie'si) — «oxirgi marta shu yerda».
//
// Tanlov — POST /api/branch (navbardagi bilan bir xil). Faqat sessiya bilan (ro'yxatda yo'q yo'l).

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const rows = await db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray();
  const allowed = rows.map((r) => ({ id: Number(r.id), name: String(r.name ?? "") })).filter((b) => scope.allowed.includes(b.id));

  const raw = Number((await cookies()).get(BRANCH_COOKIE)?.value);
  const last = Number.isFinite(raw) && scope.allowed.includes(raw) ? raw : null;
  const list = collapseBranchPools(allowed, last ?? scope.branchId);

  // Lavozim: filial biriktiruvidagi rol (hr_employees.branchAssignments[].roleId → roles), aks holda
  // yuqori paneldagi umumiy lavozim (lib/uiVersionServer.ts → shellRoleLabel).
  const general = await shellRoleLabel(db, { role: me.role, hrEmployeeId: me.hrEmployeeId });
  const perBranch = new Map<number, string>();
  let name = me.fullName || "";
  if (me.hrEmployeeId !== null) {
    const emp = await db.collection("hr_employees").findOne({ id: me.hrEmployeeId }, { projection: { _id: 0, name: 1, branchAssignments: 1 } });
    if (typeof emp?.name === "string" && emp.name.trim()) name = emp.name;
    const assigns = Array.isArray(emp?.branchAssignments) ? (emp.branchAssignments as { branchId?: unknown; roleId?: unknown }[]) : [];
    const roleIds = [...new Set(assigns.map((a) => Number(a.roleId)).filter((n) => Number.isFinite(n) && n > 0))];
    if (roleIds.length) {
      const roles = await db.collection("roles").find({ id: { $in: roleIds } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray();
      const roleName = new Map(roles.map((r) => [Number(r.id), String(r.name ?? "").trim()]));
      for (const a of assigns) {
        const n = roleName.get(Number(a.roleId));
        if (!n) continue;
        // Hovuz qatorida ikkala binoning biriktiruvi ham hisobga olinadi.
        for (const b of branchPool(Number(a.branchId))) if (!perBranch.has(b)) perBranch.set(b, n);
      }
    }
  }

  const lastRow = last === null ? null : (list.find((b) => branchPool(b.id).includes(last))?.id ?? null);
  return NextResponse.json({
    ok: true,
    name: name.trim().split(/\s+/)[0] || "",
    lastBranchId: lastRow,
    branches: list.map((b) => {
      const own = perBranch.get(b.id);
      // `roleKey` — tarjima kaliti (umumiy lavozim), `role` — Rollar'dagi nom (o'girilmaydi).
      return own ? { id: b.id, name: b.name, role: own, roleKey: false } : { id: b.id, name: b.name, role: general, roleKey: true };
    }),
  });
}
