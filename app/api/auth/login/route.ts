import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { compareSecret, isValidPhone, normalizePhone } from "@/lib/invite";
import { approvalBlocks, approvalError } from "@/lib/adminApproval";
import { createSessionToken, newSessionId, SESSION_COOKIE, SESSION_MAX_AGE_SEC } from "@/lib/session";
import { describeUserAgent, type UserSession } from "@/lib/userSessions";
import { toUz } from "@/lib/uzTime";

/** "15.08.2026 | 00:22" — loyihadagi boshqa sanalar bilan bir xil format. */
function fmtNow(raw: Date): string {
  const d = toUz(raw);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

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

  if (!user || !user.passwordHash) {
    return NextResponse.json({ ok: false, error: "Telefon raqam yoki parol noto'g'ri" }, { status: 401 });
  }
  if (user.status === "frozen") {
    return NextResponse.json({ ok: false, error: "Hisobingiz vaqtincha muzlatilgan. Administratorga murojaat qiling." }, { status: 403 });
  }
  if (user.status === "blocked") {
    return NextResponse.json({ ok: false, error: "Hisobingiz bloklangan. Administratorga murojaat qiling." }, { status: 403 });
  }
  if (user.status !== "active") {
    return NextResponse.json({ ok: false, error: "Telefon raqam yoki parol noto'g'ri" }, { status: 401 });
  }

  const match = await compareSecret(body.password, user.passwordHash);
  if (!match) {
    return NextResponse.json({ ok: false, error: "Telefon raqam yoki parol noto'g'ri" }, { status: 401 });
  }

  // IKKI BOSQICH — parol to'g'ri, lekin admin hali tasdiqlamagan
  // (lib/adminApproval.ts). Tekshiruv AYNAN shu yerda, parol
  // solishtirilgandan KEYIN: yuqorida bo'lsa, raqamni terib ko'rgan
  // begona odam ham "bu raqamda hisob bor" degan ma'lumotni olardi.
  if (approvalBlocks(user.adminApproval)) {
    return NextResponse.json({ ok: false, error: approvalError(user.adminApproval) }, { status: 403 });
  }

  // Har bir login alohida sessiya (qurilma) yozuvini oladi — "Aktiv qurilmalar"
  // ro'yxati va sessiyani uzish shu orqali ishlaydi.
  const sid = newSessionId();
  const ua = req.headers.get("user-agent") || "";
  const now = fmtNow(new Date());
  const session: UserSession = {
    sid,
    userId: user._id.toString(),
    userAgent: ua,
    label: describeUserAgent(ua),
    ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "",
    createdAt: now,
    lastSeenAt: now,
  };
  await db.collection<UserSession>("user_sessions").insertOne(session);

  const token = await createSessionToken({ uid: user._id.toString(), phone: user.phone, role: user.role || "employee", sid });

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
