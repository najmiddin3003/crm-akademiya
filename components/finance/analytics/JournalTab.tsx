"use client";

import { useEffect, useMemo, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { ErrorBlock } from "@/components/ui/ErrorBanner";
import { fetchJson } from "@/lib/fetchJson";
import type { Transaction } from "@/lib/transactions";
import type { CashboxName } from "@/lib/cashboxes";
import { useT } from "@/components/shared/Language";
// Bo'sh massiv MODUL DARAJASIDA: `?? []` har renderda YANGI massiv yasaydi
// va uni bog'liqlik sifatida ishlatadigan useMemo har safar qayta hisoblanadi.
const EMPTY: never[] = [];

// Moliya analitikasi → "Journal" tab'i.
//
// Ilgari bu tab BUTUN `transactions` kolleksiyasini ota komponentdan olardi
// (21 921 qator, 3.72 MB), sana bo'yicha brauzerda filtrlab, 50 tasini
// ko'rsatardi. Endi server filtrlaydi va sahifalaydi — 50 qator ~8.7 KB.
//
// Saralash SERVERDA `?sort=desc` bilan: {date:-1, id:-1}. Bu ilgarigi
// klient tartibining (`a.date === b.date ? b.id - a.id : ...`) aynan o'zi.

function fmtUZS(n: number): string {
  const sign = n < 0 ? "-" : "+";
  return sign + Math.abs(Math.round(n)).toLocaleString("ru-RU") + " UZS";
}
function todayRange(): DateRange {
  const now = new Date();
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
}
// Sanani MAHALLIY vaqt bo'yicha "YYYY-MM-DD" ga aylantiradi. Ilgari filtr
// `toISOString().slice(0,10)` ishlatardi — u UTC'ga o'tkazadi, shuning uchun
// Toshkent vaqtida (UTC+5) tanlangan kun bir kun oldingi kunga tushib,
// oyning birinchi kunidagi tranzaksiyalar ro'yxatdan chiqib ketardi.
function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function JournalTab({ cashboxes }: { cashboxes: CashboxName[] }) {
  const { t } = useT();
  const [dateRange, setDateRange] = useState<DateRange>(() => todayRange());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const fromIso = dateRange.start ? toIso(dateRange.start) : "";
  const toIsoStr = dateRange.end ? toIso(dateRange.end) : "";
  const queryKey = [fromIso, toIsoStr, page, pageSize].join("|");

  // So'rov EFFEKT ICHIDA turadi va `reloadKey` bilan qayta ishga tushadi.
  // Ilgari bu yer `load` nomli useCallback edi va "Qayta urinish" tugmasi
  // uni TO'G'RIDAN-TO'G'RI chaqirardi — o'shanda funksiya qaytargan
  // `cancelled` tozalagichi TASHLAB YUBORILARDI (uni faqat React chaqira
  // oladi). Natijada kechikkan javob yangisini bosib ketishi mumkin edi.
  //
  // Ma'lumot O'Z SO'ROV KALITI bilan saqlanadi. Kalit mos kelmasa u eski
  // hisoblanadi va CHIZILMAYDI — aks holda yangi sarlavha ostida eski
  // raqamlar turardi (spinner qayta yoqilmagani uchun).
  const [data, setData] = useState<
    { key: string; rows: Transaction[]; total: number; start: number } | null
  >(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ page: String(page), limit: String(pageSize), sort: "desc" });
    if (fromIso) qs.set("from", fromIso);
    if (toIsoStr) qs.set("to", toIsoStr);
    fetchJson<{ transactions: Transaction[]; total: number }>(`/api/transactions?${qs}`)
      .then((d) => {
        if (cancelled) return;
        // `start` ham SHU YERDA saqlanadi: aks holda "keyingi sahifa"
        // bosilganda raqamlash darhol 51-100 ga o'tib, ekranda hali
        // eski qatorlar turardi.
        setData({ key: queryKey, rows: d.transactions, total: d.total, start: (page - 1) * pageSize });
        setError(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Xato bo'lganda bo'sh jadval CHIZILMAYDI — pastda ErrorBlock
        // turadi. "Umumiy soni: 0" ham da'vo bo'lardi.
        setData(null);
        setError(true);
      });
    return () => { cancelled = true; };
  }, [queryKey, fromIso, toIsoStr, page, pageSize, reloadKey]);

  const fresh = data && data.key === queryKey ? data : null;
  const rows = fresh?.rows ?? EMPTY;
  const total = fresh?.total ?? 0;
  const loading = !fresh && !error;

  const cashboxName = useMemo(() => {
    const map = new Map(cashboxes.map((c) => [c.id, c.name]));
    return (id: number) => map.get(id) || "—";
  }, [cashboxes]);

  const start = fresh?.start ?? 0;

  function fmtDate(tv: Transaction): string {
    const [y, m, d] = tv.date.split("-");
    return `${d}.${m}.${y} | ${tv.time}`;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} className="w-52" />
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">{t("Umumiy soni:")}</span>
          <span className="font-bold tabular-nums">{error ? "—" : total}</span>
        </div>
      </div>

      {error ? (
        <ErrorBlock
          message="Tranzaksiyalarni yuklab bo'lmadi."
          onRetry={() => { setError(false); setReloadKey((k) => k + 1); }}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-3 whitespace-nowrap w-14">№</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">{t("Sana")}</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">{t("Miqdori")}</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">{t("To'lov turi")}</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">{t("Kassa")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tv, i) => (
                  <tr key={tv.id} className="border-b border-border/50">
                    <td className="px-4 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                    <td className="px-4 py-3 text-[13px] tabular-nums whitespace-nowrap">{fmtDate(tv)}</td>
                    <td className={`px-4 py-3 text-[13px] tabular-nums font-semibold ${tv.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtUZS(tv.amount)}</td>
                    <td className="px-4 py-3 text-[13px]">{t(tv.category)}</td>
                    <td className="px-4 py-3 text-[13px]">{cashboxName(tv.cashboxId)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">{loading ? <SpinnerBlock size={22} /> : "Ma'lumot topilmadi"}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination totalItems={total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </div>
      )}
    </div>
  );
}
