import type { Db } from "mongodb";
import { groupWeekdays } from "@/lib/attendance";
import { branchInCondition } from "@/lib/branchScope";
import { GROUP_MEMBERSHIPS } from "@/lib/groupMembership";
import { buildPayrollReport } from "@/lib/reportPayroll";

// HISOBOTLAR (35-qism) — «USTOZLAR TUSHUMI» va «XONALAR BANDLIGI».
//
// USTOZLAR TUSHUMI (rasm «Ustozlar tushumi»): tanlangan oyda har ustoz guruhlaridan tushgan o'quvchi to'lovlari
//   (`transaction_entries`, payIn, bekor qilinmagan, `teacherName` bo'yicha; kitob va boshqa kirim — o'quvchi
//   to'lovi bo'lmagani uchun kirmaydi), shu oy uchun hisoblangan oylik («Oylik va avans» hisoboti bilan bir xil —
//   lib/reportPayroll.ts → `base`) va markazga qolgani. «Bog'lanmagan to'lov» — o'quvchi to'lovi, lekin ustozi
//   yo'q (guruh tanlanmagan) yozuvlar.
// XONALAR BANDLIGI (rasm «Xonalar bandligi»): faol guruhlar jadvali (`groups.day`, `time`, `room`) xonalar
//   bo'yicha; ish vaqti 08:00–22:00, hafta 6 kun (Du–Sh). Bandlik = dars soatlari ÷ (xonalar × 14 × 6);
//   to'liqlik — xonadagi eng katta guruh o'quvchilari ÷ xona sig'imi.

import { WORK_FROM, WORK_TO } from "@/lib/roomsHours";

export { WORK_FROM, WORK_TO };

export interface TeacherRevenueRow {
  teacher: string;
  groups: number;
  pupils: number;
  revenue: number;
  salary: number | null;
  salaryNote: string;
  share: number | null;
  center: number;
  perPupil: number | null;
}

export interface TeacherRevenueReport {
  month: string;
  rows: TeacherRevenueRow[];
  total: { groups: number; pupils: number; revenue: number; salary: number; center: number };
  unlinked: { id: number; name: string; amount: number; date: string; time: string; moderator: string }[];
  unlinkedSum: number;
}

export async function computeTeacherRevenue(db: Db, branchIds: number[], month: string): Promise<TeacherRevenueReport> {
  const from = `${month}-01`;
  const to = `${month}-31`;
  const boxes = await db.collection("cashboxes").find(branchInCondition(branchIds), { projection: { _id: 0, id: 1 } }).toArray();
  const boxIds = boxes.map((b) => Number(b.id));
  const entries = await db
    .collection("transaction_entries")
    .find(
      { txType: "payIn", status: { $nin: ["cancelled", "waiting"] }, date: { $gte: from, $lte: to }, cashboxId: { $in: boxIds }, studentName: { $nin: ["", null] } },
      { projection: { _id: 0, id: 1, amount: 1, teacherName: 1, studentName: 1, date: 1, time: 1, moderator: 1 } },
    )
    .toArray();
  const groups = await db.collection("groups").find({ $and: [branchInCondition(branchIds), { status: { $ne: "archived" } }] }, { projection: { _id: 0, id: 1, teacher: 1 } }).toArray();
  const mems = await db.collection(GROUP_MEMBERSHIPS).find({ groupId: { $in: groups.map((g) => Number(g.id)) }, leftAt: null }, { projection: { _id: 0, groupId: 1, pupilId: 1 } }).toArray();
  const payroll = await buildPayrollReport(db, { months: [month], branchIds: null, cashboxBranchIds: branchIds });
  const payRows = payroll.months[0]?.rows ?? [];
  const norm = (s: string) => s.trim().toLowerCase();

  const byTeacher = new Map<string, number>();
  const unlinked: TeacherRevenueReport["unlinked"] = [];
  for (const e of entries) {
    const t = String(e.teacherName ?? "").trim();
    if (!t) {
      unlinked.push({ id: Number(e.id), name: String(e.studentName), amount: Number(e.amount), date: String(e.date), time: String(e.time ?? ""), moderator: String(e.moderator ?? "") });
      continue;
    }
    byTeacher.set(t, (byTeacher.get(t) ?? 0) + Number(e.amount));
  }
  for (const g of groups) if (g.teacher && !byTeacher.has(String(g.teacher))) byTeacher.set(String(g.teacher), 0);

  const rows: TeacherRevenueRow[] = [...byTeacher.entries()].map(([teacher, revenue]) => {
    const gs = groups.filter((g) => String(g.teacher) === teacher);
    const pupils = new Set(mems.filter((m) => gs.some((g) => Number(g.id) === Number(m.groupId))).map((m) => Number(m.pupilId))).size;
    const pr = payRows.find((r) => norm(r.name) === norm(teacher));
    const salary = pr?.base ?? null;
    const note = !pr ? "oylik sozlanmagan" : pr.salaryType === "fixed" ? `oklad · ${pr.fixedSalary.toLocaleString("ru-RU")}` : pr.salaryType === "foiz" ? `tushumdan ${pr.percent}%` : `oklad + ${pr.percent}%`;
    return {
      teacher,
      groups: gs.length,
      pupils,
      revenue,
      salary,
      salaryNote: note,
      share: salary !== null && revenue > 0 ? Math.round((salary / revenue) * 100) : null,
      center: revenue - (salary ?? 0),
      perPupil: pupils ? Math.round(revenue / pupils) : null,
    };
  });
  rows.sort((a, b) => b.revenue - a.revenue);
  const sum = (k: "groups" | "pupils" | "revenue" | "center") => rows.reduce((a, r) => a + r[k], 0);
  return {
    month,
    rows,
    total: { groups: sum("groups"), pupils: sum("pupils"), revenue: sum("revenue"), salary: rows.reduce((a, r) => a + (r.salary ?? 0), 0), center: sum("center") },
    unlinked: unlinked.sort((a, b) => b.date.localeCompare(a.date)),
    unlinkedSum: unlinked.reduce((a, u) => a + u.amount, 0),
  };
}

// ─────────────────────────────── Xonalar ───────────────────────────────

export interface RoomBlock {
  groupId: number;
  label: string;
  course: string;
  pupils: number;
  capacity: number;
  start: string;
  end: string;
}
export interface RoomRow {
  room: string;
  capacity: number;
  blocks: { odd: RoomBlock[]; even: RoomBlock[] };
  weeklyHours: number;
  occupancy: number;
  fill: number | null;
}
export interface RoomsReport {
  rooms: RoomRow[];
  totals: { weeklyHours: number; capacityHours: number; occupancy: number; fill: number | null; pupils: number; seats: number };
  peak: { odd: { hour: number; busy: number } | null; even: { hour: number; busy: number } | null };
  freeSlots: { odd: string[]; even: string[] };
  low: string[];
  full: { room: string; label: string; pupils: number; capacity: number }[];
}

const toMin = (hm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export async function computeRooms(db: Db, branchIds: number[]): Promise<RoomsReport> {
  const rooms = await db.collection("rooms").find(branchInCondition(branchIds), { projection: { _id: 0, name: 1, capacity: 1 } }).sort({ name: 1 }).toArray();
  const groups = await db
    .collection("groups")
    .find({ $and: [branchInCondition(branchIds), { status: { $nin: ["archived"] } }] }, { projection: { _id: 0, id: 1, name: 1, course: 1, level: 1, day: 1, time: 1, room: 1, capacity: 1 } })
    .toArray();
  const mems = await db.collection(GROUP_MEMBERSHIPS).find({ groupId: { $in: groups.map((g) => Number(g.id)) }, leftAt: null }, { projection: { _id: 0, groupId: 1 } }).toArray();
  const count = (id: number) => mems.filter((m) => Number(m.groupId) === id).length;
  const roomNames = [...new Set([...rooms.map((r) => String(r.name)), ...groups.map((g) => String(g.room ?? "")).filter(Boolean)])].sort();

  const ODD = [1, 3, 5];
  const EVEN = [2, 4, 6];
  const rows: RoomRow[] = roomNames.map((room) => {
    const cap = Number(rooms.find((r) => String(r.name) === room)?.capacity) || 0;
    const blocks: RoomRow["blocks"] = { odd: [], even: [] };
    let hours = 0;
    let maxPupils = 0;
    for (const g of groups.filter((x) => String(x.room ?? "") === room)) {
      const [s, e] = String(g.time ?? "").split("-");
      const sm = toMin(s ?? "");
      const em = toMin(e ?? "");
      if (sm === null || em === null || em <= sm) continue;
      const wd = groupWeekdays(String(g.day ?? ""));
      const b: RoomBlock = { groupId: Number(g.id), label: [g.course, g.level].filter(Boolean).join(" · "), course: String(g.course ?? ""), pupils: count(Number(g.id)), capacity: Number(g.capacity) || cap, start: s.trim(), end: e.trim() };
      if (wd.some((d) => ODD.includes(d))) blocks.odd.push(b);
      if (wd.some((d) => EVEN.includes(d))) blocks.even.push(b);
      hours += ((em - sm) / 60) * wd.filter((d) => d >= 1 && d <= 6).length;
      maxPupils = Math.max(maxPupils, b.pupils);
    }
    blocks.odd.sort((a, b) => a.start.localeCompare(b.start));
    blocks.even.sort((a, b) => a.start.localeCompare(b.start));
    const capHours = (WORK_TO - WORK_FROM) * 6;
    return { room, capacity: cap, blocks, weeklyHours: Math.round(hours * 10) / 10, occupancy: Math.round((hours / capHours) * 100), fill: cap ? Math.round((maxPupils / cap) * 100) : null };
  });

  const peakOf = (key: "odd" | "even") => {
    let best: { hour: number; busy: number } | null = null;
    for (let h = WORK_FROM; h < WORK_TO; h++) {
      const busy = rows.filter((r) => r.blocks[key].some((b) => (toMin(b.start) ?? 0) < (h + 1) * 60 && (toMin(b.end) ?? 0) > h * 60)).length;
      if (busy && (!best || busy > best.busy)) best = { hour: h, busy };
    }
    return best;
  };
  const freeOf = (key: "odd" | "even") =>
    [14, 16, 18].map((h) => {
      const free = rows.filter((r) => !r.blocks[key].some((b) => (toMin(b.start) ?? 0) < (h + 2) * 60 && (toMin(b.end) ?? 0) > h * 60)).map((r) => r.room);
      return `${h}:00–${h + 2}:00 — ${free.length ? free.join(", ") : "—"}`;
    });
  const weekly = rows.reduce((a, r) => a + r.weeklyHours, 0);
  const capacityHours = rows.length * (WORK_TO - WORK_FROM) * 6;
  const pupils = groups.reduce((a, g) => a + count(Number(g.id)), 0);
  const seats = groups.reduce((a, g) => a + (Number(g.capacity) || Number(rooms.find((r) => String(r.name) === String(g.room))?.capacity) || 0), 0);
  return {
    rooms: rows,
    totals: { weeklyHours: Math.round(weekly), capacityHours, occupancy: capacityHours ? Math.round((weekly / capacityHours) * 100) : 0, fill: seats ? Math.round((pupils / seats) * 100) : null, pupils, seats },
    peak: { odd: peakOf("odd"), even: peakOf("even") },
    freeSlots: { odd: freeOf("odd"), even: freeOf("even") },
    low: rows.filter((r) => r.weeklyHours <= 6).map((r) => r.room),
    full: rows.flatMap((r) => [...r.blocks.odd, ...r.blocks.even].filter((b) => b.capacity && b.pupils >= b.capacity).map((b) => ({ room: r.room, label: b.label, pupils: b.pupils, capacity: b.capacity }))).filter((x, i, a) => a.findIndex((y) => y.room === x.room && y.label === x.label) === i),
  };
}
