"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Filter, MessageSquare, MoreVertical, Users as UsersIcon, X } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import {
  createInitialOrders,
  applyOrdersFilters,
  EMPTY_ORDERS_FILTERS,
  MODERATORS,
  COURSES,
  type Order,
  type OrdersFilters,
} from "@/lib/ordersData";
import { GROUP_SEED } from "@/constants/groups";

// O'quvchilar → Yangi o'quvchilar (crm-akademiya #view-new-students, sidebar:
// O'quvchilar > Yangi o'quvchilar, href /new-students). order.status==="Yangi"
// bo'lgan buyurtmalar (createInitialOrders(), lib/ordersData.ts — /orders-list
// bilan bir xil manba) shu yerda ro'yxat sifatida ko'rsatiladi. Guruh/O'qituvchi
// GROUP_SEED'dan indeks bo'yicha biriktiriladi (Guruh o'quvchilari sahifasidagi
// bilan bir xil yondashuv), Balans esa demo ko'rsatish uchun deterministik
// hisoblab chiqiladi (Order tipida bunday maydon yo'q). Ism ustiga bosilsa
// /student-edit/[id] (mavjud profil) ga o'tadi — OrdersPage/OrderDetailPage
// bilan bir xil havola.

interface Row {
  order: Order;
  groupId: number;
  teacher: string;
  balance: number;
}

function genBalance(seed: number): number {
  return -(1_000_000 + ((seed * 137) % 6_000_000));
}

function buildRows(): Row[] {
  return createInitialOrders()
    .filter((o) => o.status === "Yangi")
    .map((o, i) => {
      const group = GROUP_SEED[(o.id + i) % GROUP_SEED.length];
      return { order: o, groupId: group.id, teacher: group.teacher, balance: genBalance(o.id) };
    });
}

function fmtUZS(n: number): string {
  return `${n.toLocaleString("ru-RU").replace(/,/g, " ")} UZS`;
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
const HEADERS = ["№", "ID", "O'quvchi ismi", "Telefon raqam", "Balans", "Guruh", "O'qituvchi", "Moderator"];

export default function NewStudentsPage() {
  const [rows] = useState<Row[]>(() => buildRows());
  const [filters, setFilters] = useState<OrdersFilters>(EMPTY_ORDERS_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const moreRef = useRef<HTMLDivElement>(null);

  const teacherOptions = useMemo(() => [...new Set(rows.map((r) => r.teacher).filter(Boolean))].sort(), [rows]);

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
    // "O'qituvchi" ustunida guruhning o'qituvchisi (r.teacher) ko'rsatiladi,
    // order.teacher emas (ko'p buyurtmalarda bo'sh) — shu sababli bu filtr
    // applyOrdersFilters'ga emas, to'g'ridan-to'g'ri r.teacher'ga qo'llanadi.
    const orders = applyOrdersFilters(rows.map((r) => r.order), { ...filters, teacher: "" });
    const ids = new Set(orders.map((o) => o.id));
    return rows.filter((r) => ids.has(r.order.id) && (!filters.teacher || r.teacher === filters.teacher));
  }, [rows, filters]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
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

  function exportRows() {
    return filtered.map((r, i) => [i + 1, r.order.id, r.order.name, r.order.phone, r.balance, r.groupId, r.teacher, r.order.moderator]);
  }
  function exportCSV() {
    const csv = [HEADERS, ...exportRows()].map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "yangi-oquvchilar.csv");
    setMoreOpen(false);
  }
  function exportExcel() {
    const head = "<tr>" + HEADERS.map((h) => `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`).join("") + "</tr>";
    const bodyRows = exportRows().map((r) => "<tr>" + r.map((v) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;">${v}</td>`).join("") + "</tr>").join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${head}</thead><tbody>${bodyRows}</tbody></table></body></html>`;
    downloadBlob(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), "yangi-oquvchilar.xls");
    setMoreOpen(false);
  }

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
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
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
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
                  <span>CSV faylini yuklab olish</span>
                </button>
                <button onClick={exportExcel} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                  <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">XLS</span>
                  <span>EXCEL faylini yuklab olish</span>
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
            <select value={filters.teacher} onChange={(e) => setFilter("teacher", e.target.value)} className={`${selectCls} w-44`}>
              <option value="">O&apos;qituvchi</option>
              {teacherOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
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
          <button
            onClick={() => setFilters(EMPTY_ORDERS_FILTERS)}
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
      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">ID</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;quvchi ismi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Telefon raqam</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Balans</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Guruh</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;qituvchi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Moderator</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Ilovani yuklab olish sanasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Shartnoma</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r, i) => (
                <tr key={r.order.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  <td className="px-3 py-3 tabular-nums text-[13px] text-muted-foreground">{r.order.id}</td>
                  <td className="px-3 py-3 text-[13px]">
                    <Link href={`/student-edit/${r.order.id}`} className="font-medium hover:text-primary hover:underline">
                      {r.order.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-[13px] tabular-nums whitespace-nowrap">{r.order.phone || "—"}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums whitespace-nowrap text-rose-600">{fmtUZS(r.balance)}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{r.groupId}</td>
                  <td className="px-3 py-3 text-[13px]">{r.teacher || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{r.order.moderator || "—"}</td>
                  <td className="px-3 py-3">
                    <X className="w-4 h-4 text-rose-500" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="inline-flex items-center gap-2 text-primary">
                      <MessageSquare className="w-4 h-4" />
                      <UsersIcon className="w-4 h-4" />
                    </div>
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">O&apos;quvchi topilmadi</td>
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
