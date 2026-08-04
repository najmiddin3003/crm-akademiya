import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// GET /api/auth/force-logout — sessiya cookie'ni tozalab, login sahifasiga
// qaytaradi. (app) layout foydalanuvchi DB'da faol emasligini (muzlatilgan/
// bloklangan/o'chirilgan) aniqlasa shu yerga yo'naltiradi — cookie route
// handler'da o'chiriladi, shuning uchun middleware qayta orqaga qaytarib
// yubormaydi.
export async function GET(req: Request) {
  const url = new URL("/", req.url);
  const res = NextResponse.redirect(url);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
