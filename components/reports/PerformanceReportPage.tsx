"use client";

import { useEffect, useMemo, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { SpinnerBlock } from "@/components/ui/Spinner";
import type { Order } from "@/lib/ordersData";
import { STATE_KEYS, STATE_LABELS, buildPerformanceRows, type StateCounts } from "@/lib/performanceReport";
import { useT } from "@/components/shared/Language";

// Hisobotlar → O'qituvchilar / Adminstratorlar samaradorligi.
// Ikkala sahifa ham AYNAN shu komponentdan foydalanadi, farqi faqat qaysi
// maydon bo'yicha guruhlanishida (o'qituvchi yoki moderator) — referensda
// ham ikkala jadval bir xil tuzilishga ega.
//
// ILGARI: butun jadval createInitialOrders() dan qurilardi — bu 502 ta SOXTA
// buyurtma generatori (ism/telefon/sana/o'qituvchi/moderator hammasi indeks
// arifmetikasidan: `i % 7`, `(i*37+13) % 100` va h.k.). Ya'ni sahifa bazada
// bitta ham buyurtma bo'lmasa ham to'la jadval ko'rsatardi va undagi hech bir
// o'qituvchi yoki moderator haqiqiy xodim emas edi.
// HOZIR: buyurtmalar /api/orders dan (MongoDB `orders`) — /orders-list,
// /first-lessons va /new-students bilan bir xil manba.

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
  const { t } = useT();
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/orders")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setAllOrders(d.orders as Order[]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

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
          placeholder={t("Oraliqni tanlang")}
        />
        <div className="text-[12px] text-muted-foreground">
          {t("Sana oralig'i tanlansa — shu davrda yaratilganlar &laquo;O'zgarishlar&raquo; ustuniga tushadi.")}
        </div>
      </div>

      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>{t("Umumiy soni:")}</span>
            <span className="tabular-nums">{rows.length}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[1300px]">
            <thead>
              {/* Guruhli sarlavha — referensdagi uch blok. Ikki qatorli thead
                  qotganda 2-qator 1-qatorning OSTIDA turishi uchun 1-qator
                  balandligi qat'iy (h-8) va 2-qatorda `thead-row2` (globals.css). */}
              <tr className="h-8 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-3 py-2 w-12" />
                <th className="px-3 py-2" />
                {GROUP_HEADERS.map((h) => (
                  <th key={h} colSpan={4} className="px-3 py-2 text-center border-l border-border">{h}</th>
                ))}
              </tr>
              <tr className="thead-row2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
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
                    {loading ? <SpinnerBlock size={22} /> : "Ma'lumot topilmadi"}
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
