import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { compareSecret } from "@/lib/invite";
import { LOCK_COOKIE } from "@/lib/lock";
import { SESSION_COOKIE } from "@/lib/session";

/** Shuncha xato paroldan keyin hisobdan chiqariladi (37-qism, «Ekran qulfi» rasmi). */
const MAX_FAILS = 5;

// POST /api/auth/unlock — { password } to'g'ri bo'lsa qulfni ochadi.
// Sessiya qulflash paytida ham saqlanib turgani uchun bu yerda faqat parol
// tekshiriladi, qayta login qilinmaydi.
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Avtorizatsiya kerak" }, { status: 401 });
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  if (!body.password) {
    return NextResponse.json({ ok: false, error: "Parolni kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const user = await db.collection("users").findOne({ _id: new ObjectId(me.id) });
  if (!user?.passwordHash) {
    return NextResponse.json({ ok: false, error: "Parol tekshirib bo'lmadi" }, { status: 400 });
  }
  const match = await compareSecret(body.password, user.passwordHash);
  if (!match) {
    const fails = Number(user.lockFails ?? 0) + 1;
    if (fails >= MAX_FAILS) {
      await db.collection("users").updateOne({ _id: user._id }, { $set: { lockFails: 0 }, $unset: { lockedAt: "" } });
      if (me.sid) await db.collection("user_sessions").deleteOne({ sid: me.sid });
      const out = NextResponse.json({ ok: false, loggedOut: true, error: "5 marta xato parol — hisobdan chiqarildingiz" }, { status: 401 });
      out.cookies.delete(LOCK_COOKIE);
      out.cookies.delete(SESSION_COOKIE);
      return out;
    }
    await db.collection("users").updateOne({ _id: user._id }, { $set: { lockFails: fails } });
    return NextResponse.json({ ok: false, error: "Parol noto'g'ri", left: MAX_FAILS - fails }, { status: 401 });
  }
  await db.collection("users").updateOne({ _id: user._id }, { $set: { lockFails: 0 }, $unset: { lockedAt: "" } });

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(LOCK_COOKIE);
  return res;
}
