import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { loadAttendanceSettings } from "@/lib/attendanceQr";
import { faceAdminView, resetFace, setFaceExempt } from "@/lib/staffFace";

// Xodim profili → «Face ID» kartasi (components/v2/employees/EmployeeFaceCard.tsx).
//
// GET    — holat: ro'yxatdan o'tganmi, ro'yxatga olish rasmi, so'nggi urinishlar
//          (rasm, natija, masofa) va umumiy sozlama yoqilganmi.
// PATCH  — { exempt: boolean }: xodim Face ID'siz belgilansin (telefoni kamerani
//          ochmaydi va h.k.).
// DELETE — yuzni o'chirish: xodim keyingi «Ishga keldim» da qayta ro'yxatdan o'tadi.
//
// FAQAT ADMIN: biometrik rasm va izlar — xodimlar sahifasiga ruxsat yetmaydi.
// O'zgarishlar Amallar jurnaliga proxy orqali yoziladi (lib/actionLogLabels.ts).

const NO_STORE = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

type Ctx = { params: Promise<{ id: string }> };

async function guard(ctx: Ctx) {
  const me = await getCurrentUser();
  if (!me) return { error: json({ ok: false, error: "Tizimga kirmagansiz" }, 401) } as const;
  if (me.role !== "admin") return { error: json({ ok: false, error: "Face ID ni faqat administrator boshqaradi" }, 403) } as const;
  const { id } = await ctx.params;
  const employeeId = Number(id);
  if (!Number.isSafeInteger(employeeId) || employeeId <= 0) return { error: json({ ok: false, error: "Noto'g'ri id" }, 400) } as const;
  const db = await ensureIndexes();
  const emp = await db.collection("hr_employees").findOne({ id: employeeId }, { projection: { _id: 0, id: 1 } });
  if (!emp) return { error: json({ ok: false, error: "Xodim topilmadi" }, 404) } as const;
  return { db, employeeId } as const;
}

export async function GET(_req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if ("error" in g) return g.error;
  const [view, settings] = await Promise.all([faceAdminView(g.db, g.employeeId), loadAttendanceSettings(g.db)]);
  return json({ ok: true, faceRequired: settings.faceRequired, threshold: settings.faceThreshold, ...view });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if ("error" in g) return g.error;
  let body: { exempt?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Noto'g'ri so'rov" }, 400);
  }
  if (typeof body.exempt !== "boolean") return json({ ok: false, error: "Noto'g'ri so'rov" }, 400);
  await setFaceExempt(g.db, g.employeeId, body.exempt);
  return json({ ok: true, exempt: body.exempt });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if ("error" in g) return g.error;
  await resetFace(g.db, g.employeeId);
  return json({ ok: true });
}
