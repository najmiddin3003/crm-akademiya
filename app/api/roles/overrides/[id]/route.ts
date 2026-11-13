import { NextResponse } from "next/server";
import type { Db } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getBranchScope } from "@/lib/branchScope";
import { canManageEmployeePayroll } from "@/lib/employeeBranches";
import { ADMIN_ROLE, isOwnRecord } from "@/lib/employeeRoleSync";
import { employeePermissions } from "@/lib/rolePermissions";
import { checkEmployeeGrant, grantorAccess } from "@/lib/permissionGrant";
import { isRoleKey } from "@/lib/roles";
import { normalizePhone } from "@/lib/eskiz";
import { isPathAllowed } from "@/lib/permissions";
import { INVITE_TTL_MS } from "@/lib/invite";
import {
  applyOverrideOp,
  cleanReason,
  isOverrideOp,
  mergeHistory,
  notesToHistory,
  readNotes,
  NOTES_KEEP,
  type AccessNote,
  type HistoryItem,
} from "@/lib/accessOverride";

// «ALOHIDA RUXSAT» PANELI (25-qism, Boshqaruv → Rollar va huquqlar).
//
// GET  /api/roles/overrides/:id — sabablar (`hr_employees.accessNotes`) va «Tarix».
// POST /api/roles/overrides/:id — qator bo'yicha amal:
//   { op: "add" | "restrict", row, reason }  — bo'limni ochish / yopish (sabab majburiy);
//   { op: "revert", row }                     — qatorni roldagi holatiga qaytarish;
//   { op: "reset" }                           — istisnoni butunlay olib tashlash;
//   { op: "role", roleFrom }                  — rol almashgani yozuvi (rolning o'zi
//                                               PATCH /api/hr-employees/:id da o'zgaradi).
//
// QOIDALAR (PATCH /api/hr-employees/:id dagi `permissions` yo'li bilan bir xil):
//   • «o'zida borini beradi» (lib/permissionGrant.ts) — o'ziga bo'lim ochib bo'lmaydi,
//     boshqaga faqat o'zida bor bo'limlar;
//   • oylik uyi qoidasi (lib/employeeBranches.ts → canManageEmployeePayroll) — ruxsatlar
//     oylikka bog'liq maydonlar ro'yxatida, hovuzdosh filial xodimi o'zgartira olmaydi;
//   • administrator cheklovdan ozod (lib/rolePermissions.ts) — unga istisno yozilmaydi.
// Navbardagi filialga KESILMAYDI: rollar tizim sozlamasi (/api/roles/matrix ham butun ro'yxat);
// admin bo'lmaganga yuqoridagi oylik uyi qoidasi — uning filiallari.

const NOT_FOUND = "Xodim topilmadi";
const PAGE = "/management-rollar";
const NO_ACCESS = "Bu bo'limga ruxsatingiz yo'q";

// Bo'lim ruxsati handler ichida HAM (proxy jadvali — lib/apiPermissions.generated.ts — sahifa panelni
// ulagandan keyin generator bilan to'ladi; ungacha route «sessiya yetarli» ro'yxatida turardi).

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Xodimga bog'langan hisoblar — lib/employeeRoleSync.ts dagi bog'lanish bilan bir xil. */
async function linkedUsers(db: Db, empId: number, phone: unknown) {
  const p = normalizePhone(String(phone ?? ""));
  const filter = p ? { $or: [{ hrEmployeeId: empId }, { phone: p, hrEmployeeId: null }] } : { hrEmployeeId: empId };
  return db
    .collection("users")
    .find(filter, { projection: { _id: 1, role: 1, status: 1, createdAt: 1, "invite.expiresAt": 1, activatedAt: 1 } })
    .toArray();
}

function isoOf(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  }
  return "";
}

/** Xodimning hozirgi roli nomi — jadval sarlavhasidagi bilan bir xil. */
async function roleNameNow(db: Db, emp: { turi?: unknown; centerRoleId?: unknown }, admin: boolean): Promise<string> {
  if (admin) return "Administrator";
  if (emp.centerRoleId !== null && emp.centerRoleId !== undefined) {
    const r = await db.collection("roles").findOne({ id: Number(emp.centerRoleId) }, { projection: { name: 1 } });
    return r ? String(r.name ?? "") : "Rol o'chirilgan";
  }
  if (isRoleKey(emp.turi)) {
    const r = await db.collection("roles").findOne({ key: emp.turi }, { projection: { name: 1 } });
    if (r) return String(r.name ?? "");
  }
  return typeof emp.turi === "string" && emp.turi && emp.turi !== "staff" ? emp.turi : "Lavozimsiz";
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Sessiya topilmadi" }, { status: 401 });
  if (!isPathAllowed(PAGE, me.permissions)) return NextResponse.json({ ok: false, error: NO_ACCESS }, { status: 403 });
  const db = await ensureIndexes();
  const emp = await db.collection("hr_employees").findOne({ id }, { projection: { _id: 0, phone: 1, accessNotes: 1 } });
  if (!emp) return NextResponse.json({ ok: false, error: NOT_FOUND }, { status: 404 });

  const notes = readNotes(emp.accessNotes);
  // Login voqealari — `users` hujjatining o'zidan (ishonchli): action_log dagi taklif so'rovi
  // natijasini bilmaydi (proxy javob holatini ko'rmaydi — SMS ketmagan bo'lishi ham mumkin).
  const users = await linkedUsers(db, id, emp.phone);
  const account: HistoryItem[] = [];
  for (const u of users) {
    const created = isoOf(u.createdAt);
    if (created) account.push({ kind: "account", at: created, byName: "" });
    const exp = isoOf(u.invite?.expiresAt);
    if (exp && u.status === "invited") account.push({ kind: "invite", at: new Date(new Date(exp).getTime() - INVITE_TTL_MS).toISOString(), byName: "" });
    const activated = isoOf(u.activatedAt);
    if (activated) account.push({ kind: "activated", at: activated, byName: "" });
  }
  return NextResponse.json({ ok: true, notes, history: mergeHistory([notesToHistory(notes), account]) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });

  let body: { op?: unknown; row?: unknown; reason?: unknown; roleFrom?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const me = await getCurrentUser();
  const scope = await getBranchScope();
  if (!me || !scope) return NextResponse.json({ ok: false, error: "Sessiya topilmadi" }, { status: 401 });
  if (!isPathAllowed(PAGE, me.permissions)) return NextResponse.json({ ok: false, error: NO_ACCESS }, { status: 403 });

  const db = await ensureIndexes();
  const col = db.collection("hr_employees");
  const emp = await col.findOne(
    { id },
    { projection: { _id: 0, id: 1, phone: 1, turi: 1, centerRoleId: 1, permissions: 1, branchIds: 1, payrollBranchId: 1, accessNotes: 1 } },
  );
  if (!emp) return NextResponse.json({ ok: false, error: NOT_FOUND }, { status: 404 });

  const users = await linkedUsers(db, id, emp.phone);
  const isAdminEmp = emp.turi === ADMIN_ROLE || users.some((u) => u.role === ADMIN_ROLE);
  const by = { byName: me.fullName || "", byId: me.hrEmployeeId ?? null, at: new Date().toISOString() };

  // Rol almashgani yozuvi (rolning o'zi PATCH /api/hr-employees/:id da, uning qoidalari bilan).
  if (body.op === "role") {
    const roleFrom = typeof body.roleFrom === "string" ? body.roleFrom.trim().slice(0, 60) : "";
    const roleTo = await roleNameNow(db, { turi: emp.turi, centerRoleId: emp.centerRoleId }, isAdminEmp);
    if (!roleFrom || roleFrom === roleTo) return NextResponse.json({ ok: true, notes: readNotes(emp.accessNotes) });
    const note: AccessNote = { kind: "role", row: "", reason: "", from: null, to: null, roleFrom, roleTo, ...by };
    await col.updateOne({ id }, { $push: { accessNotes: { $each: [note], $slice: -NOTES_KEEP } } } as never);
    return NextResponse.json({ ok: true, notes: readNotes([...(Array.isArray(emp.accessNotes) ? emp.accessNotes : []), note]) });
  }

  if (!isOverrideOp(body.op)) return NextResponse.json({ ok: false, error: "Noma'lum amal" }, { status: 400 });
  const op = body.op;

  if (isAdminEmp) {
    return NextResponse.json({ ok: false, error: "Administrator cheklovdan ozod — alohida ruxsat kerak emas" }, { status: 409 });
  }
  // Oylik uyi qoidasi — PATCH /api/hr-employees/:id dagi bilan bir xil matn.
  if (!canManageEmployeePayroll(emp, scope)) {
    const home = Number(emp.payrollBranchId ?? (Array.isArray(emp.branchIds) ? emp.branchIds[0] : NaN));
    const b = Number.isFinite(home) ? await db.collection("branches").findOne({ id: home }, { projection: { name: 1 } }) : null;
    return NextResponse.json(
      { ok: false, error: `Bu o'zgarishni faqat xodimning oylik filiali (${b?.name ?? home}) xodimi yoki admin qila oladi` },
      { status: 403 },
    );
  }

  const reason = cleanReason(body.reason, op);
  if (!reason.ok) return NextResponse.json({ ok: false, error: reason.error }, { status: 400 });

  const own = Array.isArray(emp.permissions) ? ((await employeePermissions(db, { permissions: emp.permissions })) ?? []) : null;
  const roleAccess = await employeePermissions(db, { turi: emp.turi, centerRoleId: emp.centerRoleId, permissions: null });
  const result = applyOverrideOp(own, roleAccess, op, typeof body.row === "string" ? body.row : null);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });

  // «O'zida borini beradi» — o'zgarishdan oldingi va keyingi HAQIQIY ruxsat.
  const grantor = grantorAccess(me);
  if (grantor !== null) {
    const before = await employeePermissions(db, { turi: emp.turi, centerRoleId: emp.centerRoleId, permissions: emp.permissions });
    const after = result.next ?? roleAccess;
    const grant = checkEmployeeGrant(grantor, { self: await isOwnRecord(db, me, id, emp.phone), personal: true, before, after });
    if (!grant.ok) return NextResponse.json({ ok: false, error: grant.error }, { status: grant.status });
  }

  const note: AccessNote = {
    kind: op,
    row: result.row?.key ?? "",
    reason: reason.reason,
    from: result.from,
    to: result.to,
    ...by,
  };
  await col.updateOne(
    { id },
    { $set: { permissions: result.next }, $push: { accessNotes: { $each: [note], $slice: -NOTES_KEEP } } } as never,
  );
  const notes = readNotes([...(Array.isArray(emp.accessNotes) ? emp.accessNotes : []), note]);
  return NextResponse.json({ ok: true, override: result.next, notes });
}
