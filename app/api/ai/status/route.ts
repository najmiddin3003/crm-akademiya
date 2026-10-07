import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ACTION_PAGES } from "@/lib/ai/actions/pages";
import { aiProviderConfig } from "@/lib/ai/config";
import { aiDb } from "@/lib/ai/db";
import type { AiStatus } from "@/lib/ai/protocol";
import { loadAiSettings } from "@/lib/ai/settings";
import { readQuota } from "@/lib/ai/usage";
import { isPathAllowed } from "@/lib/permissions";

// GET /api/ai/status — robot paneli ochilganda: yordamchi yoqilganmi,
// serverda kalit bormi, bugun yana nechta savol berish mumkin.
//
// Sessiya yetarli (scripts/gen-api-permissions.mjs → SHARED_EXTRA): robot
// HAR sahifada turadi, ya'ni uni biror bo'lim ruxsatiga bog'lab bo'lmaydi.
// Ma'lumotga ruxsat vositalar ichida kesiladi (lib/ai/tools).
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await aiDb();
  const settings = await loadAiSettings(db);
  const quota = await readQuota(db, me.id, settings.dailyLimit);
  const status: AiStatus = {
    enabled: settings.enabled,
    configured: aiProviderConfig() !== null,
    isAdmin: me.role === "admin",
    limit: quota.limit,
    remaining: quota.remaining,
    // Amallar: Sozlamalarda yoqilgan VA xodimda kamida bitta amal sahifasi ochiq.
    actions:
      settings.actionsEnabled && Object.values(ACTION_PAGES).some((page) => isPathAllowed(page, me.permissions)),
  };
  return NextResponse.json({ ok: true, ...status });
}
