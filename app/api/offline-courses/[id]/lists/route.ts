import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { CourseListItem, OfflineCourse } from "@/components/offline-courses/OfflineCoursesProvider";

// Oflayn kursning "Kitoblar" va "Mavzular" ro'yxatlari.
//
// Ilgari kurs tafsilotidagi olti tabdan beshtasi HECH NARSA yuklamas edi —
// hammasi bir xil statik "Ma'lumot yo'q" paneli chizardi. Ulardan uchtasi
// (Hafta kunlari / Kurs vaqtlari / O'qituvchilar) endi guruhlardan
// hisoblanadi, qolgan ikkitasi esa haqiqiy CRUD ro'yxatga aylandi.
//
// Ma'lumot kursning O'Z hujjatiga (`offline_courses`) joylashtiriladi —
// xuddi `levels` kabi. Sabab: kitob/mavzu kursdan tashqarida ma'noga ega
// emas, va bu yo'l yangi kolleksiya ham, yangi indeks ham talab qilmaydi.
//
// Ikkala ro'yxat bir xil shaklda bo'lgani uchun bitta generic route yetarli
// (app/api/settings-lists/route.ts dagi `kind` yondashuvi bilan bir xil).

type ListKind = "books" | "topics";

function isKind(v: string | null): v is ListKind {
  return v === "books" || v === "topics";
}

function parseCourseId(id: string): number | null {
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

// GET /api/offline-courses/:id/lists?kind=books
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = parseCourseId(id);
  const kind = new URL(req.url).searchParams.get("kind");
  if (courseId === null) return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  if (!isKind(kind)) return NextResponse.json({ ok: false, error: "Noto'g'ri kind" }, { status: 400 });

  const db = await ensureIndexes();
  const course = await db.collection<OfflineCourse>("offline_courses").findOne({ id: courseId });
  if (!course) return NextResponse.json({ ok: false, error: "Kurs topilmadi" }, { status: 404 });

  const items = Array.isArray(course[kind]) ? (course[kind] as CourseListItem[]) : [];
  return NextResponse.json({ ok: true, items });
}

// POST /api/offline-courses/:id/lists?kind=books — { name, extra? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = parseCourseId(id);
  const kind = new URL(req.url).searchParams.get("kind");
  if (courseId === null) return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  if (!isKind(kind)) return NextResponse.json({ ok: false, error: "Noto'g'ri kind" }, { status: 400 });

  let body: { name?: string; extra?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection<OfflineCourse>("offline_courses");
  const course = await col.findOne({ id: courseId });
  if (!course) return NextResponse.json({ ok: false, error: "Kurs topilmadi" }, { status: 404 });

  // id kurs ICHIDA oshiriladi — levels bilan bir xil qoida.
  const existing = Array.isArray(course[kind]) ? (course[kind] as CourseListItem[]) : [];
  const item: CourseListItem = {
    id: existing.reduce((max, x) => Math.max(max, x.id), 0) + 1,
    name,
    extra: (body.extra || "").trim(),
  };

  // Shoxlar alohida: hisoblanadigan kalit ({ [kind]: ... }) drayverning
  // PushOperator tipiga tushmaydi.
  if (kind === "books") await col.updateOne({ id: courseId }, { $push: { books: item } });
  else await col.updateOne({ id: courseId }, { $push: { topics: item } });

  return NextResponse.json({ ok: true, item });
}

// DELETE /api/offline-courses/:id/lists?kind=books&itemId=3
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = parseCourseId(id);
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const itemId = Number(url.searchParams.get("itemId"));
  if (courseId === null) return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  if (!isKind(kind)) return NextResponse.json({ ok: false, error: "Noto'g'ri kind" }, { status: 400 });
  if (!Number.isFinite(itemId)) return NextResponse.json({ ok: false, error: "Noto'g'ri itemId" }, { status: 400 });

  const db = await ensureIndexes();
  const col = db.collection<OfflineCourse>("offline_courses");
  const res = kind === "books"
    ? await col.updateOne({ id: courseId }, { $pull: { books: { id: itemId } } })
    : await col.updateOne({ id: courseId }, { $pull: { topics: { id: itemId } } });
  if (res.matchedCount === 0) {
    return NextResponse.json({ ok: false, error: "Kurs topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
