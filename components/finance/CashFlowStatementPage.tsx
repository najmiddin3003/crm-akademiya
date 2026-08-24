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
// INVESTITSION va MOLIYAVIY faoliyat: ilgari bu ikki bo'lim har oy uchun
// literal `0 UZS` chizardi — ya'ni "bu oyda investitsion/moliyaviy harakat
// bo'lmagan" degan FAKT da'vosi edi. Aslida bu faoliyatlarni ajratadigan
// maydon schema'da umuman yo'q: `transaction_types` da faqat mainType
// "kirim"/"chiqim" bor, tranzaksiyani operatsion/investitsion/moliyaviyga
// bo'ladigan belgi yo'q. Shuning uchun endi "—" chiziladi (0 emas).
// Yanvarning "Boshlang'ich balans"i — tanlangan yildan
// OLDINGI barcha tranzaksiyalarning sof yig'indisi (shu `transactions`
// kolleksiyasidan), keyingi oylar oldingi oyning yakuniy balansidan davom etadi.
//
// TUZATILDI — PUL YO'QOLIB QOLARDI: ilgari Kirim/Chiqim/Sof faqat HOZIR
// /api/transaction-types da ro'yxatda turgan kategoriya kalitlari bo'yicha
// yig'ilardi, "Boshlang'ich qoldiq" esa qo'shimcha `known.has(t.category)`
// filtridan o'tardi. Ya'ni admin tranzaksiya turini o'chirsa yoki nomini
// o'zgartirsa, o'sha turdagi HAQIQIY tranzaksiyalar hisobotdan jimgina
// tushib qolardi — jami, sof va qoldiqlar noto'g'ri chiqardi. Endi barcha
// tranzaksiya hisobga olinadi: ro'yxatda yo'q kategoriyalar yashirilmaydi,
// alohida "Boshqa" qatoriga yig'iladi.

// Ro'yxatda YO'Q kategoriyalar shu ichki kalit ostida to'planadi. Kalit
// sifatida oddiy "Boshqa" ishlatilmaydi: admin aynan shu nomli haqiqiy
// tranzaksiya turi qo'shgan bo'lishi mumkin va ikki xil pul aralashib
// ketardi.
const OTHER_KEY = "__boshqa__";

/** Kategoriya kalitidan ko'rinadigan nom. */
function catLabel(key: string, cats: string[]): string {
  if (key !== OTHER_KEY) return key;
  return cats.includes("Boshqa") ? "Boshqa (ro'yxatda yo'q)" : "Boshqa";
}

function fmtUZS(n: number): string {
  return Math.round(n).toLocaleString("ru-RU") + " UZS";
}

function buildRow(m: MonthlyFlow, opening: number) {
  // BARCHA kalitlar qo'shiladi — jumladan "Boshqa". Kategoriya ro'yxati
  // bo'yicha yig'ish jami summani kamaytirib yuborardi.
  const kirim = Object.values(m.income).reduce((s, v) => s + v, 0);
  const chiqim = Object.values(m.expense).reduce((s, v) => s + v, 0);
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
    const knownIncome = new Set(incomeCats);
    const knownExpense = new Set(expenseCats);
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthTx = transactions.filter((t) => {
        const [ty, tm] = t.date.split("-").map(Number);
        return ty === year && tm === m;
      });
      // Ro'yxatdagi turlar 0 bilan oldindan to'ldiriladi — jadvalda har bir
      // tur qatori tartibi bilan ko'rinib tursin.
      const income: Record<string, number> = Object.fromEntries(incomeCats.map((c) => [c, 0]));
      const expense: Record<string, number> = Object.fromEntries(expenseCats.map((c) => [c, 0]));
      for (const t of monthTx) {
        // Kategoriya ro'yxatda bo'lmasa ham tranzaksiya TASHLANMAYDI —
        // "Boshqa" ga qo'shiladi (turi o'chirilgan/nomi o'zgargan bo'lishi
        // mumkin, lekin pul haqiqiy).
        if (t.amount > 0) {
          const key = knownIncome.has(t.category) ? t.category : OTHER_KEY;
          income[key] = (income[key] || 0) + t.amount;
        } else {
          const key = knownExpense.has(t.category) ? t.category : OTHER_KEY;
          expense[key] = (expense[key] || 0) - t.amount;
        }
      }
      return { month: m, income, expense };
    });
  }, [transactions, year, incomeCats, expenseCats]);

  // Yanvarning boshlang'ich balansi — tanlangan yilgacha bo'lgan BARCHA
  // tranzaksiyalarning sof qoldig'i. Ilgari bu yerda kategoriya filtri bor
  // edi va ro'yxatdan o'chirilgan turdagi pul qoldiqdan yo'qolardi; endi
  // oylik Kirim/Chiqim ham hech narsani tashlamaydi, ya'ni boshlang'ich va
  // yakuniy balans bir xil qoidaga bo'ysunadi.
  const openingBalance = useMemo(() => {
    const yearStart = `${year}-01-01`;
    return transactions.filter((t) => t.date < yearStart).reduce((s, t) => s + t.amount, 0);
  }, [transactions, year]);

  const computed = useMemo(() => {
    const acc = monthly.reduce<{ list: ReturnType<typeof buildRow>[]; opening: number }>(
      (a, m) => {
        const row = buildRow(m, a.opening);
        return { list: [...a.list, row], opening: row.closing };
      },
      { list: [], opening: openingBalance },
    );
    return acc.list;
  }, [monthly, openingBalance]);

  const visible = month ? computed.filter((c) => c.month === month) : computed;
  const monthLabels = month ? [MONTH_NAMES_UZ[month - 1]] : MONTH_NAMES_UZ;

  // Jadval/eksportdagi kategoriya qatorlari. "Boshqa" faqat haqiqatan
  // ro'yxatdan tashqari pul bo'lganda qo'shiladi — bo'sh qator chizilmasin.
  const incomeRows = (visible.some((v) => (v.income[OTHER_KEY] || 0) !== 0) ? [...incomeCats, OTHER_KEY] : incomeCats)
    .map((key) => ({ key, label: catLabel(key, incomeCats) }));
  const expenseRows = (visible.some((v) => (v.expense[OTHER_KEY] || 0) !== 0) ? [...expenseCats, OTHER_KEY] : expenseCats)
    .map((key) => ({ key, label: catLabel(key, expenseCats) }));

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
      incomeRows.forEach(({ key, label }) => pushRow(label, visible.map((v) => v.income[key] || 0)));
      pushRow("Chiqim — Jami", visible.map((v) => v.chiqim));
      expenseRows.forEach(({ key, label }) => pushRow(label, visible.map((v) => v.expense[key] || 0)));
      pushRow("Sof", visible.map((v) => v.sof));
      // Eksportda ham 0 emas "—": faylni ochgan odam nolni haqiqiy hisob deb
      // o'qimasin (bu bo'limlar uchun manba yo'q).
      pushRow("Investitsion faoliyat", visible.map(() => ""));
      pushRow("Kirim — Jami ", visible.map(() => "—"));
      pushRow("Chiqim — Jami ", visible.map(() => "—"));
      pushRow("Sof ", visible.map(() => "—"));
      pushRow("Moliyaviy faoliyat", visible.map(() => ""));
      pushRow("Kirim — Jami  ", visible.map(() => "—"));
      pushRow("Chiqim — Jami  ", visible.map(() => "—"));
      pushRow("Sof  ", visible.map(() => "—"));
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
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
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

      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="table-scroll">
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
                  incomeCategories={incomeRows}
                  expenseCategories={expenseRows}
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

/** Kategoriya qatori: `key` — `income`/`expense` obyektidagi kalit,
 *  `label` — ko'rinadigan nom ("Boshqa" uchun ular boshqacha). */
interface CategoryRow {
  key: string;
  label: string;
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
  incomeCategories: CategoryRow[];
  expenseCategories: CategoryRow[];
}) {
  return (
    <>
      <tr className="bg-secondary/40">
        <td className="px-4 py-2.5 text-[13px] font-semibold" colSpan={monthLabels.length + 1}>{title}</td>
      </tr>
      {/* `withCategories` faqat Operatsion faoliyatda true — qolgan ikki
          bo'limda hisoblanadigan manba yo'q, shuning uchun son emas "—". */}
      <tr className="bg-emerald-50/70 border-b border-border/50">
        <td className="px-4 py-3 text-[13px] font-semibold">Kirim — Jami</td>
        {visible.map((v) => <td key={v.month} className="px-4 py-3 text-right text-[13px] tabular-nums font-semibold">{withCategories ? fmtUZS(v.kirim) : "—"}</td>)}
      </tr>
      {withCategories && incomeCategories.map((c) => (
        <tr key={c.key} className="border-b border-border/50">
          <td className="px-4 py-3 pl-8 text-[13px] text-muted-foreground">{c.label}</td>
          {visible.map((v) => <td key={v.month} className="px-4 py-3 text-right text-[13px] tabular-nums">{fmtUZS(v.income[c.key] || 0)}</td>)}
        </tr>
      ))}
      <tr className="bg-rose-50/70 border-b border-border/50">
        <td className="px-4 py-3 text-[13px] font-semibold">Chiqim — Jami</td>
        {visible.map((v) => <td key={v.month} className="px-4 py-3 text-right text-[13px] tabular-nums font-semibold">{withCategories ? fmtUZS(v.chiqim) : "—"}</td>)}
      </tr>
      {withCategories && expenseCategories.map((c) => (
        <tr key={c.key} className="border-b border-border/50">
          <td className="px-4 py-3 pl-8 text-[13px] text-muted-foreground">{c.label}</td>
          {visible.map((v) => <td key={v.month} className="px-4 py-3 text-right text-[13px] tabular-nums">{fmtUZS(v.expense[c.key] || 0)}</td>)}
        </tr>
      ))}
      <tr className="bg-amber-50 border-b border-border">
        <td className="px-4 py-3 text-[13px] font-semibold">Sof</td>
        {visible.map((v) => {
          if (!withCategories) {
            return <td key={v.month} className="px-4 py-3 text-right text-[13px] text-muted-foreground">—</td>;
          }
          return <td key={v.month} className={`px-4 py-3 text-right text-[13px] tabular-nums font-semibold ${v.sof < 0 ? "text-rose-600" : ""}`}>{fmtUZS(v.sof)}</td>;
        })}
      </tr>
    </>
  );
}
