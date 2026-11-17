import type { Db } from "mongodb";
import { branchInCondition } from "@/lib/branchScope";
import { GROUP_MEMBERSHIPS } from "@/lib/groupMembership";
import { groupLabel } from "@/lib/groups";
import { pupilFullName } from "@/lib/pupilsData";
import { sendToStudent } from "@/lib/studentBot/api";
import { isStudentBotReady, loadStudentBotConfig } from "@/lib/studentBot/config";
import { chatsForPupil } from "@/lib/studentBot/users";
import { uzDateIso } from "@/lib/uzTime";
import {
  avgOf,
  DEFAULT_CRITERIA,
  LANG_CRITERIA,
  prevSeason,
  seasonInfo,
  seasonOf,
  type GroupSeasonState,
  type SeasonGroupDetail,
  type SeasonGroupRow,
  type SeasonKey,
  type SeasonPayload,
  type SeasonCard,
} from "@/lib/seasonGradeTypes";

// MAVSUMIY BAHOLASH (36-qism). Ustoz chorak oxirida har o'quvchini kurs mezonlari bo'yicha 1–5 baholaydi
// (`season_grades`: chorak + guruh + o'quvchi → mezon baholari + izoh). Mezonlar — kurs bo'yicha
// (`season_criteria`; yo'q bo'lsa: til kurslarida Gapirish/Tinglash/O'qish/Yozish/Grammatika, boshqalarda umumiy 4 ta).
// Guruh holati: Yuborilgan (`season_sends`) / Tayyor (hamma baholangan) / Jarayonda / Boshlanmagan.
// «Ota-onalarga yuborish» — tayyor va hali yuborilmagan guruhlar: botga ulangan suhbatlarga hisobot va
// o'quvchi kabinetida «Chorak bahosi keldi» kartasi (`seasonCardFor`). Eski `seasonal_assessments` (oylik bitta
// ball) — eski versiyada, tegilmagan.

export const SEASON_GRADES = "season_grades";
export const SEASON_CRITERIA = "season_criteria";
export const SEASON_SENDS = "season_sends";

const LANG_RX = /ingliz|english|ielts|cefr|rus|nemis|arab|koreys|turk|xitoy|fransuz|til/i;
const active = (g: Record<string, unknown>) => !["archived", "closed", "arxiv"].includes(String(g.status ?? ""));

async function criteriaMap(db: Db): Promise<Map<string, string[]>> {
  const docs = await db.collection(SEASON_CRITERIA).find({}, { projection: { _id: 0 } }).toArray();
  return new Map(docs.map((d) => [String(d.course), (d.criteria as string[]) ?? []]));
}
const criteriaFor = (m: Map<string, string[]>, course: string) => (m.get(course)?.length ? m.get(course)! : LANG_RX.test(course) ? LANG_CRITERIA : DEFAULT_CRITERIA);

async function membersBy(db: Db, groupIds: number[]) {
  const mem = await db.collection(GROUP_MEMBERSHIPS).find({ groupId: { $in: groupIds }, leftAt: null }, { projection: { _id: 0, groupId: 1, pupilId: 1 } }).toArray();
  const by = new Map<number, number[]>();
  for (const m of mem) by.set(Number(m.groupId), [...(by.get(Number(m.groupId)) ?? []), Number(m.pupilId)]);
  return by;
}

function groupRow(g: Record<string, unknown>, total: number, graded: number, sentAt: string | undefined): SeasonGroupRow {
  const state: GroupSeasonState = sentAt ? "sent" : total && graded >= total ? "ready" : graded ? "progress" : "none";
  return { id: Number(g.id), name: groupLabel(g as never), course: String(g.course ?? ""), level: String(g.level ?? ""), teacher: String(g.teacher ?? ""), day: String(g.day ?? ""), time: String(g.time ?? ""), room: String(g.room ?? ""), total, graded, state, ...(sentAt ? { sentAt } : {}) };
}

export async function seasonOverview(db: Db, branchIds: number[], season: SeasonKey | null): Promise<SeasonPayload> {
  const today = uzDateIso();
  const key = season && /^\d{4}-[1-4]$/.test(season) ? season : seasonOf(today);
  const info = seasonInfo(key);
  const groups = (await db.collection("groups").find(branchInCondition(branchIds), { projection: { _id: 0 } }).toArray()).filter(active);
  const ids = groups.map((g) => Number(g.id));
  const [mem, grades, sends, cm] = await Promise.all([
    membersBy(db, ids),
    db.collection(SEASON_GRADES).find({ season: key, groupId: { $in: ids } }, { projection: { _id: 0, groupId: 1, pupilId: 1, scores: 1, course: 1 } }).toArray(),
    db.collection(SEASON_SENDS).find({ season: key, groupId: { $in: ids } }, { projection: { _id: 0 } }).toArray(),
    criteriaMap(db),
  ]);
  const sentBy = new Map(sends.map((s) => [Number(s.groupId), String(s.sentAt)]));
  const order: Record<GroupSeasonState, number> = { progress: 0, ready: 1, sent: 2, none: 3 };
  const rows = groups
    .map((g) => {
      const members = mem.get(Number(g.id)) ?? [];
      const crit = criteriaFor(cm, String(g.course ?? ""));
      const done = grades.filter((x) => Number(x.groupId) === Number(g.id) && members.includes(Number(x.pupilId)) && avgOf(x.scores ?? {}, crit) !== null).length;
      return groupRow(g, members.length, done, sentBy.get(Number(g.id)));
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => order[a.state] - order[b.state] || a.name.localeCompare(b.name));
  const courses = [...new Set(rows.map((r) => r.course).filter(Boolean))].sort();
  const seasons = [key, prevSeason(key), prevSeason(prevSeason(key))].map((k) => ({ key: k, label: seasonInfo(k).label }));
  if (seasonOf(today) !== key && !seasons.some((s) => s.key === seasonOf(today))) seasons.unshift({ key: seasonOf(today), label: seasonInfo(seasonOf(today)).label });
  return {
    ok: true,
    season: key,
    label: info.label,
    deadline: info.deadline,
    today,
    seasons,
    groups: rows,
    courses,
    teachers: [...new Set(rows.map((r) => r.teacher).filter(Boolean))].sort(),
    criteria: Object.fromEntries(courses.map((c) => [c, criteriaFor(cm, c)])),
  };
}

export async function seasonGroup(db: Db, season: SeasonKey, groupId: number): Promise<SeasonGroupDetail | null> {
  const g = await db.collection("groups").findOne({ id: groupId }, { projection: { _id: 0 } });
  if (!g) return null;
  const [mem, cm] = await Promise.all([membersBy(db, [groupId]), criteriaMap(db)]);
  const ids = mem.get(groupId) ?? [];
  const crit = criteriaFor(cm, String(g.course ?? ""));
  const [pupils, grades, prev, send] = await Promise.all([
    db.collection("pupils").find({ id: { $in: ids } }, { projection: { _id: 0 } }).toArray(),
    db.collection(SEASON_GRADES).find({ season, groupId }, { projection: { _id: 0 } }).toArray(),
    db.collection(SEASON_GRADES).find({ season: prevSeason(season), pupilId: { $in: ids }, course: String(g.course ?? "") }, { projection: { _id: 0 } }).toArray(),
    db.collection(SEASON_SENDS).findOne({ season, groupId }),
  ]);
  const gBy = new Map(grades.map((x) => [Number(x.pupilId), x]));
  const pBy = new Map(prev.map((x) => [Number(x.pupilId), x]));
  const rows = pupils
    .map((p) => {
      const x = gBy.get(Number(p.id));
      const scores = (x?.scores ?? {}) as Record<string, number>;
      const px = pBy.get(Number(p.id));
      return { pupilId: Number(p.id), name: pupilFullName(p as never), scores, note: String(x?.note ?? ""), avg: avgOf(scores, crit), prevAvg: px ? avgOf(px.scores ?? {}, (px.criteria as string[]) ?? crit) : null };
    })
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || a.name.localeCompare(b.name));
  const avgBy = Object.fromEntries(
    crit.map((c) => {
      const v = rows.map((r) => r.scores[c]).filter((n) => n >= 1);
      return [c, v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null];
    }),
  );
  const graded = rows.filter((r) => r.avg !== null).length;
  return { ok: true, group: groupRow(g, rows.length, graded, send ? String(send.sentAt) : undefined), criteria: crit, pupils: rows, avgBy };
}

export async function saveGrade(db: Db, b: { season?: string; groupId?: number; pupilId?: number; scores?: Record<string, number>; note?: string }, by: string) {
  const season = String(b.season ?? "");
  if (!/^\d{4}-[1-4]$/.test(season)) return { ok: false as const, error: "Chorak noto'g'ri" };
  const g = await db.collection("groups").findOne({ id: Number(b.groupId) }, { projection: { _id: 0, id: 1, course: 1 } });
  if (!g) return { ok: false as const, error: "Guruh topilmadi" };
  if (await db.collection(SEASON_SENDS).findOne({ season, groupId: Number(g.id) })) return { ok: false as const, error: "Bu guruh baholari ota-onalarga yuborilgan — o'zgartirib bo'lmaydi" };
  const crit = criteriaFor(await criteriaMap(db), String(g.course ?? ""));
  const scores: Record<string, number> = {};
  for (const c of crit) {
    const v = Math.round(Number(b.scores?.[c]));
    if (v >= 1 && v <= 5) scores[c] = v;
  }
  await db.collection(SEASON_GRADES).updateOne(
    { season, groupId: Number(g.id), pupilId: Number(b.pupilId) },
    { $set: { season, groupId: Number(g.id), pupilId: Number(b.pupilId), course: String(g.course ?? ""), criteria: crit, scores, note: String(b.note ?? "").trim().slice(0, 300), teacher: by, at: new Date().toISOString() } },
    { upsert: true },
  );
  return { ok: true as const };
}

export async function saveCriteria(db: Db, course: string, criteria: string[]) {
  const list = [...new Set(criteria.map((c) => String(c).trim().slice(0, 30)).filter(Boolean))].slice(0, 8);
  if (!course.trim()) return { ok: false as const, error: "Kursni tanlang" };
  if (list.length < 2) return { ok: false as const, error: "Kamida 2 ta mezon kerak" };
  await db.collection(SEASON_CRITERIA).updateOne({ course }, { $set: { course, criteria: list } }, { upsert: true });
  return { ok: true as const };
}

/** Tayyor (hamma baholangan) va hali yuborilmagan guruhlar — ota-onalarga. */
export async function sendSeason(db: Db, branchIds: number[], season: SeasonKey, by: string) {
  const ov = await seasonOverview(db, branchIds, season);
  const ready = ov.groups.filter((g) => g.state === "ready");
  const cfg = loadStudentBotConfig();
  const bot = isStudentBotReady(cfg);
  let delivered = 0;
  for (const g of ready) {
    const d = await seasonGroup(db, season, g.id);
    if (!d) continue;
    await db.collection(SEASON_SENDS).insertOne({ season, groupId: g.id, sentAt: new Date().toISOString(), by });
    if (!bot) continue;
    for (const p of d.pupils) {
      const lines = [`📘 <b>Chorak bahosi · ${seasonInfo(season).short}</b>`, `<i>${p.name}</i> — ${g.name}`, "", ...d.criteria.map((c) => `${c}: <b>${p.scores[c] ?? "—"}</b>`), "", `O'rtacha: <b>${p.avg ?? "—"}</b>${p.prevAvg !== null ? ` (o'tgan chorak: ${p.prevAvg})` : ""}`];
      if (p.note) lines.push(`«${p.note.replace(/[<>&]/g, "")}»`);
      for (const chat of await chatsForPupil(db, p.pupilId)) if ((await sendToStudent(cfg, chat, lines.join("\n"))).ok) delivered++;
    }
  }
  return { ok: true as const, groups: ready.length, delivered, bot };
}

/** O'quvchi kabineti: oxirgi yuborilgan chorak bahosi (har guruh bo'yicha eng so'nggisi). */
export async function seasonCardsFor(db: Db, pupilId: number): Promise<SeasonCard[]> {
  const grades = await db.collection(SEASON_GRADES).find({ pupilId }, { projection: { _id: 0 } }).sort({ season: -1 }).limit(10).toArray();
  if (!grades.length) return [];
  const sends = await db.collection(SEASON_SENDS).find({ $or: grades.map((g) => ({ season: g.season, groupId: g.groupId })) }, { projection: { _id: 0 } }).toArray();
  const sent = grades.filter((g) => sends.some((s) => s.season === g.season && s.groupId === g.groupId));
  if (!sent.length) return [];
  const latest = sent[0].season;
  const out: SeasonCard[] = [];
  for (const g of sent.filter((x) => x.season === latest)) {
    const grp = await db.collection("groups").findOne({ id: g.groupId }, { projection: { _id: 0 } });
    const prev = await db.collection(SEASON_GRADES).findOne({ season: prevSeason(latest), pupilId, course: g.course });
    const crit = (g.criteria as string[]) ?? Object.keys(g.scores ?? {});
    out.push({
      season: latest,
      label: seasonInfo(latest).short,
      group: grp ? groupLabel(grp as never) : String(g.course),
      teacher: String(grp?.teacher ?? g.teacher ?? ""),
      sentAt: String(sends.find((s) => s.season === g.season && s.groupId === g.groupId)?.sentAt ?? ""),
      criteria: crit.map((c) => ({ name: c, score: Number(g.scores?.[c] ?? 0) })),
      avg: avgOf(g.scores ?? {}, crit),
      prevAvg: prev ? avgOf(prev.scores ?? {}, (prev.criteria as string[]) ?? crit) : null,
      note: String(g.note ?? ""),
    });
  }
  return out;
}
