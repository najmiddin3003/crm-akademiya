import { NextResponse } from "next/server";
import { ObjectId, type Db, type Document, type Filter } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/adminOnly";
import { ACTION_LOG } from "@/lib/actionLog";
import { LOG_CATEGORIES, type LogCategory } from "@/lib/actionLogLabels";
import { LOG_OBJECTS, buildLogView, objectNameOf, type LogNames, type LogRow, type LogView } from "@/lib/actionLogView";
import { branchPool } from "@/lib/branchPools";
import { loadPaymentMethods } from "@/lib/paymentMethods";
import { uzDateIso } from "@/lib/uzTime";

// GET /api/action-log/feed — YANGI «Amallar jurnali» (rasm «Amallar jurnali», 25.10.2026, 14-qism).
// FAQAT ADMIN (eski GET /api/action-log bilan bir xil: jurnalda hamma xodimning amali, IP va qurilmasi).
//
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD   Toshkent kunlari (sukut — kecha va bugun)
//   ?who=e:12 | u:<userId> | t:<tgId> | n:<ism>   kim (eski jurnaldagidek)
//   ?branch=3                        navbar filiali (1+2 hovuzi birga)
//   ?cat=finance|pupils|…            toifa (lib/actionLogLabels.ts → LOG_CATEGORIES)
//   ?q=matn                          ism, obyekt (o'quvchi, guruh …), summa
//   ?offset=0                        sahifa boshi (`next` javobdan)
//
// Yozuv odam tilida (lib/actionLogView.ts). Toifa va qidiruv nomlarga bog'liq (o'quvchi, guruh,
// kassa nomi), shuning uchun oraliqdagi yozuvlar (ko'pi bilan CAP ta, yangisidan) YENGIL
// proyeksiyada o'qiladi, toifa sonlari va qidiruv shulardan; sahifadagi qatorlar — to'liq.

const CAP = 3000;
const PAGE = 60;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function dayBound(day: string, end: boolean): Date {
  return new Date(`${day}T${end ? "23:59:59.999" : "00:00:00.000"}+05:00`);
}

function prevDay(day: string): string {
  return new Date(new Date(`${day}T12:00:00+05:00`).getTime() - 86_400_000 + 5 * 3600_000).toISOString().slice(0, 10);
}

function whoFilter(raw: string): Filter<Document> | null {
  const [k, ...rest] = raw.split(":");
  const v = rest.join(":");
  if (!v) return null;
  if (k === "e" && /^\d+$/.test(v)) return { "actor.employeeId": Number(v) };
  if (k === "u") return { "actor.userId": v };
  if (k === "t" && /^\d+$/.test(v)) return { "actor.tgId": Number(v) };
  if (k === "n") return { "actor.name": v };
  return null;
}

const LIGHT: Record<string, 1> = {
  at: 1,
  actor: 1,
  source: 1,
  section: 1,
  action: 1,
  path: 1,
  query: 1,
  target: 1,
  status: 1,
  denied: 1,
  branchId: 1,
  ua: 1,
  details: 1,
  ...Object.fromEntries(
    ["mode", "amount", "method", "studentName", "teacherName", "category", "toCashboxId", "from", "to", "month", "firstName", "lastName", "name", "course", "level", "pupilId", "reason", "comment"].map((k) => [`body.${k}`, 1 as const]),
  ),
  ...Object.fromEntries(["name", "firstName", "lastName", "course", "level", "month", "title", "studentName", "txName", "amount", "cashboxId"].map((k) => [`before.${k}`, 1 as const])),
};

function toRow(d: Document): LogRow {
  const { _id, at, ...rest } = d;
  return { ...(rest as Omit<LogRow, "id" | "at">), id: String(_id), at: (at as Date).toISOString() };
}

/** Sahifa/oraliq yozuvlari uchun nomlar — har to'plamga bitta so'rov. */
async function loadNames(db: Db, rows: LogRow[], base?: LogNames): Promise<LogNames> {
  const want = new Map<string, Set<number>>();
  const add = (col: string, id: unknown) => {
    const n = Number(id);
    if (!Number.isInteger(n) || n <= 0) return;
    if (base?.byCol[col]?.[String(n)] !== undefined) return;
    const s = want.get(col) ?? new Set<number>();
    s.add(n);
    want.set(col, s);
  };
  for (const r of rows) {
    const cfg = LOG_OBJECTS[r.section];
    if (cfg && r.target && /^\d+$/.test(r.target)) add(cfg.col, r.target);
    const body = (r.body && typeof r.body === "object" ? r.body : {}) as Record<string, unknown>;
    const det = r.details ?? {};
    if (r.section === "cashboxes" && r.target) add("cashboxes", r.target);
    add("cashboxes", body.toCashboxId);
    add("cashboxes", det.cashboxId);
    add("cashboxes", det.toCashboxId);
    if (r.before && typeof r.before === "object") add("cashboxes", (r.before as Record<string, unknown>).cashboxId);
  }
  const byCol: Record<string, Record<string, string>> = Object.fromEntries(Object.entries(base?.byCol ?? {}).map(([k, v]) => [k, { ...v }]));
  await Promise.all(
    [...want].map(async ([col, ids]) => {
      const fields = Object.values(LOG_OBJECTS).find((c) => c.col === col)?.fields ?? ["name"];
      const projection: Record<string, 0 | 1> = { _id: 0, id: 1 };
      for (const f of fields) projection[f] = 1;
      const docs = await db.collection(col).find({ id: { $in: [...ids] } }, { projection }).toArray();
      const m = (byCol[col] ??= {});
      for (const d of docs) m[String(d.id)] = objectNameOf(col, d as Record<string, unknown>);
    }),
  );
  return { byCol, methods: base?.methods ?? {}, branches: base?.branches ?? {} };
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "Bu bo'lim faqat administrator uchun" }, { status: 403 });
  }
  const p = new URL(req.url).searchParams;
  const today = uzDateIso();
  const to = DAY.test(p.get("to") ?? "") ? p.get("to")! : today;
  const from = DAY.test(p.get("from") ?? "") ? p.get("from")! : prevDay(to);
  if (from > to) return NextResponse.json({ ok: false, error: "Sana oralig'i noto'g'ri" }, { status: 400 });

  const range: Filter<Document> = { at: { $gte: dayBound(from, false), $lte: dayBound(to, true) } };
  const and: Filter<Document>[] = [range];
  const who = whoFilter((p.get("who") ?? "").trim());
  if (who) and.push(who);
  const branch = Number(p.get("branch"));
  if (Number.isInteger(branch) && branch > 0) and.push({ branchId: { $in: [...branchPool(branch)] } });
  const cat = (p.get("cat") ?? "").trim() as LogCategory | "";
  const validCat = LOG_CATEGORIES.some((c) => c.key === cat) ? cat : "";
  const q = (p.get("q") ?? "").trim().toLowerCase().slice(0, 80);
  const qDigits = q.replace(/[\s.,]/g, "");
  const offset = Math.max(0, Math.floor(Number(p.get("offset")) || 0));

  const db = await ensureIndexes();
  const col = db.collection(ACTION_LOG);

  const [lightDocs, people, methods, branchRows] = await Promise.all([
    col.find({ $and: and }, { projection: LIGHT }).sort({ at: -1, _id: -1 }).limit(CAP + 1).toArray(),
    col
      .aggregate<{ _id: { e?: number; u?: string; t?: number; n?: string; k?: string }; c: number }>([
        { $match: range },
        { $group: { _id: { e: "$actor.employeeId", u: "$actor.userId", t: "$actor.tgId", n: "$actor.name", k: "$actor.kind" }, c: { $sum: 1 } } },
        { $sort: { c: -1 } },
        { $limit: 400 },
      ])
      .toArray(),
    loadPaymentMethods(db).catch(() => []),
    db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
  ]);

  const truncated = lightDocs.length > CAP;
  const lightRows = (truncated ? lightDocs.slice(0, CAP) : lightDocs).map(toRow);
  const baseNames: LogNames = {
    byCol: {},
    methods: Object.fromEntries(methods.map((m) => [m.key, m.name])),
    branches: Object.fromEntries(branchRows.map((b) => [String(b.id), String(b.name ?? "")])),
  };
  const names = await loadNames(db, lightRows, baseNames);

  // Toifa sonlari — qidiruvdan keyin, toifa tanlovidan oldin (chiplar va «Davr bo'yicha»).
  const views = lightRows.map((r) => buildLogView(r, names));
  const matched = q
    ? views.filter((v) => v.search.includes(q) || (qDigits.length >= 3 && /^\d+$/.test(qDigits) && v.amount !== null && String(Math.abs(v.amount)).includes(qDigits)))
    : views;
  const counts: Record<string, number> = { all: matched.length };
  for (const c of LOG_CATEGORIES) counts[c.key] = 0;
  for (const v of matched) counts[v.cat] += 1;
  const listed = validCat ? matched.filter((v) => v.cat === validCat) : matched;
  const dayCounts: Record<string, number> = {};
  for (const v of listed) dayCounts[v.day] = (dayCounts[v.day] ?? 0) + 1;

  // Sahifa — to'liq yozuv (tana, «oldin», qurilma) bilan qayta o'qiladi.
  const pageIds = listed.slice(offset, offset + PAGE).map((v) => v.id);
  const fullDocs = pageIds.length
    ? await col.find({ _id: { $in: pageIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id)) } }).toArray()
    : [];
  const fullById = new Map(fullDocs.map((d) => [String(d._id), toRow(d)]));
  const pageRows = pageIds.map((id) => fullById.get(id)).filter((r): r is LogRow => !!r);
  const pageNames = await loadNames(db, pageRows, names);
  const rows: Omit<LogView, "search">[] = pageRows.map((r) => {
    const { search, ...v } = buildLogView(r, pageNames);
    void search;
    return v;
  });

  // Kim — eski jurnaldagidek: bitta odam bir necha ko'rinishda (sayt, bot, QR) — xodim → hisob → Telegram → ism.
  const merged = new Map<string, { key: string; name: string; kind: string; count: number }>();
  for (const r of people) {
    const id = r._id;
    const key = Number.isFinite(id.e) ? `e:${id.e}` : id.u ? `u:${id.u}` : Number.isFinite(id.t) ? `t:${id.t}` : id.n ? `n:${id.n}` : "";
    if (!key) continue;
    const prev = merged.get(key);
    if (prev) {
      prev.count += r.c;
      if (!prev.name && id.n) prev.name = id.n;
    } else merged.set(key, { key, name: id.n ?? "", kind: id.k ?? "", count: r.c });
  }

  return NextResponse.json({
    ok: true,
    from,
    to,
    total: listed.length,
    counts,
    dayCounts,
    rows,
    next: offset + PAGE < listed.length ? offset + PAGE : null,
    truncated,
    people: [...merged.values()].sort((a, b) => b.count - a.count),
  });
}
