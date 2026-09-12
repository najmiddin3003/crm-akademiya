"use client";

import { Gauge } from "lucide-react";
import SpeedRace, { WhyFast } from "@/components/tezlik/SpeedRace";

// /tezlik — ommaviy sahifa (loginsiz). Mijozga havola bilan beriladi.
// O'lchovning o'zi components/tezlik/SpeedRace.tsx da — saytdagi suzuvchi
// robot tugmasi (SpeedFab.tsx) ham o'sha komponentni modalda ochadi.

export default function SpeedRacePage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[12px] text-muted-foreground">
            <Gauge className="w-3.5 h-3.5" /> Tizimli · jonli o&apos;lchov
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold">Tezlik poygasi</h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Sizning qurilmangizdan ikkala serverga bir vaqtda so&apos;rov yuboriladi. Raqamlar shu yerda, hozir o&apos;lchanmoqda — taxmin emas.
          </p>
        </header>
        <SpeedRace />
        <WhyFast />
      </div>
    </main>
  );
}
