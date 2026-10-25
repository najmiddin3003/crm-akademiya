"use client";

import { CalendarCheck, GraduationCap, Users, Wallet } from "lucide-react";
import { useT } from "@/components/shared/Language";

// YANGI VERSIYA — KIRISH SAHIFASINING CHAP PANELI (rasm «Kirish sahifasi», yorug'/qorong'i,
// 25.10.2026, 14-qism): teal gradient (o'ng tepada yorug' dog'), «Tizimli» belgisi, «O'quv
// markazingiz — bitta tizimda», uchta imkoniyat va pastda «© 2026 Tizimli · tizimli24.uz».
// Ikkala temada bir xil; kompyuterda (≥1024 px) ko'rinadi, torroqda — faqat belgi (AuthLogo).

/** «Tizimli» belgisi: `onBrand` — teal fon ustida (oq, shaffof kvadrat), aks holda brend kvadrat. */
export function AuthLogo({ onBrand = false }: { onBrand?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex shrink-0 items-center justify-center rounded-v2-md ${
          onBrand ? "size-9 border border-white/25 bg-white/15 text-white" : "size-8 bg-v2-brand text-v2-on-brand"
        }`}
        aria-hidden
      >
        <GraduationCap className={onBrand ? "size-5" : "size-[18px]"} strokeWidth={1.75} />
      </span>
      <span className={`text-[17px] font-semibold ${onBrand ? "text-white" : "text-v2-text"}`}>Tizimli</span>
    </div>
  );
}

const FEATURES = [
  { icon: Wallet, title: "Moliya va oylik", text: "Kassalar, to'lovlar, oylik — bir joyda" },
  { icon: CalendarCheck, title: "Davomat va tanga", text: "O'qituvchi telefonidan bir necha soniyada" },
  { icon: Users, title: "Lidlar va o'quvchilar", text: "Birinchi qo'ng'iroqdan guruhgacha" },
] as const;

export default function AuthBrandPanel() {
  const { t } = useT();
  return (
    <aside
      className="relative hidden w-[45%] max-w-[640px] shrink-0 flex-col justify-between overflow-hidden px-12 py-10 text-white lg:flex"
      style={{
        background:
          "radial-gradient(circle at 88% 4%, rgba(255,255,255,0.22), transparent 42%), linear-gradient(165deg, var(--v2-teal-500) 0%, var(--v2-teal-600) 48%, var(--v2-teal-700) 100%)",
      }}
    >
      <AuthLogo onBrand />
      <div className="max-w-[420px]">
        <h2 className="text-[30px] font-semibold leading-[38px]">{t("O'quv markazingiz — bitta tizimda")}</h2>
        <ul className="mt-7 space-y-5">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-start gap-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-white/15" aria-hidden>
                <f.icon className="size-[18px]" strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-5">{t(f.title)}</span>
                <span className="mt-0.5 block text-[13.5px] leading-5 text-white/80">{t(f.text)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[12.5px] text-white/75">© {new Date().getFullYear()} Tizimli · tizimli24.uz</p>
    </aside>
  );
}
