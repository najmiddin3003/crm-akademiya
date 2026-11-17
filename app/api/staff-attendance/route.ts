import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, payrollBuilding } from "@/lib/branchScope";
import { staffDay } from "@/lib/staffAttendanceToday";
import { uzDateIso } from "@/lib/uzTime";

// Nazorat → Xodimlar davomati (yangi versiya, 34-qism). GET ?building&date — bino bo'yicha kunlik
// holat: kutilgan xodimlar, kelgan / kechikkan / kelmagan, kirish-chiqish voqealari, bot sozlamalari.
// Mantiq — lib/staffAttendanceToday.ts. Sozlamalarni o'zgartirish — PATCH /api/attendance-qr (avvalgidek).

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const buildingId = payrollBuilding(scope, sp.get("building"));
  if (buildingId === null) return NextResponse.json({ ok: false, error: "Bu bino sizga biriktirilmagan" }, { status: 403 });
  const today = uzDateIso();
  const raw = sp.get("date") ?? "";
  const date = ISO.test(raw) && raw <= today ? raw : today;
  const db = await ensureIndexes();
  const out = await staffDay(db, { buildingId, date, allowed: scope.allowed, isAdmin: scope.isAdmin });
  if (!out.ok) return NextResponse.json(out, { status: out.status });
  return NextResponse.json(out, { headers: { "Cache-Control": "private, no-store" } });
}
