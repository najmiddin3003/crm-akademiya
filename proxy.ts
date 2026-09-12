import { NextResponse, type NextRequest } from "next/server";
import { apiAccessFor } from "@/lib/apiPermissions";
import { LOCK_COOKIE } from "@/lib/lock";
import { firstAllowedPath, isPathAllowed, PATHNAME_HEADER } from "@/lib/permissions";
import { accessForSession } from "@/lib/rolePermissions";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "@/lib/session";

// Next.js 16 da `middleware` fayl konvensiyasi eskirgan va `proxy` deb
// qayta nomlangan (node_modules/next/dist/docs/.../proxy.md) — funksiya
// nomi ham `proxy`. Vazifasi o'zgarmagan.
//
// Bu fayl ikki xil so'rovni boshqaradi:
//
//   SAHIFALAR  — login, ekran qulfi VA BO'LIM RUXSATI. Ruxsat ilgari
//                faqat app/(app)/layout.tsx da tekshirilardi va u klient
//                navigatsiyasini ko'rmasdi (pastdagi izohga qarang) —
//                shu sabab birlamchi majburlash shu yerga ko'chirildi.
//                Layoutdagi tekshiruv keshsiz ikkinchi qatlam bo'lib qoldi.
//
//   /api/*     — login VA bo'lim ruxsati SHU YERDA tekshiriladi. Sabab:
//                route handler'lar uchun boshqa umumiy tutash nuqtasi yo'q,
//                va tekshiruvni 128 ta faylga tarqatish "bittasini unutib
//                qoldirish" degani. Bu yerda unutib bo'lmaydi.
//
// Ikkalasi ham bitta dalilga tayanadi: 106 ta sahifa va 149 ta route uchun
// yagona ishonchli tutash nuqta — shu fayl.
//
// Login qilmagan foydalanuvchi hech qaysi CRM sahifasiga kira olmaydi —
// bunday holatda login sahifasiga ("/") qaytariladi. Login/faollashtirish/
// ro'yxatdan o'tish sahifalari ochiq qoladi.
//
// `/ariza` — ish arizasi anketasi: havolasi tashqi nomzodlarga yuboriladi,
// shuning uchun u ham ochiq (Boshqaruv → Ishga qabul (CV)).
//
// `/oquvchi` — o'quvchining Telegram ichida ochiladigan sahifasi. CRM
// sessiyasi bilan emas, bot tokeni bilan imzolangan `initData` orqali
// himoyalangan (lib/studentBot/webapp.ts). Sahifaning o'zi bo'sh qobiq:
// barcha ma'lumot /api/student-web/me dan keladi va imzo o'sha yerda
// tekshiriladi.
// "/tezlik" — ommaviy tezlik poygasi (components/tezlik/SpeedRacePage.tsx).
const PUBLIC_PATHS = ["/", "/activate", "/ariza", "/oquvchi", "/tezlik"];

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

/**
 * `public/` dagi statik fayl (`/globe.svg`, `/file.svg` …).
 *
 * Matcher ularni ham tutadi, ruxsat tekshiruvi esa TEGMASLIGI kerak:
 * aks holda cheklangan xodimda rasm va ikonkalar yuklanmay qolardi
 * (ular ruxsatlar daraxtida yo'q → `isPathAllowed` false).
 */
function isStaticFile(pathname: string): boolean {
  return pathname.slice(pathname.lastIndexOf("/") + 1).includes(".");
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
  //
  // BAZAGA ULANIB BO'LMASA — bu autentifikatsiya xatosi EMAS.
  //
  // Ilgari bu chaqiruv xato bersa, u middleware'dan tashqariga otilardi va
  // Vercel uni "Error running the exported Web Handler" deb 500 qilardi.
  // Natijada baza bir necha daqiqaga javob bermay qolganda HAR BIR /api/*
  // so'rov 500 qaytarardi va sabab tashqaridan umuman ko'rinmasdi.
  //
  // Endi 503 qaytariladi:
  //   • 500 "kod buzuq" degani — bu yerda kod buzuq emas, resurs vaqtincha
  //     yo'q, shuning uchun 503 to'g'ri javob;
  //   • 401 ham noto'g'ri bo'lardi — u foydalanuvchini tizimdan chiqarib
  //     yuborardi, holbuki sessiyasi joyida;
  //   • `Retry-After` klientga qachon qayta urinishni aytadi.
  let me: Awaited<ReturnType<typeof accessForSession>>;
  try {
    me = await accessForSession(session.uid, session.sid);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Baza vaqtincha javob bermayapti. Bir ozdan keyin qayta urinib ko'ring." },
      { status: 503, headers: { "Retry-After": "5" } },
    );
  }
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
    url.pathname = session ? "/home" : "/";
    return NextResponse.redirect(url);
  }

  // Tizimga kirgan foydalanuvchi login sahifasidan BOSH SAHIFAGA tushadi.
  // Ilgari bu "/tasks" edi va tayyor bosh sahifa (Dars jadvali) hech
  // qayerdan ochilmasdi.
  if (pathname === "/" && session) {
    const url = req.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  // ── SAHIFA BO'LIM RUXSATI — SHU YERDA MAJBURLANADI ──────────────────
  //
  // NIMA NOTO'G'RI EDI: bu tekshiruv FAQAT app/(app)/layout.tsx da edi.
  // `(app)/layout.tsx` — UMUMIY layout, Next.js esa "Partial Rendering"
  // bo'yicha klient navigatsiyasida faqat O'ZGARGAN segmentni render
  // qiladi va umumiy layoutni QAYTA ISHGA TUSHIRMAYDI
  // (node_modules/next/dist/docs → 01-app/02-guides/authentication.md,
  // "Layouts and auth checks": "these don't re-render on navigation,
  // meaning the user session won't be checked on every route change").
  //
  // Ya'ni <Link>, `router.push` va `NavigationHistory` dagi
  // `router.replace(last)` / "Orqaga" tugmasi qo'riqchini BUTUNLAY
  // chetlab o'tib, taqiqlangan sahifani ochib yuborardi. Brauzerda
  // o'lchandi: Link bosilgandan keyin taqiqlangan sahifa render bo'ldi,
  // layout esa umuman ishga tushmadi.
  //
  // ALOHIDA XAVF: `NavigationHistory` yo'l tarixini `localStorage` da
  // saqlaydi va u HISOBLAR ORASIDA UMUMIY — admin kirgan sahifaga
  // keyin moderator "Orqaga" bosib tushib qolardi.
  //
  // Proxy esa RSC (soft navigation) so'rovlarida ham ishlaydi — o'lchandi:
  // `curl -H "RSC: 1" /management-filiallar` → 307. Shu sabab yagona
  // ishonchli tutash nuqta shu yer, xuddi /api/* dagidek.
  //
  // `/lock` ATAYLAB CHETDA: u ruxsatlar daraxtida yo'q va tekshiruvga
  // qo'shilsa qulflangan xodim /lock ↔ firstAllowedPath halqasiga tushardi.
  if (session && !isPublic && pathname !== "/lock" && !isStaticFile(pathname)) {
    let me: Awaited<ReturnType<typeof accessForSession>>;
    try {
      me = await accessForSession(session.uid, session.sid);
    } catch {
      // Baza bir lahza javob bermasa BUTUN SAYTNI qulflab qo'ymaymiz —
      // layoutdagi ikkinchi qatlam baribir tekshiradi (u yerda kesh yo'q).
      me = { active: true, permissions: null };
    }

    if (!me.active) {
      const url = req.nextUrl.clone();
      url.pathname = "/api/auth/force-logout";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (!isPathAllowed(pathname, me.permissions)) {
      const url = req.nextUrl.clone();
      url.pathname = firstAllowedPath(me.permissions);
      // Eski sahifaning `?tab=...` i yangi manzilga ilashib qolmasin.
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Layout uchun pathname — IKKINCHI, KESHSIZ qatlam (yuqoridagi tekshiruv
  // 10 soniyalik keshdan o'qiydi, layout esa to'g'ridan-to'g'ri bazadan;
  // rol o'zgarishi shu bilan darhol kuchga kiradi).
  //
  // `set` (append emas) — mijoz shu sarlavhani o'zi yuborib, boshqa sahifa
  // nomi bilan tekshiruvdan o'tib ketolmaydi.
  const headers = new Headers(req.headers);
  headers.set(PATHNAME_HEADER, pathname);
  return NextResponse.next({ request: { headers } });
}
