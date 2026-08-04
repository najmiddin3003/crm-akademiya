import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { OFFLINE_COURSES } from "@/constants/offlineCourses";
import type { CourseBranch, OfflineCourse } from "@/components/offline-courses/OfflineCoursesProvider";

// Oflayn kurslar backend'i (MongoDB `offline_courses` kolleksiyasi).
// Har bir hujjat: { id, name, color, branches:[{id,name,enabled,price}],
// levels:[{id,name,color,branches:[{id,name,enabled,summa}]}] }.
// Darajalar hujjat ichida (embedded) saqlanadi.

// Kolleksiya bo'sh bo'lsa — 16 ta standart kursni bir marta seed qilamiz
// (constants/offlineCourses.js dan). Shunda backendga ulangач ro'yxat bo'sh
// chiqmaydi. (Barcha kurslar o'chirilsa keyingi GET'da qayta seed bo'ladi — bu
// demo uchun kutilgan xatti-harakat.)
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(OFFLINE_COURSES)));
  }
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("offline_courses");
  await seedIfEmpty(col);
  const rows = await col.find({}).sort({ id: 1 }).toArray();
  const courses = rows.map(({ _id, ...rest }) => rest as unknown as OfflineCourse);
  return NextResponse.json({ ok: true, courses });
}

export async function POST(req: Request) {
  let body: { name?: string; color?: string; branches?: CourseBranch[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Kurs nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("offline_courses");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const course: OfflineCourse = {
    id: nextId,
    name,
    color: body.color || "#000000",
    branches: body.branches ?? [],
    levels: [],
  };
  await col.insertOne({ ...course });
  return NextResponse.json({ ok: true, course });
}
