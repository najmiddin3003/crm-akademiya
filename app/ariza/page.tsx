import type { Metadata } from "next";
import { Anton, Inter, Montserrat } from "next/font/google";
import CvApplyPage, { type ApplyBranch } from "@/components/management/CvApplyPage";
import { ensureIndexes } from "@/lib/mongodb";
import "./ariza.css";

// Ommaviy ish arizasi — nomzod CRM'ga kirmasdan to'ldiradi. Havolani
// Boshqaruv → Ishga qabul (CV) sahifasidagi "Ariza havolasini ulashish"
// tugmasi beradi. Sahifa `(app)` guruhidan tashqarida — sidebar/navbar yo'q.
//
// Dizayn (19.09.2026) — foydalanuvchining "akademiya-ishga-ariza.html"
// fayli: chap panelda jonli ariza kartasi, o'ngda 4 bo'limli forma,
// mobilda pastki panel. Shriftlar dizayndagidek: Anton (sarlavha),
// Montserrat (qalin yorliqlar), Inter (matn).
//
// FILIALLAR bazadan (Boshqaruv → Filiallar) — nomzod o'zi ishlamoqchi
// bo'lgan filialni tanlaydi va ariza o'sha filialning ro'yxatiga tushadi.
// Server komponent bo'lgani uchun so'rovsiz, sahifa bilan birga keladi.

const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-ariza-anton", display: "swap" });
const inter = Inter({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600"], variable: "--font-ariza-inter", display: "swap" });
const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800"],
  variable: "--font-ariza-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Akademiya o'quv markazi — Ishga ariza",
  description: "Akademiya o'quv markazida bo'sh ish o'rinlari uchun ariza. To'ldirish 3 daqiqa vaqt oladi.",
  icons: { icon: "/ariza/favicon.png" },
};

export default async function Page() {
  const db = await ensureIndexes();
  const rows = await db
    .collection("branches")
    .find({}, { projection: { _id: 0, id: 1, name: 1, location: 1, address: 1, phone: 1 } })
    .sort({ id: 1 })
    .toArray();
  const branches: ApplyBranch[] = rows.map((b) => ({
    id: Number(b.id),
    name: String(b.name ?? ""),
    location: String(b.location ?? ""),
    address: String(b.address ?? ""),
    phone: String(b.phone ?? ""),
  }));

  return (
    <div className={`ariza ${anton.variable} ${inter.variable} ${montserrat.variable}`}>
      <CvApplyPage branches={branches} />
    </div>
  );
}
