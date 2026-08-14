"use client";

import { useMemo, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { generateMissedGroups } from "@/lib/missedGroups";

// Nazorat > Davomat qilinmagan guruhlar (crm-akademiya #view-nazorat-missed-groups,
// app.js renderMissedGroups() ~line 28883). Ro'yxat "bugungi kun"ga bog'liq
// holda har safar sahifa ochilganda deterministik generatsiya qilinadi (useMemo,
// bo'sh dependency — komponent har mount bo'lganda yangi "bugun" bilan qayta
// hisoblanadi). Sana oralig'i standart holatda shu oy boshidan bugungacha —
// mavjud DateRangePicker komponenti qayta ishlatilgan.

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function inRange(date: Date, start: Date | null, end: Date | null): boolean {
  const t = date.getTime();
  if (start && t < new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) return false;
  if (end && t > new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()) return false;
  return true;
}

export default function NazoratMissedGroupsPage() {
  const allGroups = useMemo(() => generateMissedGroups(), []);
  const [dateRange, setDateRange] = useState<DateRange>(() => ({ start: startOfMonth(new Date()), end: new Date() }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const filtered = useMemo(
    () => allGroups.filter((g) => inRange(g.date, dateRange.start, dateRange.end)),
    [allGroups, dateRange],
  );

  const totalAmount = useMemo(() => filtered.reduce((s, g) => s + g.amount, 0), [filtered]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  return (
    <div className="page-frame container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      {/* Sana filtri + jami summa */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} placeholder="Oraliqni tanlang" />
        <div className="text-[14px]">
          <span className="font-semibold">Jami summa:</span>{" "}
          <span className="tabular-nums">{totalAmount.toLocaleString("ru-RU")} UZS</span>
        </div>
      </div>

      {/* Jadval */}
      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{filtered.length}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-16">№</th>
                <th className="px-5 py-3 text-left">Nomi</th>
                <th className="px-5 py-3 text-left">Sana</th>
                <th className="px-5 py-3 text-left pr-5">O&apos;qituvchi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((g, i) => (
                <tr key={g.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  <td className="px-5 py-3 font-medium tabular-nums">{g.name}</td>
                  <td className="px-5 py-3 tabular-nums text-[13px] text-muted-foreground">{g.dateLabel}</td>
                  <td className="px-5 py-3 pr-5 text-[13px]">{g.teacher}</td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-muted-foreground">Ma&apos;lumotlar topilmadi</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          totalItems={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
    </div>
  );
}
