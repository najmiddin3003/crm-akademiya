import type { Db } from "mongodb";
import { branchInCondition } from "@/lib/branchScope";
import { monthlyPriceFor, type PricedCourse } from "@/lib/coursePrice";
import { GROUP_MEMBERSHIPS } from "@/lib/groupMembership";
import { groupLabel } from "@/lib/groups";
import { holatOf, type HolatSource } from "@/lib/leadHolat";
import { pupilFullName } from "@/lib/pupilsData";
import { uzDateIso, uzTimeHm } from "@/lib/uzTime";
import {
  DEFAULT_REF_SETTINGS,
  REF_KINDS,
  type LinkRow,
  type RefGift,
  type RefKind,
  type RefLink,
  type RefRequest,
  type RefSettings,
  type RefState,
  type RefVia,
  type Referrer,
  type ReferralsPayload,
  type ReferrerRow,
} from "@/lib/referralTypes";

// REFERAL DASTURI (29-qism, rasmlar «Referallar» × 3 tab, «Taklif qiluvchi», «Referal biriktirish», «Sozlamalar ·
// Referal dasturi»).
//
// • TAKLIF QILUVCHI (`ref_referrers`) — maktab ustozi, o'quvchi, ota-ona yoki boshqa odam; har biriga noyob KOD
//   (ISM + raqam, masalan DIYORA27). Havola — ochiq so'rovnoma sahifasi `/sorovnoma?ref=KOD`: shu orqali kelgan
//   lid taklif qiluvchiga o'zi yoziladi (`linkByCode`).
// • TAKLIF (`ref_links`) — kim kimni olib keldi: lid va/yoki o'quvchi, qanday (kod / havola / tavsiya /
//   sertifikat raqami). Qo'lda «Biriktirish» ham shu yerga yozadi.
// • HOLAT o'qishda hisoblanadi: lid → birinchi dars → guruhda → to'lov qisman → HISOBLANDI. +1 referal — taklif
//   qilingan o'quvchining to'lovlari (taklif sanasidan keyin) birinchi guruhining OYLIK narxiga yetgan kun.
// • BALANS = hisoblangan − sovg'aga sarflangan (tasdiqlangan so'rovlar narxi). Sovg'a do'koni (`ref_gifts`) —
//   narx referalda, qoldiq; so'rov (`ref_requests`) — rahbar tasdiqlaydi: qoldiq −1, balansdan narx ayriladi.
// • Lidlardagi eski «Referal bergan o'quvchi» (`orders.referralPupilId`) — o'sha o'quvchi taklif qiluvchi qilib
//   qo'shilganda uning lidlari «tavsiya» bo'lib ko'chiriladi.

export const REF_REFERRERS = "ref_referrers";
export const REF_LINKS = "ref_links";
export const REF_GIFTS = "ref_gifts";
export const REF_REQUESTS = "ref_requests";
const SETTINGS_KEY = "referral.program";

type Fail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });
const stamp = () => `${uzDateIso()}T${uzTimeHm()}`;
const s = (v: unknown) => String(v ?? "").trim();
const strip = <T,>(d: Record<string, unknown>): T => {
  const r = { ...d };
  delete r._id;
  return r as T;
};

async function nextId(db: Db, col: string): Promise<number> {
  const last = await db.collection(col).find({}, { projection: { id: 1 } }).sort({ id: -1 }).limit(1).toArray();
  return (Number(last[0]?.id) || 0) + 1;
}

export async function loadRefSettings(db: Db): Promise<RefSettings> {
  const doc = await db.collection("settings").findOne({ key: SETTINGS_KEY });
  const v = (doc?.value ?? {}) as Partial<RefSettings>;
  return { kinds: { ...DEFAULT_REF_SETTINGS.kinds, ...(v.kinds ?? {}) }, certificates: v.certificates ?? DEFAULT_REF_SETTINGS.certificates };
}

/** «Gulchehra Mirzayeva» → GULCHEHRA + 1..99; bazada band bo'lmaguncha. */
async function makeCode(db: Db, name: string): Promise<string> {
  const base =
    (name.split(/\s+/)[0] || "REF")
      .normalize("NFKD")
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
      .slice(0, 10) || "REF";
  for (let i = 0; i < 200; i++) {
    const code = `${base}${Math.floor(Math.random() * 90) + 10}`;
    if (!(await db.collection(REF_REFERRERS).findOne({ code }, { projection: { _id: 1 } }))) return code;
  }
  return `${base}${Date.now() % 100000}`;
}

// ─────────────────────────────── O'qish ───────────────────────────────

export async function loadReferrals(db: Db, allowed: number[]): Promise<ReferralsPayload> {
  const today = uzDateIso();
  const branches = (await db.collection("branches").find({ id: { $in: allowed } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray()) as unknown as { id: number; name: string }[];
  const bName = (id: number | undefined | null) => branches.find((b) => b.id === Number(id))?.name ?? "";
  const referrers = (await db.collection(REF_REFERRERS).find(branchInCondition(allowed)).sort({ id: 1 }).toArray()).map((d) => strip<Referrer>(d));
  const refIds = referrers.map((r) => r.id);
  const links = (await db.collection(REF_LINKS).find({ referrerId: { $in: refIds } }).sort({ id: -1 }).toArray()).map((d) => strip<RefLink>(d));
  const leads = await db
    .collection("orders")
    .find({ id: { $in: links.map((l) => l.leadId).filter((x): x is number => x !== null) } }, { projection: { _id: 0 } })
    .toArray();
  const leadById = new Map(leads.map((l) => [Number(l.id), l]));
  const pupilOf = (l: RefLink) => l.pupilId ?? (l.leadId !== null && Number.isFinite(Number(leadById.get(l.leadId)?.pupilId)) ? Number(leadById.get(l.leadId)?.pupilId) : null);
  const pupilIds = [...new Set(links.map(pupilOf).filter((x): x is number => x !== null))];
  const pupils = await db.collection("pupils").find({ id: { $in: pupilIds } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, branchId: 1 } }).toArray();
  const pupilById = new Map(pupils.map((p) => [Number(p.id), p]));
  const mems = await db.collection(GROUP_MEMBERSHIPS).find({ pupilId: { $in: pupilIds } }, { projection: { _id: 0, pupilId: 1, groupId: 1, joinedAt: 1, leftAt: 1 } }).sort({ joinedAt: 1 }).toArray();
  const groups = await db
    .collection("groups")
    .find({ id: { $in: [...new Set(mems.map((m) => Number(m.groupId)))] } }, { projection: { _id: 0, id: 1, name: 1, course: 1, level: 1, branchId: 1 } })
    .toArray();
  const groupById = new Map(groups.map((g) => [Number(g.id), g]));
  const courses = (await db.collection("offline_courses").find({}, { projection: { _id: 0 } }).toArray()) as unknown as PricedCourse[];
  const pays = pupilIds.length
    ? await db
        .collection("transaction_entries")
        .find({ txType: "payIn", status: { $ne: "cancelled" }, pupilId: { $in: pupilIds } }, { projection: { _id: 0, pupilId: 1, date: 1, amount: 1, discountSom: 1 } })
        .sort({ date: 1 })
        .toArray()
    : [];

  const rows: LinkRow[] = links.map((l) => {
    const lead = l.leadId !== null ? leadById.get(l.leadId) : undefined;
    const pid = pupilOf(l);
    const p = pid !== null ? pupilById.get(pid) : undefined;
    const ref = referrers.find((r) => r.id === l.referrerId)!;
    const myMems = pid !== null ? mems.filter((m) => Number(m.pupilId) === pid) : [];
    const firstMem = myMems.find((m) => !m.leftAt) ?? myMems[0];
    const g = firstMem ? groupById.get(Number(firstMem.groupId)) : undefined;
    const price = g ? monthlyPriceFor(g as never, courses) : null;
    const since = l.createdAt.slice(0, 10);
    let paid = 0;
    let countedAt: string | null = null;
    for (const e of pays) {
      if (Number(e.pupilId) !== pid || String(e.date) < since) continue;
      paid += Number(e.amount) + Number(e.discountSom ?? 0);
      if (!countedAt && price && paid >= price) countedAt = String(e.date);
    }
    let state: RefState;
    let stateSub: string;
    const holat = lead ? holatOf(lead as HolatSource) : null;
    if (countedAt) {
      state = "hisoblandi";
      stateSub = `1-oy to'landi · ${Math.round(price ?? 0).toLocaleString("ru-RU")}`;
    } else if (paid > 0) {
      state = "qisman";
      stateSub = price ? `${paid.toLocaleString("ru-RU")} / ${price.toLocaleString("ru-RU")} to'landi` : `${paid.toLocaleString("ru-RU")} to'landi · narx noma'lum`;
    } else if (g) {
      state = "guruh";
      stateSub = "to'lov kutilmoqda";
    } else if (holat === "rad") {
      state = "rad";
      stateSub = "lid rad etdi";
    } else if (holat === "sinov") {
      state = "sinov";
      stateSub = String(lead?.firstLesson ?? "").split("|")[0].trim();
    } else {
      state = "lid";
      stateSub = "hali guruhga yozilmagan";
    }
    return {
      ...l,
      name: p ? pupilFullName(p as never) : s(lead?.name),
      phone: s(p?.phone ?? lead?.phone),
      branchName: bName(Number(p?.branchId ?? lead?.branchId ?? ref.branchId)),
      groupLabel: g ? groupLabel(g as never) : s(lead?.course),
      state,
      stateSub,
      countedAt,
      referrerName: ref.name,
      referrerKind: ref.kind,
    };
  });

  const gifts = (await db.collection(REF_GIFTS).find({}).sort({ price: 1 }).toArray()).map((d) => strip<RefGift>(d));
  const requests = (await db.collection(REF_REQUESTS).find({ referrerId: { $in: refIds } }).sort({ id: -1 }).toArray()).map((d) => strip<RefRequest>(d));
  const refRows: ReferrerRow[] = referrers.map((r) => {
    const my = rows.filter((x) => x.referrerId === r.id);
    const counted = my.filter((x) => x.state === "hisoblandi").length;
    const spent = requests.filter((q) => q.referrerId === r.id && q.status === "approved").reduce((a, q) => a + q.price, 0);
    return { ...r, branchName: bName(r.branchId), invited: my.length, counted, spent, balance: counted - spent, pending: requests.find((q) => q.referrerId === r.id && q.status === "pending") ?? null };
  });
  const balanceOf = (id: number) => refRows.find((r) => r.id === id)?.balance ?? 0;
  const month = today.slice(0, 7);
  const prev = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
  const byKind = Object.fromEntries(REF_KINDS.map((k) => [k, referrers.filter((r) => r.kind === k).length])) as Record<RefKind, number>;

  return {
    ok: true,
    today,
    branches,
    referrers: refRows,
    links: rows,
    gifts: gifts.map((g) => ({
      ...g,
      given: requests.filter((q) => q.giftId === g.id && q.status === "approved").length,
      canTake: refRows.filter((r) => r.balance >= g.price).length,
    })),
    requests: requests.map((q) => ({
      ...q,
      referrerName: referrers.find((r) => r.id === q.referrerId)?.name ?? "",
      referrerKind: referrers.find((r) => r.id === q.referrerId)?.kind ?? "boshqa",
      giftName: gifts.find((g) => g.id === q.giftId)?.name ?? "",
      balance: balanceOf(q.referrerId),
    })),
    settings: await loadRefSettings(db),
    kpi: {
      referrers: referrers.length,
      byKind,
      invited: rows.length,
      paid: rows.filter((x) => x.state === "hisoblandi" || x.state === "qisman").length,
      counted: rows.filter((x) => x.state === "hisoblandi").length,
      thisMonth: rows.filter((x) => x.countedAt?.startsWith(month)).length,
      prevMonth: rows.filter((x) => x.countedAt?.startsWith(prev)).length,
      pendingRequests: requests.filter((q) => q.status === "pending").length,
      given: requests.filter((q) => q.status === "approved").length,
      balances: refRows.reduce((a, r) => a + Math.max(0, r.balance), 0),
    },
  };
}

/** Biriktirish oynasi uchun: lidlar va o'quvchilar (ism yoki telefon). */
export async function searchPeople(db: Db, allowed: number[], q: string) {
  const term = q.trim();
  if (term.length < 2) return { leads: [], pupils: [] };
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const digits = term.replace(/\D/g, "");
  const or = [{ name: { $regex: esc, $options: "i" } }, ...(digits.length >= 4 ? [{ phone: { $regex: digits } }] : [])];
  const leads = await db
    .collection("orders")
    .find({ $and: [{ $or: or }, branchInCondition(allowed)] }, { projection: { _id: 0, id: 1, name: 1, phone: 1, source: 1, createdAt: 1, pupilId: 1 } })
    .sort({ id: -1 })
    .limit(8)
    .toArray();
  const pupils = await db
    .collection("pupils")
    .find(
      { $and: [{ $or: [{ firstName: { $regex: esc, $options: "i" } }, { lastName: { $regex: esc, $options: "i" } }, ...(digits.length >= 4 ? [{ phone: { $regex: digits } }] : [])] }, branchInCondition(allowed)] },
      { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, status: 1 } },
    )
    .limit(8)
    .toArray();
  return {
    leads: leads.map((l) => ({ id: Number(l.id), name: s(l.name), phone: s(l.phone), source: s(l.source), createdAt: s(l.createdAt), pupilId: l.pupilId ?? null })),
    pupils: pupils.map((p) => ({ id: Number(p.id), name: pupilFullName(p as never), phone: s(p.phone), status: s(p.status) })),
  };
}

// ─────────────────────────────── Yozish ───────────────────────────────

const VIAS: RefVia[] = ["kod", "havola", "tavsiya", "sertifikat"];

async function importLegacy(db: Db, r: Referrer, by: string) {
  if (!r.pupilId) return;
  const leads = await db.collection("orders").find({ referralPupilId: r.pupilId }, { projection: { _id: 0, id: 1, pupilId: 1 } }).toArray();
  for (const l of leads) {
    if (await db.collection(REF_LINKS).findOne({ leadId: Number(l.id) })) continue;
    await db.collection(REF_LINKS).insertOne({
      id: await nextId(db, REF_LINKS),
      referrerId: r.id,
      leadId: Number(l.id),
      pupilId: Number.isFinite(Number(l.pupilId)) && l.pupilId !== null ? Number(l.pupilId) : null,
      via: "tavsiya",
      cert: "",
      note: "Lid kartasidagi «Referal bergan o'quvchi»dan",
      createdAt: stamp(),
      createdBy: by,
    } satisfies RefLink);
  }
}

export async function addReferrer(db: Db, branchId: number, by: string, b: Record<string, unknown>): Promise<{ ok: true; referrer: Referrer } | Fail> {
  const kind = REF_KINDS.includes(b.kind as RefKind) ? (b.kind as RefKind) : null;
  if (!kind) return fail("Kimligini tanlang");
  const settings = await loadRefSettings(db);
  if (!settings.kinds[kind]) return fail("Bu turdagi taklif qiluvchi Sozlamalarda o'chirilgan");
  let name = s(b.name);
  const pupilId = Number(b.pupilId) || null;
  if (pupilId) {
    const p = await db.collection("pupils").findOne({ id: pupilId }, { projection: { _id: 0, firstName: 1, lastName: 1, phone: 1, branchId: 1 } });
    if (!p) return fail("O'quvchi topilmadi", 404);
    if (await db.collection(REF_REFERRERS).findOne({ pupilId })) return fail("Bu o'quvchi allaqachon taklif qiluvchi");
    name = name || pupilFullName(p as never);
    if (!s(b.phone)) b.phone = p.phone;
  }
  if (!name) return fail("Ismini kiriting");
  const r: Referrer = {
    id: await nextId(db, REF_REFERRERS),
    kind,
    name: name.slice(0, 80),
    phone: s(b.phone).slice(0, 20),
    note: s(b.note).slice(0, 120),
    pupilId,
    branchId: Number(b.branchId) || branchId,
    code: await makeCode(db, name),
    createdAt: stamp(),
    createdBy: by,
  };
  await db.collection(REF_REFERRERS).insertOne({ ...r });
  await importLegacy(db, r, by);
  return { ok: true, referrer: r };
}

export async function addLink(db: Db, allowed: number[], by: string, b: Record<string, unknown>): Promise<{ ok: true; link: RefLink } | Fail> {
  const referrer = await db.collection(REF_REFERRERS).findOne({ $and: [{ id: Number(b.referrerId) }, branchInCondition(allowed)] });
  if (!referrer) return fail("Taklif qiluvchini tanlang");
  const via = VIAS.includes(b.via as RefVia) ? (b.via as RefVia) : "tavsiya";
  const leadId = Number(b.leadId) || null;
  let pupilId = Number(b.pupilId) || null;
  if (!leadId && !pupilId) return fail("O'quvchi yoki lidni tanlang");
  if (leadId) {
    const lead = await db.collection("orders").findOne({ id: leadId }, { projection: { _id: 0, pupilId: 1 } });
    if (!lead) return fail("Lid topilmadi", 404);
    if (!pupilId && Number.isFinite(Number(lead.pupilId)) && lead.pupilId !== null) pupilId = Number(lead.pupilId);
  }
  if (pupilId && Number(referrer.pupilId) === pupilId) return fail("O'zini o'zi taklif qila olmaydi");
  const dup = await db.collection(REF_LINKS).findOne({ $or: [...(leadId ? [{ leadId }] : []), ...(pupilId ? [{ pupilId }] : [])] });
  if (dup) return fail("Bu o'quvchi allaqachon biriktirilgan");
  const cert = via === "sertifikat" ? s(b.cert).toUpperCase().slice(0, 20) : "";
  if (via === "sertifikat" && !cert) return fail("Sertifikat raqamini kiriting");
  const link: RefLink = { id: await nextId(db, REF_LINKS), referrerId: Number(referrer.id), leadId, pupilId, via, cert, note: s(b.note).slice(0, 200), createdAt: stamp(), createdBy: by };
  await db.collection(REF_LINKS).insertOne({ ...link });
  return { ok: true, link };
}

/** Ochiq so'rovnoma (`/sorovnoma?ref=KOD`) orqali kelgan lid — taklif qiluvchiga «havola» bo'lib yoziladi. */
export async function linkByCode(db: Db, code: unknown, leadId: number): Promise<void> {
  const c = s(code).toUpperCase();
  if (!/^[A-Z]{1,12}\d{1,6}$/.test(c)) return;
  const r = await db.collection(REF_REFERRERS).findOne({ code: c });
  if (!r || (await db.collection(REF_LINKS).findOne({ leadId }))) return;
  await db.collection(REF_LINKS).insertOne({ id: await nextId(db, REF_LINKS), referrerId: Number(r.id), leadId, pupilId: null, via: "havola", cert: "", note: "", createdAt: stamp(), createdBy: "So'rovnoma" } satisfies RefLink);
}

export async function saveGift(db: Db, b: Record<string, unknown>): Promise<{ ok: true } | Fail> {
  const name = s(b.name);
  const price = Math.floor(Number(b.price));
  const stock = Math.max(0, Math.floor(Number(b.stock) || 0));
  if (!name) return fail("Sovg'a nomini kiriting");
  if (!(price >= 1 && price <= 1000)) return fail("Narxi 1–1000 referal oralig'ida bo'lsin");
  const doc = { name: name.slice(0, 80), desc: s(b.desc).slice(0, 120), price, stock, active: b.active !== false };
  if (Number(b.id)) {
    const r = await db.collection(REF_GIFTS).updateOne({ id: Number(b.id) }, { $set: doc });
    if (!r.matchedCount) return fail("Sovg'a topilmadi", 404);
  } else await db.collection(REF_GIFTS).insertOne({ id: await nextId(db, REF_GIFTS), ...doc });
  return { ok: true };
}

/** Yangi so'rov; `approve` bo'lsa — darhol beriladi (rahbar o'zi bersa). */
export async function requestGift(db: Db, allowed: number[], by: string, referrerId: number, giftId: number, approve: boolean): Promise<{ ok: true } | Fail> {
  const data = await loadReferrals(db, allowed);
  const r = data.referrers.find((x) => x.id === referrerId);
  const g = data.gifts.find((x) => x.id === giftId);
  if (!r) return fail("Taklif qiluvchi topilmadi", 404);
  if (!g || !g.active) return fail("Sovg'a topilmadi", 404);
  if (r.pending) return fail("Bu taklif qiluvchining so'rovi kutilmoqda");
  const id = await nextId(db, REF_REQUESTS);
  await db.collection(REF_REQUESTS).insertOne({ id, referrerId, giftId, price: g.price, status: "pending", createdAt: stamp(), decidedAt: null, decidedBy: "", comment: "" } satisfies RefRequest);
  if (approve) {
    const d = await decideRequest(db, allowed, by, id, true, "");
    if (!d.ok) {
      await db.collection(REF_REQUESTS).deleteOne({ id });
      return d;
    }
  }
  return { ok: true };
}

export async function decideRequest(db: Db, allowed: number[], by: string, id: number, approve: boolean, comment: string): Promise<{ ok: true } | Fail> {
  const q = (await db.collection(REF_REQUESTS).findOne({ id, status: "pending" })) as unknown as RefRequest | null;
  if (!q) return fail("So'rov topilmadi", 404);
  if (approve) {
    const data = await loadReferrals(db, allowed);
    const r = data.referrers.find((x) => x.id === q.referrerId);
    if (!r) return fail("Taklif qiluvchi topilmadi", 404);
    if (r.balance < q.price) return fail(`Balans yetmaydi: ${r.balance} / ${q.price}`);
    const g = await db.collection(REF_GIFTS).findOneAndUpdate({ id: q.giftId, stock: { $gt: 0 } }, { $inc: { stock: -1 } });
    if (!g) return fail("Sovg'a omborda qolmagan");
  } else if (!comment.trim()) return fail("Rad etish sababini yozing");
  await db.collection(REF_REQUESTS).updateOne({ id }, { $set: { status: approve ? "approved" : "rejected", decidedAt: stamp(), decidedBy: by, comment: comment.trim().slice(0, 200) } });
  return { ok: true };
}

export async function saveRefSettings(db: Db, b: Record<string, unknown>): Promise<{ ok: true; settings: RefSettings }> {
  const cur = await loadRefSettings(db);
  const kinds = { ...cur.kinds };
  for (const k of REF_KINDS) if (typeof (b.kinds as Record<string, unknown> | undefined)?.[k] === "boolean") kinds[k] = (b.kinds as Record<string, boolean>)[k];
  const settings: RefSettings = { kinds, certificates: typeof b.certificates === "boolean" ? b.certificates : cur.certificates };
  await db.collection("settings").updateOne({ key: SETTINGS_KEY }, { $set: { key: SETTINGS_KEY, value: settings } }, { upsert: true });
  return { ok: true, settings };
}
