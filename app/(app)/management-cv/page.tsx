"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

// Boshqaruv → Ishga chaqiruv (CV). Hozircha faqat sarlavha + "CV to'ldirish"
// tugmasi — bosilsa "CV to'ldirish" yozuvi chiqadi. To'liq oqim (CV list,
// filtrlash, holat va boshqalar) keyingi bosqichda qo'shiladi.
export default function ManagementCvPage() {
  const [clicked, setClicked] = useState(false);

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[18px] md:text-[20px] font-bold">Ishga chaqiruv (CV)</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Anketa asosida kelgan CV lar, munosiblarini tanlab Xodimlar ro&apos;yxatiga qo&apos;shing
          </p>
        </div>
        <button
          type="button"
          onClick={() => setClicked(true)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <FileText className="w-4 h-4" />
          CV to&apos;ldirish
        </button>
      </div>

      {clicked && (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-[15px] font-medium">CV to&apos;ldirish</p>
        </div>
      )}
    </div>
  );
}
