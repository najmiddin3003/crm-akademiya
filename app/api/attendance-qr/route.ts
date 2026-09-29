import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { getCurrentUser } from "@/lib/auth";
import { uzDateIso } from "@/lib/uzTime";
import { DEFAULT_RADIUS_M, QR_SOURCE, type AttendanceRecord } from "@/lib/attendanceCheck";
import { isValidPoint } from "@/lib/geo";
import {
  loadAttendanceSettings,
  makeQrToken,
  msToNextSlot,
  qrLink,
  qrSlot,
  saveAttendanceSettings,
  staffBotUsername,
} from "@/lib/attendanceQr";

// GET /api/attendance-qr — Nazorat → «Ishga keldim (QR)» ekrani
// (components/nazorat/AttendanceQrPage.tsx): navbardagi filialning JORIY
// QR kodi (SVG), keyingisigacha qolgan vaqt va bugun kelganlar ro'yxati.
// Ekran har 30 soniyada shu yerdan yangi kod oladi (lib/attendanceQr.ts).
//
// PATCH — «Ishdan ketdim» ni yoqish/o'chirish. FAQAT ADMIN: bu hamma xodimga
// ta'sir qiladigan sozlama, sahifa ruxsatining o'zi yetmaydi (qabulxona
// ekranidagi hisob uni o'zgartira olmasin).

const NO_STORE = { "Cache-Control": "private, no-store" };

const svgOf = (text: string) => QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

export async function GET() {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const [branch, settings, me] = await Promise.all([
    db.collection("branches").findOne({ id: scope.branchId }, { projection: { _id: 0, id: 1, name: 1, geo: 1, geoRadiusM: 1 } }),
    loadAttendanceSettings(db),
    getCurrentUser(),
  ]);

  const now = Date.now();
  const token = makeQrToken(scope.branchId, qrSlot(now));
  const [qrIn, qrOut] = await Promise.all([
    svgOf(qrLink("in", token)),
    settings.checkoutEnabled ? svgOf(qrLink("out", token)) : Promise.resolve(null),
  ]);

  const today = uzDateIso(new Date(now));
  const rows = await db
    .collection<AttendanceRecord>("turnstile_io")
    .find(
      { source: QR_SOURCE, date: today, branchId: scope.branchId },
      { projection: { _id: 0, id: 1, personName: 1, enterTime: 1, exitTime: 1, status: 1, lateMinutes: 1, expected: 1, location: 1 } },
    )
    .sort({ enterTime: -1, id: -1 })
    .limit(300)
    .toArray();

  return NextResponse.json(
    {
      ok: true,
      branch: {
        id: scope.branchId,
        name: String(branch?.name ?? ""),
        // Filialga koordinata kiritilmagan — joylashuv tekshirilmaydi (ekranda ogohlantirish).
        geoSet: isValidPoint(branch?.geo),
        radiusM: Number(branch?.geoRadiusM) > 0 ? Number(branch?.geoRadiusM) : DEFAULT_RADIUS_M,
      },
      date: today,
      qr: { in: qrIn, out: qrOut },
      refreshInMs: msToNextSlot(now),
      bot: staffBotUsername(),
      checkoutEnabled: settings.checkoutEnabled,
      canConfigure: me?.role === "admin",
      arrivals: rows,
    },
    { headers: NO_STORE },
  );
}

export async function PATCH(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  if (me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Bu sozlamani faqat administrator o'zgartiradi" }, { status: 403 });
  }
  let body: { checkoutEnabled?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  if (typeof body.checkoutEnabled !== "boolean") {
    return NextResponse.json({ ok: false, error: "checkoutEnabled kerak" }, { status: 400 });
  }
  const db = await ensureIndexes();
  await saveAttendanceSettings(db, { checkoutEnabled: body.checkoutEnabled });
  return NextResponse.json({ ok: true, checkoutEnabled: body.checkoutEnabled }, { headers: NO_STORE });
}
