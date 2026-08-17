"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Filter, FileSpreadsheet, FileText, MoreVertical, Settings, Share2, XCircle, Zap } from "lucide-react";
import * as XLSX from "xlsx";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import { SpinnerBlock } from "@/components/ui/Spinner";
import OrdersKanban from "@/components/orders/OrdersKanban";
import StagePickerPopover, { STAGE_COLORS } from "@/components/orders/StagePickerPopover";
import AddOrderModal, { type NewOrderValues } from "@/components/orders/AddOrderModal";
import OrderMessagePanel from "@/components/orders/OrderMessagePanel";
import { useOrders } from "@/components/orders/OrdersContext";
import { useToast } from "@/components/ui/Toast";
import {
  applyOrdersFilters,
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
import { Menu } from "lucide-react";

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

const FILTER_FIELDS: { key: string; label: string }[] = [
  { key: "search", label: "Qidiruv" },
  { key: "from", label: "Sana" },
  { key: "to", label: "Kelgan sana" },
  { key: "status1", label: "Holatlar" },
  { key: "course", label: "Kurs" },
  { key: "subcourse", label: "Ichki kurs" },
  { key: "group", label: "Guruh" },
  { key: "teacher", label: "O'qituvchi" },
  { key: "moderator", label: "Moderator" },
  { key: "status", label: "Status" },
  { key: "source", label: "Manba" },
  { key: "subsource", label: "Ichki manba" },
  { key: "fromBranch", label: "Qaysi filialdan o'tkazilgan" },
  { key: "toBranch", label: "Qaysi filialga o'tkazilgan" },
  { key: "day", label: "Kun" },
  { key: "survey", label: "So'rovnoma" },
  { key: "category", label: "Kategoriya" },
];
const DEFAULT_VISIBLE_FIELDS: Record<string, boolean> = Object.fromEntries(FILTER_FIELDS.map((f) => [f.key, true]));

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { orders, loading, createOrder, updateOrder, patchOrder, messagesByOrder, addMessage } = useOrders();
  const { showSuccess, showError } = useToast();
  const [layout, setLayout] = useState<Layout>(searchParams.get("layout") === "kanban" ? "kanban" : "list");
  const [filters, setFilters] = useState<OrdersFilters>(EMPTY_ORDERS_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [orderModal, setOrderModal] = useState<{ mode: "add" } | { mode: "edit"; order: Order } | null>(null);
  const [messageFor, setMessageFor] = useState<Order | null>(null);
  const [stagePickerFor, setStagePickerFor] = useState<number | null>(null);
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>(DEFAULT_VISIBLE_FIELDS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const toggleFieldVisible = (key: string) => setVisibleFields((v) => ({ ...v, [key]: !v[key] }));
  const resetVisibleFields = () => setVisibleFields(DEFAULT_VISIBLE_FIELDS);

  useEffect(() => {
    if (!settingsOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [settingsOpen]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportMenuOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [exportMenuOpen]);

  const setOrderStage = async (orderId: number, stage: OrderStageKey) => {
    setStagePickerFor(null);
    const updated = await patchOrder(orderId, { stage });
    if (updated) showSuccess("Bosqich o'zgartirildi");
    else showError("Bosqichni o'zgartirib bo'lmadi");
  };

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

  const handleDropStage = async (orderId: number, stage: OrderStageKey) => {
    const updated = await patchOrder(orderId, { stage });
    if (updated) showSuccess("Bosqich yangilandi");
    else showError("Bosqichni ko'chirib bo'lmadi");
  };

  const handleCreateOrder = async (values: NewOrderValues): Promise<boolean> => {
    const created = await createOrder(values);
    if (!created) {
      showError("Buyurtmani yaratib bo'lmadi. Qaytadan urinib ko'ring");
      return false;
    }
    setPage(1);
    showSuccess("Buyurtma yaratildi");
    return true;
  };

  const handleUpdateOrder = async (orderId: number, values: NewOrderValues): Promise<boolean> => {
    const updated = await updateOrder(orderId, values);
    if (!updated) {
      showError("Buyurtmani yangilab bo'lmadi. Qaytadan urinib ko'ring");
      return false;
    }
    showSuccess("Buyurtma yangilandi");
    return true;
  };

  const exportCsv = () => {
    try {
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
      showSuccess("CSV fayl yuklab olindi");
    } catch {
      showError("CSV faylni yuklab bo'lmadi");
    }
  };

  const exportExcel = () => {
    try {
      const cols: { key: keyof Order; label: string }[] = [
        { key: "id", label: "ID" },
        { key: "name", label: "O'quvchini ismi" },
        { key: "phone", label: "Telefon raqam" },
        { key: "created", label: "Yaratilgan sanasi" },
        { key: "firstLesson", label: "Birinchi dars kuni" },
        { key: "teacher", label: "O'qituvchi" },
        { key: "course", label: "Kurs" },
        { key: "moderator", label: "Moderator" },
        { key: "status", label: "Status" },
      ];
      const rows = filtered.map((o) => Object.fromEntries(cols.map((c) => [c.label, o[c.key] ?? ""])));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Buyurtmalar");
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `buyurtmalar-${date}.xlsx`);
      showSuccess("Excel fayl yuklab olindi");
    } catch {
      showError("Excel faylni yuklab bo'lmadi");
    }
  };

  return (
    <div className="container mx-auto flex h-full max-w-[1600px] flex-col p-4 md:p-5 space-y-4">
      <svg
        width="0"
        height="0"
        style={{ position: "absolute" }}
        aria-hidden="true"
      >
        <defs>
          <symbol id="i-share" viewBox="0 0 24 24">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </symbol>
          <symbol id="i-more-vertical" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </symbol>
          <symbol id="i-arrow-up-right" viewBox="0 0 24 24">
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </symbol>
          <symbol id="i-edit" viewBox="0 0 24 24">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </symbol>
        </defs>
      </svg>

      <div className="flex items-center flex-wrap gap-2 shrink-0">
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-border bg-card shrink-0">
          <button
            onClick={() => setLayout("list")}
            className={`h-8 px-2.5 rounded-md text-sm font-medium flex items-center gap-1.5 ${layout === "list" ? "bg-primary text-white" : "hover:bg-secondary text-muted-foreground"}`}
          >
            <Menu size={15} />
          </button>
          <button
            onClick={() => setLayout("kanban")}
            className={`h-8 px-2.5 rounded-md text-sm font-medium flex items-center gap-1.5 ${layout === "kanban" ? "bg-primary text-white" : "hover:bg-secondary text-muted-foreground"}`}
          >
            <svg className="icon icon-xs">
              <use href="#i-grid" />
            </svg>
          </button>
        </div>

        {/* Kanban ko'rinishida bosh sahifadagi Sozlash/Filtr/Eksport o'rniga bitta
            keng qidiruv maydoni ko'rsatiladi (production'dagi kabi) — ikkalasi
            ham bir xil filters.search state'ini boshqaradi. */}
        {layout === "kanban" ? (
          <div className="relative flex-1 min-w-[140px]">
            <svg className="icon icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <use href="#i-search" />
            </svg>
            <input
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              type="text"
              placeholder="Qidirish"
              className="w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex items-center gap-2 shrink-0">
          {layout === "list" && (
            <div className="relative" ref={settingsRef}>
              <Button
                variant="outline"
                lucideIcon={Settings}
                onClick={() => setSettingsOpen((o) => !o)}
                title="Sozlash"
              />
              {settingsOpen && (
                <div className="orders-settings-menu">
                  <div className="osm-header">Sozlash</div>
                  <div className="osm-list">
                    {FILTER_FIELDS.map((f) => (
                      <label key={f.key} className="osm-item">
                        <input
                          type="checkbox"
                          checked={visibleFields[f.key]}
                          onChange={() => toggleFieldVisible(f.key)}
                        />
                        <span>{f.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="osm-footer">
                    <button type="button" onClick={resetVisibleFields}>
                      Standartga qaytarish
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {layout === "list" && (
            <Button
              variant="outline"
              lucideIcon={Filter}
              onClick={() => setFiltersOpen((o) => !o)}
              title="Filtrlar"
            />
          )}
          <div className="relative" ref={exportRef}>
            <Button
              variant="outline"
              lucideIcon={layout === "list" ? Share2 : MoreVertical}
              onClick={() => setExportMenuOpen((o) => !o)}
              title={layout === "list" ? "Eksport" : "Ko'proq"}
            />
            {exportMenuOpen && (
              <div className="absolute top-full right-0 mt-2 z-50 w-64 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1">
                <button
                  type="button"
                  onClick={() => {
                    exportCsv();
                    setExportMenuOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <FileText className="icon icon-sm" />
                  </span>
                  <span>CSV faylini yuklab olish</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportExcel();
                    setExportMenuOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <FileSpreadsheet className="icon icon-sm" />
                  </span>
                  <span>EXCEL faylini yuklab olish</span>
                </button>
              </div>
            )}
          </div>

          <Button
            variant="primary"
            icon="i-file-plus"
            onClick={() => (layout === "list" ? setOrderModal({ mode: "add" }) : router.push("/orders-list/add"))}
          >
            {layout === "list" ? "Buyurtma qo'shish" : "Qo'shish"}
          </Button>
        </div>
      </div>

        <h1 className="text-xl font-semibold tracking-tight shrink-0">
          Buyurtmalar ro&apos;yxati
        </h1>
      <div
        id="orders-filter-bar"
        className={`shrink-0 space-y-2.5${filtersOpen ? "" : " collapsed"}`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {visibleFields.search && (
            <div className="relative">
              <svg className="icon icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                <use href="#i-search" />
              </svg>
              <input
                value={filters.search}
                onChange={(e) => setFilter("search", e.target.value)}
                type="text"
                placeholder="Qidiruv (ism, telefon, ID)"
                className="w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}
          {visibleFields.from && (
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilter("from", e.target.value)}
              title="Boshlanish sanasi"
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          )}
          {visibleFields.to && (
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilter("to", e.target.value)}
              title="Tugash sanasi"
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          )}
          {visibleFields.status1 && (
            <select
              value={filters.status1}
              onChange={(e) => setFilter("status1", e.target.value)}
              className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Holatlar</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {visibleFields.course && (
            <select
              value={filters.course}
              onChange={(e) => setFilter("course", e.target.value)}
              className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Kurs</option>
              {courseOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {visibleFields.subcourse && (
            <select
              value={filters.subcourse}
              onChange={(e) => setFilter("subcourse", e.target.value)}
              className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Ichki kurs</option>
              {SUBCOURSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {visibleFields.group && (
            <select
              value={filters.group}
              onChange={(e) => setFilter("group", e.target.value)}
              className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Guruh</option>
            </select>
          )}
          {visibleFields.teacher && (
            <select
              value={filters.teacher}
              onChange={(e) => setFilter("teacher", e.target.value)}
              className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">O&apos;qituvchi</option>
              {teacherOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
          {visibleFields.moderator && (
            <select
              value={filters.moderator}
              onChange={(e) => setFilter("moderator", e.target.value)}
              className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Moderator</option>
              {moderatorOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
          {visibleFields.status && (
            <select
              value={filters.status}
              onChange={(e) => setFilter("status", e.target.value)}
              className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Status</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {visibleFields.source && (
            <select
              value={filters.source}
              onChange={(e) => setFilter("source", e.target.value)}
              className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Manba</option>
              {sourceOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {visibleFields.subsource && (
            <select
              value={filters.subsource}
              onChange={(e) => setFilter("subsource", e.target.value)}
              className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Ichki manba</option>
              {SUBSOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {visibleFields.fromBranch && (
            <select
              value={filters.fromBranch}
              onChange={(e) => setFilter("fromBranch", e.target.value)}
              className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Qaysi filialdan o&apos;tkazilgan</option>
              {branchOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
          {visibleFields.toBranch && (
            <select
              value={filters.toBranch}
              onChange={(e) => setFilter("toBranch", e.target.value)}
              className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Qaysi filialga o&apos;tkazilgan</option>
              {branchOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
          {visibleFields.day && (
            <select
              value={filters.day}
              onChange={(e) => setFilter("day", e.target.value)}
              className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Kun</option>
              {WEEKDAY_NAMES.filter((d) => d !== "Yakshanba")
                .concat("Yakshanba")
                .map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
            </select>
          )}
          {visibleFields.survey && (
            <select
              value={filters.survey}
              onChange={(e) => setFilter("survey", e.target.value)}
              className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">So&apos;rovnoma</option>
              {SURVEYS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {visibleFields.category && (
            <select
              value={filters.category}
              onChange={(e) => setFilter("category", e.target.value)}
              className="filter-select w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Kategoriya</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end shrink-0">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">Umumiy soni:</span>
          <span className="font-bold tabular-nums">
            {filtered.length.toLocaleString("uz-UZ").replace(/,/g, " ")}
          </span>
        </div>
      </div>

      {layout === "list" ? (
        <div className="orders-table-wrap rounded-xl border border-border bg-card overflow-hidden shadow-sm flex flex-1 flex-col" style={{ minHeight: 0 }}>
          <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
            <table className="w-full text-sm">
              <thead
                className="sticky top-0 z-10"
                style={{ backgroundColor: "color-mix(in srgb, hsl(var(--secondary)) 40%, hsl(var(--card)))" }}
              >
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left px-3 py-3 whitespace-nowrap">№</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">ID</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">
                    O&apos;quvchini ismi
                  </th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">
                    Telefon raqam
                  </th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">
                    Yaratilgan sanasi
                  </th>
                  {/* Referensning buyurtmalar jadvalida "Birinchi dars guni"
                      ustuni yo'q — u faqat "Birinchi darsga keladiganlar"
                      sahifasida ko'rsatiladi. Maydonning o'zi (o.firstLesson)
                      saqlanib qoldi, faqat bu jadvalda chiqarilmaydi. */}
                  <th className="text-left px-3 py-3 whitespace-nowrap">
                    O&apos;qituvchi
                  </th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">
                    Kurs
                  </th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">
                    Kurs darajasi
                  </th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">
                    Moderator
                  </th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">
                    Izoh
                  </th>
                  <th className="text-right px-3 py-3 whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={12} className="px-3 py-6 text-center text-sm text-muted-foreground">
                      <SpinnerBlock size={22} />
                    </td>
                  </tr>
                )}
                {!loading && pageSlice.map((o, i) => (
                  <tr
                    key={o.id}
                    onClick={() => router.push(`/orders-list/${o.id}`)}
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">
                      {(currentPage - 1) * pageSize + i + 1}
                    </td>
                    <td className="px-3 py-3 tabular-nums font-medium text-[13px]">
                      {o.id}
                    </td>
                    <td className="px-3 py-3 text-[13px]">
                      <Link
                        href={`/student-edit/${o.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-foreground hover:text-primary hover:underline cursor-pointer"
                      >
                        {o.name}
                      </Link>
                      {o.isNew && (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-rose-500 text-white text-[9px] font-semibold px-1.5 py-0.5">
                          New
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStagePickerFor(
                            stagePickerFor === o.id ? null : o.id,
                          );
                        }}
                        className="rounded-md"
                      >
                        {o.phone ? (
                          <span
                            className="px-2 py-0.5 rounded-md text-xs font-medium tabular-nums text-white hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: STAGE_COLORS[o.stage] }}
                          >
                            {o.phone}
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-secondary/60 hover:bg-secondary">
                            <svg
                              className="icon"
                              style={{ width: 10, height: 10, opacity: 0.5 }}
                            >
                              <use href="#i-x-circle" />
                            </svg>
                          </span>
                        )}
                      </button>
                      {stagePickerFor === o.id && (
                        <StagePickerPopover
                          value={o.stage}
                          onChange={(stage) => setOrderStage(o.id, stage)}
                          onClose={() => setStagePickerFor(null)}
                        />
                      )}
                    </td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground whitespace-nowrap tabular-nums">
                      {o.created}
                    </td>
                    <td className="px-3 py-3 text-[13px]">
                      {o.teacher || "—"}
                    </td>
                    <td className="px-3 py-3 text-[13px]">{o.course || "—"}</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">
                      {o.level || "—"}
                    </td>
                    <td className="px-3 py-3 text-[13px]">
                      {o.moderator || "—"}
                    </td>
                    <td className="px-3 py-3 text-[12px] text-muted-foreground max-w-[180px] truncate">
                      {o.note}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          className="h-7 w-7 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground"
                          title="Tahrirlash"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrderModal({ mode: "edit", order: o });
                          }}
                        >
                          <svg className="icon icon-xs">
                            <use href="#i-edit" />
                          </svg>
                        </button>
                        <button
                          className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground"
                          title="Izoh"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMessageFor(o);
                          }}
                        >
                          <svg className="icon icon-xs">
                            <use href="#i-megaphone" />
                          </svg>
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
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        </div>
      ) : (
        <OrdersKanban orders={filtered} onDropStage={handleDropStage} />
      )}

      {orderModal && (
        <AddOrderModal
          initialOrder={orderModal.mode === "edit" ? orderModal.order : undefined}
          onClose={() => setOrderModal(null)}
          onSave={async (values) => {
            const ok =
              orderModal.mode === "edit"
                ? await handleUpdateOrder(orderModal.order.id, values)
                : await handleCreateOrder(values);
            if (ok) setOrderModal(null);
          }}
        />
      )}

      {messageFor && (
        <OrderMessagePanel
          order={messageFor}
          messages={messagesByOrder[messageFor.id] ?? []}
          onClose={() => setMessageFor(null)}
          onSend={(text) => {
            addMessage(messageFor.id, text);
            showSuccess("Izoh qo'shildi");
          }}
        />
      )}
    </div>
  );
}
