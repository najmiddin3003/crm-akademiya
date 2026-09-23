import type { Metadata } from "next";
import { IBM_Plex_Sans, Manrope } from "next/font/google";
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
// Shriftlar prototipdagidek: Manrope (sarlavhalar), IBM Plex Sans (matn).

const manrope = Manrope({ subsets: ["latin", "cyrillic"], weight: ["500", "600", "700", "800"], variable: "--font-srv-manrope", display: "swap" });
const plex = IBM_Plex_Sans({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"], variable: "--font-srv-plex", display: "swap" });

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
    <div className={`srv ${manrope.variable} ${plex.variable}`}>
      <SurveyPage config={config} />
    </div>
  );
}
