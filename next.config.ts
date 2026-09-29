import type { NextConfig } from "next";

// XAVFSIZLIK SARLAVHALARI (27.09.2026, audit: clickjacking, MIME-sniffing,
// referrer, qurilma ruxsatlari). HSTS va `server_tokens off` nginx'da
// (transport darajasi — nginx o'zi qaytaradigan javoblarga ham tushsin).
//
// X-Frame-Options EMAS, CSP `frame-ancestors`: X-Frame-Options ruxsat
// ro'yxatini ifodalay olmaydi, bizga esa ikki istisno kerak:
//   • o'z domenimiz — CV'dagi PDF ko'ruvchi `/api/management-cv/:id/file`
//     ni iframe'da ochadi;
//   • Telegram Web (web.telegram.org) — botlarning Mini App'lari
//     (`/oquvchi`, `/me/tg`, xodimlarniki `/xodim`) u yerda iframe ichida
//     ochiladi. Telefon va desktop ilovalari o'z webview'ida ochadi.
//
// To'liq CSP (script-src/connect-src …) ATAYIN yo'q: Next.js'ning inline
// skriptlari, tungi rejim skripti, Telegram SDK, Cloudinary rasmlari va
// Google Sheets ulanishi uchun nonce/ro'yxat kerak — noto'g'ri yozilsa sayt
// sinadi. Bu yerdagilar hech narsani sindirmaydigan qismi.
const FRAME_SELF = "frame-ancestors 'self'; object-src 'none'; base-uri 'self'";
const FRAME_TELEGRAM = "frame-ancestors 'self' https://web.telegram.org; object-src 'none'; base-uri 'self'";

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: FRAME_SELF },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Ilova kamera/mikrofonni ishlatmaydi (27.09.2026 da tekshirildi). JOYLASHUV
  // 29.09.2026 dan faqat o'z domenimizga ochiq: «Ishga keldim» Mini App'i
  // (Telegram LocationManager bo'lmasa brauzer geolokatsiyasi) va Boshqaruv →
  // Filiallar'dagi «📍 Hozirgi joylashuvim» tugmasi. QR skaner Telegram'ning
  // o'zida — sahifaga kamera kerak emas.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  // `X-Powered-By: Next.js` — versiya/texnologiyani oshkor qilmasin.
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // Keyingi qoida bir xil kalitni USTIDAN yozadi (hujjat: "the last header
      // key will override the first") — Mini App sahifalarida Telegram Web ham.
      { source: "/oquvchi/:path*", headers: [{ key: "Content-Security-Policy", value: FRAME_TELEGRAM }] },
      { source: "/me/:path*", headers: [{ key: "Content-Security-Policy", value: FRAME_TELEGRAM }] },
      // Xodimlar botining «Profilim» Mini App'i (28.09.2026).
      { source: "/xodim/:path*", headers: [{ key: "Content-Security-Policy", value: FRAME_TELEGRAM }] },
    ];
  },
  experimental: {
    // Klient router keshi. Standart qiymat `dynamic: 0` — ya'ni kesh YO'Q.
    // (app) ostidagi 106 ta route'ning HAMMASI dinamik (layout `cookies()`
    // va `getCurrentUser()` ni ishlatadi), shuning uchun sahifadan chiqib
    // darhol qaytish har safar to'liq server render'ini qayta yugurtirardi
    // — layout'dagi Mongo o'qishlari bilan birga.
    //
    // 30 soniya ataylab: lib/clientCache.ts o'quvchilar ro'yxati uchun
    // aynan shu TTL'ni tanlagan, ya'ni bu ilova allaqachon rozi bo'lgan
    // eskirish oynasidan kattaroq oyna ochilmayapti.
    //
    // Hujjatga ko'ra (next/dist/docs → config/staleTimes.md) bu
    // back/forward keshiga ta'sir qilmaydi va umumiy layout'lar baribir
    // har navigatsiyada qayta so'ralmaydi — faqat o'zgargan segment.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
