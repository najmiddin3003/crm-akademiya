import { NextResponse, after } from "next/server";
import type { Db, Document, WithId } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { clientIp, clientUa, logAction } from "@/lib/actionLog";
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

/**
 * AMALLAR JURNALI (lib/actionLog.ts): kirish va XATO urinish — proxy bu
 * route'ni ataylab yozmaydi, natijasi faqat shu yerda ma'lum. Javobdan
 * keyin (`after`) — kirish sekinlashmaydi.
 */
function auditLogin(
  db: Db,
  req: Request,
  phone: string,
  user: WithId<Document> | null,
  status: number,
  reason: string | null,
  sid: string | null = null,
) {
  after(async () => {
    const empId = Number(user?.hrEmployeeId);
    const emp = user && Number.isFinite(empId)
      ? await db.collection("hr_employees").findOne({ id: empId }, { projection: { _id: 0, name: 1 } }).catch(() => null)
      : null;
    await logAction(db, {
      actor: user
        ? {
            kind: "user",
            userId: String(user._id),
            employeeId: Number.isFinite(empId) ? empId : null,
            name: String(emp?.name ?? user.fullName ?? "").trim() || null,
            role: (user.role as string | undefined) ?? null,
            phone,
          }
        : { kind: "public", phone },
      source: "web",
      section: "auth",
      action: reason ? "login_failed" : "login",
      path: "/api/auth/login",
      status,
      ip: clientIp(req.headers),
      ua: clientUa(req.headers),
      sid,
      ...(reason ? { details: { reason } } : {}),
    });
  });
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
    auditLogin(db, req, phone, null, 401, "hisob topilmadi");
    return NextResponse.json({ ok: false, error: "Telefon raqam yoki parol noto'g'ri" }, { status: 401 });
  }
  if (user.status === "frozen") {
    auditLogin(db, req, phone, user, 403, "hisob muzlatilgan");
    return NextResponse.json({ ok: false, error: "Hisobingiz vaqtincha muzlatilgan. Administratorga murojaat qiling." }, { status: 403 });
  }
  if (user.status === "blocked") {
    auditLogin(db, req, phone, user, 403, "hisob bloklangan");
    return NextResponse.json({ ok: false, error: "Hisobingiz bloklangan. Administratorga murojaat qiling." }, { status: 403 });
  }
  if (user.status !== "active") {
    auditLogin(db, req, phone, user, 401, "hisob faol emas");
    return NextResponse.json({ ok: false, error: "Telefon raqam yoki parol noto'g'ri" }, { status: 401 });
  }

  const match = await compareSecret(body.password, user.passwordHash);
  if (!match) {
    auditLogin(db, req, phone, user, 401, "parol noto'g'ri");
    return NextResponse.json({ ok: false, error: "Telefon raqam yoki parol noto'g'ri" }, { status: 401 });
  }

  // IKKI BOSQICH — parol to'g'ri, lekin admin hali tasdiqlamagan
  // (lib/adminApproval.ts). Tekshiruv AYNAN shu yerda, parol
  // solishtirilgandan KEYIN: yuqorida bo'lsa, raqamni terib ko'rgan
  // begona odam ham "bu raqamda hisob bor" degan ma'lumotni olardi.
  if (approvalBlocks(user.adminApproval)) {
    auditLogin(db, req, phone, user, 403, "admin tasdig'i kutilmoqda");
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
    // nginx `X-Real-IP` — `X-Forwarded-For` ning birinchi qiymatini mijoz o'zi yozib yuborishi mumkin.
    ip: clientIp(req.headers) ?? "",
    createdAt: now,
    lastSeenAt: now,
  };
  await db.collection<UserSession>("user_sessions").insertOne(session);
  auditLogin(db, req, phone, user, 200, null, sid);

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
