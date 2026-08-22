import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { CourseBranch, OfflineCourse } from "@/components/offline-courses/OfflineCoursesProvider";

// Oflayn kurslar backend'i (MongoDB `offline_courses` kolleksiyasi).
// Har bir hujjat: { id, name, color, branches:[{id,name,enabled,price}],
// levels:[{id,name,color,branches:[{id,name,enabled,summa}]}] }.
// Darajalar hujjat ichida (embedded) saqlanadi.

// Demo seed YO'Q — kurslarni foydalanuvchi o'zi qo'shadi.
export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("offline_courses");
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
