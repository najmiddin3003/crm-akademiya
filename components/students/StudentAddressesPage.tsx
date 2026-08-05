"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { STUDENT_ADDRESSES } from "@/constants/studentAddresses";

// Leaflet `window`ga tayansa kerak — shu uchun xarita faqat client'da,
// ssr: false bilan yuklanadi (Next.js lazy-loading yo'riqnomasiga ko'ra).
const StudentAddressesMap = dynamic(() => import("./StudentAddressesMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
      Xarita yuklanmoqda…
    </div>
  ),
});

const FILIALS = ["Akademiya", "Akademiya 2-filial"];

export default function StudentAddressesPage() {
  const [filial, setFilial] = useState("");

  const filtered = useMemo(
    () => (filial ? STUDENT_ADDRESSES.filter((a) => a.filial === filial) : STUDENT_ADDRESSES),
    [filial],
  );

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-[18px] font-semibold tracking-tight">O&apos;quvchilar manzillari</h1>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
            <span className="text-muted-foreground">Umumiy soni:</span>
            <span className="font-bold tabular-nums">{filtered.length.toLocaleString("ru-RU").replace(/,/g, " ")}</span>
          </div>
          <div className="relative w-48">
            <select
              value={filial}
              onChange={(e) => setFilial(e.target.value)}
              className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Barcha filiallar</option>
              {FILIALS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden h-[70vh] min-h-[420px]">
        <StudentAddressesMap addresses={filtered} />
      </div>
    </div>
  );
}
