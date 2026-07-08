import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { compareSecret, isValidPhone, normalizePhone } from "@/lib/invite";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SEC } from "@/lib/session";

// POST /api/auth/login — telefon + parol bilan kirish, sessiya cookie o'rnatadi.
export async function POST(req: Request) {
  let body: { phone?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  if (!isValidPhone(body.phone) || !body.password) {
    return NextResponse.json({ ok: false, error: "Telefon raqam va parolni to'liq kiriting" }, { status: 400 });
  }

  const phone = normalizePhone(body.phone);
  const db = await ensureIndexes();
  const user = await db.collection("users").findOne({ phone });

  if (!user || !user.passwordHash || user.status !== "active") {
    return NextResponse.json({ ok: false, error: "Telefon raqam yoki parol noto'g'ri" }, { status: 401 });
  }

  const match = await compareSecret(body.password, user.passwordHash);
  if (!match) {
    return NextResponse.json({ ok: false, error: "Telefon raqam yoki parol noto'g'ri" }, { status: 401 });
  }

  const token = await createSessionToken({ uid: user._id.toString(), phone: user.phone, role: user.role || "employee" });

  const res = NextResponse.json({ ok: true, role: user.role || "employee" });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SEC,
    path: "/",
  });
  return res;
}
