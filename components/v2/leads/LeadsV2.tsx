"use client";

import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Inbox,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Search,
  Settings,
  SquareArrowOutUpRight,
  UserRound,
  X,
} from "lucide-react";
import Link from "@/components/ui/Link";
import { useToast } from "@/components/ui/Toast";
import { useBranch } from "@/components/shared/BranchContext";
import { useLang, useT } from "@/components/shared/Language";
import AddOrderModal, { type NewOrderValues } from "@/components/orders/AddOrderModal";
import OrderMessagePanel from "@/components/orders/OrderMessagePanel";
import { useOrders } from "@/components/orders/OrdersContext";
import SmsModal from "@/components/orders/SmsModal";
import LeadReceiptModal from "@/components/leads/LeadReceipt";
import { postHolat } from "@/components/leads/LeadHolatModals";
import { useLeadFmt, type LeadRow } from "@/components/leads/leadsCommon";
import { copySurveyLink, exportLeadsCsv, exportLeadsExcel, leadReceiptRows } from "@/components/leads/leadsExport";
import { useLeadsCore } from "@/components/leads/useLeadsCore";
import StudentPaymentModalV2 from "@/components/v2/finance/StudentPaymentModalV2";
import { useCanOpen } from "@/components/v2/shell/ShellContext";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import ColumnsControl from "@/components/v2/ui/ColumnsControl";
import StaffName from "@/components/v2/ui/StaffName";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2DateRange, { rangeLabel, rangePresetKey, v2PresetLabel } from "@/components/v2/ui/V2DateRange";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import V2Select, { type V2SelectOption } from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { DENSITY_CELL, DENSITY_ROW } from "@/components/v2/ui/columnPrefs";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { roomLabel } from "@/components/v2/ui/groupStatus";
import { ROW_BAR, ROW_TINT } from "@/components/v2/ui/table";
import { dateRangePresets, type DateRange } from "@/components/ui/DateRangePicker";
import { useTeachers } from "@/hooks/useTeachers";
import { collapseBranchPools, sameBranchPool } from "@/lib/branchPools";
import type { Group } from "@/lib/groups";
import { sinovOf, type LeadHolat } from "@/lib/leadHolat";
import { BOT_SOURCE, SURVEY_SOURCE } from "@/lib/leadSettings";
import { orderNo, type Order } from "@/lib/ordersData";
import { uzDateOf } from "@/lib/staffTasks";
import { studentRowFromPupil, type StudentRow } from "@/lib/studentsData";
import LeadGroupModalV2, { type GroupJoined } from "./LeadGroupModalV2";
import LeadPanelV2 from "./LeadPanelV2";
import LeadRadModalV2 from "./LeadRadModalV2";
import LeadSinovModalV2 from "./LeadSinovModalV2";
import { HolatBadge } from "./leadBits";
import { useLeadColumns, type LeadColumnKey, type LeadSortKey } from "./leadsColumns";
import { HOLAT_ORDER, HOLAT_V2, LATE_MS, initialsOf, isoOfDate, levelShort, nextRank, nextStepOf, phoneParts, qulayVaqtText, useLeadV2Fmt, type NextStep } from "./leadUtils";

// YANGI VERSIYA — LIDLAR RO'YXATI (5-qism, rasmlar «Lidlar · namuna ma'lumot»,
// «Lid paneli», «Guruhga qo'shish oynasi», yorug'/qorong'i, 20.10.2026):
//
//   1. sarlavha: «Lidlar» + «filial · shu oy N ta lid»; «So'rovnoma havolasi»
//      (nusxalash / ochish), «⋯» (Excel, CSV, sozlamalar), «+ Lid qo'shish»;
//   2. holat kartalari — Barchasi · Yangi («N tasi 24 soatdan oshdi») ·
//      Bog'lanildi · Birinchi darsga yozildi («shu hafta») · Guruhga qo'shildi ·
//      Rad etdi; bosilsa jadval shu holatga filtrlanadi;
//   3. filtrlar: «Ism yoki telefon», Yo'nalish, Manba, Filial, davr («Shu oy» —
//      sukut), «Bugun birinchi dars · N» tezkor filtri; o'ngda «Ustunlar»;
//   4. jadval: Lid (avatar, ism, telefon, takroriy raqam belgisi) · Yo'nalish
//      (fan nuqtasi + kurs · daraja) · Holat · KEYINGI QADAM (nima qilish kerak —
//      sukut saralash shu bo'yicha, shoshilinchi tepada) · Manba · Qo'shilgan ·
//      Mas'ul; qator bosilsa — o'ngda LID PANELI (./LeadPanelV2.tsx);
//   5. sahifalash.
//
// Ma'lumot, holat o'tishlari, eksport va so'rovlar eski sahifa bilan BITTA
// (components/leads/useLeadsCore.ts, leadsExport.ts, LeadHolatModals.tsx →
// postHolat, lib/enrollStudent.ts). Lid qo'shish/tahrirlash oynasi, SMS, chek va
// izohlar — hozircha eski. Taxminlar: design/v2/SAVOLLAR.md 87–98.

interface SortState {
  key: LeadSortKey;
  dir: "asc" | "desc";
}

const DEFAULT_SORT: SortState = { key: "next", dir: "asc" };

function nextSort(s: SortState | null, key: LeadSortKey): SortState | null {
  const first: SortState["dir"] = key === "created" ? "desc" : "asc";
  if (!s || s.key !== key) return { key, dir: first };
  if (s.dir === first) return { key, dir: first === "asc" ? "desc" : "asc" };
  return null;
}

type HolatModal = { kind: "sinov" | "guruh" | "rad"; id: number };
type OrderModal = { mode: "add" } | { mode: "edit"; order: Order };

const monthRange = (): DateRange => dateRangePresets().find((p) => p.key === "month")?.range() ?? { start: null, end: null };

/** «Vaqt to'g'ri kelmadi» → «vaqt to'g'ri kelmadi» (jumla ichida). */
const lowerFirst = (s: string) => (s ? s.charAt(0).toLocaleLowerCase() + s.slice(1) : s);

function fmtNum(n: number): string {
  return n.toLocaleString("ru-RU").replace(/,/g, " ");
}

export default function LeadsV2({ isAdmin, canSettings }: { isAdmin: boolean; canSettings: boolean }) {
  const { t } = useT();
  const [lang] = useLang();
  const f = useLeadV2Fmt();
  const lf = useLeadFmt();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const branch = useBranch();
  const { showToast, showSuccess, showError } = useToast();
  const { orders, loading, createOrder, updateOrder, patchOrder, messagesByOrder, addMessage, replaceOrder, reload } = useOrders();
  const { teachers } = useTeachers();
  const { settings, groups, loadGroups, reloadGroups, nowMs, setClock, rows, branches, branchById } = useLeadsCore();
  const columns = useLeadColumns();
  const canPay = useCanOpen("/finance-cash");
  const canStudents = useCanOpen("/students-list");
  const canGroups = useCanOpen("/groups");
  const canFirstLessons = useCanOpen("/first-lessons");

  // Guruhlar — «Keyingi qadam» dagi xona va oynalar uchun (sahifa ochilganda bir marta).
  useEffect(() => {
    loadGroups();
  }, [loadGroups]);
  const groupList = useMemo<Group[]>(() => groups ?? [], [groups]);

  /* ---- Filtrlar ---- */
  const [search, setSearch] = useState("");
  const [yon, setYon] = useState("");
  const [manba, setManba] = useState("");
  const [filial, setFilial] = useState("");
  const [range, setRange] = useState<DateRange>(monthRange);
  const [todayOnly, setTodayOnly] = useState(false);
  const [holat, setHolat] = useState<LeadHolat | "">("");
  const [sort, setSort] = useState<SortState | null>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const resetPage = () => setPage(1);

  const today = uzDateOf(nowMs);
  const rangeFrom = range.start ? isoOfDate(range.start) : "";
  const rangeTo = range.start ? isoOfDate(range.end ?? range.start) : "";

  // Davr va holatdan tashqari filtrlar (qidiruv, yo'nalish, manba, filial).
  const pre = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return rows.filter((r) => {
      if (q) {
        const byName = (r.o.name || "").toLowerCase().includes(q);
        const byPhone = qDigits.length >= 3 && (r.o.phone || "").replace(/\D/g, "").includes(qDigits);
        const byNo = /^#?\d+$/.test(q) && String(orderNo(r.o)) === q.replace("#", "");
        if (!byName && !byPhone && !byNo) return false;
      }
      // Maydoni yo'q eski lidlar — 1-filial (lib/branchScope.ts qoidasi), hovuz — bitta qator.
      if (filial && !sameBranchPool(r.o.branchId ?? 1, Number(filial))) return false;
      if (yon.startsWith("y:") && r.yon !== yon.slice(2)) return false;
      if (yon.startsWith("c:") && (r.o.course || "") !== yon.slice(2)) return false;
      if (manba && (r.o.source || "") !== manba) return false;
      return true;
    });
  }, [rows, search, filial, yon, manba]);

  const isTodayLesson = (r: LeadRow) => r.holat === "sinov" && sinovOf(r.o)?.sana === today;
  const todayCount = pre.filter(isTodayLesson).length;
  // «Bugun birinchi dars» — davrdan qat'i nazar (o'tgan oy qo'shilgan lidning darsi ham bugun bo'lishi mumkin).
  const base = useMemo(
    () =>
      pre.filter((r) => {
        if (todayOnly) return r.holat === "sinov" && sinovOf(r.o)?.sana === today;
        if (!rangeFrom) return true;
        if (!Number.isFinite(r.at)) return false;
        const d = uzDateOf(r.at);
        return d >= rangeFrom && d <= rangeTo;
      }),
    [pre, todayOnly, today, rangeFrom, rangeTo],
  );

  const counts = useMemo(() => {
    const c: Record<LeadHolat, number> = { yangi: 0, bog: 0, sinov: 0, guruh: 0, rad: 0 };
    for (const r of base) c[r.holat]++;
    return c;
  }, [base]);
  const lateCount = base.filter((r) => r.holat === "yangi" && Number.isFinite(r.at) && nowMs - r.at > LATE_MS).length;
  const week = dateRangePresets().find((p) => p.key === "week")?.range();
  const weekFrom = week?.start ? isoOfDate(week.start) : "";
  const weekTo = week?.end ? isoOfDate(week.end) : "";
  const weekCount = base.filter((r) => {
    const s = r.holat === "sinov" ? sinovOf(r.o) : null;
    return !!s && s.sana >= weekFrom && s.sana <= weekTo;
  }).length;

  const list = useMemo(() => (holat ? base.filter((r) => r.holat === holat) : base), [base, holat]);
  const steps = useMemo(() => new Map(list.map((r) => [r.o.id, nextStepOf(r, nowMs, groupList)])), [list, nowMs, groupList]);
  const sorted = useMemo(() => {
    if (!sort) return list;
    const sign = sort.dir === "asc" ? 1 : -1;
    const out = [...list];
    out.sort((a, b) => {
      let c = 0;
      if (sort.key === "name") c = (a.o.name || "").localeCompare(b.o.name || "", "uz");
      else if (sort.key === "created") {
        const va = Number.isFinite(a.at) ? a.at : -Infinity;
        const vb = Number.isFinite(b.at) ? b.at : -Infinity;
        c = va === vb ? 0 : va < vb ? -1 : 1;
      } else {
        const ra = nextRank(steps.get(a.o.id) as NextStep, a);
        const rb = nextRank(steps.get(b.o.id) as NextStep, b);
        c = ra[0] - rb[0] || ra[1] - rb[1];
      }
      return c !== 0 ? c * sign : b.o.id - a.o.id;
    });
    return out;
  }, [list, sort, steps]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const slice = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /* ---- Davr yozuvlari ---- */
  const presetKey = rangePresetKey(range);
  const preset = presetKey ? dateRangePresets().find((p) => p.key === presetKey) : undefined;
  const rangeText = !range.start ? t("Butun davr") : preset ? t(v2PresetLabel(preset)) : rangeLabel(range, lang, t);
  /** Jumla ichidagi davr: «shu oy», «bugun», «1–15-oktyabr». */
  const periodLower = todayOnly ? t("bugun birinchi darsi bor") : !range.start ? t("jami") : preset ? lowerFirst(t(v2PresetLabel(preset))) : rangeLabel(range, lang, t);

  /* ---- Variantlar ---- */
  const yonOptions = useMemo<V2SelectOption[]>(() => {
    const ys = settings?.yonalishlar ?? [];
    const courses = [...new Set(rows.map((r) => (r.o.course || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "uz"));
    const yonOf = (c: string) => ys.find((y) => y.fanlar.some((x) => x.nom === c))?.nom ?? "";
    return [
      ...ys.map((y) => ({ value: `y:${y.id}`, label: t(y.nom), hint: t("hammasi") })),
      ...courses.map((c) => ({ value: `c:${c}`, label: t(c), hint: yonOf(c) ? t(yonOf(c)) : undefined })),
    ];
  }, [settings, rows, t]);
  const manbaOptions = useMemo<V2SelectOption[]>(() => {
    const seen = new Set(orders.map((o) => (o.source || "").trim()).filter(Boolean));
    seen.delete(SURVEY_SOURCE);
    seen.delete(BOT_SOURCE);
    return [SURVEY_SOURCE, BOT_SOURCE, ...[...seen].sort((a, b) => a.localeCompare(b))].map((s) => ({ value: s, label: t(s) }));
  }, [orders, t]);
  const branchOptions = useMemo<V2SelectOption[]>(() => collapseBranchPools(branches).map((b) => ({ value: String(b.id), label: b.name })), [branches]);

  const anyFilter = !!(search.trim() || yon || manba || filial || holat || todayOnly);
  const clearAll = () => {
    setSearch("");
    setYon("");
    setManba("");
    setFilial("");
    setHolat("");
    setTodayOnly(false);
    setRange({ start: null, end: null });
    resetPage();
  };

  /* ---- Panel, oynalar ---- */
  const [openId, setOpenId] = useState<number | null>(null);
  const [modal, setModal] = useState<HolatModal | null>(null);
  const [busy, setBusy] = useState(false);
  const [orderModal, setOrderModal] = useState<OrderModal | null>(null);
  const [smsFor, setSmsFor] = useState<Order | null>(null);
  const [receiptFor, setReceiptFor] = useState<Order | null>(null);
  const [messageFor, setMessageFor] = useState<Order | null>(null);
  const [payFor, setPayFor] = useState<{ student: StudentRow; groups: Group[] } | null>(null);

  // «+ Yangi → Lid» (yuqori panel) `?add=1` bilan keladi — parametr oynaning holati.
  const addFromUrl = searchParams.get("add") === "1";
  const activeOrderModal: OrderModal | null = addFromUrl ? { mode: "add" } : orderModal;
  const closeOrderModal = () => {
    setOrderModal(null);
    if (addFromUrl) router.replace(pathname, { scroll: false });
  };

  const openRow = openId !== null ? (rows.find((r) => r.o.id === openId) ?? null) : null;
  const modalRow = modal ? (rows.find((r) => r.o.id === modal.id) ?? null) : null;
  const branchName = (r: LeadRow | null) => (r ? (branchById.get(r.o.branchId ?? 1)?.name ?? "") : "");
  const anyModal = !!(modal || activeOrderModal || smsFor || receiptFor || messageFor || payFor);

  // Esc — panelni yopadi; ustida oyna ochiq bo'lsa avval o'sha yopiladi.
  useEffect(() => {
    if (openId === null || anyModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openId, anyModal]);

  const onConflict = () => void reload();

  /** Holat saqlandi: ro'yxatda yangilash, soat (bekor qilish muddati), toast + «Bekor qilish». */
  function holatDone(order: Order, title: string, withUndo = true) {
    replaceOrder(order);
    setClock(Date.now());
    showToast({
      tone: "success",
      title,
      detail: order.name,
      action: withUndo ? { label: t("Bekor qilish"), onClick: () => void undo(order.id) } : undefined,
    });
  }

  async function undo(id: number) {
    setBusy(true);
    const r = await postHolat(id, { action: "undo" });
    setBusy(false);
    if (!r.ok) {
      showToast({ tone: "error", title: t("Bekor qilib bo'lmadi"), detail: t(r.error) });
      if (/o'zgargan/.test(r.error)) onConflict();
      return;
    }
    replaceOrder(r.order);
    setClock(Date.now());
    showToast({ tone: "success", title: t("Oldingi holatga qaytarildi"), detail: r.order.name });
  }

  async function go(row: LeadRow, to: LeadHolat) {
    if (to === "sinov" || to === "rad") return setModal({ kind: to, id: row.o.id });
    if (to === "guruh") {
      loadGroups();
      return setModal({ kind: "guruh", id: row.o.id });
    }
    setBusy(true);
    const r = await postHolat(row.o.id, { to });
    setBusy(false);
    if (!r.ok) {
      showToast({ tone: "error", title: t("Saqlab bo'lmadi"), detail: t(r.error) });
      if (/o'zgargan/.test(r.error)) onConflict();
      return;
    }
    holatDone(r.order, t("Holat: {holat}", { holat: t(HOLAT_V2[to].card) }));
  }

  function joined(order: Order, info: GroupJoined) {
    replaceOrder(order);
    setClock(Date.now());
    reloadGroups();
    const pupil = info.pupil;
    showToast({
      tone: "success",
      title: t("Guruhga qo'shildi — o'quvchi O'quvchilar bo'limiga o'tdi"),
      detail: [order.name, [info.group.course || info.group.name, info.group.teacher].filter(Boolean).join(" · ")].filter(Boolean),
      action: pupil && canStudents ? { label: t("Profilni ochish"), onClick: () => router.push(`/student-edit/${pupil.id}`) } : undefined,
    });
    if (info.openPay && pupil) {
      // To'lov oynasi o'quvchini shu guruh bilan ko'rsin (guruh va o'qituvchi tanlangan holda).
      const withPupil = groupList.map((g) => (g.id === info.group.id ? { ...g, studentIds: [...new Set([...(g.studentIds ?? []), pupil.id])] } : g));
      setPayFor({ student: studentRowFromPupil(pupil), groups: withPupil });
    }
  }

  async function saveNote(row: LeadRow, note: string): Promise<boolean> {
    const updated = await patchOrder(row.o.id, { note });
    if (!updated) {
      showError(t("Izohni saqlab bo'lmadi"));
      return false;
    }
    showSuccess(t("Izoh saqlandi"));
    return true;
  }

  async function saveOrder(values: NewOrderValues) {
    if (!activeOrderModal) return;
    if (activeOrderModal.mode === "edit") {
      const updated = await updateOrder(activeOrderModal.order.id, values);
      if (!updated) return showError(t("Lidni yangilab bo'lmadi. Qaytadan urinib ko'ring"));
      showSuccess(t("Lid yangilandi"));
    } else {
      const created = await createOrder(values);
      if (!created) return showError(t("Lidni qo'shib bo'lmadi. Qaytadan urinib ko'ring"));
      // Yangi lid ko'rinsin — filtrlar tozalanadi (davr qoladi: lid hozir qo'shildi).
      setSearch("");
      setYon("");
      setManba("");
      setFilial("");
      setHolat("");
      setTodayOnly(false);
      resetPage();
      showToast({ tone: "success", title: t("Lid qo'shildi"), detail: created.name, action: { label: t("Ochish"), onClick: () => setOpenId(created.id) } });
    }
    closeOrderModal();
  }

  /* ---- Eksport ---- */
  // Belgilanganlar — filtr o'zgargan bo'lsa ham hammasi (son tanlov qatoridagidek).
  const exportRows = selected.size > 0 ? rows.filter((r) => selected.has(r.o.id)) : sorted;
  const toastFns = { showSuccess, showError };
  const headerMenu: ActionMenuEntry[] = [
    { key: "h", heading: selected.size > 0 ? t("Belgilanganlar: {n} ta", { n: selected.size }) : t("Ro'yxatdagilar: {n} ta", { n: sorted.length }) },
    { key: "xls", label: t("Excel fayl"), hint: "XLSX", icon: Download, onSelect: () => void exportLeadsExcel(exportRows, settings, lf, branchName, toastFns) },
    { key: "csv", label: t("CSV fayl"), hint: "CSV", icon: Download, onSelect: () => exportLeadsCsv(exportRows, settings, lf, branchName, toastFns) },
    ...(canSettings || canFirstLessons ? [{ key: "d", divider: true as const }] : []),
    ...(canFirstLessons ? [{ key: "fl", label: t("Birinchi darsga yozilganlar"), icon: Clock, href: "/first-lessons" }] : []),
    ...(canSettings ? [{ key: "set", label: t("Lidlar sozlamalari"), icon: Settings, href: "/settings-sales?tab=leads" }] : []),
  ];
  const surveyMenu: ActionMenuEntry[] = [
    { key: "copy", label: t("Havolani nusxalash"), icon: Copy, onSelect: () => void copySurveyLink(t, toastFns) },
    { key: "open", label: t("So'rovnoma sahifasini ochish"), icon: ExternalLink, onSelect: () => window.open("/sorovnoma", "_blank", "noopener,noreferrer") },
  ];

  /* ---- Belgilash ---- */
  const pageIds = slice.map((r) => r.o.id);
  const pageSelected = pageIds.filter((id) => selected.has(id)).length;
  const togglePage = () =>
    setSelected((s) => {
      const next = new Set(s);
      if (pageSelected === pageIds.length) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  const toggleOne = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* ---- Jadval ---- */
  const visibleCols = columns.shown;
  const rowH = DENSITY_ROW[columns.density];
  const cellY = DENSITY_CELL[columns.density];
  const colCount = visibleCols.length + 3;
  const th = "sticky top-0 z-10 whitespace-nowrap bg-v2-surface-2 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";
  const dash = <span className="text-v2-text-3">—</span>;

  function sortHead(label: string, k: LeadSortKey) {
    const on = sort?.key === k;
    const Icon = on && sort?.dir === "desc" ? ArrowDown : ArrowUp;
    return (
      <button
        type="button"
        onClick={() => {
          setSort((s) => nextSort(s, k));
          resetPage();
        }}
        aria-label={t("{col} bo'yicha saralash", { col: label })}
        className={`group/sort inline-flex items-center gap-1 rounded-v2-sm hover:text-v2-text ${on ? "font-semibold text-v2-text" : ""}`}
      >
        {label}
        <Icon className={`size-3.5 ${on ? "opacity-60" : "opacity-0 group-hover/sort:opacity-60"}`} strokeWidth={2} aria-hidden />
      </button>
    );
  }

  function nextCell(r: LeadRow): ReactNode {
    const s = steps.get(r.o.id);
    if (!s) return dash;
    const act = (label: string, extra?: string, warn = false) => (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        {warn ? <Clock className="size-4 shrink-0 text-v2-warning" strokeWidth={1.75} aria-hidden /> : <ArrowRight className="size-4 shrink-0 text-v2-brand" strokeWidth={2} aria-hidden />}
        <span className={`font-semibold ${warn ? "text-v2-warning" : "text-v2-text"}`}>{label}</span>
        {extra && <span className="text-v2-text-2">· {extra}</span>}
      </span>
    );
    switch (s.kind) {
      case "lessonToday":
        return (
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span className="rounded-v2-sm bg-v2-warning px-1.5 py-0.5 text-v2-caption font-semibold text-v2-on-color">{t("Bugun birinchi dars")}</span>
            {s.vaqt && <span className="font-semibold tabular-nums text-v2-text">{s.vaqt}</span>}
            {s.room && <span className="text-v2-text-2">· {roomLabel(s.room)}</span>}
          </span>
        );
      case "call":
        return act(t("Qo'ng'iroq qilish"), s.dup ? t("takroriy raqam") : f.since(s.since), s.late);
      case "schedule":
        return act(t("Birinchi darsga yozish"));
      case "lessonSoon":
        return (
          <span className="whitespace-nowrap text-v2-text-2">
            {s.vaqt ? t("{when}, {time} birinchi dars", { when: f.lessonDay(s.sana, nowMs), time: s.vaqt }) : t("{when} birinchi dars", { when: f.lessonDay(s.sana, nowMs) })}
          </span>
        );
      case "lessonPast":
        return s.missed ? act(t("Boshqa kunga yozish"), t("kelmadi"), true) : act(t("Guruhga qo'shish"), t("dars o'tdi"));
      case "lessonNoDate":
        return act(t("Sanani belgilash"), undefined, true);
      case "joined":
        return <span className="whitespace-nowrap text-v2-text-2">{t("O'quvchilarga o'tdi")}</span>;
      case "rejected":
        return <span className="whitespace-nowrap text-v2-text-2">{s.reason ? `${t("Sabab:")} ${lowerFirst(t(s.reason))}` : t("Rad etildi")}</span>;
    }
  }

  function cell(r: LeadRow, key: LeadColumnKey): ReactNode {
    const o = r.o;
    switch (key) {
      case "lead":
        return null; // qulflangan — qatorda alohida
      case "course": {
        if (!o.course) return dash;
        const lvl = levelShort(o, settings, t);
        return (
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span className={`size-2 shrink-0 rounded-[3px] ${FAN_DOT[fanOf(o.course)]}`} aria-hidden />
            <span className="text-v2-text">{t(o.course)}</span>
            {lvl && <span className="text-v2-text-2">· {lvl}</span>}
          </span>
        );
      }
      case "holat":
        return <HolatBadge holat={r.holat} />;
      case "next":
        return nextCell(r);
      case "source":
        return o.source ? <span className="whitespace-nowrap text-v2-text-2">{t(o.source)}</span> : dash;
      case "created":
        return <span className="whitespace-nowrap tabular-nums text-v2-text-2">{Number.isFinite(r.at) ? f.stamp(r.at) : o.created || "—"}</span>;
      case "moderator":
        return o.moderator ? (
          <span className="whitespace-nowrap text-v2-text">
            <StaffName name={o.moderator} />
          </span>
        ) : (
          dash
        );
      case "branch":
        return branchName(r) ? <span className="whitespace-nowrap text-v2-text-2">{branchName(r)}</span> : dash;
      case "heardFrom":
        return o.heardFrom ? <span className="whitespace-nowrap text-v2-text-2">{t(o.heardFrom)}</span> : dash;
      case "qulayVaqt":
        return o.qulayVaqt ? <span className="whitespace-nowrap text-v2-text-2">{qulayVaqtText(t(o.qulayVaqt))}</span> : dash;
      case "no":
        return <span className="tabular-nums text-v2-text-2">#{orderNo(o)}</span>;
      case "note":
        return o.note ? (
          <span className="block max-w-[260px] truncate text-v2-text-2" title={o.note}>
            {o.note}
          </span>
        ) : (
          dash
        );
    }
  }

  function rowMenu(r: LeadRow): ActionMenuEntry[] {
    return [
      { key: "h", heading: t("Lid #{n}", { n: orderNo(r.o) }) },
      { key: "open", label: t("Lidni ochish"), icon: UserRound, onSelect: () => setOpenId(r.o.id) },
      { key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: () => setOrderModal({ mode: "edit", order: r.o }) },
      { key: "receipt", label: t("Chek"), icon: Printer, onSelect: () => setReceiptFor(r.o) },
      { key: "d", divider: true },
      { key: "card", label: t("To'liq karta"), icon: SquareArrowOutUpRight, href: `/orders-list/${r.o.id}` },
    ];
  }

  /** Qator bosilsa — panel; belgilash, «⋯» va havolalarning o'z ishi bor. */
  const onRowClick = (e: MouseEvent<HTMLTableRowElement>, id: number) => {
    if ((e.target as HTMLElement).closest("button, a, input, label")) return;
    setOpenId(id);
  };
  /** Ism — havola: oddiy bosish panel, Ctrl/Cmd/Shift yoki o'rta tugma — to'liq karta yangi oynada. */
  const onNameClick = (e: MouseEvent<HTMLAnchorElement>, id: number) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setOpenId(id);
  };

  const loadingList = loading && orders.length === 0;
  const branchTitle = branch.branches.find((b) => b.id === branch.branchId)?.name ?? "";

  /* ---- Holat kartalari ---- */
  const cards: { key: LeadHolat | ""; label: string; dot?: string; n: number; sub?: ReactNode }[] = [
    { key: "", label: t("Barchasi"), n: base.length, sub: periodLower },
    ...HOLAT_ORDER.map((h) => {
      let sub: ReactNode;
      if (h === "yangi" && lateCount > 0) sub = <span className="text-v2-warning">{t("{n} tasi 24 soatdan oshdi", { n: lateCount })}</span>;
      if (h === "sinov" && weekCount > 0) sub = weekCount === counts.sinov ? t("shu hafta") : t("{n} tasi shu hafta", { n: weekCount });
      if (h === "guruh" && counts.guruh > 0 && !todayOnly) sub = periodLower;
      return { key: h, label: t(HOLAT_V2[h].card), dot: HOLAT_V2[h].dot, n: counts[h], sub };
    }),
  ];

  return (
    <div data-ui="v2" className="relative flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5 lg:h-full lg:min-h-0">
      {/* 1. Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("Lidlar")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {[branchTitle, loadingList ? t("Yuklanmoqda…") : t("{period} {n} ta lid", { period: periodLower, n: fmtNum(base.length) })].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionMenu items={surveyMenu} label={t("So'rovnoma havolasi")} width={250}>
            {(trigger) => (
              <button type="button" {...trigger} className={secondaryBtn}>
                <Link2 className="size-4" strokeWidth={1.75} aria-hidden />
                {t("So'rovnoma havolasi")}
              </button>
            )}
          </ActionMenu>
          <ActionMenu items={headerMenu} label={t("Qo'shimcha amallar")} width={250}>
            {(trigger) => (
              <button type="button" {...trigger} title={t("Qo'shimcha amallar")} aria-label={t("Qo'shimcha amallar")} className={secondaryIcon}>
                <MoreHorizontal className="size-4" strokeWidth={1.75} />
              </button>
            )}
          </ActionMenu>
          <button type="button" onClick={() => setOrderModal({ mode: "add" })} className={primaryBtn}>
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            {t("Lid qo'shish")}
          </button>
        </div>
      </div>

      {/* 2. Holat kartalari */}
      <div className="flex overflow-x-auto rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label={t("Holat bo'yicha filtr")}>
        {cards.map((c, i) => {
          const on = holat === c.key;
          return (
            <button
              key={c.key || "all"}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setHolat(c.key === holat && c.key !== "" ? "" : c.key);
                resetPage();
              }}
              className={`flex min-w-[148px] flex-1 flex-col items-start gap-1 px-4 pb-2.5 pt-3 text-left transition-colors focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--v2-brand)] ${
                i > 0 ? "border-l border-v2-border" : ""
              } ${on ? "bg-v2-brand-bg shadow-[inset_0_-2px_0_var(--v2-brand)]" : "hover:bg-v2-hover"}`}
            >
              <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-v2-small ${on ? "font-medium text-v2-brand-text" : "text-v2-text-2"}`}>
                {c.dot && <span className={`size-2 rounded-[3px] ${c.dot}`} aria-hidden />}
                {c.label}
              </span>
              <span className="text-[22px] font-semibold leading-7 tabular-nums text-v2-text">{loadingList ? "—" : fmtNum(c.n)}</span>
              <span className="min-h-4 whitespace-nowrap text-v2-caption text-v2-text-3">{!loadingList && c.sub}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Filtrlar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            type="search"
            placeholder={t("Ism yoki telefon")}
            aria-label={t("Ism yoki telefon")}
            title={t("Ism, telefon yoki lid raqami (#12)")}
            className="h-9 w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
          />
        </div>
        <V2Select variant="chip" label={t("Yo'nalish")} value={yon} onChange={(v) => { setYon(v); resetPage(); }} options={yonOptions} />
        <V2Select variant="chip" label={t("Manba")} value={manba} onChange={(v) => { setManba(v); resetPage(); }} options={manbaOptions} />
        <V2Select variant="chip" label={t("Filial")} value={filial} onChange={(v) => { setFilial(v); resetPage(); }} options={branchOptions} searchable={false} />
        <V2DateRange
          value={range}
          onChange={(r) => {
            setRange(r);
            setTodayOnly(false);
            resetPage();
          }}
          align="start"
          label={rangeText}
          allLabel="Butun davr"
        />
        {(todayCount > 0 || todayOnly) && (
          <button
            type="button"
            aria-pressed={todayOnly}
            onClick={() => {
              setTodayOnly((v) => !v);
              resetPage();
            }}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-v2-md border px-3 text-v2-body font-medium text-v2-warning transition-colors focus-visible:shadow-v2-focus focus-visible:outline-none ${
              todayOnly ? "border-v2-warning bg-v2-warning-bg" : "border-dashed border-v2-warning bg-v2-surface hover:bg-v2-warning-bg"
            }`}
          >
            {todayOnly && <Check className="size-4" strokeWidth={2} aria-hidden />}
            {t("Bugun birinchi dars")} · {todayCount}
            {todayOnly && <X className="size-3.5 opacity-70" strokeWidth={2} aria-hidden />}
          </button>
        )}
        <div className="ml-auto">
          <ColumnsControl prefs={columns} />
        </div>
      </div>

      {/* 4–5. Jadval va sahifalash */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-v2-border bg-v2-brand-bg px-4 py-2.5 text-v2-small">
            <span className="inline-flex items-center gap-1.5 font-semibold text-v2-brand-text">
              <Check className="size-4" strokeWidth={2} aria-hidden />
              {t("{n} ta lid tanlandi", { n: selected.size })}
            </span>
            <span className="text-v2-text-2">{t("Eksport — faqat tanlanganlar")}</span>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => void exportLeadsExcel(exportRows, settings, lf, branchName, toastFns)} className={`${secondaryBtn} h-8`}>
                <Download className="size-4" strokeWidth={1.75} aria-hidden />
                Excel
              </button>
              <button type="button" onClick={() => exportLeadsCsv(exportRows, settings, lf, branchName, toastFns)} className={`${secondaryBtn} h-8`}>
                <Download className="size-4" strokeWidth={1.75} aria-hidden />
                CSV
              </button>
              <button type="button" onClick={() => setSelected(new Set())} className="h-8 rounded-v2-md px-2 font-medium text-v2-text-2 hover:bg-v2-surface hover:text-v2-text">
                {t("Bekor qilish")}
              </button>
            </div>
          </div>
        )}
        <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
          <table className="w-full border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${th} w-10 pl-4 pr-2`}>
                  <V2Checkbox
                    checked={pageIds.length > 0 && pageSelected === pageIds.length}
                    indeterminate={pageSelected > 0 && pageSelected < pageIds.length}
                    onChange={togglePage}
                    label={t("Sahifadagilarni belgilash")}
                  />
                </th>
                <th className={`${th} px-2.5`}>{sortHead(t("Lid"), "name")}</th>
                {visibleCols.map((c) => (
                  <th key={c.key} className={`${th} px-2.5`}>
                    {c.sort ? sortHead(t(c.label), c.sort) : t(c.label)}
                  </th>
                ))}
                <th className={`${th} w-11 pl-1 pr-3`}>
                  <span className="sr-only">{t("Amallar")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingList &&
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={`sk${i}`} className="border-b border-v2-border" aria-hidden>
                    <td className="py-3 pl-4 pr-2">
                      <div className="size-4 rounded-[4px] bg-v2-skeleton" />
                    </td>
                    <td className="px-2.5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-v2-full bg-v2-skeleton" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-36 rounded bg-v2-skeleton" />
                          <div className="h-2.5 w-24 rounded bg-v2-skeleton" />
                        </div>
                      </div>
                    </td>
                    {visibleCols.map((c) => (
                      <td key={c.key} className="px-2.5 py-3">
                        <div className="h-3 w-24 rounded bg-v2-skeleton" />
                      </td>
                    ))}
                    <td />
                  </tr>
                ))}

              {!loadingList && slice.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="p-6">
                    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                        <Inbox className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      {rows.length === 0 ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Hali lid yo'q")}</div>
                          <p className="max-w-md text-v2-small text-v2-text-2">{t("So'rovnoma havolasini reklamaga qo'ying yoki lidni qo'lda qo'shing.")}</p>
                          <button type="button" onClick={() => setOrderModal({ mode: "add" })} className={`${primaryBtn} mt-2`}>
                            <Plus className="size-4" strokeWidth={2} aria-hidden />
                            {t("Lid qo'shish")}
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Mos lid topilmadi")}</div>
                          <p className="text-v2-small text-v2-text-2">{range.start && !anyFilter ? t("Bu davrda lid kelmagan — davrni o'zgartirib ko'ring.") : t("Qidiruv yoki filtrlarni o'zgartirib ko'ring.")}</p>
                          <button type="button" onClick={clearAll} className={`${secondaryBtn} mt-2`}>
                            {t("Filtrlarni tozalash")}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {!loadingList &&
                slice.map((r) => {
                  const o = r.o;
                  const isOpen = openId === o.id;
                  const isSel = selected.has(o.id);
                  const phone = phoneParts(o.phone);
                  return (
                    <tr
                      key={o.id}
                      onClick={(e) => onRowClick(e, o.id)}
                      className={`group cursor-pointer border-b border-v2-border transition-colors last:border-b-0 ${rowH} ${isOpen || isSel ? ROW_TINT.brand : ROW_TINT.hover}`}
                    >
                      <td className={`${cellY} w-10 pl-4 pr-2 ${isOpen ? ROW_BAR.brand : ""}`}>
                        <V2Checkbox checked={isSel} onChange={() => toggleOne(o.id)} label={t("{name} — belgilash", { name: o.name || `#${orderNo(o)}` })} />
                      </td>
                      <td className={`${cellY} px-2.5`}>
                        <div className="flex min-w-[200px] items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-full border border-v2-border bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2" aria-hidden>
                            {initialsOf(o.name || "?")}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/orders-list/${o.id}`}
                              onClick={(e) => onNameClick(e, o.id)}
                              className="block truncate font-semibold text-v2-text underline-offset-2 hover:text-v2-brand-text group-hover:underline"
                            >
                              {o.name || "—"}
                            </Link>
                            <span className="flex items-center gap-1 text-v2-small tabular-nums text-v2-text-3">
                              {phone?.show ?? (o.phone || "—")}
                              {r.dupCount > 1 && (
                                <span
                                  className="inline-flex text-v2-warning"
                                  title={r.dupOf !== null ? t("Takroriy raqam — avvalgi lid #{n}", { n: r.dupOf }) : t("Shu raqamdan keyinroq ham lid kelgan")}
                                >
                                  <Copy className="size-3.5" strokeWidth={1.75} aria-label={t("Takroriy raqam")} />
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>
                      {visibleCols.map((c) => (
                        <td key={c.key} className={`${cellY} px-2.5`}>
                          {cell(r, c.key)}
                        </td>
                      ))}
                      <td className={`${cellY} pl-1 pr-3 text-right`}>
                        <ActionMenu items={rowMenu(r)} label={t("{name} — amallar", { name: o.name || `#${orderNo(o)}` })} width={220}>
                          {(trigger, open) => (
                            <button
                              type="button"
                              {...trigger}
                              title={t("Amallar")}
                              aria-label={t("{name} — amallar", { name: o.name || `#${orderNo(o)}` })}
                              className={`inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-[opacity,background-color] hover:bg-v2-surface-2 hover:text-v2-text focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-v2-focus [@media(hover:none)]:opacity-100 ${
                                open ? "bg-v2-surface-2 opacity-100" : "opacity-0 group-hover:opacity-100"
                              }`}
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
        <V2Pagination
          totalItems={sorted.length}
          page={currentPage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            resetPage();
          }}
        />
      </div>

      {/* 6. Lid paneli. Kompyuterda (≥1024) — kontent hududi ichida (yon menyu va yuqori
          panel ochiq), torroqda — butun ekran. Fon bosilsa yoki Esc — yopiladi. */}
      {openRow && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 lg:absolute" onClick={() => setOpenId(null)} aria-hidden />
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] lg:absolute">
            <LeadPanelV2
              key={openRow.o.id}
              row={openRow}
              settings={settings}
              branchName={branchName(openRow)}
              groups={groupList}
              isAdmin={isAdmin}
              nowMs={nowMs}
              busy={busy}
              commentsCount={messagesByOrder[openRow.o.id]?.length ?? 0}
              canStudents={canStudents}
              canGroups={canGroups}
              onClose={() => setOpenId(null)}
              onGo={(to) => void go(openRow, to)}
              onReschedule={() => setModal({ kind: "sinov", id: openRow.o.id })}
              onUndo={() => void undo(openRow.o.id)}
              onSaveNote={(note) => saveNote(openRow, note)}
              onEdit={() => setOrderModal({ mode: "edit", order: openRow.o })}
              onReceipt={() => setReceiptFor(openRow.o)}
              onComments={() => setMessageFor(openRow.o)}
              onSms={() => setSmsFor(openRow.o)}
            />
          </div>
        </>
      )}

      {/* Holat oynalari (yangi ko'rinish) */}
      {modal && modalRow && modal.kind === "sinov" && (
        <LeadSinovModalV2
          order={modalRow.o}
          branchName={branchName(modalRow)}
          nowMs={nowMs}
          groups={groups}
          teachers={teachers}
          onClose={() => setModal(null)}
          onDone={(order, title) => holatDone(order, title)}
          onConflict={onConflict}
        />
      )}
      {modal && modalRow && modal.kind === "guruh" && (
        <LeadGroupModalV2
          order={modalRow.o}
          branchName={branchName(modalRow)}
          nowMs={nowMs}
          groups={groups}
          canPay={canPay}
          onClose={() => setModal(null)}
          onDone={joined}
          onConflict={onConflict}
        />
      )}
      {modal && modalRow && modal.kind === "rad" && (
        <LeadRadModalV2
          order={modalRow.o}
          reasons={settings?.radSabablar ?? []}
          onClose={() => setModal(null)}
          onDone={(order, title) => holatDone(order, title)}
          onConflict={onConflict}
        />
      )}

      {/* Hozircha eski oynalar (bo'limma-bo'lim almashadi) */}
      {activeOrderModal && <AddOrderModal initialOrder={activeOrderModal.mode === "edit" ? activeOrderModal.order : undefined} onClose={closeOrderModal} onSave={saveOrder} />}
      {smsFor && (
        <SmsModal
          studentName={smsFor.name}
          phone={smsFor.phone}
          onClose={() => setSmsFor(null)}
          onSent={({ simulated }) => {
            setSmsFor(null);
            if (simulated) showError(t("SMS jo'natilmadi: Eskiz sozlanmagan (jurnalga yozildi)"));
            else showSuccess(t("SMS yuborildi"));
          }}
          onError={(m) => showError(m)}
        />
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
            rows: leadReceiptRows(receiptFor, rows.find((x) => x.o.id === receiptFor.id) ?? null, settings, lf, branchById.get(receiptFor.branchId ?? -1)?.name ?? ""),
          }}
          onClose={() => setReceiptFor(null)}
        />
      )}
      {payFor && <StudentPaymentModalV2 student={payFor.student} groups={payFor.groups} onClose={() => setPayFor(null)} />}
    </div>
  );
}
