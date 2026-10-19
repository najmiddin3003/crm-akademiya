"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  CirclePlus,
  Download,
  History,
  ListChecks,
  ListFilter,
  MessageSquare,
  MessagesSquare,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  UserCog,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import { usePupils } from "@/components/orders/PupilsContext";
import GroupPickerModal from "@/components/orders/GroupPickerModal";
import SmsModal from "@/components/orders/SmsModal";
import StudentStatusModal from "@/components/students/StudentStatusModal";
import { useStudentsList } from "@/components/students/useStudentsList";
import StudentPaymentModalV2 from "@/components/v2/finance/StudentPaymentModalV2";
import { onMoneyChanged, onPupilCreated } from "@/components/v2/shell/v2Events";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import ColumnsControl from "@/components/v2/ui/ColumnsControl";
import FloatingPanel from "@/components/v2/ui/FloatingPanel";
import StaffName from "@/components/v2/ui/StaffName";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import V2Select from "@/components/v2/ui/V2Select";
import { moreFiltersCls, primaryBtn, secondaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { DENSITY_CELL, DENSITY_ROW } from "@/components/v2/ui/columnPrefs";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { ROW_BAR, ROW_TINT } from "@/components/v2/ui/table";
import { useEduCategoryNames } from "@/hooks/useEduCategories";
import type { Group } from "@/lib/groups";
import type { Pupil } from "@/lib/pupilsData";
import {
  applyStudentFilters,
  EMPTY_STUDENT_FILTERS,
  STUDENT_STATUSES,
  type EnrichedStudent,
  type StudentFilters,
  type StudentStatus,
} from "@/lib/studentsData";
import { downloadBlob, referralRows, studentsCsvBlob, studentsXlsBlob } from "@/lib/studentsExport";
import NewStudentDrawerV2 from "./NewStudentDrawerV2";
import StudentQuickPanel from "./StudentQuickPanel";
import StudentsMoreFilters, { countMoreFilters, pickMoreFilters, type MoreFilters } from "./StudentsMoreFilters";
import { useStudentColumns, type StudentColumnKey, type StudentSortKey } from "./studentsColumns";

// YANGI VERSIYA — O'QUVCHILAR RO'YXATI (design/v2/DESIGN.md → «Sahifa qolipi —
// ro'yxat (O'quvchilar misolida)»; rasm: «O'quvchilar · Filtr oynasi», 17.10.2026).
//
//   1. sarlavha: «O'quvchilar» + «filial · jami N ta o'quvchi»; Export, «⋯»,
//      «+ O'quvchi qo'shish»;
//   2. filtr qatori: qidiruv (ism, telefon, ID) → DOIM ko'rinadigan Kurs /
//      Guruh / Holati (darhol qo'llanadi) → «Yana filtrlar» (oynada, «Qo'llash»
//      bilan) → o'ngda «Ustunlar»;
//   3. qo'llangan qo'shimcha filtrlar — chiplar (× bilan);
//   4. xulosa: «N ta o'quvchi • Qarzdorlik • Haqdorlik»;
//   5. jadval: belgilash, «O'quvchi» (avatar + ism + telefon), ustunlar,
//      saralash, o'ngda «⋯» (qator ustiga kelganda);
//   6. sahifalash;
//   7. qator (yoki ism) bosilsa — o'ngda TEZKOR PANEL (./StudentQuickPanel.tsx,
//      rasm «O'quvchi · Tezkor panel»); Ctrl/Cmd + bosish — to'liq profil yangi
//      oynada (oddiy havola).
//
// Ma'lumot, filtr mantig'i, holat o'zgarishi va eksport — eski sahifa bilan
// BITTA manbadan (useStudentsList, lib/studentsData.ts, lib/studentsExport.ts).
// Oynalar (o'quvchi qo'shish, guruh, SMS, holat) hozircha eski — bo'limma-bo'lim
// almashadi. Taxminlar: design/v2/SAVOLLAR.md, 29–35.

const STATUS_TONE: Record<StudentStatus, { badge: string; dot: string }> = {
  Aktiv: { badge: "bg-v2-success-bg text-v2-success", dot: "bg-v2-success" },
  Muzlatilgan: { badge: "bg-v2-info-bg text-v2-info", dot: "bg-v2-info" },
  Arxiv: { badge: "bg-v2-surface-2 text-v2-text-2", dot: "bg-v2-text-3" },
};

function fmtNum(n: number): string {
  const s = Math.abs(n).toLocaleString("ru-RU").replace(/,/g, " ");
  return n < 0 ? `−${s}` : s;
}

/** "947655525" / "998947655525" → "94 765 55 25"; boshqasi o'zgarmaydi. */
function fmtPhone(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  const local = d.length === 12 && d.startsWith("998") ? d.slice(3) : d;
  if (local.length !== 9) return raw || "";
  return `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
}

/** Ism-familiyaning bosh harflari: «Yulduz Muhammadjonova» → «YM». */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

/** "dd.MM.yyyy | HH:mm" → saralanadigan son; o'qilmasa −1 (ro'yxat oxirida). */
function createdKey(s: string): number {
  const m = /(\d{2})\.(\d{2})\.(\d{4})(?:\D+(\d{2}):(\d{2}))?/.exec(s || "");
  return m ? Number(`${m[3]}${m[2]}${m[1]}${m[4] ?? "00"}${m[5] ?? "00"}`) : -1;
}

interface SortState {
  key: StudentSortKey;
  dir: "asc" | "desc";
}

function sortRows(rows: EnrichedStudent[], s: SortState): EnrichedStudent[] {
  const sign = s.dir === "asc" ? 1 : -1;
  const value = (r: EnrichedStudent): number | string =>
    s.key === "name" ? r.name : s.key === "balance" ? r.balance : s.key === "coin" ? r.coin : createdKey(r.createdAt);
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    const c = typeof va === "string" ? va.localeCompare(String(vb), "uz") : va - (vb as number);
    // Teng bo'lsa — yangi o'quvchi (katta id) oldinda: tartib har safar bir xil.
    return c !== 0 ? c * sign : b.id - a.id;
  });
}

export default function StudentsListV2() {
  const { t } = useT();
  const branch = useBranch();
  const { showSuccess: toastOk, showError: toastErr } = useToast();
  const { rows, groups, loading, options, applyStatusSaved, reloadGroups, reloadBalances } = useStudentsList();
  const { insertPupil } = usePupils();
  // «+ Yangi» (yuqori panel) dan qo'shilgan o'quvchi va qabul qilingan to'lov — ro'yxat
  // shu yerda ham darhol yangilansin (forma qobiqda — components/v2/shell/CreateContext.tsx).
  const liveRef = useRef({ insertPupil, reloadGroups, reloadBalances });
  useEffect(() => {
    liveRef.current = { insertPupil, reloadGroups, reloadBalances };
  });
  useEffect(() => {
    const offPupil = onPupilCreated((pupil, gid) => {
      liveRef.current.insertPupil(pupil);
      if (gid !== null) liveRef.current.reloadGroups();
    });
    const offMoney = onMoneyChanged(() => liveRef.current.reloadBalances());
    return () => {
      offPupil();
      offMoney();
    };
  }, []);
  const groupById = useMemo(() => new Map<number, Group>(groups.map((g) => [g.id, g])), [groups]);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<StudentFilters>(EMPTY_STUDENT_FILTERS);
  const { names: categoryNames } = useEduCategoryNames(filters.category);
  const [sort, setSort] = useState<SortState>({ key: "createdAt", dir: "desc" });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const columns = useStudentColumns();

  const [moreOpen, setMoreOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);

  const [addOpen, setAddOpen] = useState(false);
  // «Yangi o'quvchi» panelidagi «Kategoriya bo'yicha saralangan» guruhlar: guruh
  // kategoriyasi bazada yo'q — a'zolarining ko'pchiligi kategoriyasi (SAVOLLAR 83).
  const groupCategory = useMemo(() => {
    const out = new Map<number, string>();
    if (!addOpen) return out;
    const counts = new Map<number, Map<string, number>>();
    for (const r of rows) {
      if (!r.category) continue;
      for (const gid of r.groupIds) {
        const m = counts.get(gid) ?? new Map<string, number>();
        m.set(r.category, (m.get(r.category) ?? 0) + 1);
        counts.set(gid, m);
      }
    }
    for (const [gid, m] of counts) {
      let best = "";
      let n = 0;
      for (const [c, k] of m) {
        if (k > n) {
          best = c;
          n = k;
        }
      }
      out.set(gid, best);
    }
    return out;
  }, [addOpen, rows]);
  const [groupFor, setGroupFor] = useState<{ id: number; name: string } | null>(null);
  const [smsFor, setSmsFor] = useState<{ id: number; name: string; phone: string } | null>(null);
  const [statusFor, setStatusFor] = useState<{ id: number; name: string; status: string; statusReason?: string } | null>(null);
  // «To'lov qabul qilish» — tezkor paneldan, o'quvchi tanlangan holda.
  const [payFor, setPayFor] = useState<EnrichedStudent | null>(null);
  // Tezkor panel — o'quvchi id'si; qator `rows` dan olinadi (holat o'zgarsa panel ham yangilanadi).
  const [panelId, setPanelId] = useState<number | null>(null);
  const panelRow = panelId === null ? null : (rows.find((r) => r.id === panelId) ?? null);
  const modalOpen = addOpen || groupFor !== null || smsFor !== null || statusFor !== null || payFor !== null;

  // Esc — panelni yopadi; ustida oyna (SMS, guruh, holat) ochiq bo'lsa avval o'sha yopilsin.
  useEffect(() => {
    if (panelId === null || modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panelId, modalOpen]);

  /** Qator bosilganda panel; belgilash, «⋯» va havolalarning o'z ishi bor. */
  const onRowClick = (e: MouseEvent<HTMLTableRowElement>, id: number) => {
    if ((e.target as HTMLElement).closest("button, a, input, label")) return;
    setPanelId(id);
  };
  /** Ism — havola: oddiy bosish panel ochadi, Ctrl/Cmd/Shift yoki o'rta tugma — profil yangi oynada. */
  const onNameClick = (e: MouseEvent<HTMLAnchorElement>, id: number) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setPanelId(id);
  };

  const setFilter = <K extends keyof StudentFilters>(k: K, v: StudentFilters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  // Guruh tanlovi: ro'yxatda to'liq («36 · Ingliz tili · Karimov»), chip'da qisqa.
  const groupOptions = useMemo(
    () =>
      groups.map((g) => {
        const nom = (g.name || "").trim() || String(g.id);
        const parts = [nom, (g.course || "").trim(), (g.teacher || "").trim() || "o'qituvchisiz"].filter(Boolean);
        return { value: String(g.id), label: parts.join(" · ") };
      }),
    [groups],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const byQuery = q
      ? rows.filter(
          (r) =>
            `${r.name} ${r.phone} ${r.id}`.toLowerCase().includes(q) ||
            // «94 765» kabi bo'shliqli raqam ham topilsin.
            (digits.length >= 3 && r.phone.replace(/\D/g, "").includes(digits)),
        )
      : rows;
    return applyStudentFilters(byQuery, filters);
  }, [rows, search, filters]);

  const sorted = useMemo(() => sortRows(filtered, sort), [filtered, sort]);

  const { debt, credit } = useMemo(() => {
    let d = 0;
    let c = 0;
    for (const r of filtered) {
      if (r.balance < 0) d += r.balance;
      else c += r.balance;
    }
    return { debt: d, credit: c };
  }, [filtered]);

  const start = (page - 1) * pageSize;
  const slice = sorted.slice(start, start + pageSize);
  const pageIds = slice.map((r) => r.id);
  const pageSelected = pageIds.filter((id) => selected.has(id)).length;

  const toggleRow = (id: number, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const togglePage = (on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  /* ---- Eksport: belgilangan bo'lsa faqat ular (eski sahifa qoidasi) ---- */
  const exportBase = (source: EnrichedStudent[]) => (selected.size > 0 ? source.filter((r) => selected.has(r.id)) : source);
  const exportCount = exportBase(sorted).length;
  const exportItems: ActionMenuEntry[] = [
    { key: "h", heading: selected.size > 0 ? t("Belgilanganlar: {n} ta", { n: exportCount }) : t("Ro'yxatdagilar: {n} ta", { n: exportCount }) },
    { key: "xls", label: t("Excel fayl"), hint: "XLS", icon: Download, onSelect: () => downloadBlob(studentsXlsBlob(exportBase(sorted)), "oquvchilar-royxati.xls") },
    { key: "csv", label: t("CSV fayl"), hint: "CSV", icon: Download, onSelect: () => downloadBlob(studentsCsvBlob(exportBase(sorted)), "oquvchilar-royxati.csv") },
  ];
  const moreItems: ActionMenuEntry[] = [
    {
      key: "ref",
      label: t("Tavsiya orqali kelganlar"),
      hint: "CSV",
      icon: Share2,
      onSelect: () => downloadBlob(studentsCsvBlob(exportBase(referralRows(rows))), "referrals.csv"),
    },
  ];

  /* ---- Qo'shimcha filtrlar ---- */
  const appliedMore = pickMoreFilters(filters);
  const moreCount = countMoreFilters(appliedMore);
  const applyMore = (next: MoreFilters) => {
    setFilters((f) => ({ ...f, ...next }));
    setPage(1);
    setMoreOpen(false);
  };
  const range = (from: string, to: string, unit = "") =>
    `${from ? fmtNum(Number(from)) : "…"} – ${to ? fmtNum(Number(to)) : "…"}${unit}`;
  const moreChips: { key: string; label: string; clear: () => void }[] = [
    ...(
      [
        ["teacher", "O'qituvchi"],
        ["subcourse", "Subkurs"],
        ["category", "Kategoriya"],
        ["groupCount", "Guruhlar soni"],
        ["day", "Kun"],
        ["oddEven", "Toq/Juft kunlar"],
        ["source", "Manba"],
        ["moderator", "Moderator"],
      ] as const
    )
      .filter(([k]) => filters[k])
      .map(([k, label]) => ({ key: k, label: `${t(label)}: ${t(filters[k])}`, clear: () => setFilter(k, "") })),
    ...(filters.balanceFrom || filters.balanceTo
      ? [{ key: "balance", label: `${t("Balans")}: ${range(filters.balanceFrom, filters.balanceTo, ` ${t("so'm")}`)}`, clear: () => applyMore({ ...appliedMore, balanceFrom: "", balanceTo: "" }) }]
      : []),
    ...(filters.coinFrom || filters.coinTo
      ? [{ key: "coin", label: `${t("Tanga")}: ${range(filters.coinFrom, filters.coinTo)}`, clear: () => applyMore({ ...appliedMore, coinFrom: "", coinTo: "" }) }]
      : []),
  ];
  const anyFilter = search.trim() !== "" || (Object.keys(EMPTY_STUDENT_FILTERS) as (keyof StudentFilters)[]).some((k) => filters[k] !== "");
  const clearAll = () => {
    setFilters(EMPTY_STUDENT_FILTERS);
    setSearch("");
    setPage(1);
  };

  /* ---- Saralash ---- */
  const toggleSort = (key: StudentSortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }));
    setPage(1);
  };

  // «O'quvchi» qulflangan — pastda alohida chiziladi; qolganlari foydalanuvchi tartibida.
  const visibleCols = columns.shown;
  const colCount = visibleCols.length + 3;
  const rowH = DENSITY_ROW[columns.density];
  const cellY = DENSITY_CELL[columns.density];
  const branchName = branch.branches.find((b) => b.id === branch.branchId)?.name ?? "";

  function handleStatusSaved(pupil: Pupil) {
    applyStatusSaved(pupil);
    setStatusFor(null);
  }

  const th = "sticky top-0 z-10 whitespace-nowrap bg-v2-surface-2 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";

  /** Saralanadigan ustun sarlavhasi (render funksiyasi — komponent emas). */
  function sortHead(label: string, k: StudentSortKey, align?: "right") {
    const on = sort.key === k;
    const Icon = on && sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => toggleSort(k)}
        aria-label={t("{col} bo'yicha saralash", { col: label })}
        className={`group/sort inline-flex items-center gap-1 rounded-v2-sm hover:text-v2-text ${on ? "font-semibold text-v2-text" : ""} ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label}
        <Icon className={`size-3.5 ${on ? "" : "opacity-0 group-hover/sort:opacity-60"}`} strokeWidth={2} aria-hidden />
      </button>
    );
  }

  function cell(r: EnrichedStudent, key: StudentColumnKey) {
    switch (key) {
      case "name":
        return null; // qulflangan ustun — qatorda alohida chiziladi
      case "id":
        return <span className="tabular-nums text-v2-text-2">{r.id}</span>;
      case "groups": {
        // Rasmdagidek: kurs nomi fan rangidagi nuqta bilan; bir nechta guruh — «+N».
        const mine = r.groupIds.map((id) => groupById.get(id)).filter((g): g is Group => Boolean(g));
        if (mine.length === 0) return <span className="text-v2-text-3">—</span>;
        const g0 = mine[0];
        return (
          <span className="inline-flex max-w-[200px] items-center gap-1.5" title={mine.map((g) => [g.course, g.name].filter(Boolean).join(" · ")).join(", ")}>
            <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(g0.course)]}`} aria-hidden />
            <span className="truncate">{g0.course || g0.name}</span>
            {mine.length > 1 && <span className="shrink-0 text-v2-caption text-v2-text-3">+{mine.length - 1}</span>}
          </span>
        );
      }
      case "teacher":
        return r.teacher ? (
          <span className="whitespace-nowrap text-v2-text-2">
            <StaffName name={r.teacher} />
          </span>
        ) : (
          <span className="text-v2-text-3">—</span>
        );
      case "balance":
        return (
          <span className={`tabular-nums ${r.balance < 0 ? "font-semibold text-v2-danger" : r.balance > 0 ? "font-medium text-v2-success" : "text-v2-text-3"}`}>
            {r.balance === 0 ? "0" : fmtNum(r.balance)}
          </span>
        );
      case "coin":
        return r.coin > 0 ? <span className="tabular-nums">{fmtNum(r.coin)}</span> : <span className="text-v2-text-3">—</span>;
      case "status": {
        const tone = STATUS_TONE[r.status] ?? STATUS_TONE.Aktiv;
        return (
          <span title={r.statusReason ? `${t("Sabab")}: ${r.statusReason}` : undefined} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-v2-full px-2 py-0.5 text-v2-caption ${tone.badge}`}>
            <span className={`size-1.5 rounded-full ${tone.dot}`} aria-hidden />
            {t(r.status)}
          </span>
        );
      }
      case "source":
        return r.source ? t(r.source) : <span className="text-v2-text-3">—</span>;
      case "moderator":
        return <StaffName name={r.moderator} />;
      case "category":
        return r.category || <span className="text-v2-text-3">—</span>;
      case "createdAt": {
        const [date, time] = (r.createdAt || "").split("|").map((s) => s.trim());
        return date ? <span className="whitespace-nowrap tabular-nums text-v2-text-2" title={time ? `${date} ${time}` : undefined}>{date}</span> : <span className="text-v2-text-3">—</span>;
      }
    }
  }

  function rowMenu(r: EnrichedStudent): ActionMenuEntry[] {
    const base = `/student-edit/${r.id}?src=list`;
    return [
      { key: "h", heading: r.name },
      { key: "open", label: t("Profilni ochish"), icon: UserRound, href: `/student-edit/${r.id}` },
      { key: "group", label: t("Guruhga qo'shish"), icon: CirclePlus, onSelect: () => setGroupFor({ id: r.id, name: r.name }) },
      {
        key: "sms",
        label: t("SMS yuborish"),
        icon: MessageSquare,
        disabled: !r.phone,
        title: r.phone ? undefined : t("Telefon raqam yo'q"),
        onSelect: () => setSmsFor({ id: r.id, name: r.name, phone: r.phone }),
      },
      { key: "smslog", label: t("SMS tarixi"), icon: MessagesSquare, href: `${base}&tab=sms` },
      { key: "groups", label: t("Guruhlar"), icon: Users, href: `${base}&tab=guruh` },
      { key: "tasks", label: t("Vazifalar"), icon: ListChecks, href: `${base}&tab=vazifa` },
      { key: "history", label: t("Tarix"), icon: History, href: `${base}&tab=harakatlar` },
      { key: "d", divider: true },
      { key: "status", label: t("Holatni o'zgartirish"), icon: UserCog, onSelect: () => setStatusFor({ id: r.id, name: r.name, status: r.status, statusReason: r.statusReason }) },
    ];
  }

  return (
    <div
      data-ui="v2"
      className="relative flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5 lg:h-full lg:min-h-0"
    >
      {/* 1. Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("O'quvchilar")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {[branchName, loading ? t("Yuklanmoqda…") : t("jami {n} ta o'quvchi", { n: fmtNum(rows.length) })].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionMenu items={exportItems} label={t("Export")}>
            {(trigger) => (
              <button type="button" {...trigger} className={secondaryBtn}>
                <Download className="size-4" strokeWidth={1.75} aria-hidden />
                {t("Export")}
              </button>
            )}
          </ActionMenu>
          <ActionMenu items={moreItems} label={t("Qo'shimcha amallar")}>
            {(trigger) => (
              <button type="button" {...trigger} title={t("Qo'shimcha amallar")} aria-label={t("Qo'shimcha amallar")} className={secondaryIcon}>
                <MoreHorizontal className="size-4" strokeWidth={1.75} />
              </button>
            )}
          </ActionMenu>
          <button type="button" onClick={() => setAddOpen(true)} className={primaryBtn}>
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            {t("O'quvchi qo'shish")}
          </button>
        </div>
      </div>

      {/* 2. Filtr qatori */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            type="search"
            placeholder={t("Ism, telefon yoki ID")}
            aria-label={t("Ism, telefon yoki ID")}
            className="h-9 w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
          />
        </div>
        <V2Select variant="chip" label={t("Kurs")} value={filters.course} onChange={(v) => setFilter("course", v)} options={options.course.map((v) => ({ value: v, label: v }))} />
        <V2Select variant="chip" label={t("Guruh")} value={filters.group} onChange={(v) => setFilter("group", v)} options={groupOptions} />
        <V2Select variant="chip" label={t("Holati")} value={filters.status} onChange={(v) => setFilter("status", v)} options={STUDENT_STATUSES.map((v) => ({ value: v, label: v }))} searchable={false} />
        <button
          ref={moreBtnRef}
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={moreFiltersCls(moreOpen, moreCount > 0)}
        >
          <ListFilter className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Yana filtrlar")}
          {moreCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-v2-full bg-v2-brand px-1.5 text-[11px] font-semibold tabular-nums text-v2-on-brand">{moreCount}</span>
          )}
        </button>
        <FloatingPanel open={moreOpen} anchorRef={moreBtnRef} onClose={() => setMoreOpen(false)} width={640} maxHeight={600} role="dialog" ariaLabel={t("Qo'shimcha filtrlar")}>
          <StudentsMoreFilters
            applied={appliedMore}
            options={{
              teacher: options.teacher,
              subcourse: options.subcourse,
              category: categoryNames,
              day: options.day,
              source: options.source,
              moderator: options.moderator,
            }}
            onApply={applyMore}
          />
        </FloatingPanel>

        <div className="ml-auto">
          <ColumnsControl prefs={columns} />
        </div>
      </div>

      {/* 3. Qo'llangan qo'shimcha filtrlar */}
      {moreChips.length > 0 && (
        <div className="-mt-1 flex flex-wrap items-center gap-2">
          {moreChips.map((c) => (
            <span key={c.key} className="inline-flex h-7 max-w-full items-center gap-1 rounded-v2-md border border-v2-border bg-v2-surface-2 pl-2.5 pr-1 text-v2-small text-v2-text">
              <span className="truncate">{c.label}</span>
              <button type="button" onClick={c.clear} aria-label={`${c.label} — ${t("Tozalash")}`} className="inline-flex size-5 items-center justify-center rounded-v2-sm text-v2-text-3 hover:bg-v2-surface hover:text-v2-text">
                <X className="size-3.5" strokeWidth={2} />
              </button>
            </span>
          ))}
          <button type="button" onClick={() => applyMore(pickMoreFilters(EMPTY_STUDENT_FILTERS))} className="h-7 rounded-v2-md px-2 text-v2-small font-medium text-v2-brand-text hover:bg-v2-brand-bg">
            {t("Tozalash")}
          </button>
        </div>
      )}

      {/* 4. Xulosa */}
      <div className="-mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-v2-small text-v2-text-2">
        <span>
          <b className="font-semibold tabular-nums text-v2-text">{fmtNum(filtered.length)}</b> {t("ta o'quvchi")}
        </span>
        <span aria-hidden>•</span>
        <span>
          {t("Qarzdorlik")} <b className="font-semibold tabular-nums text-v2-text">{fmtNum(Math.abs(debt))} {t("so'm")}</b>
        </span>
        <span aria-hidden>•</span>
        <span>
          {t("Haqdorlik")} <b className="font-semibold tabular-nums text-v2-text">{fmtNum(credit)} {t("so'm")}</b>
        </span>
        {selected.size > 0 && (
          <>
            <span aria-hidden>•</span>
            <span className="text-v2-brand-text">{t("{n} ta belgilandi", { n: selected.size })}</span>
            <button type="button" onClick={() => setSelected(new Set())} className="rounded-v2-sm px-1 font-medium text-v2-text-2 underline-offset-2 hover:text-v2-text hover:underline">
              {t("Bekor qilish")}
            </button>
          </>
        )}
      </div>

      {/* 5–6. Jadval va sahifalash */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
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
                <th className={`${th} px-2.5`}>{sortHead(t("O'quvchi"), "name")}</th>
                {visibleCols.map((c) => (
                  <th key={c.key} className={`${th} px-2.5 ${c.align === "right" ? "text-right" : ""}`}>
                    {c.sort ? sortHead(t(c.label), c.sort, c.align) : t(c.label)}
                  </th>
                ))}
                <th className={`${th} w-11 pl-1 pr-3`}>
                  <span className="sr-only">{t("Amallar")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={`sk${i}`} className="border-b border-v2-border" aria-hidden>
                    <td className="py-3 pl-4 pr-2"><div className="size-4 rounded-[4px] bg-v2-skeleton" /></td>
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
                      <td key={c.key} className="px-2.5 py-3"><div className={`h-3 rounded bg-v2-skeleton ${c.align === "right" ? "ml-auto w-14" : "w-20"}`} /></td>
                    ))}
                    <td />
                  </tr>
                ))}

              {!loading && slice.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="p-6">
                    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                        <Users className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      {rows.length === 0 ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Hozircha o'quvchi yo'q")}</div>
                          <p className="text-v2-small text-v2-text-2">{t("Birinchi o'quvchini qo'shing — u shu ro'yxatda paydo bo'ladi.")}</p>
                          <button type="button" onClick={() => setAddOpen(true)} className="mt-2 inline-flex h-9 items-center gap-2 rounded-v2-md bg-v2-brand px-4 font-semibold text-v2-on-brand hover:brightness-95">
                            <Plus className="size-4" strokeWidth={2} aria-hidden />
                            {t("O'quvchi qo'shish")}
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Mos o'quvchi topilmadi")}</div>
                          <p className="text-v2-small text-v2-text-2">{t("Qidiruv yoki filtrlarni o'zgartirib ko'ring.")}</p>
                          {anyFilter && (
                            <button type="button" onClick={clearAll} className={`${secondaryBtn} mt-2`}>
                              {t("Filtrlarni tozalash")}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                slice.map((r) => {
                  const on = selected.has(r.id);
                  // Paneli ochiq qator — rasmdagidek brend fon + chapda brend chiziq.
                  const current = panelId === r.id;
                  return (
                    <tr
                      key={r.id}
                      onClick={(e) => onRowClick(e, r.id)}
                      aria-selected={current || undefined}
                      className={`group cursor-pointer border-b border-v2-border transition-colors last:border-b-0 ${rowH} ${on || current ? ROW_TINT.brand : ROW_TINT.hover}`}
                    >
                      <td className={`${cellY} pl-4 pr-2 ${current ? ROW_BAR.brand : ""}`}>
                        <V2Checkbox checked={on} onChange={(v) => toggleRow(r.id, v)} label={t("{name} — belgilash", { name: r.name })} />
                      </td>
                      <td className={`${cellY} px-2.5`}>
                        <div className="flex min-w-[200px] items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-full bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2" aria-hidden>
                            {initialsOf(r.name)}
                          </span>
                          <span className="min-w-0">
                            <Link
                              href={`/student-edit/${r.id}`}
                              onClick={(e) => onNameClick(e, r.id)}
                              className="block truncate font-semibold text-v2-text underline-offset-2 hover:text-v2-brand-text group-hover:underline"
                            >
                              {r.name}
                            </Link>
                            <span className="block text-v2-small tabular-nums text-v2-text-3">{fmtPhone(r.phone) || "—"}</span>
                          </span>
                        </div>
                      </td>
                      {visibleCols.map((c) => (
                        <td key={c.key} className={`${cellY} px-2.5 ${c.align === "right" ? "text-right" : ""}`}>
                          {cell(r, c.key)}
                        </td>
                      ))}
                      <td className={`${cellY} pl-1 pr-3 text-right`}>
                        <ActionMenu items={rowMenu(r)} label={t("{name} — amallar", { name: r.name })} width={236}>
                          {(trigger, open) => (
                            <button
                              type="button"
                              {...trigger}
                              title={t("Amallar")}
                              aria-label={t("{name} — amallar", { name: r.name })}
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
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </div>

      {/* «Yangi o'quvchi» — yangi versiya o'ngdan paneli; qolgan oynalar hozircha eski ko'rinishda. */}
      {addOpen && (
        <NewStudentDrawerV2
          groups={groups}
          groupCategory={groupCategory}
          onClose={() => setAddOpen(false)}
          onSaved={(pupil, gid) => {
            // Ro'yxatda darhol (PupilsContext), tepada; guruh tanlangan bo'lsa — «Guruh» ustuni ham.
            insertPupil(pupil);
            setPage(1);
            if (gid !== null) reloadGroups();
          }}
        />
      )}
      {groupFor && (
        <GroupPickerModal
          onClose={() => setGroupFor(null)}
          onSelect={async (group) => {
            const res = await fetch(`/api/groups/${group.id}/students`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pupilId: groupFor.id }),
            })
              .then((r) => r.json())
              .catch(() => null);
            if (!res?.ok) {
              toastErr(res?.error || "Guruhga qo'shishda xatolik yuz berdi");
              return;
            }
            toastOk(t("{name} — \"{id}\" guruhiga qo'shildi", { name: groupFor.name, id: group.name || group.id }));
            setGroupFor(null);
            // «Guruh» ustuni va tezkor panel yangi a'zolikni darhol ko'rsatsin.
            reloadGroups();
          }}
        />
      )}
      {smsFor && (
        <SmsModal
          studentName={smsFor.name}
          phone={smsFor.phone}
          onClose={() => setSmsFor(null)}
          onSent={({ simulated }) => {
            if (simulated) toastErr("SMS jo'natilmadi: Eskiz sozlanmagan (jurnalga yozildi)");
            else toastOk("SMS yuborildi");
            setSmsFor(null);
          }}
          onError={toastErr}
        />
      )}
      {statusFor && <StudentStatusModal student={statusFor} onClose={() => setStatusFor(null)} onSaved={handleStatusSaved} />}
      {payFor && (
        <StudentPaymentModalV2
          student={payFor}
          groups={groups}
          onClose={() => setPayFor(null)}
          // Balans ustuni va paneldagi «Balans» yangi to'lovni darhol ko'rsatsin.
          onSaved={() => reloadBalances()}
        />
      )}

      {/* 7. Tezkor panel. Kompyuterda (≥1024) — kontent hududi ichida (sahifa
          ildizi `relative`, yon menyu va yuqori panel ochiq qoladi, rasmdagidek);
          torroqda — butun ekran bo'ylab. Fon bosilsa yoki Esc — yopiladi. */}
      {panelRow && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 lg:absolute" onClick={() => setPanelId(null)} aria-hidden />
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] lg:absolute">
            <StudentQuickPanel
              key={panelRow.id}
              row={panelRow}
              groups={groups}
              onClose={() => setPanelId(null)}
              onSms={() => setSmsFor({ id: panelRow.id, name: panelRow.name, phone: panelRow.phone })}
              onPay={() => setPayFor(panelRow)}
              onAddToGroup={() => setGroupFor({ id: panelRow.id, name: panelRow.name })}
              onChangeStatus={() => setStatusFor({ id: panelRow.id, name: panelRow.name, status: panelRow.status, statusReason: panelRow.statusReason })}
            />
          </div>
        </>
      )}
    </div>
  );
}
