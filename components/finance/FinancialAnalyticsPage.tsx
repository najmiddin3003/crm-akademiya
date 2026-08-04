"use client";

import { useEffect, useMemo, useState } from "react";
import { Target } from "lucide-react";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import CalendarTab from "./analytics/CalendarTab";
import JournalTab from "./analytics/JournalTab";
import CashFlowTab from "./analytics/CashFlowTab";
import type { Transaction } from "@/lib/transactions";
import type { Cashbox } from "@/lib/cashboxes";

// Moliya → Moliya analitikasi (sidebar: Moliya > Moliya analitikasi, href
// /finance-analytics). Sof hisobot sahifasi (add/edit/delete yo'q). Chap
// panel — filial/kassalar bo'yicha umumiy balans + to'lov usuli taqsimoti;
// o'ngda 3 tab: Kalendar (kunlik balans), Journal (alohida tranzaksiyalar),
// Pul oqimi (12 oylik grafik/jadval + top-5 taqsimot). Hammasi BIR XIL
// /api/transactions ma'lumotidan hisoblanadi (ichki mos keladi). Foydalanuvchi
// bilan kelishilgan yengil qamrov: faqat Iyul 2026 uchun to'liq generatsiya
// qilingan (constants/transactions.js), boshqa oylar bo'sh — Pul oqimi
// grafigida faqat Iyulda cho'qqi bo'ladi. Loyihada faqat bitta haqiqiy filial
// bor ("Akademiya", header'dagi filial-tanlagichda ko'ringan boshqalari hali
// real emas), shuning uchun "Umumiy filiallar summasi" = shu bitta filialning
// o'zi (fabrikatsiya qilinmagan ko'p filial emas).

type TabKey = "kalendar" | "journal" | "pulOqimi";

function fmtUZS(n: number): string {
  return Math.round(n).toLocaleString("ru-RU") + " UZS";
}

export default function FinancialAnalyticsPage() {
  // Filial taqsimoti Sozlamalar → Moliya → To'lov turlaridan (barchasi —
  // nofaol qilingan turdagi eski summalar ham ko'rinishi kerak).
  const { methods: paymentMethods } = usePaymentMethods();
  const [tab, setTab] = useState<TabKey>("kalendar");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/transactions").then((r) => r.json()),
      fetch("/api/cashboxes").then((r) => r.json()),
    ])
      .then(([tx, cb]) => {
        if (cancelled) return;
        if (tx.ok) setTransactions(tx.transactions);
        if (cb.ok) setCashboxes(cb.cashboxes);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const totalBalance = useMemo(() => transactions.reduce((s, t) => s + t.amount, 0), [transactions]);

  const methodTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of paymentMethods) map[m.key] = 0;
    for (const t of transactions) map[t.method] = (map[t.method] || 0) + t.amount;
    return map;
  }, [transactions, paymentMethods]);

  return (
    <div className="p-4 md:p-5 flex flex-col lg:flex-row gap-4 items-start">
      {/* Chap panel */}
      <aside className="w-full lg:w-72 shrink-0 space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => setTab("kalendar")}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary text-muted-foreground"
            title="Markazlashtirish (filtrlarni asl holatga qaytarish)"
          >
            <Target className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl p-4 text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}>
          <div className="text-[13px] font-medium opacity-90">Umumiy filiallar summasi</div>
          <div className="text-[22px] font-bold tabular-nums mt-1">{loading ? "…" : fmtUZS(totalBalance)}</div>
        </div>

        <div>
          <div className="text-[13px] font-semibold text-muted-foreground mb-2">Filiallar</div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[14px]">Akademiya</span>
            </div>
            <div className="font-bold text-[15px] tabular-nums mt-0.5">{loading ? "…" : fmtUZS(totalBalance)}</div>
            <div className="mt-3 space-y-2">
              {paymentMethods.map((m) => (
                <div key={m.key} className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">{m.name}</span>
                  <span className="tabular-nums font-medium">{fmtUZS(methodTotals[m.key] || 0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* O'ng qism */}
      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex items-center rounded-lg border border-border bg-card p-1">
            {[
              { key: "kalendar" as const, label: "Kalendar" },
              { key: "journal" as const, label: "Journal" },
              { key: "pulOqimi" as const, label: "Pul oqimi" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`h-9 px-4 rounded-md text-sm font-medium ${tab === t.key ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <select disabled className="h-9 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm text-muted-foreground">
              <option>Barcha filiallar</option>
            </select>
            <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
        </div>

        {tab === "kalendar" && <CalendarTab transactions={transactions} loading={loading} />}
        {tab === "journal" && <JournalTab transactions={transactions} cashboxes={cashboxes} loading={loading} />}
        {tab === "pulOqimi" && <CashFlowTab transactions={transactions} loading={loading} />}
      </div>
    </div>
  );
}
