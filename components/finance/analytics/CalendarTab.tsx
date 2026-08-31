"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, BarChart3, LayoutGrid } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { ErrorBlock } from "@/components/ui/ErrorBanner";
import { fetchJson } from "@/lib/fetchJson";

// Moliya analitikasi → "Kalendar" tab'i.
//
// Ilgari butun `transactions` kolleksiyasi ota komponentdan kelardi
// (21 921 qator, 3.72 MB) va kunlik yig'indi brauzerda hisoblanardi.
// Endi /api/transactions/summary?groupBy=day,sign — faqat ko'rinadigan
// oy uchun, oy boshigacha bo'lgan qoldiq esa `?before=` bilan.
//
// ISHORA UCH QIYMATLI (pos/neg/zero) va bu yerda NOL KIRIMGA qo'shiladi —
// ilgarigi shart `t.amount >= 0` shunday edi. Pul oqimi tab'i esa nolni
// ikkalasidan ham chiqarib tashlaydi; shu bois server ularni aralashtirmaydi.

/** summary?groupBy=day,sign qaytaradigan qator. */
type DayRow = { day: string; sign: "pos" | "neg" | "zero"; amount: number };

const WEEKDAYS = ["Dush", "Sesh", "Chor", "Pay", "Jum", "Shan", "Yak"];

function fmtUZS(n: number): string {
  return Math.round(n).toLocaleString("ru-RU") + " UZS";
}
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export default function CalendarTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [view, setView] = useState<"grid" | "chart">("grid");
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStartIso = `${year}-${pad2(month)}-01`;
  const monthEndIso = `${year}-${pad2(month)}-${pad2(daysInMonth)}`;

  const [dayRows, setDayRows] = useState<DayRow[]>([]);
  const [balanceBeforeMonth, setBalanceBeforeMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    const qs = new URLSearchParams({
      groupBy: "day,sign",
      from: monthStartIso,
      to: monthEndIso,
      before: monthStartIso,
    });
    // `setLoading(true)` ATAYLAB yo'q: u effekt tanasida sinxron
    // ishlaganda kaskadli render chaqiradi (react-hooks/set-state-in-effect),
    // va qayta yuklashda jadval bo'shab, keyin to'lib "sakrardi". Spinner
    // faqat birinchi yuklashda — `useState(true)` dan.
    let cancelled = false;
    fetchJson<{ rows: DayRow[]; before: number }>(`/api/transactions/summary?${qs}`)
      .then((d) => {
        if (cancelled) return;
        setDayRows(d.rows);
        setBalanceBeforeMonth(d.before);
        setError(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Xato bo'lganda kalendar NOL bilan to'ldirilib chizilmasin —
        // "0 UZS" moliyada da'vo, "kelmadi" esa boshqa gap.
        setDayRows([]);
        setBalanceBeforeMonth(0);
        setError(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [monthStartIso, monthEndIso]);

  useEffect(() => load(), [load]);

  const days = useMemo(() => {
    const byDay: Record<number, { income: number; expense: number }> = {};
    for (let d = 1; d <= daysInMonth; d++) byDay[d] = { income: 0, expense: 0 };
    for (const r of dayRows) {
      const d = Number(r.day.slice(8, 10));
      if (!byDay[d]) continue;
      // Nol KIRIMGA — ilgarigi `t.amount >= 0` shartining aynan o'zi.
      if (r.sign === "neg") byDay[d].expense += -r.amount;
      else byDay[d].income += r.amount;
    }
    const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const acc = dayNumbers.reduce<{ list: { day: number; income: number; expense: number; balance: number }[]; running: number }>(
      (a, d) => {
        const running = a.running + byDay[d].income - byDay[d].expense;
        return { list: [...a.list, { day: d, income: byDay[d].income, expense: byDay[d].expense, balance: running }], running };
      },
      { list: [], running: balanceBeforeMonth },
    );
    return acc.list;
  }, [dayRows, daysInMonth, balanceBeforeMonth]);

  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7; // 0=Dush
  const cells: (typeof days[number] | null)[] = [...Array(firstWeekday).fill(null), ...days];

  const maxBalance = Math.max(1, ...days.map((d) => Math.abs(d.balance)));

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); } else setMonth((m) => m + 1);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {/* YIL tanlagichi: chap strelka ilgari `prevMonth`ni chaqirar edi —
              ya'ni yil tugmasi yilni emas, OYni orqaga surardi (o'ng strelka
              esa to'g'ri ishlardi). Endi ikkalasi ham yilni o'zgartiradi. */}
          <div className="inline-flex items-center h-9 rounded-lg border border-border bg-card px-2 gap-1">
            <button onClick={() => setYear((y) => y - 1)} className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-secondary text-muted-foreground"><ChevronLeft className="w-3.5 h-3.5" /></button>
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span className="text-[13px] tabular-nums w-10 text-center">{year}</span>
            <button onClick={() => setYear((y) => y + 1)} className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-secondary text-muted-foreground"><ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
          <div className="inline-flex items-center h-9 rounded-lg border border-border bg-card px-2 gap-1">
            <button onClick={prevMonth} className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-secondary text-muted-foreground"><ChevronLeft className="w-3.5 h-3.5" /></button>
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span className="text-[13px] tabular-nums w-6 text-center">{pad2(month)}</span>
            <button onClick={nextMonth} className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-secondary text-muted-foreground"><ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          <button onClick={() => setView("grid")} className={`h-7 w-7 inline-flex items-center justify-center rounded-md ${view === "grid" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`} title="Kalendar ko'rinishi">
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setView("chart")} className={`h-7 w-7 inline-flex items-center justify-center rounded-md ${view === "chart" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`} title="Grafik ko'rinishi">
            <BarChart3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error ? (
        <ErrorBlock message="Kalendar ma'lumotini yuklab bo'lmadi." onRetry={load} />
      ) : loading ? (
        <div className="rounded-xl border border-border bg-card p-10"><SpinnerBlock /></div>
      ) : view === "grid" ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 border-b border-border bg-secondary/40">
            {WEEKDAYS.map((w) => (
              <div key={w} className="px-3 py-2.5 text-center text-[12px] font-semibold text-muted-foreground">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((c, i) => (
              <div key={i} className="border-b border-r border-border/60 min-h-[92px] p-2 text-[12px]" style={{ borderRightWidth: (i + 1) % 7 === 0 ? 0 : undefined }}>
                {c && (
                  <>
                    <div className="font-medium text-[13px]">{c.day}</div>
                    {(c.income > 0 || c.expense > 0) && (
                      <div className="mt-1 space-y-0.5">
                        {c.income > 0 && <div className="text-emerald-600 font-medium tabular-nums">+{c.income.toLocaleString("ru-RU")}</div>}
                        {c.expense > 0 && <div className="text-rose-600 font-medium tabular-nums">-{c.expense.toLocaleString("ru-RU")}</div>}
                      </div>
                    )}
                    <div className="mt-1 text-foreground/80 tabular-nums">{fmtUZS(c.balance)}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-end gap-1" style={{ height: 260 }}>
            {days.map((d) => (
              <div
                key={d.day}
                className="relative flex-1 flex flex-col justify-end items-center group"
                onMouseEnter={() => setHoverDay(d.day)}
                onMouseLeave={() => setHoverDay((h) => (h === d.day ? null : h))}
              >
                {hoverDay === d.day && (
                  <div className="absolute -top-9 z-10 whitespace-nowrap rounded-md bg-neutral-900 text-white text-[11px] px-2 py-1 shadow-lg">
                    {pad2(month)}-{pad2(d.day)}: {fmtUZS(d.balance)}
                  </div>
                )}
                <div
                  className={`w-full rounded-t-sm ${d.balance >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
                  style={{ height: `${Math.max(2, (Math.abs(d.balance) / maxBalance) * 220)}px` }}
                />
                <div className="text-[9px] text-muted-foreground mt-1 tabular-nums">{pad2(month)}-{pad2(d.day)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
