"use client";

import { useMemo, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import type { Transaction } from "@/lib/transactions";
import type { Cashbox } from "@/lib/cashboxes";

function fmtUZS(n: number): string {
  const sign = n < 0 ? "-" : "+";
  return sign + Math.abs(Math.round(n)).toLocaleString("ru-RU") + " UZS";
}
function todayRange(): DateRange {
  const now = new Date();
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
}

export default function JournalTab({
  transactions,
  cashboxes,
  loading,
}: {
  transactions: Transaction[];
  cashboxes: Cashbox[];
  loading: boolean;
}) {
  const [dateRange, setDateRange] = useState<DateRange>(() => todayRange());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const cashboxName = useMemo(() => {
    const map = new Map(cashboxes.map((c) => [c.id, c.name]));
    return (id: number) => map.get(id) || "—";
  }, [cashboxes]);

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => {
        if (dateRange.start && t.date < dateRange.start.toISOString().slice(0, 10)) return false;
        if (dateRange.end && t.date > dateRange.end.toISOString().slice(0, 10)) return false;
        return true;
      })
      .sort((a, b) => (a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date)));
  }, [transactions, dateRange]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  function fmtDate(t: Transaction): string {
    const [y, m, d] = t.date.split("-");
    return `${d}.${m}.${y} | ${t.time}`;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} className="w-52" />
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">Umumiy soni:</span>
          <span className="font-bold tabular-nums">{filtered.length}</span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-4 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Sana</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Miqdori</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">To&apos;lov turi</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Kassa</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((t, i) => (
                <tr key={t.id} className="border-b border-border/50">
                  <td className="px-4 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  <td className="px-4 py-3 text-[13px] tabular-nums whitespace-nowrap">{fmtDate(t)}</td>
                  <td className={`px-4 py-3 text-[13px] tabular-nums font-semibold ${t.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtUZS(t.amount)}</td>
                  <td className="px-4 py-3 text-[13px]">{t.category}</td>
                  <td className="px-4 py-3 text-[13px]">{cashboxName(t.cashboxId)}</td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">{loading ? "Yuklanmoqda…" : "Ma'lumot topilmadi"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      </div>
    </div>
  );
}
