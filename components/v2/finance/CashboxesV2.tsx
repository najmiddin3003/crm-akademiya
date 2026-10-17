"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { ChartColumn, Download, FileText, Plus, Wallet, X } from "lucide-react";
import { useLang, useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import type { DateRange } from "@/components/ui/DateRangePicker";
import CashboxAdjustDrawer from "@/components/finance/CashboxAdjustDrawer";
import CashboxDividendDrawer from "@/components/finance/CashboxDividendDrawer";
import CashboxDrawer from "@/components/finance/CashboxDrawer";
import CashboxInvestmentDrawer from "@/components/finance/CashboxInvestmentDrawer";
import CashboxKirimDrawer from "@/components/finance/CashboxKirimDrawer";
import CashboxTransferDrawer from "@/components/finance/CashboxTransferDrawer";
import CashboxTransferToDrawer from "@/components/finance/CashboxTransferToDrawer";
import EditHistoryModal from "@/components/finance/EditHistoryModal";
import HandoverModal from "@/components/finance/HandoverModal";
import TransactionDetailDrawer from "@/components/finance/TransactionDetailDrawer";
import { printReceipt, ReceiptPreviewModal } from "@/components/finance/cashReceipt";
import { useCanOpen } from "@/components/v2/shell/ShellContext";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import { rangeLabel } from "@/components/v2/ui/V2DateRange";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useStudents } from "@/hooks/useStudents";
import { useTeachers } from "@/hooks/useTeachers";
import { useTransactionTypes } from "@/hooks/useTransactionTypes";
import { downloadEntriesCsv, downloadEntriesXlsx, entryExportCols } from "@/lib/cashEntriesExport";
import type { Cashbox } from "@/lib/cashboxes";
import type { HrEmployee } from "@/lib/hrEmployees";
import type { TransactionEntry } from "@/lib/transactionEntries";
import CashboxCardV2 from "./CashboxCardV2";
import CashTransactionsV2 from "./CashTransactionsV2";
import { useHiddenBalances } from "./hiddenBalances";

// YANGI VERSIYA — MOLIYA → KASSALAR (rasm «Kassalar», yorug'/qorong'i, 18.10.2026;
// andoza — design/v2/DESIGN.md → «Kassalar»).
//
//   sarlavha: «Kassalar» + «N ta filial kassasi · bosh kassa»; «Umumiy hisobot»
//             (kassalar qoldig'i, faqat admin), «+ Yangi kassa» (faqat admin);
//   chapda:   Aktiv / Arxiv / Barchasi va kassa kartochkalari (./CashboxCardV2);
//   o'ngda:   «Tranzaksiyalar» — BARCHA kassalar bo'yicha (./CashTransactionsV2),
//             kartochka bosilsa shu kassaga toraytiriladi.
//
// Hamma amal va oyna — ESKI sahifadagi (components/finance/*: Kirim, Chiqim,
// Ko'chirish, Dividend, Sarmoya, kassa tahriri, kunlik topshiruv, tranzaksiya
// oynasi, chek). Ma'lumot o'sha API'lardan: GET /api/cashboxes (xodimga faqat
// o'z kassasi), /api/transaction-entries. Rasmda bosh kassa ro'yxatda yo'q
// («Rahbar panelida») — Rahbar paneli hali yo'q, shu bois u shu yerda, eng
// tepada (design/v2/SAVOLLAR.md, 51–60).

const METHOD_ORDER_KEY = "financeCashMethodOrder"; // eski sahifa bilan bir xil

function subscribeStorage(cb: () => void): () => void {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}
function readMethodOrder(): string {
  try {
    return localStorage.getItem(METHOD_ORDER_KEY) ?? "";
  } catch {
    return "";
  }
}

function todayRange(): DateRange {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return { start, end: start };
}
function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function fmtPlain(n: number): string {
  return Math.round(n).toString();
}

type Tab = "active" | "archived" | "all";

export default function CashboxesV2() {
  const { t } = useT();
  const [lang] = useLang();
  const { showSuccess, showError } = useToast();
  // Kassani BOSHQARISH (yangi kassa, tahrirlash, bosh kassa, hisobot) — faqat admin
  // (eski sahifa qoidasi; haqiqiy himoya serverda).
  const { isAdmin } = useBranch();
  const canReports = useCanOpen("/finance-reports");
  const hiddenStore = useHiddenBalances();

  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("active");
  const [cashboxFilter, setCashboxFilter] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(() => todayRange());
  const [reloadKey, setReloadKey] = useState(0);
  const bump = () => setReloadKey((k) => k + 1);

  // O'QUVCHIDAN TO'LOV — eski sahifadagidek: O'quvchilar → tezkor panel →
  // «To'lov qabul qilish» shu sahifani `?kirim=<pupils.id>` bilan ochadi.
  const kirimParam = useSearchParams().get("kirim");
  const [presetPupil, setPresetPupil] = useState<number | null>(() => {
    const n = Number(kirimParam);
    return Number.isInteger(n) && n > 0 ? n : null;
  });
  const presetAtLoad = useRef(presetPupil);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Cashbox | null>(null);
  const [transferState, setTransferState] = useState<{ cashbox: Cashbox; from: string } | null>(null);
  const [transferToTarget, setTransferToTarget] = useState<Cashbox | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<Cashbox | null>(null);
  const [kirimTarget, setKirimTarget] = useState<Cashbox | null>(null);
  const [dividendTarget, setDividendTarget] = useState<Cashbox | null>(null);
  const [investmentTarget, setInvestmentTarget] = useState<Cashbox | null>(null);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [primaryTarget, setPrimaryTarget] = useState<Cashbox | null>(null);
  const [settingPrimary, setSettingPrimary] = useState(false);
  const [detailEntry, setDetailEntry] = useState<TransactionEntry | null>(null);
  const [historyEntry, setHistoryEntry] = useState<TransactionEntry | null>(null);
  const [receiptEntry, setReceiptEntry] = useState<TransactionEntry | null>(null);
  const [decidingId, setDecidingId] = useState<number | null>(null);

  const { methods: paymentMethods } = usePaymentMethods();
  const { names: dbTeachers } = useTeachers();
  const { names: txTypeNames } = useTransactionTypes();
  // O'quvchilar — Kirim/Chiqim oynalariga (id bilan, ismdoshlar ajralsin) va
  // jadvaldagi ismni profilga bog'lash uchun; yengil rejim (eski sahifadagidek).
  const { students: dbStudentRows, byName: studentByName, loading: studentsLoading, refresh: refreshStudents, refreshing: studentsRefreshing } = useStudents({ light: true });
  const studentIdByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const [key, s] of studentByName) map.set(key, s.id);
    return map;
  }, [studentByName]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const employeeIdByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of employees) {
      const key = e.name.trim().toLowerCase();
      if (!map.has(key)) map.set(key, e.id);
    }
    return map;
  }, [employees]);

  // To'lov turlari — eski sahifada foydalanuvchi surib qo'ygan tartibda.
  const orderRaw = useSyncExternalStore(subscribeStorage, readMethodOrder, () => "");
  const orderedMethods = useMemo(() => {
    let saved: string[] = [];
    try {
      saved = orderRaw ? (JSON.parse(orderRaw) as string[]) : [];
    } catch {
      saved = [];
    }
    const known = new Set(paymentMethods.map((m) => m.key));
    const kept = saved.filter((k) => known.has(k));
    const rest = paymentMethods.map((m) => m.key).filter((k) => !kept.includes(k));
    return [...kept, ...rest].map((k) => paymentMethods.find((m) => m.key === k)!).filter(Boolean);
  }, [orderRaw, paymentMethods]);

  function refreshCashboxes() {
    fetch("/api/cashboxes")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setCashboxes(d.cashboxes);
      });
  }
  /** Yozuv route'i qaytargan kassa — USTIGA qo'yiladi (kartochka statistikasi faqat GET da; eski sahifa izohi). */
  function patchCashbox(next: Cashbox) {
    setCashboxes((prev) => prev.map((x) => (x.id === next.id ? { ...x, ...next } : x)));
  }
  /** Pul amali saqlangach: kartochka, jadval va yig'indilar. */
  function afterMoney(c?: Cashbox) {
    if (c) patchCashbox(c);
    bump();
    refreshCashboxes();
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cashboxes")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        setCashboxes(d.cashboxes);
        if (presetAtLoad.current !== null) {
          // Manzildan olib tashlanadi — sahifa yangilansa oyna qayta ochilmasin.
          window.history.replaceState(null, "", window.location.pathname);
          const usable = (d.cashboxes as Cashbox[]).filter((c) => !c.archived);
          if (usable.length === 1) setKirimTarget(usable[0]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    fetch("/api/hr-employees/ref")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) setEmployees(d.employees);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Ro'yxat: bosh kassa eng tepada, qolgani id tartibida (API shunday beradi).
  const sorted = useMemo(() => [...cashboxes].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.id - b.id), [cashboxes]);
  const counts = {
    active: cashboxes.filter((c) => !c.archived).length,
    archived: cashboxes.filter((c) => c.archived).length,
    all: cashboxes.length,
  };
  const listed = sorted.filter((c) => (tab === "active" ? !c.archived : tab === "archived" ? c.archived : true));
  const branchCount = cashboxes.filter((c) => !c.archived && !c.isPrimary).length;
  const hasPrimary = cashboxes.some((c) => c.isPrimary && !c.archived);
  const rangeText = rangeLabel(dateRange, lang, t);

  function moderatorHref(name: string): string | undefined {
    const id = employeeIdByName.get(name.trim().toLowerCase());
    return id !== undefined ? `/management-xodimlar/${id}` : undefined;
  }
  function whoHref(e: TransactionEntry): string | undefined {
    const person = (e.studentName || "").trim();
    if (!person) return undefined;
    // Yozuv EGASI — `pupilId`; ism bo'yicha — zaxira (eski yozuvlar, xodim yozuvlari).
    const sid = e.pupilId ?? studentIdByName.get(person.toLowerCase());
    if (sid !== undefined) return `/student-edit/${sid}?src=list`;
    return moderatorHref(person);
  }

  async function decideTransfer(entry: TransactionEntry, decision: "confirm" | "reject") {
    setDecidingId(entry.id);
    try {
      const url = decision === "confirm" ? `/api/transaction-entries/${entry.id}/transfer-confirm` : `/api/transaction-entries/${entry.id}/transfer-reject`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Amal bajarilmadi"));
        return;
      }
      showSuccess(decision === "confirm" ? t("Ko'chirma tasdiqlandi") : t("Ko'chirma rad etildi"));
      afterMoney();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setDecidingId(null);
    }
  }

  async function confirmSetPrimary() {
    if (!primaryTarget) return;
    setSettingPrimary(true);
    try {
      const res = await fetch(`/api/cashboxes/${primaryTarget.id}/set-primary`, { method: "POST" });
      const data = await res.json();
      if (data.ok) setCashboxes((prev) => prev.map((x) => ({ ...x, isPrimary: x.id === primaryTarget.id })));
      else showError(t(data.error || "Amal bajarilmadi"));
    } finally {
      setSettingPrimary(false);
      setPrimaryTarget(null);
    }
  }

  /** Bitta kassaning hisoboti — tanlangan sana oralig'i bo'yicha (eski kartochkadagi «hisobotni yuklab olish»). */
  async function exportCashbox(c: Cashbox, kind: "xls" | "csv") {
    try {
      const qs = new URLSearchParams({ cashboxId: String(c.id) });
      if (dateRange.start) qs.set("dateFrom", toIso(dateRange.start));
      if (dateRange.end ?? dateRange.start) qs.set("dateTo", toIso((dateRange.end ?? dateRange.start) as Date));
      const d = await fetch(`/api/transaction-entries?${qs.toString()}`).then((r) => r.json());
      if (!d.ok) throw new Error(d.error || "yuklab bo'lmadi");
      const cols = entryExportCols(t);
      if (kind === "xls") await downloadEntriesXlsx(d.entries, cols);
      else downloadEntriesCsv(d.entries, cols);
      showSuccess(kind === "xls" ? t("Excel fayl yuklab olindi") : t("CSV fayl yuklab olindi"));
    } catch {
      showError(kind === "xls" ? t("Excel faylni yuklab bo'lmadi") : t("CSV faylni yuklab bo'lmadi"));
    }
  }

  /** «Umumiy hisobot» — kassalar qoldig'i: har kassa, to'lov turlari, oxirgi topshiruvdan beri. */
  async function exportSummary(kind: "xls" | "csv") {
    try {
      const used = orderedMethods.filter((m) => cashboxes.some((c) => (c.methodTotals?.[m.key] ?? 0) !== 0));
      const rows = sorted.map((c) => {
        const row: Record<string, string | number> = {
          [t("Kassa")]: c.name,
          [t("Mas'ul")]: c.moderator || "",
          [t("Holati")]: [c.isPrimary ? t("Bosh kassa") : "", c.archived ? t("Arxiv") : t("Aktiv")].filter(Boolean).join(", "),
          [t("Qoldiq")]: c.balance,
        };
        for (const m of used) row[t(m.name)] = c.methodTotals?.[m.key] ?? 0;
        row[t("Oxirgi topshiruvdan beri tushum")] = c.sinceHandover?.income ?? 0;
        row[t("Oxirgi topshiruvdan beri chiqim")] = c.sinceHandover?.expense ?? 0;
        row[t("Kutilayotgan ko'chirma")] = c.pendingIn ?? 0;
        return row;
      });
      const date = new Date().toISOString().slice(0, 10);
      if (kind === "xls") {
        const XLSX = await import("xlsx");
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Kassalar");
        XLSX.writeFile(wb, `kassalar-qoldigi-${date}.xlsx`);
      } else {
        const head = Object.keys(rows[0] ?? {});
        const lines = [head.join(","), ...rows.map((r) => head.map((h) => `"${String(typeof r[h] === "number" ? fmtPlain(r[h] as number) : r[h]).replace(/"/g, '""')}"`).join(","))];
        const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `kassalar-qoldigi-${date}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      showSuccess(kind === "xls" ? t("Excel fayl yuklab olindi") : t("CSV fayl yuklab olindi"));
    } catch {
      showError(kind === "xls" ? t("Excel faylni yuklab bo'lmadi") : t("CSV faylni yuklab bo'lmadi"));
    }
  }
  const summaryItems: ActionMenuEntry[] = [
    { key: "h", heading: t("Kassalar qoldig'i — hozirgi holat") },
    { key: "xls", label: t("Excel fayl"), hint: "XLSX", icon: Download, onSelect: () => exportSummary("xls") },
    { key: "csv", label: t("CSV fayl"), hint: "CSV", icon: FileText, onSelect: () => exportSummary("csv") },
    ...(canReports
      ? ([
          { key: "d", divider: true },
          { key: "rep", label: t("Moliya hisobotlari"), icon: ChartColumn, href: "/finance-reports" },
        ] as ActionMenuEntry[])
      : []),
  ];

  const presetName = presetPupil !== null ? (dbStudentRows.find((s) => s.id === presetPupil)?.name ?? `#${presetPupil}`) : "";
  const tabs: { key: Tab; label: string; n: number }[] = [
    { key: "active", label: t("Aktiv"), n: counts.active },
    { key: "archived", label: t("Arxiv"), n: counts.archived },
    { key: "all", label: t("Barchasi"), n: counts.all },
  ];

  return (
    // Ikki ustun — ≥1280 px (chapda kartochkalar, o'ngda jadval, har biri o'zi
    // aylanadi). Torroqda kartochkalar tepada to'r bo'lib, jadval ostida —
    // 1024 da yon menyu bilan ikki ustunga jadval sig'masdi.
    <div data-ui="v2" className="relative flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5 xl:h-full xl:min-h-0">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("Kassalar")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {loading
              ? t("Yuklanmoqda…")
              : cashboxes.length === 0
                ? t("Kassa biriktirilmagan")
                : [t("{n} ta filial kassasi", { n: branchCount }), hasPrimary ? t("bosh kassa") : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <ActionMenu items={summaryItems} label={t("Umumiy hisobot")} width={256}>
              {(trigger) => (
                <button type="button" {...trigger} className={secondaryBtn}>
                  <Download className="size-4" strokeWidth={1.75} aria-hidden />
                  {t("Umumiy hisobot")}
                </button>
              )}
            </ActionMenu>
            <button type="button" onClick={() => setAddOpen(true)} className={secondaryBtn}>
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {t("Yangi kassa")}
            </button>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-col gap-4 xl:flex-1 xl:flex-row">
        {/* Chapda — kassalar */}
        <aside className="flex w-full shrink-0 flex-col gap-3 [scrollbar-width:thin] xl:min-h-0 xl:w-[360px] xl:overflow-y-auto xl:pb-1 xl:pr-1 min-[87.5rem]:w-[392px]">
          <div role="tablist" aria-label={t("Kassalar")} className="grid shrink-0 grid-cols-3 gap-1 rounded-v2-md border border-v2-border bg-v2-surface-2 p-1">
            {tabs.map((x) => {
              const on = tab === x.key;
              return (
                <button
                  key={x.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(x.key)}
                  className={`h-8 rounded-[6px] text-v2-small transition-colors ${on ? "bg-v2-surface font-semibold text-v2-text shadow-v2-sm" : "text-v2-text-2 hover:text-v2-text"}`}
                >
                  {x.label}
                  {on && x.n > 0 && <span className="ml-1 font-normal text-v2-text-3">{x.n}</span>}
                </button>
              );
            })}
          </div>

          {/* O'quvchidan to'lov: kassa bir nechta — kassir o'zi tanlaydi. */}
          {presetPupil !== null && !kirimTarget && (
            <div className="flex shrink-0 items-start gap-2 rounded-v2-lg border border-v2-brand bg-v2-brand-bg px-3 py-2.5 text-v2-small text-v2-text">
              <Wallet className="mt-0.5 size-4 shrink-0 text-v2-brand-text" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 flex-1">
                {t("{name} uchun to'lov: kassani tanlang va «Kirim» ni bosing — o'quvchi oldindan tanlanadi.", { name: presetName })}
              </span>
              <button type="button" onClick={() => setPresetPupil(null)} aria-label={t("Bekor qilish")} title={t("Bekor qilish")} className="shrink-0 rounded-v2-sm p-0.5 text-v2-text-2 hover:bg-v2-surface/60 hover:text-v2-text">
                <X className="size-3.5" strokeWidth={2} />
              </button>
            </div>
          )}

          {loading &&
            Array.from({ length: 3 }, (_, i) => (
              <div key={`sk${i}`} className="shrink-0 rounded-v2-lg border border-v2-border p-4" aria-hidden>
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-v2-md bg-v2-skeleton" />
                  <div className="flex-1 space-y-1.5"><div className="h-3 w-36 rounded bg-v2-skeleton" /><div className="h-2.5 w-24 rounded bg-v2-skeleton" /></div>
                  <div className="h-4 w-20 rounded bg-v2-skeleton" />
                </div>
                <div className="mt-3 h-2.5 w-48 rounded bg-v2-skeleton" />
              </div>
            ))}

          {!loading && listed.length === 0 && (
            <div className="flex shrink-0 flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-5 py-8 text-center">
              <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                <Wallet className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              {cashboxes.length === 0 ? (
                <>
                  <div className="text-v2-section text-v2-text">{t("Sizga kassa biriktirilmagan")}</div>
                  {/* Ro'yxat SERVERDA kesiladi: xodim faqat o'ziga biriktirilgan kassani ko'radi. */}
                  <p className="text-v2-small text-v2-text-2">{t("Kassani Moliya → Kassalar bo'limida admin biriktiradi.")}</p>
                  {isAdmin && (
                    <button type="button" onClick={() => setAddOpen(true)} className={`${primaryBtn} mt-2`}>
                      <Plus className="size-4" strokeWidth={2} aria-hidden />
                      {t("Yangi kassa")}
                    </button>
                  )}
                </>
              ) : (
                <div className="text-v2-small text-v2-text-2">{t("Bu bo'limda kassa yo'q")}</div>
              )}
            </div>
          )}

          {!loading && listed.length > 0 && (
            <div className="grid shrink-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1">
          {listed.map((c) => (
              <div key={c.id} className="min-w-0">
                <CashboxCardV2
                  c={c}
                  selected={cashboxFilter === c.id}
                  hidden={hiddenStore.isHidden(c.id)}
                  isAdmin={isAdmin}
                  methods={orderedMethods}
                  moderatorHref={c.moderator ? moderatorHref(c.moderator) : undefined}
                  rangeText={rangeText}
                  onSelect={() => setCashboxFilter((cur) => (cur === c.id ? null : c.id))}
                  onToggleHidden={() => hiddenStore.toggle(c.id)}
                  onKirim={() => {
                    setKirimTarget(c);
                    // Qabulxona hozirgina qo'shgan o'quvchi ham ko'rinsin — fonda (eski sahifadagidek).
                    refreshStudents();
                  }}
                  onChiqim={() => {
                    setAdjustTarget(c);
                    refreshStudents();
                  }}
                  onTransferTo={() => setTransferToTarget(c)}
                  onTransferMethod={(from) => setTransferState({ cashbox: c, from })}
                  onDividend={() => setDividendTarget(c)}
                  onInvestment={() => setInvestmentTarget(c)}
                  onEdit={() => setEditTarget(c)}
                  onSetPrimary={() => setPrimaryTarget(c)}
                  onHandover={() => setHandoverOpen(true)}
                  onExport={(kind) => exportCashbox(c, kind)}
                />
              </div>
            ))}
            </div>
          )}
        </aside>

        {/* O'ngda — tranzaksiyalar */}
        <CashTransactionsV2
          cashboxes={sorted}
          cashboxFilter={cashboxFilter}
          onCashboxFilter={setCashboxFilter}
          dateRange={dateRange}
          onDateRange={setDateRange}
          reloadKey={reloadKey}
          isAdmin={isAdmin}
          methods={paymentMethods}
          txNames={txTypeNames}
          teachers={dbTeachers}
          whoHref={whoHref}
          onOpen={setDetailEntry}
          onReceipt={setReceiptEntry}
          onHistory={setHistoryEntry}
          onDecide={decideTransfer}
          decidingId={decidingId}
        />
      </div>

      {/* Oynalar — hozircha eski ko'rinishda (bo'limma-bo'lim almashadi). */}
      {addOpen && (
        <CashboxDrawer
          cashboxes={cashboxes}
          onClose={() => setAddOpen(false)}
          onSaved={(c) => {
            setCashboxes((prev) => [...prev, c]);
            refreshCashboxes();
          }}
        />
      )}
      {editTarget && (
        <CashboxDrawer
          cashbox={editTarget}
          cashboxes={cashboxes}
          onClose={() => setEditTarget(null)}
          onSaved={(c) => patchCashbox(c)}
          onDeleted={(id) => {
            setCashboxes((prev) => prev.filter((x) => x.id !== id));
            setCashboxFilter((cur) => (cur === id ? null : cur));
          }}
        />
      )}
      {transferState && (
        <CashboxTransferDrawer cashbox={transferState.cashbox} initialFrom={transferState.from} onClose={() => setTransferState(null)} onSaved={(c) => afterMoney(c)} />
      )}
      {adjustTarget && (
        <CashboxAdjustDrawer
          cashbox={adjustTarget}
          mode="chiqim"
          students={dbStudentRows}
          studentsLoading={studentsLoading}
          studentsRefreshing={studentsRefreshing}
          onClose={() => setAdjustTarget(null)}
          onSaved={(c) => afterMoney(c)}
        />
      )}
      {kirimTarget && (
        <CashboxKirimDrawer
          cashbox={kirimTarget}
          students={dbStudentRows}
          studentsLoading={studentsLoading}
          studentsRefreshing={studentsRefreshing}
          initialStudentKey={presetPupil !== null ? String(presetPupil) : undefined}
          onClose={() => {
            setKirimTarget(null);
            // O'quvchidan kelgan to'lov bir marta — keyingi «Kirim» odatdagidek bo'sh.
            setPresetPupil(null);
          }}
          onSaved={(c) => afterMoney(c)}
        />
      )}
      {handoverOpen && <HandoverModal onClose={() => setHandoverOpen(false)} />}
      {dividendTarget && <CashboxDividendDrawer cashbox={dividendTarget} onClose={() => setDividendTarget(null)} onSaved={(c) => afterMoney(c)} />}
      {investmentTarget && <CashboxInvestmentDrawer cashbox={investmentTarget} onClose={() => setInvestmentTarget(null)} onSaved={(c) => afterMoney(c)} />}
      {transferToTarget && (
        <CashboxTransferToDrawer
          cashbox={transferToTarget}
          onClose={() => setTransferToTarget(null)}
          onSaved={({ from, to }) => {
            patchCashbox(from);
            patchCashbox(to);
            afterMoney();
          }}
        />
      )}
      {detailEntry && (
        <TransactionDetailDrawer
          entry={detailEntry}
          cashboxName={cashboxes.find((c) => c.id === detailEntry.cashboxId)?.name || ""}
          studentId={detailEntry.studentName ? studentIdByName.get(detailEntry.studentName.trim().toLowerCase()) : undefined}
          employeeId={
            detailEntry.studentName && !studentIdByName.get(detailEntry.studentName.trim().toLowerCase())
              ? employeeIdByName.get(detailEntry.studentName.trim().toLowerCase())
              : detailEntry.moderator
                ? employeeIdByName.get(detailEntry.moderator.trim().toLowerCase())
                : undefined
          }
          onClose={() => setDetailEntry(null)}
          onChanged={(updated) => {
            setDetailEntry(updated);
            afterMoney();
          }}
        />
      )}
      {historyEntry && <EditHistoryModal entry={historyEntry} onClose={() => setHistoryEntry(null)} />}
      {receiptEntry && (
        <ReceiptPreviewModal
          entry={receiptEntry}
          cashboxName={cashboxes.find((c) => c.id === receiptEntry.cashboxId)?.name || ""}
          onClose={() => setReceiptEntry(null)}
          onPrint={() => {
            const e = receiptEntry;
            const name = cashboxes.find((c) => c.id === e.cashboxId)?.name || "";
            setReceiptEntry(null);
            // Modal yopilgach bosma oynasi ochilsin (ba'zi brauzerlarda modal ostida qolardi).
            setTimeout(() => printReceipt(e, name), 0);
          }}
        />
      )}
      {primaryTarget && (
        <Modal onClose={() => setPrimaryTarget(null)} locked={settingPrimary} bare size="sm" zIndex={120} panelClassName="p-6">
          {(modal) => (
            <>
              <p className="text-center text-[15px] font-semibold">{t("Bosh kassa qilmoqchimisiz?")}</p>
              <p className="mt-1 text-center text-[13px] text-muted-foreground">{primaryTarget.name}</p>
              <div className="mt-5 flex items-center justify-center gap-2">
                <button onClick={modal.close} disabled={settingPrimary} className="h-9 rounded-lg border border-border bg-card px-6 text-sm font-medium hover:bg-secondary disabled:opacity-60">
                  {t("Yo'q")}
                </button>
                <button onClick={confirmSetPrimary} disabled={settingPrimary} className="h-9 rounded-lg bg-primary px-6 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
                  {settingPrimary ? t("Saqlanmoqda…") : t("Ha")}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
