"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { DAVOMAT_STUDENTS } from "@/constants/davomat";
import type { DavomatStudent } from "@/lib/davomat";

// Nazorat > Davomat > "O'quvchilarni davomatini ko'rish" (crm-akademiya
// #view-nazorat-davomat-view, app.js setDvvTab() ~line 28421). Manbadagi
// izoh aynan shunday deydi: "Render — empty by default (matches reference)" —
// ya'ni Keldi/Ketdi tab qaysi bo'lishidan qat'iy nazar jadval har doim bo'sh
// (haqiqiy turniket/davomat backendi yo'q). Shu xatti-harakat shu yerda ham
// ataylab saqlangan.

type Tab = "keldi" | "ketdi";

export default function NazoratDavomatViewingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId");
  const student = useMemo(
    () => (studentId ? (DAVOMAT_STUDENTS as DavomatStudent[]).find((s) => String(s.id) === studentId) ?? null : null),
    [studentId],
  );

  const [tab, setTab] = useState<Tab>("keldi");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });

  function clearStudent() {
    router.push("/nazorat-davomat/viewing");
  }

  return (
    <div className="container mx-auto max-w-[1700px] p-4 md:p-5 space-y-4">
      {/* Yuqori qator: holat tablari + Hammasi ketdi + filtrlar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("keldi")}
            className="inline-flex items-center h-9 px-6 rounded-md text-sm font-medium transition-colors"
            style={tab === "keldi" ? { background: "#10b981", color: "#fff" } : { background: "#10b98115", color: "#059669" }}
          >
            Keldi
          </button>
          <button
            type="button"
            onClick={() => setTab("ketdi")}
            className="inline-flex items-center h-9 px-6 rounded-md text-sm font-medium transition-colors"
            style={tab === "ketdi" ? { background: "#f43f5e", color: "#fff" } : { background: "#f43f5e15", color: "#e11d48" }}
          >
            Ketdi
          </button>
        </div>

        <button type="button" className="inline-flex items-center justify-center h-9 px-5 rounded-md bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 shadow-sm">
          Hammasi ketdi
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {student ? (
            <div className="relative inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-border bg-card text-sm">
              <span>{student.name}</span>
              <button type="button" onClick={clearStudent} className="h-5 w-5 rounded hover:bg-secondary inline-flex items-center justify-center text-muted-foreground">
                <X className="icon icon-xs" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <select
                defaultValue=""
                onChange={(e) => e.target.value && router.push(`/nazorat-davomat/viewing?studentId=${e.target.value}`)}
                className="filter-select h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">O&apos;quvchi</option>
                {(DAVOMAT_STUDENTS as DavomatStudent[]).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
            </div>
          )}
          <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Oraliqni tanlang" />
        </div>
      </div>

      {/* Jadval */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">0</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/20">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">ID</th>
                <th className="px-5 py-3 text-left">To&apos;liq ismi</th>
                <th className="px-5 py-3 text-left">Kelish sanasi</th>
                <th className="px-5 py-3 text-left">Ketish sanasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border" />
          </table>
        </div>

        {/* Bo'sh holat */}
        <div className="flex flex-col items-center justify-center text-center py-16">
          <div className="h-16 w-16 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
            <svg className="icon" style={{ width: 32, height: 32, opacity: 0.45 }}><use href="#i-archive" /></svg>
          </div>
          <h3 className="text-[15px] font-semibold mb-1">Ma&apos;lumotlar topilmadi</h3>
          <p className="text-[13px] text-muted-foreground max-w-sm">Ma&apos;lumotlar topilmadi. Filterni o&apos;zgartirib ko&apos;ring.</p>
        </div>
      </div>
    </div>
  );
}
