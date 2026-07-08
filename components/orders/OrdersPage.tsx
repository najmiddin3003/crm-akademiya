"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import OrdersKanban from "@/components/orders/OrdersKanban";
import AddOrderModal, { type NewOrderValues } from "@/components/orders/AddOrderModal";
import {
  applyOrdersFilters,
  createInitialOrders,
  CATEGORIES,
  EMPTY_ORDERS_FILTERS,
  SUBCOURSES,
  SURVEYS,
  SUBSOURCES,
  WEEKDAY_NAMES,
  type Order,
  type OrderStageKey,
  type OrdersFilters,
} from "@/lib/ordersData";

// Ported from crm-akademiya/index-dev.html lines 880-1129 (id="view-orders-list")
// + src/app.js (applyOrdersFilters/renderOrdersList/renderOrdersKanban/openAddOrderModal
// family, ~lines 22910-24636).
// Scope cuts (disclosed, not bugs):
// - the "Sozlamalar" tab (custom order/student field manager) in the add-order
//   modal isn't ported.
// - the 3-dot menu's Import and "Ko'p tanlovli funksiya" actions are stubs
//   (close the menu, no-op) — everything else in that menu is wired.
// - the never-wired date-range popover + stray single date input from the
//   source are replaced with two functional date inputs (same treatment as
//   the Tasks page's date range).

type Layout = "list" | "kanban";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>(() => createInitialOrders());
  const [layout, setLayout] = useState<Layout>("list");
  const [filters, setFilters] = useState<OrdersFilters>(EMPTY_ORDERS_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const setFilter = <K extends keyof OrdersFilters>(key: K, value: OrdersFilters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const clearFilters = () => {
    setFilters(EMPTY_ORDERS_FILTERS);
    setPage(1);
  };

  const filtered = useMemo(() => applyOrdersFilters(orders, filters), [orders, filters]);

  const courseOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.course).filter(Boolean))).sort(), [orders]);
  const teacherOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.teacher).filter(Boolean))).sort(), [orders]);
  const moderatorOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.moderator).filter(Boolean))).sort(), [orders]);
  const statusOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.status).filter(Boolean))).sort(), [orders]);
  const sourceOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.source).filter(Boolean))).sort(), [orders]);
  const branchOptions = useMemo(
    () => Array.from(new Set(orders.flatMap((o) => [o.fromBranch, o.toBranch]).filter(Boolean))).sort(),
    [orders],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageSlice = filtered.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize);

  const handleDropStage = (orderId: number, stage: OrderStageKey) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, stage } : o)));
  };

  const handleSaveOrder = (values: NewOrderValues) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const created = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} | ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setOrders((prev) => {
      const maxId = prev.reduce((m, o) => Math.max(m, o.id), 0);
      const newOrder: Order = {
        id: maxId + 1,
        name: `${values.firstName} ${values.lastName}`.trim(),
        phone: values.phone,
        course: values.course,
        teacher: values.teacher,
        moderator: values.moderator,
        note: values.note,
        created,
        firstLesson: "",
        level: "",
        group: "",
        isNew: true,
        stage: values.stage,
        dayPattern: "Juft kunlar",
        taskStatus: "Topshiriq yo'q",
        status: "Yangi",
        source: "Sayt",
        subsource: "",
        fromBranch: "",
        toBranch: "",
        category: "",
        survey: "",
        subcourse: "",
      };
      return [newOrder, ...prev];
    });
    setAddModalOpen(false);
    setPage(1);
  };

  const exportCsv = () => {
    const cols: (keyof Order)[] = ["id", "name", "phone", "created", "firstLesson", "teacher", "course", "moderator", "status"];
    const rows = [cols.join(","), ...filtered.map((o) => cols.map((c) => `"${String(o[c] ?? "").replace(/"/g, '""')}"`).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `buyurtmalar-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <symbol id="i-share" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></symbol>
          <symbol id="i-more-vertical" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></symbol>
          <symbol id="i-arrow-up-right" viewBox="0 0 24 24"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></symbol>
          <symbol id="i-edit" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></symbol>
        </defs>
      </svg>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Buyurtmalar ro&apos;yxati</h1>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-border bg-card">
            <button onClick={() => setLayout("list")} className={`h-8 px-2.5 rounded-md text-sm font-medium flex items-center gap-1.5 ${layout === "list" ? "bg-primary text-white" : "hover:bg-secondary text-muted-foreground"}`}>
              <svg className="icon icon-xs"><use href="#i-list" /></svg>
            </button>
            <button onClick={() => setLayout("kanban")} className={`h-8 px-2.5 rounded-md text-sm font-medium flex items-center gap-1.5 ${layout === "kanban" ? "bg-primary text-white" : "hover:bg-secondary text-muted-foreground"}`}>
              <svg className="icon icon-xs"><use href="#i-grid" /></svg>
            </button>
          </div>
          <Button variant="outline" icon="i-filter" onClick={() => setFiltersOpen((o) => !o)} title="Filtrlar" />
          <Button variant="outline" icon="i-x-circle" onClick={clearFilters} title="Filtrlarni tozalash" />
          <Button variant="outline" icon="i-share" onClick={exportCsv} title="Eksport (CSV)" />
          <Button variant="outline" icon="i-zap" onClick={() => setPage(1)} title="Yangilash" />
          <div className="relative">
            <Button variant="outline" icon="i-more-vertical" onClick={() => setMoreMenuOpen((o) => !o)} title="Boshqa" />
            {moreMenuOpen && (
              <div className="orders-more-menu">
                <button className="ommi" onClick={() => setMoreMenuOpen(false)}>
                  <svg className="icon icon-sm"><use href="#i-arrow-up-right" /></svg><span>Import</span>
                </button>
                <button className="ommi" onClick={() => { exportCsv(); setMoreMenuOpen(false); }}>
                  <svg className="icon icon-sm"><use href="#i-share" /></svg><span>Export</span>
                </button>
                <button className="ommi" onClick={() => { setLayout("list"); setMoreMenuOpen(false); }}>
                  <svg className="icon icon-sm"><use href="#i-list-todo" /></svg><span>Lidlar ko&apos;rinishi</span>
                </button>
                <button className="ommi" onClick={() => { setLayout("kanban"); setMoreMenuOpen(false); }}>
                  <svg className="icon icon-sm"><use href="#i-grid" /></svg><span>Ustunlar ko&apos;rinishi</span>
                </button>
                <button className="ommi" onClick={() => setMoreMenuOpen(false)}>
                  <svg className="icon icon-sm"><use href="#i-check-circle" /></svg><span>Ko&apos;p tanlovli funksiya</span>
                </button>
              </div>
            )}
          </div>
          <Button variant="primary" icon="i-file-plus" onClick={() => setAddModalOpen(true)}>
            Buyurtma qo&apos;shish
          </Button>
        </div>
      </div>

      {filtersOpen && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="relative">
              <svg className="icon icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><use href="#i-search" /></svg>
              <input
                value={filters.search}
                onChange={(e) => setFilter("search", e.target.value)}
                type="text"
                placeholder="Qidiruv (ism, telefon, ID)"
                className="w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <input type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} title="Boshlanish sanasi" className="h-9 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <input type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} title="Tugash sanasi" className="h-9 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <select value={filters.status1} onChange={(e) => setFilter("status1", e.target.value)} className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Holatlar</option>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <select value={filters.course} onChange={(e) => setFilter("course", e.target.value)} className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Kurs</option>
              {courseOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filters.subcourse} onChange={(e) => setFilter("subcourse", e.target.value)} className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Ichki kurs</option>
              {SUBCOURSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.group} onChange={(e) => setFilter("group", e.target.value)} className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Guruh</option>
            </select>
            <select value={filters.teacher} onChange={(e) => setFilter("teacher", e.target.value)} className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">O&apos;qituvchi</option>
              {teacherOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <select value={filters.moderator} onChange={(e) => setFilter("moderator", e.target.value)} className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Moderator</option>
              {moderatorOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Status</option>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.source} onChange={(e) => setFilter("source", e.target.value)} className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Manba</option>
              {sourceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.subsource} onChange={(e) => setFilter("subsource", e.target.value)} className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Ichki manba</option>
              {SUBSOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <select value={filters.fromBranch} onChange={(e) => setFilter("fromBranch", e.target.value)} className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Qaysi filialdan o&apos;tkazilgan</option>
              {branchOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={filters.toBranch} onChange={(e) => setFilter("toBranch", e.target.value)} className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Qaysi filialga o&apos;tkazilgan</option>
              {branchOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={filters.day} onChange={(e) => setFilter("day", e.target.value)} className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Kun</option>
              {WEEKDAY_NAMES.filter((d) => d !== "Yakshanba").concat("Yakshanba").map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={filters.survey} onChange={(e) => setFilter("survey", e.target.value)} className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">So&apos;rovnoma</option>
              {SURVEYS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <select value={filters.category} onChange={(e) => setFilter("category", e.target.value)} className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Kategoriya</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">Umumiy soni:</span>
          <span className="font-bold tabular-nums">{filtered.length.toLocaleString("uz-UZ").replace(/,/g, " ")}</span>
        </div>
      </div>

      {layout === "list" ? (
        <div className="orders-table-wrap rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left px-3 py-3 whitespace-nowrap">№</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">ID</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;quvchini ismi</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">Telefon raqam</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">Yaratilgan sanasi</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">Birinchi dars guni</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;qituvchi</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">Kurs</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">Kurs darajasi</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">Moderator</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">Izoh</th>
                  <th className="text-right px-3 py-3 whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody>
                {pageSlice.map((o, i) => (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{(currentPage - 1) * pageSize + i + 1}</td>
                    <td className="px-3 py-3 tabular-nums font-medium text-[13px]">{o.id}</td>
                    <td className="px-3 py-3 text-[13px]">
                      <a className="text-foreground hover:text-primary hover:underline cursor-pointer">{o.name}</a>
                      {o.isNew && <span className="ml-1.5 inline-flex items-center rounded-full bg-rose-500 text-white text-[9px] font-semibold px-1.5 py-0.5">New</span>}
                    </td>
                    <td className="px-3 py-3">
                      {o.phone ? (
                        <span className="px-2 py-0.5 rounded-md bg-secondary/60 text-xs font-medium tabular-nums">{o.phone}</span>
                      ) : (
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-secondary/60">
                          <svg className="icon" style={{ width: 10, height: 10, opacity: 0.5 }}><use href="#i-x-circle" /></svg>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground whitespace-nowrap tabular-nums">{o.created}</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground whitespace-nowrap tabular-nums">{o.firstLesson || "—"}</td>
                    <td className="px-3 py-3 text-[13px]">{o.teacher || "—"}</td>
                    <td className="px-3 py-3 text-[13px]">{o.course || "—"}</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">{o.level || "—"}</td>
                    <td className="px-3 py-3 text-[13px]">{o.moderator || "—"}</td>
                    <td className="px-3 py-3 text-[12px] text-muted-foreground max-w-[180px] truncate">{o.note}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button className="h-7 w-7 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground" title="Tahrirlash">
                          <svg className="icon icon-xs"><use href="#i-edit" /></svg>
                        </button>
                        <button className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground" title="Izoh">
                          <svg className="icon icon-xs"><use href="#i-megaphone" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            totalItems={filtered.length}
            page={currentPage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </div>
      ) : (
        <OrdersKanban orders={filtered} onDropStage={handleDropStage} />
      )}

      {addModalOpen && <AddOrderModal onClose={() => setAddModalOpen(false)} onSave={handleSaveOrder} />}
    </div>
  );
}
