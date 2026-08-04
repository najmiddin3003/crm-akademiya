import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { EDU_CATEGORY_SEED } from "@/constants/eduCategories";
import type { EduCategory } from "@/lib/eduCategories";

// O'quv bo'limi → Kategoriya backend'i (MongoDB `edu_categories`). Bo'sh
// bo'lsa demo kategoriyani seed qiladi.
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(EDU_CATEGORY_SEED)));
  }
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("edu_categories");
  await seedIfEmpty(col);
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const categories = rows.map(({ _id, ...rest }) => rest as unknown as EduCategory);
  return NextResponse.json({ ok: true, categories });
}

export async function POST(req: Request) {
  let body: Partial<EduCategory>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Kategoriya nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("edu_categories");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const category: EduCategory = { id: nextId, name };
  await col.insertOne({ ...category });
  return NextResponse.json({ ok: true, category });
}
