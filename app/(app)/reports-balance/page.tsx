"use client";

import { useEffect, useMemo, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";

// Hisobotlar → Balans (href /reports-balance). Ma'lumot /api/reports/balance
// dan — xodimlar bo'yicha Bonus/Jarima/Avans jamlanmasi va shundan kelib
// chiqadigan "Ish haqi" qoldig'i. Pastda referensdagi kabi "Jami" qatori.

interface BalanceRow {
  id: number;
  name: string;
  phone: string;
  salary: number;
  bonus: number;
  advance: number;
  penalty: number;
}

const fmtUZS = (n: number) => n.toLocaleString("ru-RU") + " UZS";

export default function Page() {
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reports/balance")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setRows(d.rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          salary: acc.salary + r.salary,
          bonus: acc.bonus + r.bonus,
          advance: acc.advance + r.advance,
          penalty: acc.penalty + r.penalty,
        }),
        { salary: 0, bonus: 0, advance: 0, penalty: 0 },
      ),
    [rows],
  );

  const start = (page - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);

  return (
    <div className="container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-end">
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Oraliqni tanlang" />
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="bg-secondary/20">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">To&apos;liq ismi</th>
                <th className="px-5 py-3 text-left">Telefon raqam</th>
                <th className="px-5 py-3 text-right">Ish haqi</th>
                <th className="px-5 py-3 text-right">Bonus</th>
                <th className="px-5 py-3 text-right">Avans</th>
                <th className="px-5 py-3 text-right pr-5">Jarima</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((r, i) => (
                <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  <td className="px-5 py-3 font-medium">{r.name}</td>
                  <td className="px-5 py-3 tabular-nums text-[13px]">{r.phone || "—"}</td>
                  <td className={`px-5 py-3 text-right tabular-nums ${r.salary < 0 ? "text-rose-600" : ""}`}>{fmtUZS(r.salary)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtUZS(r.bonus)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtUZS(r.advance)}</td>
                  <td className="px-5 py-3 pr-5 text-right tabular-nums">{fmtUZS(r.penalty)}</td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    {loading ? "Yuklanmoqda…" : "Ma'lumot topilmadi"}
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-primary/5 border-t border-border font-semibold">
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3">Jami:</td>
                  <td className="px-5 py-3" />
                  <td className={`px-5 py-3 text-right tabular-nums ${totals.salary < 0 ? "text-rose-600" : ""}`}>{fmtUZS(totals.salary)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtUZS(totals.bonus)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtUZS(totals.advance)}</td>
                  <td className="px-5 py-3 pr-5 text-right tabular-nums">{fmtUZS(totals.penalty)}</td>
                </tr>
              </tfoot>
            )}
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
