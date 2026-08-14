import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import type { UserSession } from "@/lib/userSessions";

// Profil menyusi → "Aktiv qurilmalar".
// GET    /api/sessions          — joriy foydalanuvchining ochiq sessiyalari
// DELETE /api/sessions?sid=...  — bitta qurilmani chiqarish
// DELETE /api/sessions?all=1    — joriy qurilmadan tashqari hammasini chiqarish

export async function GET() {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Avtorizatsiya kerak" }, { status: 401 });
  }
  const db = await ensureIndexes();
  const rows = await db
    .collection<UserSession>("user_sessions")
    .find({ userId: me.id })
    .toArray();

  const sessions = rows
    .map(({ sid, label, ip, createdAt, lastSeenAt }) => ({
      sid,
      label,
      ip,
      createdAt,
      lastSeenAt,
      current: sid === me.sid,
    }))
    // Joriy qurilma doim tepada.
    .sort((a, b) => Number(b.current) - Number(a.current));

  return NextResponse.json({ ok: true, sessions, currentSid: me.sid ?? null });
}

export async function DELETE(req: Request) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Avtorizatsiya kerak" }, { status: 401 });
  }
  const url = new URL(req.url);
  const sid = url.searchParams.get("sid");
  const all = url.searchParams.get("all");

  const db = await ensureIndexes();

  if (all === "1") {
    // Joriy qurilma qoladi — foydalanuvchi o'zini chiqarib yubormasin.
    const filter: Record<string, unknown> = { userId: me.id };
    if (me.sid) filter.sid = { $ne: me.sid };
    const res = await db.collection<UserSession>("user_sessions").deleteMany(filter);
    return NextResponse.json({ ok: true, deleted: res.deletedCount });
  }

  if (!sid) {
    return NextResponse.json({ ok: false, error: "Qurilma tanlanmagan" }, { status: 400 });
  }
  // Faqat o'z sessiyasini o'chira oladi.
  const res = await db.collection<UserSession>("user_sessions").deleteOne({ sid, userId: me.id });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Qurilma topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, deleted: 1, wasCurrent: sid === me.sid });
}
