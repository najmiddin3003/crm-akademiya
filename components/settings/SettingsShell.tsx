"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode } from "react";
import { SETTINGS_SECTIONS } from "@/constants/settings";
import type { SettingsSection } from "@/lib/settings";
import { useT } from "@/components/shared/Language";

// Sozlamalar karkasi — referensdagi tuzilma: chapda kichik bo'limlar
// ro'yxati, o'ngda tanlangan tab mazmuni.
//
// Tanlangan tab URL'da (`?tab=`) saqlanadi — shunda sahifani yangilash yoki
// havolani ulashish tabni yo'qotmaydi (referensda ham `?status=` shunday).

const SECTIONS = SETTINGS_SECTIONS as SettingsSection[];

export function useSettingsTab(sectionKey: string) {
  const params = useSearchParams();
  const section = SECTIONS.find((s) => s.key === sectionKey);
  const fallback = section?.tabs[0]?.key ?? "";
  const requested = params.get("tab");
  // Noto'g'ri/eskirgan tab so'ralsa birinchisiga tushamiz.
  const active = requested && section?.tabs.some((t) => t.key === requested) ? requested : fallback;
  return { section, active };
}

export default function SettingsShell({
  sectionKey,
  children,
}: {
  sectionKey: string;
  children: (activeTab: string) => ReactNode;
}) {
  const { t } = useT();
  const router = useRouter();
  const { section, active } = useSettingsTab(sectionKey);

  if (!section) {
    return <div className="p-5 text-sm text-muted-foreground">{t("Sozlama bo'limi topilmadi.")}</div>;
  }

  // Tabsiz bo'lim (Integratsiyalar) — chap panelsiz, butun kenglik.
  if (section.tabs.length === 0) {
    return <div className="container mx-auto max-w-[1900px] p-4 md:p-5">{children("")}</div>;
  }

  return (
    <div className="container mx-auto max-w-[1900px] p-4 md:p-5">
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 items-start">
        <nav className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
          {section.tabs.map((tv) => (
            <button
              key={tv.key}
              onClick={() => router.push(`${section.href}?tab=${tv.key}`)}
              className={`w-full text-left px-5 py-3.5 text-sm transition-colors ${
                active === tv.key ? "text-primary font-medium bg-primary/5" : "hover:bg-secondary/40"
              }`}
            >
              {t(tv.label)}
            </button>
          ))}
        </nav>

        <div className="min-w-0">{children(active)}</div>
      </div>
    </div>
  );
}
