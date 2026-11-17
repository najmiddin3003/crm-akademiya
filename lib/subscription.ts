import type { Db } from "mongodb";
import { gamificationEnabled } from "@/lib/gamification/settings";
import { uzDateIso } from "@/lib/uzTime";

// OBUNA VA TO'LOV (37-qism, rasmlar «Obuna», «Obuna — to'lash»). Tizimli xizmati obunasi markaz bazasida
// yuritilmaydi — Tizimli jamoasi `app_settings` («subscription»: tarif, boshlanish, tugash, to'lovlar) ga yozadi.
// Yozuv bo'lmasa sahifa «ma'lumot kiritilmagan» deydi va faqat markazning haqiqiy ko'rsatkichlarini chiqaradi.
// «Muddatni uzaytirish» — `subscription_requests` ga so'rov (Tizimli hisob-faktura yuboradi); onlayn to'lov yo'q.
// Tariflar — dizayndagi narxlar (SAVOLLAR: Tizimli tasdiqlashi kerak).

export const TARIFFS = [
  { months: 1, price: 1_500_000, bonus: 0 },
  { months: 3, price: 4_500_000, bonus: 0 },
  { months: 6, price: 9_000_000, bonus: 1 },
  { months: 12, price: 18_000_000, bonus: 3 },
];

export interface SubPayment {
  date: string;
  from: string;
  to: string;
  amount: number;
  method: string;
}

export interface SubscriptionPayload {
  ok: true;
  today: string;
  sub: { months: number; from: string; until: string; nextPrice: number } | null;
  payments: SubPayment[];
  counts: { pupils: number; branches: number; logins: number; since: string | null };
  modules: { gamification: boolean; onlineCourses: number };
  tariffs: typeof TARIFFS;
  pending: { months: number; amount: number; at: string } | null;
}

export async function subscriptionPage(db: Db): Promise<SubscriptionPayload> {
  const [doc, pupils, branches, logins, first, gam, online, pending] = await Promise.all([
    db.collection("app_settings").findOne({ key: "subscription" }),
    db.collection("pupils").countDocuments({ status: { $ne: "Arxiv" } }),
    db.collection("branches").countDocuments({}),
    db.collection("users").countDocuments({ status: "active" }),
    db.collection("users").find({}, { projection: { createdAt: 1 } }).sort({ createdAt: 1 }).limit(1).toArray(),
    gamificationEnabled(db),
    db.collection("online_courses").countDocuments({ published: true }),
    db.collection("subscription_requests").find({ status: "new" }).sort({ at: -1 }).limit(1).toArray(),
  ]);
  const since = first[0]?.createdAt instanceof Date ? first[0].createdAt.toISOString().slice(0, 10) : null;
  const s = doc && doc.until ? { months: Number(doc.months) || 1, from: String(doc.from ?? ""), until: String(doc.until), nextPrice: TARIFFS.find((t) => t.months === Number(doc.months))?.price ?? (Number(doc.price) || 0) } : null;
  return {
    ok: true,
    today: uzDateIso(),
    sub: s,
    payments: ((doc?.payments ?? []) as SubPayment[]).slice().sort((a, b) => b.date.localeCompare(a.date)),
    counts: { pupils, branches, logins, since },
    modules: { gamification: gam, onlineCourses: online },
    tariffs: TARIFFS,
    pending: pending[0] ? { months: Number(pending[0].months), amount: Number(pending[0].amount), at: String(pending[0].at) } : null,
  };
}

export async function requestExtension(db: Db, months: number, by: string) {
  const t = TARIFFS.find((x) => x.months === months);
  if (!t) return { ok: false as const, error: "Davrni tanlang" };
  await db.collection("subscription_requests").insertOne({ months, amount: t.price, method: "invoice", status: "new", by, at: new Date().toISOString() });
  return { ok: true as const };
}
