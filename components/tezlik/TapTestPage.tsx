import { Gauge } from "lucide-react";
import TapTest from "@/components/tezlik/TapTest";
import WhyFast from "@/components/tezlik/WhyFast";

// /tezlik — ommaviy sahifa (loginsiz). Mijozga havola bilan beriladi.
// Sinovning o'zi components/tezlik/TapTest.tsx da — saytdagi suzuvchi
// robot tugmasi (SpeedFab.tsx) ham o'sha komponentni modalda ochadi.

export default function TapTestPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[12px] text-muted-foreground">
            <Gauge className="w-3.5 h-3.5" /> Tizimli · jonli o&apos;lchov
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold">Tezlik sinovi</h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            So&apos;rov sizning qurilmangizdan serverga hozir yuboriladi. Raqamlar shu yerda o&apos;lchanmoqda — taxmin emas.
          </p>
        </header>
        <TapTest />
        <WhyFast />
      </div>
    </main>
  );
}
