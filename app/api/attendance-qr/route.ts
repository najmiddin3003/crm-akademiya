import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, payrollBuilding } from "@/lib/branchScope";
import { getCurrentUser } from "@/lib/auth";
import { uzDateIso } from "@/lib/uzTime";
import { QR_SOURCE, branchRadiusM, healMissingAddresses, type AttendanceRecord } from "@/lib/attendanceCheck";
import { isValidPoint } from "@/lib/geo";
import { loadAttendanceSettings, saveAttendanceSettings } from "@/lib/attendanceQr";
import { staffBotUsername } from "@/lib/staffBot/config";

// GET /api/attendance-qr — Nazorat → «Ishga keldim» sahifasi
// (components/nazorat/AttendanceQrPage.tsx): tanlangan binoning bugun
// kelganlari, sozlamalar va koordinatasi kiritilmagan filiallar. 31.10.2026
// dan QR YO'Q — filial xodim joylashuvidan aniqlanadi (lib/attendanceCheck.ts
// → locateBranch), shuning uchun koordinatasiz filialda belgilab bo'lmaydi.
// Sahifa ro'yxatni har 30 soniyada yangilaydi. Yo'l nomi tarixiy.
//
// PATCH — «Ishdan ketdim» va Face ID (yuz tekshiruvi, lib/staffFace.ts) ni
// yoqish/o'chirish: `{ checkoutEnabled?, faceRequired? }`, kamida bittasi.
// FAQAT ADMIN: bu hamma xodimga ta'sir qiladigan sozlama, sahifa ruxsatining
// o'zi yetmaydi (qabulxona ekranidagi hisob uni o'zgartira olmasin).

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  // BINO (10.10.2026): 1+2 «Akademiya Chortoq» navbarda bitta qator, xodim
  // davomati esa jismoniy bino bo'yicha — kiosk binoni o'zi tanlaydi va
  // eslab qoladi (`?building=`, lib/branchScope.ts → payrollBuilding).
  const branchId = payrollBuilding(scope, new URL(req.url).searchParams.get("building"));
  if (branchId === null) {
    return NextResponse.json({ ok: false, error: "Bu bino sizga biriktirilmagan" }, { status: 403, headers: NO_STORE });
  }

  const db = await ensureIndexes();
  const [branchRows, settings, me] = await Promise.all([
    db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1, geo: 1, geoRadiusM: 1 } }).sort({ id: 1 }).toArray(),
    loadAttendanceSettings(db),
    getCurrentUser(),
  ]);
  const branch = branchRows.find((b) => Number(b.id) === branchId);
  // Koordinatasiz filiallar (foydalanuvchi ko'ra oladiganlari) — ularda «Ishga keldim» ishlamaydi.
  const missingGeo = branchRows
    .filter((b) => !isValidPoint(b.geo) && (scope.isAdmin || scope.allowed.includes(Number(b.id))))
    .map((b) => ({ id: Number(b.id), name: String(b.name ?? "") }));

  const today = uzDateIso(new Date());
  const rows = await db
    .collection<AttendanceRecord>("turnstile_io")
    .find(
      { source: QR_SOURCE, date: today, branchId },
      { projection: { _id: 0, id: 1, personName: 1, enterTime: 1, exitTime: 1, status: 1, lateMinutes: 1, expected: 1, location: 1 } },
    )
    .sort({ enterTime: -1, id: -1 })
    .limit(300)
    .toArray();
  // Manzili yo'q joylashuv — fonda to'ldiriladi, ekran keyingi yangilanishda ko'rsatadi.
  healMissingAddresses(db, rows, after);

  return NextResponse.json(
    {
      ok: true,
      branch: {
        id: branchId,
        name: String(branch?.name ?? ""),
        geoSet: isValidPoint(branch?.geo),
        radiusM: branchRadiusM({ geoRadiusM: branch?.geoRadiusM }),
      },
      missingGeo,
      date: today,
      bot: staffBotUsername(),
      checkoutEnabled: settings.checkoutEnabled,
      faceRequired: settings.faceRequired,
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
  let body: { checkoutEnabled?: unknown; faceRequired?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const patch: { checkoutEnabled?: boolean; faceRequired?: boolean } = {};
  if (typeof body.checkoutEnabled === "boolean") patch.checkoutEnabled = body.checkoutEnabled;
  if (typeof body.faceRequired === "boolean") patch.faceRequired = body.faceRequired;
  if (patch.checkoutEnabled === undefined && patch.faceRequired === undefined) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const db = await ensureIndexes();
  await saveAttendanceSettings(db, patch);
  const s = await loadAttendanceSettings(db);
  return NextResponse.json({ ok: true, checkoutEnabled: s.checkoutEnabled, faceRequired: s.faceRequired }, { headers: NO_STORE });
}
