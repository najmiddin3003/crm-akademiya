import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { hireCv } from "@/lib/cvHire";
import { ensureIndexes } from "@/lib/mongodb";
import { isPathAllowed } from "@/lib/permissions";

// POST /api/management-cv/:id/hire — «Ishga olish» oynasi (yangi ko'rinish, 25.10.2026, 13-qism).
// Mantiq — lib/cvHire.ts (xodim «Xodim qo'shish» yo'lidan yaratiladi). Xodim yaratish — Xodimlar
// bo'limi ruxsati bilan (CV sahifasi ruxsati yetmaydi: kirish taklifi ketadi). Eski ko'rinishdagi
// tez «Ishga olish» — PATCH status.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cvId = Number(id);
  if (!Number.isInteger(cvId) || cvId <= 0) return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });

  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  if (!isPathAllowed("/management-xodimlar", me.permissions)) {
    return NextResponse.json({ ok: false, error: "Xodim qo'shishga ruxsatingiz yo'q" }, { status: 403 });
  }
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Sessiya topilmadi" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });

  const r = await hireCv(await ensureIndexes(), scope, cvId, body, await currentAuthorName());
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
