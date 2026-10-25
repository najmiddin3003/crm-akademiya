import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { currentAuthorName } from "@/lib/currentEmployee";
import { ensureIndexes } from "@/lib/mongodb";
import { isPathAllowed } from "@/lib/permissions";
import { loadUbConfig, saveUbConfig } from "@/lib/uzbmbServer";

// UzBMB sozlamasi — ball tuzilishi va imtihon fanlari (Sozlamalar → O'quv → Imtihon fanlari, 12-qism).
// O'qish: Imtihon yoki Sozlamalar → O'quv sahifasi ruxsati (lib/apiPermissions.generated.ts, qo'lda);
// YOZISH faqat Sozlamalar → O'quv ruxsati bilan — shu yerda tekshiriladi.

const SETTINGS_PAGE = "/settings-academic";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const db = await ensureIndexes();
  return NextResponse.json({ ok: true, config: await loadUbConfig(db), canEdit: isPathAllowed(SETTINGS_PAGE, me.permissions) });
}

export async function PUT(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  if (!isPathAllowed(SETTINGS_PAGE, me.permissions)) {
    return NextResponse.json({ ok: false, error: "Imtihon fanlarini o'zgartirishga ruxsatingiz yo'q" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const r = await saveUbConfig(db, body, await currentAuthorName());
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, config: r.config });
}
