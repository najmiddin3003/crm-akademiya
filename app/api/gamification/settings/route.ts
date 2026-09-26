import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { loadSettings, saveSettings, setEnabled } from "@/lib/gamification/settings";
import { cleanWishes } from "@/lib/gamification/shop";

// GET /api/gamification/settings — sozlamalar (gamifikatsiyada roli bor har xodim).
// PUT /api/gamification/settings — faqat direktor: raqamli maydonlar yamog'i
//   va/yoki `enabled` (modulni yoqish/o'chirish). TZ 5.7, 6.1.

export async function GET() {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const settings = await loadSettings(ctx.db);
    return NextResponse.json({ ok: true, settings, role: ctx.actor.role });
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: Request) {
  try {
    const ctx = await withActor({ director: true });
    if (ctx instanceof NextResponse) return ctx;
    const body = await readJson(req);
    if (!body) return fail(400, "Noto'g'ri so'rov");

    const { enabled, ...patch } = body;
    let settings = await loadSettings(ctx.db);
    const kidsBefore = settings.kidsMaxGrade;
    let streakRuleChanged = false;
    if (Object.keys(patch).length > 0) {
      const res = await saveSettings(ctx.db, ctx.actor, patch);
      if (!res.ok) return fail(res.status, res.error);
      settings = res.settings;
      streakRuleChanged = res.streakRuleChanged;
    }
    if (typeof enabled === "boolean") settings = await setEnabled(ctx.db, ctx.actor, enabled);
    // Kichiklar chegarasi o'zgarsa — mos kelmay qolgan istaklar olib tashlanadi (TZ 4.21.4).
    const removedWishes = settings.kidsMaxGrade !== kidsBefore ? await cleanWishes(ctx.db) : 0;
    return NextResponse.json({ ok: true, settings, streakRuleChanged, removedWishes });
  } catch (e) {
    return handleError(e);
  }
}
