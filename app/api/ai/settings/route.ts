import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminOnly";
import { aiProviderConfig } from "@/lib/ai/config";
import { aiDb } from "@/lib/ai/db";
import { adminModelIds, modelChoices } from "@/lib/ai/modelChoice";
import { AI_MODEL_CATALOG, modelInfo } from "@/lib/ai/models";
import { accountModels } from "@/lib/ai/openai";
import type { AiModelRow } from "@/lib/ai/protocol";
import { loadAiSettings, saveAiSettings } from "@/lib/ai/settings";

// GET /api/ai/settings  — Sozlamalar → Ilova sozlamalari → AI yordamchi
// PUT /api/ai/settings  { enabled?, actionsEnabled?, dailyLimit?, models?, defaultModel?, defaultEffort? }
//
// FAQAT ADMIN (lib/adminOnly.ts). Umumiy /api/settings ishlatilmaydi —
// sababi lib/ai/settings.ts boshida: u yerga ko'p sahifa ruxsati yozadi.
//
// MODELLAR (4-bosqich): GET katalogni, qo'lda qo'shilganlarni va .env
// modelini OpenAI hisobida bor-yo'qligi bilan qaytaradi; PUT — xodimlarga
// ochiq ro'yxat, sukut model va sukut «Tezlik».

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "Faqat administrator uchun" }, { status: 403 });
  }
  const db = await aiDb();
  const settings = await loadAiSettings(db);
  const cfg = aiProviderConfig();
  const available = cfg ? await accountModels(cfg) : null;
  const enabled = cfg ? adminModelIds(settings, cfg.model) : [];
  const ids = [...new Set([...enabled, ...AI_MODEL_CATALOG.filter((m) => !m.alias).map((m) => m.id)])];
  const rows: AiModelRow[] = ids.map((id) => {
    const m = modelInfo(id);
    return {
      id,
      name: m.name,
      hint: m.hint,
      available: available ? available.has(id) || id === cfg?.model : null,
      responsesOnly: m.responsesOnly === true,
      custom: !AI_MODEL_CATALOG.some((c) => c.id === id),
    };
  });
  const choices = cfg ? modelChoices(cfg, settings) : null;
  return NextResponse.json({
    ok: true,
    settings,
    // Kalitning o'zi HECH QACHON qaytarilmaydi — faqat bor-yo'qligi va model nomi.
    configured: cfg !== null,
    model: cfg?.model ?? null,
    api: cfg?.api ?? null,
    modelRows: rows,
    /** Xodimlarga ochiq ro'yxat (admin tanlamagan bo'lsa — sukut ro'yxati). */
    enabledModels: enabled,
    defaultModel: choices?.defaultModel ?? null,
  });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Faqat administrator uchun" }, { status: 403 });

  let body: {
    enabled?: unknown;
    actionsEnabled?: unknown;
    dailyLimit?: unknown;
    models?: unknown;
    defaultModel?: unknown;
    defaultEffort?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const db = await aiDb();
  const res = await saveAiSettings(
    db,
    {
      enabled: body.enabled,
      actionsEnabled: body.actionsEnabled,
      dailyLimit: body.dailyLimit,
      models: body.models,
      defaultModel: body.defaultModel,
      defaultEffort: body.defaultEffort,
    },
    admin.fullName || admin.phone,
  );
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  const cfg = aiProviderConfig();
  return NextResponse.json({
    ok: true,
    settings: res.settings,
    enabledModels: cfg ? adminModelIds(res.settings, cfg.model) : [],
    defaultModel: cfg ? modelChoices(cfg, res.settings).defaultModel : null,
  });
}
