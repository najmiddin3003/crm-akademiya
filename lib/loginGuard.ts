import { createHash, randomBytes } from "node:crypto";
import type { Db, Document, WithId } from "mongodb";
import { describeUserAgent } from "@/lib/userSessions";
import { clientIp, clientUa } from "@/lib/actionLog";
import { CENTER_SHORT } from "@/lib/center";
import { esc } from "@/lib/telegramApi";
import { loadStaffBotConfig } from "@/lib/staffBot/config";
import { sendToStaff } from "@/lib/staffBot/api";
import { STAFF_BOT_USERS } from "@/lib/staffBot/session";
import { uzStamp } from "@/lib/uzTime";

// KIRISH OYNASI QOROVULI — noto'g'ri parol uchun bosqichma-bosqich blok
// (loyiha egasi, 15.11.2026).
//
// QOIDA (har bir «IP + qurilma» juftligi uchun alohida):
//   1-bosqich: 5 ta noto'g'ri urinish → 15 daqiqa blok;
//   2-bosqich: blokdan keyin yana 3 ta → 1 soat;
//   3-bosqich: undan keyin 1 ta → 1 kun;
//   4-bosqich va keyingilari: 5 ta → yana 1 kun.
// Bloklar zanjiri BIRINCHI BLOKDAN 72 soat o'tgach (blok tugagan bo'lsa)
// to'liq tozalanadi — keyingi xatolar yana 15 daqiqalik bosqichdan
// boshlanadi. Hali blok bo'lmagan xatolar ham oxirgi xatodan 72 soat o'tib
// unutiladi.
//
// NEGA «IP + QURILMA» JUFTLIGI (egasi tanladi): filialdagi kompyuterlar
// internetga odatda BITTA IP orqali chiqadi. Faqat IP bo'yicha bloklansa,
// bitta xodim parolini unutgani uchun butun filial kira olmay qolardi.
// Qurilma — `tizimli_did` cookie'si (tasodifiy id, 2 yil). Cookie'siz
// so'rovlar (skript) shu IP va brauzer satri (user-agent) bo'yicha bitta
// qurilma sanaladi — ya'ni cookie yubormaydigan oddiy skript ham 5 ta
// urinishda bloklanadi.
//
// IP ZAXIRA CHEGARASI (aylanib o'tishga qarshi): cookie va brauzer satrini
// har safar almashtirib yuboradigan skript har urinishda «yangi qurilma»
// bo'lib ko'rinadi. Shu bois bitta IP'dan 1 soatda 20 ta xato bo'lsa, shu
// IP 1 soatga butunlay bloklanadi. Odamlar bunga yetmaydi: bitta ofisdan
// soatiga 20 ta noto'g'ri parol — bu terib chiqish.
//
// NIMA XATO SANALADI: hisob topilmadi, parol noto'g'ri, hisob faol emas
// (javobi bir xil — «Telefon raqam yoki parol noto'g'ri»). Muzlatilgan /
// bloklangan hisob va admin tasdig'i kutilayotgani SANALMAYDI — u yerda
// parol so'ralmaydi yoki to'g'ri bo'lgan.
//
// TO'G'RI KIRISH joriy bosqichdagi xatolarni nolga tushiradi, lekin
// bosqichni (nechta blok bo'lganini) EMAS: aks holda o'z hisobi bor odam
// har 4 xatodan keyin o'zi kirib, birovning parolini cheksiz terardi.
// Hali blok bo'lmagan qurilmada to'g'ri kirish yozuvni butunlay o'chiradi.
//
// SHUBHALI KIRISH: 2-blokdan boshlab (egasi tanladi) har bir blok
// `suspicious_logins` ga yoziladi va xodimlar boti (@akademiya_crm_bot)
// orqali egaga (Telegram @zovaxx) xabar ketadi. IP zaxira chegarasi ham
// shubhali sanaladi. Bot faqat o'ziga /start bosgan odamga yoza oladi —
// qabul qiluvchi `staff_bot_users.tgUsername` dan topiladi.

export const LOGIN_GUARD = "login_guard";
export const SUSPICIOUS_LOGINS = "suspicious_logins";
export const DEVICE_COOKIE = "tizimli_did";
export const DEVICE_COOKIE_MAX_AGE = 2 * 365 * 24 * 60 * 60;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Bosqichlar: shu bosqichda nechta xato → necha vaqtga blok. Oxirgisi takrorlanadi. */
export const GUARD_STEPS: readonly { fails: number; blockMs: number }[] = [
  { fails: 5, blockMs: 15 * MIN },
  { fails: 3, blockMs: HOUR },
  { fails: 1, blockMs: DAY },
  { fails: 5, blockMs: DAY },
];
/** Birinchi blokdan shuncha vaqt o'tgach zanjir tozalanadi. */
export const GUARD_RESET_MS = 72 * HOUR;
/** Shu raqamli blokdan boshlab «shubhali kirish» (1 — har blok). */
export const SUSPICIOUS_FROM_BLOCK = 2;
/** IP zaxira chegarasi — bitta IP'dan `windowMs` ichida `fails` ta xato → `blockMs`. */
export const IP_BACKSTOP = { fails: 20, windowMs: HOUR, blockMs: HOUR } as const;

/** Yozuv shuncha vaqt saqlanadi (TTL) — 72 soatlik zanjir + eng uzun blok. */
const DOC_TTL_MS = GUARD_RESET_MS + 2 * DAY;
/** Juftlik yozuvida saqlanadigan urinilgan raqamlar soni. */
const PHONES_KEPT = 10;

// ── Sof hisob (bazasiz — sinovda to'g'ridan-to'g'ri chaqiriladi) ────────

export interface GuardState {
  /** Joriy bosqichdagi xatolar. */
  fails: number;
  /** Zanjirdagi bloklar soni (0 — hali blok bo'lmagan). */
  blocks: number;
  /** Birinchi blok vaqti (ms); blok bo'lmagan bo'lsa null. */
  cycleStart: number | null;
  /** Blok tugash vaqti (ms). */
  blockedUntil: number | null;
  lastFailAt: number | null;
  /** Zanjirdagi jami xatolar (xabar uchun). */
  totalFails: number;
}

export const FRESH_STATE: GuardState = {
  fails: 0,
  blocks: 0,
  cycleStart: null,
  blockedUntil: null,
  lastFailAt: null,
  totalFails: 0,
};

/** Vaqt o'tishi bilan tozalash: tugagan zanjir yoki unutilgan xatolar. */
export function settleState(s: GuardState | null, now: number): GuardState {
  if (!s) return FRESH_STATE;
  if (s.blockedUntil !== null && s.blockedUntil > now) return s;
  if (s.blocks > 0 && s.cycleStart !== null && now - s.cycleStart >= GUARD_RESET_MS) return FRESH_STATE;
  if (s.blocks === 0 && s.lastFailAt !== null && now - s.lastFailAt >= GUARD_RESET_MS) return FRESH_STATE;
  return s;
}

/** Hozir blokmi — bo'lsa tugash vaqti. */
export function blockedUntilOf(s: GuardState | null, now: number): number | null {
  return s && s.blockedUntil !== null && s.blockedUntil > now ? s.blockedUntil : null;
}

export interface NewBlock {
  /** Zanjirdagi nechanchi blok (1 dan). */
  number: number;
  ms: number;
  until: number;
}

/** Bitta noto'g'ri urinish. Blok tushsa — `block` bor. */
export function applyFailure(s0: GuardState | null, now: number): { state: GuardState; block: NewBlock | null } {
  const s = settleState(s0, now);
  if (blockedUntilOf(s, now) !== null) return { state: s, block: null };
  const step = GUARD_STEPS[Math.min(s.blocks, GUARD_STEPS.length - 1)];
  const fails = s.fails + 1;
  const base: GuardState = { ...s, fails, lastFailAt: now, totalFails: s.totalFails + 1 };
  if (fails < step.fails) return { state: base, block: null };
  const number = s.blocks + 1;
  const until = now + step.blockMs;
  return {
    state: { ...base, fails: 0, blocks: number, cycleStart: s.cycleStart ?? now, blockedUntil: until },
    block: { number, ms: step.blockMs, until },
  };
}

/** To'g'ri kirish. `null` — yozuvni o'chirish (blok bo'lmagan). */
export function applySuccess(s0: GuardState | null, now: number): GuardState | null {
  const s = settleState(s0, now);
  if (s.blocks === 0) return null;
  return { ...s, fails: 0 };
}

export interface IpState {
  windowStart: number;
  fails: number;
  blockedUntil: number | null;
}

/** IP zaxira chegarasi: sirpanmaydigan oyna — birinchi xatodan `windowMs`. */
export function applyIpFailure(s: IpState | null, now: number): { state: IpState; block: NewBlock | null } {
  if (s && s.blockedUntil !== null && s.blockedUntil > now) return { state: s, block: null };
  const fresh = !s || now - s.windowStart >= IP_BACKSTOP.windowMs;
  const cur: IpState = fresh ? { windowStart: now, fails: 0, blockedUntil: null } : s;
  const fails = cur.fails + 1;
  if (fails < IP_BACKSTOP.fails) return { state: { ...cur, fails }, block: null };
  const until = now + IP_BACKSTOP.blockMs;
  return { state: { windowStart: now, fails: 0, blockedUntil: until }, block: { number: 1, ms: IP_BACKSTOP.blockMs, until } };
}

// ── So'rovdan kontekst ──────────────────────────────────────────────

export interface GuardContext {
  ip: string;
  /** Juftlik kaliti uchun qurilma: cookie id yoki `ua:<xesh>`. */
  device: string;
  /** Javobga yoziladigan yangi cookie qiymati (cookie yo'q edi). */
  setDevice: string | null;
  ua: string;
}

const DEVICE_RE = /^[a-f0-9]{32}$/;

function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function guardContext(req: Request): GuardContext {
  const ip = clientIp(req.headers) ?? "noip";
  const ua = clientUa(req.headers) ?? "";
  const m = /(?:^|;\s*)tizimli_did=([^;]+)/.exec(req.headers.get("cookie") ?? "");
  const did = m && DEVICE_RE.test(m[1]) ? m[1] : null;
  if (did) return { ip, device: did, setDevice: null, ua };
  // Cookie yo'q: shu urinish IP + brauzer satri bo'yicha sanaladi, keyingilari — yangi cookie bilan.
  return { ip, device: `ua:${sha(ua).slice(0, 16)}`, setDevice: randomBytes(16).toString("hex"), ua };
}

const pairKey = (ctx: GuardContext) => `p:${sha(`${ctx.ip}|${ctx.device}`)}`;
const ipKey = (ctx: GuardContext) => `i:${sha(ctx.ip)}`;

// ── Baza ────────────────────────────────────────────────────────────

interface GuardDoc extends GuardState {
  key: string;
  kind: "pair";
  ip: string;
  device: string;
  ua: string;
  phones: string[];
  v: number;
  updatedAt: Date;
  expireAt: Date;
}

interface IpDoc extends IpState {
  key: string;
  kind: "ip";
  ip: string;
  v: number;
  updatedAt: Date;
  expireAt: Date;
}

const stateOf = (d: Partial<GuardState> | null): GuardState | null =>
  d
    ? {
        fails: Number(d.fails) || 0,
        blocks: Number(d.blocks) || 0,
        cycleStart: typeof d.cycleStart === "number" ? d.cycleStart : null,
        blockedUntil: typeof d.blockedUntil === "number" ? d.blockedUntil : null,
        lastFailAt: typeof d.lastFailAt === "number" ? d.lastFailAt : null,
        totalFails: Number(d.totalFails) || 0,
      }
    : null;

const ipStateOf = (d: Partial<IpState> | null): IpState | null =>
  d
    ? {
        windowStart: Number(d.windowStart) || 0,
        fails: Number(d.fails) || 0,
        blockedUntil: typeof d.blockedUntil === "number" ? d.blockedUntil : null,
      }
    : null;

/**
 * O'qi → hisobla → yoz, `v` (versiya) bilan: bir vaqtda kelgan ikki urinish
 * bir-birining sanog'ini yo'qotmasin. Ziddiyatda qayta o'qiladi (3 marta).
 */
async function mutate<D extends { key: string; v: number }, R>(
  db: Db,
  key: string,
  fn: (doc: WithId<D> | null) => { set: Omit<D, "key" | "v"> | null; result: R },
): Promise<R> {
  const col = db.collection(LOGIN_GUARD);
  let last: R | undefined;
  for (let i = 0; i < 3; i++) {
    const doc = (await col.findOne({ key })) as WithId<D> | null;
    const { set, result } = fn(doc);
    last = result;
    if (set === null) {
      if (doc) await col.deleteOne({ key, v: doc.v });
      return result;
    }
    if (!doc) {
      try {
        await col.insertOne({ ...(set as Document), key, v: 1 });
        return result;
      } catch (e) {
        if ((e as { code?: number }).code === 11000) continue; // parallel yozildi — qayta o'qiymiz
        throw e;
      }
    }
    const r = await col.updateOne({ key, v: doc.v }, { $set: set as Document, $inc: { v: 1 } });
    if (r.matchedCount > 0) return result;
  }
  return last as R;
}

/** Hozir bloklanganmi (juftlik yoki IP) — tugash vaqti. */
export async function loginBlockedUntil(db: Db, ctx: GuardContext, now = Date.now()): Promise<number | null> {
  const docs = await db
    .collection(LOGIN_GUARD)
    .find({ key: { $in: [pairKey(ctx), ipKey(ctx)] } }, { projection: { _id: 0, kind: 1, blockedUntil: 1 } })
    .toArray();
  let until: number | null = null;
  for (const d of docs) {
    const b = typeof d.blockedUntil === "number" && d.blockedUntil > now ? d.blockedUntil : null;
    if (b !== null && (until === null || b > until)) until = b;
  }
  return until;
}

export interface FailureOutcome {
  /** Shu urinish blok tushirdi yoki blok allaqachon bor — tugash vaqti. */
  blockedUntil: number | null;
  /** Shu urinishda tushgan juftlik bloki. */
  block: NewBlock | null;
  /** Shu urinishda tushgan IP bloki. */
  ipBlock: NewBlock | null;
  /** Zanjirdagi jami xatolar va urinilgan raqamlar — xabar uchun. */
  totalFails: number;
  phones: string[];
}

/**
 * Cookie'siz urinish (brauzer birinchi marta keldi): holat `ua:` kalitida
 * hisoblandi, javob esa yangi cookie beradi — keyingi urinishlar o'sha
 * cookie kalitida. Sanoq ikkiga bo'linmasin deb holat yangi kalitga ham yoziladi.
 */
async function seedNewDevice(db: Db, ctx: GuardContext, set: Document): Promise<void> {
  if (!ctx.setDevice) return;
  const key = pairKey({ ...ctx, device: ctx.setDevice });
  await db.collection(LOGIN_GUARD).insertOne({ ...set, device: ctx.setDevice, key, v: 1 }).catch(() => {});
}

export async function registerLoginFailure(db: Db, ctx: GuardContext, phone: string, now = Date.now()): Promise<FailureOutcome> {
  const expireAt = new Date(now + DOC_TTL_MS);
  const pair = await mutate<GuardDoc, { state: GuardState; block: NewBlock | null; phones: string[]; set: Document }>(db, pairKey(ctx), (doc) => {
    const { state, block } = applyFailure(stateOf(doc), now);
    // Zanjir tozalangan bo'lsa (settleState → FRESH_STATE) eski raqamlar ham unutiladi.
    const prev = doc && settleState(stateOf(doc), now) !== FRESH_STATE ? (doc.phones ?? []) : [];
    const phones = [phone, ...prev.filter((p) => p !== phone)].slice(0, PHONES_KEPT);
    const set = { ...state, kind: "pair" as const, ip: ctx.ip, device: ctx.device, ua: ctx.ua, phones, updatedAt: new Date(now), expireAt };
    return { set, result: { state, block, phones, set } };
  });
  await seedNewDevice(db, ctx, pair.set);
  const ip = await mutate<IpDoc, { state: IpState; block: NewBlock | null }>(db, ipKey(ctx), (doc) => {
    const { state, block } = applyIpFailure(ipStateOf(doc), now);
    return {
      set: { ...state, kind: "ip", ip: ctx.ip, updatedAt: new Date(now), expireAt: new Date(now + IP_BACKSTOP.windowMs + IP_BACKSTOP.blockMs + DAY) },
      result: { state, block },
    };
  });
  const untils = [blockedUntilOf(pair.state, now), ip.state.blockedUntil !== null && ip.state.blockedUntil > now ? ip.state.blockedUntil : null]
    .filter((x): x is number => x !== null);
  return {
    blockedUntil: untils.length ? Math.max(...untils) : null,
    block: pair.block,
    ipBlock: ip.block,
    totalFails: pair.state.totalFails,
    phones: pair.phones,
  };
}

export async function registerLoginSuccess(db: Db, ctx: GuardContext, now = Date.now()): Promise<void> {
  const kept = await mutate<GuardDoc, Document | null>(db, pairKey(ctx), (doc) => {
    if (!doc) return { set: null, result: null };
    const next = applySuccess(stateOf(doc), now);
    if (next === null) return { set: null, result: null };
    const set = { ...next, kind: "pair" as const, ip: doc.ip, device: doc.device, ua: doc.ua, phones: doc.phones ?? [], updatedAt: new Date(now), expireAt: doc.expireAt };
    return { set, result: set };
  });
  // Bosqich (blocks) yangi cookie'ga ham o'tadi.
  if (kept) await seedNewDevice(db, ctx, kept);
}

// ── Javob matni ─────────────────────────────────────────────────────

/** "18:40" (bugun) yoki "16.11.2026 18:40". */
export function untilLabel(until: number, now = Date.now()): string {
  const [day, time] = uzStamp(new Date(until)).split(" | ");
  const [today] = uzStamp(new Date(now)).split(" | ");
  return day === today ? time : `${day} ${time}`;
}

/** Blok xabari — messages/en.json da `{until}` andozasi (teskari moslash). */
export function blockedMessage(until: number, now = Date.now()): string {
  return `Juda ko'p noto'g'ri urinish. Kirish ${untilLabel(until, now)} gacha bloklandi.`;
}

// ── Shubhali kirish: yozuv + Telegram ───────────────────────────────

function durationLabel(ms: number): string {
  if (ms >= DAY) return `${Math.round(ms / DAY)} kun`;
  if (ms >= HOUR) return `${Math.round(ms / HOUR)} soat`;
  return `${Math.round(ms / MIN)} daqiqa`;
}

/** Qabul qiluvchilar: `SECURITY_ALERT_TG` (vergul bilan, @siz), sukut — zovaxx. */
function alertUsernames(): string[] {
  const raw = (process.env.SECURITY_ALERT_TG || "zovaxx").split(",");
  return raw.map((s) => s.trim().replace(/^@/, "")).filter((s) => /^[A-Za-z0-9_]{3,64}$/.test(s));
}

export interface SuspiciousInput {
  ctx: GuardContext;
  /** Juftlik bloki (2-blokdan) yoki IP zaxira bloki. */
  kind: "pair" | "ip";
  block: NewBlock;
  totalFails: number;
  phones: string[];
}

/** Bloklar zanjirida shubhali deb yozilishi kerakmi. */
export function isSuspicious(out: FailureOutcome): boolean {
  return (out.block !== null && out.block.number >= SUSPICIOUS_FROM_BLOCK) || out.ipBlock !== null;
}

/**
 * `suspicious_logins` ga yozadi va egaga Telegram xabar yuboradi. HECH QACHON
 * otmaydi — javobdan keyin (`after`) chaqiriladi, kirish sekinlashmaydi.
 */
export async function reportSuspiciousLogin(db: Db, input: SuspiciousInput, now = Date.now()): Promise<void> {
  try {
    const users = await db
      .collection("users")
      .find({ phone: { $in: input.phones } }, { projection: { _id: 1, phone: 1, fullName: 1, hrEmployeeId: 1 } })
      .toArray();
    const empIds = users.map((u) => Number(u.hrEmployeeId)).filter((n) => Number.isFinite(n));
    const emps = empIds.length
      ? await db.collection("hr_employees").find({ id: { $in: empIds } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray()
      : [];
    const nameOf = (phone: string): string | null => {
      const u = users.find((x) => x.phone === phone);
      if (!u) return null;
      const e = emps.find((x) => x.id === Number(u.hrEmployeeId));
      return String(e?.name ?? u.fullName ?? "").trim() || null;
    };
    const targets = input.phones.map((phone) => ({ phone, name: nameOf(phone), userId: users.find((x) => x.phone === phone)?._id?.toString() ?? null }));

    const doc = {
      at: new Date(now),
      kind: input.kind,
      blockNumber: input.block.number,
      blockMinutes: Math.round(input.block.ms / MIN),
      blockedUntil: new Date(input.block.until),
      ip: input.ctx.ip,
      device: input.ctx.device,
      ua: input.ctx.ua,
      deviceLabel: describeUserAgent(input.ctx.ua),
      failsInCycle: input.totalFails,
      targets,
      notify: { ok: false, error: "" as string, chatIds: 0 },
    };
    const ins = await db.collection(SUSPICIOUS_LOGINS).insertOne(doc);

    const html = [
      `<b>Shubhali kirish urinishi — ${esc(CENTER_SHORT)}</b>`,
      input.kind === "ip"
        ? `Blok: IP butunlay — ${esc(durationLabel(input.block.ms))} (bitta IP'dan 1 soatda ${IP_BACKSTOP.fails} ta xato)`
        : `Blok: ${input.block.number}-blok — ${esc(durationLabel(input.block.ms))}`,
      `Blok tugashi: ${esc(uzStamp(new Date(input.block.until)))}`,
      input.kind === "pair" ? `Noto'g'ri urinishlar: ${input.totalFails} ta (shu zanjirda)` : "",
      `IP: <code>${esc(input.ctx.ip)}</code>`,
      `Qurilma: ${esc(describeUserAgent(input.ctx.ua))}`,
      targets.length
        ? `Urinilgan raqamlar: ${targets.map((t) => esc(t.name ? `${t.phone} (${t.name})` : `${t.phone} (hisob yo'q)`)).join(", ")}`
        : "",
      `Vaqt: ${esc(uzStamp(new Date(now)))}`,
    ]
      .filter(Boolean)
      .join("\n");

    const names = alertUsernames();
    const rows = names.length
      ? await db
          .collection(STAFF_BOT_USERS)
          .find(
            { blocked: { $ne: true }, tgUsername: { $in: names.map((n) => new RegExp(`^@?${n}$`, "i")) } },
            { projection: { _id: 0, chatId: 1 } },
          )
          .toArray()
      : [];
    const chatIds = [...new Set(rows.map((r) => Number(r.chatId)).filter((n) => Number.isFinite(n)))];
    let ok = false;
    let error = chatIds.length ? "" : `qabul qiluvchi topilmadi (@${names.join(", @")} botga /start bosmagan)`;
    const cfg = loadStaffBotConfig();
    for (const chatId of chatIds) {
      const sent = await sendToStaff(cfg, chatId, html);
      if (sent.ok) ok = true;
      else error = sent.error;
    }
    await db.collection(SUSPICIOUS_LOGINS).updateOne(
      { _id: ins.insertedId },
      { $set: { notify: { ok, error: ok ? "" : error, chatIds: chatIds.length } } },
    );
    if (!ok) console.error("[login-guard] shubhali kirish xabari ketmadi:", error);
  } catch (e) {
    console.error("[login-guard] shubhali kirish yozilmadi:", e instanceof Error ? e.message : e);
  }
}
