import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminOnly";
import { aiDb } from "@/lib/ai/db";
import { loadAiAlerts, markAiAlertsSeen } from "@/lib/ai/alerts";

// ADMINGA OGOHLANTIRISHLAR — AI panelidagi Mohira xabarlari (lib/ai/alerts.ts).
//
//   GET  — joriy xabarlar (+ shu admin ko'rganmi), `unseen` — robot belgisi;
//   POST { seen: string[] } — «ko'rildi».
//
// FAQAT ADMIN (`users.role`): xabarlar butun markaz bo'yicha (hamma filial
// lidlari, guruhlari, xonalari, topshiriqlari). Model chaqirilmaydi.
// POST amallar jurnaliga yozilmaydi (proxy.ts → LOG_SKIP_EXACT) — «ko'rildi»
// shovqin bo'lardi.

const forbidden = () => NextResponse.json({ ok: false, error: "Faqat administrator uchun" }, { status: 403 });

export async function GET() {
  const me = await requireAdmin();
  if (!me) return forbidden();
  const db = await aiDb();
  const { alerts, unseen } = await loadAiAlerts(db, me.id);
  return NextResponse.json({ ok: true, alerts, unseen, serverNow: new Date().toISOString() });
}

export async function POST(req: Request) {
  const me = await requireAdmin();
  if (!me) return forbidden();
  let body: { seen?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  if (!Array.isArray(body.seen)) return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  const db = await aiDb();
  const marked = await markAiAlertsSeen(db, me.id, body.seen);
  return NextResponse.json({ ok: true, marked });
}
