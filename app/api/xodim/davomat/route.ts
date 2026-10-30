import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { staffFromInitData } from "@/lib/staffBot/webapp";
import { loadAttendanceSettings, parseScanned, type AttendanceKind } from "@/lib/attendanceQr";
import { faceState, linkShot, readFacePass } from "@/lib/staffFace";
import { fillLocationAddress, markAttendance, type ScanLocation } from "@/lib/attendanceCheck";
import { notifyLate } from "@/lib/attendanceNotify";
import { isValidPoint } from "@/lib/geo";
import { clientIp, clientUa, logAction } from "@/lib/actionLog";

// POST /api/xodim/davomat — «📷 Ishga keldim» Mini App'i (/xodim/keldim)
// skanerlagan QR kodni yozadi.
// Body: { code: <skanerlangan matn>, kind?: "in"|"out", loc?: { lat, lng, acc } }.
//
// `loc` — qurilma joylashuvi (Telegram LocationManager, 29.09.2026). Filialga
// koordinata kiritilgan bo'lsa usiz yoki uzoqdan skanerlash qabul qilinmaydi
// (lib/attendanceCheck.ts → checkLocation); javobdagi `code` Mini App'ga
// qaysi tugmani (sozlama / qayta urinish) ko'rsatishni aytadi.
//
// Xodim — Telegram `initData` dan (lib/staffBot/webapp.ts, bot bilan bir xil
// tekshiruv), filial — imzolangan QR tokenidan (lib/attendanceQr.ts). Klient
// hech qanday id yubormaydi.
//
// `kind` — qaysi tugma bilan ochilgani. Skanerlangan kod boshqa turniki
// bo'lsa (ekranda ikkala kod yonma-yon turganda adashib boshqasini
// skanerlagan) — yozilmaydi: "keldim" o'rniga "ketdim" belgilanib qolmasin.
//
// `facePass` — FACE ID yoqilgan bo'lsa (30.10.2026, lib/staffFace.ts): Mini App
// avval /api/xodim/yuz da yuzni tasdiqlaydi va shu ruxsatni oladi. Ruxsatsiz
// yoki eskirgan bo'lsa `code: "face_required"` — Mini App yuz qadamiga qaytadi.

const NO_STORE = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

/** Klient yuborgan joylashuv — raqamlar va chegaralar tekshiriladi, qolgani tashlanadi. */
function readLocation(raw: unknown): ScanLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { lat?: unknown; lng?: unknown; acc?: unknown };
  const p = { lat: Number(r.lat), lng: Number(r.lng) };
  if (!isValidPoint(p)) return null;
  const acc = r.acc === null || r.acc === undefined ? null : Number(r.acc);
  return { ...p, acc: acc !== null && Number.isFinite(acc) && acc >= 0 ? acc : null };
}

export async function POST(req: Request) {
  let body: { code?: unknown; kind?: unknown; loc?: unknown; facePass?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Noto'g'ri so'rov" }, 400);
  }
  const scanned = parseScanned(String(body.code ?? ""));
  if (!scanned) return json({ ok: false, error: "QR kod tanilmadi — filial ekranidagi kodni skanerlang" }, 400);
  const wanted: AttendanceKind | null = body.kind === "in" || body.kind === "out" ? body.kind : null;
  if (wanted && wanted !== scanned.kind) {
    return json(
      { ok: false, error: wanted === "in" ? "Bu «Ishdan ketdim» kodi — «Ishga keldim» kodini skanerlang" : "Bu «Ishga keldim» kodi — «Ishdan ketdim» kodini skanerlang" },
      409,
    );
  }

  try {
    const db = await ensureIndexes();
    const auth = await staffFromInitData(db, req.headers.get("x-telegram-init-data") || "");
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

    // FACE ID: yoqilgan va xodim ozod bo'lmasa — yuz ruxsati shart.
    let faceShotId: string | null = null;
    const settings = await loadAttendanceSettings(db);
    if (settings.faceRequired && !(await faceState(db, auth.employee.id)).exempt) {
      faceShotId = readFacePass(body.facePass, auth.employee.id);
      if (!faceShotId) return json({ ok: false, error: "Avval yuzingizni tasdiqlang", code: "face_required" }, 403);
    }

    const res = await markAttendance(db, auth.employee, scanned.kind, scanned.token, { loc: readLocation(body.loc), faceShotId });
    if (!res.ok) return json({ ok: false, error: res.error, code: res.code ?? null }, res.status);

    // Yuz urinishi qaysi yozuvga ishlatildi — admin profilda ko'radi.
    if (faceShotId && res.fresh) {
      const shotId = faceShotId;
      const link = { recordId: res.record.id, kind: res.kind, date: res.record.date, branchId: res.branch.id };
      after(() => linkShot(db, shotId, link));
    }

    // AMALLAR JURNALI (lib/actionLog.ts): «Ishga keldim/ketdim» — kim, qaysi
    // bino. Mini App sessiyasiz keladi, proxy uni yozmaydi. Takror skaner — yo'q.
    if (res.fresh) {
      const emp = auth.employee;
      const rec = res.record;
      after(() =>
        logAction(db, {
          actor: { kind: "miniapp", employeeId: emp.id, name: emp.name || null },
          source: "miniapp",
          section: "attendance-qr",
          action: res.kind === "in" ? "qr_in" : "qr_out",
          target: String(emp.id),
          status: 200,
          ip: clientIp(req.headers),
          ua: clientUa(req.headers),
          branchId: res.branch.id,
          details: { date: rec.date, time: res.kind === "in" ? rec.enterTime : rec.exitTime, lateMinutes: rec.lateMinutes ?? 0 },
        }),
      );
    }
    // Javob xodimga ketgandan KEYIN — Telegram sekin bo'lsa ham skaner kutmaydi.
    if (res.fresh && res.kind === "in" && res.record.lateMinutes > 0) {
      const { record, branch } = res;
      const turi = auth.employee.turi;
      after(() => notifyLate(record, branch, turi));
    }
    // Manzil hozir topilmadi (ertalabki navbat yoki tarmoq) — fonda to'ldiriladi.
    if (res.addressPending) {
      const recordId = res.record.id;
      const field = res.addressPending;
      after(() => fillLocationAddress(db, recordId, field));
    }

    const r = res.record;
    return json({
      ok: true,
      kind: res.kind,
      fresh: res.fresh,
      branchName: res.branch.name,
      date: r.date,
      enterTime: r.enterTime,
      exitTime: r.exitTime,
      status: r.status,
      lateMinutes: r.lateMinutes,
      expected: r.expected,
      expectedWhy: r.expectedWhy,
      locationText: (res.kind === "out" ? r.exitLocation : r.location)?.text ?? null,
    });
  } catch (e) {
    console.error("[xodim/davomat]", e);
    return json({ ok: false, error: "Server xatosi — birozdan keyin qayta urinib ko'ring" }, 500);
  }
}
