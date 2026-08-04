"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Filter, Settings2, SlidersHorizontal, Trash2, FileText, FileSpreadsheet, Check } from "lucide-react";
import * as XLSX from "xlsx";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { useToast } from "@/components/ui/Toast";
import { BONUS_TYPES } from "@/constants/bonuses";
import BonusDrawer from "./BonusDrawer";
import type { Bonus } from "@/lib/bonuses";

// Moliya → Bonus (sidebar: Moliya > Bonus, href /finance-bonus). Ma'lumot
// /api/bonuses dan. "Bonus yaratish" — BonusDrawer (o'ng panel), o'chirish —
// loyihaning standart "Rostdan ham o'chirmoqchimisiz?" tasdiqlash oynasi
// (manba skrinshotda ko'rsatilmagan). O'ng yuqoridagi 3 ta ikonka: Filtr —
// sana oralig'i, Sozlama — CSV/Excel eksport, Ustunlar — jadval ustunlarini
// yashirish/ko'rsatish.

const TYPE_LABEL: Record<string, string> = Object.fromEntries(BONUS_TYPES.map((t) => [t.value, t.tableLabel]));
const selectCls = "h-9 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

const ALL_COLUMNS: { key: string; label: string }[] = [
  { key: "type", label: "Bonus turi" },
  { key: "recipient", label: "To'liq ismi" },
  { key: "givenBy", label: "Kim tomonidan" },
  { key: "before", label: "Oldingi miqdor" },
  { key: "amount", label: "Miqdor" },
  { key: "after", label: "Keyingi miqdor" },
  { key: "note", label: "Izoh" },
  { key: "reason", label: "Sababi" },
  { key: "status", label: "Holat" },
  { key: "date", label: "Sana" },
];

function fmtUZS(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " UZS";
}

// "DD.MM.YYYY HH:mm" -> Date (kun aniqligida, DateRangePicker bilan solishtirish uchun).
function parseCreatedAt(s: string): Date | null {
  const [datePart] = s.split(" ");
  const [d, m, y] = (datePart || "").split(".").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

export default function BonusesPage() {
  const { showSuccess, showError } = useToast();
  const [rows, setRows] = useState<Bonus[]>([]);
  const [loading, setLoading] = useState(true);

  const [typeFilter, setTypeFilter] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Bonus | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!filterOpen && !exportMenuOpen && !columnsOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (filterOpen && filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
      if (exportMenuOpen && exportRef.current && !exportRef.current.contains(e.target as Node)) setExportMenuOpen(false);
      if (columnsOpen && columnsRef.current && !columnsRef.current.contains(e.target as Node)) setColumnsOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [filterOpen, exportMenuOpen, columnsOpen]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/bonuses")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setRows(d.bonuses); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const recipientOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.recipientName))).sort(), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter && r.type !== typeFilter) return false;
      if (recipientFilter && r.recipientName !== recipientFilter) return false;
      if (dateRange.start || dateRange.end) {
        const d = parseCreatedAt(r.createdAt);
        if (!d) return false;
        if (dateRange.start && d < dateRange.start) return false;
        if (dateRange.end && d > dateRange.end) return false;
      }
      return true;
    });
  }, [rows, typeFilter, recipientFilter, dateRange]);

  const totalAmount = useMemo(() => filtered.reduce((sum, r) => sum + r.amount, 0), [filtered]);
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const visibleColCount = ALL_COLUMNS.length - hiddenCols.size;

  function toggleCol(key: string) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const exportCols: { label: string; get: (b: Bonus) => string | number }[] = [
    { label: "Bonus turi", get: (b) => TYPE_LABEL[b.type] || b.type },
    { label: "To'liq ismi", get: (b) => b.recipientName },
    { label: "Kim tomonidan", get: (b) => b.givenBy },
    { label: "Oldingi miqdor", get: (b) => b.before },
    { label: "Miqdor", get: (b) => b.amount },
    { label: "Keyingi miqdor", get: (b) => b.after },
    { label: "Izoh", get: (b) => b.note || "" },
    { label: "Sababi", get: (b) => b.reason || "" },
    { label: "Holat", get: (b) => b.status || "" },
    { label: "Sana", get: (b) => b.createdAt },
  ];

  function exportCsv() {
    try {
      const csvRows = [
        exportCols.map((c) => c.label).join(","),
        ...filtered.map((b) => exportCols.map((c) => `"${String(c.get(b)).replace(/"/g, '""')}"`).join(",")),
      ];
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `bonuslar-${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess("CSV fayl yuklab olindi");
    } catch {
      showError("CSV faylni yuklab bo'lmadi");
    }
  }

  function exportExcel() {
    try {
      const data = filtered.map((b) => Object.fromEntries(exportCols.map((c) => [c.label, c.get(b)])));
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Bonuslar");
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `bonuslar-${date}.xlsx`);
      showSuccess("Excel fayl yuklab olindi");
    } catch {
      showError("Excel faylni yuklab bo'lmadi");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const b = deleteTarget;
    setDeleting(true);
    try {
      const res = await fetch(`/api/bonuses/${b.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "O'chirilmadi");
        setDeleting(false);
        return;
      }
      setRows((prev) => prev.filter((x) => x.id !== b.id));
      showSuccess("Bonus o'chirildi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
          <span>+ Bonus yaratish</span>
        </button>

        <div className="relative">
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className={`${selectCls} w-44`}>
            <option value="">Bonus turi</option>
            {BONUS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.tableLabel}</option>)}
          </select>
          <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
        <div className="relative">
          <select value={recipientFilter} onChange={(e) => { setRecipientFilter(e.target.value); setPage(1); }} className={`${selectCls} w-44`}>
            <option value="">Talaba</option>
            {recipientOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
        <div className="relative">
          <select disabled className={`${selectCls} w-36 text-muted-foreground`}>
            <option value="">To&apos;lov</option>
          </select>
          <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setFilterOpen((o) => !o)}
              className={`h-9 w-9 inline-flex items-center justify-center rounded-lg border text-muted-foreground ${filterOpen || dateRange.start ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-secondary"}`}
              title="Filtr (sana oralig'i)"
            >
              <Filter className="w-4 h-4" />
            </button>
            {filterOpen && (
              <div className="absolute top-full right-0 mt-2 z-50">
                <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} className="w-56" />
              </div>
            )}
          </div>
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportMenuOpen((o) => !o)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary text-muted-foreground"
              title="Sozlamalar"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            {exportMenuOpen && (
              <div className="absolute top-full right-0 mt-2 z-50 w-64 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1">
                <button
                  type="button"
                  onClick={() => { exportCsv(); setExportMenuOpen(false); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <FileText className="w-4 h-4" />
                  </span>
                  <span>CSV faylini yuklab olish</span>
                </button>
                <button
                  type="button"
                  onClick={() => { exportExcel(); setExportMenuOpen(false); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                    <FileSpreadsheet className="w-4 h-4" />
                  </span>
                  <span>Excel faylini yuklab olish</span>
                </button>
              </div>
            )}
          </div>
          <div className="relative" ref={columnsRef}>
            <button
              onClick={() => setColumnsOpen((o) => !o)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary text-muted-foreground"
              title="Ustunlar"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            {columnsOpen && (
              <div className="absolute top-full right-0 mt-2 z-50 w-56 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1 max-h-80 overflow-y-auto">
                {ALL_COLUMNS.map((c) => {
                  const visible = !hiddenCols.has(c.key);
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => toggleCol(c.key)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm hover:bg-secondary text-left"
                    >
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${visible ? "bg-primary border-primary text-white" : "border-border"}`}>
                        {visible && <Check className="w-3 h-3" />}
                      </span>
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-[13px]">
          <span className="font-semibold">Umumiy bonuslar</span> <span className="tabular-nums">{fmtUZS(totalAmount)}</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">Umumiy soni:</span>
          <span className="font-bold tabular-nums">{filtered.length}</span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                {!hiddenCols.has("type") && <th className="text-left px-3 py-3 whitespace-nowrap">Bonus turi</th>}
                {!hiddenCols.has("recipient") && <th className="text-left px-3 py-3 whitespace-nowrap">To&apos;liq ismi</th>}
                {!hiddenCols.has("givenBy") && <th className="text-left px-3 py-3 whitespace-nowrap">Kim tomonidan</th>}
                {!hiddenCols.has("before") && <th className="text-left px-3 py-3 whitespace-nowrap">Oldingi miqdor</th>}
                {!hiddenCols.has("amount") && <th className="text-left px-3 py-3 whitespace-nowrap">Miqdor</th>}
                {!hiddenCols.has("after") && <th className="text-left px-3 py-3 whitespace-nowrap">Keyingi miqdor</th>}
                {!hiddenCols.has("note") && <th className="text-left px-3 py-3 whitespace-nowrap">Izoh</th>}
                {!hiddenCols.has("reason") && <th className="text-left px-3 py-3 whitespace-nowrap">Sababi</th>}
                {!hiddenCols.has("status") && <th className="text-left px-3 py-3 whitespace-nowrap">Holat</th>}
                {!hiddenCols.has("date") && <th className="text-left px-3 py-3 whitespace-nowrap">Sana</th>}
                <th className="px-3 py-3 w-16" />
              </tr>
            </thead>
            <tbody>
              {slice.map((b, i) => (
                <tr key={b.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  {!hiddenCols.has("type") && <td className="px-3 py-3 text-[13px] font-medium text-emerald-600">{TYPE_LABEL[b.type] || b.type}</td>}
                  {!hiddenCols.has("recipient") && <td className="px-3 py-3 text-[13px]">{b.recipientName}</td>}
                  {!hiddenCols.has("givenBy") && <td className="px-3 py-3 text-[13px]">{b.givenBy}</td>}
                  {!hiddenCols.has("before") && <td className="px-3 py-3 text-[13px] tabular-nums">{b.before.toLocaleString("ru-RU")}</td>}
                  {!hiddenCols.has("amount") && <td className="px-3 py-3 text-[13px] tabular-nums font-semibold">{b.amount.toLocaleString("ru-RU")}</td>}
                  {!hiddenCols.has("after") && <td className="px-3 py-3 text-[13px] tabular-nums">{b.after.toLocaleString("ru-RU")}</td>}
                  {!hiddenCols.has("note") && <td className="px-3 py-3 text-[13px] text-muted-foreground">{b.note || "—"}</td>}
                  {!hiddenCols.has("reason") && <td className="px-3 py-3 text-[13px] text-muted-foreground">{b.reason || "—"}</td>}
                  {!hiddenCols.has("status") && <td className="px-3 py-3 text-[13px] text-muted-foreground">{b.status || "—"}</td>}
                  {!hiddenCols.has("date") && <td className="px-3 py-3 text-[13px] text-muted-foreground tabular-nums whitespace-nowrap">{b.createdAt}</td>}
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setDeleteTarget(b)} className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500" title="O'chirish">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={visibleColCount + 2} className="px-3 py-10 text-center text-sm text-muted-foreground">{loading ? "Yuklanmoqda…" : "Bonus topilmadi"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      </div>

      {addOpen && (
        <BonusDrawer onClose={() => setAddOpen(false)} onSaved={(b) => setRows((prev) => [b, ...prev])} />
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6">
            <p className="text-center text-[15px] font-semibold">Rostdan ham o&apos;chirmoqchimisiz?</p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
                Yo&apos;q
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
                {deleting ? "O'chirilmoqda…" : "Ha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
