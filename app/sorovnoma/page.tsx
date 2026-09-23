import type { Metadata } from "next";
import { connection } from "next/server";
import SurveyPage from "@/components/leads/SurveyPage";
import { ensureIndexes } from "@/lib/mongodb";
import { loadSurveyConfig } from "@/lib/surveyServer";
import "./sorovnoma.css";

// Ommaviy so'rovnoma — «Bepul sinov darsiga yoziling». Havola reklamaga
// qo'yiladi (Lidlar sahifasidagi «So'rovnoma sahifasi» tugmasi). Sahifa
// `(app)` guruhidan tashqarida — sidebar/navbar yo'q, kirish talab
// qilinmaydi (proxy.ts → PUBLIC_PATHS).
//
// Ro'yxatlar serverda, sahifa bilan birga keladi (lib/surveyServer.ts):
// Sozlamalar → Lidlar, Boshqaruv → Filiallar va O'quvchilar oqimidagi
// manbalar. `connection()` — sahifa har so'rovda chiziladi: sozlama
// o'zgarsa reklama havolasi darhol yangisini ko'rsatsin (build paytidagi
// nusxada qotib qolmasin).
//
// SHRIFTLAR prototipdagidek (Manrope — sarlavhalar, IBM Plex Sans — matn),
// lekin `next/font/google` bilan EMAS: 23.09.2026 da VPS'dagi build aynan
// Manrope'da yiqildi ("next/font/google queries have exactly one entry",
// lokalda qaytarilmadi) va deploy to'xtadi. Build paytida Google'ga
// bog'liqlik bo'lmasin — shrift brauzerda yuklanadi (React <link> ni
// <head> ga o'zi ko'taradi); ulanmasa tizim shrifti chiqadi.

const FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap";

export const metadata: Metadata = {
  title: "Akademiya o'quv markazi — Bepul sinov darsi",
  description: "Fanlar, chet tillari va Prezident maktabiga tayyorlov — bepul sinov darsiga 1 daqiqada yoziling.",
  icons: { icon: "/sorovnoma/favicon.png" },
};

export default async function Page() {
  await connection();
  const db = await ensureIndexes();
  const config = await loadSurveyConfig(db);
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={FONTS_CSS} precedence="default" />
      <div className="srv">
        <SurveyPage config={config} />
      </div>
    </>
  );
}
