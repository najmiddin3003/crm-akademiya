"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Pagination from "@/components/ui/Pagination";
import { EXPIRING_SUBS, ES_STATUS_OPTIONS } from "@/constants/expiringSubs";

// O'quvchilar → Joriy oyda obunasi tugaydiganlar (crm-akademiya
// #view-expiring-subs). Eng oddiy sahifa shu turkumda: qidiruv/Filtr/eksport
// yo'q (manbada ham yo'q) — faqat 3 ta statistika (barcha 370 yozuv bo'yicha,
// Statusi filtridan QAT'IY NAZAR o'zgarmaydi — manbadagi renderExpiringSubs()
// shunday) + haqiqatan ishlaydigan Statusi select (to'langan/qarzdor/kritik).
// "Kutilayotgan balans" = joriyBalans - jamiNarx (saqlanmaydi, har doim
// hisoblanadi). Manbada "Batafsil" havolasi ishlamaydi va ism ustidagi havola
// `id` maydoni yo'qligi sabab "undefined"ga ochiladi — bu yerda ikkalasi ham
// /student-edit/[id]ga olib boradi (constants/expiringSubs.js'da qo'shilgan
// id bilan).

function fmtUZS(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString("ru-RU").replace(/,/g, " ")} UZS`;
}
function balCls(n: number): string {
  return n < 0 ? "text-rose-600 font-semibold" : n > 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground";
}

export default function ExpiringSubsPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const { totalCost, currentBalance, expectedBalance } = useMemo(() => {
    let totalCost = 0;
    let currentBalance = 0;
    for (const s of EXPIRING_SUBS) {
      totalCost += s.totalCost;
      currentBalance += s.currentBalance;
    }
    return { totalCost, currentBalance, expectedBalance: currentBalance - totalCost };
  }, []);

  const filtered = useMemo(
    () => (status ? EXPIRING_SUBS.filter((s) => s.status === status) : EXPIRING_SUBS),
    [status],
  );

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      {/* Statistika + Status filtri */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-x-6 gap-y-2 flex-wrap text-[13px]">
          <span>
            <span className="text-muted-foreground font-medium">Jami darslar narxi</span>
            <span className="text-foreground font-semibold tabular-nums ml-1">{fmtUZS(totalCost)}</span>
          </span>
          <span className="border-l border-border pl-6">
            <span className="text-muted-foreground font-medium">Joriy balans</span>
            <span className={`font-semibold tabular-nums ml-1 ${currentBalance < 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmtUZS(currentBalance)}</span>
          </span>
          <span className="border-l border-border pl-6">
            <span className="text-muted-foreground font-medium">Kutilayotgan balans</span>
            <span className={`font-semibold tabular-nums ml-1 ${expectedBalance < 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmtUZS(expectedBalance)}</span>
          </span>
        </div>
        <div className="relative w-44">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Statusi</option>
            {ES_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
      </div>

      {/* Umumiy soni */}
      <div className="flex items-center justify-end">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">Umumiy soni:</span>
          <span className="font-bold tabular-nums">{filtered.length.toLocaleString("ru-RU").replace(/,/g, " ")}</span>
        </div>
      </div>

      {/* Jadval */}
      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap w-12">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;quvchini ismi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Telefon raqam</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Jami darslar narxi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Joriy balans</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Kutilayotgan balans</th>
                <th className="text-right px-3 py-3 whitespace-nowrap w-24" />
              </tr>
            </thead>
            <tbody>
              {slice.map((s, i) => {
                const expected = s.currentBalance - s.totalCost;
                return (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                    <td className="px-3 py-3 text-[13px] font-medium">
                      <Link href={`/student-edit/${s.id}`} className="hover:text-primary hover:underline">{s.name}</Link>
                    </td>
                    <td className="px-3 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">{s.phone}</td>
                    <td className="px-3 py-3 text-[13px] tabular-nums text-foreground whitespace-nowrap">{fmtUZS(s.totalCost)}</td>
                    <td className={`px-3 py-3 text-[13px] tabular-nums whitespace-nowrap ${balCls(s.currentBalance)}`}>{fmtUZS(s.currentBalance)}</td>
                    <td className={`px-3 py-3 text-[13px] tabular-nums whitespace-nowrap ${balCls(expected)}`}>{fmtUZS(expected)}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <Link href={`/student-edit/${s.id}`} className="text-primary hover:underline text-[12px]">Batafsil</Link>
                    </td>
                  </tr>
                );
              })}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">O&apos;quvchi topilmadi</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          totalItems={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
    </div>
  );
}
