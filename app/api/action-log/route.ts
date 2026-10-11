import { NextResponse } from "next/server";
import { ObjectId, type Document, type Filter } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/adminOnly";
import { ACTION_LOG } from "@/lib/actionLog";
import { ACTION_KINDS } from "@/lib/actionLogLabels";
import { uzDateIso } from "@/lib/uzTime";

// GET /api/action-log — «Amallar jurnali» (lib/actionLog.ts). FAQAT ADMIN:
// jurnalda hamma xodimning amali, IP va qurilmasi bor.
//
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD  Toshkent kunlari (sukut — bugun)
//   ?who=e:12 | u:<userId> | t:<tgId> | n:<ism>   kim
//   ?section=cashboxes[,…]          bo'lim(lar) (API yo'lining birinchi segmenti)
//   ?kind=create|update|delete|auth|bot|system|denied
//   ?q=matn                         yo'l, ism, telefon, obyekt yoki IP ichidan
//   ?before=<ISO>_<id>              keyingi sahifa (oldingi javobdagi `next`)
//
// Javob: qatorlar (eng yangisi birinchi), `next` va shu oraliqdagi odamlar
// ro'yxati (filtr uchun).

const PAGE = 100;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Toshkent kuni chegarasi (UTC+5, yozgi vaqt yo'q). */
function dayBound(day: string, end: boolean): Date {
  return new Date(`${day}T${end ? "23:59:59.999" : "00:00:00.000"}+05:00`);
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

export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "Bu bo'lim faqat administrator uchun" }, { status: 403 });
  }
  const p = new URL(req.url).searchParams;
  const today = uzDateIso();
  const from = DAY.test(p.get("from") ?? "") ? p.get("from")! : today;
  const to = DAY.test(p.get("to") ?? "") ? p.get("to")! : today;
  if (from > to) return NextResponse.json({ ok: false, error: "Sana oralig'i noto'g'ri" }, { status: 400 });

  const range: Filter<Document> = { at: { $gte: dayBound(from, false), $lte: dayBound(to, true) } };
  const and: Filter<Document>[] = [range];

  const who = whoFilter((p.get("who") ?? "").trim());
  if (who) and.push(who);
  // Bir nomli bo'limlar (Xodimlar: employees + hr-employees) vergul bilan keladi.
  const sections = (p.get("section") ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 10);
  if (sections.length) and.push({ section: { $in: sections } });
  const kind = (p.get("kind") ?? "").trim();
  if (kind === "denied") and.push({ denied: true });
  else {
    const k = ACTION_KINDS.find((x) => x.value === kind);
    if (k) and.push({ action: { $in: [...k.actions] } });
  }
  const q = (p.get("q") ?? "").trim().slice(0, 80);
  if (q) {
    const re = { $regex: escapeRegex(q), $options: "i" };
    and.push({ $or: [{ path: re }, { "actor.name": re }, { "actor.phone": re }, { target: re }, { ip: re }] });
  }

  // Sahifalash: `at` + `_id` (bir millisekundda bir nechta yozuv bo'lishi mumkin).
  const before = (p.get("before") ?? "").trim();
  const listFilter = [...and];
  if (before) {
    const [iso, id] = before.split("_");
    const at = new Date(iso);
    if (!Number.isNaN(at.getTime()) && ObjectId.isValid(id ?? "")) {
      listFilter.push({ $or: [{ at: { $lt: at } }, { at, _id: { $lt: new ObjectId(id) } }] });
    }
  }

  const db = await ensureIndexes();
  const col = db.collection(ACTION_LOG);
  const [rows, people] = await Promise.all([
    col.find({ $and: listFilter }).sort({ at: -1, _id: -1 }).limit(PAGE + 1).toArray(),
    // Odamlar — faqat sana oralig'i bo'yicha (boshqa filtrlarsiz), filtr ro'yxati uchun.
    col
      .aggregate<{ _id: { e?: number; u?: string; t?: number; n?: string; k?: string }; c: number }>([
        { $match: range },
        { $group: { _id: { e: "$actor.employeeId", u: "$actor.userId", t: "$actor.tgId", n: "$actor.name", k: "$actor.kind" }, c: { $sum: 1 } } },
        { $sort: { c: -1 } },
        { $limit: 400 },
      ])
      .toArray(),
  ]);

  const more = rows.length > PAGE;
  const page = more ? rows.slice(0, PAGE) : rows;
  const last = page[page.length - 1];

  // Bitta odam bir necha ko'rinishda (sayt — userId+employeeId, bot — employeeId,
  // QR — faqat employeeId) — kalit ustuvorligi: xodim → hisob → Telegram → ism.
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
    rows: page.map(({ _id, at, ...rest }) => ({ id: String(_id), at: (at as Date).toISOString(), ...rest })),
    next: more && last ? `${(last.at as Date).toISOString()}_${String(last._id)}` : null,
    people: [...merged.values()].sort((a, b) => b.count - a.count),
  });
}
