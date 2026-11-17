import type { Db } from "mongodb";
import { DEFAULT_RADIUS_M } from "@/lib/attendanceCheck";
import { loadAttendanceSettings, saveAttendanceSettings } from "@/lib/attendanceQr";
import { isValidPoint } from "@/lib/geo";
import { STAFF_BOT_USERS } from "@/lib/staffBot/session";
import { uzDateIso } from "@/lib/uzTime";

// SOZLAMALAR → XODIM ILOVASI (38-qism, rasm «Sozlamalar · Xodim ilovasi»). Mavjud sozlamalarga ulangan:
//   • «Keldim» usuli — Joylashuv (filial radiusida) yoki Joylashuv + Face ID (`settings` attendance → faceRequired);
//     QR kiosk har doim zaxira usul;
//   • filial radiusi — `branches.geoRadiusM` (nuqtaning o'zi — Boshqaruv → Filiallar);
//   • «Ishdan ketishni ham belgilash» — checkoutEnabled.
// Ko'rsatkichlar: ilovaga kirgan xodimlar (`staff_bot_users` stage «in»), yuz namunasi bor (`staff_faces`), bugun
// ilovadan kelganlar (`turnstile_io`, source «qr»: masofa, yuz rasmi bilan).

export async function staffAppPage(db: Db, branchIds: number[]) {
  const today = uzDateIso();
  const [settings, branches, emps, linked, faces, today_] = await Promise.all([
    loadAttendanceSettings(db),
    db.collection("branches").find({ id: { $in: branchIds } }, { projection: { _id: 0, id: 1, name: 1, geo: 1, geoRadiusM: 1 } }).sort({ id: 1 }).toArray(),
    db.collection("hr_employees").countDocuments({ archived: { $ne: true } }),
    db.collection(STAFF_BOT_USERS).countDocuments({ stage: "in" }),
    db.collection("staff_faces").countDocuments({}),
    db
      .collection("turnstile_io")
      .find({ date: today, source: "qr", branchId: { $in: branchIds } }, { projection: { _id: 0, personName: 1, enterTime: 1, location: 1, faceShotId: 1, branchId: 1 } })
      .sort({ enterTime: -1 })
      .limit(12)
      .toArray(),
  ]);
  return {
    ok: true as const,
    today,
    mode: settings.faceRequired ? ("geo_face" as const) : ("geo" as const),
    checkoutEnabled: settings.checkoutEnabled,
    employees: emps,
    linked,
    faces,
    todayCount: today_.length,
    branches: branches.map((b) => ({ id: Number(b.id), name: String(b.name), radius: Number(b.geoRadiusM) > 0 ? Number(b.geoRadiusM) : DEFAULT_RADIUS_M, geoSet: isValidPoint(b.geo) })),
    arrivals: today_.map((r) => ({
      name: String(r.personName ?? ""),
      time: String(r.enterTime ?? ""),
      place: String((r.location as { text?: string } | undefined)?.text ?? ""),
      face: !!r.faceShotId,
    })),
  };
}

export async function saveStaffApp(db: Db, b: { mode?: string; checkoutEnabled?: boolean; radius?: { id: number; m: number } }) {
  if (b.mode === "geo" || b.mode === "geo_face") await saveAttendanceSettings(db, { faceRequired: b.mode === "geo_face" });
  if (typeof b.checkoutEnabled === "boolean") await saveAttendanceSettings(db, { checkoutEnabled: b.checkoutEnabled });
  if (b.radius) {
    const m = Math.round(Number(b.radius.m));
    if (!(m >= 30 && m <= 2000)) return { ok: false as const, error: "Radius 30–2000 m" };
    await db.collection("branches").updateOne({ id: Number(b.radius.id) }, { $set: { geoRadiusM: m } });
  }
  return { ok: true as const };
}
