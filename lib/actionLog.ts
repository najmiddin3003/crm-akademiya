import { ObjectId, type Db } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import type { SessionPayload } from "@/lib/session";

// AMALLAR JURNALI (10.10.2026) — CRM'da kim, qachon, nima qilgani bazaga
// yoziladi (`action_log`). Foydalanuvchi: «qanaqa amal bajarilayotgan
// bo'lsa kimning akkauntidan ekanligini db ga yozib borilishi ham kerak».
//
// NEGA KERAK: 15.09.2026 da Oylik tarixidan yozuv o'chirilgan va kim
// o'chirgani faqat nginx jurnalidan (IP bo'yicha) taxmin qilingan edi
// (memory: avgust-yopish-ochirildi). Bazada iz yo'q edi.
//
// QAYERDAN YOZILADI:
//   • proxy.ts — CRM'dagi HAR BIR o'zgartiruvchi /api so'rov (POST, PUT,
//     PATCH, DELETE): kim (hisob), qayerdan (IP, qurilma), qaysi filial,
//     nima yuborildi (parollarsiz). Rad etilgan urinishlar (401/403) ham.
//     Route'larga tegmaydi — 160+ faylning birortasini unutib bo'lmaydi.
//   • kirish (app/api/auth/login) — muvaffaqiyatli va xato urinishlar;
//   • Telegram bot (kassa kirim/chiqim/o'tkazma, lid), guruh botidagi lid
//     tugmalari, «Ishga keldim» QR — ular CRM sessiyasisiz keladi, shu bois
//     amal bajarilgan joyda o'z xodimi bilan yoziladi;
//   • tizimning o'zi (muddati o'tgan topshiriq jarimasi) — «tizim».
//
// YOZUV HECH QACHON AMALNI TO'XTATMAYDI: xato yutiladi va konsolga chiqadi.
// 1 yil saqlanadi (lib/mongodb.ts → TTL). Ko'rish: admin uchun «Amallar
// jurnali» sahifasi (/amallar-jurnali).

export const ACTION_LOG = "action_log";

export type ActorKind = "user" | "bot" | "miniapp" | "public" | "system";

export interface ActionActor {
  kind: ActorKind;
  /** `users._id` (satr). */
  userId?: string | null;
  /** `hr_employees.id`. */
  employeeId?: number | null;
  /** O'sha paytdagi ism (keyin o'zgarsa ham iz qoladi). */
  name?: string | null;
  role?: string | null;
  /** Kirish urinishi yoki bot uchun telefon. */
  phone?: string | null;
  /** Telegram foydalanuvchi id'si (bot). */
  tgId?: number | null;
}

export type ActionSource = "web" | "bot" | "miniapp" | "cron" | "public";

export interface ActionEvent {
  actor: ActionActor;
  source: ActionSource;
  /** Bo'lim kaliti — API yo'lining birinchi segmenti ("cashboxes", "orders"). */
  section: string;
  /** HTTP usuli (POST/PUT/PATCH/DELETE) yoki maxsus amal ("login", "kirim" …). */
  action: string;
  path?: string;
  query?: string;
  /** Obyekt id'si (yo'ldan: /api/cashboxes/5/adjust → "5"). */
  target?: string | null;
  /** Ma'lum bo'lsa javob holati; proxy o'tkazib yuborgan so'rovda `null`. */
  status?: number | null;
  /** Ruxsat berilmagan urinish (401/403). */
  denied?: boolean;
  ip?: string | null;
  ua?: string | null;
  sid?: string | null;
  /** Navbardagi filial (cookie). */
  branchId?: number | null;
  /** Yuborilgan ma'lumot — parollarsiz, qisqartirilgan (`redactForLog`). */
  body?: unknown;
  /** Amal joyidan qo'shimcha (summa, kassa, yozuv id'si …). */
  details?: Record<string, unknown>;
  /**
   * Tahrir/o'chirishdan OLDINGI holat — faqat tanadagi maydonlar va nomi (proxy, 25.10.2026;
   * lib/actionLogSnapshot.ts). «Amallar jurnali» «oldin → keyin» farqini shundan ko'rsatadi.
   */
  before?: Record<string, unknown>;
}

/** Jurnalga yozadi. Hech qachon xato otmaydi. */
export async function logAction(db: Db, ev: ActionEvent): Promise<void> {
  try {
    await db.collection(ACTION_LOG).insertOne({ at: new Date(), ...ev });
  } catch (e) {
    console.error("[action-log] yozilmadi:", (e as Error)?.message ?? e);
  }
}

/** `logAction` — bazani o'zi oladi (proxy va yordamchi joylar uchun). */
export async function recordAction(ev: ActionEvent): Promise<void> {
  try {
    await logAction(await ensureIndexes(), ev);
  } catch (e) {
    console.error("[action-log] baza yo'q:", (e as Error)?.message ?? e);
  }
}

// ── Yuborilgan ma'lumotni xavfsiz qilish ───────────────────────────────

/** Qiymati yozilmaydigan kalitlar: parol, kod, token, Telegram imzosi … */
const SECRET_KEY = /pass|parol|pwd|secret|token|otp|cookie|session|initdata|hash|^code$|smscode|^pin$|pincode|cvv|api_?key|private_?key/i;
const MAX_STR = 300;
const MAX_ARRAY = 40;
const MAX_DEPTH = 5;
const MAX_JSON = 6_000;

function redactValue(v: unknown, depth: number): unknown {
  if (v === null || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "string") return v.length > MAX_STR ? `${v.slice(0, MAX_STR)}… (+${v.length - MAX_STR})` : v;
  if (depth >= MAX_DEPTH) return "[…]";
  if (Array.isArray(v)) {
    const head = v.slice(0, MAX_ARRAY).map((x) => redactValue(x, depth + 1));
    return v.length > MAX_ARRAY ? [...head, `… yana ${v.length - MAX_ARRAY} ta`] : head;
  }
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? "***" : redactValue(x, depth + 1);
    }
    return out;
  }
  return String(v);
}

/**
 * Jurnal uchun: sir kalitlar «***», uzun satr va ro'yxatlar qisqartiriladi.
 * Juda katta tana — faqat kalitlari.
 */
export function redactForLog(value: unknown): unknown {
  const red = redactValue(value, 0);
  try {
    if (JSON.stringify(red).length <= MAX_JSON) return red;
  } catch {
    return "[o'qib bo'lmadi]";
  }
  if (red && typeof red === "object" && !Array.isArray(red)) {
    return { _qisqartirildi: true, kalitlar: Object.keys(red as Record<string, unknown>).slice(0, 60) };
  }
  return "[juda katta]";
}

/** JSON tanani o'qilgan matndan jurnalga tayyorlaydi (JSON bo'lmasa — yozilmaydi). */
export function bodyForLog(text: string | null): unknown {
  if (!text) return undefined;
  try {
    return redactForLog(JSON.parse(text));
  } catch {
    return undefined;
  }
}

// ── Yo'ldan bo'lim va obyekt ───────────────────────────────────────────

/** "/api/cashboxes/5/adjust" → { section: "cashboxes", target: "5" }. */
export function sectionOf(path: string): { section: string; target: string | null } {
  const parts = path.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const section = parts[0] ?? "";
  const target = parts.slice(1).find((p) => /^\d+$/.test(p) || /^[0-9a-f]{24}$/i.test(p)) ?? null;
  return { section, target };
}

// ── Sessiya egasi (proxy) ──────────────────────────────────────────────

const actorCache = new Map<string, { at: number; actor: ActionActor }>();
const ACTOR_TTL_MS = 60_000;

/**
 * Sessiya egasini ism bilan: `users` (fullName, hrEmployeeId) va xodim ismi.
 * Qisqa keshli — har so'rovda bazaga bormaydi. Topilmasa — tokendagi
 * ma'lumot (uid, rol, telefon) bilan.
 */
export async function actorForSession(db: Db, s: SessionPayload): Promise<ActionActor> {
  const now = Date.now();
  const hit = actorCache.get(s.uid);
  if (hit && now - hit.at < ACTOR_TTL_MS) return hit.actor;
  const base: ActionActor = { kind: "user", userId: s.uid, role: s.role ?? null, phone: s.phone ?? null };
  let actor = base;
  try {
    if (ObjectId.isValid(s.uid)) {
      const u = await db
        .collection("users")
        .findOne({ _id: new ObjectId(s.uid) }, { projection: { fullName: 1, role: 1, hrEmployeeId: 1 } });
      const empId = Number(u?.hrEmployeeId);
      const emp = Number.isFinite(empId)
        ? await db.collection("hr_employees").findOne({ id: empId }, { projection: { _id: 0, name: 1 } })
        : null;
      actor = {
        ...base,
        role: (u?.role as string | undefined) ?? base.role,
        employeeId: Number.isFinite(empId) ? empId : null,
        name: String(emp?.name ?? u?.fullName ?? "").trim() || null,
      };
    }
  } catch {
    // Ism topilmadi — tokendagi bilan yoziladi.
  }
  actorCache.set(s.uid, { at: now, actor });
  if (actorCache.size > 500) {
    for (const [k, v] of actorCache) if (now - v.at >= ACTOR_TTL_MS) actorCache.delete(k);
  }
  return actor;
}

/** So'rov manzili: nginx `X-Real-IP` (soxtalashtirib bo'lmaydi), keyin XFF. */
export function clientIp(headers: Headers): string | null {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || null;
}

export function clientUa(headers: Headers): string | null {
  const ua = headers.get("user-agent");
  return ua ? ua.slice(0, 300) : null;
}
