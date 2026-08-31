"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, BarChart3, List } from "lucide-react";
import DonutChart from "@/components/ui/DonutChart";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { CHART_COLORS } from "@/constants/financeAnalytics";
import { useTransactionTypes, transactionTypeNames } from "@/hooks/useTransactionTypes";
import { ErrorBlock } from "@/components/ui/ErrorBanner";
import { fetchJson } from "@/lib/fetchJson";

/** summary?groupBy=month,sign va ?groupBy=category,sign qaytaradigan qatorlar. */
type MonthRow = { month: string; sign: "pos" | "neg" | "zero"; amount: number };
type CatRow = { category: string; sign: "pos" | "neg" | "zero"; amount: number };

// Moliya analitikasi → "Pul oqimi" tab'i. Yig'indi SERVERDA —
// /api/transactions/summary. Ilgari butun kolleksiya ota komponentdan
// kelardi (21 921 qator, 3.72 MB) va uchala hisob brauzerda bo'lardi.
//
// IKKITA ALOHIDA so'rov, va bu ATAYLAB:
//   • oylik jadval — faqat so'nggi 12 oy (`from`), qoldiq esa `before`;
//   • kategoriya taqsimoti — BUTUN TARIX bo'yicha, sanasiz. Ilgarigi
//     kod ham shunday edi: `incomeByCategory` 12 oy bilan cheklanmagan.
// Ularni bitta so'rovga qo'shsak, taqsimot 12 oyga qisqarib, ko'rinadigan
// raqamlar o'zgarib ketardi.
//
// ILGARI IKKITA MUAMMO BOR EDI:
//   1. Kategoriya qatorlari `constants/transactions.js` dagi qattiq yozilgan
//      INCOME_CATS/EXPENSE_CATS ro'yxatidan olinardi — o'sha fayl demo
//      generator uchun yozilgan va admin "Tranzaksiya turi" sahifasida
//      qo'shgan yangi tur bu yerda hech qachon ko'rinmasdi (o'chirilgani esa
//      ko'rinib turardi). Endi ro'yxat /api/transaction-types dan.
//   2. Yuqoridagi eksport tugmasi `onClick`siz edi — bosilsa hech narsa
//      bo'lmasdi. Loyihada PDF kutubxonasi yo'q, boshqa hamma Moliya
//      sahifasi esa Excel/CSV eksport qiladi (xlsx), shuning uchun tugma
//      HAQIQIY Excel eksportiga aylantirildi va yorlig'i shunga moslandi —
//      ishlamaydigan "PDF" tugmasini qoldirish yolg'on bo'lardi.

const MONTH_LABELS = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];

function fmtUZS(n: number): string {
  return Math.round(n).toLocaleString("ru-RU") + " UZS";
}
function fmtMln(n: number): string {
  return (n / 1_000_000).toFixed(1) + " mln UZS";
}
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// So'nggi 12 oy (joriy oy bilan tugaydi) uchun {year, month, key, label}.
function trailingMonths(): { year: number; month: number; key: string; label: string }[] {
  const now = new Date();
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1, key: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`, label: MONTH_LABELS[d.getMonth()] });
  }
  return out;
}

export default function CashFlowTab() {
  const [view, setView] = useState<"chart" | "table">("chart");
  const { showSuccess, showError } = useToast();
  // Kategoriyalar admin boshqaradigan HAQIQIY ro'yxatdan.
  const { types } = useTransactionTypes();
  const incomeCats = useMemo(() => transactionTypeNames(types, "kirim"), [types]);
  const expenseCats = useMemo(() => transactionTypeNames(types, "chiqim"), [types]);

  const months = useMemo(() => trailingMonths(), []);
  const rangeStart = `${months[0].year}-${pad2(months[0].month)}-01`;

  const [monthRows, setMonthRows] = useState<MonthRow[]>([]);
  const [catRows, setCatRows] = useState<CatRow[]>([]);
  const [initialBalance, setInitialBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    // `setLoading(true)` ATAYLAB yo'q: u effekt tanasida sinxron
    // ishlaganda kaskadli render chaqiradi (react-hooks/set-state-in-effect),
    // va qayta yuklashda jadval bo'shab, keyin to'lib "sakrardi". Spinner
    // faqat birinchi yuklashda — `useState(true)` dan.
    let cancelled = false;
    const monthQs = new URLSearchParams({ groupBy: "month,sign", from: rangeStart, before: rangeStart });
    Promise.all([
      fetchJson<{ rows: MonthRow[]; before: number }>(`/api/transactions/summary?${monthQs}`),
      fetchJson<{ rows: CatRow[] }>("/api/transactions/summary?groupBy=category,sign"),
    ])
      .then(([m, c]) => {
        if (cancelled) return;
        setMonthRows(m.rows);
        setInitialBalance(m.before);
        setCatRows(c.rows);
        setError(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Nol bilan to'ldirilgan 12 oylik jadval CHIZILMASIN.
        setMonthRows([]);
        setCatRows([]);
        setInitialBalance(0);
        setError(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [rangeStart]);

  useEffect(() => load(), [load]);

  const monthStats = useMemo(() => {
    // Server bo'sh oy uchun chelak qaytarmaydi — 12 oy shu yerda to'ldiriladi.
    const byMonth: Record<string, { income: number; expense: number }> = {};
    for (const m of months) byMonth[m.key] = { income: 0, expense: 0 };
    for (const r of monthRows) {
      const cell = byMonth[r.month];
      if (!cell) continue;
      // Nol IKKALASIGA HAM qo'shilmaydi — ilgarigi shartlar `> 0` va
      // `< 0` edi (Kalendar tab'idan farqli, u nolni kirimga qo'shadi).
      if (r.sign === "pos") cell.income += r.amount;
      else if (r.sign === "neg") cell.expense += -r.amount;
    }
    const acc = months.reduce<{ list: (typeof months[number] & { income: number; expense: number; startBalance: number; endBalance: number })[]; running: number }>(
      (a, m) => {
        const { income, expense } = byMonth[m.key];
        const endBalance = a.running + income - expense;
        return { list: [...a.list, { ...m, income, expense, startBalance: a.running, endBalance }], running: endBalance };
      },
      { list: [], running: initialBalance },
    );
    return acc.list;
  }, [monthRows, months, initialBalance]);

  const currentPeriod = useMemo(() => {
    const income = monthStats.reduce((s, m) => s + m.income, 0);
    const expense = monthStats.reduce((s, m) => s + m.expense, 0);
    return { income, expense, net: income - expense };
  }, [monthStats]);

  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of catRows) if (r.sign === "pos") map[r.category] = (map[r.category] || 0) + r.amount;
    return incomeCats.map((c) => ({ label: c, value: map[c] || 0 })).sort((a, b) => b.value - a.value);
  }, [catRows, incomeCats]);

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of catRows) if (r.sign === "neg") map[r.category] = (map[r.category] || 0) - r.amount;
    return expenseCats.map((c) => ({ label: c, value: map[c] || 0 })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [catRows, expenseCats]);

  const incomeSlices = incomeByCategory.map((c, i) => ({ ...c, color: CHART_COLORS[i % CHART_COLORS.length] }));
  const expenseSlices = expenseByCategory.map((c, i) => ({ ...c, color: CHART_COLORS[(i + 1) % CHART_COLORS.length] }));
  const incomeTotal = incomeSlices.reduce((s, x) => s + x.value, 0);
  const expenseTotal = expenseSlices.reduce((s, x) => s + x.value, 0);

  const maxAbs = Math.max(1, ...monthStats.flatMap((m) => [m.income, m.expense, Math.abs(m.endBalance)]));

  // Eksport — ekrandagi AYNAN shu raqamlar: 12 oylik jadval har doim, va
  // grafik ko'rinishida ko'rinadigan taqsimotlar alohida varaqlarda.
  async function exportExcel() {
    try {
      // xlsx (SheetJS) FAQAT shu yerda kerak — bosilganda. Statik import
      // bo'lganida u route'ning boshlang'ich JS to'plamiga kirardi:
      // 431 KB lik chunk 9 ta sahifada, eksport tugmasi bosilmasa ham.
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();

      const monthRows = monthStats.map((m) => ({
        Oy: `${m.label} ${m.year}`,
        "Oy boshidagi qoldiq": Math.round(m.startBalance),
        Tushumlar: Math.round(m.income),
        Chiqimlar: Math.round(-m.expense),
        "Sof pul oqimi": Math.round(m.income - m.expense),
        "Oy oxiridagi qoldiq": Math.round(m.endBalance),
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(monthRows), "Pul oqimi");

      if (view === "chart") {
        const incomeRows = incomeSlices.map((s) => ({ Kategoriya: s.label, Summa: Math.round(s.value) }));
        const expenseRows = expenseSlices.map((s) => ({ Kategoriya: s.label, Summa: Math.round(s.value) }));
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(incomeRows), "Kirim taqsimoti");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(expenseRows), "Chiqim top 5");
      }

      XLSX.writeFile(workbook, `pul-oqimi-${new Date().toISOString().slice(0, 10)}.xlsx`);
      showSuccess("Excel fayl yuklab olindi");
    } catch {
      showError("Excel faylni yuklab bo'lmadi");
    }
  }

  if (error) {
    return <ErrorBlock message="Pul oqimi ma'lumotini yuklab bo'lmadi." onRetry={load} />;
  }
  if (loading) {
    return <div className="rounded-xl border border-border bg-card p-10"><SpinnerBlock /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button onClick={exportExcel} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
          <Download className="w-4 h-4" />
          {view === "chart" ? "Grafiklarni Excel da eksport qilish" : "Jadvalni Excel da eksport qilish"}
        </button>
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          <button onClick={() => setView("chart")} className={`h-7 w-7 inline-flex items-center justify-center rounded-md ${view === "chart" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`} title="Grafik">
            <BarChart3 className="w-4 h-4" />
          </button>
          <button onClick={() => setView("table")} className={`h-7 w-7 inline-flex items-center justify-center rounded-md ${view === "table" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`} title="Jadval">
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view === "chart" ? (
        <>
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-end justify-center gap-2" style={{ height: 240 }}>
              {monthStats.map((m) => (
                <div key={m.key} className="relative flex-1 flex flex-col items-center" style={{ height: "100%" }}>
                  <div className="flex-1 w-full flex flex-col justify-end items-center gap-0.5">
                    <div className="w-2/3 bg-emerald-500 rounded-t-sm" style={{ height: `${(m.income / maxAbs) * 100}px` }} title={fmtUZS(m.income)} />
                  </div>
                  <div className="w-full flex flex-col items-center gap-0.5" style={{ height: 100 }}>
                    <div className="w-2/3 bg-rose-400 rounded-b-sm" style={{ height: `${(m.expense / maxAbs) * 100}px` }} title={fmtUZS(-m.expense)} />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">{m.label}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 mt-3 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Kirim</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />Chiqim</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="text-[14px] font-semibold text-center mb-4">Kirimlar bo&apos;yicha taqsimot</div>
              <div className="flex justify-center">
                <DonutChart slices={incomeSlices} centerLabel={fmtMln(incomeTotal)} />
              </div>
              <div className="mt-4 space-y-1.5">
                {incomeSlices.map((s) => (
                  <div key={s.label} className="flex items-center justify-between text-[13px]">
                    <span className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />{s.label}</span>
                    <span className="tabular-nums font-medium">{fmtUZS(s.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="text-[14px] font-semibold text-center mb-4">Chiqimlar bo&apos;yicha Top 5 ta taqsimot</div>
              <div className="flex justify-center">
                <DonutChart slices={expenseSlices} centerLabel={fmtMln(expenseTotal)} />
              </div>
              <div className="mt-4 space-y-1.5">
                {expenseSlices.map((s) => (
                  <div key={s.label} className="flex items-center justify-between text-[13px]">
                    <span className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />{s.label}</span>
                    <span className="tabular-nums font-medium">{fmtUZS(s.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 whitespace-nowrap font-semibold text-[13px]">Qator nomi</th>
                  {monthStats.map((m) => (
                    <th key={m.key} className="text-right px-4 py-3 whitespace-nowrap font-semibold text-[13px]">{m.label} {m.year}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="px-4 py-3 text-[13px]">Oy boshidagi qoldiq</td>
                  {monthStats.map((m) => <td key={m.key} className="px-4 py-3 text-right text-[13px] tabular-nums">{fmtUZS(m.startBalance)}</td>)}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-4 py-3 text-[13px]">Oy oxiridagi qoldiq</td>
                  {monthStats.map((m) => <td key={m.key} className="px-4 py-3 text-right text-[13px] tabular-nums">{fmtUZS(m.endBalance)}</td>)}
                </tr>
                <tr className="border-b border-border">
                  <td className="px-4 py-3 text-[13px] font-medium">Sof pul oqimi</td>
                  {monthStats.map((m) => <td key={m.key} className="px-4 py-3 text-right text-[13px] tabular-nums font-medium">{fmtUZS(m.income - m.expense)}</td>)}
                </tr>
                <tr className="border-b border-border/50 bg-primary/5">
                  <td className="px-4 py-3 text-[13px] font-semibold text-primary">Tushumlar</td>
                  {monthStats.map((m) => <td key={m.key} className="px-4 py-3 text-right text-[13px] tabular-nums font-semibold text-primary">{fmtUZS(m.income)}</td>)}
                </tr>
                <tr className="bg-primary/5">
                  <td className="px-4 py-3 text-[13px] font-semibold text-primary">Chiqimlar</td>
                  {monthStats.map((m) => <td key={m.key} className="px-4 py-3 text-right text-[13px] tabular-nums font-semibold text-primary">{fmtUZS(-m.expense)}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-[12px] text-muted-foreground text-right">
        12 oylik davr: kirim {fmtUZS(currentPeriod.income)}, chiqim {fmtUZS(-currentPeriod.expense)}, sof {fmtUZS(currentPeriod.net)}
      </div>
    </div>
  );
}
