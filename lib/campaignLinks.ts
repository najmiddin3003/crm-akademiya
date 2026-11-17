import type { Db } from "mongodb";
import { branchInCondition } from "@/lib/branchScope";
import { createdIso } from "@/lib/financeAnalytics";
import { listSourceOptions } from "@/lib/studentSources";
import { uzDateIso } from "@/lib/uzTime";

// KAMPANIYA HAVOLALARI (36-qism, rasm «Kampaniya havolalari»).
//
// Har reklama (Instagram bio, flyer, banner…) uchun alohida qisqa havola `/s/KOD` va QR kod. Havola ochilganda
// sanaladi (`campaign_opens`: kod + kun + son) va odam so'rovnomaga `?c=KOD` bilan o'tadi; so'rovnomada «Bizni
// qayerdan bildingiz?» savoli chiqmaydi — manba havoladan o'zi to'ladi (`heardFrom` = havolaning manbasi) va lidga
// `campaign` kodi yoziladi. Shuning uchun hisobotlarda manbasiz lid qolmaydi.
// Lid — `orders.campaign === kod` (yozilgan sanasi oraliqda); o'quvchi — shu lidlardan o'quvchi bo'lganlari
// (`pupilId`). Xarajat — havolaga qo'lda yoziladi (kassa chiqimi bilan bog'lanish hali yo'q — SAVOLLAR).

export const CAMPAIGN_LINKS = "campaign_links";
export const CAMPAIGN_OPENS = "campaign_opens";

export const CAMPAIGN_KINDS = ["instagram", "sayt", "telegram", "flyer", "banner", "boshqa"] as const;
export type CampaignKind = (typeof CAMPAIGN_KINDS)[number];

export interface CampaignLink {
  id: number;
  code: string;
  name: string;
  place: string;
  kind: CampaignKind;
  source: string;
  branchId: number | null;
  cost: number;
  active: boolean;
  createdBy: string;
  createdAt: string;
}

export interface CampaignRow extends CampaignLink {
  opens: number;
  leads: number;
  students: number;
  branchName: string;
}

export interface CampaignReport {
  ok: true;
  from: string;
  to: string;
  rows: CampaignRow[];
  kpi: { leads: number; withSource: number; viaLink: number; opens: number; idle: number; idleNames: string[] };
  noLink: { source: string; leads: number; students: number }[];
  sources: string[];
}

export const normCode = (raw: unknown) =>
  String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 16);

const KIND_PREFIX: Record<CampaignKind, string> = { instagram: "IG", sayt: "SAYT", telegram: "TG", flyer: "FLY", banner: "BAN", boshqa: "K" };

export async function findActiveLink(db: Db, code: unknown): Promise<CampaignLink | null> {
  const c = normCode(code);
  if (!c) return null;
  return (await db.collection<CampaignLink>(CAMPAIGN_LINKS).findOne({ code: c, active: true }, { projection: { _id: 0 } })) ?? null;
}

/** `/s/KOD` ochilganda — kunlik hisoblagich. */
export async function countOpen(db: Db, code: string) {
  await db.collection(CAMPAIGN_OPENS).updateOne({ code, date: uzDateIso() }, { $inc: { n: 1 } }, { upsert: true });
}

/** So'rovnomadan lid yaratilgach — kampaniya kodi va manbasi lidga yoziladi. */
export async function tagLeadWithCampaign(db: Db, code: unknown, orderId: number) {
  const link = await findActiveLink(db, code);
  if (!link || !orderId) return;
  await db.collection("orders").updateOne({ id: orderId }, { $set: { campaign: link.code, campaignName: link.name, ...(link.source ? { heardFrom: link.source } : {}) } });
}

export async function campaignReport(db: Db, branchIds: number[], from: string, to: string, kind: string): Promise<CampaignReport> {
  const [links, opens, leads, branches, sources] = await Promise.all([
    db
      .collection<CampaignLink>(CAMPAIGN_LINKS)
      .find({ $or: [{ branchId: null }, { branchId: { $in: branchIds } }] }, { projection: { _id: 0 } })
      .sort({ id: 1 })
      .toArray(),
    db
      .collection(CAMPAIGN_OPENS)
      .aggregate([{ $match: { date: { $gte: from, $lte: to } } }, { $group: { _id: "$code", n: { $sum: "$n" } } }])
      .toArray(),
    db
      .collection("orders")
      .find(branchInCondition(branchIds), { projection: { _id: 0, id: 1, createdAt: 1, campaign: 1, heardFrom: 1, source: 1, pupilId: 1, referral: 1 } })
      .toArray(),
    db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
    listSourceOptions(db),
  ]);
  const inRange = leads.filter((l) => {
    const d = createdIso(l.createdAt);
    return d >= from && d <= to;
  });
  const openBy = new Map(opens.map((o) => [String(o._id), Number(o.n) || 0]));
  const bName = new Map(branches.map((b) => [Number(b.id), String(b.name)]));
  const rows: CampaignRow[] = links
    .filter((l) => !kind || l.kind === kind)
    .map((l) => {
      const mine = inRange.filter((o) => o.campaign === l.code);
      return { ...l, opens: openBy.get(l.code) ?? 0, leads: mine.length, students: mine.filter((o) => Number(o.pupilId) > 0).length, branchName: l.branchId ? (bName.get(l.branchId) ?? "") : "Barcha filiallar" };
    });
  const viaLink = inRange.filter((o) => o.campaign).length;
  const withSource = inRange.filter((o) => o.campaign || String(o.heardFrom ?? "").trim() || String(o.referral ?? "").trim()).length;
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const idle = rows.filter((r) => r.active && r.createdAt.slice(0, 10) <= weekAgo && r.students === 0);
  const noLinkMap = new Map<string, { leads: number; students: number }>();
  for (const o of inRange.filter((x) => !x.campaign)) {
    const s = String(o.heardFrom ?? "").trim() || (String(o.referral ?? "").trim() ? "Tavsiya" : String(o.source ?? "").trim() || "Noma'lum");
    const x = noLinkMap.get(s) ?? { leads: 0, students: 0 };
    x.leads += 1;
    if (Number(o.pupilId) > 0) x.students += 1;
    noLinkMap.set(s, x);
  }
  return {
    ok: true,
    from,
    to,
    rows,
    kpi: { leads: inRange.length, withSource, viaLink, opens: rows.reduce((a, r) => a + r.opens, 0), idle: idle.length, idleNames: idle.map((r) => r.name) },
    noLink: [...noLinkMap.entries()].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.leads - a.leads).slice(0, 4),
    sources: sources.filter((s) => s.active !== false).map((s) => s.name),
  };
}

export interface CampaignInput {
  id?: number;
  name?: string;
  place?: string;
  kind?: string;
  source?: string;
  branchId?: number | null;
  cost?: number;
  code?: string;
  active?: boolean;
}

export async function saveCampaign(db: Db, b: CampaignInput, by: string, allowedBranches: number[] | null): Promise<{ ok: true; link: CampaignLink } | { ok: false; error: string }> {
  const col = db.collection<CampaignLink>(CAMPAIGN_LINKS);
  const branchId = b.branchId ? Number(b.branchId) : null;
  if (branchId && allowedBranches && !allowedBranches.includes(branchId)) return { ok: false, error: "Bu filial sizga biriktirilmagan" };
  if (b.id) {
    const cur = await col.findOne({ id: Number(b.id) }, { projection: { _id: 0 } });
    if (!cur) return { ok: false, error: "Havola topilmadi" };
    const set: Partial<CampaignLink> = {};
    if (b.name !== undefined) set.name = String(b.name).trim().slice(0, 80);
    if (b.place !== undefined) set.place = String(b.place).trim().slice(0, 160);
    if (b.kind !== undefined && (CAMPAIGN_KINDS as readonly string[]).includes(String(b.kind))) set.kind = b.kind as CampaignKind;
    if (b.source !== undefined) set.source = String(b.source).trim().slice(0, 60);
    if (b.branchId !== undefined) set.branchId = branchId;
    if (b.cost !== undefined) set.cost = Math.max(0, Math.round(Number(b.cost) || 0));
    if (b.active !== undefined) set.active = !!b.active;
    if (set.name === "") return { ok: false, error: "Kampaniya nomini yozing" };
    await col.updateOne({ id: cur.id }, { $set: set });
    return { ok: true, link: { ...cur, ...set } };
  }
  const name = String(b.name ?? "").trim().slice(0, 80);
  if (!name) return { ok: false, error: "Kampaniya nomini yozing" };
  const kind = ((CAMPAIGN_KINDS as readonly string[]).includes(String(b.kind)) ? b.kind : "boshqa") as CampaignKind;
  let code = normCode(b.code);
  if (code && (await col.findOne({ code }))) return { ok: false, error: "Bu kod band — boshqasini yozing" };
  if (!code) {
    for (let i = 0; i < 50 && !code; i++) {
      const c = `${KIND_PREFIX[kind]}-${Math.floor(10 + Math.random() * 990)}`;
      if (!(await col.findOne({ code: c }))) code = c;
    }
  }
  const last = await col.find({}, { projection: { id: 1 } }).sort({ id: -1 }).limit(1).toArray();
  const link: CampaignLink = {
    id: (Number(last[0]?.id) || 0) + 1,
    code,
    name,
    place: String(b.place ?? "").trim().slice(0, 160),
    kind,
    source: String(b.source ?? "").trim().slice(0, 60),
    branchId,
    cost: Math.max(0, Math.round(Number(b.cost) || 0)),
    active: true,
    createdBy: by,
    createdAt: new Date().toISOString(),
  };
  await col.insertOne({ ...link });
  return { ok: true, link };
}
