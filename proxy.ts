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

// ── ESKI SERVER (VERCEL) QO'RIQCHISI ─────────────────────────────────
//
// Prod 12.09.2026 da VPS'ga ko'chdi (deploy/README.md), lekin Vercel
// loyihasi tirik va unga `tizimli24.uz` domeni hamon biriktirilgan.
// 12–14.09 da filial 1 aynan shu yo'l bilan ATLAS'ga (endi faqat zaxira
// ko'zgusi) yozib qo'ydi: kompyuteri DNS'ni eskicha hal qilib Vercel'ga
// tushgan, kechki ko'zgu esa yozuvlarini o'chirib yuborgan
// (scripts/_merge-atlas-20260914.mjs, scripts/_import-sheet-rows-20260912.mjs).
//
// Shu bois Vercel'da ILOVA UMUMAN ISHLAMAYDI — so'rov bazaga yetmasdan
// shu yerda to'xtaydi:
//   • `*.vercel.app` orqali kelgan → yangi manzilga 308 (yo'l saqlanadi);
//   • `tizimli24.uz` deb kelgan (mijoz DNS'i eskirgan, Vercel IP'siga hal
//     qilgan) → redirect HALQA bo'lardi (o'sha nom yana Vercel'ga qaytadi),
//     shuning uchun DNS'ni to'g'rilash yo'riqnomali sahifa;
//   • `/api/*` → JSON 503 — ochiq turgan sahifa xatoni ko'rsatadi,
//     hech narsa yozilmaydi.
//
// Vercel har deploy'ga `VERCEL=1` ni o'zi qo'yadi — qo'lda sozlash shart
// emas, unutib bo'lmaydi. VPS'da bu o'zgaruvchi yo'q → blok o'chiq.
// Orqaga qaytish (deploy/README.md, 13-band) uchun Vercel'da
// `APP_MOVED_TO=off`; manzilni o'zgartirish uchun `APP_MOVED_TO=https://…`.
const MOVED_TO_DEFAULT = "https://www.tizimli24.uz";

function movedTarget(): string | null {
  const raw = (process.env.APP_MOVED_TO || "").trim();
  if (raw === "off") return null;
  if (/^https?:\/\//.test(raw)) return raw.replace(/\/+$/, "");
  return process.env.VERCEL === "1" ? MOVED_TO_DEFAULT : null;
}

function movedPage(target: string, host: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Tizim yangi serverga ko'chdi</title>
<style>body{margin:0;font:16px/1.5 system-ui,Segoe UI,Roboto,sans-serif;background:#f4f6f8;color:#1f2937}
main{max-width:640px;margin:8vh auto;padding:32px 28px;background:#fff;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.08)}
h1{font-size:22px;margin:0 0 12px}p{margin:10px 0}code{background:#eef2f7;padding:2px 6px;border-radius:6px}
.warn{background:#fff7ed;border:1px solid #fdba74;padding:12px 14px;border-radius:10px}
a.btn{display:inline-block;margin:14px 0;padding:12px 18px;background:#0f766e;color:#fff;text-decoration:none;border-radius:10px;font-weight:600}
ol{padding-left:22px}li{margin:6px 0}small{color:#6b7280}</style></head><body><main>
<h1>Tizim yangi serverga ko'chdi</h1>
<p class="warn"><b>Bu — eski server.</b> Bu yerda kiritilgan ma'lumot <b>saqlanmaydi</b>. Iltimos, faqat yangi manzildan ishlang.</p>
<a class="btn" href="${esc(target)}">${esc(target.replace(/^https?:\/\//, ""))} ga o'tish</a>
<p>Agar aynan shu manzilni yozganingizda ham bu sahifa chiqsa — kompyuteringiz sayt manzilini <b>eski serverga</b> hal qilyapti (DNS keshi). Tuzatish:</p>
<ol>
<li>Kompyuter DNS'ini <code>8.8.8.8</code> va <code>1.1.1.1</code> ga o'zgartiring (Tarmoq sozlamalari → adapter → IPv4 → DNS).</li>
<li>Buyruq satrida: <code>ipconfig /flushdns</code>; Chrome'da <code>chrome://net-internals/#dns</code> → <b>Clear host cache</b>.</li>
<li>Brauzerni to'liq yopib qayta oching; yordam bermasa router'ni o'chirib yoqing.</li>
<li>Baribir chiqsa — administratorga shu sahifaning suratini yuboring.</li>
</ol>
<p><small>So'rov kelgan manzil: <code>${esc(host)}</code></small></p>
</main></body></html>`;
}

function movedResponse(req: NextRequest, target: string) {
  const host = req.headers.get("host") || req.nextUrl.host;
  if (host.endsWith(".vercel.app")) {
    return NextResponse.redirect(new URL(req.nextUrl.pathname + req.nextUrl.search, target), 308);
  }
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, error: `Tizim yangi serverga ko'chgan (${target}). Kompyuteringiz eski manzilga ulanmoqda — sahifani yangilang va yo'riqnomaga amal qiling.` },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  return new NextResponse(movedPage(target, host), {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

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

  // Eski server — hech qanday tekshiruvdan OLDIN (yuqoridagi izoh).
  const moved = movedTarget();
  if (moved) return movedResponse(req, moved);

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
