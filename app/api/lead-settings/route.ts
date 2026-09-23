import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadLeadSettings, normalizeLeadSettings, saveLeadSettings } from "@/lib/leadSettings";
import { ensureIndexes } from "@/lib/mongodb";
import { hasSectionPermission } from "@/lib/permissions";

// Sozlamalar → Sotuv va marketing → Lidlar (lib/leadSettings.ts).
//
// GET — Lidlar sahifasi (rad sabablari, yo'nalish nomlari, daraja
// shkalasi) va sozlamalar tabi o'qiydi; proxy ikkala sahifa ruxsatidan
// birini talab qiladi (lib/apiPermissions.generated.ts).
// PUT — faqat Sotuv va marketing sozlamalari ruxsati bor xodim yoki
// direktor: Lidlar sahifasini ko'ra olgan moderator ro'yxatlarni
// (so'rovnomada ko'rinadigan kurslarni) o'zgartira olmasin.

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const db = await ensureIndexes();
  return NextResponse.json({ ok: true, settings: await loadLeadSettings(db) });
}

export async function PUT(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  if (me.role !== "admin" && !hasSectionPermission("/settings-sales", me.permissions)) {
    return NextResponse.json({ ok: false, error: "Bu sozlamani o'zgartirishga ruxsatingiz yo'q" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const settings = normalizeLeadSettings((body as { settings?: unknown } | null)?.settings);
  const db = await ensureIndexes();
  await saveLeadSettings(db, settings);
  return NextResponse.json({ ok: true, settings });
}
