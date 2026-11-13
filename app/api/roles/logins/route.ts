import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/adminOnly";
import { activationMessage } from "@/lib/invite";
import { loadStaffAccounts, type LoginState } from "@/lib/staffAccounts";
import { MAX_BATCH } from "@/app/api/temp-staff/invite/route";

// GET /api/roles/logins — «Rollar va huquqlar» → «Login hisoblari» tabi (25-qism, yangi versiya).
//
// FAQAT ADMIN (handler ichida): ro'yxatda telefonlar bor, «Login berish» esa
// POST /api/temp-staff/invite — u ham faqat admin. Proxy jadvalida yo'l /management-rollar ga
// bog'langan, lekin bo'lim ruxsati «kim admin» degan savolga javob bermaydi (lib/adminOnly.ts).
//
// Faqat FAOL (arxivda emas) xodimlar. Login holati lib/staffAccounts.ts dan — jadval ustunidagi
// «N xodim» va panel bilan bir xil bog'lanish (hrEmployeeId, bo'lmasa telefon).
//
// `smsPreview` — xodimga ketadigan HAQIQIY matn (Eskiz'da moderatsiyadan o'tgan shablon:
// faollashtirish havolasi + kod), token va kod o'rnida «…» va «••••••». Matn serverda yig'iladi:
// markaz nomi `SMS_CENTER_SHORT` dan (ish vaqtida o'qiladi), mijoz uni bilmaydi.

export interface LoginRow {
  id: number;
  name: string;
  /** Bazadagi ko'rinishda — ko'rsatishda formatlanadi. */
  phone: string;
  kurs: string;
  turi: string;
  centerRoleId: number | null;
  branchIds: number[];
  login: LoginState;
  /** Taklif muddati (ISO) — `invited`/`expired` da. */
  inviteExpiresAt: string | null;
  /** «Ikki bosqichli tasdiqlash» (`hr_employees.twoFactor`) — oxirgi taklifdagi tanlov. */
  twoFactor: boolean;
  admin: boolean;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "Bu bo'lim faqat admin uchun" }, { status: 403 });
  }
  const db = await ensureIndexes();
  const [rows, accounts] = await Promise.all([
    db
      .collection("hr_employees")
      .find(
        { $or: [{ archReason: { $exists: false } }, { archReason: "" }, { archReason: null }] },
        { projection: { _id: 0, id: 1, name: 1, phone: 1, kurs: 1, turi: 1, centerRoleId: 1, branchIds: 1, twoFactor: 1 } },
      )
      .sort({ name: 1 })
      .toArray(),
    loadStaffAccounts(db),
  ]);

  const employees: LoginRow[] = rows.map((r) => {
    const id = Number(r.id);
    const acc = accounts.get(id);
    return {
      id,
      name: String(r.name ?? ""),
      phone: String(r.phone ?? ""),
      kurs: String(r.kurs ?? ""),
      turi: String(r.turi ?? ""),
      centerRoleId: r.centerRoleId === null || r.centerRoleId === undefined ? null : Number(r.centerRoleId),
      branchIds: Array.isArray(r.branchIds) ? r.branchIds.map(Number).filter(Number.isFinite) : [],
      login: acc?.state ?? "none",
      inviteExpiresAt: acc?.inviteExpiresAt ?? null,
      twoFactor: Boolean(r.twoFactor),
      admin: Boolean(acc?.admin),
    };
  });

  return NextResponse.json({
    ok: true,
    employees,
    smsPreview: activationMessage("…", "••••••"),
    // Partiya chegarasi serverdan (bitta joyda) — mijoz ro'yxatni shunday bo'laklarga bo'lib yuboradi.
    maxBatch: MAX_BATCH,
  });
}
