"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import DvaBarChart from "@/components/nazorat/DvaBarChart";
import { DVA_COLORS, DVA_LABELS, DVA_KURSLAR, DVA_HOLATLAR } from "@/constants/davomatAnalytics";
import { DAVOMAT_GROUPS, DAVOMAT_TEACHERS } from "@/constants/davomat";
import { generateDvaRange, dvaTotals, fmtCount } from "@/lib/davomatAnalytics";

// Nazorat > Davomat analitikasi (crm-akademiya #view-nazorat-davomat-analytics,
// app.js renderDvaChart()/exportDvaPDF() ~line 28446). Haqiqiy backend yo'q —
// kunlik son ustunlari lib/davomatAnalytics.ts'dagi deterministik generator
// bilan hisoblanadi (bugungi kun + yakshanba qoidalari bilan, ~izohga q.).
// Manbadagi kabi faqat Sana (oraliq) filtri haqiqiy ishlaydi — Kurs/Guruh/
// O'qituvchi/Holati va "Filter" panelidagi yig'ish tugmasi manbada ham
// funksiyasiz (dekorativ) qoldirilgan.

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function exportDvaCsv(days: ReturnType<typeof generateDvaRange>) {
  const headers = ["Sana", ...DVA_LABELS, "Jami"];
  const rows = [headers, ...days.map((d) => [d.label, ...d.vals, d.vals.reduce((s, v) => s + v, 0)])];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "davomat-analitikasi.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function NazoratDavomatAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => ({ start: startOfMonth(new Date()), end: new Date() }));
  const [kurs, setKurs] = useState("");
  const [group, setGroup] = useState("");
  const [teacher, setTeacher] = useState("");
  const [holati, setHolati] = useState("");

  const days = useMemo(
    () => generateDvaRange(dateRange.start ?? startOfMonth(new Date()), dateRange.end ?? new Date()),
    [dateRange],
  );
  const totals = useMemo(() => dvaTotals(days), [days]);

  return (
    <div className="container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      <div>
        <button
          type="button"
          onClick={() => exportDvaCsv(days)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <Download className="icon icon-sm" />
          <span>PDF faylini yuklab olish</span>
        </button>
      </div>

      {/* KPI chiplar */}
      <div className="flex flex-wrap items-center gap-2">
        {DVA_LABELS.map((label, k) => (
          <div key={label} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px]">
            <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: DVA_COLORS[k] }} />
            <span className="text-muted-foreground">{label}</span>
            <span className="font-bold tabular-nums">{fmtCount(totals[k])}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* Filtr paneli */}
        <div className="rounded-2xl bg-card border border-border p-5 self-start" style={{ alignSelf: "start" }}>
          <div className="flex items-center justify-between mb-4">
            {/* Referensda panel sarlavhasi "Filtr" (inglizcha "Filter" emas). */}
            <h3 className="text-[15px] font-semibold">Filtr</h3>
            <button type="button" className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground" title="Yig'ish">
              <svg className="icon icon-sm"><use href="#i-trending-up" /></svg>
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Sana</label>
              <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Oraliqni tanlang" />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Kurs</label>
              <div className="relative">
                <select value={kurs} onChange={(e) => setKurs(e.target.value)} className="w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Tanlang</option>
                  {DVA_KURSLAR.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Guruh</label>
              <div className="relative">
                <select value={group} onChange={(e) => setGroup(e.target.value)} className="w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Tanlang</option>
                  {DAVOMAT_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">O&apos;qituvchi</label>
              <div className="relative">
                <select value={teacher} onChange={(e) => setTeacher(e.target.value)} className="w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Tanlang</option>
                  {DAVOMAT_TEACHERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Holati</label>
              <div className="relative">
                <select value={holati} onChange={(e) => setHolati(e.target.value)} className="w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Tanlang</option>
                  {DVA_HOLATLAR.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
              </div>
            </div>
          </div>
        </div>

        {/* Grafik */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-center gap-4 flex-wrap mb-3 text-[11px]">
            {DVA_LABELS.map((label, k) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <span className="inline-block w-4 h-3 rounded-sm" style={{ background: DVA_COLORS[k] }} />
                {label}
              </span>
            ))}
          </div>
          <DvaBarChart days={days} />
        </div>
      </div>
    </div>
  );
}
