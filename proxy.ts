import { NextResponse, type NextRequest } from "next/server";
import { apiAccessFor } from "@/lib/apiPermissions";
import { LOCK_COOKIE } from "@/lib/lock";
import { PATHNAME_HEADER } from "@/lib/permissions";
import { accessForSession } from "@/lib/rolePermissions";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "@/lib/session";

// Next.js 16 da `middleware` fayl konvensiyasi eskirgan va `proxy` deb
// qayta nomlangan (node_modules/next/dist/docs/.../proxy.md) — funksiya
// nomi ham `proxy`. Vazifasi o'zgarmagan.
//
// Bu fayl ikki xil so'rovni boshqaradi:
//
//   SAHIFALAR  — login tekshiruvi, ekran qulfi va pathname'ni layoutga
//                uzatish. Bo'lim ruxsati app/(app)/layout.tsx da
//                tekshiriladi (u yerda DB ochiq va kesh yo'q).
//
//   /api/*     — login VA bo'lim ruxsati SHU YERDA tekshiriladi. Sabab:
//                route handler'lar uchun boshqa umumiy tutash nuqtasi yo'q,
//                va tekshiruvni 128 ta faylga tarqatish "bittasini unutib
//                qoldirish" degani. Bu yerda unutib bo'lmaydi.
//
// Login qilmagan foydalanuvchi hech qaysi CRM sahifasiga kira olmaydi —
// bunday holatda login sahifasiga ("/") qaytariladi. Login/faollashtirish/
// ro'yxatdan o'tish sahifalari ochiq qoladi.
//
// `/ariza` — ish arizasi anketasi: havolasi tashqi nomzodlarga yuboriladi,
// shuning uchun u ham ochiq (Boshqaruv → Ishga qabul (CV)).
const PUBLIC_PATHS = ["/", "/activate", "/ariza"];

/** Ekran qulflangan bo'lsa ham ishlashi kerak bo'lgan API'lar. */
const LOCKED_ALLOWED_API = new Set([
  "/api/auth/unlock",
  "/api/auth/logout",
  "/api/auth/force-logout",
  "/api/auth/lock",
]);

// `api/` endi matcher'dan CHIQARILMAYDI — aks holda API'lar bu
// tekshiruvlarni butunlay chetlab o'tardi.
export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};

function deny(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

async function handleApi(
  pathname: string,
  method: string,
  session: SessionPayload | null,
  locked: boolean,
) {
  const access = apiAccessFor(pathname, method);
  if (access.kind === "public") return NextResponse.next();

  if (!session) return deny(401, "Tizimga kirmagansiz");
  if (locked && !LOCKED_ALLOWED_API.has(pathname)) {
    return deny(401, "Ekran qulflangan");
  }

  // Hisob holati va ruxsatlar (qisqa keshli — lib/rolePermissions.ts).
  const me = await accessForSession(session.uid, session.sid);
  if (!me.active) return deny(401, "Sessiya amal qilmaydi");

  if (access.kind === "permission" && me.permissions !== null) {
    const ok = access.anyOf.some((key) => me.permissions!.includes(key));
    if (!ok) return deny(403, "Bu bo'limga ruxsatingiz yo'q");
  }

  return NextResponse.next();
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  const locked = Boolean(session) && req.cookies.get(LOCK_COOKIE)?.value === "1";

  if (pathname.startsWith("/api/")) {
    return handleApi(pathname, req.method, session, locked);
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!isPublic && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Ekran qulflangan bo'lsa — sessiya saqlanadi, lekin hamma sahifa /lock ga
  // yo'naltiriladi. Parol kiritilgach qulf ochiladi (/api/auth/unlock).
  if (locked && pathname !== "/lock") {
    const url = req.nextUrl.clone();
    url.pathname = "/lock";
    return NextResponse.redirect(url);
  }
  if (!locked && pathname === "/lock") {
    const url = req.nextUrl.clone();
    url.pathname = session ? "/tasks" : "/";
    return NextResponse.redirect(url);
  }

  if (pathname === "/" && session) {
    const url = req.nextUrl.clone();
    url.pathname = "/tasks";
    return NextResponse.redirect(url);
  }

  // Sahifaning bo'lim ruxsati app/(app)/layout.tsx da tekshiriladi — u
  // yerda kesh yo'q, ya'ni rol o'zgarishi darhol kuchga kiradi. Layout esa
  // URL'ni KO'RMAYDI, shu sabab pathname'ni sarlavha orqali uzatamiz.
  //
  // `set` (append emas) — mijoz shu sarlavhani o'zi yuborib, boshqa sahifa
  // nomi bilan tekshiruvdan o'tib ketolmaydi.
  const headers = new Headers(req.headers);
  headers.set(PATHNAME_HEADER, pathname);
  return NextResponse.next({ request: { headers } });
}
