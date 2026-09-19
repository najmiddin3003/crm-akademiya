"use client";
import { useT } from "@/components/shared/Language";

// Kurs kartasi muqovasi — crm-akademiya _ocCoverHtml(c) 1:1 ko'chirilgan (4 ta
// aniq seed uchun dekorativ ko'rinish + standart 'icons' varianti). Yangi
// yaratilgan kurslar `cover` qiymatiga ega bo'lmaydi (manbada ham shunday) —
// shuning uchun har doim standart bo'limga tushadi.
export default function CourseCover({ cover }: { cover?: string }) {
  const { t } = useT();
  // G'ilofchida yuklangan kurs rasmi — Cloudinary URL'i. Balandlik INLINE
  // beriladi: preflight `img { height: auto }` qo'ygani uchun `h-full`
  // klassi bu loyihada rasmga ta'sir qilmaydi.
  if (cover?.startsWith("http")) {
    return (
      <img
        src={cover}
        alt=""
        className="absolute inset-0"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    );
  }
  if (cover === "cosmic") {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-500 to-cyan-300">
        <svg className="w-full h-full opacity-90" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points="50,10 20,80 80,80" fill="rgba(255,255,255,0.15)" />
          <polygon points="50,30 30,70 70,70" fill="rgba(255,255,255,0.25)" />
        </svg>
      </div>
    );
  }
  if (cover === "gifts") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-700 to-blue-900 text-white p-3 text-center">
        <div className="text-[13px] font-bold tracking-wider opacity-90">{t("⭐ SOVG'ALAR ⭐")}</div>
        <div className="text-[8px] opacity-80 mt-0.5">{t("Coin yig'ing va o'zingiz yoqtirgan sovg'ani oling")}</div>
        <div className="mt-2 grid grid-cols-3 gap-1.5 w-full">
          {["🧢", "🖊", "👕", "☕", "🛍", "📓"].map((e, i) => (
            <div key={i} className="aspect-square rounded bg-white/15 flex items-center justify-center text-[9px]">{e}</div>
          ))}
        </div>
      </div>
    );
  }
  if (cover === "three") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-800 to-blue-900 relative">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md bg-yellow-400 text-blue-900 text-[10px] font-bold whitespace-nowrap shadow-lg">
          {t("Bizning 3-filialimiz o'z eshiklarini ochdi!")}
        </div>
        <div
          className="text-[120px] font-black bg-gradient-to-b from-yellow-200 via-yellow-400 to-yellow-700 bg-clip-text text-transparent"
          style={{ lineHeight: 1, WebkitTextStroke: "1px rgba(255,200,0,0.5)" }}
        >
          3
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground gap-4">
      <svg className="icon" style={{ width: 42, height: 42, opacity: 0.3 }}><use href="#i-monitor" /></svg>
      <svg className="icon" style={{ width: 42, height: 42, opacity: 0.3 }}><use href="#i-book" /></svg>
    </div>
  );
}
