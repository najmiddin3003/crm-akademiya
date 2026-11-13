import type { Db } from "mongodb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { SURVEY_SOURCE, loadLeadSettings, normalizeLeadSettings, saveLeadSettings } from "@/lib/leadSettings";
import { withLeadScope } from "@/lib/leadScope";
import { ensureIndexes } from "@/lib/mongodb";
import { hasSectionPermission } from "@/lib/permissions";
import { createdDay } from "@/lib/sourceStats";
import { loadSurveyConfig } from "@/lib/surveyServer";
import { loadSurveyOpen, saveSurveyOpen } from "@/lib/surveyOpen";
import { uzNow } from "@/lib/uzTime";

// Sozlamalar → Sotuv va marketing → Lidlar (lib/leadSettings.ts).
//
// GET — Lidlar sahifasi (rad sabablari, yo'nalish nomlari, daraja
// shkalasi) va sozlamalar tabi o'qiydi; proxy ikkala sahifa ruxsatidan
// birini talab qiladi (lib/apiPermissions.generated.ts).
// PUT — faqat Sotuv va marketing sozlamalari ruxsati bor xodim yoki
// direktor: Lidlar sahifasini ko'ra olgan moderator ro'yxatlarni
// (so'rovnomada ko'rinadigan kurslarni) o'zgartira olmasin.

//
// `?stats=survey` (yangi versiya «So'rovnoma sahifasi», 24-qism, 13.11.2026) — ustiga
// `survey`: sahifa ochiqmi (lib/surveyOpen.ts), bugungi so'rovnoma lidlari va oxirgisi
// (LIDLAR QAMROVIDA — Lidlar ro'yxati bilan bir xil, lib/leadScope.ts) hamda ochiq
// sahifa ko'rsatadigan ro'yxatlar (filiallar, manbalar — loadSurveyConfig).
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const db = await ensureIndexes();
  const settings = await loadLeadSettings(db);
  if (new URL(req.url).searchParams.get("stats") !== "survey") return NextResponse.json({ ok: true, settings });
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  return NextResponse.json({ ok: true, settings, survey: await surveyStats(db, withLeadScope({ source: SURVEY_SOURCE }, scope, await currentAuthorName())) });
}

async function surveyStats(db: Db, scoped: Record<string, unknown>) {
  const col = db.collection("orders");
  const today = createdDay(uzNow());
  const [open, config, todayCount, last] = await Promise.all([
    loadSurveyOpen(db),
    loadSurveyConfig(db),
    col.countDocuments({ $and: [scoped, { created: { $regex: `^${today.replace(/\./g, "\\.")}` } }] }),
    col.find(scoped, { projection: { _id: 0, created: 1 } }).sort({ id: -1 }).limit(1).toArray(),
  ]);
  return {
    open,
    today: todayCount,
    todayDay: today,
    /** Oxirgi so'rovnoma lidi: "13.11.2026 | 17:10" yoki null. */
    lastCreated: typeof last[0]?.created === "string" ? last[0].created : null,
    filiallar: config.filiallar.map((b) => ({ id: b.id, nom: b.nom, telefon: b.telefon })),
    manbalar: config.manbalar,
  };
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
  const db = await ensureIndexes();
  // «Sahifa ochiq» (yangi versiya, lib/surveyOpen.ts) — alohida kalit; lid ro'yxatlariga tegilmaydi.
  const surveyOpen = (body as { surveyOpen?: unknown } | null)?.surveyOpen;
  if (typeof surveyOpen === "boolean" && !(body as { settings?: unknown }).settings) {
    await saveSurveyOpen(db, surveyOpen, me.fullName || me.phone || "");
    return NextResponse.json({ ok: true, surveyOpen });
  }
  const settings = normalizeLeadSettings((body as { settings?: unknown } | null)?.settings);
  await saveLeadSettings(db, settings);
  return NextResponse.json({ ok: true, settings });
}
