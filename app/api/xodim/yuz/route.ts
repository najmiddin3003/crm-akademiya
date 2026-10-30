import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { staffFromInitData } from "@/lib/staffBot/webapp";
import { loadAttendanceSettings } from "@/lib/attendanceQr";
import { checkFace, faceState, parseDescriptors, parsePhoto } from "@/lib/staffFace";
import { clientIp, clientUa, logAction } from "@/lib/actionLog";

// FACE ID — «Ishga keldim» Mini App'i (/xodim/keldim, lib/staffFace.ts).
//
// GET  — ochilganda: yuz tekshiruvi kerakmi va xodim ro'yxatdan o'tganmi.
//        { ok, required, enrolled, exempt }
// POST — { descriptors: number[][], photo: "data:image/jpeg;base64,…" }:
//        ro'yxatda yo'q bo'lsa — ro'yxatga oladi, bor bo'lsa — solishtiradi.
//        Muvaffaqiyatli bo'lsa { ok, enrolled, pass } — `pass` ni
//        /api/xodim/davomat QR kod bilan birga oladi (5 daqiqa amal qiladi).
//
// Xodim — Telegram `initData` dan (lib/staffBot/webapp.ts), klient id
// yubormaydi. Sessiyasiz (PUBLIC_API) — himoya imzoning o'zida.

const NO_STORE = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

/** 8 ta iz (~25 KB) + rasm (≤ 60 KB, base64 da ~80 KB) — undan kattasi o'qilmaydi. */
const BODY_MAX = 200_000;

export async function GET(req: Request) {
  try {
    const db = await ensureIndexes();
    const auth = await staffFromInitData(db, req.headers.get("x-telegram-init-data") || "");
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const [settings, state] = await Promise.all([loadAttendanceSettings(db), faceState(db, auth.employee.id)]);
    return json({ ok: true, required: settings.faceRequired && !state.exempt, enrolled: state.enrolled, exempt: state.exempt });
  } catch (e) {
    console.error("[xodim/yuz GET]", e);
    return json({ ok: false, error: "Server xatosi — birozdan keyin qayta urinib ko'ring" }, 500);
  }
}

export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > BODY_MAX) {
    return json({ ok: false, error: "So'rov juda katta" }, 413);
  }
  let body: { descriptors?: unknown; photo?: unknown };
  try {
    const text = await req.text();
    if (text.length > BODY_MAX) return json({ ok: false, error: "So'rov juda katta" }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: "Noto'g'ri so'rov" }, 400);
  }

  try {
    const db = await ensureIndexes();
    const auth = await staffFromInitData(db, req.headers.get("x-telegram-init-data") || "");
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const emp = auth.employee;

    const [settings, state] = await Promise.all([loadAttendanceSettings(db), faceState(db, emp.id)]);
    // O'chiq yoki xodim ozod — tekshiruv kerak emas (Mini App GET dan keyin o'zgargan bo'lishi mumkin).
    if (!settings.faceRequired || state.exempt) return json({ ok: true, skipped: true });

    const descriptors = parseDescriptors(body?.descriptors);
    const photo = parsePhoto(body?.photo);
    if (!descriptors || !photo) {
      return json({ ok: false, error: "Yuz ma'lumoti noto'g'ri keldi — qayta urinib ko'ring" }, 400);
    }

    const res = await checkFace(db, emp.id, descriptors, photo, settings.faceThreshold);
    if (!res.ok) return json({ ok: false, error: res.error, code: res.code }, res.status);

    // AMALLAR JURNALI: ro'yxatga olish — kim, qachon (tekshiruvlar davomat bilan birga yoziladi).
    if (res.enrolled) {
      after(() =>
        logAction(db, {
          actor: { kind: "miniapp", employeeId: emp.id, name: emp.name || null },
          source: "miniapp",
          section: "attendance-qr",
          action: "face_enroll",
          target: String(emp.id),
          status: 200,
          ip: clientIp(req.headers),
          ua: clientUa(req.headers),
          details: { shotId: res.shotId },
        }),
      );
    }
    return json({ ok: true, enrolled: res.enrolled, pass: res.pass });
  } catch (e) {
    console.error("[xodim/yuz POST]", e);
    return json({ ok: false, error: "Server xatosi — birozdan keyin qayta urinib ko'ring" }, 500);
  }
}
