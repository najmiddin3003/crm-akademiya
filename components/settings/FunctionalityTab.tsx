"use client";

import { useState } from "react";
import { ChevronRight, ArrowLeft } from "lucide-react";
import SettingsForm from "./SettingsForm";
import SettingsNote from "./SettingsNote";
import { FUNCTIONALITY_CARDS } from "@/constants/settingsFunctionality";
import type { FunctionalityCard } from "@/lib/settings";
import { useT } from "@/components/shared/Language";

// Umumiy sozlamalar → Funksionallik. Referensdagi kabi: avval 8 ta karta
// ro'yxati, kartaga bosilganda o'sha kartaning formasi ochiladi (orqaga
// tugmasi bilan). Forma renderi umumiy — SettingsForm.
//
// Har bir karta o'z kaliti bilan saqlanadi: "general.<card.key>"

const CARDS = FUNCTIONALITY_CARDS as FunctionalityCard[];

// Sakkizala kartaning toggllari bazaga to'g'ri yoziladi, lekin "general.*"
// kalitlarini o'qiydigan kod butun repoda yo'q (grep bilan tekshirildi:
// masalan `attendanceEnabled`, `debtLimitEnabled`, `mHisobot`, `phoneRequired`
// hech qayerda ishlatilmaydi). Toggle'ni jim qoldirish — "yoqdim, ishladi"
// degan yolg'on va'da; shu bois kartaning ustida bitta rost izoh turadi.
// Izoh faqat karta ICHIDA ko'rsatiladi — va'da o'sha yerda, toggllar yonida
// beriladi, ro'yxat sahifasi esa shunchaki bo'limlar nomini sanaydi.
const NOT_WIRED_NOTE = (
  <SettingsNote>
    Bu kartadagi belgilar saqlanadi, lekin tizimning boshqa bo&apos;limlari ularni hozircha
    o&apos;qimaydi &mdash; yoqilgan belgi hech qanday ekran yoki hisob-kitob xulqini o&apos;zgartirmaydi.
  </SettingsNote>
);

function CardHeader({ card, onBack }: { card: FunctionalityCard; onBack: () => void }) {
  const { t } = useT();
  return (
    <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
      <button
        onClick={onBack}
        className="h-9 w-9 shrink-0 rounded-lg border border-border hover:bg-secondary flex items-center justify-center"
        title={t("Orqaga")}
      >
        <ArrowLeft className="w-4 h-4" />
      </button>
      <span className={`h-9 w-9 shrink-0 rounded-lg ${card.color} flex items-center justify-center text-white`}>
        <svg className="icon icon-sm"><use href={`#${card.icon}`} /></svg>
      </span>
      <div className="min-w-0">
        <div className="text-[15px] font-semibold truncate">{t(card.title)}</div>
        <div className="text-[12px] text-muted-foreground truncate">{t(card.description)}</div>
      </div>
    </div>
  );
}

export default function FunctionalityTab() {
  const { t } = useT();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const card = CARDS.find((c) => c.key === openKey);

  if (card) {
    return (
      <SettingsForm
        key={card.key}
        storageKey={`general.${card.key}`}
        groups={card.groups}
        header={<CardHeader card={card} onBack={() => setOpenKey(null)} />}
        note={NOT_WIRED_NOTE}
      />
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
      {CARDS.map((c) => (
        <button
          key={c.key}
          onClick={() => setOpenKey(c.key)}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-secondary/40 transition-colors text-left"
        >
          <span className={`h-10 w-10 shrink-0 rounded-lg ${c.color} flex items-center justify-center text-white`}>
            <svg className="icon icon-sm"><use href={`#${c.icon}`} /></svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium truncate">{t(c.title)}</span>
            <span className="block text-[12px] text-muted-foreground truncate">{t(c.description)}</span>
          </span>
          <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}
