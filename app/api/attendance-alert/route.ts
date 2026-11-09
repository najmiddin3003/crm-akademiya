import { NextResponse } from "next/server";
import type { Db } from "mongodb";
import { requireAdmin } from "@/lib/adminOnly";
import {
  alertCandidates,
  FACE_FAIL_GRACE_MIN,
  loadAttendanceAlert,
  MISSED_ALERT_AFTER_MIN,
  saveAttendanceAlert,
  selectedChats,
  TEACHER_ABSENT_AFTER_MIN,
  type AttendanceAlertSettings,
} from "@/lib/attendanceAlert";
import { attendanceGroup, attendanceThreadId, branchAttendanceThreads } from "@/lib/attendanceNotify";
import { branchNames } from "@/lib/gamification/scope";
import { ensureIndexes } from "@/lib/mongodb";
import { isStaffBotReady, loadStaffBotConfig } from "@/lib/staffBot/config";
import { telegramMuted } from "@/lib/telegramApi";

// GET /api/attendance-alert — Sozlamalar → Nazorat → Nazorat qoidalari
// PUT /api/attendance-alert  { enabled?, faceFail?, teacherAbsent?, recipients? }
//
// FAQAT ADMIN: `requireAdmin()` shu handlerda (sahifa ruxsati yetmaydi — nazorat
// qilinayotgan ustoz xabarni o'chira olmasin). Sababi lib/attendanceAlert.ts boshida.

const NO_STORE = { "Cache-Control": "private, no-store" };

async function view(db: Db, settings: AttendanceAlertSettings) {
  const group = attendanceGroup();
  const [candidates, branches, threads] = await Promise.all([
    alertCandidates(db),
    branchNames(db),
    group ? branchAttendanceThreads(db) : Promise.resolve(new Map<number, string>()),
  ]);
  return {
    ok: true,
    enabled: settings.enabled,
    faceFail: settings.faceFail,
    teacherAbsent: settings.teacherAbsent,
    selected: selectedChats(settings, candidates),
    candidates: candidates.map(({ branchIds, ...c }) => ({
      ...c,
      // `null` — hamma filial.
      branches: branchIds === null ? null : [...new Set(branchIds.map((id) => branches.get(id) ?? String(id)))],
    })),
    // «Davomat qilinmagan guruhlar» filial topigiga ketadi; topigi yo'q filialniki — ro'yxatdagilarga botda.
    noTopic: [...new Set([...branches].filter(([id]) => !(threads.get(id) ?? (group ? attendanceThreadId(null) : ""))).map(([, name]) => name))],
    botReady: isStaffBotReady(loadStaffBotConfig()),
    muted: telegramMuted(),
    afterMin: MISSED_ALERT_AFTER_MIN,
    faceGraceMin: FACE_FAIL_GRACE_MIN,
    absentAfterMin: TEACHER_ABSENT_AFTER_MIN,
  };
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "Faqat administrator uchun" }, { status: 403 });
  }
  const db = await ensureIndexes();
  return NextResponse.json(await view(db, await loadAttendanceAlert(db)), { headers: NO_STORE });
}

export async function PUT(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "Faqat administrator uchun" }, { status: 403 });
  }
  let body: { enabled?: unknown; faceFail?: unknown; teacherAbsent?: unknown; recipients?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await saveAttendanceAlert(db, {
    enabled: body?.enabled,
    faceFail: body?.faceFail,
    teacherAbsent: body?.teacherAbsent,
    recipients: body?.recipients,
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  return NextResponse.json(await view(db, res.settings), { headers: NO_STORE });
}
