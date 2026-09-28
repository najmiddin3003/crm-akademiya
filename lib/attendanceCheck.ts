import type { Db } from "mongodb";
import { branchInCondition } from "@/lib/branchScope";
import { lessonExpectedOn, parseTimeRange } from "@/lib/groupRules";
import type { HrEmployee } from "@/lib/hrEmployees";
import { toUz } from "@/lib/uzTime";
import { loadAttendanceSettings, verifyQrToken, type AttendanceKind } from "@/lib/attendanceQr";

// «ISHGA KELDIM» YOZUVI (28.09.2026) — `turnstile_io` kolleksiyasiga.
//
// NEGA TURNIKET KOLLEKSIYASI: Nazorat → Turniket kirish-chiqish analitikasi
// va xodim profilidagi «Ish soati» tabi aynan shuni o'qiydi — QR yozuvlari
// u yerlarda o'zi ko'rinadi, alohida hisobot yozish shart emas. Maydonlar
// o'sha sahifalar kutgan shaklda (lib/turnstileIo.ts), ustiga QR'ga
// xoslari: `source: "qr"`, `employeeId`, `branchId`, kechikish tafsiloti.
//
// BITTA XODIM — KUNIGA HAR FILIALDA BITTA YOZUV (noyob indeks,
// lib/mongodb.ts): qayta skanerlash birinchi vaqtni o'zgartirmaydi; ikki
// filialda dars beradigan ustoz har birida alohida belgilanadi va
// kechikishi o'sha filialdagi darsiga qarab o'lchanadi.
//
// KECHIKISH (foydalanuvchi qarori, 28.09.2026 — "o'qituvchi dars jadvali
// bo'yicha"):
//   • o'qituvchi — o'sha kuni SHU FILIALDAGI birinchi darsining boshlanishi
//     (guruh aktiv, hafta kuni mos, sana muddat ichida — `lessonExpectedOn`,
//     davomat va qarzdorlik bilan bir xil qoida; yordamchi o'qituvchi ham).
//     Bugun darsi bo'lmasa kechikish yo'q;
//   • boshqa xodimlar — filialning ish boshlanish vaqti + ruxsat etilgan
//     daqiqalar (Boshqaruv → Filiallar). Vaqt kiritilmagan bo'lsa kechikish
//     o'lchanmaydi.
// Kechikkanda filialning davomat topigiga xabar ketadi (lib/attendanceNotify.ts).

export const QR_SOURCE = "qr";

export interface AttendanceRecord {
  id: number;
  /** "YYYY-MM-DD" — Toshkent kuni. */
  date: string;
  personName: string;
  personType: "employee";
  /** "HH:MM" */
  enterTime: string | null;
  exitTime: string | null;
  status: "kelgan" | "kechikkan";
  source: typeof QR_SOURCE;
  employeeId: number;
  branchId: number;
  /** Necha daqiqa kech keldi (kechikmagan bo'lsa 0). */
  lateMinutes: number;
  /** Kelishi kerak bo'lgan vaqt ("HH:MM") — o'lchanmagan bo'lsa null. */
  expected: string | null;
  /** Nimaga qarab: «…» guruhi darsi / filial ish vaqti. */
  expectedWhy: string | null;
  enteredAt?: Date;
  exitedAt?: Date;
}

/** Filialning davomatga oid maydonlari (Boshqaruv → Filiallar). */
export interface AttendanceBranch {
  id: number;
  name: string;
  workStart?: string | null;
  lateGraceMin?: number | null;
  attendanceTopicId?: number | null;
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** "09:05" → 545; noto'g'ri bo'lsa null. */
export function hmToMin(hm: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? h * 60 + min : null;
}

export function minToHm(n: number): string {
  return `${p2(Math.floor(n / 60))}:${p2(n % 60)}`;
}

export interface Expectation {
  /** Daqiqa (kun boshidan). */
  at: number;
  why: string;
  /** Ruxsat etilgan kechikish, daqiqa (o'qituvchida 0). */
  grace: number;
}

export interface LessonGroup {
  id?: number;
  name?: string;
  status?: string;
  day?: string;
  time?: string;
  startDate?: string;
  endDate?: string;
  period?: string;
}

/** Ustozning shu kungi birinchi darsi (sof funksiya — sinov shu orqali). */
export function firstLessonOf<G extends LessonGroup>(groups: G[], iso: string, weekday: number): { at: number; group: G } | null {
  let best: { at: number; group: G } | null = null;
  for (const g of groups) {
    if (!lessonExpectedOn(g, iso, weekday)) continue;
    const range = parseTimeRange(g.time ?? "");
    if (!range) continue;
    if (!best || range[0] < best.at) best = { at: range[0], group: g };
  }
  return best;
}

/** Kechikish daqiqalari: ruxsat etilgan chegaradan o'tsa — kutilgan vaqtdan hisoblab. */
export function lateBy(nowMin: number, exp: Expectation | null): number {
  if (!exp) return 0;
  return nowMin > exp.at + exp.grace ? nowMin - exp.at : 0;
}

/** Filialning ish vaqti — o'qituvchi bo'lmagan xodim uchun (sof funksiya). */
export function branchExpectation(branch: AttendanceBranch): Expectation | null {
  const at = hmToMin(branch.workStart);
  if (at === null) return null;
  const g = Number(branch.lateGraceMin);
  return { at, why: "filial ish vaqti", grace: Number.isInteger(g) && g > 0 ? Math.min(g, 180) : 0 };
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function expectationFor(db: Db, emp: HrEmployee, branch: AttendanceBranch, iso: string, weekday: number): Promise<Expectation | null> {
  if (emp.turi !== "teacher") return branchExpectation(branch);
  const who = { $regex: `^\\s*${escapeRegex(emp.name.trim())}\\s*$`, $options: "i" };
  const groups = await db
    .collection("groups")
    .find(
      { $and: [{ status: "active" }, branchInCondition([branch.id]), { $or: [{ teacher: who }, { assistant: who }] }] },
      { projection: { _id: 0, id: 1, name: 1, status: 1, day: 1, time: 1, startDate: 1, endDate: 1, period: 1 } },
    )
    .toArray();
  const first = firstLessonOf(groups as LessonGroup[], iso, weekday);
  if (!first) return null;
  return { at: first.at, why: `«${first.group.name || first.group.id}» guruhi darsi`, grace: 0 };
}

export type AttendanceOutcome =
  | {
      ok: true;
      kind: AttendanceKind;
      /** true — shu so'rov yozdi; false — bugun allaqachon belgilangan edi. */
      fresh: boolean;
      record: AttendanceRecord;
      branch: AttendanceBranch;
    }
  | { ok: false; status: number; error: string };

const isDuplicateKey = (e: unknown) => (e as { code?: number } | null)?.code === 11000;

/**
 * QR bo'yicha kelish/ketishni yozadi. Xodim kimligini CHAQIRUVCHI aniqlaydi
 * (bot sessiyasi yoki Mini App `initData`) — bu yerga faqat tekshirilgan
 * `HrEmployee` keladi; filial esa imzolangan tokendan.
 */
export async function markAttendance(
  db: Db,
  emp: HrEmployee,
  kind: AttendanceKind,
  token: string,
  now: Date = new Date(),
): Promise<AttendanceOutcome> {
  const v = verifyQrToken(token, now.getTime());
  if (!v.ok) return { ok: false, status: 400, error: v.error };
  if (kind === "out" && !(await loadAttendanceSettings(db)).checkoutEnabled) {
    return { ok: false, status: 403, error: "«Ishdan ketdim» hozircha o'chirilgan" };
  }
  const branch = (await db.collection("branches").findOne(
    { id: v.branchId },
    { projection: { _id: 0, id: 1, name: 1, workStart: 1, lateGraceMin: 1, attendanceTopicId: 1 } },
  )) as AttendanceBranch | null;
  if (!branch) return { ok: false, status: 404, error: "Filial topilmadi" };

  const u = toUz(now);
  const date = `${u.getFullYear()}-${p2(u.getMonth() + 1)}-${p2(u.getDate())}`;
  const nowMin = u.getHours() * 60 + u.getMinutes();
  const hm = minToHm(nowMin);
  const col = db.collection<AttendanceRecord>("turnstile_io");
  const key = { source: QR_SOURCE, date, employeeId: emp.id, branchId: branch.id } as const;
  const existing = await col.findOne(key, { projection: { _id: 0 } });

  if (kind === "out") {
    if (!existing?.enterTime) {
      return { ok: false, status: 409, error: "Bugun bu filialda kelganingiz belgilanmagan — avval «Ishga keldim»" };
    }
    // Qayta skanerlansa oxirgisi qoladi — chiqib, qaytib kelib, yana ketish mumkin.
    await col.updateOne(key, { $set: { exitTime: hm, exitedAt: now } });
    return { ok: true, kind, fresh: true, record: { ...existing, exitTime: hm }, branch };
  }

  if (existing?.enterTime) return { ok: true, kind, fresh: false, record: existing, branch };

  const exp = await expectationFor(db, emp, branch, date, u.getDay());
  const late = lateBy(nowMin, exp);
  const base: Omit<AttendanceRecord, "id"> = {
    date,
    personName: emp.name.trim(),
    personType: "employee",
    enterTime: hm,
    exitTime: null,
    status: late > 0 ? "kechikkan" : "kelgan",
    source: QR_SOURCE,
    employeeId: emp.id,
    branchId: branch.id,
    lateMinutes: late,
    expected: exp ? minToHm(exp.at) : null,
    expectedWhy: exp?.why ?? null,
    enteredAt: now,
  };

  // `id` — kolleksiyadagi eng kattasidan keyingisi (loyihadagi naqsh). Bir
  // lahzada ikki xodim skanerlasa ikkinchisi to'qnashadi va qayta oladi.
  for (let attempt = 0; attempt < 5; attempt++) {
    const [last] = await col.find({}, { projection: { _id: 0, id: 1 } }).sort({ id: -1 }).limit(1).toArray();
    const record: AttendanceRecord = { id: (Number(last?.id) || 0) + 1, ...base };
    try {
      await col.insertOne({ ...record });
      return { ok: true, kind, fresh: true, record, branch };
    } catch (e) {
      if (!isDuplicateKey(e)) throw e;
      // Shu xodim ikki marta ketma-ket skanerlagan — birinchisi yozildi.
      const again = await col.findOne(key, { projection: { _id: 0 } });
      if (again) return { ok: true, kind, fresh: false, record: again, branch };
    }
  }
  return { ok: false, status: 503, error: "Hozir band — birozdan keyin qayta skanerlang" };
}
