import type { Db } from "mongodb";
import { branchInCondition } from "@/lib/branchScope";
import { GROUP_MEMBERSHIPS } from "@/lib/groupMembership";
import { sendToStudent } from "@/lib/studentBot/api";
import { isStudentBotReady, loadStudentBotConfig } from "@/lib/studentBot/config";
import { BOT_USERS } from "@/lib/studentBot/users";
import type { CabinetFeedItem, NewsAudience, NewsIcon, NewsRow, NewsState, NewsType, NewsWho } from "@/lib/cabinetNewsTypes";
import { NEWS_ICONS } from "@/lib/cabinetNewsTypes";

// YANGILIKLAR VA HIKOYALAR (36-qism, rasmlar «Yangiliklar», «Yangilik qo'shish», «Kabinet — yangilik»).
//
// Bitta `cabinet_news` kolleksiyasi: `type` — "news" (lenta) yoki "story" (kabinet tepasidagi doira, 24 soatdan
// keyin o'zi yashirinadi). Kimga — hammaga / filial / kurs / guruh, va o'quvchi, ota-ona yoki ikkalasi. Holat —
// qoralama yoki e'lon (`publishAt` kelajakda bo'lsa — «Rejalashtirilgan»; vaqti kelganda kabinetda o'zi chiqadi).
// Ko'rdi — kabinetni ochib yangilikni ko'rgan o'quvchi/ota-ona (`cabinet_news_views`, bir odam bir marta).
// Telegram — belgilangan bo'lsa, e'lon vaqti kelgach botga bog'langan suhbatlarga bir marta yuboriladi
// (`deliverDueTelegram` — sahifa va kabinet ochilganda chaqiriladi; alohida cron hali yo'q — SAVOLLAR).
// Eski «Yangiliklar» (`news`) birinchi ochilishda shu yerga ko'chiriladi (hammaga, e'lon qilingan); eski
// «Hikoya» (`stories`) — 24 soatlik emas, ko'chirilmaydi.

export const CABINET_NEWS = "cabinet_news";
export const CABINET_NEWS_VIEWS = "cabinet_news_views";
const STORY_MS = 24 * 3600_000;

export interface NewsDoc {
  id: number;
  type: NewsType;
  title: string;
  body: string;
  image: string;
  icon: NewsIcon;
  audience: NewsAudience;
  draft: boolean;
  /** ISO (UTC). */
  publishAt: string;
  telegram: boolean;
  tgSentAt?: string;
  tgSent?: number;
  createdBy: string;
  createdAt: string;
}

export function stateOf(n: Pick<NewsDoc, "draft" | "publishAt" | "type">, now = Date.now()): NewsState {
  if (n.draft) return "draft";
  const t = Date.parse(n.publishAt);
  if (t > now) return "scheduled";
  if (n.type === "story" && now - t > STORY_MS) return "expired";
  return "published";
}

/** Eski `news` — bir marta ko'chiriladi. */
async function migrateOld(db: Db) {
  const meta = db.collection("app_meta");
  if (await meta.findOne({ key: "cabinet_news_migrated" })) return;
  await meta.updateOne({ key: "cabinet_news_migrated" }, { $set: { key: "cabinet_news_migrated", at: new Date().toISOString() } }, { upsert: true });
  const old = await db.collection("news").find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();
  if (!old.length) return;
  let id = Number((await db.collection(CABINET_NEWS).find({}).sort({ id: -1 }).limit(1).toArray())[0]?.id) || 0;
  for (const o of old) {
    const m = /^(\d{2})-(\d{2})-(\d{4}) \| (\d{2}):(\d{2})/.exec(String(o.createdAt ?? ""));
    const at = m ? new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00+05:00`).toISOString() : new Date().toISOString();
    const doc: NewsDoc = { id: ++id, type: "news", title: String(o.title ?? ""), body: String(o.content ?? ""), image: String(o.image ?? ""), icon: "info", audience: { scope: "all", who: "all" }, draft: false, publishAt: at, telegram: false, createdBy: "", createdAt: at };
    await db.collection(CABINET_NEWS).insertOne({ ...doc, legacyId: o.id });
  }
}

/** Auditoriyadagi o'quvchilar (faol) — id ro'yxati. */
async function audiencePupils(db: Db, a: NewsAudience, branchIds: number[]): Promise<number[]> {
  if (a.scope === "group" || a.scope === "course") {
    const groupIds = a.scope === "group" ? [Number(a.groupId)] : (await db.collection("groups").find({ course: a.course, ...branchInCondition(branchIds) }, { projection: { _id: 0, id: 1 } }).toArray()).map((g) => Number(g.id));
    const mem = await db.collection(GROUP_MEMBERSHIPS).find({ groupId: { $in: groupIds }, leftAt: null }, { projection: { _id: 0, pupilId: 1 } }).toArray();
    return [...new Set(mem.map((m) => Number(m.pupilId)))];
  }
  const ids = a.scope === "branch" && a.branchId ? [Number(a.branchId)] : branchIds;
  const rows = await db.collection("pupils").find({ status: { $ne: "Arxiv" }, ...branchInCondition(ids) }, { projection: { _id: 0, id: 1 } }).toArray();
  return rows.map((p) => Number(p.id));
}

export async function listNews(db: Db, branchIds: number[]): Promise<{ ok: true; rows: NewsRow[]; groups: { id: number; name: string; course: string }[]; courses: string[] }> {
  await migrateOld(db);
  await deliverDueTelegram(db).catch((e) => console.error("[cabinet-news] telegram", e));
  const [docs, views, groups, branches] = await Promise.all([
    db
      .collection<NewsDoc>(CABINET_NEWS)
      .find({ $or: [{ "audience.branchId": { $exists: false } }, { "audience.branchId": null }, { "audience.branchId": { $in: branchIds } }] }, { projection: { _id: 0 } })
      .sort({ publishAt: -1, id: -1 })
      .toArray(),
    db
      .collection(CABINET_NEWS_VIEWS)
      .aggregate([{ $group: { _id: { n: "$newsId", p: "$pupilId" } } }, { $group: { _id: "$_id.n", n: { $sum: 1 } } }])
      .toArray(),
    db.collection("groups").find(branchInCondition(branchIds), { projection: { _id: 0, id: 1, name: 1, course: 1 } }).toArray(),
    db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
  ]);
  const vBy = new Map(views.map((v) => [Number(v._id), Number(v.n)]));
  const bName = new Map(branches.map((b) => [Number(b.id), String(b.name)]));
  const gName = new Map(groups.map((g) => [Number(g.id), String(g.name)]));
  const now = Date.now();
  const rows: NewsRow[] = [];
  for (const d of docs) {
    const state = stateOf(d, now);
    const total = state === "draft" ? 0 : (await audiencePupils(db, d.audience, branchIds)).length;
    // Ko'rdi — noyob o'quvchilar (o'zi yoki ota-onasi ko'rgan); guruhdan chiqqanlar sababli jamidan oshmasin.
    rows.push({ ...d, state, views: Math.min(vBy.get(d.id) ?? 0, total || Infinity), total, audienceLabel: audienceLabel(d.audience, bName, gName) });
  }
  return { ok: true, rows, groups: groups.map((g) => ({ id: Number(g.id), name: String(g.name), course: String(g.course ?? "") })), courses: [...new Set(groups.map((g) => String(g.course ?? "")).filter(Boolean))].sort() };
}

function audienceLabel(a: NewsAudience, bName: Map<number, string>, gName: Map<number, string>): { main: string; sub: string } {
  const who = a.who === "parents" ? "faqat ota-onalar" : a.who === "students" ? "faqat o'quvchilar" : "o'quvchi va ota-ona";
  if (a.scope === "branch") return { main: "Filial", sub: `${bName.get(Number(a.branchId)) ?? "—"} · ${who}` };
  if (a.scope === "course") return { main: `Kurs · ${a.course ?? ""}`, sub: who };
  if (a.scope === "group") return { main: `Guruh · ${gName.get(Number(a.groupId)) ?? a.groupId}`, sub: who };
  return { main: "Hammaga", sub: who };
}

export interface NewsInput {
  id?: number;
  type?: string;
  title?: string;
  body?: string;
  image?: string;
  icon?: string;
  audience?: Partial<NewsAudience>;
  draft?: boolean;
  publishAt?: string;
  telegram?: boolean;
  delete?: boolean;
}

function cleanAudience(a: Partial<NewsAudience> | undefined): NewsAudience | string {
  const scope = (["all", "branch", "course", "group"] as const).find((s) => s === a?.scope) ?? "all";
  const who: NewsWho = (["all", "students", "parents"] as const).find((s) => s === a?.who) ?? "all";
  if (scope === "branch" && !Number(a?.branchId)) return "Filialni tanlang";
  if (scope === "course" && !String(a?.course ?? "").trim()) return "Kursni tanlang";
  if (scope === "group" && !Number(a?.groupId)) return "Guruhni tanlang";
  return {
    scope,
    who,
    ...(scope === "branch" ? { branchId: Number(a!.branchId) } : {}),
    ...(scope === "course" ? { course: String(a!.course).trim() } : {}),
    ...(scope === "group" ? { groupId: Number(a!.groupId) } : {}),
  };
}

export async function saveNews(db: Db, b: NewsInput, by: string): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const col = db.collection<NewsDoc>(CABINET_NEWS);
  if (b.id && b.delete) {
    await col.deleteOne({ id: Number(b.id) });
    await db.collection(CABINET_NEWS_VIEWS).deleteMany({ newsId: Number(b.id) });
    return { ok: true, id: Number(b.id) };
  }
  const title = String(b.title ?? "").trim().slice(0, 120);
  if (!title) return { ok: false, error: "Sarlavhani yozing" };
  const audience = cleanAudience(b.audience);
  if (typeof audience === "string") return { ok: false, error: audience };
  const publishAt = b.publishAt && !Number.isNaN(Date.parse(b.publishAt)) ? new Date(b.publishAt).toISOString() : new Date().toISOString();
  const fields = {
    type: (b.type === "story" ? "story" : "news") as NewsType,
    title,
    body: String(b.body ?? "").trim().slice(0, 2000),
    image: /^https?:\/\//.test(String(b.image ?? "")) ? String(b.image) : "",
    icon: ((NEWS_ICONS as readonly string[]).includes(String(b.icon)) ? b.icon : "info") as NewsIcon,
    audience,
    draft: !!b.draft,
    publishAt,
    telegram: !!b.telegram,
  };
  if (b.id) {
    const cur = await col.findOne({ id: Number(b.id) });
    if (!cur) return { ok: false, error: "Yangilik topilmadi" };
    await col.updateOne({ id: cur.id }, { $set: fields });
    return { ok: true, id: cur.id };
  }
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const id = (Number(last[0]?.id) || 0) + 1;
  await col.insertOne({ id, ...fields, createdBy: by, createdAt: new Date().toISOString() });
  await deliverDueTelegram(db).catch((e) => console.error("[cabinet-news] telegram", e));
  return { ok: true, id };
}

// ───────────────────────────── Kabinet (o'quvchi / ota-ona) ─────────────────────────────


/** O'quvchi ko'radigan e'lon qilingan yangiliklar (10 ta) va faol hikoyalar. */
export async function cabinetFeed(db: Db, pupilId: number, branchId: number, role: "student" | "parent"): Promise<{ news: CabinetFeedItem[]; stories: CabinetFeedItem[] }> {
  await deliverDueTelegram(db).catch((e) => console.error("[cabinet-news] telegram", e));
  const nowIso = new Date().toISOString();
  const [mem, docs] = await Promise.all([
    db.collection(GROUP_MEMBERSHIPS).find({ pupilId, leftAt: null }, { projection: { _id: 0, groupId: 1 } }).toArray(),
    db
      .collection<NewsDoc>(CABINET_NEWS)
      .find({ draft: false, publishAt: { $lte: nowIso } }, { projection: { _id: 0 } })
      .sort({ publishAt: -1 })
      .limit(100)
      .toArray(),
  ]);
  const groupIds = mem.map((m) => Number(m.groupId));
  const courses = new Set((await db.collection("groups").find({ id: { $in: groupIds } }, { projection: { _id: 0, course: 1 } }).toArray()).map((g) => String(g.course ?? "")));
  const fits = (a: NewsAudience) =>
    (a.who === "all" || (a.who === "students" ? role === "student" : role === "parent")) &&
    (a.scope === "all" || (a.scope === "branch" && Number(a.branchId) === branchId) || (a.scope === "course" && courses.has(String(a.course))) || (a.scope === "group" && groupIds.includes(Number(a.groupId))));
  const mine = docs.filter((d) => fits(d.audience) && stateOf(d) === "published");
  const pick = (d: NewsDoc): CabinetFeedItem => ({ id: d.id, type: d.type, title: d.title, body: d.body, image: d.image, icon: d.icon, publishAt: d.publishAt });
  return { news: mine.filter((d) => d.type === "news").slice(0, 10).map(pick), stories: mine.filter((d) => d.type === "story").map(pick) };
}

/** Kabinetda ko'rildi — bir odam (o'quvchi + rol) bir marta. */
export async function markSeen(db: Db, ids: number[], pupilId: number, role: string) {
  const ops = ids.slice(0, 30).map((newsId) => ({ updateOne: { filter: { newsId, pupilId, role }, update: { $setOnInsert: { newsId, pupilId, role, at: new Date().toISOString() } }, upsert: true } }));
  if (ops.length) await db.collection(CABINET_NEWS_VIEWS).bulkWrite(ops, { ordered: false });
}

// ───────────────────────────── Telegram ─────────────────────────────

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

/** Vaqti kelgan, Telegram belgilangan va hali yuborilmagan e'lonlar — har biri bir marta (atomik «egallash»). */
export async function deliverDueTelegram(db: Db) {
  const cfg = await loadStudentBotConfig();
  if (!isStudentBotReady(cfg)) return;
  const col = db.collection<NewsDoc>(CABINET_NEWS);
  for (let i = 0; i < 5; i++) {
    const doc = await col.findOneAndUpdate(
      { telegram: true, draft: false, tgSentAt: { $exists: false }, publishAt: { $lte: new Date().toISOString() } },
      { $set: { tgSentAt: new Date().toISOString() } },
      { projection: { _id: 0 } },
    );
    if (!doc) return;
    if (doc.type === "story" && stateOf(doc) === "expired") continue;
    const pupils = await audiencePupils(db, doc.audience, doc.audience.branchId ? [doc.audience.branchId] : (await db.collection("branches").find({}, { projection: { _id: 0, id: 1 } }).toArray()).map((b) => Number(b.id)));
    const roleQ = doc.audience.who === "all" ? {} : { role: doc.audience.who === "parents" ? "parent" : "student" };
    const users = await db
      .collection(BOT_USERS)
      .find({ links: { $elemMatch: { pupilId: { $in: pupils }, ...roleQ } }, blocked: { $ne: true } }, { projection: { _id: 0, chatId: 1 } })
      .toArray();
    const html = `📢 <b>${esc(doc.title)}</b>${doc.body ? `\n\n${esc(doc.body)}` : ""}`;
    let sent = 0;
    for (const u of users) if ((await sendToStudent(cfg, Number(u.chatId), html)).ok) sent++;
    await col.updateOne({ id: doc.id }, { $set: { tgSent: sent } });
  }
}
