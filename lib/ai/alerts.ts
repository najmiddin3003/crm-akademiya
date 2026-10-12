import type { Db } from "mongodb";
import { AI, isDupKey } from "./db";
import type { AiAlert } from "./protocol";
import { holatOf, type HolatSource } from "@/lib/leadHolat";
import { uzWallToMs } from "@/lib/staffTasks";
import { groupBoundsIso, holdsRoom } from "@/lib/groupRules";
import { groupLabel } from "@/lib/groups";
import { branchPool } from "@/lib/branchPools";
import { uzDateIso } from "@/lib/uzTime";

// ADMINGA OGOHLANTIRISHLAR — AI yordamchi o'zi aytadi (12.10.2026).
//
// Foydalanuvchi: «yordamchiga qo'shimcha vazifalar yuklatamiz: lidlarga
// biriktirilgan xodim lidlar bilan shug'ullanmasa va 24 soatdan oshdi deb
// ko'rsatib turaversa — adminga xabar bersin; bo'shagan xonalarni bo'shashi
// bilan aytsin; guruh vaqti tugagan bo'lsa ham xabar bersin; berilgan
// topshiriqlarni xodimlar bajaryaptimi — qarasin, muddatidan avval
// topshirilsa: «siz # soat oldin bergan topshirig'ingizni ### xodimingiz
// muddatidan avval topshirdi, bir ko'rasizmi afandim, mana link»».
// Tanlovlar: xabar CRM ichida, AI panelida (Telegram emas); «guruh vaqti» —
// O'QISH MUDDATI (tugash sanasi) o'tgani.
//
// FON TAYMERI YO'Q (25.09 da fon o'lchagich «ortiqcha yuklama» deb rad
// etilgan): hisob faqat admin saytni ochiq tutganda, panel so'raganda
// (components/ai/useAiAlerts.ts, 2 daqiqada bir, sahifa ko'rinmasa — yo'q).
// Model (LLM) chaqirilmaydi — kunlik limitga tegmaydi; matn mijozda t().
//
// TURLAR:
//   lead-overdue  — holati «yangi» va kelganiga 24 soatdan oshgan lidlar,
//                   mas'ul xodim bo'yicha (LeadsPage dagi «24 soatdan oshdi»);
//   group-ended   — arxivlanmagan guruhning o'qish muddati (tugash sanasi) o'tgan;
//   room-freed    — xona vaqti bo'shadi: guruh arxivlandi / boshqa xonaga
//                   ko'chdi / vaqti o'zgardi / muddati tugadi. HODISA — oldingi
//                   bandlik surati bilan solishtiriladi (`ai_alert_state`);
//   task-early    — xodim topshiriqni muddatidan avval topshirdi (oxirgi 7 kun);
//   task-overdue  — topshiriq muddati o'tdi, bajarilmagan.
//
// KALIT holat o'zgarsa o'zgaradi (yangi lid kechiksa, tugash sanasi
// uzaytirilsa …) — ko'rilgan xabar shu holatda takrorlanmaydi.

const HOUR_MS = 3_600_000;
const LEAD_LATE_MS = 24 * HOUR_MS;
/** Hodisa turidagi xabarlar (bo'shagan xona, avval topshirilgan topshiriq) shuncha kun ko'rinadi. */
const RECENT_MS = 7 * 24 * HOUR_MS;
const MAX_ALERTS = 40;

const hours = (msValue: number) => Math.max(0, Math.round(msValue / HOUR_MS));
const msOf = (iso: unknown) => {
  const t = Date.parse(String(iso ?? ""));
  return Number.isFinite(t) ? t : NaN;
};
const nameKey = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const ddmmyyyy = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : iso);

/** Lid yaratilgan vaqt: "DD.MM.YYYY | HH:MM" (Toshkent) → ms. */
export function leadCreatedMs(created: unknown): number {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})\D+(\d{1,2}):(\d{2})/.exec(String(created ?? "").trim());
  return m ? uzWallToMs(`${m[3]}-${m[2]}-${m[1]}`, `${m[4].padStart(2, "0")}:${m[5]}`) : NaN;
}

type Draft = Omit<AiAlert, "seen">;

// ── 1. LIDLAR ─────────────────────────────────────────────────────────────

interface LeadRow extends HolatSource {
  id: number;
  created?: string;
  moderator?: string;
}

/** Sof: 24 soatdan oshgan «yangi» lidlar, mas'ul xodim bo'yicha bitta xabar. */
export function leadAlerts(rows: readonly LeadRow[], nowMs: number): Draft[] {
  const by = new Map<string, { name: string; n: number; oldest: number; newest: number; maxId: number }>();
  for (const o of rows) {
    if (holatOf(o) !== "yangi") continue;
    const at = leadCreatedMs(o.created);
    if (!Number.isFinite(at) || nowMs - at <= LEAD_LATE_MS) continue;
    const name = String(o.moderator ?? "").trim();
    const k = nameKey(name);
    const cur = by.get(k) ?? { name, n: 0, oldest: at, newest: at, maxId: 0 };
    cur.n++;
    cur.oldest = Math.min(cur.oldest, at);
    cur.newest = Math.max(cur.newest, at);
    cur.maxId = Math.max(cur.maxId, Number(o.id) || 0);
    by.set(k, cur);
  }
  return [...by.entries()].map(([k, v]) => ({
    key: `lead-overdue:${k || "-"}:${v.maxId}`,
    kind: "lead-overdue",
    at: new Date(v.newest + LEAD_LATE_MS).toISOString(),
    params: { name: v.name, n: v.n, ageH: hours(nowMs - v.oldest) },
    href: "/orders-list",
  }));
}

// ── 2. GURUHLAR va 3. XONALAR ─────────────────────────────────────────────

interface GroupRow {
  id: number;
  name?: string;
  course?: string;
  teacher?: string;
  room?: string;
  day?: string;
  time?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  period?: string;
  branchId?: number;
}

/** Guruh yorlig'i (lib/groups.ts → groupLabel). */
function labelOf(g: GroupRow): string {
  const name = g.name ?? "";
  const course = g.course ?? "";
  return groupLabel({ id: g.id, name, course });
}

/** Sof: o'qish muddati (tugash sanasi) o'tgan, arxivlanmagan guruhlar. */
export function groupAlerts(groups: readonly GroupRow[], todayIso: string): Draft[] {
  const out: Draft[] = [];
  for (const g of groups) {
    if (g.status === "archive") continue;
    const { end } = groupBoundsIso(g);
    if (!end || end >= todayIso) continue;
    out.push({
      key: `group-ended:${g.id}:${end}`,
      kind: "group-ended",
      at: new Date(Date.parse(`${end}T23:59:00+05:00`)).toISOString(),
      params: { group: labelOf(g), end: ddmmyyyy(end), teacher: String(g.teacher ?? "") },
      href: `/groups/${g.id}`,
    });
  }
  return out;
}

/** Xonadagi bitta band vaqt — surat bo'lagi. */
export interface RoomSlot {
  pool: number;
  room: string;
  groupId: number;
  label: string;
  day: string;
  time: string;
}

export const slotKey = (s: Pick<RoomSlot, "pool" | "room" | "groupId" | "day" | "time">) =>
  [s.pool, nameKey(s.room), s.groupId, s.day.trim(), s.time.trim()].join("|");
const roomKey = (s: Pick<RoomSlot, "pool" | "room">) => `${s.pool}|${nameKey(s.room)}`;

/** Sof: hozir xonani band qilib turgan guruh vaqtlari (muddati o'tganlari — bo'sh). */
export function currentRoomSlots(groups: readonly GroupRow[], todayIso: string): RoomSlot[] {
  const out: RoomSlot[] = [];
  for (const g of groups) {
    const room = String(g.room ?? "").trim();
    if (!room || !holdsRoom(g.status)) continue;
    const { end } = groupBoundsIso(g);
    if (end && end < todayIso) continue;
    out.push({
      pool: branchPool(Number(g.branchId) || 1)[0],
      room,
      groupId: Number(g.id),
      label: labelOf(g),
      day: String(g.day ?? "").trim(),
      time: String(g.time ?? "").trim(),
    });
  }
  return out;
}

/**
 * Sof: oldingi va hozirgi surat farqi — bo'shagan vaqtlar hodisasi.
 * Sabab hozirgi guruh holatidan: yo'q/arxiv — «archived», boshqa xona —
 * «moved», kun/vaqt boshqa — «time», tugash sanasi o'tgan — «ended».
 */
export function roomFreedEvents(
  prev: readonly RoomSlot[],
  curr: readonly RoomSlot[],
  groups: readonly GroupRow[],
  todayIso: string,
  nowIso: string,
): Draft[] {
  const currKeys = new Set(curr.map(slotKey));
  const currRooms = new Set(curr.map(roomKey));
  const byId = new Map(groups.map((g) => [Number(g.id), g]));
  const out: Draft[] = [];
  for (const s of prev) {
    if (currKeys.has(slotKey(s))) continue;
    const g = byId.get(s.groupId);
    let reason = "archived";
    let newRoom = "";
    if (g && holdsRoom(g.status)) {
      const { end } = groupBoundsIso(g);
      if (nameKey(g.room) !== nameKey(s.room)) {
        reason = "moved";
        newRoom = String(g.room ?? "").trim();
      } else if (end && end < todayIso) reason = "ended";
      else reason = "time";
    }
    out.push({
      key: `room-freed:${slotKey(s)}:${todayIso}`,
      kind: "room-freed",
      at: nowIso,
      params: {
        room: s.room,
        group: s.label,
        day: s.day,
        time: s.time,
        reason,
        ...(newRoom ? { newRoom } : {}),
        empty: currRooms.has(roomKey(s)) ? 0 : 1,
      },
      href: "/groups-rooms",
    });
  }
  return out;
}

// ── 4. TOPSHIRIQLAR ───────────────────────────────────────────────────────

interface TaskRow {
  id: number;
  title?: string;
  employeeName?: string;
  deadline?: string;
  status?: string;
  doneAt?: string | null;
  createdAt?: string;
  createdBy?: { userId?: string; name?: string };
}

const ACTIVE = ["yangi", "qaytarildi", "muddati_otdi"];
const SUBMITTED = ["tasdiq_kutilmoqda", "yakunlandi"];

/** Sof: muddatidan avval topshirilgan (oxirgi 7 kun) va muddati o'tgan topshiriqlar. */
export function taskAlerts(rows: readonly TaskRow[], nowMs: number, viewerUserId: string): Draft[] {
  const out: Draft[] = [];
  for (const t of rows) {
    const deadline = msOf(t.deadline);
    if (!Number.isFinite(deadline)) continue;
    const title = String(t.title ?? "").trim();
    const employee = String(t.employeeName ?? "").trim();
    const done = msOf(t.doneAt);
    if (SUBMITTED.includes(String(t.status)) && Number.isFinite(done) && done < deadline && nowMs - done <= RECENT_MS) {
      const created = msOf(t.createdAt);
      out.push({
        key: `task-early:${t.id}:${t.doneAt}`,
        kind: "task-early",
        at: new Date(done).toISOString(),
        params: {
          title,
          employee,
          givenAgoH: Number.isFinite(created) ? hours(nowMs - created) : 0,
          earlyH: hours(deadline - done),
          mine: t.createdBy?.userId && t.createdBy.userId === viewerUserId ? 1 : 0,
          creator: String(t.createdBy?.name ?? ""),
        },
        href: `/tasks?open=${t.id}`,
      });
      continue;
    }
    if (ACTIVE.includes(String(t.status)) && (t.status === "muddati_otdi" || deadline < nowMs)) {
      out.push({
        key: `task-overdue:${t.id}:${t.deadline}`,
        kind: "task-overdue",
        at: new Date(deadline).toISOString(),
        params: { title, employee, lateH: hours(nowMs - deadline) },
        href: `/tasks?open=${t.id}`,
      });
    }
  }
  return out;
}

// ── YIG'ISH (baza) ────────────────────────────────────────────────────────

interface RoomState {
  _id: string;
  slots: RoomSlot[];
  at: Date;
}

/**
 * Bo'shagan xonalar: suratni yangilaydi va yangi hodisalarni yozadi.
 * Birinchi chaqiruv — faqat surat (o'tmish hodisa bo'lib chiqmaydi). Bir
 * vaqtda ikki so'rov kelsa hodisa kaliti noyob indeks bilan bir marta yoziladi.
 */
async function syncRoomEvents(db: Db, groups: readonly GroupRow[], todayIso: string, now: Date): Promise<void> {
  // Barqaror tartib — surat o'zgarmagan bo'lsa qayta yozilmaydi (har 2 daqiqada yozuv bo'lmasin).
  const curr = currentRoomSlots(groups, todayIso).sort((x, y) => (slotKey(x) < slotKey(y) ? -1 : 1));
  const state = db.collection<RoomState>(AI.alertState);
  const prev = await state.findOne({ _id: "rooms" });
  if (prev && Array.isArray(prev.slots) && JSON.stringify(prev.slots) === JSON.stringify(curr)) return;
  if (prev && Array.isArray(prev.slots)) {
    const events = roomFreedEvents(prev.slots, curr, groups, todayIso, now.toISOString());
    if (events.length > 0) {
      await db
        .collection(AI.alertEvents)
        .insertMany(events.map((e) => ({ ...e, at: now })), { ordered: false })
        .catch((e: unknown) => {
          // Takror kalit (parallel so'rov) — normal; boshqa xato yuqoriga.
          const errs = (e as { writeErrors?: { code?: number }[] }).writeErrors;
          if (!(isDupKey(e) || (Array.isArray(errs) && errs.every((w) => w.code === 11000)))) throw e;
        });
    }
  }
  await state.replaceOne({ _id: "rooms" }, { slots: curr, at: now }, { upsert: true });
}

/** Admin uchun ogohlantirishlar — yangisi birinchi, eng ko'pi MAX_ALERTS. */
export async function loadAiAlerts(db: Db, viewerUserId: string, now = new Date()): Promise<{ alerts: AiAlert[]; unseen: number }> {
  const nowMs = now.getTime();
  const todayIso = uzDateIso(now);
  const sinceIso = new Date(nowMs - RECENT_MS).toISOString();

  const [leads, groups, tasks] = await Promise.all([
    db
      .collection("orders")
      .find({}, { projection: { _id: 0, id: 1, created: 1, moderator: 1, holat: 1, groupId: 1, status: 1, leadStatus: 1, firstLesson: 1, firstLessonStatus: 1, stage: 1 } })
      .toArray() as Promise<unknown> as Promise<LeadRow[]>,
    db
      .collection("groups")
      .find({}, { projection: { _id: 0, id: 1, name: 1, course: 1, teacher: 1, room: 1, day: 1, time: 1, status: 1, startDate: 1, endDate: 1, period: 1, branchId: 1 } })
      .toArray() as Promise<unknown> as Promise<GroupRow[]>,
    db
      .collection("staff_tasks")
      .find(
        { $or: [{ status: { $in: ACTIVE } }, { status: { $in: SUBMITTED }, doneAt: { $gte: sinceIso } }] },
        { projection: { _id: 0, id: 1, title: 1, employeeName: 1, deadline: 1, status: 1, doneAt: 1, createdAt: 1, createdBy: 1 } },
      )
      .toArray() as Promise<unknown> as Promise<TaskRow[]>,
  ]);

  await syncRoomEvents(db, groups, todayIso, now);
  const roomEvents = (await db
    .collection(AI.alertEvents)
    .find({ kind: "room-freed", at: { $gte: new Date(nowMs - RECENT_MS) } }, { projection: { _id: 0 } })
    .sort({ at: -1 })
    .limit(MAX_ALERTS)
    .toArray()) as unknown as (Draft & { at: Date })[];

  const drafts: Draft[] = [
    ...leadAlerts(leads, nowMs),
    ...groupAlerts(groups, todayIso),
    ...roomEvents.map((e) => ({ key: e.key, kind: e.kind, at: new Date(e.at).toISOString(), params: e.params, href: e.href })),
    ...taskAlerts(tasks, nowMs, viewerUserId),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, MAX_ALERTS);

  const seenRows = drafts.length
    ? await db
        .collection(AI.alertSeen)
        .find({ userId: viewerUserId, key: { $in: drafts.map((d) => d.key) } }, { projection: { _id: 0, key: 1 } })
        .toArray()
    : [];
  const seen = new Set(seenRows.map((r) => String(r.key)));
  const alerts = drafts.map((d) => ({ ...d, seen: seen.has(d.key) }));
  return { alerts, unseen: alerts.filter((a) => !a.seen).length };
}

/** «Ko'rildi» — shu admin uchun (kalit 200 belgigacha, bir so'rovda 100 tagacha). */
export async function markAiAlertsSeen(db: Db, viewerUserId: string, keys: readonly unknown[]): Promise<number> {
  const clean = [...new Set(keys.filter((k): k is string => typeof k === "string" && k.length > 0 && k.length <= 200))].slice(0, 100);
  if (clean.length === 0) return 0;
  const now = new Date();
  await db.collection(AI.alertSeen).bulkWrite(
    clean.map((key) => ({
      updateOne: { filter: { userId: viewerUserId, key }, update: { $setOnInsert: { userId: viewerUserId, key, at: now } }, upsert: true },
    })),
    { ordered: false },
  );
  return clean.length;
}
