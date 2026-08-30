"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, FileText, MoreVertical } from "lucide-react";
import DonutChart from "@/components/ui/DonutChart";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { useToast } from "@/components/ui/Toast";
import { CHART_COLORS } from "@/constants/financeAnalytics";
import { BONUS_TYPES } from "@/constants/bonuses";
import { PENALTY_TYPES } from "@/constants/penalties";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import type { Bonus } from "@/lib/bonuses";
import type { Penalty } from "@/lib/penalties";
import type { Cashbox } from "@/lib/cashboxes";
import type { Transaction } from "@/lib/transactions";
import type { TransactionType } from "@/lib/transactionTypes";
import { loadTransactionsCached } from "@/lib/transactionsClient";

// Moliya → Kirim chiqim (sidebar: Moliya > Kirim chiqim, href
// /finance-cashflow). 4 tab: Kirim/Chiqim — HAQIQIY MongoDB `transactions`
// kolleksiyasidan (Kassalar sahifasi bilan bir xil manba), kategoriya
// qatorlari "Tranzaksiya turi" sahifasidagi haqiqiy ro'yxatdan; Bonus/Jarima
// — REAL, mos ravishda /api/bonuses va /api/penalties'dan (sana oralig'i
// bo'yicha real filtrlanadi, bekor qilingan jarimalar hisobga olinmaydi).
// "Kassa" tanlansa — barcha 4 tab shu kassaga tegishli yozuvlar bilan
// cheklanadi. "To'lov turi" endi Kirim/Chiqim uchun ham HAQIQIY filtr
// (Transaction.method) — Bonus/Jarima yozuvlarida bunday maydon yo'q,
// shuning uchun u ikkalasida dekorativ qolaveradi.

type TabKey = "kirim" | "chiqim" | "bonus" | "jarima";

const TABS: { key: TabKey; label: string; activeClass: string }[] = [
  { key: "kirim", label: "Kirim", activeClass: "bg-primary text-white" },
  { key: "chiqim", label: "Chiqim", activeClass: "bg-rose-600 text-white" },
  { key: "bonus", label: "Bonus", activeClass: "bg-neutral-900 text-white" },
  { key: "jarima", label: "Jarima", activeClass: "bg-primary text-white" },
];

function fmtUZS(n: number): string {
  return Math.round(n).toLocaleString("ru-RU") + " UZS";
}

// "DD.MM.YYYY HH:mm" → Date (faqat kun aniqligida solishtirish uchun yetarli).
function parseCreatedAt(s: string): Date | null {
  const m = s.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}
// "YYYY-MM-DD" → Date (Transaction.date).
function parseIsoDate(s: string): Date | null {
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function inRange(d: Date | null, range: DateRange): boolean {
  if (!d) return false;
  if (range.start && d < range.start) return false;
  if (range.end) {
    const endOfDay = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate(), 23, 59, 59, 999);
    if (d > endOfDay) return false;
  }
  return true;
}
function monthToDate(): DateRange {
  const now = new Date();
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
}

export default function FinanceAnalyticsPage() {
  const { showSuccess, showError } = useToast();
  // "To'lov turi" filtri Sozlamalar → Moliya → To'lov turlaridan.
  const { methods: paymentMethods } = usePaymentMethods();
  const [tab, setTab] = useState<TabKey>("kirim");
  const [dateRange, setDateRange] = useState<DateRange>(() => monthToDate());
  const [cashboxId, setCashboxId] = useState("");
  const [payType, setPayType] = useState("");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [incomeCats, setIncomeCats] = useState<string[]>([]);
  const [expenseCats, setExpenseCats] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/cashboxes").then((r) => r.json()).then((d) => { if (d.ok) setCashboxes(d.cashboxes); });
    fetch("/api/bonuses").then((r) => r.json()).then((d) => { if (d.ok) setBonuses(d.bonuses); });
    fetch("/api/penalties").then((r) => r.json()).then((d) => { if (d.ok) setPenalties(d.penalties); });
    loadTransactionsCached().then(setTransactions).catch(() => {});
    fetch("/api/transaction-types").then((r) => r.json()).then((d) => {
      if (!d.ok) return;
      const all = d.types as TransactionType[];
      setIncomeCats(Array.from(new Set(all.filter((t) => t.mainType === "kirim").map((t) => t.name))));
      setExpenseCats(Array.from(new Set(all.filter((t) => t.mainType === "chiqim").map((t) => t.name))));
    });
  }, []);

  const selectedCashboxId = cashboxId ? Number(cashboxId) : null;

  const rows = useMemo(() => {
    if (tab === "kirim" || tab === "chiqim") {
      const cats = tab === "kirim" ? incomeCats : expenseCats;
      const inWindow = transactions.filter((t) => {
        if (tab === "kirim" ? t.amount <= 0 : t.amount >= 0) return false;
        if (!inRange(parseIsoDate(t.date), dateRange)) return false;
        if (selectedCashboxId != null && t.cashboxId !== selectedCashboxId) return false;
        if (payType && t.method !== payType) return false;
        return true;
      });
      return cats.map((c) => ({
        label: c,
        value: inWindow.filter((t) => t.category === c).reduce((s, t) => s + Math.abs(t.amount), 0),
      }));
    }
    if (tab === "bonus") {
      const inWindow = bonuses.filter(
        (b) => inRange(parseCreatedAt(b.createdAt), dateRange) && (selectedCashboxId == null || b.cashboxId === selectedCashboxId),
      );
      return BONUS_TYPES.map((t) => ({
        label: t.label,
        value: inWindow.filter((b) => b.type === t.value).reduce((s, b) => s + b.amount, 0),
      }));
    }
    const inWindow = penalties.filter(
      (p) => p.status !== "cancelled" && inRange(parseCreatedAt(p.createdAt), dateRange) && (selectedCashboxId == null || p.cashboxId === selectedCashboxId),
    );
    return PENALTY_TYPES.map((t) => ({
      label: t.label,
      value: inWindow.filter((p) => p.type === t.value).reduce((s, p) => s + p.amount, 0),
    }));
  }, [tab, bonuses, penalties, transactions, incomeCats, expenseCats, dateRange, selectedCashboxId, payType]);

  const slices = rows.map((r, i) => ({ ...r, color: CHART_COLORS[i % CHART_COLORS.length] }));
  const total = slices.reduce((s, x) => s + x.value, 0);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportMenuOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [exportMenuOpen]);

  const tabLabel = TABS.find((t) => t.key === tab)?.label ?? tab;

  function exportCsv() {
    try {
      const rowsOut = [
        ["Turlari", "Summa"].join(","),
        ...slices.map((s) => [`"${s.label.replace(/"/g, '""')}"`, s.value].join(",")),
      ];
      const blob = new Blob([rowsOut.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${tab}-${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess("CSV fayl yuklab olindi");
    } catch {
      showError("CSV faylni yuklab bo'lmadi");
    }
  }

  async function exportExcel() {
    try {
      // xlsx (SheetJS) FAQAT shu yerda kerak — bosilganda. Statik import
      // bo'lganida u route'ning boshlang'ich JS to'plamiga kirardi:
      // 431 KB lik chunk 9 ta sahifada, eksport tugmasi bosilmasa ham.
      const XLSX = await import("xlsx");
      const rowsOut = slices.map((s) => ({ Turlari: s.label, Summa: s.value }));
      const worksheet = XLSX.utils.json_to_sheet(rowsOut);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, tabLabel);
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `${tab}-${date}.xlsx`);
      showSuccess("Excel fayl yuklab olindi");
    } catch {
      showError("Excel faylni yuklab bo'lmadi");
    }
  }

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex items-center rounded-lg border border-border bg-card p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`h-9 px-4 rounded-md text-sm font-medium ${tab === t.key ? t.activeClass : "text-muted-foreground hover:bg-secondary"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <select value={cashboxId} onChange={(e) => setCashboxId(e.target.value)} className="h-9 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Kassa</option>
              {cashboxes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
          <DateRangePicker value={dateRange} onChange={setDateRange} className="w-52" />
          <div className="relative">
            <select value={payType} onChange={(e) => setPayType(e.target.value)} className="h-9 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">To&apos;lov turi</option>
              {paymentMethods.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
            </select>
            <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportMenuOpen((o) => !o)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary text-muted-foreground"
              title="Sozlama"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {exportMenuOpen && (
              <div className="absolute top-full right-0 mt-2 z-50 w-64 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1">
                <button
                  type="button"
                  onClick={() => { exportCsv(); setExportMenuOpen(false); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <FileText className="icon icon-sm" />
                  </span>
                  <span>CSV faylini yuklab olish</span>
                </button>
                <button
                  type="button"
                  onClick={() => { exportExcel(); setExportMenuOpen(false); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <FileSpreadsheet className="icon icon-sm" />
                  </span>
                  <span>EXCEL faylini yuklab olish</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-center">
          <DonutChart slices={slices} centerLabel={fmtUZS(total)} size={320} />
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-3 whitespace-nowrap w-14">№</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Turlari</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">Summa</th>
                </tr>
              </thead>
              <tbody>
                {slices.filter((s) => s.value > 0).map((s, i) => (
                  <tr key={s.label} className="border-b border-border/50">
                    <td className="px-4 py-3 text-muted-foreground tabular-nums text-[13px]">{i + 1}</td>
                    <td className="px-4 py-3 text-[13px] font-medium" style={{ color: s.color }}>
                      {s.label}
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] tabular-nums font-semibold">{fmtUZS(s.value)}</td>
                  </tr>
                ))}
                {slices.every((s) => s.value === 0) && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm text-muted-foreground">Ma&apos;lumot topilmadi</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-border font-semibold text-[13px]">
            <span>Jami</span>
            <span className="tabular-nums">{fmtUZS(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
