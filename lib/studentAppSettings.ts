import type { Db } from "mongodb";
import { BOT_USERS } from "@/lib/studentBot/users";
import { DEFAULT_STUDENT_APP, type StudentAppPrefs } from "@/lib/studentAppTypes";

// SOZLAMALAR → O'QUVCHI ILOVASI (38-qism, rasm «Sozlamalar · O'quvchi ilovasi va kontent»). Ulanganlari: balans va
// qarzni ko'rsatish, hikoyalar, yangiliklar (kabinet — /api/student-web/me shu sozlamani o'qiydi). Ko'rsatkichlar:
// kabinetga kirgan o'quvchilar (`student_bot_users` bog'lanishlari), ota-onalar, oxirgi yangilikni ko'rganlar.
// O'zgarishlar jurnali — `feature_log` (Funksiyalar sahifasi bilan umumiy).

const KEY = "student_app";

export async function loadStudentApp(db: Db): Promise<StudentAppPrefs> {
  const d = await db.collection("app_settings").findOne({ key: KEY });
  return {
    showDebt: d?.showDebt !== false,
    stories: d?.stories !== false,
    news: d?.news !== false,
  };
}

const LABEL: Record<keyof StudentAppPrefs, string> = { showDebt: "Balans va qarzni ko'rish", stories: "Hikoyalar", news: "Yangiliklar" };

export async function saveStudentApp(db: Db, p: Partial<StudentAppPrefs>, by: string) {
  const set: Record<string, boolean> = {};
  for (const k of Object.keys(DEFAULT_STUDENT_APP) as (keyof StudentAppPrefs)[]) if (typeof p[k] === "boolean") set[k] = p[k]!;
  if (!Object.keys(set).length) return { ok: false as const, error: "O'zgarish yo'q" };
  await db.collection("app_settings").updateOne({ key: KEY }, { $set: { key: KEY, ...set } }, { upsert: true });
  for (const [k, v] of Object.entries(set)) await db.collection("feature_log").insertOne({ text: `O'quvchi ilovasi: ${LABEL[k as keyof StudentAppPrefs]} — ${v ? "yoqildi" : "o'chirildi"}`, by, at: new Date().toISOString(), scope: "student_app" });
  return { ok: true as const };
}

export async function studentAppPage(db: Db) {
  const [prefs, pupils, users, lastNews, stories, news, log] = await Promise.all([
    loadStudentApp(db),
    db.collection("pupils").countDocuments({ status: { $ne: "Arxiv" } }),
    db.collection(BOT_USERS).find({ blocked: { $ne: true } }, { projection: { _id: 0, links: 1 } }).toArray(),
    db.collection("cabinet_news").find({ type: "news", draft: false, publishAt: { $lte: new Date().toISOString() } }, { projection: { _id: 0, id: 1, title: 1, publishAt: 1 } }).sort({ publishAt: -1 }).limit(1).toArray(),
    db.collection("cabinet_news").countDocuments({ type: "story", draft: false, publishAt: { $gte: new Date(Date.now() - 24 * 3600_000).toISOString() } }),
    db.collection("cabinet_news").countDocuments({ type: "news", draft: false }),
    db.collection("feature_log").find({ scope: "student_app" }, { projection: { _id: 0 } }).sort({ at: -1 }).limit(4).toArray(),
  ]);
  const links = users.flatMap((u) => (u.links ?? []) as { pupilId: number; role: string }[]);
  const lastViews = lastNews[0] ? await db.collection("cabinet_news_views").distinct("pupilId", { newsId: lastNews[0].id }) : [];
  return {
    ok: true as const,
    prefs,
    pupils,
    students: new Set(links.map((l) => l.pupilId)).size,
    parents: links.filter((l) => l.role === "parent").length,
    lastNews: lastNews[0] ? { title: String(lastNews[0].title), at: String(lastNews[0].publishAt), views: lastViews.length } : null,
    stories,
    news,
    log: log.map((l) => ({ text: String(l.text), by: String(l.by ?? ""), at: String(l.at) })),
  };
}
