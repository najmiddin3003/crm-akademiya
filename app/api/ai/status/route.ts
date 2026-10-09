import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ACTION_PAGES } from "@/lib/ai/actions/pages";
import { aiProviderConfig } from "@/lib/ai/config";
import { aiDb } from "@/lib/ai/db";
import { modelChoices } from "@/lib/ai/modelChoice";
import { accountModels } from "@/lib/ai/openai";
import type { AiStatus } from "@/lib/ai/protocol";
import { loadAiSettings } from "@/lib/ai/settings";
import { readQuota } from "@/lib/ai/usage";
import { isPathAllowed } from "@/lib/permissions";

// GET /api/ai/status — robot paneli ochilganda: yordamchi yoqilganmi,
// serverda kalit bormi, bugun yana nechta savol berish mumkin, qaysi
// modellar va «Tezlik» darajalari tanlanadi (4-bosqich).
//
// Sessiya yetarli (scripts/gen-api-permissions.mjs → SHARED_EXTRA): robot
// HAR sahifada turadi, ya'ni uni biror bo'lim ruxsatiga bog'lab bo'lmaydi.
// Ma'lumotga ruxsat vositalar ichida kesiladi (lib/ai/tools).
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await aiDb();
  const settings = await loadAiSettings(db);
  const cfg = aiProviderConfig();
  const [quota, available] = await Promise.all([
    readQuota(db, me.id, settings.dailyLimit),
    // Hisobdagi modellar — faqat yordamchi ishlay oladigan bo'lsa (10 daqiqa eslab qolinadi).
    cfg && settings.enabled ? accountModels(cfg) : Promise.resolve(null),
  ]);
  const choices = cfg ? modelChoices(cfg, settings, available) : { models: [], defaultModel: "", defaultEffort: null };
  const status: AiStatus = {
    enabled: settings.enabled,
    configured: cfg !== null,
    isAdmin: me.role === "admin",
    limit: quota.limit,
    remaining: quota.remaining,
    // Amallar: Sozlamalarda yoqilgan VA xodimda kamida bitta amal sahifasi ochiq.
    actions:
      settings.actionsEnabled && Object.values(ACTION_PAGES).some((page) => isPathAllowed(page, me.permissions)),
    models: choices.models,
    defaultModel: choices.defaultModel,
    defaultEffort: choices.defaultEffort,
  };
  return NextResponse.json({ ok: true, ...status });
}
