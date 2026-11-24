import { createHash } from "node:crypto";
import type { Db } from "mongodb";
import { markAttendance, minToHm, QR_SOURCE, type AttendanceBranch, type AttendanceRecord } from "@/lib/attendanceCheck";
import { notifyLate } from "@/lib/attendanceNotify";
import type { HrEmployee } from "@/lib/hrEmployees";
import { toUz } from "@/lib/uzTime";

// YUZ TERMINALI (Hikvision, 21.11.2026 — egasi: ikkinchi markazga yuz
// terminalini ulash; xodimlar + o'quvchilar, ISUP orqali).
//
// QURILMA: DS-K1T343MX (MinMoe). Voqea CRM'ga ikki yo'ldan keladi, ikkalasi
// ham shu modulga tushadi (voqea shakli bir xil):
//   • HTTP LISTENING (21.11.2026 egasi tanladi — SDK kerak emas): terminal web
//     sahifasida manzil yoziladi, terminal har voqeani o'zi POST qiladi —
//     /api/hik/listen/<kalit> (app/api/hik/listen/[token]/route.ts). Terminal
//     CRM'da qo'shiladi (Xodimlar davomati → Belgilash usuli, lib/hikAdmin.ts).
//   • ISUP 5.0 (terminal ekrani: port 7660, Device ID, ISUP key) — yopiq
//     protokol, serverdagi alohida ko'prik (Hikvision HCISUPSDK) kerak; ko'prik
//     POST /api/hik/events ga `x-hik-secret` bilan yuboradi. Hozircha ko'prik yo'q.
//
// VOQEA SHAKLI — Hikvision ISAPI JSON'i (ikkalasini ham qabul qiladi):
//   • push: { dateTime, eventType: "AccessControllerEvent",
//             AccessControllerEvent: { majorEventType, subEventType,
//             employeeNoString, name, serialNo, currentVerifyMode, attendanceStatus } }
//   • jurnal qidiruvi (/ISAPI/AccessControl/AcsEvent → InfoList[]):
//             { major, minor, time, employeeNoString, name, serialNo, … }
// O'tish deb faqat `PASS_MINORS` hisoblanadi; qolganlari ham jurnalga
// (`hik_events`) major/minor bilan tushadi — haqiqiy qurilmadan kelgan
// kodlarni shu yerdan ko'rib, ro'yxatni kengaytirish mumkin.
//
// KIM: terminaldagi «Employee No.» → `hik_persons` (employeeNo → xodim yoki
// o'quvchi). Raqam bo'yicha TAXMIN QILINMAYDI: terminalga odamni o'rnatuvchi
// qo'lda qo'shgan bo'lishi mumkin (1, 2, 3 …) — xato odamni belgilagandan
// ko'ra «noma'lum» deb jurnalda qoldirgan yaxshi. Bog'langach `replayHikEvents`
// eski voqealarni qayta o'tkazadi.
//
// QAYERGA: terminal bitta filialga biriktiriladi (`hik_terminals.branchId`);
// biriktirilmagan terminalning voqealari faqat jurnalga tushadi.
//   • XODIM — «Ishga keldim» bilan AYNAN BIR XIL yozuv (`turnstile_io`,
//     source "qr", lib/attendanceCheck.ts → markAttendance, `terminal`
//     rejimi): kechikish, filial topigiga xabar, «O'qituvchi kelmadi»,
//     eslatmalar, Ish soati — hammasi o'zi ishlaydi. Yozuvda `via: "terminal"`.
//   • O'QUVCHI — `turnstile_io` ga personType "student", source "terminal"
//     (Nazorat → Turniket kirish-chiqish analitikasi o'quvchilarni ko'rsatadi).
//
// KELDI/KETDI: kunning birinchi o'tishi — keldi; kelgandan `OUT_GAP_MIN`
// daqiqadan keyingi har o'tish — ketdi (oxirgisi qoladi). Undan oldingisi —
// takror skanerlash, e'tiborsiz. Terminal o'zi «checkIn/checkOut» aytsa
// (davomat rejimi) — o'shanga ishoniladi.

export const HIK_TERMINALS = "hik_terminals";
export const HIK_EVENTS = "hik_events";
export const HIK_PERSONS = "hik_persons";
/** O'quvchi terminal yozuvlarining manbasi (`turnstile_io.source`). */
export const TERMINAL_SOURCE = "terminal";

/** Kelgandan keyin shuncha daqiqa ichidagi o'tish — takror skanerlash, «ketdi» emas. */
export const OUT_GAP_MIN = 30;
/** Bundan eski voqea (ko'prik uzilib, keyin yetkazgan) uchun Telegram xabari ketmaydi. */
const NOTIFY_MAX_AGE_MS = 15 * 60_000;
/** Qurilma soati shuncha oldinda bo'lsa voqea vaqti emas, qabul vaqti olinadi. */
const MAX_FUTURE_MS = 5 * 60_000;
/** Bundan eski voqea davomatga yozilmaydi (faqat jurnal). */
const MAX_AGE_MS = 7 * 86_400_000;

/**
 * O'tish voqealari — major 5 («hodisa») ichida: 1 — karta, 38 — barmoq izi,
 * 75 — yuz tasdiqlandi. Boshqa kod kelsa jurnalda `ignored` bo'lib turadi.
 */
export const PASS_MINORS: ReadonlySet<number> = new Set([1, 38, 75]);
const MAJOR_EVENT = 5;

export interface HikTerminal {
  id: number;
  /** Terminal ekranidagi ISUP «Device ID». */
  deviceId: string;
  name: string;
  /** null — hali filialga biriktirilmagan: voqealar faqat jurnalga. */
  branchId: number | null;
  active: boolean;
  createdAt: Date;
  lastSeenAt?: Date | null;
  lastEventAt?: Date | null;
  /**
   * HTTP LISTENING manzilidagi maxfiy kalit (/api/hik/listen/<kalit>) — terminal
   * CRM'dan qo'shilganda beriladi (lib/hikAdmin.ts). Terminal sarlavha qo'sha
   * olmaydi, shu sabab kalit manzilda; u terminalni ham aniqlaydi.
   */
  listenToken?: string | null;
  /** Terminal o'zi aytgan tarmoq manzili (voqeadagi ipAddress/macAddress) — web sahifasini ochish uchun. */
  info?: { ip: string | null; mac: string | null } | null;
}

export interface HikPerson {
  /** Terminaldagi «Employee No.» (satr — terminal shunday saqlaydi). */
  employeeNo: string;
  personType: "employee" | "student";
  /** `hr_employees.id` yoki `pupils.id`. */
  personId: number;
  createdAt: Date;
}

export type HikEventStatus =
  | "pending"
  | "applied"
  | "repeat"
  | "ignored"
  | "unknown_person"
  | "no_terminal"
  | "inactive_person"
  | "too_old"
  | "error";

/** `replayHikEvents` qayta o'tkazadigan holatlar. */
const RETRYABLE: HikEventStatus[] = ["unknown_person", "no_terminal", "error", "pending"];

export interface HikEventRow {
  deviceId: string;
  /** Takrorni ushlash kaliti — serialNo + vaqt (qurilma qayta tiklansa serialNo boshidan boshlanadi). */
  key: string;
  serialNo: number | null;
  /** Voqea vaqti (qurilma soati; aql bovar qilmasa — qabul vaqti). */
  at: Date;
  receivedAt: Date;
  major: number | null;
  minor: number | null;
  employeeNo: string | null;
  /** Terminaldagi ism — bog'lashda yordam uchun, ishonchli manba emas. */
  name: string | null;
  verifyMode: string | null;
  attendanceStatus: string | null;
  status: HikEventStatus;
  personType?: "employee" | "student";
  personId?: number;
  kind?: "in" | "out";
  recordId?: number;
  error?: string;
}

/** O'quvchining terminal yozuvi (`turnstile_io`, lib/turnstileIo.ts shakli + terminalga xoslari). */
export interface StudentPassRecord {
  id: number;
  date: string;
  personName: string;
  personType: "student";
  enterTime: string | null;
  exitTime: string | null;
  status: "kelgan";
  source: typeof TERMINAL_SOURCE;
  studentId: number;
  branchId: number;
  deviceId: string;
  enteredAt: Date;
  exitedAt?: Date | null;
  exitDeviceId?: string | null;
}

// ── Voqeani o'qish (sof funksiyalar) ──────────────────────────────────────

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const str = (v: unknown, max = 64): string | null => {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
};

/**
 * ISAPI vaqti → Date. "2026-11-21T08:59:12+05:00" / "+0500" / "Z"; zonasiz
 * kelsa — Toshkent (+05:00, yozgi vaqt yo'q).
 */
export function parseHikTime(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.exec(v.trim());
  if (!m) return null;
  let tz = m[7] ?? "+05:00";
  if (/^[+-]\d{4}$/.test(tz)) tz = `${tz.slice(0, 3)}:${tz.slice(3)}`;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${tz}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface ParsedHikEvent {
  serialNo: number | null;
  /** Qurilma aytgan vaqt; o'qib bo'lmasa null. */
  at: Date | null;
  major: number | null;
  minor: number | null;
  employeeNo: string | null;
  name: string | null;
  verifyMode: string | null;
  attendanceStatus: string | null;
  /** Odam o'tdi (karta / barmoq / yuz) va kimligi bor. */
  pass: boolean;
}

/** ISAPI voqeasi (push yoki jurnal qidiruvi qatori) → oddiy shakl; tanilmasa null. */
export function parseHikEvent(raw: unknown): ParsedHikEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const top = raw as Record<string, unknown>;
  const inner = top.AccessControllerEvent;
  // Boshqa turdagi xabar (HTTP listening'dagi «heartBeat» va h.k.) — voqea emas.
  if (typeof top.eventType === "string" && top.eventType !== "AccessControllerEvent" && !inner) return null;
  const e = (inner && typeof inner === "object" ? inner : top) as Record<string, unknown>;
  const major = num(e.majorEventType ?? e.major);
  const minor = num(e.subEventType ?? e.minor);
  const at = parseHikTime(top.dateTime ?? e.time ?? e.dateTime);
  if (major === null && minor === null && !at) return null;
  const employeeNo = str(e.employeeNoString ?? e.employeeNo, 32);
  return {
    serialNo: num(e.serialNo),
    at,
    major,
    minor,
    employeeNo,
    name: str(e.name, 80),
    verifyMode: str(e.currentVerifyMode, 40),
    attendanceStatus: str(e.attendanceStatus, 40),
    pass: major === MAJOR_EVENT && minor !== null && PASS_MINORS.has(minor) && employeeNo !== null,
  };
}

/** Takror kaliti: serialNo bo'lsa — u + vaqt; bo'lmasa voqeaning o'zidan xesh. */
export function hikEventKey(ev: ParsedHikEvent, at: Date): string {
  if (ev.serialNo !== null) return `s${ev.serialNo}@${at.toISOString()}`;
  const h = createHash("sha256").update(JSON.stringify([at.toISOString(), ev.employeeNo, ev.major, ev.minor])).digest("hex");
  return `h${h.slice(0, 24)}`;
}

/**
 * HTTP LISTENING tanasi → voqea JSON'lari (sof funksiya). Terminal odatda
 * multipart yuboradi: JSON qism («event_log» / «AccessControllerEvent») +
 * ixtiyoriy rasm. Rasm qismlari tashlanadi. Hikvision multipart'i har doim ham
 * qoidaga to'liq mos emas — shu sabab qat'iy `formData()` emas, yumshoq
 * bo'luvchi. XML (eski «EventNotificationAlert», yurak urishi) — voqea emas.
 */
export function parseListenBody(contentType: string, body: Uint8Array): unknown[] {
  const out: unknown[] = [];
  const tryJson = (s: string) => {
    const t = s.trim();
    if (!t.startsWith("{")) return;
    try {
      const v: unknown = JSON.parse(t);
      if (v && typeof v === "object" && !Array.isArray(v)) out.push(v);
    } catch {
      /* JSON emas */
    }
  };
  const text = Buffer.from(body).toString("utf8");
  const boundary = /boundary="?([^";\s]+)"?/i.exec(contentType)?.[1];
  if (!/multipart\//i.test(contentType) || !boundary) {
    tryJson(text);
    return out;
  }
  for (const part of text.split(`--${boundary}`)) {
    const crlf = part.indexOf("\r\n\r\n");
    const lf = part.indexOf("\n\n");
    const at = crlf >= 0 ? crlf + 4 : lf >= 0 ? lf + 2 : -1;
    if (at < 0) continue;
    if (/content-type:\s*image\//i.test(part.slice(0, at))) continue;
    tryJson(part.slice(at));
  }
  return out;
}

/** Voqeadagi terminal tarmoq manzili (push shaklida bor; jurnal qatorida yo'q). */
export function deviceInfoOf(raw: unknown): { ip: string | null; mac: string | null } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ip = str(r.ipAddress, 64);
  const mac = str(r.macAddress, 32);
  return ip || mac ? { ip, mac } : null;
}

/** Voqea vaqti: qurilmaniki, agar aql bovar qilsa (kelajakda emas); aks holda qabul vaqti. */
export function effectiveTime(ev: Pick<ParsedHikEvent, "at">, receivedAt: Date): Date {
  if (!ev.at) return receivedAt;
  return ev.at.getTime() - receivedAt.getTime() > MAX_FUTURE_MS ? receivedAt : ev.at;
}

/**
 * Keldi yoki ketdi (sof funksiya). `entered` — bugungi yozuvdagi kelish
 * vaqti, `exited` — oxirgi ketish vaqti.
 */
export function decideKind(
  at: Date,
  attendanceStatus: string | null,
  entered: Date | null,
  exited: Date | null,
): "in" | "out" | "repeat" {
  if (!entered) return "in";
  if (at.getTime() <= entered.getTime()) return "repeat";
  if (exited && at.getTime() <= exited.getTime()) return "repeat";
  if (attendanceStatus === "checkOut") return "out";
  if (attendanceStatus === "checkIn") return "repeat";
  return at.getTime() - entered.getTime() >= OUT_GAP_MIN * 60_000 ? "out" : "repeat";
}

// ── Baza ──────────────────────────────────────────────────────────────────

const isDuplicateKey = (e: unknown) => (e as { code?: number } | null)?.code === 11000;
const p2 = (n: number) => String(n).padStart(2, "0");

function uzDay(at: Date): { date: string; hm: string } {
  const u = toUz(at);
  return { date: `${u.getFullYear()}-${p2(u.getMonth() + 1)}-${p2(u.getDate())}`, hm: minToHm(u.getHours() * 60 + u.getMinutes()) };
}

/** Kolleksiyadagi eng katta `id` dan keyingisi (loyihadagi naqsh). */
async function nextId(db: Db, collection: string): Promise<number> {
  const [last] = await db.collection(collection).find({}, { projection: { _id: 0, id: 1 } }).sort({ id: -1 }).limit(1).toArray();
  return (Number(last?.id) || 0) + 1;
}

/**
 * Terminalni topadi va «oxirgi ko'rinish»ni yangilaydi. Notanish qurilma —
 * biriktirilmagan (`branchId: null`, `active: false`) bo'lib ro'yxatga tushadi:
 * admin filialga biriktirguncha voqealari faqat jurnalda.
 */
export async function touchTerminal(
  db: Db,
  deviceId: string,
  now: Date,
  hadEvents: boolean,
  info: HikTerminal["info"] = null,
): Promise<HikTerminal> {
  const col = db.collection<HikTerminal>(HIK_TERMINALS);
  const set = { lastSeenAt: now, ...(hadEvents ? { lastEventAt: now } : {}), ...(info ? { info } : {}) };
  for (let attempt = 0; attempt < 5; attempt++) {
    const found = await col.findOneAndUpdate({ deviceId }, { $set: set }, { returnDocument: "after", projection: { _id: 0 } });
    if (found) return found as HikTerminal;
    const fresh: HikTerminal = {
      id: await nextId(db, HIK_TERMINALS),
      deviceId,
      name: `Terminal ${deviceId}`,
      branchId: null,
      active: false,
      createdAt: now,
      ...set,
    };
    try {
      await col.insertOne({ ...fresh });
      return fresh;
    } catch (e) {
      if (!isDuplicateKey(e)) throw e;
    }
  }
  throw new Error("terminal yozuvi yaratilmadi");
}

interface Applied {
  status: HikEventStatus;
  personType?: "employee" | "student";
  personId?: number;
  kind?: "in" | "out";
  recordId?: number;
}

type Defer = (fn: () => Promise<void>) => void;

async function applyEmployee(
  db: Db,
  terminal: HikTerminal & { branchId: number },
  personId: number,
  ev: ParsedHikEvent,
  at: Date,
  receivedAt: Date,
  defer: Defer | null,
): Promise<Applied> {
  const base = { personType: "employee" as const, personId };
  const emp = await db.collection<HrEmployee>("hr_employees").findOne({ id: personId }, { projection: { _id: 0 } });
  if (!emp) return { status: "unknown_person", ...base };
  if (emp.archReason) return { status: "inactive_person", ...base };

  const { date } = uzDay(at);
  const today = await db
    .collection<AttendanceRecord>("turnstile_io")
    .findOne({ source: QR_SOURCE, date, employeeId: personId, branchId: terminal.branchId }, { projection: { _id: 0, enteredAt: 1, exitedAt: 1, enterTime: 1 } });
  const kind = decideKind(at, ev.attendanceStatus, today?.enterTime ? (today.enteredAt ?? null) : null, today?.exitedAt ?? null);
  // Mini App'da belgilangan, lekin `enteredAt` siz eski yozuv — keldi bor, takror deb olinadi.
  if (kind === "repeat" || (kind === "in" && today?.enterTime)) return { status: "repeat", ...base };

  const res = await markAttendance(db, emp as HrEmployee, kind, { now: at, terminal: { branchId: terminal.branchId, deviceId: terminal.deviceId } });
  if (!res.ok) return { status: "error", ...base };
  if (!res.fresh) return { status: "repeat", ...base, kind, recordId: res.record.id };

  // Kechikish xabari — faqat yangi voqeaga (ko'prik uzilib, keyin yetkazgan eski voqeaga emas).
  if (defer && res.kind === "in" && res.record.lateMinutes > 0 && receivedAt.getTime() - at.getTime() <= NOTIFY_MAX_AGE_MS) {
    const { record, branch } = res;
    const turi = emp.turi;
    defer(() => notifyLate(record, branch as AttendanceBranch, turi));
  }
  return { status: "applied", ...base, kind, recordId: res.record.id };
}

async function applyStudent(
  db: Db,
  terminal: HikTerminal & { branchId: number },
  personId: number,
  ev: ParsedHikEvent,
  at: Date,
): Promise<Applied> {
  const base = { personType: "student" as const, personId };
  const pupil = await db.collection("pupils").findOne({ id: personId }, { projection: { _id: 0, firstName: 1, lastName: 1 } });
  if (!pupil) return { status: "unknown_person", ...base };

  const col = db.collection<StudentPassRecord>("turnstile_io");
  const { date, hm } = uzDay(at);
  const key = { source: TERMINAL_SOURCE, date, studentId: personId, branchId: terminal.branchId } as const;
  const today = await col.findOne(key, { projection: { _id: 0 } });
  const kind = decideKind(at, ev.attendanceStatus, today?.enteredAt ?? null, today?.exitedAt ?? null);
  if (kind === "repeat") return { status: "repeat", ...base, recordId: today?.id };

  if (kind === "out" && today) {
    await col.updateOne(key, { $set: { exitTime: hm, exitedAt: at, exitDeviceId: terminal.deviceId } });
    return { status: "applied", ...base, kind, recordId: today.id };
  }

  const name = `${String(pupil.firstName ?? "")} ${String(pupil.lastName ?? "")}`.trim() || `O'quvchi #${personId}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const record: StudentPassRecord = {
      id: await nextId(db, "turnstile_io"),
      date,
      personName: name,
      personType: "student",
      enterTime: hm,
      exitTime: null,
      status: "kelgan",
      source: TERMINAL_SOURCE,
      studentId: personId,
      branchId: terminal.branchId,
      deviceId: terminal.deviceId,
      enteredAt: at,
    };
    try {
      await col.insertOne({ ...record });
      return { status: "applied", ...base, kind: "in", recordId: record.id };
    } catch (e) {
      if (!isDuplicateKey(e)) throw e;
      // Bir lahzada ikki voqea — birinchisi yozdi (noyob indeks: kuniga filialda bitta).
      const again = await col.findOne(key, { projection: { _id: 0, id: 1 } });
      if (again) return { status: "repeat", ...base, recordId: again.id };
    }
  }
  return { status: "error", ...base };
}

/** Natijani jurnal qatoriga yozadi (avvalgi urinishdan qolgan xato matni tozalanadi). */
function saveResult(db: Db, deviceId: string, key: string, res: Applied & { error?: string }) {
  return db
    .collection<HikEventRow>(HIK_EVENTS)
    .updateOne({ deviceId, key }, res.error ? { $set: res } : { $set: res, $unset: { error: "" } });
}

/** Bitta (jurnalga yozilgan) voqeani davomatga o'tkazadi. HECH QACHON OTILMAYDI. */
async function applyEvent(
  db: Db,
  terminal: HikTerminal,
  ev: ParsedHikEvent,
  at: Date,
  receivedAt: Date,
  defer: Defer | null,
): Promise<Applied & { error?: string }> {
  try {
    if (!ev.pass || !ev.employeeNo) return { status: "ignored" };
    if (receivedAt.getTime() - at.getTime() > MAX_AGE_MS) return { status: "too_old" };
    if (!terminal.active || terminal.branchId === null) return { status: "no_terminal" };
    const person = await db.collection<HikPerson>(HIK_PERSONS).findOne({ employeeNo: ev.employeeNo }, { projection: { _id: 0 } });
    if (!person) return { status: "unknown_person" };
    const bound = terminal as HikTerminal & { branchId: number };
    return person.personType === "employee"
      ? await applyEmployee(db, bound, person.personId, ev, at, receivedAt, defer)
      : await applyStudent(db, bound, person.personId, ev, at);
  } catch (e) {
    console.error("[hik] voqea davomatga yozilmadi:", e instanceof Error ? e.message : e);
    return { status: "error", error: e instanceof Error ? e.message.slice(0, 200) : "xato" };
  }
}

export interface IngestSummary {
  terminal: Pick<HikTerminal, "id" | "name" | "branchId" | "active">;
  /** Kelgan voqealar soni (o'qib bo'lmaganlari ham). */
  received: number;
  /** Holat → nechta. `duplicate` — avval qabul qilingan (ko'prik qayta yuborgan). */
  statuses: Record<string, number>;
}

/** Bir vaqtda ko'prikdan keladigan voqealar chegarasi. */
export const MAX_EVENTS_PER_CALL = 500;

/**
 * Ko'prikdan kelgan voqealarni qabul qiladi: jurnalga yozadi (takrorni
 * ushlaydi), davomatga o'tkazadi. Vaqt bo'yicha tartiblab — keldi ketdidan
 * oldin. `defer` — kechikish xabari javobdan keyin (route'da `after`).
 */
export async function ingestHikEvents(
  db: Db,
  deviceId: string,
  raws: readonly unknown[],
  opts: { now?: Date; defer?: Defer; info?: HikTerminal["info"] } = {},
): Promise<IngestSummary> {
  const receivedAt = opts.now ?? new Date();
  const terminal = await touchTerminal(db, deviceId, receivedAt, raws.length > 0, opts.info ?? null);
  const statuses: Record<string, number> = {};
  const bump = (s: string) => (statuses[s] = (statuses[s] ?? 0) + 1);

  const parsed = raws
    .slice(0, MAX_EVENTS_PER_CALL)
    .map((raw) => parseHikEvent(raw))
    .flatMap((ev) => {
      if (!ev) {
        bump("unreadable");
        return [];
      }
      return [{ ev, at: effectiveTime(ev, receivedAt) }];
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const events = db.collection<HikEventRow>(HIK_EVENTS);
  for (const { ev, at } of parsed) {
    // Odamsiz qurilma voqealari (eshik ochildi/yopildi, notanish yuz) — jurnalga ham yozilmaydi:
    // har o'tishda bir nechtadan keladi. Odamli, lekin noma'lum kodli o'tish jurnalda `ignored` bo'ladi.
    if (!ev.pass && !ev.employeeNo) {
      bump("skipped");
      continue;
    }
    const key = hikEventKey(ev, at);
    const row: HikEventRow = {
      deviceId,
      key,
      serialNo: ev.serialNo,
      at,
      receivedAt,
      major: ev.major,
      minor: ev.minor,
      employeeNo: ev.employeeNo,
      name: ev.name,
      verifyMode: ev.verifyMode,
      attendanceStatus: ev.attendanceStatus,
      status: "pending",
    };
    try {
      await events.insertOne({ ...row });
    } catch (e) {
      if (!isDuplicateKey(e)) throw e;
      bump("duplicate");
      continue;
    }
    const res = await applyEvent(db, terminal, ev, at, receivedAt, opts.defer ?? null);
    await saveResult(db, deviceId, key, res);
    bump(res.status);
  }

  return {
    terminal: { id: terminal.id, name: terminal.name, branchId: terminal.branchId, active: terminal.active },
    received: raws.length,
    statuses,
  };
}

/**
 * Jurnalda qolib ketgan voqealarni qayta o'tkazadi — terminal filialga
 * biriktirilgach yoki odam bog'langach (`hik_persons`). Xabar yuborilmaydi
 * (eski voqealar). Faqat oxirgi `MAX_AGE_MS` ichidagilari.
 */
export async function replayHikEvents(db: Db, deviceId: string, now = new Date()): Promise<Record<string, number>> {
  const terminal = await db.collection<HikTerminal>(HIK_TERMINALS).findOne({ deviceId }, { projection: { _id: 0 } });
  const statuses: Record<string, number> = {};
  if (!terminal) return statuses;
  const events = db.collection<HikEventRow>(HIK_EVENTS);
  const rows = await events
    .find({ deviceId, status: { $in: RETRYABLE }, at: { $gte: new Date(now.getTime() - MAX_AGE_MS) } }, { projection: { _id: 0 } })
    .sort({ at: 1 })
    .toArray();
  for (const row of rows) {
    const ev: ParsedHikEvent = {
      serialNo: row.serialNo,
      at: row.at,
      major: row.major,
      minor: row.minor,
      employeeNo: row.employeeNo,
      name: row.name,
      verifyMode: row.verifyMode,
      attendanceStatus: row.attendanceStatus,
      pass: row.major === MAJOR_EVENT && row.minor !== null && PASS_MINORS.has(row.minor) && row.employeeNo !== null,
    };
    const res = await applyEvent(db, terminal as HikTerminal, ev, row.at, now, null);
    await saveResult(db, deviceId, row.key, res);
    statuses[res.status] = (statuses[res.status] ?? 0) + 1;
  }
  return statuses;
}
