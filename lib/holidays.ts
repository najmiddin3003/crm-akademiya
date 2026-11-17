import type { Db } from "mongodb";
import { branchInCondition } from "@/lib/branchScope";
import { groupWeekdays } from "@/lib/attendance";
import { sendToStudent } from "@/lib/studentBot/api";
import { isStudentBotReady, loadStudentBotConfig } from "@/lib/studentBot/config";
import { chatsForPupil } from "@/lib/studentBot/users";
import { uzDateIso } from "@/lib/uzTime";
import type { Holiday, HolidayKind, HolidayRow, HolidaysPayload, WorkWeek } from "@/lib/holidayTypes";

// ISH KUNLARI VA BAYRAMLAR (37-qism). `holidays` — dam olish kunlari (nomi, boshlanish–tugash, turi, filiallar,
// ota-onalarga xabar). Shu kunlarda «Davomat nazorati» darsni kutmaydi (lib/attendanceControl.ts → isHoliday).
// Oylik to'lov o'zgarmaydi. Davlat bayramlarining sanasi o'zgarmaydiganlari har o'quv yili o'zi qo'shiladi;
// diniy bayramlar (oy kalendari) — qo'lda, «taxminiy» belgisi bilan. Ish haftasi — `app_settings` («work_week»).

export const HOLIDAYS = "holidays";
const FIXED: [string, string][] = [
  ["09-01", "Mustaqillik kuni"],
  ["10-01", "O'qituvchi va murabbiylar kuni"],
  ["12-08", "Konstitutsiya kuni"],
  ["01-01", "Yangi yil"],
  ["03-08", "Xotin-qizlar kuni"],
  ["03-21", "Navro'z"],
  ["05-09", "Xotira va qadrlash kuni"],
];
const DEFAULT_WEEK: WorkWeek = { days: [1, 2, 3, 4, 5, 6], from: "08:00", to: "22:00" };

const addDays = (iso: string, n: number) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n)).toISOString().slice(0, 10);
const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
/** O'quv yili: sentabrdan avgustgacha («2026» — 2026–2027). */
export const studyYearOf = (iso: string) => (Number(iso.slice(5, 7)) >= 9 ? Number(iso.slice(0, 4)) : Number(iso.slice(0, 4)) - 1);

async function ensureYear(db: Db, y: number) {
  const col = db.collection<Holiday>(HOLIDAYS);
  const meta = db.collection("app_meta");
  const key = `holidays_auto_${y}`;
  if (await meta.findOne({ key })) return;
  await meta.updateOne({ key }, { $set: { key, at: new Date().toISOString() } }, { upsert: true });
  let id = Number((await col.find({}).sort({ id: -1 }).limit(1).toArray())[0]?.id) || 0;
  for (const [md, name] of FIXED) {
    const date = `${Number(md.slice(0, 2)) >= 9 ? y : y + 1}-${md}`;
    if (await col.findOne({ from: date, name })) continue;
    await col.insertOne({ id: ++id, name, from: date, to: date, kind: "davlat", approx: false, branchIds: null, auto: true, notifyParents: true });
  }
}

export async function workWeek(db: Db): Promise<WorkWeek> {
  const d = await db.collection("app_settings").findOne({ key: "work_week" });
  return d ? { days: (d.days as number[]) ?? DEFAULT_WEEK.days, from: String(d.from ?? DEFAULT_WEEK.from), to: String(d.to ?? DEFAULT_WEEK.to) } : DEFAULT_WEEK;
}

/** Davomat nazorati uchun: shu filialda shu kun dam olishmi. */
export async function holidayChecker(db: Db, from: string, to: string): Promise<(branchId: number, iso: string) => boolean> {
  const list = await db.collection<Holiday>(HOLIDAYS).find({ from: { $lte: to }, to: { $gte: from } }, { projection: { _id: 0, from: 1, to: 1, branchIds: 1 } }).toArray();
  return (b, iso) => list.some((h) => iso >= h.from && iso <= h.to && (!h.branchIds || h.branchIds.includes(b)));
}

type G = { id: number; branchId?: number; day?: string; studentIds?: number[]; status?: string };

function impact(h: Holiday, groups: G[], bName: Map<number, string>) {
  const hit = new Map<number, number>();
  for (let iso = h.from; iso <= h.to; iso = addDays(iso, 1)) {
    const wd = weekday(iso);
    for (const g of groups) {
      const b = Number(g.branchId) || 1;
      if (h.branchIds && !h.branchIds.includes(b)) continue;
      if (groupWeekdays(g.day).includes(wd)) hit.set(g.id, (hit.get(g.id) ?? 0) + 1);
    }
  }
  const gs = groups.filter((g) => hit.has(g.id));
  const byB = new Map<string, number>();
  for (const g of gs) {
    const n = bName.get(Number(g.branchId) || 1) ?? "—";
    byB.set(n, (byB.get(n) ?? 0) + 1);
  }
  return {
    groups: gs.length,
    lessons: [...hit.values()].reduce((a, b) => a + b, 0),
    pupils: new Set(gs.flatMap((g) => g.studentIds ?? [])).size,
    byBranch: [...byB.entries()].map(([name, n]) => ({ name, groups: n })),
  };
}

export async function holidaysPage(db: Db, branchIds: number[]): Promise<HolidaysPayload> {
  const today = uzDateIso();
  const y = studyYearOf(today);
  await ensureYear(db, y);
  const start = `${y}-09-01`;
  const end = `${y + 1}-08-31`;
  const [list, groupsRaw, branches, week] = await Promise.all([
    db.collection<Holiday>(HOLIDAYS).find({ to: { $gte: start }, from: { $lte: end } }, { projection: { _id: 0 } }).sort({ from: 1 }).toArray(),
    db.collection("groups").find(branchInCondition(branchIds), { projection: { _id: 0, id: 1, branchId: 1, day: 1, studentIds: 1, status: 1 } }).toArray(),
    db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray(),
    workWeek(db),
  ]);
  const groups = (groupsRaw as unknown as G[]).filter((g) => !["archived", "closed", "arxiv"].includes(String(g.status ?? "")));
  const bName = new Map(branches.map((b) => [Number(b.id), String(b.name)]));
  const rows: HolidayRow[] = list
    .filter((h) => !h.branchIds || h.branchIds.some((b) => branchIds.includes(b)))
    .map((h) => ({ ...h, days: Math.round((Date.parse(h.to) - Date.parse(h.from)) / 86_400_000) + 1, ...impact(h, groups, bName) }));
  return {
    ok: true,
    year: `${y}–${y + 1}`,
    today,
    week,
    oddGroups: groups.filter((g) => String(g.day ?? "").toLowerCase() === "toq kunlar").length,
    evenGroups: groups.filter((g) => String(g.day ?? "").toLowerCase() === "juft kunlar").length,
    rows,
    branches: branches.filter((b) => branchIds.includes(Number(b.id))).map((b) => ({ id: Number(b.id), name: String(b.name) })),
  };
}

export async function saveHoliday(db: Db, b: Record<string, unknown>, by: string) {
  const col = db.collection<Holiday>(HOLIDAYS);
  if (b.id && b.delete) {
    await col.deleteOne({ id: Number(b.id) });
    return { ok: true as const };
  }
  const name = String(b.name ?? "").trim().slice(0, 80);
  if (!name) return { ok: false as const, error: "Nomini yozing" };
  const from = String(b.from ?? "");
  const to = String(b.to ?? from);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return { ok: false as const, error: "Sanalar noto'g'ri" };
  if (Date.parse(to) - Date.parse(from) > 60 * 86_400_000) return { ok: false as const, error: "Ko'pi bilan 60 kun" };
  const kind = (["davlat", "diniy", "markaz"].includes(String(b.kind)) ? b.kind : "markaz") as HolidayKind;
  const branchIds = Array.isArray(b.branchIds) && b.branchIds.length ? (b.branchIds as unknown[]).map(Number).filter((n) => n > 0) : null;
  const fields = { name, from, to, kind, approx: !!b.approx, branchIds, notifyParents: b.notifyParents !== false };
  if (b.id) {
    await col.updateOne({ id: Number(b.id) }, { $set: fields });
    return { ok: true as const };
  }
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  await col.insertOne({ id: (Number(last[0]?.id) || 0) + 1, ...fields, createdBy: by });
  return { ok: true as const };
}

export async function saveWeek(db: Db, w: Partial<WorkWeek>) {
  const cur = await workWeek(db);
  const days = Array.isArray(w.days) ? [...new Set(w.days.map(Number).filter((d) => d >= 0 && d <= 6))].sort() : cur.days;
  if (!days.length) return { ok: false as const, error: "Kamida bitta ish kuni kerak" };
  const hm = (v: unknown, d: string) => (/^\d{2}:\d{2}$/.test(String(v)) ? String(v) : d);
  await db.collection("app_settings").updateOne({ key: "work_week" }, { $set: { key: "work_week", days, from: hm(w.from, cur.from), to: hm(w.to, cur.to) } }, { upsert: true });
  return { ok: true as const };
}

/** Ota-onalarga xabar (bot orqali) — darsi o'tmaydigan o'quvchilarga, bir marta. */
export async function notifyHoliday(db: Db, id: number, branchIds: number[]) {
  const h = await db.collection<Holiday>(HOLIDAYS).findOne({ id });
  if (!h) return { ok: false as const, error: "Topilmadi" };
  const cfg = loadStudentBotConfig();
  if (!isStudentBotReady(cfg)) return { ok: false as const, error: "Talabalar boti sozlanmagan" };
  const groups = (await db.collection("groups").find(branchInCondition(branchIds), { projection: { _id: 0, id: 1, branchId: 1, day: 1, studentIds: 1 } }).toArray()) as unknown as G[];
  const pupils = new Set<number>();
  for (let iso = h.from; iso <= h.to; iso = addDays(iso, 1))
    for (const g of groups) if ((!h.branchIds || h.branchIds.includes(Number(g.branchId) || 1)) && groupWeekdays(g.day).includes(weekday(iso))) (g.studentIds ?? []).forEach((p) => pupils.add(Number(p)));
  const when = h.from === h.to ? h.from.split("-").reverse().join(".") : `${h.from.split("-").reverse().join(".")} – ${h.to.split("-").reverse().join(".")}`;
  const html = `📅 <b>${when} — ${h.name.replace(/[<>&]/g, "")}</b>\nShu kun${h.from === h.to ? "" : "lar"}i darslar bo'lmaydi. Oylik to'lov o'zgarmaydi.`;
  let sent = 0;
  for (const p of pupils) for (const chat of await chatsForPupil(db, p)) if ((await sendToStudent(cfg, chat, html)).ok) sent++;
  await db.collection(HOLIDAYS).updateOne({ id }, { $set: { notifiedAt: new Date().toISOString(), notifiedCount: sent } });
  return { ok: true as const, sent, pupils: pupils.size };
}
