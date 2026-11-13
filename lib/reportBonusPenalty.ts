// HISOBOTLAR → XODIMLAR VA OYLIK → «BONUS VA JARIMALAR» (26-qism, rasmlar 45–46).
//
// SOF hisob (bazasiz) — server (app/api/reports/bonus-penalty) xom hujjatlarni shu yerga
// beradi, sahifa (components/v2/reports/BonusJarimaReport.tsx) esa javobni shu yerdagi
// yig'uvchilar bilan filial → xodim → yozuv daraxtiga aylantiradi. Node sinovi ham shu
// faylni to'g'ridan-to'g'ri chaqiradi.
//
// MANBALAR — yangi kolleksiya YO'Q, Oylik (lib/payrollSources.ts) qaysi manbadan olsa shu:
//   • Bonus      ← `bonuses` (type "employee"); oy — `createdAt` ("DD.MM.YYYY HH:mm") oyi.
//   • Jarima     ← `penalties` (type "employee"), qo'lda yozilgani («Boshqa jarima»).
//   • Topshiriq  ← `staff_task_fines` (oy — `month`): `held` — oylik limiti ichida HAQIQATAN
//     ushlanadigani (Moliya → Jarima'dagi yozuv summasi), `amount − held` — limitdan
//     oshgani (tarixda qoladi, ushlanmaydi), «bekor» — sababi, kim, qachon bilan.
//     `penalties` dagi `source.kind = "staff_task"` yozuvlar shu jarimaning ko'zgusi —
//     ikki marta sanalmasin deb tashlanadi (jarimasi topilmasa — o'zi ko'rsatiladi).
//   • Kutilmoqda ← `staff_tasks` «muddati o'tdi» (qayta muddat ketyapti): bajarilmasa
//     qayta muddat oyiga jarima yoziladi, bajarilsa — yozilmaydi.
//   • Kechikish jarimasi — tizimda YO'Q («Ishga keldim» faqat xabar beradi); ustun o'rnida
//     qo'lda yozilgan jarimalar (SAVOLLAR D1).
//
// OYLIKKA TA'SIRI = bonus − ushlangan jarima (topshiriq `held` + qo'lda yozilgan) — Oylik
// sahifasidagi «Bonus» va «Jarima» ustunlarining aynan o'zi (bekor qilinmagan yozuvlar,
// `createdAt` oyi, ism bo'yicha).

import { sameBranchPool } from "./branchPools";
import { ms, uzDateOf, uzMonthOf, uzTimeOf } from "./staffTasks";

export type BpKind = "bonus" | "task" | "other";
export type BpState = "active" | "pending" | "cancelled";

export interface BpCancel {
  reason: string;
  /** Kim bekor qilgan (faqat topshiriq jarimasida bor). */
  by: string;
  /** "YYYY-MM-DD" yoki "". */
  date: string;
  time: string;
}

export interface BpEntry {
  key: string;
  /** `BpEmployee.key`. */
  emp: string;
  kind: BpKind;
  state: BpState;
  /** Yozuvning to'liq summasi (so'm). */
  amount: number;
  /** Oylikka tushadigani: bonus — summasi, jarima — ushlanadigani; faqat «active» da. */
  applied: number;
  /** Limitdan oshib ushlanmaydigani (faqat «active» topshiriq jarimasi). */
  over: number;
  /** "YYYY-MM-DD" ("" — sanasi o'qilmadi). */
  date: string;
  time: string;
  /** Topshiriq nomi yoki yozuv izohi. */
  title: string;
  priority: number | null;
  /** Kutilmoqda — qayta muddat (ISO). */
  due: string | null;
  /** Bonusni kim bergani. */
  by: string;
  cancel: BpCancel | null;
}

export interface BpEmployee {
  key: string;
  id: number | null;
  name: string;
  /** Oylik qaysi filialdan chiqadi (`payrollBranchId`); noma'lum — null. */
  branchId: number | null;
  /** "teacher" | "moderator" | "admin" | "staff" | "" (xodimlar ro'yxatida yo'q). */
  turi: string;
  /** Qo'lda qo'shilgan rol nomi (`turi` = "staff"). */
  roleName: string;
  /** Faol guruhlari (o'qituvchi). */
  groups: number;
  /** Fan (`kurs`). */
  subject: string;
  workStart: string;
  workEnd: string;
}

export interface BpReport {
  month: string;
  limitPercent: number;
  can: { bonus: boolean; penalty: boolean };
  branches: { id: number; name: string }[];
  employees: BpEmployee[];
  entries: BpEntry[];
}

/* ───────────────────────── Xom hujjatlar ───────────────────────── */

export interface RawBonus {
  id: number;
  type?: string;
  recipientName?: string;
  givenBy?: string;
  amount?: number;
  note?: string;
  reason?: string;
  status?: string;
  createdAt?: string;
}

export interface RawPenalty {
  id: number;
  type?: string;
  recipientName?: string;
  amount?: number;
  note?: string;
  reason?: string;
  status?: string;
  createdAt?: string;
  source?: { kind?: string; fineId?: number; taskId?: number } | null;
}

export interface RawFine {
  id: number;
  taskId: number;
  taskTitle: string;
  employeeId: number;
  employeeName: string;
  branchId: number;
  priority: number;
  amount: number;
  month: string;
  deadline: string;
  redeadline: string | null;
  failedAt: string;
  status: "kuchda" | "bekor";
  cancelReason?: string;
  cancelledBy?: string;
  cancelledAt?: string | null;
  held?: number;
}

export interface RawPendingTask {
  id: number;
  title: string;
  employeeId: number;
  employeeName: string;
  branchId: number;
  priority: number;
  fineAmount: number;
  redeadline: string | null;
}

export interface RawEmployee {
  id: number;
  name: string;
  turi?: string;
  centerRoleId?: number | null;
  branchIds?: number[];
  payrollBranchId?: number;
  workStart?: string | null;
  workEnd?: string | null;
  kurs?: string;
  archReason?: string;
}

export interface BpInput {
  month: string;
  /** Joriy oy — sanasi o'qilmaydigan bonus/jarima shu oyga (Oylik qoidasi). */
  currentMonth: string;
  limitPercent: number;
  can: { bonus: boolean; penalty: boolean };
  bonuses: RawBonus[];
  penalties: RawPenalty[];
  fines: RawFine[];
  pending: RawPendingTask[];
  employees: RawEmployee[];
  roles: { id: number; name: string }[];
  groups: { teacher?: string; status?: string }[];
  branches: { id: number; name: string }[];
  /** Ko'rinadigan filiallar; `null` — hammasi (admin). Filiali noma'lum xodim faqat adminga. */
  allowed: number[] | null;
}

/** Ism kaliti — Oylik bilan bir xil (lib/payrollSources.ts → nameKey). */
export function nameKey(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

/** "25.10.2026 14:05" → { date: "2026-10-25", time: "14:05" }. */
export function parseStamp(s: unknown): { date: string; time: string } | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s*\|?\s*(\d{2}:\d{2}))?/.exec(String(s ?? "").trim());
  return m ? { date: `${m[3]}-${m[2]}-${m[1]}`, time: m[4] ?? "" } : null;
}

/** ISO lahza → Toshkent sanasi va soati. */
function uzStampOf(iso: string | null | undefined): { date: string; time: string } {
  const t = ms(iso);
  return Number.isFinite(t) ? { date: uzDateOf(t), time: uzTimeOf(t) } : { date: "", time: "" };
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);

/** Xom hujjatlardan hisobot javobi. */
export function buildBonusPenalty(input: BpInput): BpReport {
  const { month } = input;
  const inMonth = (createdAt: unknown) => {
    const st = parseStamp(createdAt);
    return st ? st.date.slice(0, 7) === month : month === input.currentMonth;
  };

  const roleName = new Map(input.roles.map((r) => [Number(r.id), String(r.name ?? "")]));
  const groupsBy = new Map<string, number>();
  for (const g of input.groups) {
    if (g.status !== "active") continue;
    const k = nameKey(g.teacher);
    if (k) groupsBy.set(k, (groupsBy.get(k) ?? 0) + 1);
  }

  const toEmp = (e: RawEmployee): BpEmployee => {
    const ids = Array.isArray(e.branchIds) ? e.branchIds.map(Number).filter(Number.isFinite) : [];
    const pb = Number(e.payrollBranchId);
    return {
      key: `e${e.id}`,
      id: e.id,
      name: String(e.name ?? "").trim(),
      branchId: Number.isFinite(pb) && pb > 0 ? pb : (ids[0] ?? null),
      turi: String(e.turi ?? ""),
      roleName: e.centerRoleId != null ? (roleName.get(Number(e.centerRoleId)) ?? "") : "",
      groups: e.turi === "teacher" ? (groupsBy.get(nameKey(e.name)) ?? 0) : 0,
      subject: String(e.kurs ?? "").trim(),
      workStart: String(e.workStart ?? ""),
      workEnd: String(e.workEnd ?? ""),
    };
  };

  const byId = new Map<number, RawEmployee>();
  const byName = new Map<string, RawEmployee>();
  for (const e of input.employees) {
    byId.set(Number(e.id), e);
    const k = nameKey(e.name);
    const prev = byName.get(k);
    // Ismdosh — faol (arxivda emas) xodim ustun.
    if (!prev || (prev.archReason && !e.archReason)) byName.set(k, e);
  }

  const emps = new Map<string, BpEmployee>();
  const empById = (id: number, fallbackName: string, fallbackBranch: number | null): BpEmployee => {
    const raw = byId.get(id);
    const e = raw ? toEmp(raw) : { ...emptyEmp(`e${id}`, fallbackName), id, branchId: fallbackBranch };
    if (!emps.has(e.key)) emps.set(e.key, e);
    return emps.get(e.key)!;
  };
  const empByName = (name: unknown): BpEmployee => {
    const raw = byName.get(nameKey(name));
    if (raw) return empById(raw.id, raw.name, null);
    const e = emptyEmp(`n:${nameKey(name)}`, String(name ?? "").trim() || "—");
    if (!emps.has(e.key)) emps.set(e.key, e);
    return emps.get(e.key)!;
  };

  const entries: BpEntry[] = [];
  const base = { over: 0, priority: null, due: null, by: "", cancel: null } as const;

  if (input.can.bonus) {
    for (const b of input.bonuses) {
      if (b.type !== "employee" || !inMonth(b.createdAt)) continue;
      const st = parseStamp(b.createdAt) ?? { date: "", time: "" };
      const cancelled = b.status === "cancelled";
      const amount = num(b.amount);
      entries.push({
        ...base,
        key: `b${b.id}`,
        emp: empByName(b.recipientName).key,
        kind: "bonus",
        state: cancelled ? "cancelled" : "active",
        amount,
        applied: cancelled ? 0 : amount,
        ...st,
        title: String(b.note ?? "").trim(),
        by: String(b.givenBy ?? "").trim(),
        cancel: cancelled ? { reason: String(b.reason ?? "").trim(), by: "", date: "", time: "" } : null,
      });
    }
  }

  if (input.can.penalty) {
    const fineIds = new Set(input.fines.map((f) => f.id));
    for (const p of input.penalties) {
      if (p.type !== "employee" || !inMonth(p.createdAt)) continue;
      const isTask = p.source?.kind === "staff_task";
      // Topshiriq jarimasining ko'zgusi — jarimaning o'zi (quyida) ko'rsatiladi.
      if (isTask && fineIds.has(Number(p.source?.fineId))) continue;
      const st = parseStamp(p.createdAt) ?? { date: "", time: "" };
      const cancelled = p.status === "cancelled";
      const amount = num(p.amount);
      entries.push({
        ...base,
        key: `p${p.id}`,
        emp: empByName(p.recipientName).key,
        kind: isTask ? "task" : "other",
        state: cancelled ? "cancelled" : "active",
        amount,
        applied: cancelled ? 0 : amount,
        ...st,
        title: String(p.note ?? "").trim(),
        cancel: cancelled ? { reason: String(p.reason ?? "").trim(), by: "", date: "", time: "" } : null,
      });
    }

    for (const f of input.fines) {
      if (f.month !== month) continue;
      const cancelled = f.status === "bekor";
      const amount = num(f.amount);
      const held = cancelled ? 0 : Math.max(0, Math.min(amount, num(f.held)));
      const c = uzStampOf(f.cancelledAt);
      entries.push({
        ...base,
        key: `f${f.id}`,
        emp: empById(f.employeeId, f.employeeName, f.branchId ?? null).key,
        kind: "task",
        state: cancelled ? "cancelled" : "active",
        amount,
        applied: held,
        over: cancelled ? 0 : amount - held,
        ...uzStampOf(f.failedAt),
        title: String(f.taskTitle ?? "").trim(),
        priority: Number(f.priority) || null,
        cancel: cancelled ? { reason: String(f.cancelReason ?? "").trim(), by: String(f.cancelledBy ?? "").trim(), ...c } : null,
      });
    }

    for (const t of input.pending) {
      const due = t.redeadline;
      if (!(num(t.fineAmount) > 0) || !due || uzMonthOf(ms(due)) !== month) continue;
      entries.push({
        ...base,
        key: `t${t.id}`,
        emp: empById(t.employeeId, t.employeeName, t.branchId ?? null).key,
        kind: "task",
        state: "pending",
        amount: num(t.fineAmount),
        applied: 0,
        ...uzStampOf(due),
        title: String(t.title ?? "").trim(),
        priority: Number(t.priority) || null,
        due,
      });
    }
  }

  // Filial qamrovi: oylik qaysi filialdan chiqsa — o'sha.
  const allowed = input.allowed;
  const visible = (e: BpEmployee) => (allowed === null ? true : e.branchId !== null && allowed.includes(e.branchId));
  const keep = entries.filter((x) => visible(emps.get(x.emp)!));
  const used = new Set(keep.map((x) => x.emp));
  keep.sort((a, b) => `${a.date} ${a.time} ${a.key}`.localeCompare(`${b.date} ${b.time} ${b.key}`));

  return {
    month,
    limitPercent: input.limitPercent,
    can: input.can,
    branches: input.branches.map((b) => ({ id: Number(b.id), name: String(b.name ?? "") })),
    employees: [...emps.values()].filter((e) => used.has(e.key)),
    entries: keep,
  };
}

function emptyEmp(key: string, name: string): BpEmployee {
  return { key, id: null, name, branchId: null, turi: "", roleName: "", groups: 0, subject: "", workStart: "", workEnd: "" };
}

/* ───────────────────────── Yig'ish (sahifa va eksport) ───────────────────────── */

export interface BpTotals {
  bonus: number;
  bonusN: number;
  /** Ushlanadigan topshiriq jarimasi (`held`). */
  task: number;
  taskN: number;
  other: number;
  otherN: number;
  over: number;
  overN: number;
  pending: number;
  pendingN: number;
  cancelled: number;
  cancelledN: number;
  /** bonus − task − other. */
  effect: number;
}

export function emptyTotals(): BpTotals {
  return { bonus: 0, bonusN: 0, task: 0, taskN: 0, other: 0, otherN: 0, over: 0, overN: 0, pending: 0, pendingN: 0, cancelled: 0, cancelledN: 0, effect: 0 };
}

export function addEntry(t: BpTotals, e: BpEntry): void {
  if (e.state === "cancelled") {
    t.cancelled += e.amount;
    t.cancelledN++;
    return;
  }
  if (e.state === "pending") {
    t.pending += e.amount;
    t.pendingN++;
    return;
  }
  if (e.kind === "bonus") {
    t.bonus += e.applied;
    t.bonusN++;
    t.effect += e.applied;
    return;
  }
  if (e.kind === "task") {
    t.task += e.applied;
    t.taskN++;
  } else {
    t.other += e.applied;
    t.otherN++;
  }
  t.effect -= e.applied;
  if (e.over > 0) {
    t.over += e.over;
    t.overN++;
  }
}

export function totalsOf(entries: readonly BpEntry[]): BpTotals {
  const t = emptyTotals();
  for (const e of entries) addEntry(t, e);
  return t;
}

export type BpStateFilter = "" | "active" | "over" | "pending" | "cancelled";

export interface BpFilter {
  /** Filial (tanlov qatori — hovuz vakili); "" — hammasi. */
  branch: string;
  kind: "" | BpKind;
  state: BpStateFilter;
}

export function filterEntries(report: Pick<BpReport, "employees" | "entries">, f: BpFilter): BpEntry[] {
  const emp = new Map(report.employees.map((e) => [e.key, e]));
  const branch = Number(f.branch);
  return report.entries.filter((x) => {
    if (f.kind && x.kind !== f.kind) return false;
    if (f.state === "over" ? !(x.state === "active" && x.over > 0) : f.state && x.state !== f.state) return false;
    if (f.branch) {
      const b = emp.get(x.emp)?.branchId ?? null;
      if (b === null || !sameBranchPool(b, branch)) return false;
    }
    return true;
  });
}

export interface BpEmployeeNode {
  emp: BpEmployee;
  totals: BpTotals;
  entries: BpEntry[];
}

export interface BpBranchNode {
  branchId: number | null;
  totals: BpTotals;
  employees: BpEmployeeNode[];
}

/** Filial → xodim → yozuv (filial id bo'yicha, noma'lumi oxirida; xodimlar ism bo'yicha). */
export function groupEntries(employees: readonly BpEmployee[], entries: readonly BpEntry[]): BpBranchNode[] {
  const emp = new Map(employees.map((e) => [e.key, e]));
  const byEmp = new Map<string, BpEmployeeNode>();
  for (const x of entries) {
    const e = emp.get(x.emp);
    if (!e) continue;
    let node = byEmp.get(e.key);
    if (!node) byEmp.set(e.key, (node = { emp: e, totals: emptyTotals(), entries: [] }));
    node.entries.push(x);
    addEntry(node.totals, x);
  }
  const byBranch = new Map<number | null, BpBranchNode>();
  for (const node of byEmp.values()) {
    const b = node.emp.branchId;
    let br = byBranch.get(b);
    if (!br) byBranch.set(b, (br = { branchId: b, totals: emptyTotals(), employees: [] }));
    br.employees.push(node);
    for (const x of node.entries) addEntry(br.totals, x);
  }
  const out = [...byBranch.values()];
  for (const br of out) br.employees.sort((a, b) => a.emp.name.localeCompare(b.emp.name));
  return out.sort((a, b) => (a.branchId ?? Infinity) - (b.branchId ?? Infinity));
}
