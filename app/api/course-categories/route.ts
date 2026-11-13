import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { branchPool } from "@/lib/branchPools";
import { branchInCondition, getBranchScope } from "@/lib/branchScope";
import type { CatCourse, CatGroup } from "@/lib/categoryPrices";
import { normalizeCourseCategory } from "@/lib/courseCategories";
import { ROOM_HOLDING_STATUSES } from "@/lib/groupRules";
import { ensureIndexes } from "@/lib/mongodb";

// «SOZLAMALAR → O'QUV → KATEGORIYALAR» (24-qism, 13.11.2026).
//
// GET    — kurslar (kategoriya, darajalar va filial narxlari) + navbardagi filial (hovuzi
//          bilan) tirik guruhlari. Kartalar mijozda yig'iladi (lib/categoryPrices.ts) —
//          narx oynasi o'sha hisobni qayta ishlatadi.
// PUT    { from?, name, courseIds } — kategoriya yaratish/tahrirlash: `courseIds` dagi
//          kurslar `name` ga o'tadi; `from` (tahrir) kategoriyasidan chiqarilgan kurslar —
//          kategoriyasiz. Nom o'zgarsa — qayta nomlash.
// DELETE ?name= — kategoriya olinadi, kurslari kategoriyasiz qoladi (kurs o'chmaydi).
//
// Kategoriya alohida kolleksiya EMAS — `offline_courses.category` (lib/courseCategories.ts),
// shu bois kursi yo'q kategoriya bo'lmaydi. Narx o'zgartirish — ./price/route.ts.

const NO_STORE = { "Cache-Control": "private, no-store" };
const sameCat = (a: unknown, b: unknown) => normalizeCourseCategory(a).toLowerCase() === normalizeCourseCategory(b).toLowerCase();

export async function GET() {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Sessiya amal qilmaydi" }, { status: 401 });
  const me = await getCurrentUser();
  const db = await ensureIndexes();
  const pool = [...branchPool(scope.branchId)];

  const [courses, groups, branches] = await Promise.all([
    db
      .collection("offline_courses")
      .find({}, { projection: { _id: 0, id: 1, name: 1, category: 1, active: 1, branches: 1, "levels.name": 1, "levels.branches": 1 } })
      .toArray(),
    db
      .collection("groups")
      .aggregate([
        { $match: { $and: [branchInCondition(pool), { status: { $in: [...ROOM_HOLDING_STATUSES] } }] } },
        {
          $project: {
            _id: 0,
            id: 1,
            name: 1,
            course: 1,
            level: 1,
            branchId: 1,
            students: { $size: { $ifNull: ["$studentIds", []] } },
          },
        },
      ])
      .toArray(),
    db
      .collection("branches")
      .find({ id: { $in: pool } }, { projection: { _id: 0, id: 1, name: 1 } })
      .toArray(),
  ]);

  const branchName = pool
    .map((id) => String(branches.find((b) => Number(b.id) === id)?.name ?? "").trim())
    .filter(Boolean)
    .join(" + ");

  return NextResponse.json(
    {
      ok: true,
      branchId: scope.branchId,
      branchName,
      canEditPrice: me?.role === "admin",
      courses: courses.map((c) => ({
        id: Number(c.id),
        name: String(c.name ?? ""),
        category: normalizeCourseCategory(c.category),
        active: c.active !== false,
        branches: Array.isArray(c.branches) ? c.branches : [],
        levels: Array.isArray(c.levels) ? c.levels.map((l: { name?: string; branches?: unknown[] }) => ({ name: String(l?.name ?? ""), branches: Array.isArray(l?.branches) ? l.branches : [] })) : [],
      })) as CatCourse[],
      groups: groups.map((g) => ({
        id: Number(g.id),
        name: String(g.name ?? ""),
        course: String(g.course ?? ""),
        level: g.level ? String(g.level) : "",
        branchId: Number(g.branchId) || 1,
        students: Number(g.students) || 0,
      })) as CatGroup[],
    },
    { headers: NO_STORE },
  );
}

export async function PUT(req: Request) {
  let body: { from?: unknown; name?: unknown; courseIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const name = normalizeCourseCategory(body.name);
  const from = typeof body.from === "string" ? normalizeCourseCategory(body.from) : null;
  const ids = Array.isArray(body.courseIds) ? [...new Set(body.courseIds.map(Number).filter((n) => Number.isInteger(n)))] : [];
  if (!name) return NextResponse.json({ ok: false, error: "Kategoriya nomini kiriting" }, { status: 400 });
  if (ids.length === 0) return NextResponse.json({ ok: false, error: "Kamida bitta kursni tanlang" }, { status: 400 });

  const db = await ensureIndexes();
  const col = db.collection("offline_courses");
  const all = await col.find({}, { projection: { _id: 0, id: 1, category: 1 } }).toArray();
  if (ids.some((id) => !all.some((c) => Number(c.id) === id))) {
    return NextResponse.json({ ok: false, error: "Kurs topilmadi" }, { status: 404 });
  }
  // Boshqa mavjud kategoriya nomini egallab bo'lmaydi (tahrirda — o'zinikidan tashqari).
  const taken = all.some((c) => sameCat(c.category, name) && !(from && sameCat(c.category, from)));
  if (taken) return NextResponse.json({ ok: false, error: "Bunday kategoriya allaqachon bor" }, { status: 409 });

  let cleared = 0;
  if (from) {
    const drop = all.filter((c) => sameCat(c.category, from) && !ids.includes(Number(c.id))).map((c) => Number(c.id));
    if (drop.length) cleared = (await col.updateMany({ id: { $in: drop } }, { $set: { category: "" } })).modifiedCount;
  }
  const res = await col.updateMany({ id: { $in: ids } }, { $set: { category: name } });
  return NextResponse.json({ ok: true, name, assigned: res.matchedCount, cleared });
}

export async function DELETE(req: Request) {
  const name = normalizeCourseCategory(new URL(req.url).searchParams.get("name"));
  if (!name) return NextResponse.json({ ok: false, error: "Kategoriya nomini kiriting" }, { status: 400 });
  const db = await ensureIndexes();
  const col = db.collection("offline_courses");
  const ids = (await col.find({}, { projection: { _id: 0, id: 1, category: 1 } }).toArray()).filter((c) => sameCat(c.category, name)).map((c) => Number(c.id));
  if (ids.length === 0) return NextResponse.json({ ok: false, error: "Kategoriya topilmadi" }, { status: 404 });
  const res = await col.updateMany({ id: { $in: ids } }, { $set: { category: "" } });
  return NextResponse.json({ ok: true, cleared: res.modifiedCount });
}
