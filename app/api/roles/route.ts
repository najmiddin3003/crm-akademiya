import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { sanitizePermissions } from "@/lib/permissions";
import { ensureRoles, nextRoleId, type Role } from "@/lib/roles";
import { getCurrentUser } from "@/lib/auth";
import { checkRoleGrant, grantorAccess } from "@/lib/permissionGrant";

// Boshqaruv → Rollar backend'i (MongoDB `roles`).
//
// GET — o'rnatilgan rollarni (teacher/moderator) kafolatlab, HAMMASINI
// qaytaradi. POST — qo'lda yangi rol qo'shadi.
export async function GET() {
  const db = await ensureIndexes();
  const roles = await ensureRoles(db);
  return NextResponse.json({ ok: true, roles });
}

export async function POST(req: Request) {
  let body: Partial<Role>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Rol nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  await ensureRoles(db);

  // `key` MIJOZDAN OLINMAYDI. U faqat o'rnatilgan rollarga tegishli va
  // `hr_employees.turi` ga bog'langan — mijoz uni yubora olsa, yangi rol
  // o'zini "teacher" deb ko'rsatib, butun bir lavozimning ruxsatlarini
  // egallab olardi.
  const role: Role = {
    id: await nextRoleId(db),
    name,
    description: (body.description || "").trim(),
    // Yangi rolda hamma bo'lim YOPIQ — ruxsat ataylab beriladi.
    permissions: body.permissions === undefined || body.permissions === null
      ? []
      : sanitizePermissions(body.permissions),
  };
  // «O'ZIDA BORINI BERADI» (lib/permissionGrant.ts): admin bo'lmagan xodim yangi rolga faqat
  // o'zida bor bo'limlarni qo'ya oladi. Bu route Xodimlar bo'limiga ham ochiq (xodim oynasi rollar
  // ro'yxatini shundan o'qiydi) — usiz hamma bo'limli rol yaratib, uni o'ziga berib bo'lardi.
  const grant = checkRoleGrant(grantorAccess(await getCurrentUser()), [], role.permissions ?? []);
  if (!grant.ok) return NextResponse.json({ ok: false, error: grant.error }, { status: grant.status });
  await db.collection("roles").insertOne({ ...role });
  return NextResponse.json({ ok: true, role });
}
