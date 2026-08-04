"use client";

import { useMemo, useState } from "react";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { GROUP_ROOMS, GROUP_SEED, GROUP_TIMES } from "@/constants/groups";

// Hisobotlar → Xonalar analitikasi (href /reports-rooms).
//
// Yangi backend YO'Q — bandlik mavjud guruhlar jadvalidan (constants/groups.js
// GROUP_SEED) hisoblanadi: har bir guruh bitta xonada, bitta vaqt oralig'ini
// egallaydi. Sig'im = shu xonadagi mumkin bo'lgan slotlar soni × bo'linish
// (Kun / Hafta / Oy) — referensdagi "71/280" ko'rinishidagi nisbat shundan.

const DIVIDES = [
  { key: "day", label: "Kun", factor: 1 },
  { key: "week", label: "Hafta", factor: 7 },
  { key: "month", label: "Oy", factor: 30 },
] as const;

type DivideKey = (typeof DIVIDES)[number]["key"];

interface Group {
  room?: string;
  students?: number;
  status?: string;
}

export default function Page() {
  const [divide, setDivide] = useState<DivideKey>("day");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });

  const factor = DIVIDES.find((d) => d.key === divide)!.factor;

  const rooms = useMemo(() => {
    const groups = GROUP_SEED as Group[];
    // Bir xonaga to'g'ri kelgan aktiv guruhlar — band slotlar.
    const usedByRoom = new Map<string, number>();
    for (const g of groups) {
      if (!g.room || g.status !== "active") continue;
      usedByRoom.set(g.room, (usedByRoom.get(g.room) ?? 0) + 1);
    }
    // Sig'im: kuniga GROUP_TIMES.length slot, davrga ko'paytiriladi.
    const capacityPerDay = GROUP_TIMES.length;
    return (GROUP_ROOMS as string[]).map((room) => {
      const used = (usedByRoom.get(room) ?? 0) * factor;
      const capacity = capacityPerDay * factor * 5; // 5 ta ish kuni oralig'i
      return { room, used, capacity, percent: capacity > 0 ? (used / capacity) * 100 : 0 };
    });
  }, [factor]);

  return (
    <div className="container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-[18px] font-semibold tracking-tight">Xonalar analitikasi</h2>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Oraliqni tanlang" />
          <div className="inline-flex items-center rounded-lg border border-border bg-card p-1">
            {DIVIDES.map((d) => (
              <button
                key={d.key}
                onClick={() => setDivide(d.key)}
                className={`h-8 px-4 rounded-md text-sm font-medium ${
                  divide === d.key ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
        {rooms.map((r) => (
          <div key={r.room} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[16px] font-semibold tabular-nums">
                {r.used}/{r.capacity}
              </span>
              <span className="text-[12px] text-muted-foreground tabular-nums">{r.percent.toFixed(0)}%</span>
            </div>
            <div className="text-[13px] text-muted-foreground mt-0.5 truncate">{r.room}</div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden mt-2">
              <div
                className={`h-full rounded-full ${r.percent > 60 ? "bg-emerald-500" : r.percent > 0 ? "bg-primary" : "bg-transparent"}`}
                style={{ width: `${Math.min(100, r.percent)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
