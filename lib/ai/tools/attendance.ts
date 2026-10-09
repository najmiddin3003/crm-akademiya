import { ROLE_LABELS } from "@/constants/employees";
import { ATTENDANCE_OPTIONS, type AttendanceStatus } from "@/lib/attendance";
import { allBranchIds, branchInCondition, strictBranchCondition, withBranch } from "@/lib/branchScope";
import { groupBoundsIso, lessonExpectedOn, parseTimeRange, timeToMinutes } from "@/lib/groupRules";
import { groupLabel, type Group } from "@/lib/groups";
import { pupilFullName } from "@/lib/pupilsData";
import { TURNSTILE_IO_STATUS_LABELS, type TurnstileIoStatus } from "@/lib/turnstileIo";
import { uzTimeHm } from "@/lib/uzTime";
import { daysInclusive, optDate, optString, ToolInputError, type AiTool, type ToolArgs } from "./types";

// DAVOMAT — o'quvchilar (guruh davomati) va xodimlar («Ishga keldim» QR).
//
// O'QUVCHILAR: `attendance` kolleksiyasi — Nazorat → Davomat, Davomat
// qilinmagan guruhlar sahifalari va guruh sahifasidagi Davomat tabi bilan
// BIR XIL manba. Qamrov — joriy filial guruhlari (`withBranch`, Guruh
// sahifasi kabi). "Qoldirgan" = Sababli + Sababsiz (NazoratDavomatPage
// dagi MISSED_STATUSES). "Davomat qilinmagan" — guruh aktiv, o'sha kun
// dars kuni va muddat ichida (`lessonExpectedOn`, lib/groupRules.ts), lekin
// birorta belgi yo'q.
//
// XODIMLAR: `turnstile_io` (personType "employee") — Turniket kirish-chiqish
// analitikasi va xodim profilidagi «Ish soati» tabi o'qiydigan yozuvlar.
// Kechikish yozuv paytida hisoblangan (lib/attendanceCheck.ts), bu yerda
// qayta hisoblanmaydi. "Kelmaganlar" — faqat BITTA kun va joriy filial
// uchun: o'qituvchi — o'sha kuni shu filialda darsi bo'lsa, boshqa xodim —
// filialda ish boshlanish vaqti kiritilgan bo'lsa (kechikish qoidasi bilan
// bir xil, lib/attendanceCheck.ts → expectationFor).

/** Bir so'rovdagi eng uzun oraliq (kun) — natija modelga sig'sin. */
export const MAX_RANGE_DAYS = 62;
const LIST = 40;
const GROUPS_LIMIT = 25;

/**
 * from/to → kunlar oralig'i. Ikkalasi ham yo'q — bugun; faqat `from` —
 * bugungacha; faqat `to` — o'sha bitta kun.
 */
export function dayRange(args: ToolArgs, today: string): { from: string; to: string } {
  let from = optDate(args, "from");
  let to = optDate(args, "to");
  if (!from && !to) return { from: today, to: today };
  if (!from) from = to;
  if (!to) to = from > today ? from : today;
  if (from > to) throw new ToolInputError('"from" must not be after "to"');
  if (daysInclusive(from, to) > MAX_RANGE_DAYS) {
    throw new ToolInputError(`the date range must be at most ${MAX_RANGE_DAYS} days`);
  }
  return { from, to };
}

/** "YYYY-MM-DD" kunining hafta kuni (0 — yakshanba), `Date#getDay()` kabi. */
export function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`); t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

// ── O'quvchilar davomati ────────────────────────────────────────────

export interface AttGroup {
  id: number;
  label: string;
  teacher: string;
  status?: string;
  day?: string;
  startDate?: string;
  endDate?: string;
  period?: string;
}

export interface AttMark {
  groupId: number;
  pupilId: number;
  date: string;
  status: AttendanceStatus;
  reason?: string | null;
}

const MARK_LABEL = Object.fromEntries(ATTENDANCE_OPTIONS.map((o) => [o.key, o.label])) as Record<AttendanceStatus, string>;
const MISSED: readonly AttendanceStatus[] = ["sababli", "sababsiz"];
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

export function isAttendanceStatus(v: string): v is AttendanceStatus {
  return v in MARK_LABEL;
}

/** Ro'yxatga chiqadigan belgilar: holat tanlangan bo'lsa — shu holat, aks holda qoldirganlar. Yangisi oldin. */
export function listedMarks(marks: readonly AttMark[], status: AttendanceStatus | ""): AttMark[] {
  return marks
    .filter((m) => (status ? m.status === status : MISSED.includes(m.status)))
    .sort((a, b) => b.date.localeCompare(a.date) || a.groupId - b.groupId);
}

/** Sof hisob (sinov shu orqali): belgilar → jamlanma, guruhlar kesimi, ro'yxat, davomat qilinmaganlar. */
export function summarizeAttendance(input: {
  from: string;
  to: string;
  today: string;
  groups: readonly AttGroup[];
  marks: readonly AttMark[];
  pupilNames: ReadonlyMap<number, string>;
  status: AttendanceStatus | "";
}) {
  const { from, to, today, groups, marks, pupilNames, status } = input;
  const byGroup = new Map(groups.map((g) => [g.id, g]));
  const counts = Object.fromEntries(ATTENDANCE_OPTIONS.map((o) => [o.key, 0])) as Record<AttendanceStatus, number>;
  const perGroup = new Map<number, { dates: Set<string>; present: number; missed: number }>();
  const markedDays = new Set<string>();
  const valid = marks.filter((m) => isAttendanceStatus(m.status));
  for (const m of valid) {
    counts[m.status]++;
    markedDays.add(`${m.groupId}|${m.date}`);
    const pg = perGroup.get(m.groupId) ?? { dates: new Set<string>(), present: 0, missed: 0 };
    pg.dates.add(m.date);
    if (MISSED.includes(m.status)) pg.missed++;
    else pg.present++;
    perGroup.set(m.groupId, pg);
  }
  const present = counts.keldi + counts.kechikdi + counts.birinchi;
  const missed = counts.sababli + counts.sababsiz;

  const listed = listedMarks(valid, status);
  const groupName = (id: number) => byGroup.get(id)?.label ?? `#${id}`;

  // Dars bo'lishi kerak edi, lekin birorta belgi qo'yilmagan — kelajak kunlari emas.
  // Boshlanish sanasi (startDate yoki period) yo'q guruh SANALMAYDI — xuddi
  // /nazorat-missed-groups sahifasidagi kabi: aks holda guruh hali ochilmagan
  // o'tgan kunlar ham "davomat qilinmagan" bo'lib chiqardi (09.10.2026).
  const notMarked: { date: string; group: string; teacher: string; page: string }[] = [];
  const dated = groups.filter((g) => !!groupBoundsIso(g).start);
  const withoutStartDate = groups.filter((g) => g.status === "active" && !groupBoundsIso(g).start).map((g) => g.label);
  const last = to < today ? to : today;
  if (from <= last) {
    for (const iso of eachDay(from, last)) {
      const wd = weekdayOf(iso);
      for (const g of dated) {
        if (lessonExpectedOn(g, iso, wd) && !markedDays.has(`${g.id}|${iso}`)) {
          notMarked.push({ date: iso, group: g.label, teacher: g.teacher || "—", page: `/groups/${g.id}` });
        }
      }
    }
  }
  notMarked.sort((a, b) => b.date.localeCompare(a.date) || a.group.localeCompare(b.group));

  const groupRows = [...perGroup]
    .map(([id, s]) => ({
      group: groupName(id),
      teacher: byGroup.get(id)?.teacher || "—",
      lessonsMarked: s.dates.size,
      present: s.present,
      missed: s.missed,
      attendancePercent: pct(s.present, s.present + s.missed),
      page: `/groups/${id}`,
    }))
    .sort((a, b) => b.missed - a.missed || a.group.localeCompare(b.group));

  return {
    totalMarks: valid.length,
    byMark: ATTENDANCE_OPTIONS.map((o) => ({ mark: o.label, count: counts[o.key] })),
    present,
    missed,
    attendancePercent: pct(present, present + missed),
    groups: groupRows.slice(0, GROUPS_LIMIT),
    groupsTotal: groupRows.length,
    marks: listed.slice(0, LIST).map((m) => ({
      date: m.date,
      student: pupilNames.get(m.pupilId) || `#${m.pupilId}`,
      group: groupName(m.groupId),
      mark: MARK_LABEL[m.status],
      reason: m.reason || undefined,
    })),
    marksTotal: listed.length,
    notMarked: notMarked.slice(0, LIST),
    notMarkedTotal: notMarked.length,
    ...(withoutStartDate.length
      ? { groupsWithoutStartDate: withoutStartDate.slice(0, LIST), groupsWithoutStartDateNote: "not checked for missing attendance: their start date is empty (as on the missed-attendance page)" }
      : {}),
  };
}

export const attendanceReport: AiTool = {
  name: "attendance_report",
  description:
    "Student attendance (davomat) of the current branch's groups for a date range (default: today): counts by mark " +
    "(Keldi, Kechikdi, Birinchi dars, Sababli, Sababsiz), attendance percent, per-group summary, the list of students who " +
    "missed lessons (Sababli + Sababsiz) with the reason, and lessons where attendance was not taken at all. " +
    "Optional filter by group, course or teacher, and by mark (then the list shows that mark instead of missed lessons).",
  parameters: {
    type: "object",
    properties: {
      from: { type: "string", description: "Start date YYYY-MM-DD (default: today)." },
      to: { type: "string", description: "End date YYYY-MM-DD (default: today). At most 62 days in total." },
      query: { type: "string", description: "Optional filter: course, group number or teacher name." },
      mark: { type: "string", enum: ATTENDANCE_OPTIONS.map((o) => o.key), description: "Optional: list only this mark." },
    },
    additionalProperties: false,
  },
  pages: ["/nazorat-davomat", "/nazorat-davomat-analytics", "/nazorat-missed-groups", "/groups"],
  async run(ctx, args) {
    const { from, to } = dayRange(args, ctx.today);
    const q = optString(args, "query", 60).toLowerCase();
    const markIn = optString(args, "mark", 20);
    if (markIn && !isAttendanceStatus(markIn)) throw new ToolInputError(`"mark" must be one of ${Object.keys(MARK_LABEL).join(", ")}`);
    const status: AttendanceStatus | "" = markIn && isAttendanceStatus(markIn) ? markIn : "";

    const rows = await ctx.db
      .collection("groups")
      .find(withBranch({}, ctx.scope), {
        projection: {
          _id: 0, id: 1, name: 1, course: 1, teacher: 1, assistant: 1,
          day: 1, status: 1, startDate: 1, endDate: 1, period: 1,
        },
      })
      .toArray();
    // Filtr — list_groups bilan bir xil: kurs, guruh raqami, ustoz yoki yordamchi.
    const groups: AttGroup[] = rows
      .filter(
        (g) =>
          !q ||
          [groupLabel(g as unknown as Group), g.name, g.course, g.teacher, g.assistant].some((v) =>
            String(v ?? "").toLowerCase().includes(q),
          ),
      )
      .map((g) => ({
        id: Number(g.id),
        label: groupLabel(g as unknown as Group),
        teacher: String(g.teacher ?? "").trim(),
        status: g.status as string | undefined,
        day: g.day as string | undefined,
        startDate: g.startDate as string | undefined,
        endDate: g.endDate as string | undefined,
        period: g.period as string | undefined,
      }));

    const marks = groups.length
      ? ((await ctx.db
          .collection("attendance")
          .find(
            { groupId: { $in: groups.map((g) => g.id) }, date: { $gte: from, $lte: to } },
            { projection: { _id: 0, groupId: 1, pupilId: 1, date: 1, status: 1, reason: 1 } },
          )
          .toArray()) as unknown as AttMark[])
      : [];

    // Ismlar faqat ro'yxatga chiqadiganlar uchun — butun hovuzni o'qimaymiz.
    const ids = [...new Set(listedMarks(marks, status).slice(0, LIST).map((m) => m.pupilId))];
    const pupils = ids.length
      ? await ctx.db
          .collection("pupils")
          .find({ id: { $in: ids } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1 } })
          .toArray()
      : [];
    const pupilNames = new Map(
      pupils.map((p) => [Number(p.id), pupilFullName({ firstName: String(p.firstName ?? ""), lastName: String(p.lastName ?? "") })]),
    );

    return {
      branch: ctx.branchName,
      scope: "groups of the current branch",
      from,
      to,
      filter: q || undefined,
      markFilter: status ? MARK_LABEL[status] : undefined,
      ...summarizeAttendance({ from, to, today: ctx.today, groups, marks, pupilNames, status }),
      note:
        "present = Keldi + Kechikdi + Birinchi dars; missed = Sababli + Sababsiz. `marks` lists " +
        (status ? `the "${MARK_LABEL[status]}" marks` : "missed lessons") +
        "; notMarked = an active group had a lesson that day but no attendance was taken.",
      page: ["/nazorat-davomat", "/nazorat-davomat-analytics", "/nazorat-missed-groups", "/groups"].find((p) => ctx.can(p)),
      notMarkedPage: ctx.can("/nazorat-missed-groups") ? "/nazorat-missed-groups" : undefined,
    };
  },
};

// ── Xodimlar davomati ───────────────────────────────────────────────

export interface StaffRecord {
  date: string;
  personName: string;
  enterTime: string | null;
  exitTime: string | null;
  status: TurnstileIoStatus;
  lateMinutes?: number | null;
  expected?: string | null;
  expectedWhy?: string | null;
  employeeId?: number | null;
  branchId?: number | null;
}

export interface StaffMember {
  id: number;
  name: string;
  turi: string;
}

export interface LessonGroupRow {
  label: string;
  teacher?: string;
  assistant?: string;
  time?: string;
  status?: string;
  day?: string;
  startDate?: string;
  endDate?: string;
  period?: string;
}

/**
 * Bir kunda kutilgan, lekin «Ishga keldim» belgilamagan xodimlar (sof
 * hisob). O'qituvchi — o'sha kuni birinchi darsi; boshqasi — filialning
 * ish boshlanishi (kiritilmagan bo'lsa kutilmaydi). Bugun va vaqti hali
 * kelmagan bo'lsa `notYetDue`.
 */
export function missingCheckIns(input: {
  date: string;
  today: string;
  nowMin: number;
  staff: readonly StaffMember[];
  groups: readonly LessonGroupRow[];
  workStart: string | null | undefined;
  records: readonly StaffRecord[];
}): { employee: string; role: string; expectedAt: string; why: string; notYetDue?: true }[] {
  const { date, today, nowMin, staff, groups, workStart, records } = input;
  if (date > today) return [];
  const wd = weekdayOf(date);
  const work = timeToMinutes(String(workStart ?? ""));
  const seenIds = new Set(records.filter((r) => r.date === date).map((r) => Number(r.employeeId)).filter(Number.isFinite));
  const seenNames = new Set(records.filter((r) => r.date === date).map((r) => norm(r.personName)));

  type Row = { employee: string; role: string; expectedAt: string; why: string; notYetDue?: true };
  const out: { at: number; row: Row }[] = [];
  for (const e of staff) {
    if (seenIds.has(e.id) || seenNames.has(norm(e.name))) continue;
    let at: number | null = null;
    let why = "";
    if (e.turi === "teacher") {
      for (const g of groups) {
        const mine = norm(g.teacher) === norm(e.name) || norm(g.assistant) === norm(e.name);
        if (!mine || !lessonExpectedOn(g, date, wd)) continue;
        const range = parseTimeRange(g.time ?? "");
        if (range && (at === null || range[0] < at)) {
          at = range[0];
          why = `«${g.label}» guruhi darsi`;
        }
      }
    } else if (work !== null) {
      at = work;
      why = "filial ish vaqti";
    }
    if (at === null) continue;
    out.push({
      at,
      row: {
        employee: e.name,
        role: (ROLE_LABELS as Record<string, string>)[e.turi] || e.turi || "—",
        expectedAt: hm(at),
        why,
        ...(date === today && at > nowMin ? { notYetDue: true as const } : {}),
      },
    });
  }
  return out.sort((a, b) => a.at - b.at || a.row.employee.localeCompare(b.row.employee)).map((x) => x.row);
}

export const staffAttendance: AiTool = {
  name: "staff_attendance",
  description:
    "Employee attendance from «Ishga keldim» QR check-ins (and turnstile records): who came and when, who was late and by " +
    "how many minutes, for a day or a date range (default: today), in the current branch (or all branches). " +
    "For a single day in the current branch it also lists employees who were expected (teachers with a lesson that day, " +
    "other staff when the branch has a work start time) but did not check in.",
  parameters: {
    type: "object",
    properties: {
      from: { type: "string", description: "Start date YYYY-MM-DD (default: today)." },
      to: { type: "string", description: "End date YYYY-MM-DD (default: today). At most 62 days in total." },
      employee: { type: "string", description: "Optional employee name filter." },
      allBranches: { type: "boolean", description: "true — all branches instead of the current one." },
    },
    additionalProperties: false,
  },
  pages: ["/nazorat-turnstile-io", "/nazorat-davomat", "/management-xodimlar"],
  async run(ctx, args) {
    const { from, to } = dayRange(args, ctx.today);
    const q = norm(optString(args, "employee", 60));
    if (args.allBranches !== undefined && typeof args.allBranches !== "boolean") {
      throw new ToolInputError('"allBranches" must be true or false');
    }
    const all = args.allBranches === true;
    const branchId = ctx.scope.branchId;

    // Filial — loyiha qoidasi bilan (`branchCondition`): maydoni yo'q eski
    // (turniket importi) yozuvlar 1-filialniki hisoblanadi.
    const base = { personType: "employee", date: { $gte: from, $lte: to } };
    const rows = (await ctx.db
      .collection("turnstile_io")
      .find(
        // Xodim davomati — JISMONIY bino (QR/turniket), hovuzsiz (lib/branchPools.ts).
        all ? base : { $and: [base, strictBranchCondition(ctx.scope)] },
        {
          projection: {
            _id: 0, date: 1, personName: 1, enterTime: 1, exitTime: 1, status: 1,
            lateMinutes: 1, expected: 1, expectedWhy: 1, employeeId: 1, branchId: 1,
          },
        },
      )
      .toArray()) as unknown as StaffRecord[];
    const records = rows.filter((r) => !q || norm(r.personName).includes(q));

    const branchNames = new Map<number, string>();
    if (all) {
      const bs = await ctx.db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray();
      for (const b of bs) branchNames.set(Number(b.id), String(b.name ?? ""));
    }

    const byStatus = (s: TurnstileIoStatus) => records.filter((r) => r.status === s).length;
    const sorted = [...records].sort(
      (a, b) => b.date.localeCompare(a.date) || String(a.enterTime ?? "99").localeCompare(String(b.enterTime ?? "99")),
    );

    // "Kelmaganlar" — faqat bitta kun, joriy filial.
    let notCheckedIn: ReturnType<typeof missingCheckIns> | undefined;
    if (from === to && !all && from <= ctx.today) {
      const [allIds, branch, staffRows, groupRows] = await Promise.all([
        allBranchIds(ctx.db),
        ctx.db.collection("branches").findOne({ id: branchId }, { projection: { _id: 0, workStart: 1 } }),
        ctx.db
          .collection("hr_employees")
          .find(
            { $or: [{ archReason: { $exists: false } }, { archReason: null }, { archReason: "" }] },
            { projection: { _id: 0, id: 1, name: 1, turi: 1, branchIds: 1 } },
          )
          .toArray(),
        ctx.db
          .collection("groups")
          .find(
            { $and: [{ status: "active" }, branchInCondition([branchId])] },
            {
              projection: {
                _id: 0, id: 1, name: 1, course: 1, teacher: 1, assistant: 1,
                time: 1, status: 1, day: 1, startDate: 1, endDate: 1, period: 1,
              },
            },
          )
          .toArray(),
      ]);
      // Filialga biriktirilgan xodimlar — biriktirilmagani birinchi filialda
      // hisoblanadi (navbardagi qamrov va topshiriqlardagi qoida bilan bir xil).
      const staff: StaffMember[] = staffRows
        .filter((r) => {
          const own = (Array.isArray(r.branchIds) ? r.branchIds : []).map(Number).filter((b: number) => allIds.includes(b));
          return (own.length ? own : [allIds[0] ?? 1]).includes(branchId);
        })
        .map((r) => ({ id: Number(r.id), name: String(r.name ?? "").trim(), turi: String(r.turi ?? "") }))
        .filter((e) => e.name && (!q || norm(e.name).includes(q)));
      const nowHm = timeToMinutes(uzTimeHm()) ?? 0;
      notCheckedIn = missingCheckIns({
        date: from,
        today: ctx.today,
        nowMin: nowHm,
        staff,
        groups: groupRows.map((g) => ({
          label: groupLabel(g as unknown as Group),
          teacher: g.teacher as string | undefined,
          assistant: g.assistant as string | undefined,
          time: g.time as string | undefined,
          status: g.status as string | undefined,
          day: g.day as string | undefined,
          startDate: g.startDate as string | undefined,
          endDate: g.endDate as string | undefined,
          period: g.period as string | undefined,
        })),
        workStart: branch?.workStart as string | null | undefined,
        records: rows,
      });
    }

    const pages = ["/nazorat-turnstile-io", "/management-xodimlar", "/nazorat-davomat"];
    return {
      branch: all ? "all branches" : ctx.branchName,
      from,
      to,
      filter: q || undefined,
      totals: {
        records: records.length,
        onTime: byStatus("kelgan"),
        late: byStatus("kechikkan"),
        absentInTurnstileData: byStatus("kelmagan") || undefined,
      },
      records: sorted.slice(0, 60).map((r) => ({
        date: r.date,
        employee: r.personName,
        branch: all ? branchNames.get(Number(r.branchId)) || undefined : undefined,
        came: r.enterTime || "—",
        left: r.exitTime || undefined,
        status: TURNSTILE_IO_STATUS_LABELS[r.status] ?? r.status,
        lateMinutes: r.lateMinutes || undefined,
        expected: r.expected || undefined,
        expectedBecause: r.expectedWhy || undefined,
      })),
      recordsShown: Math.min(sorted.length, 60),
      notCheckedIn,
      note: notCheckedIn
        ? "notCheckedIn = expected that day but no check-in record; notYetDue = their time has not come yet today. " +
          "Employees without a lesson or without a branch work start time are not expected."
        : "The list of employees who did not check in is given only for a single day in the current branch.",
      page: pages.find((p) => ctx.can(p)),
    };
  },
};
