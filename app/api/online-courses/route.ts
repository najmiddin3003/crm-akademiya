import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { pickCourseFields, type OnlineCourse } from "@/lib/onlineCourses";

// Onlayn kurslar backend'i (MongoDB `online_courses`). Oflayn kurslar
// route'i bilan bir xil qolip (app/api/offline-courses/route.ts).
//
// Demo seed YO'Q — kurslarni foydalanuvchi o'zi qo'shadi.

export async function GET() {
  const db = await ensureIndexes();
  const rows = await db.collection("online_courses").find({}).sort({ id: -1 }).toArray();
  const courses = rows.map(({ _id, ...rest }) => rest as unknown as OnlineCourse);
  return NextResponse.json({ ok: true, courses });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const values = pickCourseFields(body);
  if (!values.name) {
    return NextResponse.json({ ok: false, error: "Kurs nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("online_courses");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  // G'ilofchi 4-bosqichni yakunlaganda kurs har doim aktiv bo'lib saqlanadi
  // ("Aktivlash" tugmasi) — manbadagi ocwSaveAndNext() bilan bir xil.
  const course: OnlineCourse = {
    ...values,
    id: nextId,
    name: values.name,
    description: values.description ?? "",
    what: values.what ?? "",
    price: values.price ?? 0,
    free: values.free ?? false,
    published: true,
    sections: values.sections ?? [],
  };
  // insertOne argumentga _id qo'shib o'zgartiradi — nusxa yuboramiz
  // (app/api/orders/route.ts dagi bilan bir xil ehtiyot).
  await col.insertOne({ ...course });

  return NextResponse.json({ ok: true, course });
}
