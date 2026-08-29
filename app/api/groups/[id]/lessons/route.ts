import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Group } from "@/lib/groups";
import { toUz } from "@/lib/uzTime";

// Guruh mashg'ulotlari — Guruh tafsiloti > "Mashg'ulot qo'shish" tabi.
// MongoDB kolleksiyasi: `group_lessons`.
//
// Tuzilishi app/api/groups/[id]/tasks/route.ts (group_tasks) bilan bir xil:
// id ketma-ket generatsiya qilinadi, guruh mavjudligi tekshiriladi, javob
// { ok, ... } shaklida qaytadi.
//
// Tip lib/ ga chiqarilmadi — uni faqat shu route va
// components/groups/AddLessonModal.tsx bo'lishadi; modal o'z nusxasini
// export qiladi va GroupDetailPage undan `import type` bilan oladi.
interface GroupLesson {
  id: number;
  groupId: number;
  /** Mashg'ulot nomi. */
  name: string;
  /** Yordamchi o'qituvchilar — hr_employees dagi aktiv xodim ismlari. */
  assistants: string[];
  /** "DD.MM.YYYY | HH:mm" — loyihadagi boshqa kolleksiyalar bilan bir xil. */
  createdAt: string;
}

function fmtNow(raw: Date): string {
  const d = toUz(raw);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// GET /api/groups/:id/lessons — shu guruhning mashg'ulotlari.
// Tartib id bo'yicha o'sish tomon: jadvaldagi "№" ustuni qo'shilish tartibini
// ko'rsatadi, shuning uchun eng eskisi birinchi turadi.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const rows = await db.collection("group_lessons").find({ groupId }).sort({ id: 1 }).toArray();
  const lessons = rows.map(({ _id, ...rest }) => rest as unknown as GroupLesson);
  return NextResponse.json({ ok: true, lessons });
}

// POST /api/groups/:id/lessons — yangi mashg'ulot.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: { name?: string; assistants?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Mashg'ulot nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const group = await db.collection<Group>("groups").findOne({ id: groupId });
  if (!group) {
    return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }

  // Yordamchilar ixtiyoriy. Ro'yxat klientda /api/hr-employees dan
  // to'ldiriladi, shuning uchun bu yerda faqat tozalash kifoya — bo'sh
  // satrlar tashlab yuboriladi, takrorlar birlashtiriladi.
  const rawAssistants: unknown[] = Array.isArray(body.assistants) ? body.assistants : [];
  const assistants = Array.from(new Set(rawAssistants.map((a) => String(a).trim()).filter(Boolean)));

  const col = db.collection("group_lessons");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const lesson: GroupLesson = {
    id: nextId,
    groupId,
    name,
    assistants,
    createdAt: fmtNow(new Date()),
  };
  await col.insertOne({ ...lesson });
  return NextResponse.json({ ok: true, lesson });
}

// DELETE /api/groups/:id/lessons?lessonId=5 — bitta mashg'ulotni o'chiradi.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  // XOM qiymatni ham tekshiramiz: `Number(null)` — 0 va u `Number.isFinite`
  // dan o'tib ketadi, ya'ni parametrsiz so'rov `id: 0` bo'yicha o'chirishga
  // urinardi. Shuning uchun avval parametr borligini tekshiramiz.
  const raw = new URL(req.url).searchParams.get("lessonId");
  const lessonId = Number(raw);
  if (!raw || !Number.isInteger(lessonId)) {
    return NextResponse.json({ ok: false, error: "Mashg'ulot tanlanmagan" }, { status: 400 });
  }

  const db = await ensureIndexes();
  // groupId ham filtrga kiradi — boshqa guruhning mashg'uloti o'chib
  // ketmasligi uchun.
  const res = await db.collection("group_lessons").deleteOne({ id: lessonId, groupId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Mashg'ulot topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, deleted: res.deletedCount });
}
