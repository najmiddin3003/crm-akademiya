import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { compareSecret, isValidPassword, setPasswordFields, MIN_PASSWORD } from "@/lib/invite";

// Sozlamalar → Xavfsizlik → "Parolni o'zgartirish".
// POST /api/auth/change-password  { current_password, new_password }
// Joriy parolni tekshirib, yangisini o'rnatadi (kod/SMS talab qilinmaydi —
// foydalanuvchi allaqachon tizimga kirgan).
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Avtorizatsiya kerak" }, { status: 401 });
  }

  let body: { current_password?: string; new_password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const users = db.collection("users");
  const user = await users.findOne({ _id: new ObjectId(me.id) });
  if (!user) {
    return NextResponse.json({ ok: false, error: "Foydalanuvchi topilmadi" }, { status: 404 });
  }

  // 1) Joriy parol — hech qanday o'zgartirishdan oldin tasdiqlanadi.
  const current = typeof body.current_password === "string" ? body.current_password : "";
  const match = current && user.passwordHash ? await compareSecret(current, user.passwordHash) : false;
  if (!match) {
    return NextResponse.json({ ok: false, error: "Joriy parol noto'g'ri" }, { status: 400 });
  }

  // 2) Yangi parol uzunligi.
  if (!isValidPassword(body.new_password)) {
    return NextResponse.json(
      { ok: false, error: "Yangi parol kamida " + MIN_PASSWORD + " belgi bo'lsin" },
      { status: 400 },
    );
  }

  // 3) Eskisi bilan bir xil parolga almashtirishning ma'nosi yo'q.
  if (body.new_password === current) {
    return NextResponse.json({ ok: false, error: "Yangi parol eskisidan farq qilsin" }, { status: 400 });
  }

  const { passwordHash, passwordEnc } = await setPasswordFields(body.new_password!);
  await users.updateOne(
    { _id: user._id },
    { $set: { passwordHash, passwordEnc, passwordUpdatedAt: new Date() } },
  );

  return NextResponse.json({ ok: true });
}
