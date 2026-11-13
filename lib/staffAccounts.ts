import type { Db } from "mongodb";
import { normalizePhone } from "@/lib/eskiz";

// XODIM ↔ LOGIN HISOBI (25-qism, «Rollar va huquqlar»). Jadval ustunidagi «N xodim», administrator
// ustuni, «Login hisoblari» tabi va alohida ruxsat panelidagi «login bor» — hammasi shu bog'lanishdan.
//
// Bog'lanish lib/rolePermissions.ts (resolvePermissions) va /api/roles/coverage bilan BIR XIL
// tartibda: avval `users.hrEmployeeId`, u yo'q bo'lsa telefon (normallashtirilgan). Telefon bo'yicha
// topishda faqat hech kimga bog'lanmagan hisob olinadi — boshqa xodimga bog'langan hisob raqami
// tasodifan mos kelsa, unga yopishib qolmasin.

export type LoginState =
  /** `users` hujjati yo'q — tizimga kira olmaydi. */
  | "none"
  /** Taklif yuborilgan (SMS havola + kod), hali faollashtirmagan. */
  | "invited"
  /** Taklif muddati (72 soat, lib/invite.ts → INVITE_TTL_MS) o'tgan. */
  | "expired"
  /** Parol o'rnatilgan, kira oladi. */
  | "active"
  /** Boshqa holat (bloklangan va h.k.). */
  | "blocked";

export interface StaffAccount {
  state: LoginState;
  /** `users.role === "admin"`. */
  admin: boolean;
  /** Taklif muddati (ISO) — `invited`/`expired` da. */
  inviteExpiresAt: string | null;
  /** Faollashtirilgan vaqt (ISO). */
  activatedAt: string | null;
  /** Admin tasdig'i kutilmoqda (lib/adminApproval.ts). */
  approvalPending: boolean;
}

interface UserRow {
  phone?: unknown;
  role?: unknown;
  hrEmployeeId?: unknown;
  status?: unknown;
  invite?: { expiresAt?: unknown } | null;
  activatedAt?: unknown;
  adminApproval?: unknown;
}

interface EmployeeRow {
  id?: unknown;
  phone?: unknown;
}

function iso(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function stateOf(u: UserRow, now: number): LoginState {
  if (u.status === "active") return "active";
  if (u.status === "invited") {
    const exp = iso(u.invite?.expiresAt);
    return exp && new Date(exp).getTime() < now ? "expired" : "invited";
  }
  return "blocked";
}

/** Sof qism (sinov uchun): xodimlar va hisoblar ro'yxatidan xodim id → hisob holati. */
export function linkAccounts(employees: EmployeeRow[], users: UserRow[], now = Date.now()): Map<number, StaffAccount> {
  const out = new Map<number, StaffAccount>();
  const ids = new Set(employees.map((e) => Number(e.id)).filter(Number.isFinite));
  const byPhone = new Map<string, number>();
  for (const e of employees) {
    const id = Number(e.id);
    const phone = normalizePhone(String(e.phone ?? ""));
    if (Number.isFinite(id) && phone && !byPhone.has(phone)) byPhone.set(phone, id);
  }
  const put = (id: number, u: UserRow) => {
    const prev = out.get(id);
    const next: StaffAccount = {
      state: stateOf(u, now),
      admin: u.role === "admin",
      inviteExpiresAt: u.status === "invited" ? iso(u.invite?.expiresAt) : null,
      activatedAt: iso(u.activatedAt),
      approvalPending: u.adminApproval === "pending",
    };
    // Bitta xodimga ikki hisob (eski import) — faol hisob ustun, admin belgisi saqlanadi.
    if (!prev || (prev.state !== "active" && next.state === "active")) out.set(id, { ...next, admin: next.admin || Boolean(prev?.admin) });
    else if (next.admin) out.set(id, { ...prev, admin: true });
  };
  // Avval id bo'yicha bog'langanlar, keyin telefon bo'yicha (bog'lanmaganlar). id bilan bog'langan
  // xodimga telefon bo'yicha hisob qo'shilmaydi; telefon bo'yicha ikki hisob bo'lsa — faol ustun.
  const linkedById = new Set<number>();
  for (const u of users) {
    const id = Number(u.hrEmployeeId);
    if (u.hrEmployeeId !== null && u.hrEmployeeId !== undefined && Number.isFinite(id) && ids.has(id)) {
      put(id, u);
      linkedById.add(id);
    }
  }
  for (const u of users) {
    const linked = u.hrEmployeeId !== null && u.hrEmployeeId !== undefined && Number.isFinite(Number(u.hrEmployeeId));
    if (linked) continue;
    const id = byPhone.get(normalizePhone(String(u.phone ?? "")));
    if (id !== undefined && !linkedById.has(id)) put(id, u);
  }
  return out;
}

/** Bazadan: barcha xodimlarning login holati (xodim id → hisob). */
export async function loadStaffAccounts(db: Db): Promise<Map<number, StaffAccount>> {
  const [employees, users] = await Promise.all([
    db.collection("hr_employees").find({}, { projection: { _id: 0, id: 1, phone: 1 } }).toArray(),
    db
      .collection("users")
      .find({}, { projection: { _id: 0, phone: 1, role: 1, hrEmployeeId: 1, status: 1, "invite.expiresAt": 1, activatedAt: 1, adminApproval: 1 } })
      .toArray(),
  ]);
  return linkAccounts(employees as EmployeeRow[], users as UserRow[]);
}
