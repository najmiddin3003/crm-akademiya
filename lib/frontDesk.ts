import type { Db } from "mongodb";
import type { CurrentUser } from "@/lib/auth";
import type { BranchScope } from "@/lib/branchScope";
import { expandBranchPools } from "@/lib/branchPools";
import { myBonus } from "@/lib/bonusKpi";
import { computeDebtors } from "@/lib/debtors";
import { HANDOVERS } from "@/lib/dailyHandover";
import { holatOf, parseFirstLesson, type HolatSource } from "@/lib/leadHolat";
import { uzDateIso, uzTimeHm } from "@/lib/uzTime";

// QABUL ADMIN VA MODERATOR ISH STOLI (46-qism, rasmlar «Qabul admin · bosh sahifa», «Moderator · qo'ng'iroq navbati va
// natija», «Moderator · natijalarim»). Kim — `hr_employees.turi = "moderator"` xodimi; qaysi ish stoli — filial
// biriktiruvidagi rol nomi: «Moderator» → qo'ng'iroq navbati, qolganlari → qabul admin. Rahbar `?as=ISM&mode=` bilan ko'radi.
//
// YANGI KOLLEKSIYA `lead_calls` — har qo'ng'iroq natijasi: {id, date, time, at, by, branchId, target: {type, id, name},
// kind, result, next, callbackAt, note}. Lid holati (bog'lanildi, birinchi dars, rad) — mavjud /api/orders/:id/holat
// orqali (mijoz chaqiradi), bu yerda faqat jurnal.

export const LEAD_CALLS = "lead_calls";

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
/** «08.11.2026 | 10:15» → {date, time}. */
function createdOf(o: Record<string, unknown>): { date: string; time: string } | null {
  const raw = String(o.createdAt ?? o.created ?? "");
  const m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s*\|\s*(\d{2}:\d{2}))?/.exec(raw);
  if (m) return { date: `${m[3]}-${m[2]}-${m[1]}`, time: m[4] ?? "00:00" };
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return { date: raw.slice(0, 10), time: raw.slice(11, 16) || "00:00" };
  return null;
}
/** Hozirdan oldingi daqiqalar (Toshkent): sana + vaqt. */
const minutesSince = (date: string, time: string, today: string, now: string) => {
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400_000);
  return days * 1440 + toMin(now) - toMin(time);
};

export type FrontMode = "admin" | "moderator";
export interface FrontWho {
  name: string;
  employeeId: number | null;
  branchIds: number[];
  mode: FrontMode;
  preview: boolean;
}

export async function resolveFront(db: Db, user: CurrentUser, as?: string | null, modeArg?: string | null): Promise<FrontWho | null> {
  const emps = await db.collection("hr_employees").find({ turi: "moderator" }, { projection: { _id: 0, id: 1, name: 1, branchIds: 1, branchAssignments: 1 } }).toArray();
  const roles = await db.collection("roles").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray();
  const modeOf = (e: Record<string, unknown>): FrontMode => {
    const ids = ((e.branchAssignments as { roleId?: number | null }[]) ?? []).map((a) => Number(a.roleId)).filter(Boolean);
    return ids.some((id) => /moderator/i.test(String(roles.find((r) => Number(r.id) === id)?.name ?? ""))) ? "moderator" : "admin";
  };
  const pick = (e: Record<string, unknown>, preview: boolean): FrontWho => ({
    name: String(e.name ?? "").trim(),
    employeeId: Number(e.id),
    branchIds: expandBranchPools(((e.branchIds as number[]) ?? []).map(Number).filter(Boolean).length ? (e.branchIds as number[]).map(Number) : [1]),
    mode: modeArg === "moderator" || modeArg === "admin" ? (modeArg as FrontMode) : modeOf(e),
    preview,
  });
  if (user.role === "admin") {
    const e = as ? emps.find((x) => norm(x.name) === norm(as)) : emps[0];
    return e ? pick(e, true) : null;
  }
  if (user.hrEmployeeId === null) return null;
  const e = emps.find((x) => Number(x.id) === user.hrEmployeeId);
  return e ? pick(e, false) : null;
}

const scopeOf = (who: FrontWho): BranchScope => ({ branchId: who.branchIds[0] ?? 1, allowed: who.branchIds }) as BranchScope;

interface LeadLite {
  id: number;
  name: string;
  phone: string;
  course: string;
  source: string;
  holat: string;
  created: { date: string; time: string } | null;
  firstLesson: { sana: string; vaqt: string } | null;
  firstLessonStatus: string;
  firstLessonGroupId: number | null;
  reminder: string | null;
  refName: string;
  teacher: string;
}

async function loadLeads(db: Db, branchIds: number[], since: string): Promise<LeadLite[]> {
  const rows = await db
    .collection("orders")
    .find({ branchId: { $in: branchIds }, archived: { $ne: true } }, { projection: { _id: 0, holatTarix: 0, history: 0 } })
    .toArray();
  const pupils = await db
    .collection("pupils")
    .find({ id: { $in: rows.map((r) => Number(r.referralPupilId)).filter(Boolean) } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1 } })
    .toArray();
  return rows
    .map((o) => {
      const fl = parseFirstLesson(String(o.firstLesson ?? ""));
      const ref = pupils.find((p) => Number(p.id) === Number(o.referralPupilId));
      return {
        id: Number(o.id),
        name: String(o.name ?? ""),
        phone: String(o.phone ?? ""),
        course: String(o.course ?? ""),
        source: String(o.source ?? ""),
        holat: holatOf(o as unknown as HolatSource),
        created: createdOf(o),
        firstLesson: fl,
        firstLessonStatus: String(o.firstLessonStatus ?? ""),
        firstLessonGroupId: Number(o.firstLessonGroupId) || null,
        reminder: (o.firstLessonReminder as { result?: string } | undefined)?.result ?? null,
        refName: ref ? `${ref.firstName ?? ""} ${ref.lastName ?? ""}`.trim() : "",
        teacher: String(o.teacher ?? ""),
      };
    })
    // Ismsiz yozuvlar (kampaniya statistikasi uchun yaratilgan qoralamalar) navbatga tushmaydi.
    .filter((l) => l.name.trim() && ((l.created?.date ?? "9999") >= since || (l.firstLesson?.sana ?? "") >= since));
}

async function groupsById(db: Db, ids: number[]) {
  const gs = ids.length ? await db.collection("groups").find({ id: { $in: ids } }, { projection: { _id: 0, id: 1, name: 1, course: 1, level: 1, teacher: 1, room: 1, time: 1 } }).toArray() : [];
  return new Map(gs.map((g) => [Number(g.id), g]));
}

// ─────────────────────────────── Qabul admin ───────────────────────────────

export async function adminHome(db: Db, who: FrontWho) {
  const today = uzDateIso();
  const now = uzTimeHm();
  const scope = scopeOf(who);
  const [leads, calls, debt, cashbox, bonus, staffTasks] = await Promise.all([
    loadLeads(db, who.branchIds, addDays(today, -14)),
    db.collection(LEAD_CALLS).find({ "target.type": "lead", date: { $gte: addDays(today, -14) } }, { projection: { _id: 0, "target.id": 1, date: 1, time: 1 } }).toArray(),
    computeDebtors(db, scope, today).catch(() => null),
    db.collection("cashboxes").findOne({ archived: { $ne: true }, moderator: { $regex: `^${who.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }, { projection: { _id: 0 } }),
    myBonus(db, scope, who.name).catch(() => null),
    who.employeeId !== null
      ? db.collection("staff_tasks").find({ employeeId: who.employeeId, status: { $in: ["yangi", "qaytarildi", "muddati_otdi"] } }, { projection: { _id: 0, id: 1, title: 1, deadline: 1 } }).limit(5).toArray()
      : [],
  ]);
  const called = new Set(calls.map((c) => Number((c.target as { id: number }).id)));

  const unanswered = leads
    .filter((l) => l.holat === "yangi" && !called.has(l.id) && l.created)
    .map((l) => ({ ...l, waitMin: minutesSince(l.created!.date, l.created!.time, today, now) }))
    .sort((a, b) => b.waitMin - a.waitMin);
  const fl = leads
    .filter((l) => l.holat === "sinov" && l.firstLesson && l.firstLesson.sana >= today && l.firstLesson.sana <= addDays(today, 2))
    .sort((a, b) => `${a.firstLesson!.sana}${a.firstLesson!.vaqt}`.localeCompare(`${b.firstLesson!.sana}${b.firstLesson!.vaqt}`));
  const gmap = await groupsById(db, fl.map((l) => l.firstLessonGroupId).filter((x): x is number => !!x));

  const debtors = (debt?.rows ?? []).filter((r) => r.debt > 0);
  const old = debtors.filter((r) => (r.unpaid?.count ?? 0) >= 2);

  // Kassam: balans, oxirgi topshiruv, bugungi amallar.
  let cash: null | { id: number; name: string; balance: number; byMethod: { key: string; name: string; sum: number }[]; lastHandover: { date: string; time: string } | null; daysSince: number | null; since: number; today: { id: number; who: string; label: string; method: string; time: string; amount: number }[] } = null;
  if (cashbox) {
    const id = Number(cashbox.id);
    const [last, methods, ops] = await Promise.all([
      db.collection(HANDOVERS).find({ cashboxId: id }, { projection: { _id: 0, date: 1, time: 1 } }).sort({ date: -1, time: -1 }).limit(1).toArray(),
      db.collection("settings_payment_methods").find({}, { projection: { _id: 0, key: 1, name: 1 } }).toArray(),
      db.collection("transaction_entries").find({ cashboxId: id, date: today, status: { $ne: "cancelled" } }, { projection: { _id: 0, id: 1, studentName: 1, txName: 1, txType: 1, paymentType: 1, time: 1, amount: 1 } }).sort({ time: -1 }).limit(8).toArray(),
    ]);
    const lh = last[0] ? { date: String(last[0].date), time: String(last[0].time ?? "") } : null;
    const since = lh ? await db.collection("transaction_entries").aggregate([{ $match: { cashboxId: id, txType: "payIn", status: { $ne: "cancelled" }, date: { $gte: lh.date } } }, { $group: { _id: null, s: { $sum: "$amount" } } }]).toArray() : [];
    const mt = (cashbox.methodTotals as Record<string, number>) ?? {};
    cash = {
      id,
      name: String(cashbox.name ?? ""),
      balance: Number(cashbox.balance) || 0,
      byMethod: Object.entries(mt)
        .filter(([, v]) => Number(v))
        .map(([k, v]) => ({ key: k, name: String(methods.find((m) => m.key === k)?.name ?? k), sum: Number(v) })),
      lastHandover: lh,
      daysSince: lh ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lh.date}T00:00:00Z`)) / 86400_000) : null,
      since: Number(since[0]?.s ?? 0),
      today: ops.map((o) => ({
        id: Number(o.id),
        who: String(o.studentName ?? ""),
        label: String(o.txName ?? ""),
        method: String(o.paymentType ?? ""),
        time: String(o.time ?? "").slice(0, 5),
        amount: o.txType === "payOut" ? -Math.abs(Number(o.amount) || 0) : Number(o.amount) || 0,
      })),
    };
  }

  return {
    today,
    now,
    who,
    branch: String((await db.collection("branches").findOne({ id: who.branchIds[0] }, { projection: { _id: 0, name: 1 } }))?.name ?? ""),
    unanswered: unanswered.slice(0, 6).map((l) => ({ id: l.id, name: l.name, course: l.course, source: l.source, refName: l.refName, created: l.created, waitMin: l.waitMin })),
    unansweredTotal: unanswered.length,
    firstLessons: fl.map((l) => {
      const g = l.firstLessonGroupId ? gmap.get(l.firstLessonGroupId) : null;
      return {
        id: l.id,
        name: l.name,
        date: l.firstLesson!.sana,
        time: l.firstLesson!.vaqt,
        group: g ? [g.course, g.level].filter(Boolean).join(" · ") || String(g.name ?? "") : l.course,
        teacher: String(g?.teacher ?? l.teacher ?? ""),
        room: String(g?.room ?? ""),
        refName: l.refName,
        reminded: !!l.reminder,
      };
    }),
    debtors: {
      count: debtors.length,
      total: debtors.reduce((a, r) => a + r.debt, 0),
      old: old.slice(0, 5).map((r) => ({ id: r.id, name: r.name, debt: r.debt, months: r.unpaid?.count ?? 0, group: r.groups[0]?.group ?? "" })),
      oldCount: old.length,
    },
    cash,
    bonus: bonus && bonus.current ? { month: bonus.month, done: bonus.current.done, target: bonus.current.target, bonus: bonus.current.total, forecast: bonus.current.forecast, kpi: bonus.kpi, perStudent: bonus.perStudent, planBonus: bonus.planBonus } : null,
    staffTasks: (staffTasks as Record<string, unknown>[]).map((x) => ({ id: Number(x.id), title: String(x.title ?? ""), deadline: String(x.deadline ?? "") })),
  };
}

// ─────────────────────────────── Qo'ng'iroq navbati ───────────────────────────────

export type CallKind = "qayta" | "yangi" | "davomat" | "birinchi_keyin" | "eslatma";
export type CallResult = "javob" | "javobsiz" | "band" | "notogri";
export type CallNext = "birinchi_dars" | "qayta" | "oylab" | "rad" | "";

export interface QueueItem {
  key: string;
  section: "shoshilinch" | "yangi" | "dars" | "eslatma";
  kind: CallKind;
  target: { type: "lead" | "pupil"; id: number; name: string };
  phone: string;
  sub: string;
  badge: string;
  dueText: string;
  overdue: boolean;
  sortKey: number;
}

export async function callQueue(db: Db, who: FrontWho) {
  const today = uzDateIso();
  const now = uzTimeHm();
  const [leads, calls] = await Promise.all([
    loadLeads(db, who.branchIds, addDays(today, -30)),
    db.collection(LEAD_CALLS).find({ branchId: { $in: who.branchIds }, date: { $gte: addDays(today, -30) } }, { projection: { _id: 0 } }).sort({ at: 1 }).toArray(),
  ]);
  const lastCall = new Map<string, Record<string, unknown>>();
  for (const c of calls) lastCall.set(`${(c.target as { type: string }).type}:${(c.target as { id: number }).id}`, c);
  const calledToday = (k: string) => String(lastCall.get(k)?.date ?? "") === today;
  const items: QueueItem[] = [];

  // 1) Qayta qo'ng'iroq: oxirgi natijada «qayta» va vaqti kelgan.
  for (const [k, c] of lastCall) {
    if (c.next !== "qayta" || !c.callbackAt) continue;
    const [d, t] = String(c.callbackAt).split("T");
    if (d > today) continue;
    const late = minutesSince(d, t || "00:00", today, now);
    const tg = c.target as { type: "lead" | "pupil"; id: number; name: string };
    items.push({
      key: k,
      section: late >= 0 ? "shoshilinch" : "yangi",
      kind: "qayta",
      target: tg,
      phone: String(c.phone ?? ""),
      sub: [String(c.subject ?? ""), String(c.note ?? "")].filter(Boolean).join(" · "),
      badge: "Qayta qo'ng'iroq",
      dueText: late >= 0 ? `${t} edi · ${fmtWait(late)} o'tdi` : `${t} da`,
      overdue: late >= 0,
      sortKey: -late,
    });
  }
  // 2) Yangi lidlar — 24 soat ichida birinchi qo'ng'iroq.
  for (const l of leads) {
    const k = `lead:${l.id}`;
    if (l.holat !== "yangi" || lastCall.has(k) || !l.created) continue;
    const wait = minutesSince(l.created.date, l.created.time, today, now);
    const left = 1440 - wait;
    items.push({
      key: k,
      section: left < 180 ? "shoshilinch" : "yangi",
      kind: "yangi",
      target: { type: "lead", id: l.id, name: l.name },
      phone: l.phone,
      sub: [l.course, l.source, l.created.date === today ? `bugun ${l.created.time}` : `${l.created.date} ${l.created.time}`].filter(Boolean).join(" · "),
      badge: "Yangi lid",
      dueText: left <= 0 ? `24 soat o'tdi` : left < 180 ? `24 soatga ${fmtWait(left)} qoldi` : fmtWait(wait),
      overdue: left <= 0,
      sortKey: left,
    });
  }
  // 3) Dars bo'yicha: bugun sababsiz kelmagan o'quvchilar; bugun birinchi darsga kelgan, hali guruhga qo'shilmagan lidlar.
  const absent = await db.collection("attendance").find({ date: today, status: "sababsiz" }, { projection: { _id: 0, pupilId: 1, groupId: 1 } }).toArray();
  if (absent.length) {
    const [pupils, gmap] = await Promise.all([
      db.collection("pupils").find({ id: { $in: absent.map((a) => Number(a.pupilId)) }, branchId: { $in: who.branchIds } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, fatherPhone: 1, motherPhone: 1 } }).toArray(),
      groupsById(db, absent.map((a) => Number(a.groupId))),
    ]);
    for (const a of absent) {
      const p = pupils.find((x) => Number(x.id) === Number(a.pupilId));
      if (!p) continue;
      const k = `pupil:${p.id}`;
      if (calledToday(k)) continue;
      const g = gmap.get(Number(a.groupId));
      items.push({
        key: k,
        section: "dars",
        kind: "davomat",
        target: { type: "pupil", id: Number(p.id), name: `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() },
        phone: String(p.motherPhone || p.fatherPhone || p.phone || ""),
        sub: [g ? [g.course, g.level].filter(Boolean).join(" · ") : "", String(g?.time ?? "").split("-")[0], "ota-onasiga"].filter(Boolean).join(" · "),
        badge: "Darsga kelmadi",
        dueText: "bugun",
        overdue: false,
        sortKey: 0,
      });
    }
  }
  for (const l of leads) {
    const k = `lead:${l.id}`;
    if (l.holat !== "sinov" || l.firstLesson?.sana !== today || l.firstLessonStatus !== "KELDI" || calledToday(k)) continue;
    items.push({ key: k, section: "dars", kind: "birinchi_keyin", target: { type: "lead", id: l.id, name: l.name }, phone: l.phone, sub: [l.course, `birinchi dars ${l.firstLesson.vaqt}`, "keldi, hali to'lamadi"].join(" · "), badge: "Birinchi darsdan keyin", dueText: "o'sha kuni", overdue: false, sortKey: 1 });
  }
  // 4) Eslatmalar: ertangi birinchi darsga — eslatilmaganlar.
  const tomorrow = addDays(today, 1);
  for (const l of leads) {
    const k = `lead:${l.id}`;
    if (l.holat !== "sinov" || l.firstLesson?.sana !== tomorrow || l.reminder || calledToday(k)) continue;
    items.push({ key: k, section: "eslatma", kind: "eslatma", target: { type: "lead", id: l.id, name: l.name }, phone: l.phone, sub: [`Ertaga ${l.firstLesson.vaqt} birinchi dars`, l.course].filter(Boolean).join(" · "), badge: "Eslatma", dueText: "18:00 gacha", overdue: now > "18:00", sortKey: 2 });
  }

  const order = { shoshilinch: 0, yangi: 1, dars: 2, eslatma: 3 } as const;
  items.sort((a, b) => order[a.section] - order[b.section] || a.sortKey - b.sortKey);
  const todayCalls = calls.filter((c) => c.date === today && norm(c.by) === norm(who.name));
  const answered = todayCalls.filter((c) => c.result === "javob").length;
  const firstBooked = todayCalls.filter((c) => c.next === "birinchi_dars").length;
  return {
    today,
    now,
    who,
    branch: String((await db.collection("branches").findOne({ id: who.branchIds[0] }, { projection: { _id: 0, name: 1 } }))?.name ?? ""),
    items,
    stats: { calls: todayCalls.length, answered, answeredPct: todayCalls.length ? Math.round((answered / todayCalls.length) * 100) : null, firstBooked, queue: items.length, urgent: items.filter((i) => i.section === "shoshilinch").length, firstCallAt: todayCalls[0] ? String(todayCalls[0].time) : null },
    recent: [...todayCalls].reverse().slice(0, 8).map(callRow),
  };
}

function fmtWait(min: number) {
  const m = Math.abs(min);
  if (m < 60) return `${m} daq`;
  const h = Math.floor(m / 60);
  if (h < 48) return m % 60 ? `${h} soat ${m % 60} daq` : `${h} soat`;
  return `${Math.floor(h / 24)} kun`;
}

const callRow = (c: Record<string, unknown>) => ({
  id: Number(c.id),
  time: String(c.time ?? ""),
  date: String(c.date ?? ""),
  name: String((c.target as { name: string }).name ?? ""),
  type: String((c.target as { type: string }).type ?? ""),
  kind: String(c.kind ?? ""),
  subject: String(c.subject ?? ""),
  result: String(c.result ?? ""),
  next: String(c.next ?? ""),
  nextText: String(c.nextText ?? ""),
  note: String(c.note ?? ""),
});

const RESULTS: CallResult[] = ["javob", "javobsiz", "band", "notogri"];
const NEXTS: CallNext[] = ["birinchi_dars", "qayta", "oylab", "rad", ""];
const KINDS: CallKind[] = ["qayta", "yangi", "davomat", "birinchi_keyin", "eslatma"];

export async function saveCall(db: Db, who: FrontWho, b: Record<string, unknown>): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const t = (b.target ?? {}) as Record<string, unknown>;
  const type = t.type === "pupil" ? "pupil" : t.type === "lead" ? "lead" : null;
  const id = Number(t.id);
  if (!type || !Number.isFinite(id)) return { ok: false, error: "Kimga qo'ng'iroq — noma'lum" };
  const result = RESULTS.includes(b.result as CallResult) ? (b.result as CallResult) : null;
  if (!result) return { ok: false, error: "Natijani tanlang" };
  const next = NEXTS.includes(b.next as CallNext) ? (b.next as CallNext) : "";
  const kind = KINDS.includes(b.kind as CallKind) ? (b.kind as CallKind) : type === "lead" ? "yangi" : "davomat";
  const callbackAt = next === "qayta" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(b.callbackAt ?? "")) ? String(b.callbackAt) : null;
  if (next === "qayta" && !callbackAt) return { ok: false, error: "Qayta qo'ng'iroq vaqtini tanlang" };
  const doc = type === "lead" ? await db.collection("orders").findOne({ id, branchId: { $in: who.branchIds } }, { projection: { _id: 0, name: 1, phone: 1, course: 1, branchId: 1 } }) : await db.collection("pupils").findOne({ id, branchId: { $in: who.branchIds } }, { projection: { _id: 0, firstName: 1, lastName: 1, phone: 1, branchId: 1 } });
  if (!doc) return { ok: false, error: "Topilmadi yoki boshqa filialda" };
  const last = await db.collection(LEAD_CALLS).find({}, { projection: { _id: 0, id: 1 } }).sort({ id: -1 }).limit(1).toArray();
  const callId = (Number(last[0]?.id) || 0) + 1;
  const today = uzDateIso();
  await db.collection(LEAD_CALLS).insertOne({
    id: callId,
    date: today,
    time: uzTimeHm(),
    at: new Date().toISOString(),
    by: who.name,
    byId: who.employeeId,
    branchId: Number(doc.branchId) || who.branchIds[0],
    target: { type, id, name: type === "lead" ? String(doc.name ?? "") : `${doc.firstName ?? ""} ${doc.lastName ?? ""}`.trim() },
    phone: String(doc.phone ?? ""),
    subject: type === "lead" ? String(doc.course ?? "") : "",
    kind,
    result,
    next,
    callbackAt,
    nextText: String(b.nextText ?? "").slice(0, 120),
    note: String(b.note ?? "").trim().slice(0, 500),
  });
  // Eslatma qo'ng'irog'i — lid kartasidagi «eslatildi» belgisi (ro'yxatlar shu bilan ishlaydi).
  if (type === "lead" && kind === "eslatma" && result === "javob") {
    await db.collection("orders").updateOne({ id }, { $set: { firstLessonReminder: { result: "tasdiqladi", at: new Date().toISOString(), by: who.name } } });
  }
  return { ok: true, id: callId };
}

// ─────────────────────────────── Natijalarim ───────────────────────────────

export async function myCallStats(db: Db, who: FrontWho, period: "bugun" | "hafta" | "oy") {
  const today = uzDateIso();
  const month = today.slice(0, 7);
  const from = period === "bugun" ? today : period === "hafta" ? addDays(today, -6) : `${month}-01`;
  const mine = (await db.collection(LEAD_CALLS).find({ date: { $gte: from, $lte: today } }, { projection: { _id: 0 } }).sort({ at: 1 }).toArray()).filter((c) => norm(c.by) === norm(who.name));
  const answered = mine.filter((c) => c.result === "javob").length;
  const booked = mine.filter((c) => c.next === "birinchi_dars");
  const bookedIds = [...new Set(booked.map((c) => Number((c.target as { id: number }).id)))];
  const bookedLeads = bookedIds.length ? await db.collection("orders").find({ id: { $in: bookedIds } }, { projection: { _id: 0, id: 1, firstLessonStatus: 1, holat: 1, groupId: 1 } }).toArray() : [];
  const came = bookedLeads.filter((o) => ["KELDI", "GURUHGA_QOSHILDI"].includes(String(o.firstLessonStatus))).length;
  const paid = bookedLeads.filter((o) => holatOf(o as unknown as HolatSource) === "guruh").length;

  // Yangi lidga 24 soat ichida: davrdagi o'z filiali yangi lidlari — birinchi qo'ng'irog'i 24 soat ichida bo'lganlari.
  const leads = await loadLeads(db, who.branchIds, from);
  const fresh = leads.filter((l) => l.created && l.created.date >= from);
  const allCalls = await db.collection(LEAD_CALLS).find({ "target.type": "lead", "target.id": { $in: fresh.map((l) => l.id) } }, { projection: { _id: 0, "target.id": 1, date: 1, time: 1 } }).sort({ at: 1 }).toArray();
  const within = fresh.filter((l) => {
    const c = allCalls.find((x) => Number((x.target as { id: number }).id) === l.id);
    return c && minutesSince(l.created!.date, l.created!.time, String(c.date), String(c.time)) <= 1440;
  }).length;

  const days: { date: string; n: number }[] = [];
  for (let d = from; d <= today; d = addDays(d, 1)) days.push({ date: d, n: mine.filter((c) => c.date === d).length });
  const kinds = KINDS.map((k) => ({ kind: k, n: mine.filter((c) => c.kind === k).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const absentCalls = mine.filter((c) => c.kind === "davomat");
  const afterFirst = mine.filter((c) => c.kind === "birinchi_keyin");
  return {
    today,
    period,
    from,
    who,
    branch: String((await db.collection("branches").findOne({ id: who.branchIds[0] }, { projection: { _id: 0, name: 1 } }))?.name ?? ""),
    kpi: { calls: mine.length, answered, answeredPct: mine.length ? Math.round((answered / mine.length) * 100) : null, fresh: fresh.length, within24: within, booked: bookedIds.length, came, paid },
    days,
    kinds,
    rules: [
      { name: "Yangi lidga 24 soat ichida qo'ng'iroq", done: within, total: fresh.length },
      { name: "Birinchi darsdan keyin — o'sha kuni", done: afterFirst.length, total: afterFirst.length },
      { name: "Darsga kelmaganga — dars kuni", done: absentCalls.length, total: absentCalls.length },
    ],
    recent: [...mine].reverse().slice(0, 12).map(callRow),
  };
}
