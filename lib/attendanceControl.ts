import type { Db, Document } from "mongodb";
import { branchInCondition } from "@/lib/branchScope";
import { nameEq } from "@/lib/currentEmployee";
import { groupLabel } from "@/lib/groups";
import { groupBoundsIso, lessonExpectedOn } from "@/lib/groupRules";
import { groupWeekdays } from "@/lib/attendance";
import { createPenalty } from "@/lib/penaltyCreate";
import { sendToStaff } from "@/lib/staffBot/api";
import { isStaffBotReady, loadStaffBotConfig } from "@/lib/staffBot/config";
import { markBlocked, STAFF_BOT_USERS } from "@/lib/staffBot/session";
import { toUz, uzDateIso } from "@/lib/uzTime";
import {
  MARK_DEADLINE_MIN,
  type AcLate,
  type AcOverview,
  type AcRecord,
  type AcRecords,
  type AcStatus,
  type AcToday,
  type AcUnmarked,
} from "@/lib/attendanceControlTypes";

// NAZORAT → DAVOMAT NAZORATI (34-qism, rasmlar «Davomat nazorati · Belgilanmagan darslar / Yozuvlar»).
//
// Dars — guruh jadvali bo'yicha (lessonExpectedOn: aktiv guruh, hafta kuni, muddat ichida). Belgilangan —
// shu kunga `attendance` da kamida bitta belgi bor. Qachon belgilangani — `attendance_history` dagi
// eng birinchi yozuv («DD.MM.YYYY | HH:mm», kim — `author`). Dars tugagach MARK_DEADLINE_MIN daqiqadan
// keyin belgilangani — «kechikib», umuman belgilanmagani — «belgilanmagan». Boshlanish sanasi yo'q
// guruh hisobotga kirmaydi (qaysi kunlari dars bo'lishi noma'lum) — alohida ro'yxatda.
// «Eslatma yuborish» — o'qituvchiga xodimlar botida; «Jarima yozish» — Moliya → Jarima (lib/penaltyCreate.ts);
// ikkalasi `attendance_control_actions` da qayd etiladi (bir darsga bitta jarima).

export const AC_ACTIONS = "attendance_control_actions";

type Fail = { ok: false; error: string; status: number };

interface GroupDoc {
  id: number;
  name?: string;
  course?: string;
  teacher?: string;
  time?: string;
  room?: string;
  day?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  period?: string;
  branchId?: number | null;
  studentIds?: number[];
}

const GROUP_FIELDS = { _id: 0, id: 1, name: 1, course: 1, teacher: 1, time: 1, room: 1, day: 1, status: 1, startDate: 1, endDate: 1, period: 1, branchId: 1, studentIds: 1 } as const;
const branchOfGroup = (g: { branchId?: unknown }) => (Number.isFinite(Number(g.branchId)) && g.branchId !== null && g.branchId !== undefined ? Number(g.branchId) : 1);

/** "14:00-15:30" → [840, 930]; noto'g'ri — null. */
export function timeRange(t: string | undefined): [number, number] | null {
  const m = String(t ?? "").match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])];
}
const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** "17.11.2026 | 10:47" → { iso: "2026-11-17", min: 647 }. */
function parseStamp(s: unknown): { iso: string; min: number } | null {
  const m = String(s ?? "").match(/(\d{2})\.(\d{2})\.(\d{4})\s*\|?\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { iso: `${m[3]}-${m[2]}-${m[1]}`, min: Number(m[4]) * 60 + Number(m[5]) };
}
const dayNo = (iso: string) => Math.round(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000);
const weekdayOf = (iso: string) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))).getUTCDay();
function addDays(iso: string, n: number): string {
  const d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + n));
  return d.toISOString().slice(0, 10);
}

export async function branchList(db: Db, ids: number[]) {
  const rows = await db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray();
  const all = rows.map((r) => ({ id: Number(r.id), name: String(r.name ?? `Filial ${r.id}`) })).filter((b) => Number.isFinite(b.id));
  return all.filter((b) => ids.includes(b.id));
}

async function scopedGroups(db: Db, branchIds: number[]): Promise<GroupDoc[]> {
  return (await db
    .collection("groups")
    .find({ $and: [{ status: "active" }, branchInCondition(branchIds)] } as Document, { projection: GROUP_FIELDS })
    .toArray()) as unknown as GroupDoc[];
}

function nowUz(): { iso: string; min: number } {
  const d = toUz(new Date());
  return { iso: uzDateIso(), min: d.getHours() * 60 + d.getMinutes() };
}

/** Guruh × kun bo'yicha birinchi belgilash (kim va qachon). */
async function firstMarks(db: Db, groupIds: number[], from: string, to: string) {
  const rows = await db
    .collection("attendance_history")
    .find({ groupId: { $in: groupIds }, date: { $gte: from, $lte: to } }, { projection: { _id: 0, groupId: 1, date: 1, createdAt: 1, author: 1 } })
    .toArray();
  const out = new Map<string, { iso: string; min: number; author: string }>();
  for (const r of rows) {
    const st = parseStamp(r.createdAt);
    if (!st) continue;
    const k = `${r.groupId}|${r.date}`;
    const cur = out.get(k);
    if (!cur || st.iso < cur.iso || (st.iso === cur.iso && st.min < cur.min)) out.set(k, { ...st, author: String(r.author ?? "") });
  }
  return out;
}

export async function attendanceOverview(db: Db, opts: { branchIds: number[]; from: string; to: string; isAdmin: boolean }): Promise<AcOverview> {
  const now = nowUz();
  const to = opts.to > now.iso ? now.iso : opts.to;
  const [groups, branches] = await Promise.all([scopedGroups(db, opts.branchIds), branchList(db, opts.branchIds)]);
  const bName = new Map(branches.map((b) => [b.id, b.name]));
  const excluded = groups
    .filter((g) => groupWeekdays(g.day).length > 0 && !groupBoundsIso(g).start)
    .map((g) => ({ groupId: g.id, label: groupLabel({ id: g.id, name: g.name ?? "", course: g.course ?? "" }), branchName: bName.get(branchOfGroup(g)) ?? "" }));
  const live = groups.filter((g) => groupBoundsIso(g).start);
  const ids = live.map((g) => g.id);

  const [markedRows, first, actions, todayMarks] = await Promise.all([
    db
      .collection("attendance")
      .aggregate<{ _id: { g: number; d: string } }>([
        { $match: { groupId: { $in: ids }, date: { $gte: opts.from, $lte: to } } },
        { $group: { _id: { g: "$groupId", d: "$date" } } },
      ])
      .toArray(),
    firstMarks(db, ids, opts.from, now.iso),
    db.collection(AC_ACTIONS).find({ groupId: { $in: ids }, date: { $gte: addDays(opts.from, -60), $lte: to } }, { projection: { _id: 0 } }).toArray(),
    db
      .collection("attendance")
      .aggregate<{ _id: number; n: number }>([{ $match: { groupId: { $in: ids }, date: now.iso } }, { $group: { _id: "$groupId", n: { $sum: 1 } } }])
      .toArray(),
  ]);
  const marked = new Set(markedRows.map((r) => `${r._id.g}|${r._id.d}`));
  const markedToday = new Map(todayMarks.map((r) => [Number(r._id), r.n]));
  const actOf = (gid: number, date: string, kind: string) => actions.filter((a) => Number(a.groupId) === gid && a.date === date && a.kind === kind).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] ?? null;

  const unmarked: AcUnmarked[] = [];
  const late: AcLate[] = [];
  const todayList: AcToday[] = [];
  let lessons = 0;
  let onTime = 0;
  for (let iso = opts.from; iso <= to; iso = addDays(iso, 1)) {
    const wd = weekdayOf(iso);
    for (const g of live) {
      if (!lessonExpectedOn(g, iso, wd)) continue;
      const tr = timeRange(g.time);
      const end = tr ? tr[1] : 24 * 60;
      const label = groupLabel({ id: g.id, name: g.name ?? "", course: g.course ?? "" });
      const key = `${g.id}|${iso}`;
      const isMarked = marked.has(key);
      const passed = (dayNo(now.iso) - dayNo(iso)) * 1440 + now.min - end;
      if (iso === now.iso) {
        const st: AcToday["state"] = isMarked ? "done" : passed < 0 ? "waiting" : passed <= MARK_DEADLINE_MIN ? "due" : "overdue";
        todayList.push({
          groupId: g.id,
          label,
          course: g.course ?? "",
          teacher: g.teacher ?? "",
          branchName: bName.get(branchOfGroup(g)) ?? "",
          room: g.room ?? "",
          time: g.time ?? "",
          state: st,
          marked: markedToday.get(g.id) ?? 0,
          members: (g.studentIds ?? []).length,
          markedAt: first.get(key) ? hm(first.get(key)!.min) : null,
        });
        // Muddati hali kelmagan bugungi dars hisobga kirmaydi.
        if (!isMarked && passed <= MARK_DEADLINE_MIN) continue;
      }
      lessons += 1;
      if (!isMarked) {
        const rem = actOf(g.id, iso, "remind");
        const pen = actOf(g.id, iso, "penalty");
        unmarked.push({
          groupId: g.id,
          label,
          course: g.course ?? "",
          teacher: g.teacher ?? "",
          branchName: bName.get(branchOfGroup(g)) ?? "",
          room: g.room ?? "",
          date: iso,
          time: g.time ?? "",
          passedMin: Math.max(0, passed),
          daysPassed: dayNo(now.iso) - dayNo(iso),
          reminded: rem ? { at: String(rem.at ?? ""), by: String(rem.by ?? "") } : null,
          penalty: pen ? { amount: Number(pen.amount) || 0, date: String(pen.at ?? "").slice(0, 10) } : null,
        });
        continue;
      }
      const f = first.get(key);
      const delay = f ? (dayNo(f.iso) - dayNo(iso)) * 1440 + f.min - end : 0;
      if (f && delay > MARK_DEADLINE_MIN) {
        late.push({
          groupId: g.id,
          label,
          course: g.course ?? "",
          teacher: g.teacher ?? "",
          date: iso,
          endTime: hm(end),
          markedDate: f.iso,
          markedTime: hm(f.min),
          delayMin: delay,
          byName: f.author,
          self: !!g.teacher && f.author.trim().toLowerCase() === g.teacher.trim().toLowerCase(),
        });
      } else onTime += 1;
    }
  }
  unmarked.sort((a, b) => b.date.localeCompare(a.date) || a.label.localeCompare(b.label, "uz"));
  late.sort((a, b) => b.date.localeCompare(a.date));
  todayList.sort((a, b) => (timeRange(a.time)?.[0] ?? 0) - (timeRange(b.time)?.[0] ?? 0));
  const pens = actions.filter((a) => a.kind === "penalty" && a.date >= opts.from && a.date <= to);
  return {
    ok: true,
    today: now.iso,
    from: opts.from,
    to: opts.to,
    branches,
    isAdmin: opts.isAdmin,
    kpi: { lessons, unmarked: unmarked.length, late: late.length, onTime, penalties: pens.length, penaltySum: pens.reduce((s, a) => s + (Number(a.amount) || 0), 0) },
    excluded,
    unmarked,
    late,
    today_: todayList,
  };
}

// ── Yozuvlar ────────────────────────────────────────────────────────────

export interface RecordsQuery {
  branchIds: number[];
  from: string;
  to: string;
  statuses: AcStatus[];
  q: string;
  groupId: number | null;
  teacher: string;
  marker: string;
  reason: string;
  activeOnly: boolean;
  mostAbsent: boolean;
  page: number;
  size: number;
}

const ALL_STATUSES: AcStatus[] = ["keldi", "kechikdi", "birinchi", "sababli", "sababsiz"];
const isCame = (s: string) => s === "keldi" || s === "kechikdi" || s === "birinchi";

export async function attendanceRecords(db: Db, q: RecordsQuery): Promise<AcRecords> {
  const groups = await scopedGroups(db, q.branchIds);
  const gById = new Map(groups.map((g) => [g.id, g]));
  const ids = groups.map((g) => g.id);
  const marks = await db
    .collection("attendance")
    .find({ groupId: { $in: ids }, date: { $gte: q.from, $lte: q.to } }, { projection: { _id: 0, groupId: 1, pupilId: 1, date: 1, status: 1, reason: 1, note: 1 } })
    .toArray();
  const pupilIds = [...new Set(marks.map((m) => Number(m.pupilId)))];
  const [pupils, hist] = await Promise.all([
    db.collection("pupils").find({ id: { $in: pupilIds } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, status: 1 } }).toArray(),
    db
      .collection("attendance_history")
      .find({ groupId: { $in: ids }, date: { $gte: q.from, $lte: q.to } }, { projection: { _id: 0, id: 1, groupId: 1, pupilId: 1, date: 1, author: 1, createdAt: 1 } })
      .sort({ id: 1 })
      .toArray(),
  ]);
  const pupilBy = new Map(pupils.map((p) => [Number(p.id), p]));
  const lastBy = new Map<string, { author: string; at: string }>();
  for (const h of hist) lastBy.set(`${h.groupId}|${h.pupilId}|${h.date}`, { author: String(h.author ?? ""), at: String(h.createdAt ?? "") });

  // Ketma-ket sababsiz: o'quvchi × guruh bo'yicha sanalar tartibida.
  const streakAt = new Map<string, number>();
  const seq = new Map<string, { date: string; status: string }[]>();
  for (const m of marks) {
    const k = `${m.pupilId}|${m.groupId}`;
    const arr = seq.get(k) ?? [];
    arr.push({ date: String(m.date), status: String(m.status) });
    seq.set(k, arr);
  }
  const streakNow = new Set<number>();
  for (const [k, arr] of seq) {
    arr.sort((a, b) => a.date.localeCompare(b.date));
    let run = 0;
    for (const x of arr) {
      run = x.status === "sababsiz" ? run + 1 : 0;
      streakAt.set(`${k}|${x.date}`, run);
    }
    if (run >= 2) streakNow.add(Number(k.split("|")[0]));
  }

  const nameOf = (pid: number) => {
    const p = pupilBy.get(pid);
    return p ? `${String(p.firstName ?? "").trim()} ${String(p.lastName ?? "").trim()}`.trim() || `#${pid}` : `#${pid}`;
  };
  const all: AcRecord[] = marks.map((m) => {
    const g = gById.get(Number(m.groupId));
    const last = lastBy.get(`${m.groupId}|${m.pupilId}|${m.date}`);
    const st = parseStamp(last?.at);
    return {
      key: `${m.groupId}|${m.pupilId}|${m.date}`,
      pupilId: Number(m.pupilId),
      pupilName: nameOf(Number(m.pupilId)),
      groupId: Number(m.groupId),
      groupLabel: g ? groupLabel({ id: g.id, name: g.name ?? "", course: g.course ?? "" }) : `#${m.groupId}`,
      course: g?.course ?? "",
      teacher: g?.teacher ?? "",
      date: String(m.date),
      time: g?.time ? hm(timeRange(g.time)?.[0] ?? 0) : "",
      status: (ALL_STATUSES.includes(m.status as AcStatus) ? m.status : "keldi") as AcStatus,
      reason: String(m.reason ?? ""),
      note: String(m.note ?? ""),
      byName: last?.author ?? "",
      byAt: st ? (st.iso === String(m.date) ? hm(st.min) : `${st.iso.slice(8, 10)}.${st.iso.slice(5, 7)} ${hm(st.min)}`) : "",
      streak: streakAt.get(`${m.pupilId}|${m.groupId}|${m.date}`) ?? 0,
    };
  });

  // Filtrlar (holatdan tashqari) — sanoq tabletkalari uchun.
  const qq = q.q.trim().toLowerCase();
  const base = all.filter(
    (r) =>
      (!qq || r.pupilName.toLowerCase().includes(qq)) &&
      (q.groupId === null || r.groupId === q.groupId) &&
      (!q.teacher || r.teacher === q.teacher) &&
      (!q.marker || r.byName === q.marker) &&
      (!q.reason || r.reason === q.reason) &&
      (!q.activeOnly || String(pupilBy.get(r.pupilId)?.status ?? "Aktiv") === "Aktiv"),
  );
  const counts = Object.fromEntries(ALL_STATUSES.map((s) => [s, base.filter((r) => r.status === s).length])) as Record<AcStatus, number>;
  const rows = base.filter((r) => q.statuses.includes(r.status));

  const byDay = new Map<string, { kechikdi: number; birinchi: number; sababli: number; sababsiz: number; came: number; total: number }>();
  for (const r of base) {
    const d = byDay.get(r.date) ?? { kechikdi: 0, birinchi: 0, sababli: 0, sababsiz: 0, came: 0, total: 0 };
    if (r.status !== "keldi") d[r.status] += 1;
    if (isCame(r.status)) d.came += 1;
    d.total += 1;
    byDay.set(r.date, d);
  }
  const days = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, d]) => ({ date, kechikdi: d.kechikdi, birinchi: d.birinchi, sababli: d.sababli, sababsiz: d.sababsiz, pct: d.total ? Math.round((d.came / d.total) * 100) : 0 }));
  const rc = new Map<string, number>();
  for (const r of base) if (r.status === "sababli") rc.set(r.reason || "Boshqa", (rc.get(r.reason || "Boshqa") ?? 0) + 1);
  const reasons = [...rc.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);

  let sorted = rows.sort((a, b) => b.date.localeCompare(a.date) || a.pupilName.localeCompare(b.pupilName, "uz"));
  if (q.mostAbsent) {
    const absCount = new Map<number, number>();
    for (const r of base) if (r.status === "sababsiz") absCount.set(r.pupilId, (absCount.get(r.pupilId) ?? 0) + 1);
    sorted = rows.sort((a, b) => (absCount.get(b.pupilId) ?? 0) - (absCount.get(a.pupilId) ?? 0) || b.date.localeCompare(a.date));
  }
  const start = (Math.max(1, q.page) - 1) * q.size;
  return {
    ok: true,
    counts,
    days,
    reasons,
    streakPupils: streakNow.size,
    total: sorted.length,
    rows: sorted.slice(start, start + q.size),
    groups: groups.map((g) => ({ id: g.id, label: groupLabel({ id: g.id, name: g.name ?? "", course: g.course ?? "" }) })).sort((a, b) => a.label.localeCompare(b.label, "uz")),
    teachers: [...new Set(groups.map((g) => g.teacher ?? "").filter(Boolean))].sort((a, b) => a.localeCompare(b, "uz")),
    markers: [...new Set(all.map((r) => r.byName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "uz")),
  };
}

// ── Amallar ─────────────────────────────────────────────────────────────

async function lessonGroup(db: Db, groupId: number, branchIds: number[]): Promise<GroupDoc | null> {
  const g = (await db.collection("groups").findOne({ id: groupId }, { projection: GROUP_FIELDS })) as unknown as GroupDoc | null;
  if (!g || !branchIds.includes(branchOfGroup(g))) return null;
  return g;
}

/** «Eslatma yuborish» — o'qituvchiga xodimlar botida. Bot yo'q yoki o'qituvchi botda emas — `sent: 0`. */
export async function remindTeacher(db: Db, input: { groupId: number; date: string; by: string; branchIds: number[] }): Promise<{ ok: true; sent: number } | Fail> {
  const g = await lessonGroup(db, input.groupId, input.branchIds);
  if (!g) return { ok: false, error: "Guruh topilmadi", status: 404 };
  const teacher = String(g.teacher ?? "").trim();
  let sent = 0;
  const cfg = loadStaffBotConfig();
  if (teacher && isStaffBotReady(cfg)) {
    const rows = await db
      .collection(STAFF_BOT_USERS)
      .find({ stage: "in", blocked: { $ne: true }, name: nameEq(teacher) }, { projection: { _id: 0, chatId: 1 } })
      .toArray();
    const label = groupLabel({ id: g.id, name: g.name ?? "", course: g.course ?? "" });
    const d = input.date;
    const html = `🔔 <b>Davomat belgilanmagan</b>\n${label} · ${d.slice(8, 10)}.${d.slice(5, 7)} ${g.time ?? ""}\nIltimos, davomatni belgilang.`;
    for (const r of rows) {
      const chatId = Number(r.chatId);
      if (!Number.isFinite(chatId)) continue;
      const res = await sendToStaff(cfg, chatId, html);
      if (res.ok) sent += 1;
      else if (res.blocked) await markBlocked(db, chatId);
    }
  }
  await db.collection(AC_ACTIONS).insertOne({ kind: "remind", groupId: g.id, date: input.date, at: new Date().toISOString(), by: input.by, sent });
  return { ok: true, sent };
}

/** «Jarima yozish» — o'qituvchiga (Moliya → Jarima), bir darsga bitta. */
export async function penalizeTeacher(
  db: Db,
  input: { groupId: number; date: string; amount: number; note: string; by: string; branchIds: number[] },
): Promise<{ ok: true; penaltyId: number } | Fail> {
  const g = await lessonGroup(db, input.groupId, input.branchIds);
  if (!g) return { ok: false, error: "Guruh topilmadi", status: 404 };
  const teacher = String(g.teacher ?? "").trim();
  if (!teacher) return { ok: false, error: "Guruhga o'qituvchi biriktirilmagan", status: 422 };
  if (await db.collection(AC_ACTIONS).findOne({ kind: "penalty", groupId: g.id, date: input.date })) {
    return { ok: false, error: "Bu dars uchun jarima allaqachon yozilgan", status: 409 };
  }
  const label = groupLabel({ id: g.id, name: g.name ?? "", course: g.course ?? "" });
  const d = input.date;
  const note = input.note.trim() || `Davomat belgilanmadi: ${label} · ${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
  const res = await createPenalty(db, { type: "employee", recipientName: teacher, amount: input.amount, note });
  if (!res.ok) return res;
  await db.collection(AC_ACTIONS).insertOne({ kind: "penalty", groupId: g.id, date: input.date, at: new Date().toISOString(), by: input.by, amount: input.amount, penaltyId: res.penalty.id });
  return { ok: true, penaltyId: res.penalty.id };
}
