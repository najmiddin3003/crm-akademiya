"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Filter, MoreVertical, X } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import {
  createInitialOrders,
  applyOrdersFilters,
  EMPTY_ORDERS_FILTERS,
  MODERATORS,
  COURSES,
  type Order,
  type OrdersFilters,
} from "@/lib/ordersData";

// O'quvchilar → Aktiv o'quvchilar (crm-akademiya #view-active-students,
// sidebar: O'quvchilar > Aktiv o'quvchilar, href /active-students). Har
// o'quvchining "aktiv/yangi/muzlatilgan" holati indeks bo'yicha deterministik
// hisoblanadi (Guruh o'quvchilari sahifasidagi bilan bir xil formula) — bu
// yerda faqat "active" bo'lganlar ko'rsatiladi. Ism ustiga bosilsa
// /student-edit/[id] ga o'tadi. Qator checkboxlari CSV/Excel eksportni
// tanlangan qatorlar bilan cheklaydi (hech narsa tanlanmasa — hammasi).

interface Row {
  order: Order;
  balance: number;
}

function genBalance(seed: number): number {
  const magnitude = 1_000_000 + ((seed * 137) % 6_000_000);
  return seed % 5 === 0 ? magnitude : -magnitude;
}

function buildRows(): Row[] {
  return createInitialOrders()
    .filter((o, i) => {
      const isFrozen = i % 13 === 0;
      const isNew = o.isNew || i % 5 === 1;
      return !isFrozen && !isNew;
    })
    .map((o) => ({ order: o, balance: genBalance(o.id) }));
}

function fmtUZS(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString("ru-RU").replace(/,/g, " ")} UZS`;
}

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const selectCls = "h-9 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const checkboxCls = "h-4 w-4 rounded border-border accent-primary cursor-pointer";
const HEADERS = ["№", "O'quvchi ismi", "Telefon raqam", "Balans", "To'lov sanasi", "Yaratilgan sanasi", "Moderator", "Taklif qilganlari", "Ilovani yuklab olish sanasi", "Sababi"];

function HeaderCheckbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate: boolean; onChange: (v: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={checkboxCls} />;
}

export default function ActiveStudentsPage() {
  const [rows] = useState<Row[]>(() => buildRows());
  const [filters, setFilters] = useState<OrdersFilters>(EMPTY_ORDERS_FILTERS);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  function setFilter<K extends keyof OrdersFilters>(key: K, value: OrdersFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  const filtered = useMemo(() => {
    const withDates: OrdersFilters = {
      ...filters,
      from: dateRange.start ? dateRange.start.toISOString().slice(0, 10) : "",
      to: dateRange.end ? dateRange.end.toISOString().slice(0, 10) : "",
    };
    const orders = applyOrdersFilters(rows.map((r) => r.order), withDates);
    const ids = new Set(orders.map((o) => o.id));
    return rows.filter((r) => ids.has(r.order.id));
  }, [rows, filters, dateRange]);

  const { debt, credit } = useMemo(() => {
    let debt = 0;
    let credit = 0;
    for (const r of filtered) {
      if (r.balance < 0) debt += r.balance;
      else credit += r.balance;
    }
    return { debt, credit };
  }, [filtered]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  const pageIds = useMemo(() => slice.map((r) => r.order.id), [slice]);
  const pageSelectedCount = pageIds.filter((id) => selected.has(id)).length;
  const allPageSelected = pageIds.length > 0 && pageSelectedCount === pageIds.length;
  const somePageSelected = pageSelectedCount > 0 && !allPageSelected;

  function toggleRow(id: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function toggleAllOnPage(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function rowsToExport(): Row[] {
    return selected.size > 0 ? filtered.filter((r) => selected.has(r.order.id)) : filtered;
  }
  function exportRows() {
    return rowsToExport().map((r, i) => [
      i + 1,
      r.order.name,
      r.order.phone,
      r.balance,
      "",
      r.order.created,
      r.order.moderator,
      "",
      "",
      "",
    ]);
  }
  function exportCSV() {
    const csv = [HEADERS, ...exportRows()].map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "aktiv-oquvchilar.csv");
    setMoreOpen(false);
  }
  function exportExcel() {
    const head = "<tr>" + HEADERS.map((h) => `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`).join("") + "</tr>";
    const bodyRows = exportRows().map((r) => "<tr>" + r.map((v) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;">${v}</td>`).join("") + "</tr>").join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${head}</thead><tbody>${bodyRows}</tbody></table></body></html>`;
    downloadBlob(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), "aktiv-oquvchilar.xls");
    setMoreOpen(false);
  }

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      {/* Amallar qatori */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={`relative inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-shadow${
            filtersOpen ? " ring-2 ring-blue-300" : ""
          }`}
        >
          <Filter className="icon icon-sm" />
          <span>Filtr</span>
        </button>

        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <span className="text-[13px] text-muted-foreground">{selected.size} ta tanlandi</span>
          )}
          <div className="relative">
            <svg className="icon icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><use href="#i-search" /></svg>
            <input
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              type="text"
              placeholder="Qidirish"
              className="w-56 h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="relative" ref={moreRef}>
            <button onClick={() => setMoreOpen((o) => !o)} className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card hover:bg-secondary" title="Amallar">
              <MoreVertical className="icon icon-sm" />
            </button>
            {moreOpen && (
              <div className="absolute top-full right-0 mt-2 z-50 w-56 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1">
                <button onClick={exportCSV} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                  <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">CSV</span>
                  <span>{selected.size > 0 ? `Tanlanganlarni (${selected.size}) yuklab olish` : "CSV faylini yuklab olish"}</span>
                </button>
                <button onClick={exportExcel} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                  <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">XLS</span>
                  <span>{selected.size > 0 ? `Tanlanganlarni (${selected.size}) yuklab olish` : "EXCEL faylini yuklab olish"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filtr paneli */}
      {filtersOpen && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select value={filters.moderator} onChange={(e) => setFilter("moderator", e.target.value)} className={`${selectCls} w-44`}>
              <option value="">Moderator</option>
              {MODERATORS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
          <div className="relative">
            <select value={filters.course} onChange={(e) => setFilter("course", e.target.value)} className={`${selectCls} w-36`}>
              <option value="">Kurs</option>
              {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
          <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} placeholder="Oraliqni tanlang" />
          <button
            onClick={() => { setFilters(EMPTY_ORDERS_FILTERS); setDateRange({ start: null, end: null }); }}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            <X className="icon icon-xs" /> Tozalash
          </button>
        </div>
      )}

      {/* Qarzdor/Haqdor + Umumiy soni */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-[13px]">
          <span className="text-rose-600 font-medium">Qarzdor {fmtUZS(debt)}</span>
          <span className="text-border">|</span>
          <span className="text-emerald-600 font-medium">Haqdor {fmtUZS(credit)}</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">Umumiy soni:</span>
          <span className="font-bold tabular-nums">{filtered.length.toLocaleString("ru-RU").replace(/,/g, " ")}</span>
        </div>
      </div>

      {/* Jadval */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-3 py-3 w-10">
                  <HeaderCheckbox checked={allPageSelected} indeterminate={somePageSelected} onChange={toggleAllOnPage} />
                </th>
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;quvchi ismi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Telefon raqam</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Balans</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">To&apos;lov sanasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Yaratilgan sanasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Moderator</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Taklif qilganlari</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Ilovani yuklab olish sanasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Sababi</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r, i) => (
                <tr key={r.order.id} className={`border-b border-border/50 transition-colors hover:bg-secondary/30${selected.has(r.order.id) ? " bg-primary/5" : ""}`}>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.order.id)}
                      onChange={(e) => toggleRow(r.order.id, e.target.checked)}
                      className={checkboxCls}
                    />
                  </td>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  <td className="px-3 py-3 text-[13px]">
                    <Link href={`/student-edit/${r.order.id}`} className="font-medium hover:text-primary hover:underline">
                      {r.order.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-[13px] tabular-nums whitespace-nowrap">{r.order.phone || "—"}</td>
                  <td className={`px-3 py-3 text-[13px] tabular-nums whitespace-nowrap ${r.balance < 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmtUZS(r.balance)}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">{r.order.created}</td>
                  <td className="px-3 py-3 text-[13px]">{r.order.moderator || "—"}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-sm text-muted-foreground">O&apos;quvchi topilmadi</td>
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
