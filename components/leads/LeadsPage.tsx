"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ExternalLink, FileSpreadsheet, FileText, Link2, Plus, Settings, Share2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Link from "@/components/ui/Link";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import AddOrderModal, { type NewOrderValues } from "@/components/orders/AddOrderModal";
import OrderMessagePanel from "@/components/orders/OrderMessagePanel";
import { useOrders } from "@/components/orders/OrdersContext";
import { api } from "@/components/staff-tasks/api";
import { useAnimatedRows, useFlipRows } from "@/hooks/useAnimatedRows";
import { useBranches } from "@/hooks/useBranches";
import { useTeachers } from "@/hooks/useTeachers";
import type { Group } from "@/lib/groups";
import { HOLATLAR, sinovOf, type LeadHolat } from "@/lib/leadHolat";
import { SURVEY_SOURCE, type LeadSettings } from "@/lib/leadSettings";
import { orderNo, type Order } from "@/lib/ordersData";
import { DAY_MS, HOUR_MS, uzDateOf } from "@/lib/staffTasks";
import LeadDrawer from "./LeadDrawer";
import { GuruhModal, RadModal, SinovModal, postHolat } from "./LeadHolatModals";
import LeadReceiptModal, { type ReceiptRow } from "./LeadReceipt";
import { SANA_OPTIONS, buildRows, guruhText, inPeriod, levelText, sinovText, useLeadFmt, type LeadFmt, type LeadRow } from "./leadsCommon";

// LIDLAR (/orders-list) — foydalanuvchi prototipi «lidlar-tayyorlangan-ohiri»
// (23.09.2026). Eski «Buyurtmalar ro'yxati» (Kanban, bosqich chiplari) shu
// sahifaga almashdi — ma'lumot o'sha (`orders`, OrdersContext).
//
//   • Holat kartalari (5 ta) — bosilsa filtr, yana bosilsa olinadi. Sonlar
//     BOSHQA filtrlar bilan kesilgan ro'yxatdan (masalan "So'nggi 7 kun"
//     tanlansa — haftaning voronkasi).
//   • Filtrlar — ui/SearchInput va ui/Select; jadval har filtrda animatsiya
//     bilan qayta teriladi (hooks/useAnimatedRows).
//   • Qator bosilsa — o'ngdan lid kartasi (LeadDrawer); holat tugmalari
//     POST /api/orders/:id/holat ga (lib/leadHolatServer.ts), Telegram'dagi
//     xabar ham shu holatni ko'rsatadi.
//   • Ro'yxat har daqiqada yangilanadi — so'rovnomadan kelgan yangi lidlar
//     va Telegram tugmalari sahifani yangilamasdan ko'rinadi.

interface Filters {
  q: string;
  holat: LeadHolat | "";
  filial: string;
  yonalish: string;
  manba: string;
  sana: string;
}

const EMPTY: Filters = { q: "", holat: "", filial: "", yonalish: "", manba: "", sana: "" };

type HolatModal = { kind: "sinov" | "guruh" | "rad"; id: number };
type OrderModal = { mode: "add" } | { mode: "edit"; order: Order };

interface Props {
  /** `users.role === "admin"` — direktor: 10 daqiqadan keyin ham bekor qila oladi. */
  isAdmin: boolean;
  /** Sozlamalar → Sotuv va marketing ruxsati — «Lidlar» sozlamasiga havola. */
  canSettings: boolean;
}

export default function LeadsPage({ isAdmin, canSettings }: Props) {
  const fmt = useLeadFmt();
  const { t } = fmt;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showSuccess, showError } = useToast();
  const { orders, loading, createOrder, updateOrder, patchOrder, messagesByOrder, addMessage, replaceOrder, reload } = useOrders();
  const { branches } = useBranches();
  const { teachers } = useTeachers();

  const [settings, setSettings] = useState<LeadSettings | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const nowMs = clock;

  useEffect(() => {
    let off = false;
    api<{ settings: LeadSettings }>("/api/lead-settings").then((r) => {
      if (!off && r.ok) setSettings(r.settings);
    });
    return () => {
      off = true;
    };
  }, []);

  // Soat har 30 soniyada (bekor qilish muddati, "24 soatdan oshdi"), ro'yxat
  // har daqiqada — faqat sahifa ko'rinib turganda.
  useEffect(() => {
    const tick = window.setInterval(() => setClock(Date.now()), 30_000);
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 60_000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, [reload]);

  const [f, setF] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const set = (patch: Partial<Filters>) => {
    setF((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const [openId, setOpenId] = useState<number | null>(null);
  const [holatModal, setHolatModal] = useState<HolatModal | null>(null);
  const [busy, setBusy] = useState(false);
  const [orderModal, setOrderModal] = useState<OrderModal | null>(null);
  const [receiptFor, setReceiptFor] = useState<Order | null>(null);
  const [messageFor, setMessageFor] = useState<Order | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // "Yangi lid" oynasi manzildan ham ochiladi: /orders-list?add=1 (navbardagi
  // "+"). Parametr — oynaning holati; yopilganda manzildan olinadi.
  const addFromUrl = searchParams.get("add") === "1";
  const activeOrderModal: OrderModal | null = addFromUrl ? { mode: "add" } : orderModal;
  const closeOrderModal = () => {
    setOrderModal(null);
    if (addFromUrl) router.replace(pathname, { scroll: false });
  };

  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [exportOpen]);

  // ── Qatorlar ──
  const rows = useMemo(() => buildRows(orders, settings), [orders, settings]);
  const branchById = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);

  const base = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return rows.filter((r) => {
      if (q) {
        const byName = (r.o.name || "").toLowerCase().includes(q);
        const byPhone = qDigits.length >= 3 && (r.o.phone || "").replace(/\D/g, "").includes(qDigits);
        const byNo = /^#?\d+$/.test(q) && String(orderNo(r.o)) === q.replace("#", "");
        if (!byName && !byPhone && !byNo) return false;
      }
      if (f.filial && String(r.o.branchId ?? "") !== f.filial) return false;
      if (f.yonalish && r.yon !== f.yonalish) return false;
      if (f.manba && (r.o.source || "") !== f.manba) return false;
      return inPeriod(r.at, f.sana, nowMs);
    });
  }, [rows, f.q, f.filial, f.yonalish, f.manba, f.sana, nowMs]);

  const counts = useMemo(() => {
    const c: Record<LeadHolat, number> = { yangi: 0, bog: 0, sinov: 0, guruh: 0, rad: 0 };
    for (const r of base) c[r.holat]++;
    return c;
  }, [base]);

  const list = useMemo(() => (f.holat ? base.filter((r) => r.holat === f.holat) : base), [base, f.holat]);
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const slice = useMemo(() => list.slice((currentPage - 1) * pageSize, currentPage * pageSize), [list, currentPage, pageSize]);

  const signature = `${f.q}|${f.holat}|${f.filial}|${f.yonalish}|${f.manba}|${f.sana}|${currentPage}|${pageSize}`;
  const animated = useAnimatedRows(slice, (r) => r.o.id, signature);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const els = useRef(new Map<number, HTMLElement>());
  useFlipRows(animated, bodyRef, els);
  const nums = useMemo(() => {
    let n = (currentPage - 1) * pageSize;
    return animated.map((r) => (r.phase === "exit" ? 0 : ++n));
  }, [animated, currentPage, pageSize]);

  const anyFilter = Object.values(f).some(Boolean);

  // ── Filtr variantlari ──
  const branchOptions = useMemo(() => branches.map((b) => ({ value: String(b.id), label: b.name })), [branches]);
  const yonOptions = useMemo(() => (settings?.yonalishlar ?? []).map((y) => ({ value: y.id, label: t(y.nom) })), [settings, t]);
  const manbaOptions = useMemo(() => {
    const seen = new Set(orders.map((o) => (o.source || "").trim()).filter(Boolean));
    seen.delete(SURVEY_SOURCE);
    return [SURVEY_SOURCE, ...[...seen].sort((a, b) => a.localeCompare(b))].map((s) => ({ value: s, label: t(s) }));
  }, [orders, t]);
  const sanaOptions = useMemo(() => SANA_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) })), [t]);

  // ── Ochiq lid va amallar ──
  const openRow = openId !== null ? rows.find((r) => r.o.id === openId) ?? null : null;
  const modalRow = holatModal ? rows.find((r) => r.o.id === holatModal.id) ?? null : null;
  const branchName = (r: LeadRow | null) => (r && r.o.branchId !== undefined ? branchById.get(r.o.branchId)?.name ?? "" : "");

  const onConflict = useCallback(() => void reload(), [reload]);
  const onHolatDone = useCallback(
    (order: Order, message: string) => {
      replaceOrder(order);
      // Soat ham yangilansin — "Bekor qilish · N daq qoldi" to'g'ri sanalsin.
      setClock(Date.now());
      showSuccess(message);
    },
    [replaceOrder, showSuccess],
  );

  const loadGroups = useCallback(() => {
    if (groups !== null) return;
    api<{ groups: Group[] }>("/api/groups").then((r) => setGroups(r.ok ? r.groups : []));
  }, [groups]);

  const go = async (row: LeadRow, to: LeadHolat) => {
    if (to === "sinov" || to === "rad") return setHolatModal({ kind: to, id: row.o.id });
    if (to === "guruh") {
      loadGroups();
      return setHolatModal({ kind: "guruh", id: row.o.id });
    }
    setBusy(true);
    const r = await postHolat(row.o.id, { to });
    setBusy(false);
    if (!r.ok) {
      showError(r.error);
      if (/o'zgargan/.test(r.error)) onConflict();
      return;
    }
    onHolatDone(r.order, t("Holat: {holat}", { holat: fmt.holatNom(to) }));
  };

  const undo = async (row: LeadRow) => {
    setBusy(true);
    const r = await postHolat(row.o.id, { action: "undo" });
    setBusy(false);
    if (!r.ok) {
      showError(r.error);
      if (/o'zgargan/.test(r.error)) onConflict();
      return;
    }
    onHolatDone(r.order, t("Oldingi holatga qaytarildi"));
  };

  const saveNote = async (row: LeadRow, note: string): Promise<boolean> => {
    const updated = await patchOrder(row.o.id, { note });
    if (!updated) {
      showError(t("Izohni saqlab bo'lmadi"));
      return false;
    }
    showSuccess(t("Izoh saqlandi"));
    return true;
  };

  // ── Qo'shish / tahrirlash ──
  const saveOrder = async (values: NewOrderValues) => {
    if (!activeOrderModal) return;
    if (activeOrderModal.mode === "edit") {
      const updated = await updateOrder(activeOrderModal.order.id, values);
      if (!updated) return showError(t("Lidni yangilab bo'lmadi. Qaytadan urinib ko'ring"));
      showSuccess(t("Lid yangilandi"));
    } else {
      const created = await createOrder(values);
      if (!created) return showError(t("Lidni qo'shib bo'lmadi. Qaytadan urinib ko'ring"));
      setF(EMPTY);
      setPage(1);
      showSuccess(t("Lid qo'shildi"));
    }
    closeOrderModal();
  };

  // ── Eksport ──
  const exportCols = (r: LeadRow): [string, string][] => [
    ["ID", String(orderNo(r.o))],
    [t("Ism familiya"), r.o.name || ""],
    [t("Telefon"), r.o.phone || ""],
    [t("Kurs"), r.o.course || ""],
    [t("Daraja / sinf"), levelText(r.o, settings, fmt).text],
    [t("Filial"), branchName(r)],
    [t("Manba"), r.o.source || ""],
    [t("Qayerdan bildi"), r.o.heardFrom || ""],
    [t("Holat"), fmt.holatNom(r.holat)],
    [t("Kelgan vaqti"), r.o.created || ""],
    [t("Moderator"), r.o.moderator || ""],
    [t("Sinov darsi"), sinovText(r.o, fmt)],
    [t("Guruh"), guruhText(r.o)],
    [t("Rad sababi"), r.o.radSabab || ""],
    [t("Izoh"), r.o.note || ""],
  ];
  const fileDate = () => uzDateOf(Date.now());
  const exportCsv = () => {
    try {
      const data = list.map(exportCols);
      const head = (data[0] ?? exportCols({ o: {} as Order, holat: "yangi", at: NaN, yon: "", dupOf: null, dupCount: 1 })).map((c) => c[0]);
      const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
      const csv = [head.map(esc).join(","), ...data.map((cols) => cols.map((c) => esc(c[1])).join(","))].join("\n");
      const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `lidlar-${fileDate()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess(t("CSV fayl yuklab olindi"));
    } catch {
      showError(t("CSV faylni yuklab bo'lmadi"));
    }
  };
  const exportExcel = async () => {
    try {
      // xlsx (SheetJS) faqat bosilganda yuklanadi — sahifa to'plamiga kirmasin.
      const XLSX = await import("xlsx");
      const sheet = XLSX.utils.json_to_sheet(list.map((r) => Object.fromEntries(exportCols(r))));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Lidlar");
      XLSX.writeFile(book, `lidlar-${fileDate()}.xlsx`);
      showSuccess(t("Excel fayl yuklab olindi"));
    } catch {
      showError(t("Excel faylni yuklab bo'lmadi"));
    }
  };

  const copySurveyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/sorovnoma`);
      showSuccess(t("So'rovnoma havolasi nusxalandi"));
    } catch {
      showError(t("Havolani nusxalab bo'lmadi"));
    }
  };

  const loadingList = loading && orders.length === 0;

  return (
    <div className="ld-page container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <header className="ld-head">
        <div>
          <h1>{t("Lidlar")}</h1>
          <p>{t("Sayt so'rovnomasi, Instagram va qo'ng'iroqlardan kelgan barcha murojaatlar")}</p>
        </div>
        <div className="ld-fill" />
        <div className="ld-acts">
          <a href="/sorovnoma" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-secondary">
            <ExternalLink className="h-4 w-4" />
            <span className="ld-long">{t("So'rovnoma sahifasi")}</span>
            <span className="ld-short">{t("So'rovnoma")}</span>
          </a>
          <button type="button" className="ld-iconbtn" title={t("So'rovnoma havolasini nusxalash")} onClick={() => void copySurveyLink()}>
            <Link2 className="h-4 w-4" />
          </button>
          {canSettings && (
            <Link href="/settings-sales?tab=leads" className="ld-iconbtn" title={t("Lidlar sozlamalari")}>
              <Settings className="h-4 w-4" />
            </Link>
          )}
          <div className="relative" ref={exportRef}>
            <button type="button" className={`ld-iconbtn ${exportOpen ? "is-on" : ""}`} title={t("Eksport")} aria-expanded={exportOpen} onClick={() => setExportOpen((o) => !o)}>
              <Share2 className="h-4 w-4" />
            </button>
            {exportOpen && (
              <div className="ui-pop-in absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl">
                {[
                  { icon: FileText, label: t("CSV faylini yuklab olish"), run: exportCsv },
                  { icon: FileSpreadsheet, label: t("EXCEL faylini yuklab olish"), run: () => void exportExcel() },
                ].map((x) => (
                  <button
                    key={x.label}
                    type="button"
                    onClick={() => {
                      setExportOpen(false);
                      x.run();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-secondary"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <x.icon className="h-4 w-4" />
                    </span>
                    <span>{x.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button variant="primary" lucideIcon={Plus} onClick={() => setOrderModal({ mode: "add" })}>
            <span className="ld-long">{t("Lid qo'shish")}</span>
            <span className="ld-short">{t("Qo'shish")}</span>
          </Button>
        </div>
      </header>

      <div className="ld-kpis" role="group" aria-label={t("Holat bo'yicha filtr")}>
        {HOLATLAR.map((h) => {
          const on = f.holat === h.id;
          return (
            <button key={h.id} type="button" className={`ld-kpi ld-c-${h.tone} ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => set({ holat: on ? "" : h.id })}>
              <span className="ld-kpi-check" aria-hidden="true">
                <Check className="h-3 w-3" />
              </span>
              <b>{loadingList ? "—" : counts[h.id]}</b>
              <span>{t(h.nom)}</span>
            </button>
          );
        })}
      </div>

      <div className="ld-tools">
        <SearchInput className="ld-search" value={f.q} onChange={(q) => set({ q })} placeholder={t("Ism yoki telefon...")} />
        <Select size="sm" clearable value={f.filial} onChange={(v) => set({ filial: v })} options={branchOptions} placeholder={t("Barcha filiallar")} />
        <Select size="sm" clearable value={f.yonalish} onChange={(v) => set({ yonalish: v })} options={yonOptions} placeholder={t("Barcha yo'nalishlar")} />
        <Select size="sm" clearable value={f.manba} onChange={(v) => set({ manba: v })} options={manbaOptions} placeholder={t("Barcha manbalar")} />
        <Select size="sm" clearable value={f.sana} onChange={(v) => set({ sana: v })} options={sanaOptions} placeholder={t("Butun davr")} />
      </div>

      <div className="ld-fbar">
        <span>
          {anyFilter
            ? t("{shown} ta lid ko'rsatilmoqda (jami {total})", { shown: list.length, total: rows.length })
            : t("Jami {n} ta lid · eng yangisi tepada", { n: rows.length })}
        </span>
        {anyFilter && (
          <button type="button" className="ld-link" onClick={() => { setF(EMPTY); setPage(1); }}>
            {t("Filtrni tozalash")} ✕
          </button>
        )}
      </div>

      <div className="ld-card ld-list">
        <div className="ld-scroll">
          <table className="ld-tbl">
            <thead>
              <tr>
                <th className="c-n">№</th>
                <th>{t("O'quvchi")}</th>
                <th>{t("Kurs")}</th>
                <th>{t("Daraja / sinf")}</th>
                <th>{t("Filial")}</th>
                <th>{t("Manba")}</th>
                <th>{t("Holat")}</th>
                <th>{t("Kelgan vaqti")}</th>
                <th>{t("Moderator")}</th>
              </tr>
            </thead>
            <tbody ref={bodyRef}>
              {loadingList && (
                <tr className="ld-empty">
                  <td colSpan={9}>{t("Yuklanmoqda…")}</td>
                </tr>
              )}
              {animated.map((ar, i) => (
                <LeadTableRow
                  key={ar.key}
                  row={ar.item}
                  num={nums[i]}
                  phase={ar.phase}
                  order={ar.order}
                  branch={branchName(ar.item)}
                  settings={settings}
                  nowMs={nowMs}
                  fmt={fmt}
                  refFn={(el) => {
                    if (el) els.current.set(ar.key, el);
                    else els.current.delete(ar.key);
                  }}
                  onOpen={() => setOpenId(ar.item.o.id)}
                />
              ))}
              {!loadingList && animated.length === 0 && (
                <tr className="ld-empty ld-row-enter">
                  <td colSpan={9}>
                    {rows.length === 0 ? (
                      t("Hali lid yo'q. So'rovnoma havolasini reklamaga qo'ying yoki lidni qo'lda qo'shing.")
                    ) : (
                      <>
                        {t("Bu filtr bo'yicha lid topilmadi.")}{" "}
                        <button type="button" className="ld-link" onClick={() => { setF(EMPTY); setPage(1); }}>
                          {t("Filtrni tozalash")}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Boshqa ro'yxat sahifalaridagidek pastda doim turadi (qator soni tanlovi bilan). */}
        {list.length > 0 && (
          <div className="ld-pager">
            <Pagination
              totalItems={list.length}
              page={currentPage}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>

      {openRow && (
        <LeadDrawer
          row={openRow}
          settings={settings}
          branch={openRow.o.branchId !== undefined ? branchById.get(openRow.o.branchId) ?? null : null}
          isAdmin={isAdmin}
          nowMs={nowMs}
          fmt={fmt}
          busy={busy}
          locked={!!activeOrderModal || !!messageFor}
          commentsCount={messagesByOrder[openRow.o.id]?.length ?? 0}
          onClose={() => setOpenId(null)}
          onGo={(to) => void go(openRow, to)}
          onReschedule={() => setHolatModal({ kind: "sinov", id: openRow.o.id })}
          onUndo={() => void undo(openRow)}
          onSaveNote={(note) => saveNote(openRow, note)}
          onEdit={() => setOrderModal({ mode: "edit", order: openRow.o })}
          onReceipt={() => setReceiptFor(openRow.o)}
          onComments={() => setMessageFor(openRow.o)}
        />
      )}

      {holatModal && modalRow && holatModal.kind === "sinov" && (
        <SinovModal
          order={modalRow.o}
          branchName={branchName(modalRow)}
          nowMs={nowMs}
          fmt={fmt}
          teachers={teachers}
          onClose={() => setHolatModal(null)}
          onDone={onHolatDone}
          onConflict={onConflict}
        />
      )}
      {holatModal && modalRow && holatModal.kind === "guruh" && (
        <GuruhModal
          order={modalRow.o}
          branchName={branchName(modalRow)}
          nowMs={nowMs}
          fmt={fmt}
          groups={groups}
          onClose={() => setHolatModal(null)}
          onDone={onHolatDone}
          onConflict={onConflict}
        />
      )}
      {holatModal && modalRow && holatModal.kind === "rad" && (
        <RadModal
          order={modalRow.o}
          fmt={fmt}
          reasons={settings?.radSabablar ?? []}
          onClose={() => setHolatModal(null)}
          onDone={onHolatDone}
          onConflict={onConflict}
        />
      )}

      {activeOrderModal && (
        <AddOrderModal initialOrder={activeOrderModal.mode === "edit" ? activeOrderModal.order : undefined} onClose={closeOrderModal} onSave={saveOrder} />
      )}

      {messageFor && (
        <OrderMessagePanel
          title={messageFor.name}
          messages={messagesByOrder[messageFor.id] ?? []}
          onClose={() => setMessageFor(null)}
          onSend={async (text) => {
            if (await addMessage(messageFor.id, text)) showSuccess(t("Izoh qo'shildi"));
          }}
        />
      )}

      {receiptFor && (
        <LeadReceiptModal
          receipt={{
            docTitle: t("Lid #{n}", { n: orderNo(receiptFor) }),
            heading: t("LID"),
            rows: leadReceiptRows(receiptFor, rows.find((r) => r.o.id === receiptFor.id) ?? null, settings, fmt, branchById.get(receiptFor.branchId ?? -1)?.name ?? ""),
          }}
          onClose={() => setReceiptFor(null)}
        />
      )}
    </div>
  );
}

// ── Jadval qatori ─────────────────────────────────────────────────────────

interface RowProps {
  row: LeadRow;
  num: number;
  phase: "enter" | "idle" | "exit";
  order: number;
  branch: string;
  settings: LeadSettings | null;
  nowMs: number;
  fmt: LeadFmt;
  refFn: (el: HTMLTableRowElement | null) => void;
  onOpen: () => void;
}

function LeadTableRow({ row, num, phase, order, branch, settings, nowMs, fmt, refFn, onOpen }: RowProps) {
  const { t } = fmt;
  const o = row.o;
  const lvl = levelText(o, settings, fmt);
  const late = row.holat === "yangi" && Number.isFinite(row.at) && nowMs - row.at > 24 * HOUR_MS;
  let today = "";
  let soft = false;
  if (row.holat === "sinov") {
    const s = sinovOf(o);
    if (s && s.sana === uzDateOf(nowMs)) today = t("Bugun sinov · {time}", { time: s.vaqt || "—" });
    else if (s && s.sana === uzDateOf(nowMs + DAY_MS)) {
      today = t("Ertaga · {time}", { time: s.vaqt || "—" });
      soft = true;
    }
  }
  return (
    <tr
      ref={refFn}
      className={`ld-row ${phase === "enter" ? "ld-row-enter" : phase === "exit" ? "ld-row-exit" : ""}`}
      style={phase === "enter" ? ({ "--ld-delay": `${Math.min(order, 12) * 22}ms` } as CSSProperties) : undefined}
      tabIndex={phase === "exit" ? -1 : 0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <td className="c-n">{num || ""}</td>
      <td className="c-who">
        <b>
          {o.name || "—"}
          {row.dupCount > 1 && (
            <span className="ld-dup" title={row.dupOf !== null ? t("Takroriy raqam — avvalgi lid #{n}", { n: row.dupOf }) : t("Shu raqamdan keyinroq ham lid kelgan")}>
              {t("Takroriy")}
            </span>
          )}
        </b>
        <small>{o.phone || "—"}</small>
      </td>
      <td className="c-kurs">{o.course ? t(o.course) : "—"}</td>
      <td className="c-lvl">{lvl.text ? lvl.strong ? <b>{lvl.text}</b> : lvl.text : ""}</td>
      <td className="c-fil ld-nw">{branch || "—"}</td>
      <td className="c-src ld-nw">
        <span className="ld-src">{o.source ? t(o.source) : "—"}</span>
      </td>
      <td className="c-hol">
        <span className={`ld-pill ld-p-${row.holat}`}>{fmt.holatNom(row.holat)}</span>
        {today && <span className={`ld-today ${soft ? "soft" : ""}`}>{today}</span>}
        {late && <span className="ld-late">{t("24 soatdan oshdi")}</span>}
      </td>
      <td className="c-t ld-nw">{Number.isFinite(row.at) ? fmt.stamp(row.at, nowMs) : o.created || "—"}</td>
      <td className="c-mod ld-nw">{o.moderator || "—"}</td>
    </tr>
  );
}

/**
 * Lid chekidagi qatorlar. Bo'sh maydon "—" (qator tushib qolmaydi —
 * moderator qo'lda to'ldirishi mumkin), faqat izoh bo'lmasa yozilmaydi.
 * EMOJISIZ: 58mm chek printerlari emoji shriftini bilmaydi.
 */
function leadReceiptRows(o: Order, row: LeadRow | null, settings: LeadSettings | null, fmt: LeadFmt, branch: string): ReceiptRow[] {
  const rows: ReceiptRow[] = [
    ["ID", String(orderNo(o))],
    ["O'quvchi", o.name || "—"],
    ["Telefon", o.phone || "—"],
    ["Yaratilgan", o.created || "—"],
    ["Kurs", o.course || "—"],
    ["Daraja / sinf", levelText(o, settings, fmt).text || "—"],
    ["Filial", branch || "—"],
    ["Holat", row ? fmt.holatNom(row.holat) : "—"],
    ["Sinov darsi", sinovText(o, fmt) || "—"],
    ["Guruh", guruhText(o) || "—"],
    ["Moderator", o.moderator || "—"],
    ["Manba", o.source || "—"],
  ];
  if (o.note) rows.push(["Izoh", o.note]);
  return rows;
}
