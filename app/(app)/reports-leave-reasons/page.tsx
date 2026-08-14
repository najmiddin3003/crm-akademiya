"use client";

import { useEffect, useMemo, useState } from "react";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { LEAVE_TABS, type LeaveCategory, type LeaveReason } from "@/lib/studentReports";

// Hisobotlar → Ketish sabablari (href /reports-leave-reasons).
// Referensdagi kabi 4 tab, tanlangan tab bo'yicha jami ketganlar soni va
// sabablar jadvali.

export default function Page() {
  const [rows, setRows] = useState<LeaveReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<LeaveCategory>("umumiy");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/student-reports?kind=leave-reasons")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setRows(d.rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(
    () => rows.filter((r) => r.category === tab).sort((a, b) => b.count - a.count),
    [rows, tab],
  );
  const total = useMemo(() => visible.reduce((s, r) => s + r.count, 0), [visible]);

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center rounded-lg border border-border bg-card p-1 flex-wrap">
          {LEAVE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`h-8 px-4 rounded-md text-sm font-medium ${
                tab === t.key ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Oraliqni tanlang" />
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="text-[13px] text-muted-foreground">Umumiy ketgan o&apos;quvchilar</div>
        <div className="text-[24px] font-semibold tabular-nums">{total.toLocaleString("ru-RU")}</div>
      </div>

      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border text-[13px] font-semibold">Sababi</div>
        <div className="table-scroll">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">Sabab nomi</th>
                <th className="px-5 py-3 text-right pr-5">Ketgan o&apos;quvchi soni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((r, i) => (
                <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-5 py-3">{r.reason}</td>
                  <td className="px-5 py-3 pr-5 text-right tabular-nums font-medium">{r.count}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {loading ? "Yuklanmoqda…" : "Ma'lumot topilmadi"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
