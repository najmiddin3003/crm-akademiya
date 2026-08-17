"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Pagination from "@/components/ui/Pagination";
import { SpinnerBlock } from "@/components/ui/Spinner";
import type { SalaryRun } from "@/lib/salary";

// Moliya → Oylik chiqarish (sidebar: Moliya > Oylik chiqarish, href
// /finance-payroll). Har bir qator — bitta o'tkazilgan "oylik chiqarish"
// partiyasining umumlashtirilgan hisoboti (/api/salary-runs). Audit-log —
// bu yerda tahrirlash/o'chirish yo'q (manba skrinshotida ham yo'q).
// "Oylik chiqarish" tugmasi xodim tanlash sahifasiga o'tadi (/finance-payroll/create).

function fmtUZS(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return rounded.toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + " UZS";
}

export default function SalaryRunsPage() {
  const [rows, setRows] = useState<SalaryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/salary-runs")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setRows(d.runs); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const start = (page - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Link href="/finance-payroll/create" className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
          Oylik chiqarish
        </Link>
      </div>

      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex justify-end px-3 pt-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 text-xs">
            <span className="text-muted-foreground">Umumiy soni:</span>
            <span className="font-bold tabular-nums">{rows.length}</span>
          </div>
        </div>
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Oylik</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Davomat</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Davomatdan foizi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Bonus</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Avans</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Jarima</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Akladi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">To&apos;lanmagan</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Sana</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r, i) => (
                <tr key={r.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{fmtUZS(r.oylik)}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{fmtUZS(r.davomat)}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{fmtUZS(r.davomatFoizi)}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{fmtUZS(r.bonus)}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{fmtUZS(r.avans)}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{fmtUZS(r.jarima)}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{fmtUZS(r.akladi)}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums font-semibold">{fmtUZS(r.tolanmagan)}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground whitespace-nowrap">{r.createdAt}</td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">{loading ? <SpinnerBlock size={22} /> : "Ma'lumot topilmadi"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      </div>
    </div>
  );
}
