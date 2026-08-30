import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
