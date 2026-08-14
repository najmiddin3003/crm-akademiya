"use client";

import { useMemo, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { createInitialOrders } from "@/lib/ordersData";
import { STATE_KEYS, STATE_LABELS, buildPerformanceRows, type StateCounts } from "@/lib/performanceReport";

// Hisobotlar → O'qituvchilar / Adminstratorlar samaradorligi.
// Ikkala sahifa ham AYNAN shu komponentdan foydalanadi, farqi faqat qaysi
// maydon bo'yicha guruhlanishida (o'qituvchi yoki moderator) — referensda
// ham ikkala jadval bir xil tuzilishga ega.

const GROUP_HEADERS = ["Davr boshidagi holati", "O'zgarishlar", "Davr oxiridagi holati"];

function Cells({ counts, highlightSign }: { counts: StateCounts; highlightSign?: boolean }) {
  return (
    <>
      {STATE_KEYS.map((k) => {
        const v = counts[k];
        const tone = highlightSign && v !== 0 ? (v > 0 ? "text-emerald-600" : "text-rose-600") : "";
        return (
          <td key={k} className={`px-3 py-3 text-right tabular-nums ${tone}`}>
            {highlightSign && v > 0 ? `+${v}` : v}
          </td>
        );
      })}
    </>
  );
}

export default function PerformanceReportPage({
  groupBy,
  firstColumnLabel,
}: {
  groupBy: "teacher" | "moderator";
  firstColumnLabel: string;
}) {
  const allOrders = useMemo(() => createInitialOrders(), []);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const rows = useMemo(
    () => buildPerformanceRows(allOrders, (o) => (groupBy === "teacher" ? o.teacher : o.moderator), dateRange),
    [allOrders, groupBy, dateRange],
  );

  const start = (page - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);

  return (
    <div className="page-frame container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <DateRangePicker
          value={dateRange}
          onChange={(r) => { setDateRange(r); setPage(1); }}
          placeholder="Oraliqni tanlang"
        />
        <div className="text-[12px] text-muted-foreground">
          Sana oralig&apos;i tanlansa &mdash; shu davrda yaratilganlar &laquo;O&apos;zgarishlar&raquo; ustuniga tushadi.
        </div>
      </div>

      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{rows.length}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[1300px]">
            <thead>
              {/* Guruhli sarlavha — referensdagi uch blok */}
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-3 py-2 w-12" />
                <th className="px-3 py-2" />
                {GROUP_HEADERS.map((h) => (
                  <th key={h} colSpan={4} className="px-3 py-2 text-center border-l border-border">{h}</th>
                ))}
              </tr>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-3 py-3 text-left w-12">№</th>
                <th className="px-3 py-3 text-left min-w-[220px]">{firstColumnLabel}</th>
                {GROUP_HEADERS.map((h) =>
                  STATE_KEYS.map((k, i) => (
                    <th
                      key={`${h}-${k}`}
                      className={`px-3 py-3 text-right whitespace-nowrap ${i === 0 ? "border-l border-border" : ""}`}
                    >
                      {STATE_LABELS[k]}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((r, i) => (
                <tr key={r.name} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-3 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  <td className="px-3 py-3 font-medium">{r.name}</td>
                  <Cells counts={r.start} />
                  <Cells counts={r.change} highlightSign />
                  <Cells counts={r.end} />
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    Ma&apos;lumot topilmadi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          totalItems={rows.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
    </div>
  );
}
