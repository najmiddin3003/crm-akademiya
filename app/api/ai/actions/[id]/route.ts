import { NextResponse, after } from "next/server";
import { checkAccess, executeAction } from "@/lib/ai/actions/execute";
import { cancelDraft, claimDraft, findAction, finishAction, viewOf, type ActionOutcome } from "@/lib/ai/actions/store";
import { loadAiContext } from "@/lib/ai/context";
import { aiDb } from "@/lib/ai/db";
import { loadAiSettings } from "@/lib/ai/settings";

// POST /api/ai/actions/:id  { op: "confirm" | "cancel" }  →  { ok, action, error? }
//
// AI tuzgan qoralamani xodim panelda TASDIQLAYDI yoki BEKOR QILADI. Bu —
// yozuvga olib boradigan YAGONA yo'l: model bu route'ni chaqira olmaydi,
// uni faqat xodimning tugmasi chaqiradi.
//
// TARTIB (tasdiq): sessiya → Sozlamalarda amallar yoqilganmi → qoralama
// shu xodimniki va hali `draft` mi → RUXSAT QAYTA (sahifa, filial, kassa
// egaligi — lib/ai/actions/execute.ts) → ATOMIK band qilish (ikkinchi
// bosish hech narsa yozmaydi) → yadro → natija bazaga.
//
// Javobda doim kartaning yangi holati (`action`) — panel uni almashtiradi.
// Ruxsat: sessiya yetadi (scripts/gen-api-permissions.mjs → SHARED_EXTRA),
// amalning o'z ruxsati shu yerda.

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = String(rawId ?? "").slice(0, 64);

  let body: { op?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const op = body.op;
  if (op !== "confirm" && op !== "cancel") {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const db = await aiDb();
  const settings = await loadAiSettings(db);
  const ctx = await loadAiContext(db, { actions: settings.enabled && settings.actionsEnabled });
  if (!ctx) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const doc = await findAction(db, ctx.userId, id);
  if (!doc) return NextResponse.json({ ok: false, error: "Qoralama topilmadi" }, { status: 404 });

  if (op === "cancel") {
    const cancelled = await cancelDraft(db, ctx.userId, doc.id);
    if (!cancelled) {
      return NextResponse.json(
        { ok: false, error: "Bu qoralama allaqachon ko'rib chiqilgan", action: viewOf(doc) },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, action: viewOf(cancelled) });
  }

  if (!ctx.actions) {
    return NextResponse.json({ ok: false, error: "AI amallari o'chirilgan", action: viewOf(doc) }, { status: 403 });
  }
  const view = viewOf(doc);
  if (view.status === "expired") {
    return NextResponse.json(
      { ok: false, error: "Qoralama muddati o'tgan — yordamchidan qaytadan so'rang", action: view },
      { status: 409 },
    );
  }
  if (doc.status !== "draft") {
    return NextResponse.json({ ok: false, error: "Bu qoralama allaqachon ko'rib chiqilgan", action: view }, { status: 409 });
  }
  const denied = await checkAccess(ctx, doc);
  if (denied) return NextResponse.json({ ok: false, error: denied.error, action: view }, { status: 403 });

  // Ikkinchi bosish (yoki ikkinchi oyna) shu yerda to'xtaydi.
  const claimed = await claimDraft(db, ctx.userId, doc.id);
  if (!claimed) {
    const now = await findAction(db, ctx.userId, doc.id);
    return NextResponse.json(
      { ok: false, error: "Bu qoralama allaqachon ko'rib chiqilgan", action: viewOf(now ?? doc) },
      { status: 409 },
    );
  }

  let outcome: ActionOutcome;
  try {
    // `after` — Sheets/Telegram navbati, SMS javob ketgandan keyin (kassa oynasi bilan bir xil).
    outcome = await executeAction(db, claimed, { defer: after });
  } catch (e) {
    console.error("[ai] amalni yozishda xato", claimed.id, e);
    outcome = { ok: false, error: "Kutilmagan xato: yozuv saqlanmagan bo'lishi mumkin — jurnalni tekshiring" };
  }
  const finished = await finishAction(db, claimed.id, outcome);
  const action = viewOf(finished ?? claimed);
  return NextResponse.json(outcome.ok ? { ok: true, action } : { ok: false, error: outcome.error, action });
}
