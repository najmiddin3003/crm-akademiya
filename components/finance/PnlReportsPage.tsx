"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { FileSpreadsheet } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import YearPicker from "./reports/YearPicker";
import MonthPicker from "./reports/MonthPicker";
import { MONTH_NAMES_UZ } from "@/constants/pnlReports";
import type { PnlMonthRow } from "@/lib/pnl";
import type { Transaction } from "@/lib/transactions";
import { loadTransactionsCached } from "@/lib/transactionsClient";

// Moliya → Moliya hisobotlari (P&L) (sidebar: Moliya > Moliya hisobotlari
// (P&L), href /finance-pnl). Sof hisobot — add/edit/delete yo'q. Yil
// tanlansa 12 oy + Jami ustuni, "Oyni tanlang" bilan bitta oyga toraytiriladi.
// "Eksport" — haqiqiy .xlsx fayl (loyihada allaqachon mavjud konventsiya,
// components/orders/OrdersPage.tsx'dagi XLSX.utils.json_to_sheet bilan bir xil).
// HAQIQIY MongoDB `transactions` kolleksiyasidan hisoblanadi (Kirim/Chiqim,
// Kassalar sahifasi bilan bir xil manba) — "O'quvchi to'ladi" kategoriyasi
// "Dars bo'yicha daromad"ga, qolgan barcha kirim "Boshqa daromad"ga, barcha
// chiqim "Boshqa xarajat"ga yig'iladi. Ma'lumot yo'q oylarda qatorlar 0
// ko'rsatadi (demo emas — haqiqiy, hali bo'sh holat).

function fmtUZS(n: number): string {
  return Math.round(n).toLocaleString("ru-RU") + " UZS";
}

export default function PnlReportsPage() {
  const { showSuccess, showError } = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadTransactionsCached()
      .then((list) => { if (!cancelled) setTransactions(list); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const yearData = useMemo<PnlMonthRow[]>(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthTx = transactions.filter((t) => {
        const [ty, tm] = t.date.split("-").map(Number);
        return ty === year && tm === m;
      });
      const courseIncome = monthTx.filter((t) => t.amount > 0 && t.category === "O'quvchi to'ladi").reduce((s, t) => s + t.amount, 0);
      const otherIncome = monthTx.filter((t) => t.amount > 0 && t.category !== "O'quvchi to'ladi").reduce((s, t) => s + t.amount, 0);
      const otherExpense = monthTx.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
      return { month: m, otherIncome, courseIncome, otherExpense };
    });
  }, [transactions, year]);
  const months = month ? yearData.filter((m) => m.month === month) : yearData;
  const monthLabels = month ? [MONTH_NAMES_UZ[month - 1]] : MONTH_NAMES_UZ;

  const rows = useMemo(() => {
    const jamiDaromad = months.map((m) => m.otherIncome + m.courseIncome);
    const boshqaDaromad = months.map((m) => m.otherIncome);
    const darsDaromad = months.map((m) => m.courseIncome);
    const jamiXarajat = months.map((m) => m.otherExpense);
    const boshqaXarajat = months.map((m) => m.otherExpense);
    const sofFoyda = jamiDaromad.map((v, i) => v - jamiXarajat[i]);
    return [
      { label: "Jami daromad", values: jamiDaromad, tone: "green" as const, bold: true },
      { label: "Dars bo'yicha daromad", values: darsDaromad, tone: "none" as const, bold: false },
      { label: "Boshqa daromad", values: boshqaDaromad, tone: "none" as const, bold: false },
      { label: "Jami xarajat", values: jamiXarajat, tone: "red" as const, bold: true },
      { label: "Boshqa xarajat", values: boshqaXarajat, tone: "none" as const, bold: false },
      { label: "Sof foyda", values: sofFoyda, tone: "yellow" as const, bold: true },
    ];
  }, [months]);

  const toneCls: Record<string, string> = {
    green: "bg-emerald-50",
    red: "bg-rose-50",
    yellow: "bg-amber-50",
    none: "",
  };

  function exportExcel() {
    try {
      const header = ["Kategoriya", ...monthLabels, ...(month ? [] : ["Jami"])];
      const data = rows.map((r) => {
        const total = r.values.reduce((s, v) => s + v, 0);
        const row: Record<string, string | number> = { Kategoriya: r.label };
        monthLabels.forEach((label, i) => { row[label] = r.values[i]; });
        if (!month) row["Jami"] = total;
        return row;
      });
      const worksheet = XLSX.utils.json_to_sheet(data, { header });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "P&L");
      XLSX.writeFile(workbook, `pnl-hisoboti-${year}${month ? `-${String(month).padStart(2, "0")}` : ""}.xlsx`);
      showSuccess("Excel fayl yuklab olindi");
    } catch {
      showError("Excel faylni yuklab bo'lmadi");
    }
  }

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-[18px] font-semibold">Moliya hisobotlari (P&amp;L)</h1>
        <div className="flex items-center gap-2">
          <YearPicker value={year} onChange={(y) => { setYear(y); setMonth(null); }} />
          <MonthPicker year={year} value={month} onChange={(m, y) => { setMonth(m); setYear(y); }} />
          <button onClick={exportExcel} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
            <FileSpreadsheet className="w-4 h-4" />
            Eksport
          </button>
        </div>
      </div>

      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 whitespace-nowrap font-semibold text-[13px]">Kategoriya</th>
                {monthLabels.map((label) => (
                  <th key={label} className="text-right px-4 py-3 whitespace-nowrap font-semibold text-[13px]">{label}</th>
                ))}
                {!month && <th className="text-right px-4 py-3 whitespace-nowrap font-semibold text-[13px]">Jami</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const total = r.values.reduce((s, v) => s + v, 0);
                return (
                  <tr key={r.label} className={`border-b border-border/50 ${toneCls[r.tone]}`}>
                    <td className={`px-4 py-3 text-[13px] ${r.bold ? "font-semibold" : "pl-8 text-muted-foreground"}`}>{r.label}</td>
                    {r.values.map((v, i) => (
                      <td key={i} className={`px-4 py-3 text-right text-[13px] tabular-nums ${r.bold ? "font-semibold" : ""} ${r.label === "Sof foyda" && v < 0 ? "text-rose-600" : ""}`}>
                        {fmtUZS(v)}
                      </td>
                    ))}
                    {!month && (
                      <td className={`px-4 py-3 text-right text-[13px] tabular-nums font-semibold ${r.label === "Sof foyda" && total < 0 ? "text-rose-600" : ""}`}>
                        {fmtUZS(total)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
