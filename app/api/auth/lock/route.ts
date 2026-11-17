import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import { LOCK_COOKIE } from "@/lib/lock";
import { SESSION_MAX_AGE_SEC } from "@/lib/session";

// POST /api/auth/lock — ekranni qulflaydi. Sessiya saqlanadi, faqat qulf
// cookie'si qo'yiladi; middleware shundan keyin hamma sahifani /lock ga
// yo'naltiradi.
export async function POST() {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Avtorizatsiya kerak" }, { status: 401 });
  }
  // 37-qism: qulflangan vaqt («18:12 dan beri») va xato urinishlar hisobi — ekran qulfi sahifasi uchun.
  const db = await ensureIndexes();
  await db.collection("users").updateOne({ _id: new ObjectId(me.id) }, { $set: { lockedAt: new Date(), lockFails: 0 } });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(LOCK_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SEC,
    path: "/",
  });
  return res;
}
