"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { FileSpreadsheet } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import YearPicker from "./reports/YearPicker";
import MonthPicker from "./reports/MonthPicker";
import { MONTH_NAMES_UZ } from "@/constants/pnlReports";
import type { MonthlyFlow } from "@/lib/cashflowStatement";
import type { Transaction } from "@/lib/transactions";
import type { TransactionType } from "@/lib/transactionTypes";

// Moliya → Pul oqimi (sidebar: Moliya > Pul oqimi, href /finance-flow). Sof
// hisobot — add/edit/delete yo'q. Yil/oy tanlagichi — Moliya hisobotlari
// (P&L) sahifasidagi bilan bir xil komponentlar (YearPicker/MonthPicker,
// foydalanuvchi aniq shuni so'ragan). Klassik pul oqimi hisoboti: har oy
// boshlang'ich balansdan boshlanadi, Operatsion/Investitsion/Moliyaviy
// faoliyat bo'yicha Kirim/Chiqim/Sof, va yakuniy balans bilan tugaydi. HAQIQIY
// MongoDB `transactions` kolleksiyasidan hisoblanadi (Kirim/Chiqim, Kassalar
// bilan bir xil manba); kategoriya qatorlari `/api/transaction-types`dagi
// (Moliya → Tranzaksiya turi) haqiqiy, admin boshqaradigan ro'yxatdan.
// Investitsion/Moliyaviy faoliyat — loyihada bunday faoliyatlar uchun hali
// ma'lumot yo'q, doim 0. Yanvarning "Boshlang'ich balans"i — tanlangan yildan
// OLDINGI barcha tranzaksiyalarning sof yig'indisi (shu `transactions`
// kolleksiyasidan), keyingi oylar oldingi oyning yakuniy balansidan davom etadi.

function fmtUZS(n: number): string {
  return Math.round(n).toLocaleString("ru-RU") + " UZS";
}

function buildRow(m: MonthlyFlow, opening: number, incomeCats: string[], expenseCats: string[]) {
  const kirim = incomeCats.reduce((s, c) => s + (m.income[c] || 0), 0);
  const chiqim = expenseCats.reduce((s, c) => s + (m.expense[c] || 0), 0);
  const sof = kirim - chiqim;
  const closing = opening + sof;
  return { month: m.month, opening, kirim, chiqim, sof, closing, income: m.income, expense: m.expense };
}

export default function CashFlowStatementPage() {
  const { showSuccess, showError } = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [incomeCats, setIncomeCats] = useState<string[]>([]);
  const [expenseCats, setExpenseCats] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/transactions").then((r) => r.json()),
      fetch("/api/transaction-types").then((r) => r.json()),
    ]).then(([tx, types]) => {
      if (cancelled) return;
      if (tx.ok) setTransactions(tx.transactions);
      if (types.ok) {
        const all = types.types as TransactionType[];
        setIncomeCats(Array.from(new Set(all.filter((t) => t.mainType === "kirim").map((t) => t.name))));
        setExpenseCats(Array.from(new Set(all.filter((t) => t.mainType === "chiqim").map((t) => t.name))));
      }
    });
    return () => { cancelled = true; };
  }, []);

  const monthly = useMemo<MonthlyFlow[]>(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthTx = transactions.filter((t) => {
        const [ty, tm] = t.date.split("-").map(Number);
        return ty === year && tm === m;
      });
      const income: Record<string, number> = Object.fromEntries(incomeCats.map((c) => [c, 0]));
      const expense: Record<string, number> = Object.fromEntries(expenseCats.map((c) => [c, 0]));
      for (const t of monthTx) {
        if (t.amount > 0) income[t.category] = (income[t.category] || 0) + t.amount;
        else expense[t.category] = (expense[t.category] || 0) - t.amount;
      }
      return { month: m, income, expense };
    });
  }, [transactions, year, incomeCats, expenseCats]);

  // Yanvarning boshlang'ich balansi — tanlangan yilgacha bo'lgan barcha
  // tranzaksiyalarning sof qoldig'i. Kategoriya bo'yicha filtrlanadi, chunki
  // oylik Kirim/Chiqim ham faqat ma'lum kategoriyalardan yig'iladi — aks holda
  // boshlang'ich va yakuniy balans bir xil qoidaga bo'ysunmay qolardi.
  const openingBalance = useMemo(() => {
    const yearStart = `${year}-01-01`;
    const known = new Set([...incomeCats, ...expenseCats]);
    return transactions
      .filter((t) => t.date < yearStart && known.has(t.category))
      .reduce((s, t) => s + t.amount, 0);
  }, [transactions, year, incomeCats, expenseCats]);

  const computed = useMemo(() => {
    const acc = monthly.reduce<{ list: ReturnType<typeof buildRow>[]; opening: number }>(
      (a, m) => {
        const row = buildRow(m, a.opening, incomeCats, expenseCats);
        return { list: [...a.list, row], opening: row.closing };
      },
      { list: [], opening: openingBalance },
    );
    return acc.list;
  }, [monthly, incomeCats, expenseCats, openingBalance]);

  const visible = month ? computed.filter((c) => c.month === month) : computed;
  const monthLabels = month ? [MONTH_NAMES_UZ[month - 1]] : MONTH_NAMES_UZ;

  function exportExcel() {
    try {
      const sheetRows: Record<string, string | number>[] = [];
      function pushRow(label: string, values: (number | string)[]) {
        const row: Record<string, string | number> = { Kategoriya: label };
        monthLabels.forEach((l, i) => { row[l] = values[i]; });
        sheetRows.push(row);
      }
      pushRow("Boshlang'ich balans", visible.map((v) => v.opening));
      pushRow("Operatsion faoliyat", visible.map(() => ""));
      pushRow("Kirim — Jami", visible.map((v) => v.kirim));
      incomeCats.forEach((c) => pushRow(c, visible.map((v) => v.income[c] || 0)));
      pushRow("Chiqim — Jami", visible.map((v) => v.chiqim));
      expenseCats.forEach((c) => pushRow(c, visible.map((v) => v.expense[c] || 0)));
      pushRow("Sof", visible.map((v) => v.sof));
      pushRow("Investitsion faoliyat", visible.map(() => ""));
      pushRow("Kirim — Jami ", visible.map(() => 0));
      pushRow("Chiqim — Jami ", visible.map(() => 0));
      pushRow("Sof ", visible.map(() => 0));
      pushRow("Moliyaviy faoliyat", visible.map(() => ""));
      pushRow("Kirim — Jami  ", visible.map(() => 0));
      pushRow("Chiqim — Jami  ", visible.map(() => 0));
      pushRow("Sof  ", visible.map(() => 0));
      pushRow("Yakuniy balans", visible.map((v) => v.closing));

      const worksheet = XLSX.utils.json_to_sheet(sheetRows, { header: ["Kategoriya", ...monthLabels] });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Pul oqimi");
      XLSX.writeFile(workbook, `pul-oqimi-${year}${month ? `-${String(month).padStart(2, "0")}` : ""}.xlsx`);
      showSuccess("Excel fayl yuklab olindi");
    } catch {
      showError("Excel faylni yuklab bo'lmadi");
    }
  }

  const thCls = "text-right px-4 py-3 whitespace-nowrap font-semibold text-[13px]";

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-[18px] font-semibold">Pul oqimi hisoboti</h1>
        <div className="flex items-center gap-2">
          <YearPicker value={year} onChange={(y) => { setYear(y); setMonth(null); }} />
          <MonthPicker year={year} value={month} onChange={(m, y) => { setMonth(m); setYear(y); }} />
          <button onClick={exportExcel} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
            <FileSpreadsheet className="w-4 h-4" />
            Eksport
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 whitespace-nowrap font-semibold text-[13px]">Kategoriya</th>
                {monthLabels.map((l) => <th key={l} className={thCls}>{l}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-emerald-50 border-b border-border/50">
                <td className="px-4 py-3 text-[13px] font-semibold">Boshlang&apos;ich balans</td>
                {visible.map((v) => <td key={v.month} className="px-4 py-3 text-right text-[13px] tabular-nums font-semibold">{fmtUZS(v.opening)}</td>)}
              </tr>

              {(["Operatsion", "Investitsion", "Moliyaviy"] as const).map((section) => (
                <SectionRows
                  key={section}
                  title={`${section} faoliyat`}
                  visible={visible}
                  monthLabels={monthLabels}
                  withCategories={section === "Operatsion"}
                  incomeCategories={incomeCats}
                  expenseCategories={expenseCats}
                />
              ))}

              <tr className="bg-emerald-50 border-t-2 border-border">
                <td className="px-4 py-3 text-[13px] font-semibold">Yakuniy balans</td>
                {visible.map((v) => <td key={v.month} className="px-4 py-3 text-right text-[13px] tabular-nums font-semibold">{fmtUZS(v.closing)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface VisibleRow {
  month: number;
  kirim: number;
  chiqim: number;
  sof: number;
  income: Record<string, number>;
  expense: Record<string, number>;
}

function SectionRows({
  title,
  visible,
  monthLabels,
  withCategories,
  incomeCategories,
  expenseCategories,
}: {
  title: string;
  visible: VisibleRow[];
  monthLabels: string[];
  withCategories: boolean;
  incomeCategories: string[];
  expenseCategories: string[];
}) {
  return (
    <>
      <tr className="bg-secondary/40">
        <td className="px-4 py-2.5 text-[13px] font-semibold" colSpan={monthLabels.length + 1}>{title}</td>
      </tr>
      <tr className="bg-emerald-50/70 border-b border-border/50">
        <td className="px-4 py-3 text-[13px] font-semibold">Kirim — Jami</td>
        {visible.map((v) => <td key={v.month} className="px-4 py-3 text-right text-[13px] tabular-nums font-semibold">{fmtUZS(withCategories ? v.kirim : 0)}</td>)}
      </tr>
      {withCategories && incomeCategories.map((c) => (
        <tr key={c} className="border-b border-border/50">
          <td className="px-4 py-3 pl-8 text-[13px] text-muted-foreground">{c}</td>
          {visible.map((v) => <td key={v.month} className="px-4 py-3 text-right text-[13px] tabular-nums">{fmtUZS(v.income[c] || 0)}</td>)}
        </tr>
      ))}
      <tr className="bg-rose-50/70 border-b border-border/50">
        <td className="px-4 py-3 text-[13px] font-semibold">Chiqim — Jami</td>
        {visible.map((v) => <td key={v.month} className="px-4 py-3 text-right text-[13px] tabular-nums font-semibold">{fmtUZS(withCategories ? v.chiqim : 0)}</td>)}
      </tr>
      {withCategories && expenseCategories.map((c) => (
        <tr key={c} className="border-b border-border/50">
          <td className="px-4 py-3 pl-8 text-[13px] text-muted-foreground">{c}</td>
          {visible.map((v) => <td key={v.month} className="px-4 py-3 text-right text-[13px] tabular-nums">{fmtUZS(v.expense[c] || 0)}</td>)}
        </tr>
      ))}
      <tr className="bg-amber-50 border-b border-border">
        <td className="px-4 py-3 text-[13px] font-semibold">Sof</td>
        {visible.map((v) => {
          const val = withCategories ? v.sof : 0;
          return <td key={v.month} className={`px-4 py-3 text-right text-[13px] tabular-nums font-semibold ${val < 0 ? "text-rose-600" : ""}`}>{fmtUZS(val)}</td>;
        })}
      </tr>
    </>
  );
}
