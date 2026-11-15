import { NextResponse, after } from "next/server";
import type { Db, Document, WithId } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { clientIp, clientUa, logAction } from "@/lib/actionLog";
import { compareSecret, isValidPhone, normalizePhone } from "@/lib/invite";
import { approvalBlocks, approvalError } from "@/lib/adminApproval";
import { createSessionToken, newSessionId, SESSION_COOKIE, SESSION_MAX_AGE_SEC, SHORT_SESSION_TTL_MS } from "@/lib/session";
import { describeUserAgent, type UserSession } from "@/lib/userSessions";
import { toUz } from "@/lib/uzTime";
import {
  blockedMessage,
  DEVICE_COOKIE,
  DEVICE_COOKIE_MAX_AGE,
  guardContext,
  isSuspicious,
  loginBlockedUntil,
  registerLoginFailure,
  registerLoginSuccess,
  reportSuspiciousLogin,
  type GuardContext,
} from "@/lib/loginGuard";

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
  extra: Record<string, unknown> | null = null,
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
      branchId: cookieBranch(req),
      ...(reason ? { details: { reason, ...(extra ?? {}) } } : {}),
    });
  });
}

/** Qurilma cookie'si (lib/loginGuard.ts) — yo'q bo'lsa har qanday javobga yoziladi. */
function withDevice(res: NextResponse, ctx: GuardContext): NextResponse {
  if (ctx.setDevice) {
    res.cookies.set(DEVICE_COOKIE, ctx.setDevice, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: DEVICE_COOKIE_MAX_AGE,
      path: "/",
    });
  }
  return res;
}

/**
 * Blok javobi — 429 va `Retry-After`. `ctx` null — yangi qurilma cookie'si
 * berilmaydi: blokdagi cookie'siz brauzer keyingi safar ham o'sha kalitga tushadi.
 */
function blockedReply(until: number, now: number, ctx: GuardContext | null): NextResponse {
  const res = NextResponse.json({ ok: false, error: blockedMessage(until, now), blockedUntil: until }, { status: 429 });
  res.headers.set("Retry-After", String(Math.max(1, Math.ceil((until - now) / 1000))));
  return ctx ? withDevice(res, ctx) : res;
}

/** Qurilmadagi oxirgi tanlangan filial (navbar cookie'si `branch`) — kirish yozuvi uchun. */
function cookieBranch(req: Request): number | null {
  const m = /(?:^|;\s*)branch=(\d+)/.exec(req.headers.get("cookie") ?? "");
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

// POST /api/auth/login — telefon + parol bilan kirish, sessiya cookie o'rnatadi.
export async function POST(req: Request) {
  let body: { phone?: string; password?: string; remember?: unknown };
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

  // KIRISH QOROVULI (lib/loginGuard.ts): bloklangan «IP + qurilma» (yoki IP)
  // uchun parol umuman solishtirilmaydi — hisob bormi-yo'qmi ham bilinmaydi.
  const ctx = guardContext(req);
  const nowMs = Date.now();
  const blockedUntil = await loginBlockedUntil(db, ctx, nowMs);
  if (blockedUntil !== null) {
    auditLogin(db, req, phone, null, 429, "blok davom etmoqda", null, { blockedUntil: new Date(blockedUntil).toISOString() });
    return blockedReply(blockedUntil, nowMs, null);
  }

  /** Noto'g'ri urinish: sanaladi, blok tushsa — 429, aks holda odatdagi 401. */
  const fail = async (u: WithId<Document> | null, reason: string): Promise<NextResponse> => {
    const out = await registerLoginFailure(db, ctx, phone, nowMs);
    const block = out.block ?? out.ipBlock;
    auditLogin(
      db, req, phone, u, out.blockedUntil !== null ? 429 : 401, reason, null,
      block ? { block: { number: block.number, minutes: Math.round(block.ms / 60_000), ip: out.ipBlock !== null } } : null,
    );
    if (isSuspicious(out)) {
      const susp = out.ipBlock
        ? { kind: "ip" as const, block: out.ipBlock }
        : { kind: "pair" as const, block: out.block! };
      after(() => reportSuspiciousLogin(db, { ctx, ...susp, totalFails: out.totalFails, phones: out.phones }, nowMs));
    }
    if (out.blockedUntil !== null) return blockedReply(out.blockedUntil, nowMs, ctx);
    return withDevice(NextResponse.json({ ok: false, error: "Telefon raqam yoki parol noto'g'ri" }, { status: 401 }), ctx);
  };

  const user = await db.collection("users").findOne({ phone });

  if (!user || !user.passwordHash) return fail(null, "hisob topilmadi");
  if (user.status === "frozen") {
    auditLogin(db, req, phone, user, 403, "hisob muzlatilgan");
    return withDevice(NextResponse.json({ ok: false, error: "Hisobingiz vaqtincha muzlatilgan. Administratorga murojaat qiling." }, { status: 403 }), ctx);
  }
  if (user.status === "blocked") {
    auditLogin(db, req, phone, user, 403, "hisob bloklangan");
    return withDevice(NextResponse.json({ ok: false, error: "Hisobingiz bloklangan. Administratorga murojaat qiling." }, { status: 403 }), ctx);
  }
  if (user.status !== "active") return fail(user, "hisob faol emas");

  const match = await compareSecret(body.password, user.passwordHash);
  if (!match) return fail(user, "parol noto'g'ri");

  // Parol to'g'ri — joriy bosqichdagi xatolar tozalanadi (bosqich emas — lib/loginGuard.ts).
  await registerLoginSuccess(db, ctx, nowMs);

  // IKKI BOSQICH — parol to'g'ri, lekin admin hali tasdiqlamagan
  // (lib/adminApproval.ts). Tekshiruv AYNAN shu yerda, parol
  // solishtirilgandan KEYIN: yuqorida bo'lsa, raqamni terib ko'rgan
  // begona odam ham "bu raqamda hisob bor" degan ma'lumotni olardi.
  if (approvalBlocks(user.adminApproval)) {
    auditLogin(db, req, phone, user, 403, "admin tasdig'i kutilmoqda");
    return withDevice(NextResponse.json({ ok: false, error: approvalError(user.adminApproval) }, { status: 403 }), ctx);
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

  // «Meni eslab qol» (yangi kirish sahifasi, 25.10.2026): belgilanmagan bo'lsa — brauzer
  // yopilguncha (cookie muddatsiz) va imzo 12 soat. Eski sahifa yubormaydi — avvalgidek 30 kun.
  const remember = body.remember !== false;
  const token = await createSessionToken(
    { uid: user._id.toString(), phone: user.phone, role: user.role || "employee", sid },
    remember ? undefined : SHORT_SESSION_TTL_MS,
  );

  const res = NextResponse.json({ ok: true, role: user.role || "employee" });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    ...(remember ? { maxAge: SESSION_MAX_AGE_SEC } : {}),
    path: "/",
  });
  return withDevice(res, ctx);
}
