"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Download, FileText, History, ListFilter, MoreHorizontal, Printer, ReceiptText, Search, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useLang, useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import type { DateRange } from "@/components/ui/DateRangePicker";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import FloatingPanel from "@/components/v2/ui/FloatingPanel";
import V2DateRange, { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import V2Select from "@/components/v2/ui/V2Select";
import { moreFiltersCls, panelTriggerCls } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { downloadEntriesCsv, downloadEntriesXlsx, entryExportCols, TX_TYPE_LABELS } from "@/lib/cashEntriesExport";
import { getPageButtons } from "@/lib/pagination";
import type { Cashbox } from "@/lib/cashboxes";
import type { PaymentMethod } from "@/lib/paymentMethods";
import type { TransactionEntry } from "@/lib/transactionEntries";
import CashMoreFilters, { CASH_STATUS_OPTIONS, countCashMore, EMPTY_CASH_MORE, type CashMore } from "./CashMoreFilters";

// YANGI VERSIYA: KASSALAR → «TRANZAKSIYALAR» PANELI (rasm «Kassalar», 18.10.2026).
//
// Eski sahifadan farqi: jadval TANLANGAN BITTA kassaniki emas — «Barcha
// kassalar» (xodimga ko'rinadigan hamma kassa, `?cashboxIds=`; server har
// birining egasini tekshiradi), «Kassa» ustuni bilan; kassa chipi yoki chapdagi
// kartochka — bitta kassaga toraytiradi. Filtrlar: sana (sukut «Bugun»),
// «Ism yoki izoh» (`?q=`), Turi, To'lov turi, Kassa, «Yana» (tranzaksiya turi,
// ustoz, holati). Yuqorida Kirim · N ta / Chiqim · N ta / Farq — SERVERDAN, butun
// filtr bo'yicha (faqat qabul qilinganlar — eski sahifa qoidasi). Jadval
// serverda sahifalanadi (50 qator). Qator bosilsa — tranzaksiya oynasi (eski).

const TX_TYPES = [
  { value: "payIn", label: "Kirim" },
  { value: "payOut", label: "Chiqim" },
  { value: "transfer", label: "Ko'chirish" },
];
const PAGE_SIZE = 50;

function fmtNum(n: number): string {
  return Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function entryDay(e: TransactionEntry): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.date || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

interface Totals {
  income: number;
  expense: number;
  incomeCount: number;
  expenseCount: number;
}
const ZERO: Totals = { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 };

export interface CashTransactionsV2Props {
  cashboxes: Cashbox[];
  cashboxFilter: number | null;
  onCashboxFilter: (id: number | null) => void;
  dateRange: DateRange;
  onDateRange: (r: DateRange) => void;
  /** Har oshirilganda jadval va yig'indilar qayta yuklanadi (kirim/chiqim saqlangach). */
  reloadKey: number;
  isAdmin: boolean;
  methods: PaymentMethod[];
  txNames: string[];
  teachers: string[];
  /** Ism — profilga havola (o'quvchi yoki xodim); topilmasa oddiy matn. */
  whoHref: (e: TransactionEntry) => string | undefined;
  onOpen: (e: TransactionEntry) => void;
  onReceipt: (e: TransactionEntry) => void;
  onHistory: (e: TransactionEntry) => void;
  onDecide: (e: TransactionEntry, decision: "confirm" | "reject") => void;
  decidingId: number | null;
}

export default function CashTransactionsV2(props: CashTransactionsV2Props) {
  const { cashboxes, cashboxFilter, onCashboxFilter, dateRange, onDateRange, reloadKey, isAdmin, methods } = props;
  const { t } = useT();
  const [lang] = useLang();
  const { showSuccess, showError } = useToast();

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [txType, setTxType] = useState("");
  const [payType, setPayType] = useState("");
  const [more, setMore] = useState<CashMore>(EMPTY_CASH_MORE);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const [page, setPage] = useState(1);

  const [entries, setEntries] = useState<TransactionEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState<Totals>(ZERO);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  // Qaysi so'rov javobi ekranda — `loading` shundan hisoblanadi (effekt ichida
  // sinxron setState qilinmaydi).
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const seqRef = useRef(0);

  // «Ism yoki izoh» — har harfda so'rov ketmasin (300 ms).
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(qInput.trim());
    }, 300);
    return () => clearTimeout(id);
  }, [qInput]);

  const nameById = useMemo(() => new Map(cashboxes.map((c) => [c.id, c.name])), [cashboxes]);
  const allIds = cashboxes.map((c) => c.id).join(",");

  /** BARCHA filtrlar serverga birga (sahifa, yig'indi va eksport — bir xil shart). */
  const baseQuery = useMemo(() => {
    const qs = new URLSearchParams();
    if (cashboxFilter) qs.set("cashboxId", String(cashboxFilter));
    else if (allIds) qs.set("cashboxIds", allIds);
    else return null; // kassa yo'q — so'raladigan narsa yo'q
    if (dateRange.start) qs.set("dateFrom", toIso(dateRange.start));
    if (dateRange.end ?? dateRange.start) qs.set("dateTo", toIso((dateRange.end ?? dateRange.start) as Date));
    if (txType) qs.set("txType", txType);
    // To'lov turi yozuvda NOMI bilan saqlanadi, filtrda kaliti tanlanadi.
    const payLabel = payType ? methods.find((m) => m.key === payType)?.name : "";
    if (payLabel) qs.set("paymentType", payLabel);
    if (q) qs.set("q", q);
    if (more.txName) qs.set("txName", more.txName);
    if (more.teacher) qs.set("teacherLike", more.teacher);
    if (more.status) qs.set("status", more.status);
    return qs.toString();
  }, [cashboxFilter, allIds, dateRange, txType, payType, methods, q, more]);

  // Filtr o'zgarsa 1-sahifaga (sahifalash serverda — 30-sahifada turib filtr qo'yilsa bo'sh javob kelardi).
  const [pageKey, setPageKey] = useState(baseQuery);
  if (pageKey !== baseQuery) {
    setPageKey(baseQuery);
    setPage(1);
  }

  const reqKey = `${baseQuery}|${page}|${reloadKey}|${retry}`;
  useEffect(() => {
    if (baseQuery === null) return;
    const seq = ++seqRef.current;
    const key = `${baseQuery}|${page}|${reloadKey}|${retry}`;
    const qs = new URLSearchParams(baseQuery);
    qs.set("page", String(page));
    qs.set("limit", String(PAGE_SIZE));
    qs.set("withTotals", "1");
    fetch(`/api/transaction-entries?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (seq !== seqRef.current) return;
        if (!d.ok) throw new Error(d.error || "yuklab bo'lmadi");
        setEntries(d.entries);
        setTotal(d.total);
        setTotals({ ...ZERO, ...(d.totals ?? {}) });
        setError(false);
        setLoadedKey(key);
      })
      .catch(() => {
        if (seq !== seqRef.current) return;
        // Moliya jadvali: xatoda eski raqamlar ham, «0» ham qolmasin — xato ochiq aytiladi.
        setEntries([]);
        setTotal(0);
        setTotals(ZERO);
        setError(true);
        setLoadedKey(key);
      });
  }, [baseQuery, page, reloadKey, retry]);

  const noCashbox = baseQuery === null;
  const loading = !noCashbox && loadedKey !== reqKey;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* ---- Eksport (butun filtr bo'yicha, sahifa emas) — faqat admin (eski qoida) ---- */
  async function exportAll(kind: "xls" | "csv") {
    if (!baseQuery) return;
    try {
      const d = await fetch(`/api/transaction-entries?${baseQuery}`).then((r) => r.json());
      if (!d.ok) throw new Error(d.error || "yuklab bo'lmadi");
      const cols = entryExportCols(t, { cashboxName: (id) => nameById.get(id) ?? "" });
      if (kind === "xls") await downloadEntriesXlsx(d.entries, cols);
      else downloadEntriesCsv(d.entries, cols);
      showSuccess(kind === "xls" ? t("Excel fayl yuklab olindi") : t("CSV fayl yuklab olindi"));
    } catch {
      showError(kind === "xls" ? t("Excel faylni yuklab bo'lmadi") : t("CSV faylni yuklab bo'lmadi"));
    }
  }
  const reportItems: ActionMenuEntry[] = [
    { key: "h", heading: t("Ro'yxatdagilar: {n} ta", { n: total }) },
    { key: "xls", label: t("Excel fayl"), hint: "XLSX", icon: Download, onSelect: () => exportAll("xls") },
    { key: "csv", label: t("CSV fayl"), hint: "CSV", icon: FileText, onSelect: () => exportAll("csv") },
  ];

  /* ---- Filtr chiplari ---- */
  const moreCount = countCashMore(more);
  const chips: { key: string; label: string; clear: () => void }[] = [
    ...(more.txName ? [{ key: "txName", label: `${t("Tranzaksiya turi")}: ${more.txName}`, clear: () => setMore((m) => ({ ...m, txName: "" })) }] : []),
    ...(more.teacher ? [{ key: "teacher", label: `${t("Oyligiga (ustoz)")}: ${more.teacher}`, clear: () => setMore((m) => ({ ...m, teacher: "" })) }] : []),
    ...(more.status
      ? [{ key: "status", label: `${t("Holati")}: ${t(CASH_STATUS_OPTIONS.find((o) => o.value === more.status)?.label ?? more.status)}`, clear: () => setMore((m) => ({ ...m, status: "" })) }]
      : []),
  ];
  const anyFilter = !!(qInput.trim() || txType || payType || cashboxFilter || moreCount);
  const clearAll = () => {
    setQInput("");
    setQ("");
    setTxType("");
    setPayType("");
    setMore(EMPTY_CASH_MORE);
    onCashboxFilter(null);
  };

  const filterName = cashboxFilter ? nameById.get(cashboxFilter) : null;
  const oneDay = !!dateRange.start && (!dateRange.end || dateRange.start.getTime() === dateRange.end.getTime());
  const diff = totals.income - totals.expense;

  function rowMenu(e: TransactionEntry): ActionMenuEntry[] {
    const cancelled = e.status === "cancelled";
    const canDecide = e.status === "waiting" && e.txType === "transfer" && e.transferRole === "in";
    const edited = Array.isArray(e.editHistory) && e.editHistory.length > 0;
    return [
      { key: "h", heading: `${t("Chek №")} ${e.id}` },
      ...(cancelled ? [] : [{ key: "print", label: t("Chek chiqarish"), icon: Printer, onSelect: () => props.onReceipt(e) }]),
      { key: "open", label: t("Tranzaksiyani ochish"), icon: ReceiptText, onSelect: () => props.onOpen(e) },
      ...(edited ? [{ key: "hist", label: t("Tahrirlar tarixi"), icon: History, onSelect: () => props.onHistory(e) }] : []),
      ...(canDecide
        ? ([
            { key: "d", divider: true },
            { key: "ok", label: t("Tasdiqlash"), icon: Check, disabled: props.decidingId === e.id, onSelect: () => props.onDecide(e, "confirm") },
            { key: "no", label: t("Rad etish"), icon: X, danger: true, disabled: props.decidingId === e.id, onSelect: () => props.onDecide(e, "reject") },
          ] as ActionMenuEntry[])
        : []),
    ];
  }

  const th = "sticky top-0 z-10 whitespace-nowrap bg-v2-surface-2 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pt-3.5">
        <div className="mr-auto flex min-w-0 items-baseline gap-2">
          <h2 className="text-v2-section text-v2-text">{t("Tranzaksiyalar")}</h2>
          <span className="truncate text-v2-small text-v2-text-3">{filterName ?? t("Barcha kassalar")}</span>
        </div>
        <V2DateRange value={dateRange} onChange={onDateRange} />
        {isAdmin && (
          <ActionMenu items={reportItems} label={t("Hisobot")} width={232}>
            {(trigger, open) => (
              <button type="button" {...trigger} className={panelTriggerCls(open)}>
                <Download className="size-4 text-v2-text-2" strokeWidth={1.75} aria-hidden />
                {t("Hisobot")}
                <ChevronDown className={`size-4 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
              </button>
            )}
          </ActionMenu>
        )}
      </div>

      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            type="search"
            placeholder={t("Ism yoki izoh")}
            aria-label={t("Ism yoki izoh")}
            className="h-9 w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
          />
        </div>
        <V2Select variant="chip" label={t("Turi")} value={txType} onChange={setTxType} options={TX_TYPES} searchable={false} />
        <V2Select variant="chip" label={t("To'lov turi")} value={payType} onChange={setPayType} options={methods.map((m) => ({ value: m.key, label: m.name }))} />
        {cashboxes.length > 1 && (
          <V2Select
            variant="chip"
            label={t("Kassa")}
            value={cashboxFilter ? String(cashboxFilter) : ""}
            onChange={(v) => onCashboxFilter(v ? Number(v) : null)}
            options={cashboxes.map((c) => ({ value: String(c.id), label: c.name }))}
          />
        )}
        <button ref={moreBtnRef} type="button" onClick={() => setMoreOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={moreOpen} className={moreFiltersCls(moreOpen, moreCount > 0)}>
          <ListFilter className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Yana")}
          {moreCount > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-v2-full bg-v2-brand px-1.5 text-[11px] font-semibold tabular-nums text-v2-on-brand">{moreCount}</span>}
        </button>
        <FloatingPanel open={moreOpen} anchorRef={moreBtnRef} onClose={() => setMoreOpen(false)} align="end" width={340} maxHeight={480} role="dialog" ariaLabel={t("Qo'shimcha filtrlar")}>
          <CashMoreFilters
            applied={more}
            txNames={props.txNames}
            teachers={props.teachers}
            onApply={(next) => {
              setMore(next);
              setMoreOpen(false);
            }}
          />
        </FloatingPanel>
      </div>

      {chips.length > 0 && (
        <div className="-mt-1 flex flex-wrap items-center gap-2 px-4 pb-3">
          {chips.map((c) => (
            <span key={c.key} className="inline-flex h-7 max-w-full items-center gap-1 rounded-v2-md border border-v2-border bg-v2-surface-2 pl-2.5 pr-1 text-v2-small text-v2-text">
              <span className="truncate">{c.label}</span>
              <button type="button" onClick={c.clear} aria-label={`${c.label} — ${t("Tozalash")}`} className="inline-flex size-5 items-center justify-center rounded-v2-sm text-v2-text-3 hover:bg-v2-surface hover:text-v2-text">
                <X className="size-3.5" strokeWidth={2} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Kirim · Chiqim · Farq — butun filtr bo'yicha, faqat qabul qilinganlar */}
      <div className="grid shrink-0 grid-cols-3 border-y border-v2-border">
        {[
          { key: "in", label: `${t("Kirim")} · ${t("{n} ta", { n: totals.incomeCount })}`, value: totals.income, sign: "+", cls: "text-v2-success" },
          { key: "out", label: `${t("Chiqim")} · ${t("{n} ta", { n: totals.expenseCount })}`, value: totals.expense, sign: "−", cls: "text-v2-danger" },
          { key: "diff", label: t("Farq"), value: Math.abs(diff), sign: diff < 0 ? "−" : diff > 0 ? "+" : "", cls: "text-v2-text" },
        ].map((s, i) => (
          <div key={s.key} className={`min-w-0 px-4 py-2.5 ${i > 0 ? "border-l border-v2-border" : ""}`}>
            <div className="truncate text-v2-caption text-v2-text-2">{s.label}</div>
            <div className="truncate">
              <span className={`text-[17px] font-semibold tabular-nums ${error || s.value === 0 ? "text-v2-text-3" : s.cls}`}>
                {error || noCashbox ? "—" : `${s.value > 0 ? s.sign : ""}${fmtNum(s.value)}`}
              </span>{" "}
              <span className="text-v2-small text-v2-text-2">{t("so'm")}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Jadval */}
      <div className="max-h-[70vh] min-h-0 overflow-auto xl:max-h-none xl:flex-1">
        {/* QAT'IY USTUNLAR: jadval katagida `truncate` ustunni toraytirmaydi —
            uzun ism («Oyshaxon Turgunboyeva») butun jadvalni kengaytirib, 1280 px
            da yon aylantirish chiqarardi (o'lchandi). «Kim / nima» — qolgan joy;
            telefonda jadval 600 px dan torayib qolmaydi, yonga aylanadi. */}
        <table className="w-full min-w-[600px] table-fixed border-collapse text-v2-body">
          <colgroup>
            <col className="w-[52px]" />
            <col />
            <col className="w-[150px] min-[87.5rem]:w-[176px]" />
            <col className={oneDay ? "w-[68px] min-[87.5rem]:w-[150px]" : "w-[150px]"} />
            <col className="w-[108px]" />
            <col className="w-[44px]" />
          </colgroup>
          <thead>
            <tr>
              <th className={`${th} pl-4 pr-1`}>{t("Chek")}</th>
              <th className={`${th} px-2.5`}>{t("Kim / nima")}</th>
              <th className={`${th} px-2.5`}>{t("Kassa")}</th>
              <th className={`${th} px-2.5`}>{t("Sana")}</th>
              <th className={`${th} px-2.5 text-right`}>{t("Summa, so'm")}</th>
              <th className={`${th} pl-1 pr-2`}>
                <span className="sr-only">{t("Amallar")}</span>
              </th>
            </tr>
          </thead>
          <tbody className={loading && entries.length > 0 ? "opacity-60 transition-opacity" : ""}>
            {loading && entries.length === 0 && !noCashbox &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={`sk${i}`} className="h-14 border-b border-v2-border" aria-hidden>
                  <td className="pl-4 pr-1"><div className="size-8 rounded-v2-md bg-v2-skeleton" /></td>
                  <td className="px-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-v2-md bg-v2-skeleton" />
                      <div className="space-y-1.5"><div className="h-3 w-32 rounded bg-v2-skeleton" /><div className="h-2.5 w-16 rounded bg-v2-skeleton" /></div>
                    </div>
                  </td>
                  <td className="px-2.5"><div className="h-3 w-28 rounded bg-v2-skeleton" /></td>
                  <td className="px-2.5"><div className="h-3 w-24 rounded bg-v2-skeleton" /></td>
                  <td className="px-2.5"><div className="ml-auto h-3 w-16 rounded bg-v2-skeleton" /></td>
                  <td />
                </tr>
              ))}

            {(!loading || noCashbox) && entries.length === 0 && (
              <tr>
                <td colSpan={6} className="p-5">
                  <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                    <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                      <ReceiptText className="size-5" strokeWidth={1.75} aria-hidden />
                    </span>
                    {error ? (
                      <>
                        <div className="text-v2-section text-v2-text">{t("Ma'lumotni yuklab bo'lmadi")}</div>
                        <p className="text-v2-small text-v2-text-2">{t("Aloqa yoki server xatosi — yuqoridagi summalar ham to'liq emas.")}</p>
                        <button type="button" onClick={() => setRetry((n) => n + 1)} className="mt-2 inline-flex h-9 items-center rounded-v2-md bg-v2-brand px-4 font-semibold text-v2-on-brand hover:brightness-95">
                          {t("Qayta urinish")}
                        </button>
                      </>
                    ) : noCashbox ? (
                      <div className="text-v2-small text-v2-text-2">{t("Kassa yo'q — tranzaksiyalar kassa biriktirilgach ko'rinadi.")}</div>
                    ) : (
                      <>
                        <div className="text-v2-section text-v2-text">{t("Amal topilmadi")}</div>
                        <p className="text-v2-small text-v2-text-2">{anyFilter ? t("Qidiruv yoki filtrlarni o'zgartirib ko'ring.") : t("Tanlangan kunlarda kirim yoki chiqim bo'lmagan.")}</p>
                        {anyFilter && (
                          <button type="button" onClick={clearAll} className="mt-2 inline-flex h-9 items-center rounded-v2-md border border-v2-border-strong bg-v2-surface px-3 font-medium text-v2-text hover:bg-v2-surface-2">
                            {t("Filtrlarni tozalash")}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {entries.map((e) => {
              const cancelled = e.status === "cancelled";
              const waiting = e.status === "waiting";
              const canDecide = waiting && e.txType === "transfer" && e.transferRole === "in";
              const edited = Array.isArray(e.editHistory) && e.editHistory.length > 0;
              const dir = e.txType === "transfer" ? "transfer" : e.amount >= 0 ? "in" : "out";
              const person = (e.studentName || "").trim();
              const title = person || e.txName || e.note || e.moderator || "—";
              const href = person ? props.whoHref(e) : undefined;
              const typeLabel = t(TX_TYPE_LABELS[e.txType] || e.txType);
              const note = e.note && e.note !== title ? e.note : "";
              const tip = [
                e.txName && e.txName !== title ? `${t("Tranzaksiya turi")}: ${e.txName}` : "",
                e.teacherName ? `${t("Oyligiga")}: ${e.teacherName}` : "",
                e.moderator ? `${t("Qabul qilgan")}: ${e.moderator}` : "",
              ].filter(Boolean).join("\n");
              const day = entryDay(e);
              const amountCls = cancelled ? "text-v2-text-3 line-through" : dir === "transfer" ? "text-v2-text" : dir === "in" ? "text-v2-success" : "text-v2-danger";
              return (
                <tr
                  key={e.id}
                  onClick={(ev) => {
                    if ((ev.target as HTMLElement).closest("button, a")) return;
                    props.onOpen(e);
                  }}
                  className={`group h-14 cursor-pointer border-b border-v2-border transition-colors last:border-b-0 ${ROW_TINT.hover} ${cancelled ? "opacity-70" : ""}`}
                >
                  <td className="py-2 pl-4 pr-1">
                    {!cancelled && (
                      <button
                        type="button"
                        onClick={() => props.onReceipt(e)}
                        title={t("Chek chiqarish")}
                        aria-label={t("Chek chiqarish")}
                        className="inline-flex size-8 items-center justify-center rounded-v2-md border border-v2-border-strong bg-v2-surface text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
                      >
                        <Printer className="size-4" strokeWidth={1.75} />
                      </button>
                    )}
                  </td>
                  <td className="py-2 px-2.5" title={tip || undefined}>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-v2-md ${
                          dir === "in" ? "bg-v2-success-bg text-v2-success" : dir === "out" ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-warning-bg text-v2-warning"
                        }`}
                        aria-hidden
                      >
                        {dir === "in" ? <ArrowDownLeft className="size-4" strokeWidth={2} /> : dir === "out" ? <ArrowUpRight className="size-4" strokeWidth={2} /> : <ArrowLeftRight className="size-4" strokeWidth={1.75} />}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-v2-text">
                          {href ? (
                            <Link href={href} className="underline-offset-2 hover:text-v2-brand-text hover:underline">
                              {title}
                            </Link>
                          ) : (
                            title
                          )}
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-v2-caption text-v2-text-3">
                          {/* Tur doim to'liq, izoh — sig'gancha. */}
                          <span className="shrink-0">{typeLabel}</span>
                          {note && <span className="min-w-0 truncate">· {note}</span>}
                          {waiting && <span className="shrink-0 rounded-v2-full bg-v2-warning-bg px-1.5 py-px text-[11px] font-medium text-v2-warning">{t("Tasdiq kutmoqda")}</span>}
                          {cancelled && <span className="shrink-0 rounded-v2-full bg-v2-danger-bg px-1.5 py-px text-[11px] font-medium text-v2-danger">{t("Bekor qilingan")}</span>}
                          {edited && (
                            <button type="button" onClick={() => props.onHistory(e)} title={t("Tahrirlar tarixini ko'rish")} className="shrink-0 rounded-v2-full bg-v2-info-bg px-1.5 py-px text-[11px] font-medium text-v2-info hover:brightness-95">
                              {t("Tahrirlangan")}
                            </button>
                          )}
                          {canDecide && (
                            <span className="inline-flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                disabled={props.decidingId === e.id}
                                onClick={() => props.onDecide(e, "reject")}
                                title={t("Rad etish — pul jo'natuvchi kassada qoladi")}
                                aria-label={t("Rad etish")}
                                className="inline-flex size-5 items-center justify-center rounded-v2-sm bg-v2-danger-bg text-v2-danger hover:brightness-95 disabled:opacity-50"
                              >
                                <X className="size-3" strokeWidth={2.5} />
                              </button>
                              <button
                                type="button"
                                disabled={props.decidingId === e.id}
                                onClick={() => props.onDecide(e, "confirm")}
                                title={t("Tasdiqlash — pul jo'natuvchidan yechilib, shu kassaga qo'shiladi")}
                                aria-label={t("Tasdiqlash")}
                                className="inline-flex size-5 items-center justify-center rounded-v2-sm bg-v2-success-bg text-v2-success hover:brightness-95 disabled:opacity-50"
                              >
                                <Check className="size-3" strokeWidth={2.5} />
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="truncate whitespace-nowrap px-2.5 py-2 text-v2-text-2" title={nameById.get(e.cashboxId)}>
                    {nameById.get(e.cashboxId) ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 tabular-nums text-v2-text-2" title={day ? `${dayMonthLabel(day, lang)} | ${e.time}` : undefined}>
                    {/* Bitta kun tanlangan bo'lsa kun sarlavhada bor — tor ekranda faqat soat (jadval sig'sin). */}
                    <span className={oneDay ? "hidden min-[87.5rem]:inline" : ""}>{day ? dayMonthLabel(day, lang) : e.date} | </span>
                    {e.time}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right">
                    <div className={`font-semibold tabular-nums ${amountCls}`}>
                      {e.amount > 0 ? "+" : e.amount < 0 ? "−" : ""}
                      {fmtNum(e.amount)}
                    </div>
                    <div className="text-v2-caption text-v2-text-3">{t(e.paymentType)}</div>
                  </td>
                  <td className="py-2 pl-1 pr-2 text-right">
                    <ActionMenu items={rowMenu(e)} label={t("{name} — amallar", { name: title })} width={236}>
                      {(trigger, open) => (
                        <button
                          type="button"
                          {...trigger}
                          title={t("Amallar")}
                          aria-label={t("{name} — amallar", { name: title })}
                          className={`inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus ${open ? "bg-v2-surface-2" : ""}`}
                        >
                          <MoreHorizontal className="size-4" strokeWidth={1.75} />
                        </button>
                      )}
                    </ActionMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pastki qator */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-v2-border px-4 py-2.5">
        <span className="text-v2-small tabular-nums text-v2-text-2">
          {total <= PAGE_SIZE
            ? t("{n} ta amal ko'rsatildi", { n: total })
            : t("{from}–{to} / {total} ta amal", { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(total, page * PAGE_SIZE), total })}
        </span>
        {pages > 1 && (
          <nav aria-label={t("Sahifalar")} className="mx-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              aria-label={t("Oldingi")}
              className="inline-flex size-8 items-center justify-center rounded-v2-md border border-v2-border-strong bg-v2-surface text-v2-text-2 hover:bg-v2-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="size-4" strokeWidth={1.75} />
            </button>
            {getPageButtons(page, pages).map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} className="inline-flex h-8 min-w-6 items-center justify-center text-v2-small text-v2-text-3" aria-hidden>
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  aria-current={p === page ? "page" : undefined}
                  className={`h-8 min-w-8 rounded-v2-md px-2 text-v2-small tabular-nums ${p === page ? "bg-v2-brand font-semibold text-v2-on-brand" : "text-v2-text hover:bg-v2-surface-2"}`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === pages}
              aria-label={t("Keyingi")}
              className="inline-flex size-8 items-center justify-center rounded-v2-md border border-v2-border-strong bg-v2-surface text-v2-text-2 hover:bg-v2-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="size-4" strokeWidth={1.75} />
            </button>
          </nav>
        )}
        <span className={`hidden text-v2-caption text-v2-text-3 sm:block ${pages > 1 ? "" : "ml-auto"}`}>{t("Ko'chirma qabul qiluvchi ✓ bosgunicha jo'natuvchi kassada turadi")}</span>
      </div>
    </section>
  );
}
