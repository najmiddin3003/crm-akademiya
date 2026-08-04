"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Pagination from "@/components/ui/Pagination";

// Hisobotlar bo'limidagi sof jadvalli hisobotlar uchun umumiy qobiq
// (To'lanmagan / Farqli to'lovlar / Bekor qilingan to'lovlar / Chegirmalar /
// Davomati bekor qilinganlar). Hammasi bir xil: /api/student-reports?kind=…
// dan o'qiydi, "Umumiy soni" ko'rsatadi va sahifalaydi — shuning uchun
// har biriga alohida komponent yozilmadi.

export interface ReportColumn<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
}

export default function ReportTablePage<T extends { id: number }>({
  kind,
  columns,
  minWidth = 900,
  emptyText = "Ma'lumotlar topilmadi",
  summary,
}: {
  kind: string;
  columns: ReportColumn<T>[];
  minWidth?: number;
  emptyText?: string;
  // Jadval ustidagi ixtiyoriy jamlanma (masalan "Umumiy chegirmalar: …").
  summary?: (rows: T[]) => ReactNode;
}) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/student-reports?kind=${kind}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setRows(d.rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kind]);

  const start = (page - 1) * pageSize;
  const slice = useMemo(() => rows.slice(start, start + pageSize), [rows, start, pageSize]);

  return (
    <div className="container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      {summary && summary(rows)}

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{rows.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth }}>
            <thead className="bg-secondary/20">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                {columns.map((c) => (
                  <th key={c.key} className={`px-5 py-3 whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((row, i) => (
                <tr key={row.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  {columns.map((c) => (
                    <td key={c.key} className={`px-5 py-3 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    {loading ? "Yuklanmoqda…" : emptyText}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          totalItems={rows.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
    </div>
  );
}
