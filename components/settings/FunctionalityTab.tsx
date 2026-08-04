"use client";

import { useState } from "react";
import { ChevronRight, ArrowLeft } from "lucide-react";
import SettingsForm from "./SettingsForm";
import { FUNCTIONALITY_CARDS } from "@/constants/settingsFunctionality";
import type { FunctionalityCard } from "@/lib/settings";

// Umumiy sozlamalar → Funksionallik. Referensdagi kabi: avval 8 ta karta
// ro'yxati, kartaga bosilganda o'sha kartaning formasi ochiladi (orqaga
// tugmasi bilan). Forma renderi umumiy — SettingsForm.
//
// Har bir karta o'z kaliti bilan saqlanadi: "general.<card.key>"

const CARDS = FUNCTIONALITY_CARDS as FunctionalityCard[];

function CardHeader({ card, onBack }: { card: FunctionalityCard; onBack: () => void }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
      <button
        onClick={onBack}
        className="h-9 w-9 shrink-0 rounded-lg border border-border hover:bg-secondary flex items-center justify-center"
        title="Orqaga"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>
      <span className={`h-9 w-9 shrink-0 rounded-lg ${card.color} flex items-center justify-center text-white`}>
        <svg className="icon icon-sm"><use href={`#${card.icon}`} /></svg>
      </span>
      <div className="min-w-0">
        <div className="text-[15px] font-semibold truncate">{card.title}</div>
        <div className="text-[12px] text-muted-foreground truncate">{card.description}</div>
      </div>
    </div>
  );
}

export default function FunctionalityTab() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const card = CARDS.find((c) => c.key === openKey);

  if (card) {
    return (
      <SettingsForm
        key={card.key}
        storageKey={`general.${card.key}`}
        groups={card.groups}
        header={<CardHeader card={card} onBack={() => setOpenKey(null)} />}
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
            <span className="block text-[14px] font-medium truncate">{c.title}</span>
            <span className="block text-[12px] text-muted-foreground truncate">{c.description}</span>
          </span>
          <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}
