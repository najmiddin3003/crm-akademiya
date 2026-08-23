import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ensureIndexes } from "@/lib/mongodb";

// O'quvchi profili → "Parol o'rnatish" tabi.
//
// O'quvchi va ota-ona uchun kirish ma'lumotlari. Parolning O'ZI saqlanmaydi —
// faqat bcrypt xeshi; GET esa parol o'rnatilgan-o'rnatilmaganini aytadi,
// xeshni ham, parolni ham qaytarmaydi.

type Role = "student" | "parent";

const FIELDS: Record<Role, { login: string; hash: string }> = {
  student: { login: "studentLogin", hash: "studentPasswordHash" },
  parent: { login: "parentLogin", hash: "parentPasswordHash" },
};

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pupilId = parseId(id);
  if (pupilId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const doc = await db.collection("pupils").findOne({ id: pupilId });
  if (!doc) {
    return NextResponse.json({ ok: false, error: "O'quvchi topilmadi" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    student: { login: doc.studentLogin ?? "", hasPassword: Boolean(doc.studentPasswordHash) },
    parent: { login: doc.parentLogin ?? "", hasPassword: Boolean(doc.parentPasswordHash) },
  });
}

// POST { role: "student" | "parent", login, password? }
// `password` bo'sh bo'lsa faqat login yangilanadi (mavjud parol saqlanadi).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pupilId = parseId(id);
  if (pupilId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: { role?: string; login?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const role = body.role === "parent" ? "parent" : "student";
  const login = (body.login || "").trim();
  const password = body.password || "";

  if (!login) {
    return NextResponse.json({ ok: false, error: "Login majburiy" }, { status: 400 });
  }
  if (password && password.length < 6) {
    return NextResponse.json({ ok: false, error: "Parol kamida 6 belgidan iborat bo'lsin" }, { status: 400 });
  }

  const f = FIELDS[role as Role];
  const set: Record<string, unknown> = { [f.login]: login };
  if (password) set[f.hash] = await bcrypt.hash(password, 10);

  const db = await ensureIndexes();
  const res = await db.collection("pupils").updateOne({ id: pupilId }, { $set: set });
  if (res.matchedCount === 0) {
    return NextResponse.json({ ok: false, error: "O'quvchi topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, role, login, passwordChanged: Boolean(password) });
}
