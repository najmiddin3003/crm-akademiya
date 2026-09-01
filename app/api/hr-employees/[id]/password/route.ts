import { NextResponse } from "next/server";
import type { Db } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { isValidPassword, normalizePhone, setPasswordFields } from "@/lib/invite";

// Xodim profilidagi PAROL oynasi (kalit ikonkasi).
//
//   GET  /api/hr-employees/:id/password — joriy parolni ko'rsatish
//   PUT  /api/hr-employees/:id/password — admin yangi parol o'rnatadi
//
// PAROL NEGA OCHIQ KO'RINADI: login tekshiruvi bcrypt hash bilan ketadi
// (lib/invite.ts), bu esa uning YONIDAGI qaytariladigan shifrlangan nusxa
// (`users.passwordEnc`, lib/crypto.ts). Nusxa ATAYLAB, aynan shu ekran
// uchun qo'yilgan — bu route yangi tamoyil kiritmaydi.
//
// FAQAT ADMIN. Qolgan xodim route'lari sahifa ruxsati bilan cheklanadi
// (/management-xodimlar), ammo bu yerda javob boshqa odamning OCHIQ paroli:
// "Xodimlar" bo'limini ko'ra oladigan har bir moderator uni o'qiy olishi
// noto'g'ri bo'lardi. Shu sabab qo'shimcha shart.
async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Avtorizatsiya kerak" }, { status: 401 });
  if (me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Faqat administrator uchun" }, { status: 403 });
  }
  return null;
}

/**
 * `hr_employees.id` → `users` hujjati.
 *
 * Asosiy bog'lanish — `users.hrEmployeeId` (RAQAM). Skript bilan seed
 * qilingan yoki xodimlar ro'yxati import qilinishidan oldin yaratilgan
 * hisoblarda u yo'q; bunday holatda telefon bo'yicha topib, bog'lanishni
 * yozib qo'yamiz (lib/rolePermissions.ts dagi bilan bir xil qoida).
 */
async function findUser(db: Db, empId: number, phone: unknown) {
  const byId = await db.collection("users").findOne({ hrEmployeeId: empId });
  if (byId) return byId;
  if (typeof phone !== "string" || !phone) return null;
  const byPhone = await db.collection("users").findOne({ phone: normalizePhone(phone) });
  if (byPhone) {
    await db.collection("users").updateOne({ _id: byPhone._id }, { $set: { hrEmployeeId: empId } });
  }
  return byPhone;
}

async function loadEmployee(empId: number) {
  const db = await ensureIndexes();
  const emp = await db.collection("hr_employees").findOne({ id: empId }, { projection: { phone: 1 } });
  return { db, emp };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const empId = Number((await params).id);
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const { db, emp } = await loadEmployee(empId);
  if (!emp) return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });

  const user = await findUser(db, empId, emp.phone);
  // UCH XIL holat bir xil emas va ularni bitta `password: null` ga
  // qo'shib yuborib bo'lmaydi — interfeys ularni ajratib ko'rsatishi kerak:
  //   hisob yo'q · parol o'rnatilmagan · parol bor, lekin o'qib bo'lmadi
  //   (ENCRYPTION_KEY almashgan).
  return NextResponse.json({
    ok: true,
    hasAccount: Boolean(user),
    status: user?.status ?? null,
    hasPassword: Boolean(user?.passwordEnc),
    password: user?.passwordEnc ? decryptSecret(user.passwordEnc as string) : null,
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const empId = Number((await params).id);
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  if (!isValidPassword(body?.password)) {
    return NextResponse.json({ ok: false, error: "Parol kamida 8 ta belgidan iborat bo'lsin" }, { status: 400 });
  }

  const { db, emp } = await loadEmployee(empId);
  if (!emp) return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });

  const user = await findUser(db, empId, emp.phone);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Xodimda tizim hisobi yo'q — avval faollashtirish taklifi yuborilishi kerak" },
      { status: 409 },
    );
  }

  const { passwordHash, passwordEnc } = await setPasswordFields(body.password);
  await db.collection("users").updateOne(
    { _id: user._id },
    {
      // Admin parol qo'ysa, taklif kutayotgan hisob DARHOL ishlaydi va
      // eski faollashtirish havolasi kuchini yo'qotadi
      // (app/api/employees/[id]/route.ts dagi bilan bir xil qaror).
      $set: { passwordHash, passwordEnc, passwordUpdatedAt: new Date().toISOString(), status: "active" },
      $unset: { invite: "" },
    },
  );
  return NextResponse.json({ ok: true });
}
