import type { Db } from "mongodb";
import {
  ABSENCE_REASONS,
  ATTENDANCE_OPTIONS,
  type AttendanceGrade,
  type AttendanceHistoryEntry,
  type AttendanceMark,
  type AttendanceStatus,
} from "./attendance";
import { withBranch, type BranchScope } from "./branchScope";
import type { AdjustDeps } from "./cashboxAdjust";
import { attendanceGuard, onAttendanceChanged, type AttendanceEvent } from "./gamification/attendance";
import type { Group } from "./groups";
import { notifyAttendance } from "./studentBot/notify";
import { toUz } from "./uzTime";

// DAVOMAT BELGISINI YOZISH — guruh sahifasidagi davomat jadvali
// (app/api/groups/[id]/attendance → POST) va AI yordamchi
// (lib/ai/actions/execute.ts) BIR XIL funksiyani chaqiradi (08.10.2026,
// mantiq route'dan o'zgarishsiz ko'chirildi).
//
// Bitta yozuv = bitta o'quvchining bitta darsdagi belgisi:
//   { groupId, pupilId, date: "2026-08-03", status: "keldi" }
// Kalit — (groupId, pupilId, date) uchligi (lib/mongodb.ts da unique indeks).

const VALID = new Set<string>(ATTENDANCE_OPTIONS.map((o) => o.key));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface AttendanceInput {
  groupId: number;
  pupilId: number;
  /** "YYYY-MM-DD". */
  date: string;
  /** `null` — belgi o'chiriladi (doiracha yana bo'sh bo'ladi). */
  status: AttendanceStatus | null;
  grade?: number | null;
  /** Faqat `sababli` uchun, ABSENCE_REASONS dan. */
  reason?: string | null;
  note?: string | null;
}

export type AttendanceOutcome = { ok: true; mark: AttendanceMark | null } | { ok: false; error: string; status: 400 | 403 | 404 };

/** "15.08.2026 | 00:22" — loyihadagi boshqa sanalar bilan bir xil format. */
function fmtNow(raw: Date): string {
  const d = toUz(raw);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * GAMIFIKATSIYA HODISASI (lib/gamification/attendance.ts): holat o'zgarsa
 * tanga yozuvi va seriya qayta hisoblanadi. Javobdan OLDIN kutiladi — dars
 * jurnali darhol to'g'ri holatni ko'rsin. Xato davomatni yiqitmaydi: belgi
 * allaqachon saqlangan, xato logga yoziladi.
 */
export async function attendanceGamEvent(db: Db, e: AttendanceEvent): Promise<void> {
  try {
    await onAttendanceChanged(db, e);
  } catch (err) {
    console.error("[gamification] davomat hodisasi", { groupId: e.groupId, pupilId: e.pupilId, date: e.date }, err);
  }
}

/**
 * Bitta belgini saqlaydi (yoki `status: null` bo'lsa o'chiradi). Guruh
 * JORIY FILIALDA bo'lishi va o'quvchi shu guruhda bo'lishi shart. Har
 * o'zgarish `attendance_history` ga yoziladi (`author` — kim qo'ydi).
 *
 * Gamifikatsiya yoqilgan bo'lsa HOLATNI o'zgartirish cheklanadi (ustoz —
 * o'z guruhi, faqat dars kuni; filial admini — o'z filiali, e'tiroz
 * muddati ichida; direktor — istalgan sana). Cheklov hozirgi
 * foydalanuvchiga qarab yechiladi (sessiyadan) — shu bois chaqiruv so'rov
 * ichida bo'lishi kerak. Baho va izohni har doim o'zgartirish mumkin.
 *
 * `deps.defer` — o'quvchilar botining "davomat belgilandi" xabari (route'da
 * `after`): bir darsda 15-20 o'quvchi belgilanadi, hech biri kutmasin.
 */
export async function saveAttendanceMark(
  db: Db,
  scope: BranchScope,
  input: AttendanceInput,
  author: string,
  deps: AdjustDeps,
): Promise<AttendanceOutcome> {
  const { groupId, pupilId, date } = input;
  const status = input.status ?? null;
  if (!Number.isFinite(groupId)) return { ok: false, error: "Noto'g'ri id", status: 400 };
  if (!Number.isFinite(pupilId)) return { ok: false, error: "O'quvchi tanlanmagan", status: 400 };
  if (!ISO_DATE.test(date)) return { ok: false, error: "Sana formati noto'g'ri", status: 400 };
  if (status !== null && !VALID.has(status)) return { ok: false, error: "Davomat holati noto'g'ri", status: 400 };

  // Baho ixtiyoriy, lekin berilsa 1..5 butun son bo'lishi shart.
  let grade: AttendanceGrade | null = null;
  if (input.grade !== undefined && input.grade !== null) {
    const g = Number(input.grade);
    if (!Number.isInteger(g) || g < 1 || g > 5) return { ok: false, error: "Baho 1 dan 5 gacha bo'lishi kerak", status: 400 };
    grade = g as AttendanceGrade;
  }
  // Sabab faqat ro'yxatdagilardan bo'lsin — erkin matn `note` ga yoziladi.
  const reason = input.reason ? String(input.reason) : null;
  if (reason !== null && !ABSENCE_REASONS.includes(reason)) {
    return { ok: false, error: "Sabab ro'yxatdan tanlanishi kerak", status: 400 };
  }
  const note = input.note ? String(input.note).slice(0, 2000) : null;

  // Guruh JORIY FILIALDA bo'lishi shart — aks holda boshqa filial guruhiga davomat qo'yib bo'lardi.
  const group = await db.collection<Group>("groups").findOne(withBranch({ id: groupId }, scope));
  if (!group) return { ok: false, error: "Guruh topilmadi", status: 404 };
  if (!(group.studentIds ?? []).includes(pupilId)) return { ok: false, error: "O'quvchi bu guruhda emas", status: 400 };

  const key = { groupId, pupilId, date };
  const col = db.collection<AttendanceMark>("attendance");

  const guard = await attendanceGuard(db, group as Group & { branchId?: number }, date);
  if (guard.active && guard.denial) {
    const existing = await col.findOne(key, { projection: { _id: 0, status: 1 } });
    if ((existing?.status ?? null) !== status) return { ok: false, error: guard.denial, status: 403 };
  }

  // Har bir o'zgarish tarixga yoziladi ("Tarixi" bo'limi) — eskisi o'chmaydi.
  const writeHistory = async (entry: Omit<AttendanceHistoryEntry, "id" | "author" | "createdAt">) => {
    const hist = db.collection("attendance_history");
    const last = await hist.find({}).sort({ id: -1 }).limit(1).toArray();
    await hist.insertOne({ id: (last[0]?.id ?? 0) + 1, author: author || "Noma'lum", createdAt: fmtNow(new Date()), ...entry });
  };

  if (status === null) {
    const prev = await col.findOneAndDelete(key);
    await writeHistory({ ...key, status: null, grade: null, reason: null, note: null });
    if (guard.active) await attendanceGamEvent(db, { ...key, before: prev?.status ?? null, after: null, staff: guard.staff });
    return { ok: true, mark: null };
  }

  // Sabab/izoh faqat "sababli" holatida saqlanadi — boshqa holatga o'tilganda
  // eski sabab qolib ketmasligi kerak.
  const mark: AttendanceMark = {
    ...key,
    status,
    grade,
    reason: status === "sababli" ? reason : null,
    note: status === "sababli" ? note : null,
  };
  // `before` — o'zgarishdan OLDINGI holat, atomik (gamifikatsiya hodisasi uchun).
  const prev = await col.findOneAndUpdate(key, { $set: mark }, { upsert: true, returnDocument: "before" });
  await writeHistory({ ...key, status, grade, reason: mark.reason ?? null, note: mark.note ?? null });
  if (guard.active) await attendanceGamEvent(db, { ...key, before: prev?.status ?? null, after: status, staff: guard.staff });

  // O'QUVCHILAR BOTI — "davomat belgilandi" xabari. Belgi o'chirilganda
  // yuborilmaydi (yuqoridagi shox alohida qaytadi): "davomatingiz
  // o'chirildi" xabari o'quvchiga hech narsa bermaydi, faqat xavotir
  // uyg'otadi. `notifyAttendance` o'zi hech qachon otmaydi.
  deps.defer(() =>
    notifyAttendance(db, {
      pupilId,
      date,
      status,
      grade,
      reason: mark.reason ?? null,
      groupName: group.name || String(group.id),
    }),
  );
  return { ok: true, mark };
}
