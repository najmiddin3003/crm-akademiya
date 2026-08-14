import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureIndexes } from "@/lib/mongodb";
import { LOCK_COOKIE } from "@/lib/lock";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import type { UserSession } from "@/lib/userSessions";

// POST /api/auth/logout — sessiya cookie'ni tozalaydi va shu qurilmaning
// `user_sessions` yozuvini o'chiradi (aks holda u "Aktiv qurilmalar" ro'yxatida
// osilib qolardi).
export async function POST() {
  const jar = await cookies();
  const session = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (session?.sid) {
    try {
      const db = await ensureIndexes();
      await db.collection<UserSession>("user_sessions").deleteOne({ sid: session.sid });
    } catch {
      // DB'ga ulanib bo'lmasa ham cookie tozalanaversin — foydalanuvchi
      // baribir chiqib ketishi kerak.
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(LOCK_COOKIE);
  return res;
}
