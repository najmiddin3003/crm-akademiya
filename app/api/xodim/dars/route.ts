import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { clientIp, clientUa, logAction } from "@/lib/actionLog";
import { staffFromInitData } from "@/lib/staffBot/webapp";
import { loadLessonSheet, loadTodayLessons, saveLessonMarks, type LessonMarkInput, type LessonMarkStatus } from "@/lib/teacherLessons";

// O'QITUVCHI DAVOMATI — «👤 Profilim» Mini App'i (05.11.2026, lib/teacherLessons.ts).
//
// GET              — bugungi darslar: { ok, date, hasGroups, lessons }.
// GET  ?guruh=ID   — guruhning bugungi ro'yxati: { ok, sheet }.
// POST             — { groupId, marks: [{ pupilId, status, note }] }:
//                    { ok, saved, failed, sheet }.
//
// Xodim — Telegram `initData` dan (lib/staffBot/webapp.ts), klient id yubormaydi;
// sana serverda (faqat bugun). Sessiyasiz (PUBLIC_API) — himoya imzoning o'zida,
// guruh shu xodimniki ekani yadroda tekshiriladi.

const NO_STORE = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

const BODY_MAX = 100_000;
const MARKS_MAX = 300;
const NOTE_MAX = 500;
const MARK_STATUSES = new Set<string>(["keldi", "sababsiz", "sababli"] satisfies LessonMarkStatus[]);

const validId = (n: number) => Number.isInteger(n) && n > 0;

/** Yaroqsiz bo'lsa `null`. Bir o'quvchi ikki marta kelsa oxirgisi olinadi. */
function readMarks(raw: unknown): LessonMarkInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MARKS_MAX) return null;
  const byPupil = new Map<number, LessonMarkInput>();
  for (const item of raw) {
    const m = (item ?? {}) as { pupilId?: unknown; status?: unknown; note?: unknown };
    const pupilId = Number(m.pupilId);
    if (!validId(pupilId) || !MARK_STATUSES.has(String(m.status))) return null;
    byPupil.set(pupilId, {
      pupilId,
      status: String(m.status) as LessonMarkStatus,
      note: typeof m.note === "string" ? m.note.slice(0, NOTE_MAX) : "",
    });
  }
  return [...byPupil.values()];
}

export async function GET(req: Request) {
  try {
    const db = await ensureIndexes();
    const auth = await staffFromInitData(db, req.headers.get("x-telegram-init-data") || "");
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

    const raw = new URL(req.url).searchParams.get("guruh");
    if (raw === null) return json({ ok: true, ...(await loadTodayLessons(db, auth.employee)) });

    const groupId = Number(raw);
    if (!validId(groupId)) return json({ ok: false, error: "Noto'g'ri id" }, 400);
    const res = await loadLessonSheet(db, auth.employee, groupId);
    if (!res.ok) return json({ ok: false, error: res.error }, res.status);
    return json({ ok: true, sheet: res.sheet });
  } catch (e) {
    console.error("[xodim/dars GET]", e);
    return json({ ok: false, error: "Server xatosi — birozdan keyin qayta urinib ko'ring" }, 500);
  }
}

export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > BODY_MAX) {
    return json({ ok: false, error: "So'rov juda katta" }, 413);
  }
  let body: { groupId?: unknown; marks?: unknown };
  try {
    const text = await req.text();
    if (text.length > BODY_MAX) return json({ ok: false, error: "So'rov juda katta" }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: "Noto'g'ri so'rov" }, 400);
  }
  const groupId = Number(body?.groupId);
  const marks = readMarks(body?.marks);
  if (!validId(groupId) || !marks) return json({ ok: false, error: "Noto'g'ri so'rov" }, 400);

  try {
    const db = await ensureIndexes();
    const auth = await staffFromInitData(db, req.headers.get("x-telegram-init-data") || "");
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const emp = auth.employee;

    const res = await saveLessonMarks(db, emp, groupId, marks, { defer: (fn) => after(fn) });
    if (!res.ok) return json({ ok: false, error: res.error }, res.status);

    // /api/xodim/ proxy jurnalidan tashqarida (LOG_SKIP_PREFIX) — bu yerda yoziladi.
    after(() =>
      logAction(db, {
        actor: { kind: "miniapp", employeeId: emp.id, name: emp.name || null },
        source: "miniapp",
        section: "groups",
        action: "attendance",
        target: String(groupId),
        status: 200,
        ip: clientIp(req.headers),
        ua: clientUa(req.headers),
        branchId: res.branchId,
        details: { date: res.date, saved: res.saved, failed: res.failed.length },
      }),
    );
    return json({ ok: true, saved: res.saved, failed: res.failed, sheet: res.sheet });
  } catch (e) {
    console.error("[xodim/dars POST]", e);
    return json({ ok: false, error: "Server xatosi — birozdan keyin qayta urinib ko'ring" }, 500);
  }
}
