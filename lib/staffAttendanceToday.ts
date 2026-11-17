import type { Db } from "mongodb";
import { expectationFor, homeBranchIds, hmToMin, minToHm, QR_SOURCE, type AttendanceBranch, type AttendanceRecord } from "@/lib/attendanceCheck";
import { loadAttendanceSettings } from "@/lib/attendanceQr";
import type { HrEmployee } from "@/lib/hrEmployees";
import { isValidPoint } from "@/lib/geo";
import { staffBotUsername } from "@/lib/staffBot/config";
import { toUz, uzDateIso } from "@/lib/uzTime";

// NAZORAT → XODIMLAR DAVOMATI (34-qism; foydalanuvchi qarori 17.11.2026 — «QR'siz qolsin»: belgilash
// avvalgidek xodimlar botida, joylashuv + Face ID, lib/attendanceCheck.ts). Bu modul — bino bo'yicha
// bugungi holat: shu binoga biriktirilgan har xodimning kutilgan vaqti (ustoz — birinchi darsi,
// boshqalar — o'z / filial ish vaqti, `expectationFor`) va «Ishga keldim» yozuvi (`turnstile_io`).
// Kelmagan: kutilgan vaqt + ruxsat o'tgan, yozuv yo'q. Bugun ishi yo'q (kutilmagan) xodim ro'yxatga
// kirmaydi, kelgan bo'lsa — kiradi.

export interface StaffDayRow {
  employeeId: number;
  name: string;
  role: string;
  expected: string | null;
  expectedWhy: string | null;
  enter: string | null;
  exit: string | null;
  lateMinutes: number;
  /** ontime — vaqtida; late — kechikdi; absent — kelmadi; waiting — vaqti hali kelmagan; extra — kutilmagan, lekin keldi. */
  state: "ontime" | "late" | "absent" | "waiting" | "extra";
  face: boolean;
  location: string | null;
}

export interface StaffDayEvent {
  time: string;
  name: string;
  role: string;
  kind: "in" | "out";
  expected: string | null;
  lateMinutes: number;
  location: string | null;
}

export interface StaffDayPayload {
  ok: true;
  date: string;
  today: string;
  building: { id: number; name: string; geoSet: boolean; workStart: string | null };
  buildings: { id: number; name: string }[];
  bot: string;
  checkoutEnabled: boolean;
  faceRequired: boolean;
  canConfigure: boolean;
  missingGeo: { id: number; name: string }[];
  rows: StaffDayRow[];
  events: StaffDayEvent[];
}

const ROLE: Record<string, string> = { teacher: "O'qituvchi", moderator: "Admin" };

function weekdayOf(iso: string) {
  return new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))).getUTCDay();
}

export async function staffDay(db: Db, opts: { buildingId: number; date: string; allowed: number[]; isAdmin: boolean }): Promise<StaffDayPayload | { ok: false; error: string; status: number }> {
  const today = uzDateIso();
  const [branchRows, settings, emps, recs] = await Promise.all([
    db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1, geo: 1, geoRadiusM: 1, workStart: 1, lateGraceMin: 1 } }).sort({ id: 1 }).toArray(),
    loadAttendanceSettings(db),
    db.collection("hr_employees").find({ $or: [{ archDate: { $in: ["", null] } }, { archDate: { $exists: false } }] }, { projection: { _id: 0, faceDescriptor: 0, photo: 0 } }).toArray() as unknown as Promise<HrEmployee[]>,
    db.collection<AttendanceRecord>("turnstile_io").find({ source: QR_SOURCE, date: opts.date, branchId: opts.buildingId }, { projection: { _id: 0 } }).toArray(),
  ]);
  const b = branchRows.find((x) => Number(x.id) === opts.buildingId);
  if (!b) return { ok: false, error: "Filial topilmadi", status: 404 };
  const branch = { id: Number(b.id), name: String(b.name ?? ""), workStart: b.workStart ?? null, lateGraceMin: b.lateGraceMin ?? null, geo: b.geo ?? null, geoRadiusM: b.geoRadiusM ?? null } as AttendanceBranch;
  const wd = weekdayOf(opts.date);
  const u = toUz(new Date());
  const nowMin = opts.date < today ? 24 * 60 : opts.date > today ? -1 : u.getHours() * 60 + u.getMinutes();

  const here = emps.filter((e) => homeBranchIds(e).includes(opts.buildingId));
  const recBy = new Map<number, AttendanceRecord>();
  for (const r of recs) recBy.set(Number(r.employeeId), r);
  const rows: StaffDayRow[] = [];
  for (const e of here) {
    const exp = await expectationFor(db, e, branch, opts.date, wd);
    const r = recBy.get(Number(e.id)) ?? null;
    if (!exp && !r) continue;
    const at = exp?.at ?? null;
    let state: StaffDayRow["state"];
    // Yozuvda o'lchangan kutilgan vaqt bo'lsa — o'sha bo'yicha (bugungi jadval keyin o'zgargan bo'lishi mumkin).
    if (r) state = !exp && !r.expected ? "extra" : r.status === "kechikkan" || (r.lateMinutes ?? 0) > 0 ? "late" : "ontime";
    else state = at !== null && nowMin > at + (exp?.grace ?? 0) ? "absent" : "waiting";
    rows.push({
      employeeId: Number(e.id),
      name: e.name,
      role: ROLE[String(e.turi)] ?? (String(e.turi ?? "") || "Xodim"),
      expected: r?.expected ?? (at !== null ? minToHm(at) : null),
      expectedWhy: r?.expectedWhy ?? exp?.why ?? null,
      enter: r?.enterTime ?? null,
      exit: r?.exitTime ?? null,
      lateMinutes: Number(r?.lateMinutes) || 0,
      state,
      face: !!r?.faceShotId,
      location: r?.location?.text ?? null,
    });
  }
  // Ro'yxatda yo'q (boshqa binoga biriktirilgan), lekin shu binoda belgilangan yozuvlar.
  for (const r of recs) {
    if (rows.some((x) => x.employeeId === Number(r.employeeId))) continue;
    rows.push({
      employeeId: Number(r.employeeId),
      name: r.personName,
      role: "Xodim",
      expected: r.expected,
      expectedWhy: r.expectedWhy,
      enter: r.enterTime,
      exit: r.exitTime,
      lateMinutes: Number(r.lateMinutes) || 0,
      state: !r.expected ? "extra" : r.status === "kechikkan" ? "late" : "ontime",
      face: !!r.faceShotId,
      location: r.location?.text ?? null,
    });
  }
  const ORDER = { absent: 0, late: 1, waiting: 2, ontime: 3, extra: 4 } as const;
  rows.sort((a, b2) => ORDER[a.state] - ORDER[b2.state] || (hmToMin(b2.enter) ?? -1) - (hmToMin(a.enter) ?? -1) || a.name.localeCompare(b2.name, "uz"));

  const roleOf = new Map(rows.map((x) => [x.employeeId, x.role]));
  const events: StaffDayEvent[] = [];
  for (const r of recs) {
    const role = roleOf.get(Number(r.employeeId)) ?? "Xodim";
    if (r.enterTime) events.push({ time: r.enterTime, name: r.personName, role, kind: "in", expected: r.expected, lateMinutes: Number(r.lateMinutes) || 0, location: r.location?.text ?? null });
    if (r.exitTime) events.push({ time: r.exitTime, name: r.personName, role, kind: "out", expected: null, lateMinutes: 0, location: r.exitLocation?.text ?? null });
  }
  events.sort((a, b2) => b2.time.localeCompare(a.time));

  const allowed = branchRows.filter((x) => opts.isAdmin || opts.allowed.includes(Number(x.id)));
  return {
    ok: true,
    date: opts.date,
    today,
    building: { id: branch.id, name: branch.name, geoSet: isValidPoint(b.geo), workStart: (b.workStart as string | null) ?? null },
    buildings: allowed.map((x) => ({ id: Number(x.id), name: String(x.name ?? "") })),
    bot: staffBotUsername(),
    checkoutEnabled: settings.checkoutEnabled,
    faceRequired: settings.faceRequired,
    canConfigure: opts.isAdmin,
    missingGeo: allowed.filter((x) => !isValidPoint(x.geo)).map((x) => ({ id: Number(x.id), name: String(x.name ?? "") })),
    rows,
    events,
  };
}
