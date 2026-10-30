import { CENTER_NAME, IS_AKADEMIYA } from "@/lib/center";
import type { Metadata } from "next";
import { connection } from "next/server";
import "@fontsource-variable/manrope/wght.css";
import "@fontsource-variable/ibm-plex-sans/wght.css";
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
// SHRIFTLAR prototipdagidek (Manrope — sarlavhalar, IBM Plex Sans — matn) —
// LOYIHA ICHIDAN (npm @fontsource-variable, 20.10.2026; oila nomlari
// 'Manrope Variable', 'IBM Plex Sans Variable' — sorovnoma.css). `next/font/google`
// EMAS: 23.09.2026 da VPS'dagi build aynan Manrope'da yiqilgan ("next/font/google
// queries have exactly one entry"); 20.10 gacha shrift brauzerda Google'dan
// olinardi — endi sahifa Google'ga umuman murojaat qilmaydi.

export const metadata: Metadata = {
  title: `${CENTER_NAME} — Bepul sinov darsi`,
  description: "Fanlar, chet tillari va Prezident maktabiga tayyorlov — bepul sinov darsiga 1 daqiqada yoziling.",
  ...(IS_AKADEMIYA ? { icons: { icon: "/sorovnoma/favicon.png" } } : {}),
};

export default async function Page() {
  await connection();
  const db = await ensureIndexes();
  const config = await loadSurveyConfig(db);
  return (
    <div className="srv">
      <SurveyPage config={config} />
    </div>
  );
}
