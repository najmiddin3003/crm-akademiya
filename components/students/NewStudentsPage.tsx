"use client";

import { loadBalancesCached } from "@/lib/balancesClient";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/ui/Link";
import { Filter, MoreVertical, X } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { SpinnerBlock } from "@/components/ui/Spinner";
import {
  applyOrdersFilters,
  EMPTY_ORDERS_FILTERS,
  type Order,
  type OrdersFilters,
 orderNo,
} from "@/lib/ordersData";
import { findPupilForOrder } from "@/lib/enrollStudent";
import type { PupilListItem } from "@/lib/pupilsData";
import { loadPupilsCached } from "@/hooks/useStudents";
import Select from "@/components/ui/Select";

// O'quvchilar → Yangi o'quvchilar (crm-akademiya #view-new-students, sidebar:
// O'quvchilar > Yangi o'quvchilar, href /new-students).
//
// MANBA: HAQIQIY buyurtmalar — /api/orders (MongoDB `orders`), status "Yangi".
// "Yangi" — bazaga chindan yoziladigan qiymat: lib/ordersData.ts dagi
// buildOrderFromValues() har bir yangi buyurtmaga status: "Yangi" beradi
// (POST /api/orders).
//
// Ilgari bu sahifa createInitialOrders() — 502 ta SOXTA yozuv generatori —
// ustidan filtrlar edi, Guruh/O'qituvchi ustunlarini GROUP_SEED dan indeks
// bo'yicha biriktirar, Balansni esa genBalance(id) bilan "o'ylab topar" edi.
// Ya'ni ro'yxatda haqiqiy lidlar umuman ko'rinmasdi va har bir raqam yolg'on
// edi. Endi hamma ustun buyurtmaning o'z maydonidan yoki haqiqiy balans
// API'sidan keladi; ma'lumot yo'q joyda "—" turadi.
//
// Bu sahifa OrdersProvider ICHIDA emas (provider faqat /orders-list segmentiga
// o'ralgan — app/(app)/orders-list/layout.tsx; app/(app)/new-students/page.tsx
// esa uni ishlatmaydi), shuning uchun /api/orders shu yerda to'g'ridan-to'g'ri
// o'qiladi. Yagona sahifa uchun butun (app) guruhiga provider qo'shish ortiqcha
// bo'lardi.
//
// Ism ustidagi havola o'quvchi profiliga olib boradi, lekin buyurtma id'si
// bilan EMAS: buyurtmalar va o'quvchilar id'lari alohida ketma-ketliklar va
// ikkalasi ham 1 dan boshlanadi, ya'ni /student-edit/<buyurtma id> boshqa
// odamni ochib yuborardi. O'quvchi findPupilForOrder() bilan telefon/ism
// bo'yicha topiladi, topilmasa buyurtma detali ochiladi
// (FirstLessonsPage dagi bilan bir xil qoida).

interface Row {
  order: Order;
  /**
   * Guruh ustuni uchun ko'rsatiladigan qiymat. Buyurtmada ikkita bog'liq
   * maydon bor: `group` — formada tanlangan "yig'ilayotgan guruh" nomi,
   * `groupId` — o'quvchi HAQIQATDA qo'shilgan guruh id'si. Nomi ustunroq,
   * chunki u ko'proq ma'lumot beradi; ikkalasi ham bo'sh bo'lsa "—".
   */
  group: string;
  /** Haqiqiy balans — /api/students/balances (transaction_entries, payIn). */
  balance: number;
}

function fmtUZS(n: number): string {
  return `${n.toLocaleString("ru-RU").replace(/,/g, " ")} UZS`;
}

/** Balans kaliti — CashboxKirimDrawer bilan bir xil: kichik harf + trim. */
function balanceKey(name: string): string {
  return String(name ?? "").trim().toLowerCase();
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

const HEADERS = ["№", "ID", "O'quvchi ismi", "Telefon raqam", "Balans", "Guruh", "O'qituvchi", "Moderator"];

export default function NewStudentsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  // Buyurtma id'si bilan o'quvchi id'si BOSHQA-BOSHQA ketma-ketliklar —
  // ikkalasi ham 1 dan boshlanadi. Shuning uchun ism ustidagi havolani
  // buyurtma id'si bilan yasab bo'lmaydi: u boshqa odamning profilini
  // ochib yuborardi. O'quvchi telefon/ism bo'yicha topiladi.
  const [pupils, setPupils] = useState<PupilListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<OrdersFilters>(EMPTY_ORDERS_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const moreRef = useRef<HTMLDivElement>(null);

  // Ikkala so'rov birga kutiladi: balanslar kechikib kelsa jadval avval
  // "0 UZS" ni ko'rsatib, keyin sakrab o'zgarardi.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/orders").then((r) => r.json()).catch(() => null),
      loadBalancesCached().then((balances) => ({ ok: true, balances })).catch(() => null),
      loadPupilsCached(true).then((pupils) => ({ ok: true, pupils })).catch(() => null),
    ])
      .then(([o, b, p]) => {
        if (cancelled) return;
        if (o?.ok) setOrders(o.orders as Order[]);
        if (b?.ok) setBalances(b.balances as Record<string, number>);
        if (p?.ok) setPupils(p.pupils);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Ism ustidagi havola — o'quvchi bazada topilsa uning profili, aks holda
   * buyurtma detali (FirstLessonsPage dagi bilan bir xil qoida).
   */
  const profileHref = (o: Order): string => {
    const pupil = findPupilForOrder(o, pupils);
    return pupil ? `/student-edit/${pupil.id}?src=list` : `/orders-list/${o.id}`;
  };

  const rows = useMemo<Row[]>(
    () =>
      orders
        // Sahifaning butun mazmuni shu shart: hali guruhga joylashtirilmagan,
        // yangi kelgan lidlar.
        .filter((o) => o.status === "Yangi")
        .map((o) => ({
          order: o,
          group: o.group || (o.groupId ? String(o.groupId) : ""),
          // Buyurtmada o'quvchi id'si yo'q, faqat ism bor — balans API'si ham
          // aynan ism bo'yicha kalitlangan, shuning uchun mos tushadi.
          balance: balances[balanceKey(o.name)] ?? 0,
        })),
    [orders, balances],
  );

  // Filtr ro'yxatlari buyurtmalarning O'ZIDAN yig'iladi. Ilgari bu yerda
  // MODERATORS/COURSES qattiq yozilgan konstantalari ishlatilardi — ular
  // bazadagi haqiqiy qiymatlar bilan mos kelmagani uchun tanlangan variant
  // ko'pincha hech nima topmasdi.
  const teacherOptions = useMemo(
    () => [...new Set(rows.map((r) => r.order.teacher).filter(Boolean))].sort(),
    [rows],
  );
  const moderatorOptions = useMemo(
    () => [...new Set(rows.map((r) => r.order.moderator).filter(Boolean))].sort(),
    [rows],
  );
  const courseOptions = useMemo(
    () => [...new Set(rows.map((r) => r.order.course).filter(Boolean))].sort(),
    [rows],
  );

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
    // Endi "O'qituvchi" ustuni buyurtmaning o'z `teacher` maydoni, shuning
    // uchun filtr to'liq applyOrdersFilters'ga topshiriladi. Ilgari o'qituvchi
    // GROUP_SEED'dan kelgani sababli bu filtr qo'lda, alohida qo'llanardi.
    const ids = new Set(applyOrdersFilters(rows.map((r) => r.order), filters).map((o) => o.id));
    return rows.filter((r) => ids.has(r.order.id));
  }, [rows, filters]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  // Qarzdor/Haqdor — faqat haqiqiy balanslar yig'indisi. DIQQAT: balans API'si
  // TO'LANGAN pulni sanaydi (app/api/students/balances/route.ts izohiga q.),
  // tizimda "to'lashi kerak" summasi yuritilmaydi — shuning uchun Qarzdor
  // odatda 0 chiqadi va bu qiymat o'ylab topilmaydi.
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
    return filtered.map((r, i) => [
      i + 1,
      r.order.id,
      r.order.name,
      r.order.phone,
      r.balance,
      r.group,
      r.order.teacher,
      r.order.moderator,
    ]);
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
          <Select value={filters.teacher} onChange={(v) => setFilter("teacher", v)} options={teacherOptions.map((t) => ({ value: t, label: t }))} placeholder="O'qituvchi" clearable size="sm" className="w-44" />
          <Select value={filters.moderator} onChange={(v) => setFilter("moderator", v)} options={moderatorOptions.map((m) => ({ value: m, label: m }))} placeholder="Moderator" clearable size="sm" className="w-44" />
          <Select value={filters.course} onChange={(v) => setFilter("course", v)} options={courseOptions.map((c) => ({ value: c, label: c }))} placeholder="Kurs" clearable size="sm" className="w-36" />
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
                  <td className="px-3 py-3 tabular-nums text-[13px] text-muted-foreground">{orderNo(r.order)}</td>
                  <td className="px-3 py-3 text-[13px]">
                    <Link href={profileHref(r.order)} className="font-medium hover:text-primary hover:underline">
                      {r.order.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-[13px] tabular-nums whitespace-nowrap">{r.order.phone || "—"}</td>
                  {/* Rang balansning ishorasiga qarab: manfiy — qarz (rose),
                      musbat — haqdor (emerald), 0 — betaraf. Ilgari hamma
                      qator rose edi, chunki soxta balans doim manfiy edi. */}
                  <td
                    className={`px-3 py-3 text-[13px] tabular-nums whitespace-nowrap ${
                      r.balance < 0 ? "text-rose-600" : r.balance > 0 ? "text-emerald-600" : "text-muted-foreground"
                    }`}
                  >
                    {fmtUZS(r.balance)}
                  </td>
                  <td className="px-3 py-3 text-[13px]">{r.group || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{r.order.teacher || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{r.order.moderator || "—"}</td>
                  {/* Ilovani yuklab olish sanasi: mobil ilova hali ulanmagan,
                      Order'da ham, bazada ham bunday maydon yo'q — "—". */}
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                  {/* Shartnoma alohida to'plamda saqlanadi
                      (/api/finance-contracts, studentOrderId → Order.id) va bu
                      sahifada o'qilmaydi, shu bois qiymat o'ylab topilmaydi. */}
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {loading ? <SpinnerBlock size={22} /> : "O'quvchi topilmadi"}
                  </td>
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
