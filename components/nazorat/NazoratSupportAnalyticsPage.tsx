"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Search } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { formatSupportTime, type SupportRecord } from "@/lib/supportAnalytics";
import PersonLink from "@/components/shared/PersonDirectory";
import Select from "@/components/ui/Select";

// Nazorat → Support analitikasi (sidebar: Nazorat > Hisobotlar > Support
// analitikasi, href /nazorat-support-analytics). Ma'lumot HAQIQIY —
// /api/support-analytics (MongoDB `support_analytics`).
//
// Sof hisobot sahifasi (add/edit/delete yo'q). Filtrlar: o'quvchi qidirish,
// Kurs, Support Teacher, sana oralig'i. Eksport — loyihaning boshqa
// sahifalaridagi bilan bir xil CSV/XLSX konventsiyasi.


function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function NazoratSupportAnalyticsPage() {
  const { showSuccess, showError } = useToast();
  const [records, setRecords] = useState<SupportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [course, setCourse] = useState("");
  const [teacher, setTeacher] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/support-analytics")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setRecords(d.records); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const courseOptions = useMemo(
    () => Array.from(new Set(records.map((r) => r.courseName))).sort(),
    [records],
  );
  const teacherOptions = useMemo(
    () => Array.from(new Set(records.map((r) => r.supportTeacherName))).sort(),
    [records],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const startIso = dateRange.start ? toIso(dateRange.start) : null;
    const endIso = dateRange.end ? toIso(dateRange.end) : null;
    return records.filter((r) => {
      if (q && !r.studentName.toLowerCase().includes(q)) return false;
      if (course && r.courseName !== course) return false;
      if (teacher && r.supportTeacherName !== teacher) return false;
      if (startIso && r.date < startIso) return false;
      if (endIso && r.date > endIso) return false;
      return true;
    });
  }, [records, query, course, teacher, dateRange]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  const exportCols: { label: string; get: (r: SupportRecord) => string | number }[] = [
    { label: "O'quvchi FIO", get: (r) => r.studentName },
    { label: "Kurs nomi", get: (r) => r.courseName },
    { label: "Support Teacher FIO", get: (r) => r.supportTeacherName },
    { label: "Vaqti", get: formatSupportTime },
    { label: "Yozilganlar soni", get: (r) => r.writtenCount },
  ];

  function exportCsv() {
    try {
      const rows = [
        exportCols.map((c) => c.label).join(","),
        ...filtered.map((r) => exportCols.map((c) => `"${String(c.get(r)).replace(/"/g, '""')}"`).join(",")),
      ];
      const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `support-analitikasi-${date}.csv`;
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
      const data = filtered.map((r) => Object.fromEntries(exportCols.map((c) => [c.label, c.get(r)])));
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Support analitikasi");
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `support-analitikasi-${date}.xlsx`);
      showSuccess("Excel fayl yuklab olindi");
    } catch {
      showError("Excel faylni yuklab bo'lmadi");
    }
  }

  function setFilter(setter: (v: string) => void, v: string) {
    setter(v);
    setPage(1);
  }

  return (
    <div className="page-frame container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      {/* Filtrlar + eksport */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setFilter(setQuery, e.target.value)}
            placeholder="O'quvchini qidirish"
            className="h-10 w-64 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <Select value={course} onChange={(v) => setFilter(setCourse, v)} options={courseOptions.map((c) => ({ value: c, label: c }))} placeholder="Kurs" clearable className="w-48" />
        <Select value={teacher} onChange={(v) => setFilter(setTeacher, v)} options={teacherOptions.map((t) => ({ value: t, label: t }))} placeholder="Support Teacher" clearable className="w-56" />
        <DateRangePicker
          value={dateRange}
          onChange={(r) => { setDateRange(r); setPage(1); }}
          placeholder="Oraliqni tanlang"
        />

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
          >
            <FileText className="w-4 h-4" />
            <span>CSV faylini yuklab olish</span>
          </button>
          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>EXCEL faylini yuklab olish</span>
          </button>
        </div>
      </div>

      {/* Jadval */}
      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{filtered.length}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">O&apos;quvchi FIO</th>
                <th className="px-5 py-3 text-left">Kurs nomi</th>
                <th className="px-5 py-3 text-left">Support Teacher FIO</th>
                <th className="px-5 py-3 text-left">Vaqti</th>
                <th className="px-5 py-3 text-right pr-5">Yozilganlar soni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((r, i) => (
                <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  <td className="px-5 py-3 font-medium"><PersonLink name={r.studentName} /></td>
                  <td className="px-5 py-3 text-[13px]">{r.courseName}</td>
                  <td className="px-5 py-3 text-[13px]">{r.supportTeacherName}</td>
                  <td className="px-5 py-3 tabular-nums text-[12px] text-muted-foreground">{formatSupportTime(r)}</td>
                  <td className="px-5 py-3 pr-5 text-right tabular-nums font-medium">{r.writtenCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {slice.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="h-16 w-16 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
              <svg className="icon" style={{ width: 32, height: 32, opacity: 0.45 }}><use href="#i-archive" /></svg>
            </div>
            <h3 className="text-[15px] font-semibold mb-1">
              {loading ? <Spinner size={22} /> : "Ma'lumotlar topilmadi"}
            </h3>
            {!loading && (
              <p className="text-[13px] text-muted-foreground max-w-sm">
                Ma&apos;lumotlar topilmadi. Filterni o&apos;zgartirib ko&apos;ring.
              </p>
            )}
          </div>
        )}

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
