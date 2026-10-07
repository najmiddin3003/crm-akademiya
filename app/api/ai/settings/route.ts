import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminOnly";
import { aiProviderConfig } from "@/lib/ai/config";
import { aiDb } from "@/lib/ai/db";
import { loadAiSettings, saveAiSettings } from "@/lib/ai/settings";

// GET /api/ai/settings  — Sozlamalar → Ilova sozlamalari → AI yordamchi
// PUT /api/ai/settings  { enabled?, actionsEnabled?, dailyLimit? }
//
// FAQAT ADMIN (lib/adminOnly.ts). Umumiy /api/settings ishlatilmaydi —
// sababi lib/ai/settings.ts boshida: u yerga ko'p sahifa ruxsati yozadi.

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "Faqat administrator uchun" }, { status: 403 });
  }
  const db = await aiDb();
  const settings = await loadAiSettings(db);
  const cfg = aiProviderConfig();
  return NextResponse.json({
    ok: true,
    settings,
    // Kalitning o'zi HECH QACHON qaytarilmaydi — faqat bor-yo'qligi va model nomi.
    configured: cfg !== null,
    model: cfg?.model ?? null,
  });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Faqat administrator uchun" }, { status: 403 });

  let body: { enabled?: unknown; actionsEnabled?: unknown; dailyLimit?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const db = await aiDb();
  const res = await saveAiSettings(
    db,
    { enabled: body.enabled, actionsEnabled: body.actionsEnabled, dailyLimit: body.dailyLimit },
    admin.fullName || admin.phone,
  );
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, settings: res.settings });
}
