"use client";

import { useEffect, useMemo, useState } from "react";
import { Target } from "lucide-react";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import CalendarTab from "./analytics/CalendarTab";
import JournalTab from "./analytics/JournalTab";
import CashFlowTab from "./analytics/CashFlowTab";
import type { CashboxName } from "@/lib/cashboxes";
import { fetchJson } from "@/lib/fetchJson";

/** summary?groupBy=method qaytaradigan qator. */
type MethodRow = { method: string; amount: number };

// Moliya → Moliya analitikasi (sidebar: Moliya > Moliya analitikasi, href
// /finance-analytics). Sof hisobot sahifasi (add/edit/delete yo'q). Chap
// panel — filial/kassalar bo'yicha umumiy balans + to'lov usuli taqsimoti;
// o'ngda 3 tab: Kalendar (kunlik balans), Journal (alohida tranzaksiyalar),
// Pul oqimi (12 oylik grafik/jadval + top-5 taqsimot). Hammasi BIR XIL
// /api/transactions ma'lumotidan hisoblanadi (ichki mos keladi) — bu
// kolleksiyaga yozuvlar Kassalar sahifasidagi Kirim/Chiqim amallaridan
// tushadi, demo seed yo'q (izoh ilgari constants/transactions.js dagi
// "Iyul 2026 generatori"ga ishora qilardi — u generator endi bu sahifaga
// hech qanday aloqasi yo'q, /api/transactions faqat haqiqiy yozuvlarni
// qaytaradi).
//
// Loyihada faqat bitta haqiqiy filial bor ("Akademiya"), shuning uchun
// "Umumiy filiallar summasi" = shu bitta filialning o'zi (fabrikatsiya
// qilingan ko'p filial emas). Shu sababli yuqoridagi "Barcha filiallar"
// nomli o'chirilgan (disabled) tanlov ham olib tashlandi: u hech qachon
// hech narsani filtrlay olmasdi — tranzaksiya yozuvida `branchId` maydoni
// umuman yo'q.

type TabKey = "kalendar" | "journal" | "pulOqimi";

function fmtUZS(n: number): string {
  return Math.round(n).toLocaleString("ru-RU") + " UZS";
}

export default function FinancialAnalyticsPage() {
  // Filial taqsimoti Sozlamalar → Moliya → To'lov turlaridan (barchasi —
  // nofaol qilingan turdagi eski summalar ham ko'rinishi kerak).
  const { methods: paymentMethods } = usePaymentMethods();
  const [tab, setTab] = useState<TabKey>("kalendar");
  const [cashboxes, setCashboxes] = useState<CashboxName[]>([]);
  const [loading, setLoading] = useState(true);

  // Chap paneldagi ikkita raqam — SERVERDAN. Ilgari bu sahifa butun
  // `transactions` kolleksiyasini yuklab (21 921 qator, 3.72 MB) uchala
  // tabga uzatardi; endi har bir tab o'ziga kerakli yig'indini so'raydi.
  //
  // `groupBy=method` bitta so'rovda ikkalasini beradi: usul bo'yicha
  // taqsimot va ularning yig'indisi = umumiy qoldiq.
  const [methodRows, setMethodRows] = useState<MethodRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchJson<{ rows: MethodRow[] }>("/api/transactions/summary?groupBy=method")
        .then((d) => d.rows)
        .catch(() => null),
      fetch("/api/cashboxes?names=1").then((r) => r.json()).catch(() => ({ ok: false })),
    ])
      .then(([rows, cb]) => {
        if (cancelled) return;
        setMethodRows(rows);
        if (cb.ok) setCashboxes(cb.cashboxes);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Xato bo'lganda "0 UZS" ko'rsatilmaydi — pastda `fmtOrDash` uni
  // chiziqchaga aylantiradi. Nol qoldiq ham haqiqiy holat, shu bois
  // ularni farqlash SHART.
  const failed = !loading && methodRows === null;
  const totalBalance = useMemo(
    () => (methodRows || []).reduce((s, r) => s + r.amount, 0),
    [methodRows],
  );

  const methodTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of paymentMethods) map[m.key] = 0;
    for (const r of methodRows || []) map[r.method] = (map[r.method] || 0) + r.amount;
    return map;
  }, [methodRows, paymentMethods]);

  const fmtOrDash = (n: number) => (loading ? "…" : failed ? "—" : fmtUZS(n));

  return (
    <div className="p-4 md:p-5 flex flex-col lg:flex-row gap-4 items-start">
      {/* Chap panel */}
      <aside className="w-full lg:w-72 shrink-0 space-y-4">
        {/* Tugma faqat Kalendar tab'iga qaytaradi. Ilgari title'da
            "filtrlarni asl holatga qaytarish" deb yozilgan edi — u hech
            qanday filtrni tozalamaydi (filtrlar tab komponentlari ichida),
            ya'ni yozuv va'da qilgan ish bajarilmasdi. */}
        <div className="flex justify-end">
          <button
            onClick={() => setTab("kalendar")}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary text-muted-foreground"
            title="Kalendar ko'rinishiga qaytish"
          >
            <Target className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl p-4 text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}>
          <div className="text-[13px] font-medium opacity-90">Umumiy filiallar summasi</div>
          <div className="text-[22px] font-bold tabular-nums mt-1">{fmtOrDash(totalBalance)}</div>
        </div>

        <div>
          <div className="text-[13px] font-semibold text-muted-foreground mb-2">Filiallar</div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[14px]">Akademiya</span>
            </div>
            <div className="font-bold text-[15px] tabular-nums mt-0.5">{fmtOrDash(totalBalance)}</div>
            <div className="mt-3 space-y-2">
              {paymentMethods.map((m) => (
                <div key={m.key} className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">{m.name}</span>
                  <span className="tabular-nums font-medium">{fmtOrDash(methodTotals[m.key] || 0)}</span>
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
        </div>

        {tab === "kalendar" && <CalendarTab />}
        {tab === "journal" && <JournalTab cashboxes={cashboxes} />}
        {tab === "pulOqimi" && <CashFlowTab />}
      </div>
    </div>
  );
}
