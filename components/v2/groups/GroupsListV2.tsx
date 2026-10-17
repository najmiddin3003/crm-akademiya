"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CalendarCheck, Download, History, ListFilter, MoreHorizontal, Pencil, Plus, Search, SquareArrowOutUpRight, Upload, Users, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import GroupFormModal from "@/components/groups/GroupFormModal";
import { useGroupsList, type GroupsListInitial } from "@/components/groups/useGroupsList";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import ColumnsControl from "@/components/v2/ui/ColumnsControl";
import FloatingPanel from "@/components/v2/ui/FloatingPanel";
import StaffName from "@/components/v2/ui/StaffName";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import V2Select from "@/components/v2/ui/V2Select";
import { moreFiltersCls, primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { DENSITY_CELL, DENSITY_ROW } from "@/components/v2/ui/columnPrefs";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { GROUP_TONE, timeLabel } from "@/components/v2/ui/groupStatus";
import { ROW_BAR, ROW_TINT } from "@/components/v2/ui/table";
import { GROUP_STATUS_VALUES } from "@/lib/groupRules";
import type { Group } from "@/lib/groups";
import { groupsCsvBlob, groupsXlsBlob } from "@/lib/groupsExport";
import { applyGroupFilters, dmyKey, EMPTY_GROUP_FILTERS, groupDates, groupStudentCount, lessonMinutes, memberIdsOf, type GroupFilters } from "@/lib/groupsList";
import { downloadBlob } from "@/lib/studentsExport";
import GroupsMoreFilters, { countGroupMore, EMPTY_GROUP_MORE, pickGroupMore, type GroupMoreFilters } from "./GroupsMoreFilters";
import { useGroupColumns, type GroupColumnKey, type GroupSortKey } from "./groupsColumns";

// YANGI VERSIYA — GURUHLAR RO'YXATI (rasm «Guruhlar · Ustunlar», 18.10.2026;
// andoza — O'quvchilar ro'yxati, design/v2/DESIGN.md → «Sahifa qolipi — ro'yxat»):
//
//   1. sarlavha: «Guruhlar» + «filial · N ta guruh»; «Export» (Excel, CSV va
//      CSV'dan import), «+ Guruh qo'shish»;
//   2. filtr qatori: qidiruv → DOIM ko'rinadigan Kurs / O'qituvchi / Guruh
//      holati → «Yana filtrlar» (./GroupsMoreFilters.tsx) → o'ngda «Ustunlar»
//      (surib tartiblanadi, qator zichligi — components/v2/ui/ColumnsControl.tsx);
//   3. xulosa: «N ta guruh • O'quvchilar • Muzlatilgan» (+ bugun davomat
//      qilinmaganlar soni) — ro'yxatdagi guruhlar bo'yicha;
//   4. jadval: «Guruh nomi» (fan rangidagi nuqta) doim birinchi; qator bosilsa —
//      guruh sahifasi; «⋯» — Davomat, Guruh tarixi, Tahrirlash;
//   5. sahifalash.
//
// Ma'lumot, filtr, sanash, import va eksport — eski sahifa bilan BITTA manbadan
// (components/groups/useGroupsList.ts, lib/groupsList.ts, lib/groupsExport.ts).
// Guruh qo'shish/tahrirlash oynasi hozircha eski. Taxminlar: SAVOLLAR 42–50.

function fmtNum(n: number): string {
  return n.toLocaleString("ru-RU").replace(/,/g, " ");
}

interface SortState {
  key: GroupSortKey;
  dir: "asc" | "desc";
}

/** Bir bosish — tartib, ikkinchisi — teskari, uchinchisi — sukut (bazadagi tartib, id bo'yicha). */
function nextSort(s: SortState | null, key: GroupSortKey): SortState | null {
  const first: SortState["dir"] = key === "name" ? "asc" : "desc";
  if (!s || s.key !== key) return { key, dir: first };
  if (s.dir === first) return { key, dir: first === "asc" ? "desc" : "asc" };
  return null;
}

function sortGroups(list: Group[], s: SortState | null): Group[] {
  if (!s) return list;
  const sign = s.dir === "asc" ? 1 : -1;
  const value = (g: Group): number | string | null =>
    s.key === "name" ? g.name || "" : s.key === "students" ? groupStudentCount(g) : dmyKey(s.key === "startDate" ? groupDates(g).start : groupDates(g).end);
  return [...list].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    // Sanasi yo'q guruh — har ikki yo'nalishda ham oxirida.
    if (va === null || vb === null) return va === vb ? a.id - b.id : va === null ? 1 : -1;
    const c = typeof va === "string" ? va.localeCompare(String(vb), "uz", { numeric: true }) : va - (vb as number);
    return c !== 0 ? c * sign : a.id - b.id;
  });
}

const STATUS_OPTIONS = GROUP_STATUS_VALUES.map((v) => ({ value: v, label: GROUP_TONE[v]?.label ?? v }));

export default function GroupsListV2({ initialGroups, initialFrozenPupils }: GroupsListInitial) {
  const { t } = useT();
  const router = useRouter();
  const branch = useBranch();
  const { groups, loading, pupilsLoading, options, frozenIds, upsert, importing, importCsv } = useGroupsList({ initialGroups, initialFrozenPupils });
  const columns = useGroupColumns();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<GroupFilters>(EMPTY_GROUP_FILTERS);
  const [sort, setSort] = useState<SortState | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editFor, setEditFor] = useState<Group | null>(null);

  const setFilter = <K extends keyof GroupFilters>(k: K, v: GroupFilters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const filtered = useMemo(() => applyGroupFilters(groups, search, filters), [groups, search, filters]);
  const sorted = useMemo(() => sortGroups(filtered, sort), [filtered, sort]);

  // Xulosa — RO'YXATDAGI guruhlar bo'yicha (filtr qo'llansa — o'shalar).
  const members = useMemo(() => memberIdsOf(filtered), [filtered]);
  const frozenCount = useMemo(() => [...members].filter((id) => frozenIds.has(id)).length, [members, frozenIds]);
  const notMarked = useMemo(() => filtered.filter((g) => g.highlighted).length, [filtered]);

  const start = (page - 1) * pageSize;
  const slice = sorted.slice(start, start + pageSize);

  /* ---- Eksport va import ---- */
  const exportItems: ActionMenuEntry[] = [
    { key: "h", heading: t("Ro'yxatdagilar: {n} ta", { n: sorted.length }) },
    { key: "xls", label: t("Excel fayl"), hint: "XLS", icon: Download, onSelect: () => downloadBlob(groupsXlsBlob(sorted), "guruhlar.xls") },
    { key: "csv", label: t("CSV fayl"), hint: "CSV", icon: Download, onSelect: () => downloadBlob(groupsCsvBlob(sorted), "guruhlar.csv") },
    { key: "d", divider: true },
    {
      key: "import",
      label: importing ? t("Import qilinmoqda…") : t("CSV fayldan import"),
      icon: Upload,
      disabled: importing,
      onSelect: () => fileRef.current?.click(),
    },
  ];

  /* ---- Qo'shimcha filtrlar ---- */
  const appliedMore = pickGroupMore(filters);
  const moreCount = countGroupMore(appliedMore);
  const applyMore = (next: GroupMoreFilters) => {
    setFilters((f) => ({ ...f, ...next }));
    setPage(1);
    setMoreOpen(false);
  };
  const timeRange = `${filters.startTime || "…"} – ${filters.endTime || "…"}`;
  const moreChips: { key: string; label: string; clear: () => void }[] = [
    ...(filters.day ? [{ key: "day", label: `${t("Kun")}: ${filters.day}`, clear: () => setFilter("day", "") }] : []),
    ...(filters.oddEven ? [{ key: "oddEven", label: `${t("Toq/Juft kunlar")}: ${t(filters.oddEven === "Toq" ? "Toq kunlar" : "Juft kunlar")}`, clear: () => setFilter("oddEven", "") }] : []),
    ...(filters.startTime || filters.endTime ? [{ key: "time", label: `${t("Dars vaqti")}: ${timeRange}`, clear: () => applyMore({ ...appliedMore, startTime: "", endTime: "" }) }] : []),
    ...(filters.room ? [{ key: "room", label: `${t("Xona")}: ${filters.room}`, clear: () => setFilter("room", "") }] : []),
    ...(filters.eduType ? [{ key: "eduType", label: `${t("Ta'lim turi")}: ${t(filters.eduType)}`, clear: () => setFilter("eduType", "") }] : []),
  ];
  const anyFilter = search.trim() !== "" || (Object.keys(EMPTY_GROUP_FILTERS) as (keyof GroupFilters)[]).some((k) => filters[k] !== "");
  const clearAll = () => {
    setFilters(EMPTY_GROUP_FILTERS);
    setSearch("");
    setPage(1);
  };

  const toggleSort = (key: GroupSortKey) => {
    setSort((s) => nextSort(s, key));
    setPage(1);
  };

  const visibleCols = columns.shown;
  const colCount = visibleCols.length + 2;
  const rowH = DENSITY_ROW[columns.density];
  const cellY = DENSITY_CELL[columns.density];
  const branchName = branch.branches.find((b) => b.id === branch.branchId)?.name ?? "";

  /** Qator bosilsa — guruh sahifasi; havola, «⋯» va boshqa tugmalarning o'z ishi bor. */
  const onRowClick = (e: MouseEvent<HTMLTableRowElement>, id: number) => {
    if ((e.target as HTMLElement).closest("button, a, input, label")) return;
    router.push(`/groups/${id}`);
  };

  const th = "sticky top-0 z-10 whitespace-nowrap bg-v2-surface-2 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";

  /** Saralanadigan ustun sarlavhasi (render funksiyasi — komponent emas). */
  function sortHead(label: string, k: GroupSortKey) {
    const on = sort?.key === k;
    const Icon = on && sort?.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => toggleSort(k)}
        aria-label={t("{col} bo'yicha saralash", { col: label })}
        className={`group/sort inline-flex items-center gap-1 rounded-v2-sm hover:text-v2-text ${on ? "font-semibold text-v2-text" : ""}`}
      >
        {label}
        <Icon className={`size-3.5 ${on ? "" : "opacity-0 group-hover/sort:opacity-60"}`} strokeWidth={2} aria-hidden />
      </button>
    );
  }

  const dash = <span className="text-v2-text-3">—</span>;

  function cell(g: Group, key: GroupColumnKey) {
    switch (key) {
      case "name":
        return null; // qulflangan ustun — qatorda alohida chiziladi
      case "course":
        return g.course ? <span className="whitespace-nowrap text-v2-text-2">{g.course}</span> : dash;
      case "teacher":
        return g.teacher ? (
          <span className="whitespace-nowrap font-medium text-v2-text">
            <StaffName name={g.teacher} />
          </span>
        ) : (
          dash
        );
      case "schedule": {
        const parts = [g.day, timeLabel(g.time)].filter(Boolean);
        return parts.length ? <span className="whitespace-nowrap tabular-nums text-v2-text-2">{parts.join(" · ")}</span> : dash;
      }
      case "room":
        return g.room ? <span className="whitespace-nowrap text-v2-text-2">{g.room}</span> : dash;
      case "students":
        return <span className="tabular-nums text-v2-text">{groupStudentCount(g)}</span>;
      case "status": {
        const tone = GROUP_TONE[g.status];
        if (!tone) return g.status ? <span className="text-v2-text-2">{g.status}</span> : dash;
        return (
          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-v2-full px-2 py-0.5 text-v2-caption ${tone.badge}`}>
            <span className={`size-1.5 rounded-full ${tone.dot}`} aria-hidden />
            {t(tone.label)}
          </span>
        );
      }
      case "level":
        return g.level ? <span className="whitespace-nowrap text-v2-text-2">{g.level}</span> : dash;
      case "period":
        if (!g.period) return dash;
        return g.periodExpired ? (
          <span title={t("Guruh muddati tugagan")} className="inline-flex whitespace-nowrap rounded-v2-full bg-v2-danger-bg px-2 py-0.5 text-v2-caption tabular-nums text-v2-danger">
            {g.period}
          </span>
        ) : (
          <span className="whitespace-nowrap tabular-nums text-v2-text-2">{g.period}</span>
        );
      case "telegram":
        return g.telegram ? (
          <a
            href={g.telegram}
            target="_blank"
            rel="noreferrer"
            title={g.telegram}
            className="inline-flex max-w-[200px] items-center gap-1 text-v2-brand-text underline-offset-2 hover:underline"
          >
            <span className="truncate">{g.telegram.replace(/^https?:\/\//, "")}</span>
            <SquareArrowOutUpRight className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          </a>
        ) : (
          dash
        );
      case "eduType":
        return g.eduType ? (
          <span className="inline-flex whitespace-nowrap rounded-v2-sm border border-v2-border bg-v2-surface-2 px-1.5 py-0.5 text-v2-caption text-v2-text-2">{t(g.eduType)}</span>
        ) : (
          dash
        );
      case "duration": {
        const m = lessonMinutes(g.time);
        if (m === null) return dash;
        const h = Math.floor(m / 60);
        const rest = m % 60;
        const text = h && rest ? t("{h} soat {m} daqiqa", { h, m: rest }) : h ? t("{h} soat", { h }) : t("{m} daqiqa", { m: rest });
        return <span className="whitespace-nowrap tabular-nums text-v2-text-2">{text}</span>;
      }
      case "startDate":
      case "endDate": {
        const d = groupDates(g)[key === "startDate" ? "start" : "end"];
        return d ? <span className="whitespace-nowrap tabular-nums text-v2-text-2">{d}</span> : dash;
      }
    }
  }

  function rowMenu(g: Group): ActionMenuEntry[] {
    return [
      { key: "h", heading: g.name || t("Guruh") },
      { key: "open", label: t("Guruhni ochish"), icon: Users, href: `/groups/${g.id}` },
      { key: "att", label: t("Davomat"), icon: CalendarCheck, href: `/groups/${g.id}?tab=attendance` },
      { key: "hist", label: t("Guruh tarixi"), icon: History, href: `/groups/${g.id}?tab=history` },
      { key: "d", divider: true },
      { key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: () => setEditFor(g) },
    ];
  }

  return (
    <div data-ui="v2" className="relative flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5 lg:h-full lg:min-h-0">
      {/* 1. Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("Guruhlar")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {[branchName, loading ? t("Yuklanmoqda…") : t("{n} ta guruh", { n: fmtNum(groups.length) })].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              // Bir xil faylni ketma-ket ikki marta tanlash mumkin bo'lsin.
              e.target.value = "";
              if (f) importCsv(f);
            }}
          />
          <ActionMenu items={exportItems} label={t("Export")}>
            {(trigger) => (
              <button type="button" {...trigger} className={secondaryBtn}>
                <Download className="size-4" strokeWidth={1.75} aria-hidden />
                {t("Export")}
              </button>
            )}
          </ActionMenu>
          <button type="button" onClick={() => setAddOpen(true)} className={primaryBtn}>
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            {t("Guruh qo'shish")}
          </button>
        </div>
      </div>

      {/* 2. Filtr qatori */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            type="search"
            placeholder={t("Guruh nomi bo'yicha")}
            aria-label={t("Guruh nomi bo'yicha")}
            title={t("Guruh nomi, kurs, o'qituvchi yoki xona")}
            className="h-9 w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
          />
        </div>
        <V2Select variant="chip" label={t("Kurs")} value={filters.course} onChange={(v) => setFilter("course", v)} options={options.course.map((v) => ({ value: v, label: v }))} />
        <V2Select variant="chip" label={t("O'qituvchi")} value={filters.teacher} onChange={(v) => setFilter("teacher", v)} options={options.teacher.map((v) => ({ value: v, label: v }))} />
        <V2Select variant="chip" label={t("Guruh holati")} value={filters.status} onChange={(v) => setFilter("status", v)} options={STATUS_OPTIONS} searchable={false} />
        <button ref={moreBtnRef} type="button" onClick={() => setMoreOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={moreOpen} className={moreFiltersCls(moreOpen, moreCount > 0)}>
          <ListFilter className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Yana filtrlar")}
          {moreCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-v2-full bg-v2-brand px-1.5 text-[11px] font-semibold tabular-nums text-v2-on-brand">{moreCount}</span>
          )}
        </button>
        <FloatingPanel open={moreOpen} anchorRef={moreBtnRef} onClose={() => setMoreOpen(false)} width={520} maxHeight={560} role="dialog" ariaLabel={t("Qo'shimcha filtrlar")}>
          <GroupsMoreFilters applied={appliedMore} options={{ day: options.day, room: options.room }} onApply={applyMore} />
        </FloatingPanel>

        <div className="ml-auto">
          <ColumnsControl prefs={columns} />
        </div>
      </div>

      {/* Qo'llangan qo'shimcha filtrlar */}
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
          <button type="button" onClick={() => applyMore(EMPTY_GROUP_MORE)} className="h-7 rounded-v2-md px-2 text-v2-small font-medium text-v2-brand-text hover:bg-v2-brand-bg">
            {t("Tozalash")}
          </button>
        </div>
      )}

      {/* 3. Xulosa — javob kelmaguncha «—» (bo'sh ro'yxatdan sanalgan 0 yolg'on bo'lardi). */}
      <div className="-mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-v2-small text-v2-text-2">
        <span>
          <b className="font-semibold tabular-nums text-v2-text">{loading ? "—" : fmtNum(filtered.length)}</b> {t("ta guruh")}
        </span>
        <span aria-hidden>•</span>
        <span>
          {t("O'quvchilar")} <b className="font-semibold tabular-nums text-v2-text">{loading ? "—" : fmtNum(members.size)}</b>
        </span>
        <span aria-hidden>•</span>
        <span>
          {t("Muzlatilgan")} <b className="font-semibold tabular-nums text-v2-text">{loading || pupilsLoading ? "—" : fmtNum(frozenCount)}</b>
        </span>
        {notMarked > 0 && (
          <>
            <span aria-hidden>•</span>
            <span className="inline-flex items-center gap-1.5 text-v2-warning" title={t("Bu guruhlarning qatori sariq fonda")}>
              <span className="size-2 rounded-full bg-v2-warning" aria-hidden />
              {t("Bugun davomat qilinmagan")} <b className="font-semibold tabular-nums">{fmtNum(notMarked)}</b>
            </span>
          </>
        )}
      </div>

      {/* 4–5. Jadval va sahifalash */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
        <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
          <table className="w-full border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${th} pl-4 pr-2.5`}>{sortHead(t("Guruh nomi"), "name")}</th>
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
              {loading &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={`sk${i}`} className={`border-b border-v2-border ${rowH}`} aria-hidden>
                    <td className="py-3 pl-4 pr-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="size-2 rounded-full bg-v2-skeleton" />
                        <div className="h-3 w-32 rounded bg-v2-skeleton" />
                      </div>
                    </td>
                    {visibleCols.map((c) => (
                      <td key={c.key} className="px-2.5 py-3">
                        <div className="h-3 w-20 rounded bg-v2-skeleton" />
                      </td>
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
                      {groups.length === 0 ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Hozircha guruh yo'q")}</div>
                          <p className="text-v2-small text-v2-text-2">{t("Birinchi guruhni qo'shing — u shu ro'yxatda paydo bo'ladi.")}</p>
                          <button type="button" onClick={() => setAddOpen(true)} className={`${primaryBtn} mt-2`}>
                            <Plus className="size-4" strokeWidth={2} aria-hidden />
                            {t("Guruh qo'shish")}
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Mos guruh topilmadi")}</div>
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
                slice.map((g) => {
                  // Bugun davomat qilinmagan guruh — eski sahifadagi sariq qator,
                  // yangi ranglarda «Ogohlantirish» foni + chapda chiziq.
                  const warn = g.highlighted;
                  return (
                    <tr
                      key={g.id}
                      onClick={(e) => onRowClick(e, g.id)}
                      title={warn ? t("Bugun davomat qilinmagan") : undefined}
                      className={`group cursor-pointer border-b border-v2-border transition-colors last:border-b-0 ${rowH} ${warn ? ROW_TINT.warning : ROW_TINT.hover}`}
                    >
                      <td className={`${cellY} pl-4 pr-2.5 ${warn ? ROW_BAR.warning : ""}`}>
                        <span className="flex min-w-[140px] items-center gap-2.5">
                          <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />
                          <Link href={`/groups/${g.id}`} className="truncate font-semibold text-v2-text underline-offset-2 hover:text-v2-brand-text group-hover:underline">
                            {g.name || `#${g.id}`}
                          </Link>
                        </span>
                      </td>
                      {visibleCols.map((c) => (
                        <td key={c.key} className={`${cellY} px-2.5`}>
                          {cell(g, c.key)}
                        </td>
                      ))}
                      <td className={`${cellY} pl-1 pr-3 text-right`}>
                        <ActionMenu items={rowMenu(g)} label={t("{name} — amallar", { name: g.name || `#${g.id}` })} width={220}>
                          {(trigger, open) => (
                            <button
                              type="button"
                              {...trigger}
                              title={t("Amallar")}
                              aria-label={t("{name} — amallar", { name: g.name || `#${g.id}` })}
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

      {/* Oynalar — hozircha eski ko'rinishda (bo'limma-bo'lim almashadi). */}
      {addOpen && <GroupFormModal groups={groups} onClose={() => setAddOpen(false)} onSaved={upsert} />}
      {editFor && <GroupFormModal group={editFor} groups={groups} onClose={() => setEditFor(null)} onSaved={upsert} />}
    </div>
  );
}
