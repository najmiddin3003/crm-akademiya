"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { ErrorBlock } from "@/components/ui/ErrorBanner";
import { fetchJson } from "@/lib/fetchJson";
import type { Transaction } from "@/lib/transactions";
import type { Cashbox } from "@/lib/cashboxes";

// Moliya analitikasi → "Journal" tab'i.
//
// Ilgari bu tab BUTUN `transactions` kolleksiyasini ota komponentdan olardi
// (21 921 qator, 3.72 MB), sana bo'yicha brauzerda filtrlab, 50 tasini
// ko'rsatardi. Endi server filtrlaydi va sahifalaydi — 50 qator ~8.7 KB.
//
// Saralash SERVERDA `?sort=desc` bilan: {date:-1, id:-1}. Bu ilgarigi
// klient tartibining (`a.date === b.date ? b.id - a.id : ...`) aynan o'zi.

function fmtUZS(n: number): string {
  const sign = n < 0 ? "-" : "+";
  return sign + Math.abs(Math.round(n)).toLocaleString("ru-RU") + " UZS";
}
function todayRange(): DateRange {
  const now = new Date();
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
}
// Sanani MAHALLIY vaqt bo'yicha "YYYY-MM-DD" ga aylantiradi. Ilgari filtr
// `toISOString().slice(0,10)` ishlatardi — u UTC'ga o'tkazadi, shuning uchun
// Toshkent vaqtida (UTC+5) tanlangan kun bir kun oldingi kunga tushib,
// oyning birinchi kunidagi tranzaksiyalar ro'yxatdan chiqib ketardi.
function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function JournalTab({ cashboxes }: { cashboxes: Cashbox[] }) {
  const [dateRange, setDateRange] = useState<DateRange>(() => todayRange());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ page: String(page), limit: String(pageSize), sort: "desc" });
    if (dateRange.start) qs.set("from", toIso(dateRange.start));
    if (dateRange.end) qs.set("to", toIso(dateRange.end));
    // `setLoading(true)` ATAYLAB yo'q: u effekt tanasida sinxron
    // ishlaganda kaskadli render chaqiradi (react-hooks/set-state-in-effect),
    // va qayta yuklashda jadval bo'shab, keyin to'lib "sakrardi". Spinner
    // faqat birinchi yuklashda — `useState(true)` dan.
    let cancelled = false;
    fetchJson<{ transactions: Transaction[]; total: number }>(`/api/transactions?${qs}`)
      .then((d) => {
        if (cancelled) return;
        setRows(d.transactions);
        setTotal(d.total);
        setError(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Xato bo'lganda bo'sh jadval CHIZILMAYDI — pastda ErrorBlock
        // turadi. "Umumiy soni: 0" ham da'vo bo'lardi.
        setRows([]);
        setTotal(0);
        setError(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dateRange, page, pageSize]);

  useEffect(() => load(), [load]);

  const cashboxName = useMemo(() => {
    const map = new Map(cashboxes.map((c) => [c.id, c.name]));
    return (id: number) => map.get(id) || "—";
  }, [cashboxes]);

  const start = (page - 1) * pageSize;

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
          <span className="font-bold tabular-nums">{error ? "—" : total}</span>
        </div>
      </div>

      {error ? (
        <ErrorBlock message="Tranzaksiyalarni yuklab bo'lmadi." onRetry={load} />
      ) : (
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
                {rows.map((t, i) => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="px-4 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                    <td className="px-4 py-3 text-[13px] tabular-nums whitespace-nowrap">{fmtDate(t)}</td>
                    <td className={`px-4 py-3 text-[13px] tabular-nums font-semibold ${t.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtUZS(t.amount)}</td>
                    <td className="px-4 py-3 text-[13px]">{t.category}</td>
                    <td className="px-4 py-3 text-[13px]">{cashboxName(t.cashboxId)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">{loading ? <SpinnerBlock size={22} /> : "Ma'lumot topilmadi"}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination totalItems={total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </div>
      )}
    </div>
  );
}
