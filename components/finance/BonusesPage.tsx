"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Filter, Settings2, SlidersHorizontal, Trash2, FileText, FileSpreadsheet, Check } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { BONUS_TYPES } from "@/constants/bonuses";
import BonusDrawer from "./BonusDrawer";
import type { Bonus } from "@/lib/bonuses";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";

// Moliya → Bonus (sidebar: Moliya > Bonus, href /finance-bonus). Ma'lumot
// /api/bonuses dan. "Bonus yaratish" — BonusDrawer (o'ng panel), o'chirish —
// loyihaning standart "Rostdan ham o'chirmoqchimisiz?" tasdiqlash oynasi
// (manba skrinshotda ko'rsatilmagan). O'ng yuqoridagi 3 ta ikonka: Filtr —
// sana oralig'i, Sozlama — CSV/Excel eksport, Ustunlar — jadval ustunlarini
// yashirish/ko'rsatish.

// /api/bonuses qaytaradigan qatorning ANIQ shakli.
//
// NIMA O'ZGARDI: "Oldingi/Keyingi miqdor" endi haqiqiy manba bo'lmaganda
// (xodimning balansini tizimda hech nima yuritmaydi) `null` keladi, "Kim
// tomonidan" esa sessiya bo'lmasa bo'sh keladi. Ilgari bu ustunlarda,
// jumladan CSV/Excel eksportida ham, o'ylab topilgan son va har safar bir
// xil o'ylab topilgan ism turardi. lib/bonuses.ts (bu guruh egaligida emas)
// ularni hali `number`/`string` deb e'lon qiladi — shu bois shu yerda
// kengaytirilgan tur bilan o'qiymiz.
type BonusRow = Omit<Bonus, "before" | "after" | "givenBy"> & {
  before: number | null;
  after: number | null;
  givenBy?: string | null;
};

const TYPE_LABEL: Record<string, string> = Object.fromEntries(BONUS_TYPES.map((t) => [t.value, t.tableLabel]));

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
  // Referensda oxirgi ustun shu. Bonus modelida to'lov tranzaksiyasiga
  // bog'lanish yo'q (faqat `cashboxId` bor), shuning uchun "Sababi"/"Holat"
  // kabi hozircha bo'sh chiqadi — maydon qo'shilgach shu yerda ko'rsatiladi.
  { key: "paymentTx", label: "To'lov tranzaksiyasi" },
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
  const [rows, setRows] = useState<BonusRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [typeFilter, setTypeFilter] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BonusRow | null>(null);
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

  // Eksportda ham jadvaldagi bilan AYNAN bir xil qiymat chiqadi: noma'lum
  // maydon 0 yoki o'ylab topilgan ism emas, "—" bo'lib tushadi.
  const exportCols: { label: string; get: (b: BonusRow) => string | number }[] = [
    { label: "Bonus turi", get: (b) => TYPE_LABEL[b.type] || b.type },
    { label: "To'liq ismi", get: (b) => b.recipientName },
    { label: "Kim tomonidan", get: (b) => b.givenBy || "—" },
    { label: "Oldingi miqdor", get: (b) => b.before ?? "—" },
    { label: "Miqdor", get: (b) => b.amount },
    { label: "Keyingi miqdor", get: (b) => b.after ?? "—" },
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

  async function exportExcel() {
    try {
      // xlsx (SheetJS) FAQAT shu yerda kerak — bosilganda. Statik import
      // bo'lganida u route'ning boshlang'ich JS to'plamiga kirardi:
      // 431 KB lik chunk 9 ta sahifada, eksport tugmasi bosilmasa ham.
      const XLSX = await import("xlsx");
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
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
          <span>+ Bonus yaratish</span>
        </button>

        <Select value={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }} options={BONUS_TYPES.map((t) => ({ value: t.value, label: t.tableLabel }))} placeholder="Bonus turi" clearable size="sm" className="w-44" />
        <Select value={recipientFilter} onChange={(v) => { setRecipientFilter(v); setPage(1); }} options={recipientOptions.map((n) => ({ value: n, label: n }))} placeholder="Talaba" clearable size="sm" className="w-44" />
        {/* Bu yerda "To'lov" nomli o'chirilgan (disabled), hech qachon
            ishlamaydigan tanlov turardi — Bonus yozuvida to'lovga bog'lanish
            maydoni yo'q, shuning uchun u hech qachon filtrlay olmasdi.
            Ishlamaydigan boshqaruvni qoldirgandan ko'ra olib tashlandi. */}
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

      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
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
                {!hiddenCols.has("paymentTx") && <th className="text-left px-3 py-3 whitespace-nowrap">To&apos;lov tranzaksiyasi</th>}
                <th className="px-3 py-3 w-16" />
              </tr>
            </thead>
            <tbody>
              {slice.map((b, i) => (
                <tr key={b.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  {!hiddenCols.has("type") && <td className="px-3 py-3 text-[13px] font-medium text-emerald-600">{TYPE_LABEL[b.type] || b.type}</td>}
                  {!hiddenCols.has("recipient") && <td className="px-3 py-3 text-[13px]">{b.recipientName}</td>}
                  {/* Manbasi yo'q qiymat "—": 0 yoki qandaydir ism yozish
                      soxta faktik da'vo bo'lardi. */}
                  {!hiddenCols.has("givenBy") && <td className="px-3 py-3 text-[13px]">{b.givenBy || "—"}</td>}
                  {!hiddenCols.has("before") && <td className="px-3 py-3 text-[13px] tabular-nums">{b.before == null ? "—" : b.before.toLocaleString("ru-RU")}</td>}
                  {!hiddenCols.has("amount") && <td className="px-3 py-3 text-[13px] tabular-nums font-semibold">{b.amount.toLocaleString("ru-RU")}</td>}
                  {!hiddenCols.has("after") && <td className="px-3 py-3 text-[13px] tabular-nums">{b.after == null ? "—" : b.after.toLocaleString("ru-RU")}</td>}
                  {!hiddenCols.has("note") && <td className="px-3 py-3 text-[13px] text-muted-foreground">{b.note || "—"}</td>}
                  {!hiddenCols.has("reason") && <td className="px-3 py-3 text-[13px] text-muted-foreground">{b.reason || "—"}</td>}
                  {!hiddenCols.has("status") && <td className="px-3 py-3 text-[13px] text-muted-foreground">{b.status || "—"}</td>}
                  {!hiddenCols.has("date") && <td className="px-3 py-3 text-[13px] text-muted-foreground tabular-nums whitespace-nowrap">{b.createdAt}</td>}
                  {!hiddenCols.has("paymentTx") && <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>}
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setDeleteTarget(b)} className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500" title="O'chirish">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={visibleColCount + 2} className="px-3 py-10 text-center text-sm text-muted-foreground">{loading ? <SpinnerBlock size={22} /> : "Bonus topilmadi"}</td>
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
        <Modal onClose={() => setDeleteTarget(null)} locked={deleting} bare size="sm" zIndex={110} panelClassName="p-6">{(modal) => (<>
            <p className="text-center text-[15px] font-semibold">Rostdan ham o&apos;chirmoqchimisiz?</p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={modal.close} disabled={deleting} className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
                Yo&apos;q
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
                {deleting ? "O'chirilmoqda…" : "Ha"}
              </button>
            </div>
          </>)}</Modal>
      )}
    </div>
  );
}
