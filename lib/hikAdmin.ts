import { randomBytes } from "node:crypto";
import type { Db } from "mongodb";
import { HIK_EVENTS, HIK_PERSONS, HIK_TERMINALS, replayHikEvents, type HikPerson, type HikTerminal } from "@/lib/hikTerminal";
import { uzDateIso } from "@/lib/uzTime";

// YUZ TERMINALLARINI BOSHQARISH (21.11.2026) — Nazorat → Xodimlar davomati →
// «Belgilash usuli» dagi bo'lim (components/v2/nazorat/FaceTerminalsV2.tsx),
// server: /api/hik/terminals va /api/hik/persons. FAQAT ADMIN.
//
//   • Terminal qo'shish — nom + filial; HTTP listening manzili uchun maxfiy
//     kalit beriladi (/api/hik/listen/<kalit>), admin uni terminal web
//     sahifasiga yozadi. Filial o'zgarsa / yoqilsa — jurnalda qolgan voqealar
//     qayta o'tkaziladi.
//   • Odamni bog'lash — terminaldagi «Employee No.» → xodim yoki o'quvchi.
//     Terminaldagi ism CRM'dagi bitta odamga AYNAN mos kelsa — taklif
//     (bitta bosish); taxminiy moslik yo'q. Bog'langach shu raqamning
//     jurnaldagi voqealari davomatga yoziladi (oxirgi 7 kun).

export const DEVICE_ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{24,64}$/;
const EMPLOYEE_NO_RE = /^[A-Za-z0-9_-]{1,32}$/;

type Fail = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });

export function newListenToken(): string {
  return randomBytes(24).toString("base64url");
}

export function listenPath(token: string): string {
  return `/api/hik/listen/${token}`;
}

/** HTTP listening so'rovidagi kalit → terminal. */
export async function terminalByToken(db: Db, token: string): Promise<HikTerminal | null> {
  if (!TOKEN_RE.test(token)) return null;
  return db.collection<HikTerminal>(HIK_TERMINALS).findOne({ listenToken: token }, { projection: { _id: 0 } });
}

async function nextTerminalId(db: Db): Promise<number> {
  const [last] = await db.collection(HIK_TERMINALS).find({}, { projection: { _id: 0, id: 1 } }).sort({ id: -1 }).limit(1).toArray();
  return (Number(last?.id) || 0) + 1;
}

async function branchExists(db: Db, id: number): Promise<boolean> {
  return Boolean(await db.collection("branches").findOne({ id }, { projection: { _id: 1 } }));
}

const cleanName = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, 60) : "");

/** Ism solishtirish kaliti: katta-kichik harf, bo'shliq va tutuq belgisi farq qilmaydi. */
export function nameKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ʻʼ’‘`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Terminallar ───────────────────────────────────────────────────────────

export async function createTerminal(
  db: Db,
  input: { name?: unknown; branchId?: unknown; deviceId?: unknown },
  now = new Date(),
): Promise<{ ok: true; terminal: HikTerminal } | Fail> {
  const name = cleanName(input.name);
  if (!name) return fail(400, "Terminal nomini kiriting");
  const branchId = Number(input.branchId);
  if (!Number.isInteger(branchId) || !(await branchExists(db, branchId))) return fail(400, "Filialni tanlang");
  const serial = typeof input.deviceId === "string" ? input.deviceId.trim() : "";
  if (serial && !DEVICE_ID_RE.test(serial)) return fail(400, "Seriya raqami noto'g'ri — faqat lotin harf, raqam, «-»");

  const col = db.collection<HikTerminal>(HIK_TERMINALS);
  if (serial) {
    const existing = await col.findOne({ deviceId: serial }, { projection: { _id: 0 } });
    if (existing?.listenToken) return fail(409, "Bu seriya raqamli terminal allaqachon qo'shilgan");
    if (existing) {
      // ISUP orqali o'zi ro'yxatga tushgan terminal — shuni biriktiramiz.
      const listenToken = newListenToken();
      await col.updateOne({ deviceId: serial }, { $set: { name, branchId, active: true, listenToken } });
      return { ok: true, terminal: { ...existing, name, branchId, active: true, listenToken } };
    }
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = await nextTerminalId(db);
    const terminal: HikTerminal = {
      id,
      deviceId: serial || `http-${id}`,
      name,
      branchId,
      active: true,
      createdAt: now,
      lastSeenAt: null,
      lastEventAt: null,
      listenToken: newListenToken(),
      info: null,
    };
    try {
      await col.insertOne({ ...terminal });
      return { ok: true, terminal };
    } catch (e) {
      if ((e as { code?: number })?.code !== 11000) throw e;
      if (serial) return fail(409, "Bu seriya raqamli terminal allaqachon qo'shilgan");
    }
  }
  return fail(503, "Hozir band — qayta urinib ko'ring");
}

export async function updateTerminal(
  db: Db,
  id: number,
  patch: { name?: unknown; branchId?: unknown; active?: unknown },
): Promise<{ ok: true; terminal: HikTerminal; replayed: number } | Fail> {
  const col = db.collection<HikTerminal>(HIK_TERMINALS);
  const cur = await col.findOne({ id }, { projection: { _id: 0 } });
  if (!cur) return fail(404, "Terminal topilmadi");
  const set: Partial<HikTerminal> = {};
  if (patch.name !== undefined) {
    const name = cleanName(patch.name);
    if (!name) return fail(400, "Terminal nomini kiriting");
    set.name = name;
  }
  if (patch.branchId !== undefined) {
    const branchId = Number(patch.branchId);
    if (!Number.isInteger(branchId) || !(await branchExists(db, branchId))) return fail(400, "Filialni tanlang");
    set.branchId = branchId;
  }
  if (patch.active !== undefined) {
    if (typeof patch.active !== "boolean") return fail(400, "Noto'g'ri so'rov");
    set.active = patch.active;
  }
  if (Object.keys(set).length === 0) return fail(400, "Noto'g'ri so'rov");
  await col.updateOne({ id }, { $set: set });
  const terminal = { ...cur, ...set };
  // Endi ishlaydigan bo'ldi — kutib turgan voqealar davomatga.
  const replayed = terminal.active && terminal.branchId !== null ? ((await replayHikEvents(db, terminal.deviceId)).applied ?? 0) : 0;
  return { ok: true, terminal, replayed };
}

// ── Odamlar ───────────────────────────────────────────────────────────────

export async function linkPerson(
  db: Db,
  input: { employeeNo?: unknown; personType?: unknown; personId?: unknown },
  now = new Date(),
): Promise<{ ok: true; replayed: number; name: string } | Fail> {
  const employeeNo = typeof input.employeeNo === "string" ? input.employeeNo.trim() : "";
  if (!EMPLOYEE_NO_RE.test(employeeNo)) return fail(400, "Terminal raqami noto'g'ri");
  const personType = input.personType === "employee" || input.personType === "student" ? input.personType : null;
  const personId = Number(input.personId);
  if (!personType || !Number.isInteger(personId) || personId <= 0) return fail(400, "Kimligini tanlang");

  let name = "";
  if (personType === "employee") {
    const emp = await db.collection("hr_employees").findOne({ id: personId }, { projection: { _id: 0, name: 1, archReason: 1 } });
    if (!emp) return fail(404, "Xodim topilmadi");
    if (emp.archReason) return fail(409, "Xodim arxivda");
    name = String(emp.name ?? "");
  } else {
    const p = await db.collection("pupils").findOne({ id: personId }, { projection: { _id: 0, firstName: 1, lastName: 1 } });
    if (!p) return fail(404, "O'quvchi topilmadi");
    name = `${String(p.firstName ?? "")} ${String(p.lastName ?? "")}`.trim();
  }

  try {
    await db.collection<HikPerson>(HIK_PERSONS).insertOne({ employeeNo, personType, personId, createdAt: now });
  } catch (e) {
    if ((e as { code?: number })?.code === 11000) return fail(409, "Bu terminal raqami allaqachon bog'langan — avval uzing");
    throw e;
  }
  const devices = await db.collection(HIK_EVENTS).distinct("deviceId", { employeeNo, status: "unknown_person" });
  let replayed = 0;
  for (const d of devices) replayed += (await replayHikEvents(db, String(d), now)).applied ?? 0;
  return { ok: true, replayed, name };
}

export async function unlinkPerson(db: Db, employeeNo: string): Promise<{ ok: true } | Fail> {
  const res = await db.collection(HIK_PERSONS).deleteOne({ employeeNo });
  return res.deletedCount ? { ok: true } : fail(404, "Bog'lanish topilmadi");
}

// ── Sahifa uchun umumiy ko'rinish ──────────────────────────────────────────

export interface TerminalView {
  id: number;
  name: string;
  deviceId: string;
  branchId: number | null;
  branchName: string;
  active: boolean;
  lastSeenAt: string | null;
  lastEventAt: string | null;
  ip: string | null;
  /** HTTP listening manzili (host'siz) — CRM'dan qo'shilmagan (ISUP) terminalda null. */
  listenPath: string | null;
  /** Bugun davomatga yozilgan o'tishlar. */
  today: number;
}

export interface PersonRef {
  personType: "employee" | "student";
  personId: number;
  name: string;
}

export interface UnknownPerson {
  employeeNo: string;
  /** Terminaldagi ism. */
  deviceName: string | null;
  count: number;
  lastAt: string;
  /** Ism CRM'dagi BITTA odamga aynan mos kelsa. */
  suggestion: PersonRef | null;
}

export interface LinkedPerson extends PersonRef {
  employeeNo: string;
}

export interface HikOverview {
  ok: true;
  terminals: TerminalView[];
  unknown: UnknownPerson[];
  linked: LinkedPerson[];
  employees: { id: number; name: string }[];
  branches: { id: number; name: string }[];
}

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : null);

export async function hikOverview(db: Db): Promise<HikOverview> {
  const todayStart = new Date(`${uzDateIso()}T00:00:00+05:00`);
  const [terminals, branchRows, empRows, persons, todayAgg, unknownAgg] = await Promise.all([
    db.collection<HikTerminal>(HIK_TERMINALS).find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray(),
    db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray(),
    db
      .collection("hr_employees")
      .find({ archReason: { $in: ["", null] } }, { projection: { _id: 0, id: 1, name: 1 } })
      .sort({ name: 1 })
      .toArray(),
    db.collection<HikPerson>(HIK_PERSONS).find({}, { projection: { _id: 0 } }).toArray(),
    db
      .collection(HIK_EVENTS)
      .aggregate<{ _id: string; n: number }>([{ $match: { status: "applied", at: { $gte: todayStart } } }, { $group: { _id: "$deviceId", n: { $sum: 1 } } }])
      .toArray(),
    db
      .collection(HIK_EVENTS)
      .aggregate<{ _id: string; name: string | null; count: number; lastAt: Date }>([
        { $match: { status: "unknown_person", employeeNo: { $type: "string" } } },
        { $sort: { at: -1 } },
        { $group: { _id: "$employeeNo", name: { $first: "$name" }, count: { $sum: 1 }, lastAt: { $first: "$at" } } },
        { $sort: { lastAt: -1 } },
        { $limit: 300 },
      ])
      .toArray(),
  ]);

  const branchName = new Map(branchRows.map((b) => [Number(b.id), String(b.name ?? "")]));
  const employees = empRows.map((e) => ({ id: Number(e.id), name: String(e.name ?? "").trim() })).filter((e) => e.name);
  const empName = new Map(employees.map((e) => [e.id, e.name]));
  const todayBy = new Map(todayAgg.map((x) => [x._id, x.n]));

  // O'quvchi ismlari — bog'langanlar va (noma'lumlar bo'lsa) taklif uchun.
  const linkedNos = new Set(persons.map((p) => p.employeeNo));
  const unknownRows = unknownAgg.filter((u) => !linkedNos.has(u._id));
  const pupilIds = persons.filter((p) => p.personType === "student").map((p) => p.personId);
  const pupils = await db
    .collection("pupils")
    .find(unknownRows.some((u) => u.name) ? {} : { id: { $in: pupilIds } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1 } })
    .toArray();
  const pupilName = new Map(pupils.map((p) => [Number(p.id), `${String(p.firstName ?? "")} ${String(p.lastName ?? "")}`.trim()]));

  // Aniq ism → odamlar (ismdosh bo'lsa taklif yo'q).
  const byName = new Map<string, PersonRef[]>();
  const add = (key: string, ref: PersonRef) => {
    if (!key) return;
    const list = byName.get(key) ?? [];
    if (!list.some((x) => x.personType === ref.personType && x.personId === ref.personId)) list.push(ref);
    byName.set(key, list);
  };
  if (unknownRows.some((u) => u.name)) {
    for (const e of employees) add(nameKey(e.name), { personType: "employee", personId: e.id, name: e.name });
    for (const p of pupils) {
      const first = String(p.firstName ?? "").trim();
      const last = String(p.lastName ?? "").trim();
      const ref: PersonRef = { personType: "student", personId: Number(p.id), name: `${first} ${last}`.trim() };
      add(nameKey(`${first} ${last}`), ref);
      add(nameKey(`${last} ${first}`), ref);
    }
  }

  return {
    ok: true,
    terminals: terminals.map((t) => ({
      id: t.id,
      name: t.name,
      deviceId: t.deviceId,
      branchId: t.branchId,
      branchName: t.branchId === null ? "" : (branchName.get(t.branchId) ?? ""),
      active: t.active,
      lastSeenAt: iso(t.lastSeenAt),
      lastEventAt: iso(t.lastEventAt),
      ip: t.info?.ip ?? null,
      listenPath: t.listenToken ? listenPath(t.listenToken) : null,
      today: todayBy.get(t.deviceId) ?? 0,
    })),
    unknown: unknownRows.map((u) => {
      const hits = u.name ? (byName.get(nameKey(u.name)) ?? []) : [];
      return { employeeNo: u._id, deviceName: u.name, count: u.count, lastAt: u.lastAt.toISOString(), suggestion: hits.length === 1 ? hits[0] : null };
    }),
    linked: persons
      .map((p) => ({
        employeeNo: p.employeeNo,
        personType: p.personType,
        personId: p.personId,
        name: (p.personType === "employee" ? empName.get(p.personId) : pupilName.get(p.personId)) || `#${p.personId}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "uz")),
    employees,
    branches: branchRows.map((b) => ({ id: Number(b.id), name: String(b.name ?? "") })),
  };
}
