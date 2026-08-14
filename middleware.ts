import { NextResponse, type NextRequest } from "next/server";
import { LOCK_COOKIE } from "@/lib/lock";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Login qilmagan foydalanuvchi hech qaysi CRM sahifasiga kira olmaydi —
// bunday holatda login sahifasiga ("/") qaytariladi. Login/faollashtirish/
// ro'yxatdan o'tish sahifalari ochiq qoladi.
const PUBLIC_PATHS = ["/", "/activate", "/register"];

export const config = {
  matcher: ["/((?!_next/|api/|favicon.ico).*)"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (!isPublic && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Ekran qulflangan bo'lsa — sessiya saqlanadi, lekin hamma sahifa /lock ga
  // yo'naltiriladi. Parol kiritilgach qulf ochiladi (/api/auth/unlock).
  const locked = session && req.cookies.get(LOCK_COOKIE)?.value === "1";
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

  return NextResponse.next();
}
