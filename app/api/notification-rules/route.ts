import { NextResponse } from "next/server";
import type { Db } from "mongodb";
import { requireAdmin } from "@/lib/adminOnly";
import { MISSED_ALERT_AFTER_MIN, TEACHER_ABSENT_AFTER_MIN } from "@/lib/attendanceAlert";
import { ensureIndexes } from "@/lib/mongodb";
import { loadNotifyRules, notifyColumnsInfo, parseNotifyRules, saveNotifyRules, type StoredNotifyRules } from "@/lib/notificationRules";

// GET /api/notification-rules — Sozlamalar → Umumiy → Bildirishnomalar (23-qism)
// PUT /api/notification-rules  { rules: { [hodisa]: { roles: ustun[], important } } }
//
// FAQAT ADMIN: `requireAdmin()` shu handlerda (/api/attendance-alert bilan bir xil — sahifa
// ruxsatlar daraxtida yo'q, cheklovsiz rol ham uni ko'rmasin). Qoida va halol holat —
// lib/notificationRules.ts.

const NO_STORE = { "Cache-Control": "private, no-store" };

async function view(db: Db, stored: StoredNotifyRules) {
  const { columns, others } = await notifyColumnsInfo(db);
  return {
    ok: true,
    rules: stored.rules,
    saved: stored.saved,
    updatedAt: stored.updatedAt,
    columns,
    others,
    // Izohlardagi vaqtlar — amaldagi qoidalardan (lib/attendanceAlert.ts).
    timing: { missedAfterMin: MISSED_ALERT_AFTER_MIN, absentAfterMin: TEACHER_ABSENT_AFTER_MIN },
  };
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "Faqat administrator uchun" }, { status: 403 });
  }
  const db = await ensureIndexes();
  return NextResponse.json(await view(db, await loadNotifyRules(db)), { headers: NO_STORE });
}

export async function PUT(req: Request) {
  const me = await requireAdmin();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Faqat administrator uchun" }, { status: 403 });
  }
  let body: { rules?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const parsed = parseNotifyRules(body?.rules);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  const db = await ensureIndexes();
  const stored = await saveNotifyRules(db, parsed.rules, me.id);
  return NextResponse.json(await view(db, stored), { headers: NO_STORE });
}
