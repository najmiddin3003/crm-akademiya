"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, Eye, EyeOff, FileSpreadsheet, FileText, MoreVertical, Star } from "lucide-react";
import * as XLSX from "xlsx";
import Link from "next/link";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { useToast } from "@/components/ui/Toast";
import { GROUP_TEACHERS } from "@/constants/groups";
import { STUDENTS_LIST } from "@/constants/studentsList";
import CashboxDrawer from "./CashboxDrawer";
import CashboxTransferDrawer from "./CashboxTransferDrawer";
import CashboxTransferToDrawer from "./CashboxTransferToDrawer";
import CashboxAdjustDrawer from "./CashboxAdjustDrawer";
import CashboxKirimDrawer from "./CashboxKirimDrawer";
import CashboxDividendDrawer from "./CashboxDividendDrawer";
import CashboxInvestmentDrawer from "./CashboxInvestmentDrawer";
import TransactionDetailDrawer from "./TransactionDetailDrawer";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { type Cashbox } from "@/lib/cashboxes";
import type { HrEmployee } from "@/lib/hrEmployees";
import type { TransactionEntry } from "@/lib/transactionEntries";

const TX_TYPE_MAP: Record<string, string> = { kirim: "payIn", chiqim: "payOut", kochirish: "transfer" };
const TX_TYPE_LABELS: Record<string, string> = { payIn: "Kirim", payOut: "Chiqim", transfer: "Ko'chirish" };

function fmtSignedUZS(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " UZS";
}
function fmtEntryDate(e: TransactionEntry): string {
  const [y, m, d] = e.date.split("-");
  return `${d}.${m}.${y} | ${e.time}`;
}

// Moliya → Kassalar (sidebar: Moliya > Kassalar, href /finance-cash).
// Chapda kassalar ro'yxati (tanlangani kengaytirilgan holda — Kirim/Chiqim/
// Ko'chirish tugmalari bilan), o'ngda tanlangan kassaning to'lov turlari
// bo'yicha statistikasi (drag-and-drop bilan qayta tartiblanadigan, tartib
// localStorage'da saqlanadi) + filtr/tab/jadval. Kassa qo'shish/tahrirlash,
// Kirim/Chiqim (/api/cashboxes/:id/adjust — balans ham o'zgaradi) va
// to'lov turlari/kassalar orasida Ko'chirish (transfer, transfer-to —
// taqsimot o'zgaradi) barchasi HAQIQIY (MongoDB). Har bir amal MongoDB
// `transaction_entries` kolleksiyasiga ham haqiqiy yozuv qo'shadi — shu
// jadval, "Tranzaksiyalar" va "Moliya hisobotlari/analitikasi" sahifalari
// bilan BIR XIL manbadan (lib/transactionLog.ts) foydalanadi.
// Kartadagi mas'ul (moderator) ismi bosilsa — xodim profiliga
// (/management-xodimlar/[id]) o'tadi.

const METHOD_ORDER_KEY = "financeCashMethodOrder";

// Foydalanuvchi tanlagan kartalar tartibi (localStorage). Ro'yxatga
// solishtirish render vaqtida bo'ladi — to'lov turlari Sozlamalardan
// asinxron kelgani uchun bu yerda faqat xom massiv o'qiladi.
function readSavedOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(METHOD_ORDER_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

const selectCls = "h-9 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function fmtUZS(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " UZS";
}
function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function todayRange(): DateRange {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return { start, end: start };
}

export default function CashboxesPage() {
  const { showSuccess, showError } = useToast();
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Accordion: `selectedId` — o'ngdagi statistika/jadval qaysi kassaniki,
  // `expandedId` esa faqat kartaning ochiq/yopiqligi. Ochiq kartani qayta
  // bosish uni yopadi, tanlov esa o'zgarmaydi — o'ng tomondagi ma'lumot
  // yo'qolib qolmasligi uchun.
  const [expandedId, setExpandedId] = useState<number | null>(null);
  function toggleCashbox(id: number) {
    setSelectedId(id);
    setExpandedId((cur) => (cur === id ? null : id));
  }
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">("active");
  const [hideBalances, setHideBalances] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Cashbox | null>(null);
  const [transferState, setTransferState] = useState<{ cashbox: Cashbox; from: string } | null>(null);
  const [transferToTarget, setTransferToTarget] = useState<Cashbox | null>(null);
  const [adjustState, setAdjustState] = useState<{ cashbox: Cashbox; mode: "chiqim" } | null>(null);
  const [kirimTarget, setKirimTarget] = useState<Cashbox | null>(null);
  const [dividendTarget, setDividendTarget] = useState<Cashbox | null>(null);
  const [investmentTarget, setInvestmentTarget] = useState<Cashbox | null>(null);
  const [primaryConfirmTarget, setPrimaryConfirmTarget] = useState<Cashbox | null>(null);
  const [settingPrimary, setSettingPrimary] = useState(false);
  const [moreOpenId, setMoreOpenId] = useState<number | null>(null);

  async function confirmSetPrimary() {
    if (!primaryConfirmTarget) return;
    setSettingPrimary(true);
    try {
      const res = await fetch(`/api/cashboxes/${primaryConfirmTarget.id}/set-primary`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setCashboxes((prev) => prev.map((x) => ({ ...x, isPrimary: x.id === primaryConfirmTarget.id })));
      }
    } finally {
      setSettingPrimary(false);
      setPrimaryConfirmTarget(null);
    }
  }

  // Jadval kartalari uchun BARCHA turlar (nofaol qilingani ham) — eski
  // summalar ko'rinib turishi kerak; tanlash ro'yxatlarida esa faqat faollari.
  const { methods: paymentMethods } = usePaymentMethods();
  const [methodOrder, setMethodOrder] = useState<string[]>([]);
  useEffect(() => {
    // localStorage faqat clientda mavjud — SSR bilan bir xil boshlang'ich
    // holatdan boshlab, hydratsiyadan keyin saqlangan tartibga sinxronlaymiz.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMethodOrder(readSavedOrder());
  }, []);
  const [dragKey, setDragKey] = useState<string | null>(null);

  // Saqlangan tartibni haqiqiy ro'yxatga moslaymiz: o'chirilgan turlar
  // tushib qoladi, Sozlamalarda yangi qo'shilganlari oxiriga qo'shiladi.
  const orderedMethods = useMemo(() => {
    const known = new Set(paymentMethods.map((m) => m.key));
    const kept = methodOrder.filter((k) => known.has(k));
    const missing = paymentMethods.map((m) => m.key).filter((k) => !kept.includes(k));
    return [...kept, ...missing]
      .map((k) => paymentMethods.find((m) => m.key === k))
      .filter((m): m is (typeof paymentMethods)[number] => !!m);
  }, [paymentMethods, methodOrder]);

  function reorderMethod(target: string) {
    if (!dragKey || dragKey === target) return;
    // Amaldagi (ko'rinib turgan) tartibdan boshlaymiz — saqlangan massiv
    // bo'sh yoki chala bo'lishi mumkin, o'shanda indeks topilmay qolardi.
    const current = orderedMethods.map((m) => m.key);
    const sourceIndex = current.indexOf(dragKey);
    const targetIndex = current.indexOf(target);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const next = current.filter((k) => k !== dragKey);
    // Dropping past the target in the drag direction: land right after it
    // when moving forward, right before it when moving backward — so a
    // single drag can move a card any number of positions, not just one.
    let insertAt = next.indexOf(target);
    if (sourceIndex < targetIndex) insertAt += 1;
    next.splice(insertAt, 0, dragKey);

    if (typeof window !== "undefined") window.localStorage.setItem(METHOD_ORDER_KEY, JSON.stringify(next));
    setMethodOrder(next);
  }

  const [dateRange, setDateRange] = useState<DateRange>(() => todayRange());
  const [txType, setTxType] = useState("");
  const [txName, setTxName] = useState("");
  const [student, setStudent] = useState("");
  const [payType, setPayType] = useState("");
  const [teacher, setTeacher] = useState("");
  const [tab, setTab] = useState<"tx" | "app">("tx");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [pageResetKey, setPageResetKey] = useState(selectedId);
  if (selectedId !== pageResetKey) {
    setPageResetKey(selectedId);
    setPage(1);
  }

  const [entries, setEntries] = useState<TransactionEntry[]>([]);
  const [detailEntry, setDetailEntry] = useState<TransactionEntry | null>(null);

  function refreshEntries() {
    fetch("/api/transaction-entries")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setEntries(d.entries); });
  }

  function refreshCashboxes() {
    fetch("/api/cashboxes")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setCashboxes(d.cashboxes); });
  }

  // "Kim" ustunini /student-edit/[id] ga bog'lash uchun — TransactionEntry
  // faqat ismni saqlaydi (id emas), shu sabab STUDENTS_LIST bo'yicha qidiramiz.
  const studentIdByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of STUDENTS_LIST) if (!map.has(s.name)) map.set(s.name, s.id);
    return map;
  }, []);

  // Kassa kartasidagi mas'ul (moderator) ismini xodim profiliga
  // (/management-xodimlar/[id]) bog'lash uchun. Kassada ham faqat ism
  // saqlanadi, shuning uchun xodimlar ro'yxatidan ism bo'yicha qidiramiz.
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const employeeIdByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of employees) {
      const key = e.name.trim().toLowerCase();
      if (!map.has(key)) map.set(key, e.id);
    }
    return map;
  }, [employees]);
  function moderatorProfileId(name: string): number | undefined {
    return employeeIdByName.get(name.trim().toLowerCase());
  }

  // Jadvaldagi "Kim" ustuni: o'quvchi bo'lsa /student-edit/[id] ga, xodim
  // (moderator) bo'lsa /management-xodimlar/[id] ga o'tadi. Qatorning o'zi
  // bosilganda tranzaksiya oynasi ochilgani uchun havola propagatsiyani
  // to'xtatadi — ism bosilganda faqat profilga o'tiladi.
  function renderWhoCell(e: TransactionEntry) {
    const linkCls = "text-primary hover:underline";
    if (e.studentName) {
      const studentId = studentIdByName.get(e.studentName);
      if (studentId === undefined) return e.studentName;
      return (
        <Link href={`/student-edit/${studentId}`} onClick={(ev) => ev.stopPropagation()} className={linkCls}>
          {e.studentName}
        </Link>
      );
    }
    if (e.moderator) {
      const employeeId = moderatorProfileId(e.moderator);
      if (employeeId === undefined) return e.moderator;
      return (
        <Link href={`/management-xodimlar/${employeeId}`} onClick={(ev) => ev.stopPropagation()} className={linkCls}>
          {e.moderator}
        </Link>
      );
    }
    return "—";
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cashboxes")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        setCashboxes(d.cashboxes);
        if (d.cashboxes.length > 0) {
          setSelectedId(d.cashboxes[0].id);
          setExpandedId(d.cashboxes[0].id);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    refreshEntries();
    fetch("/api/hr-employees")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setEmployees(d.employees); });
    return () => { cancelled = true; };
  }, []);

  const filteredList = useMemo(
    () => cashboxes.filter((c) => (statusFilter === "archived" ? c.archived : !c.archived)),
    [cashboxes, statusFilter],
  );
  const selected = useMemo(() => cashboxes.find((c) => c.id === selectedId) || null, [cashboxes, selectedId]);

  function mask(n: number): string {
    return hideBalances ? "••• ••• •••" : fmtUZS(n);
  }

  const studentOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.studentName).filter(Boolean))).sort(),
    [entries],
  );

  // Referensdagi "Tranzaksiya turi" filtri. `txName` — tranzaksiya turlari
  // katalogidan keladigan nom ("O'quvchi to'ladi", "Hodimga avans", ...),
  // yuqoridagi "Tranzaksiya" filtri esa Kirim/Chiqim/Ko'chirish amali bo'yicha.
  // Variantlar mavjud yozuvlardan olinadi — bu faylda studentOptions/teacher
  // ham shunday, va ro'yxatda hech qachon bo'sh natija beradigan band chiqmaydi.
  const txNameOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.txName).filter(Boolean))).sort(),
    [entries],
  );

  const filteredEntries = useMemo(() => {
    if (!selectedId) return [];
    const wantedType = txType ? TX_TYPE_MAP[txType] : "";
    const wantedPayLabel = payType ? paymentMethods.find((m) => m.key === payType)?.name : "";
    const startIso = dateRange.start ? toIso(dateRange.start) : null;
    const endIso = dateRange.end ? toIso(dateRange.end) : null;
    return entries.filter((e) => {
      if (e.cashboxId !== selectedId) return false;
      if (startIso && e.date < startIso) return false;
      if (endIso && e.date > endIso) return false;
      if (wantedType && e.txType !== wantedType) return false;
      if (txName && e.txName !== txName) return false;
      if (student && e.studentName !== student) return false;
      if (wantedPayLabel && e.paymentType !== wantedPayLabel) return false;
      if (teacher && e.moderator !== teacher) return false;
      return true;
    });
    // `paymentMethods` ham bog'liqlikda: to'lov turlari asinxron yuklanadi,
    // ular kelgach "To'lov turi" filtri qayta hisoblanishi kerak.
  }, [entries, selectedId, dateRange, txType, txName, student, payType, teacher, paymentMethods]);

  const entryTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const e of filteredEntries) {
      if (e.amount > 0) income += e.amount;
      else expense += -e.amount;
    }
    return { income, expense };
  }, [filteredEntries]);

  const entryStart = (page - 1) * pageSize;
  const entrySlice = filteredEntries.slice(entryStart, entryStart + pageSize);

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!exportMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportMenuOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [exportMenuOpen]);

  const exportCols: { label: string; get: (e: TransactionEntry) => string | number }[] = [
    { label: "Sana", get: fmtEntryDate },
    { label: "Kim", get: (e) => e.studentName || e.moderator || "" },
    { label: "Izoh", get: (e) => e.note || "" },
    { label: "Tranzaksiya nomi", get: (e) => e.txName || "" },
    { label: "Miqdori", get: (e) => e.amount },
    { label: "Holati", get: (e) => e.status || "" },
    { label: "Tranzaksiya turi", get: (e) => TX_TYPE_LABELS[e.txType] || e.txType },
    { label: "Turi", get: (e) => e.paymentType },
  ];

  function exportEntriesCsv() {
    try {
      const rows = [
        exportCols.map((c) => c.label).join(","),
        ...filteredEntries.map((e) => exportCols.map((c) => `"${String(c.get(e)).replace(/"/g, '""')}"`).join(",")),
      ];
      const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `tranzaksiyalar-${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess("CSV fayl yuklab olindi");
    } catch {
      showError("CSV faylni yuklab bo'lmadi");
    }
  }

  function exportEntriesExcel() {
    try {
      const rows = filteredEntries.map((e) => Object.fromEntries(exportCols.map((c) => [c.label, c.get(e)])));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tranzaksiyalar");
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `tranzaksiyalar-${date}.xlsx`);
      showSuccess("Excel fayl yuklab olindi");
    } catch {
      showError("Excel faylni yuklab bo'lmadi");
    }
  }

  return (
    <div className="page-frame-row p-4 md:p-5 flex flex-col md:flex-row gap-4 items-start">
      {/* Chap panel — kassalar ro'yxati */}
      <aside className="page-frame-aside w-full md:w-[20%] shrink-0 space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddOpen(true)}
            className="flex-1 inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
          >
            <span>+ Yangi kassa qo&apos;shish</span>
          </button>
          <button
            onClick={() => setHideBalances((h) => !h)}
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary text-muted-foreground"
            title={hideBalances ? "Balanslarni ko'rsatish" : "Balanslarni yashirish"}
          >
            {hideBalances ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="relative">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "active" | "archived")} className={`${selectCls} w-full`}>
            <option value="active">Aktiv</option>
            <option value="archived">Arxiv</option>
          </select>
          <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>

        <div className="space-y-2">
          {filteredList.map((c) => {
            const isSelected = c.id === selectedId;
            const isExpanded = c.id === expandedId;
            return (
              <div
                key={c.id}
                onClick={() => toggleCashbox(c.id)}
                className={`rounded-2xl border bg-card p-4 cursor-pointer transition-colors ${
                  isSelected ? "border-primary shadow-sm" : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {c.isPrimary && <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="currentColor" />}
                      <div className="font-semibold text-[14px] truncate">{c.name}</div>
                    </div>
                    <div className="text-[12.5px] text-muted-foreground mt-0.5 truncate">
                      {!c.moderator ? (
                        "mas'ul belgilanmagan"
                      ) : moderatorProfileId(c.moderator) ? (
                        <Link
                          href={`/management-xodimlar/${moderatorProfileId(c.moderator)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-primary hover:underline"
                        >
                          {c.moderator}
                        </Link>
                      ) : (
                        c.moderator
                      )}
                    </div>
                    <div className="text-[18px] font-bold tabular-nums mt-1">{mask(c.balance)}</div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground shrink-0 mt-1 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                  />
                </div>

                <div
                  className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${isExpanded ? "max-h-[600px]" : "max-h-0"}`}
                >
                  <div className="mt-3 pt-3 border-t border-border space-y-3" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        To&apos;lov turi bo&apos;yicha qoldiq
                      </div>
                      {/* Har bir to'lov turi alohida qator: yupqa ajratuvchi
                          chiziq + navbatma-navbat fon — tor panelda ham qaysi
                          summa qaysi turga tegishli ekani darrov ko'rinadi. */}
                      <div className="rounded-xl border border-border overflow-hidden">
                        {orderedMethods.map((m, i) => (
                          <div
                            key={m.key}
                            className={`flex items-center justify-between gap-2 px-2.5 py-1.5 text-[13px] ${
                              i > 0 ? "border-t border-border" : ""
                            } ${i % 2 === 1 ? "bg-secondary/70" : ""}`}
                          >
                            <span className="text-muted-foreground truncate">{m.name}</span>
                            <span className="font-medium tabular-nums shrink-0">{mask(c.methodTotals[m.key] ?? 0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setKirimTarget(c)} className="flex-1 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[12.5px] font-medium">+ Kirim</button>
                      <button onClick={() => setAdjustState({ cashbox: c, mode: "chiqim" })} className="flex-1 h-8 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[12.5px] font-medium">- Chiqim</button>
                      <button onClick={() => setTransferToTarget(c)} className="flex-1 h-8 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-[12.5px] font-medium">Ko&apos;chirish</button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setEditTarget(c)} className="flex-1 h-8 rounded-lg border border-border hover:bg-secondary text-[12.5px] font-medium">Tahrirlash</button>
                      {!c.isPrimary && (
                        <button onClick={() => setPrimaryConfirmTarget(c)} className="flex-1 h-8 rounded-lg border border-border hover:bg-secondary text-[12.5px] font-medium">Asosiy qilish</button>
                      )}
                    </div>

                    <button
                      onClick={() => setMoreOpenId((id) => (id === c.id ? null : c.id))}
                      className="text-[12px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                    >
                      {moreOpenId === c.id ? "Kamroq" : "Yana…"}
                    </button>
                    {moreOpenId === c.id && (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setDividendTarget(c)} className="flex-1 h-8 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[12.5px] font-medium">Divident</button>
                        <button onClick={() => setInvestmentTarget(c)} className="flex-1 h-8 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[12.5px] font-medium">Sarmoya</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filteredList.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">{loading ? "Yuklanmoqda…" : "Kassa topilmadi"}</div>
          )}
        </div>
      </aside>

      {/* O'ng qism — tanlangan kassa */}
      <div className="page-frame-col flex-1 min-w-0 space-y-3">
        <div className="flex gap-3 overflow-x-auto pb-1">
          {orderedMethods.map((m) => (
            <div
              key={m.key}
              draggable
              onDragStart={() => setDragKey(m.key)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => reorderMethod(m.key)}
              onDragEnd={() => setDragKey(null)}
              className={`shrink-0 w-[160px] relative rounded-xl bg-primary text-white p-4 cursor-grab active:cursor-grabbing transition-opacity ${dragKey === m.key ? "opacity-50" : ""}`}
            >
              <div className="text-[13px] font-medium">{m.name}</div>
              <div className="text-[15px] font-bold tabular-nums mt-1">{selected ? mask(selected.methodTotals[m.key]) : mask(0)}</div>
              <button
                onClick={() => selected && setTransferState({ cashbox: selected, from: m.key })}
                disabled={!selected}
                className="text-[12px] text-white/80 hover:text-white mt-1 underline-offset-2 hover:underline disabled:opacity-60 disabled:no-underline absolute top-3 right-3"
              >
                Ko&apos;chirish
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportMenuOpen((o) => !o)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary text-muted-foreground"
              title="Sozlamalar"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {exportMenuOpen && (
              <div className="absolute top-full left-0 mt-2 z-50 w-64 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1">
                <button
                  type="button"
                  onClick={() => { exportEntriesCsv(); setExportMenuOpen(false); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <FileText className="icon icon-sm" />
                  </span>
                  <span>CSV faylini yuklab olish</span>
                </button>
                <button
                  type="button"
                  onClick={() => { exportEntriesExcel(); setExportMenuOpen(false); }}
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
          <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} className="w-56" />
          <div className="relative">
            <select value={txType} onChange={(e) => { setTxType(e.target.value); setPage(1); }} className={`${selectCls} w-36`}>
              <option value="">Tranzaksiya</option>
              <option value="kirim">Kirim</option>
              <option value="chiqim">Chiqim</option>
              <option value="kochirish">Ko&apos;chirish</option>
            </select>
            <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
          <div className="relative">
            <select value={txName} onChange={(e) => { setTxName(e.target.value); setPage(1); }} className={`${selectCls} w-40`}>
              <option value="">Tranzaksiya turi</option>
              {txNameOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
          <div className="relative">
            <select value={student} onChange={(e) => { setStudent(e.target.value); setPage(1); }} className={`${selectCls} w-36`}>
              <option value="">O&apos;quvchi</option>
              {studentOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
          <div className="relative">
            <select value={payType} onChange={(e) => { setPayType(e.target.value); setPage(1); }} className={`${selectCls} w-36`}>
              <option value="">To&apos;lov turi</option>
              {paymentMethods.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
            </select>
            <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
          <div className="relative">
            <select value={teacher} onChange={(e) => { setTeacher(e.target.value); setPage(1); }} className={`${selectCls} w-40`}>
              <option value="">O&apos;qituvchi</option>
              {GROUP_TEACHERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="inline-flex items-center rounded-lg border border-border bg-card p-1">
            <button onClick={() => setTab("tx")} className={`h-8 px-4 rounded-md text-sm font-medium ${tab === "tx" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}>
              Tranzaksiya
            </button>
            <button onClick={() => setTab("app")} className={`h-8 px-4 rounded-md text-sm font-medium ${tab === "app" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}>
              Ilova Orqali To&apos;lov
            </button>
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <span className="text-emerald-600 font-medium tabular-nums">↙ {fmtUZS(entryTotals.income)}</span>
            <span className="text-rose-600 font-medium tabular-nums">↗ {fmtUZS(entryTotals.expense)}</span>
            <span className="relative text-muted-foreground">
              <Bell className="w-4 h-4" />
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 text-xs">
            <span className="text-muted-foreground">Umumiy soni:</span>
            <span className="font-bold tabular-nums">{filteredEntries.length}</span>
          </div>
        </div>

        <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">Sana</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">Kim</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">Izoh</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">Tranzaksiya nomi</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">Miqdori</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">Holati</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">Tranzaksiya turi</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">Turi</th>
                </tr>
              </thead>
              <tbody>
                {entrySlice.map((e, i) => (
                  // Qatorning istalgan joyiga bosilsa — tranzaksiya oynasi
                  // (to'lovni bekor qilish) ochiladi. Faqat "Kim" ustunidagi
                  // ism bundan mustasno: u profil sahifasiga o'tadi
                  // (renderWhoCell).
                  <tr
                    key={e.id}
                    onClick={() => setDetailEntry(e)}
                    className={`border-b border-border/50 cursor-pointer hover:bg-secondary/40 ${e.status === "cancelled" ? "bg-rose-50" : ""}`}
                  >
                    <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{entryStart + i + 1}</td>
                    <td className="px-3 py-3 text-[13px] tabular-nums whitespace-nowrap">{fmtEntryDate(e)}</td>
                    <td className="px-3 py-3 text-[13px] whitespace-nowrap">{renderWhoCell(e)}</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">{e.note || "—"}</td>
                    <td className="px-3 py-3 text-[13px]">{e.txName || "—"}</td>
                    <td className={`px-3 py-3 text-[13px] tabular-nums font-medium ${e.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtSignedUZS(e.amount)}</td>
                    <td className="px-3 py-3 text-[13px]">{e.status || "—"}</td>
                    <td className="px-3 py-3 text-[13px]">{TX_TYPE_LABELS[e.txType] || e.txType}</td>
                    <td className="px-3 py-3 text-[13px]">{e.paymentType}</td>
                  </tr>
                ))}
                {entrySlice.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-16 text-center">
                      <div className="text-[14px] font-semibold">Ma&apos;lumotlar topilmadi</div>
                      <div className="text-[12px] text-muted-foreground mt-1">Filterni o&apos;zgartirib ko&apos;ring.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination totalItems={filteredEntries.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </div>
      </div>

      {addOpen && (
        <CashboxDrawer onClose={() => setAddOpen(false)} onSaved={(c) => { setCashboxes((prev) => [...prev, c]); setSelectedId(c.id); setExpandedId(c.id); }} />
      )}
      {editTarget && (
        <CashboxDrawer
          cashbox={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(c) => setCashboxes((prev) => prev.map((x) => (x.id === c.id ? c : x)))}
          onDeleted={(id) => {
            setCashboxes((prev) => {
              const next = prev.filter((x) => x.id !== id);
              if (selectedId === id) setSelectedId(next.length > 0 ? next[0].id : null);
              if (expandedId === id) setExpandedId(next.length > 0 ? next[0].id : null);
              return next;
            });
          }}
        />
      )}
      {transferState && (
        <CashboxTransferDrawer
          cashbox={transferState.cashbox}
          initialFrom={transferState.from}
          onClose={() => setTransferState(null)}
          onSaved={(c) => { setCashboxes((prev) => prev.map((x) => (x.id === c.id ? c : x))); refreshEntries(); }}
        />
      )}
      {adjustState && (
        <CashboxAdjustDrawer
          cashbox={adjustState.cashbox}
          mode={adjustState.mode}
          onClose={() => setAdjustState(null)}
          onSaved={(c) => { setCashboxes((prev) => prev.map((x) => (x.id === c.id ? c : x))); refreshEntries(); }}
        />
      )}
      {kirimTarget && (
        <CashboxKirimDrawer
          cashbox={kirimTarget}
          onClose={() => setKirimTarget(null)}
          onSaved={(c) => { setCashboxes((prev) => prev.map((x) => (x.id === c.id ? c : x))); refreshEntries(); }}
        />
      )}
      {dividendTarget && (
        <CashboxDividendDrawer
          cashbox={dividendTarget}
          onClose={() => setDividendTarget(null)}
          onSaved={(c) => { setCashboxes((prev) => prev.map((x) => (x.id === c.id ? c : x))); refreshEntries(); }}
        />
      )}
      {investmentTarget && (
        <CashboxInvestmentDrawer
          cashbox={investmentTarget}
          onClose={() => setInvestmentTarget(null)}
          onSaved={(c) => { setCashboxes((prev) => prev.map((x) => (x.id === c.id ? c : x))); refreshEntries(); }}
        />
      )}
      {transferToTarget && (
        <CashboxTransferToDrawer
          cashbox={transferToTarget}
          cashboxes={cashboxes}
          onClose={() => setTransferToTarget(null)}
          onSaved={({ from, to }) => {
            setCashboxes((prev) => prev.map((x) => (x.id === from.id ? from : x.id === to.id ? to : x)));
            refreshEntries();
          }}
        />
      )}
      {detailEntry && (
        <TransactionDetailDrawer
          entry={detailEntry}
          cashboxName={cashboxes.find((c) => c.id === detailEntry.cashboxId)?.name || ""}
          studentId={detailEntry.studentName ? studentIdByName.get(detailEntry.studentName) : undefined}
          onClose={() => setDetailEntry(null)}
          onCancelled={(updated) => {
            setEntries((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
            setDetailEntry(updated);
            refreshCashboxes();
          }}
        />
      )}
      {primaryConfirmTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !settingPrimary && setPrimaryConfirmTarget(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6">
            <p className="text-center text-[15px] font-semibold">Bosh kassa qilmoqchimisiz?</p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={() => setPrimaryConfirmTarget(null)} disabled={settingPrimary} className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
                Yo&apos;q
              </button>
              <button onClick={confirmSetPrimary} disabled={settingPrimary} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
                {settingPrimary ? "Saqlanmoqda…" : "Ha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
