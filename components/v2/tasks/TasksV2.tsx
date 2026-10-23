"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Undo2,
  Wallet,
  X,
} from "lucide-react";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import TaskDrawer from "@/components/staff-tasks/TaskDrawer";
import { TaskTypesManager } from "@/components/staff-tasks/StaffTasksPage";
import { useStaffFmt } from "@/components/staff-tasks/format";
import { useStaffTasksData, useStaffTasksDrawer } from "@/components/staff-tasks/useStaffTasksCore";
import { CARD_FILTERS, EMPTY_FILTERS, cardOn, filterTasks, taskCardStats, toggleCard, useTaskFilterOptions, type TaskFilters } from "@/components/staff-tasks/taskListCore";
import { DEFAULT_SETTINGS, DUE_OPTIONS, PRIORITIES, STATUSES, isActive, isOpen, type DueFilter, type StaffTask, type StaffTaskViewerInfo } from "@/lib/staffTasks";
import TaskActionDialogV2 from "./TaskActionDialogV2";
import TaskFormDialogV2 from "./TaskFormDialogV2";
import { DueCellV2, PriorityBadgeV2, SeenLine, StatusChipV2, TaskAvatar, V2_STATUS_LABEL, titleSubline, useTaskV2Fmt } from "./taskBitsV2";

// YANGI VERSIYA — TOPSHIRIQLAR (rasm «Topshiriqlar · Rahbar», yorug'/qorong'i,
// 23.10.2026):
//   1. sarlavha + «filial · kimning topshiriqlari», o'ngda «⋯» va «+ Topshiriq berish»;
//   2. to'rt karta bitta qatorda (Faol / Tasdiq kutilmoqda / Muddati o'tgan /
//      Bajarilmadi · shu oy) — rangli nuqta, son, izoh; bosilsa holat filtri
//      (tanlangani brend fon + pastda brend chiziq);
//   3. filtrlar: «Topshiriq nomi» qidiruvi, Xodim, Muhimlik, Filial, 📅 Muddat (+ Holat —
//      eski sahifadagi holat filtri, rasmda yo'q: SAVOLLAR 136);
//   4. jadval: Topshiriq (nom + holatga qarab izoh), Xodim (avatar + ism), Muhimlik
//      (raqam), Muddat (sana + «2 kun qoldi»), Holat (belgi + «ko'rildi»), amal —
//      «Tasdiq kutilmoqda»da «✓ Tasdiqlash» va «↩» (qator binafsha fonda), qolganida «⋯»;
//   5. pastda «1–6 / 10 ta» va holat qanday o'zgarishi haqida izoh.
//
// MA'LUMOT va MANTIQ eski sahifa bilan BITTA: components/staff-tasks/useStaffTasksCore.ts
// (yuklash, soat, `?open=`/`?new=`), taskListCore.ts (filtr, kartalar), useTaskForm.ts,
// useTaskAction.ts. Batafsil panel (tarix, muddat chizig'i) hozircha ESKI ko'rinishda
// (TaskDrawer) — rasmi kelmagan; uning «Tahrirlash»i yangi oynani ochadi. Jarimalar,
// Statistika va Sozlamalar — «⋯» dan, eski sahifa tablarida (`/tasks?tab=…`).

const PAGE = 50;

const th = "sticky top-0 z-10 whitespace-nowrap bg-v2-surface-2 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";

const NO_VIEWER: StaffTaskViewerInfo = { role: "xodim", name: "", employeeId: null, branchIds: [] };

export default function TasksV2() {
  const fmt = useStaffFmt();
  const { t, rel, money } = fmt;
  const vf = useTaskV2Fmt();
  const pathname = usePathname();

  const core = useStaffTasksData();
  const { data, error, nowMs, load, viewer, role, mgr } = core;
  const dr = useStaffTasksDrawer({ core, cleanHref: pathname, fmt });
  const { drawer, setDrawer, action, setAction, openTask, closeDrawer, listTask, detailFor, detailError } = dr;

  const [f, setF] = useState<TaskFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [typesOpen, setTypesOpen] = useState(false);
  // Tahrirlash qayerdan ochilgan: ro'yxat «⋯» dan — yopilganda ro'yxatga; batafsil
  // paneldan — panelga qaytadi.
  const [editFromList, setEditFromList] = useState(false);
  const setFilters = (next: TaskFilters) => {
    setF(next);
    setPage(1);
  };
  const set = (patch: Partial<TaskFilters>) => setFilters({ ...f, ...patch });

  const tasks = useMemo(() => data?.tasks ?? [], [data]);
  const branches = useMemo(() => data?.branches ?? [], [data]);
  const employees = useMemo(() => data?.employees ?? [], [data]);
  const settings = data?.settings ?? DEFAULT_SETTINGS;
  const { branchOptions, showBranch, branchName, empOptions } = useTaskFilterOptions({ tasks, viewer: viewer ?? NO_VIEWER, branches, employees });
  const loading = !data && !error;

  // ── Kartalar ──
  const stats = useMemo(() => taskCardStats(tasks, nowMs, settings.graceHours), [tasks, nowMs, settings.graceHours]);
  const cards = [
    {
      ...CARD_FILTERS[0],
      label: t("Faol"),
      dot: "bg-v2-info",
      count: stats.faol.length,
      sub: !stats.faol.length
        ? t(mgr ? "hozircha yo'q" : "sizga faol topshiriq yo'q")
        : stats.todayN
          ? t("{n} tasi bugun tugaydi", { n: stats.todayN })
          : stats.nextDl !== null
            ? t("eng yaqin deadline {rel}", { rel: rel(stats.nextDl, nowMs) })
            : t("hammasi qayta muddatda"),
    },
    {
      ...CARD_FILTERS[1],
      label: t("Tasdiq kutilmoqda"),
      dot: "bg-v2-violet",
      count: stats.wait.length,
      sub: stats.wait.length ? (mgr ? t("xodim «Bajardim» bosgan") : t("rahbar tekshirmoqda")) : t("tekshiriladigan natija yo'q"),
    },
    {
      ...CARD_FILTERS[2],
      label: t("Muddati o'tgan"),
      dot: "bg-v2-warning",
      count: stats.over.length,
      sub: t("qayta muddat: {n} soat", { n: settings.graceHours }),
    },
    {
      ...CARD_FILTERS[3],
      label: t("Bajarilmadi · shu oy"),
      dot: "bg-v2-danger",
      count: stats.fail.length,
      sub: stats.fail.length ? t("jarima {sum}", { sum: money(stats.sumFail) }) : t("jarima yozilmagan"),
    },
  ];

  // ── Filtr variantlari ──
  const statusOptions = useMemo(
    () => [
      { value: "faol", label: "Faol" },
      ...STATUSES.filter((s) => s !== "yangi").map((s) => ({ value: s, label: V2_STATUS_LABEL[s] })),
    ],
    [],
  );
  const prioOptions = useMemo(() => PRIORITIES.map((p) => ({ value: String(p), label: String(p), hint: fmt.num(settings.fines[String(p)] ?? 0) })), [settings.fines, fmt]);
  const dueOptions = useMemo(() => DUE_OPTIONS.map((o) => ({ value: o.value, label: o.label })), []);

  // ── Ro'yxat va sahifalash ──
  const rows = useMemo(() => {
    const list = filterTasks(tasks, f, mgr, nowMs);
    if (!mgr) return list;
    // Rahbarning navbati — o'zi tasdiqlaydigan «Tasdiq kutilmoqda» — eng tepada (rasmdagidek);
    // qolgani eski tartibda (muddati o'tgan, faol, yopilganlar). SAVOLLAR 137.
    const queue = (x: StaffTask) => x.canManage && x.status === "tasdiq_kutilmoqda";
    return [...list.filter(queue), ...list.filter((x) => !queue(x))];
  }, [tasks, f, mgr, nowMs]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages);
  const slice = rows.slice((cur - 1) * PAGE, cur * PAGE);
  const from = rows.length ? (cur - 1) * PAGE + 1 : 0;
  const to = Math.min(rows.length, cur * PAGE);
  const anyFilter = !!(f.q || f.status || f.due || f.emp || f.branch || f.prio);

  // ── Sarlavha ──
  const sub = !viewer
    ? ""
    : role === "direktor"
      ? t("Barcha filiallar · barcha topshiriqlar")
      : role === "rahbar"
        ? `${branches.filter((b) => viewer.branchIds?.includes(b.id)).map((b) => b.name).join(", ")} · ${t("siz boshqaradigan topshiriqlar")}`
        : t("Sizga berilgan topshiriqlar");

  const pageMenu: ActionMenuEntry[] = [
    { key: "fines", label: mgr ? t("Jarimalar") : t("Jarimalarim"), icon: Wallet, href: `${pathname}?tab=fines` },
    { key: "stats", label: mgr ? t("Statistika") : t("Statistikam"), icon: BarChart3, href: `${pathname}?tab=stats` },
    ...(role === "direktor" ? [{ key: "settings", label: t("Jarima va muddatlar"), icon: Settings2, href: `${pathname}?tab=settings` }] : []),
    ...(mgr ? [{ key: "d1", divider: true as const }, { key: "types", label: t("O'quvchi vazifalari turlari"), icon: ListChecks, onSelect: () => setTypesOpen(true) }] : []),
  ];

  function rowMenu(x: StaffTask): ActionMenuEntry[] {
    const items: ActionMenuEntry[] = [{ key: "open", label: t("Batafsil"), icon: ClipboardList, onSelect: () => openTask(x.id) }];
    if (x.isMine && isActive(x.status)) items.push({ key: "done", label: t("Bajardim"), icon: Check, onSelect: () => setAction({ kind: "done", task: x }) });
    if (x.canManage && x.status === "tasdiq_kutilmoqda") {
      items.push(
        { key: "approve", label: t("Tasdiqlash"), icon: Check, onSelect: () => setAction({ kind: "approve", task: x }) },
        { key: "return", label: t("Qaytarish"), icon: Undo2, onSelect: () => setAction({ kind: "return", task: x }) },
      );
    }
    if (x.canManage && isActive(x.status)) {
      items.push({
        key: "edit",
        label: t("Tahrirlash"),
        icon: Pencil,
        onSelect: () => {
          setEditFromList(true);
          setDrawer({ mode: "form", id: x.id });
        },
      });
    }
    if (x.canManage && isOpen(x.status)) {
      items.push({ key: "d", divider: true }, { key: "cancel", label: t("Bekor qilish"), icon: X, danger: true, onSelect: () => setAction({ kind: "cancel", task: x }) });
    }
    return items;
  }

  const colCount = mgr ? 6 : 5;

  return (
    <div data-ui="v2" className="relative flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5 lg:h-full lg:min-h-0">
      {/* 1. Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("Topshiriqlar")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">{sub || " "}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionMenu items={pageMenu} label={t("Qo'shimcha amallar")} width={248}>
            {(trigger) => (
              <button type="button" {...trigger} title={t("Qo'shimcha amallar")} aria-label={t("Qo'shimcha amallar")} className={secondaryIcon}>
                <MoreHorizontal className="size-4" strokeWidth={1.75} />
              </button>
            )}
          </ActionMenu>
          {mgr && (
            <button type="button" onClick={() => setDrawer({ mode: "form", id: null })} className={primaryBtn}>
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {t("Topshiriq berish")}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-v2-md bg-v2-danger-bg px-3 py-2.5 text-v2-small text-v2-text">
          <AlertTriangle className="size-4 shrink-0 text-v2-danger" strokeWidth={2} aria-hidden />
          <span className="min-w-0 flex-1">{t(error)}</span>
          <button type="button" onClick={() => void load()} className={secondaryBtn}>
            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Qayta urinish")}
          </button>
        </div>
      )}

      {viewer && role === "xodim" && viewer.employeeId === null && (
        <div className="rounded-v2-md bg-v2-info-bg px-3 py-2.5 text-v2-small text-v2-text">
          {t("Hisobingiz xodimlar ro'yxatiga bog'lanmagan — sizga topshiriq berib bo'lmaydi. Administratorga murojaat qiling.")}
        </div>
      )}

      {/* 2. Kartalar */}
      <div className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border shadow-v2-sm min-[64rem]:grid-cols-4">
        {cards.map((c) => {
          const on = cardOn(c, f);
          return (
            <button
              key={c.status}
              type="button"
              aria-pressed={on}
              onClick={() => setFilters(toggleCard(c, f))}
              className={`relative flex min-w-0 flex-col items-start px-4 py-3 text-left transition-colors focus-visible:z-10 focus-visible:shadow-v2-focus focus-visible:outline-none ${
                on ? "bg-v2-brand-bg" : "bg-v2-surface hover:bg-v2-surface-2"
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5 text-v2-small font-medium text-v2-text">
                <span className={`size-2 shrink-0 rounded-full ${c.dot}`} aria-hidden />
                <span className="truncate">{c.label}</span>
              </span>
              <span className="mt-1 text-[1.375rem] font-semibold leading-7 tabular-nums text-v2-text">{loading ? "—" : c.count}</span>
              <span className="mt-0.5 w-full truncate text-v2-caption font-normal text-v2-text-2">{loading ? " " : c.sub}</span>
              {on && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-v2-brand" aria-hidden />}
            </button>
          );
        })}
      </div>

      {/* 3. Filtrlar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <input
            value={f.q}
            onChange={(e) => set({ q: e.target.value })}
            type="search"
            placeholder={t("Topshiriq nomi")}
            aria-label={t("Topshiriq nomi")}
            className="h-9 w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
          />
        </div>
        {mgr && <V2Select variant="chip" label={t("Xodim")} value={f.emp} onChange={(v) => set({ emp: v })} options={empOptions} />}
        {mgr && <V2Select variant="chip" label={t("Muhimlik")} value={f.prio} onChange={(v) => set({ prio: v })} options={prioOptions} searchable={false} />}
        {showBranch && <V2Select variant="chip" label={t("Filial")} value={f.branch} onChange={(v) => set({ branch: v })} options={branchOptions} searchable={false} />}
        <V2Select variant="chip" label={t("Muddat")} icon={CalendarDays} value={f.due} onChange={(v) => set({ due: v as DueFilter })} options={dueOptions} searchable={false} />
        <V2Select variant="chip" label={t("Holat")} value={f.status} onChange={(v) => set({ status: v })} options={statusOptions} searchable={false} />
        {anyFilter && (
          <button type="button" onClick={() => setFilters({ ...EMPTY_FILTERS })} className="inline-flex h-9 items-center px-2 text-v2-small font-medium text-v2-brand-text hover:underline">
            {t("Filtrlarni tozalash")}
          </button>
        )}
      </div>

      {/* 4. Jadval */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none">
          <table className={`w-full border-collapse text-v2-body ${mgr ? "min-w-[920px]" : "min-w-[720px]"}`}>
            <thead>
              <tr>
                <th className={`${th} pl-4 pr-3`}>{t("Topshiriq")}</th>
                {mgr && <th className={`${th} px-3`}>{t("Xodim")}</th>}
                <th className={`${th} px-3 text-center`}>{t("Muhimlik")}</th>
                <th className={`${th} px-3`}>{t("Muddat")}</th>
                <th className={`${th} px-3`}>{t("Holat")}</th>
                <th className={`${th} pl-1 pr-4`}>
                  <span className="sr-only">{t("Amallar")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={`sk${i}`} className="border-b border-v2-border" aria-hidden>
                    <td className="py-3.5 pl-4 pr-3">
                      <div className="h-3 w-56 rounded bg-v2-skeleton" />
                      <div className="mt-2 h-2.5 w-36 rounded bg-v2-skeleton" />
                    </td>
                    {mgr && (
                      <td className="px-3">
                        <div className="flex items-center gap-2">
                          <div className="size-7 rounded-full bg-v2-skeleton" />
                          <div className="h-3 w-28 rounded bg-v2-skeleton" />
                        </div>
                      </td>
                    )}
                    <td className="px-3">
                      <div className="mx-auto size-7 rounded-v2-md bg-v2-skeleton" />
                    </td>
                    <td className="px-3">
                      <div className="h-3 w-28 rounded bg-v2-skeleton" />
                    </td>
                    <td className="px-3">
                      <div className="h-5 w-20 rounded-v2-full bg-v2-skeleton" />
                    </td>
                    <td />
                  </tr>
                ))}

              {!loading && slice.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="p-6">
                    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                        <ListChecks className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      {tasks.length === 0 ? (
                        mgr ? (
                          <>
                            <div className="text-v2-section text-v2-text">{t("Hali topshiriq yo'q")}</div>
                            <p className="text-v2-small text-v2-text-2">{t("Xodimga muddat va muhimlik bilan topshiriq bering — bajarilmasa jarima Oylikka tushadi.")}</p>
                            <button type="button" onClick={() => setDrawer({ mode: "form", id: null })} className={`${primaryBtn} mt-2`}>
                              <Plus className="size-4" strokeWidth={2} aria-hidden />
                              {t("Birinchi topshiriqni bering")}
                            </button>
                          </>
                        ) : (
                          <div className="text-v2-section text-v2-text">{t("Sizga hozircha topshiriq berilmagan.")}</div>
                        )
                      ) : (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Filtrga mos topshiriq yo'q.")}</div>
                          <p className="text-v2-small text-v2-text-2">{t("Qidiruv yoki filtrlarni o'zgartirib ko'ring.")}</p>
                          <button type="button" onClick={() => setFilters({ ...EMPTY_FILTERS })} className={`${secondaryBtn} mt-2`}>
                            {t("Filtrlarni tozalash")}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                slice.map((x) => {
                  const waiting = x.canManage && x.status === "tasdiq_kutilmoqda";
                  const quickDone = x.isMine && isActive(x.status);
                  const subline = titleSubline(x, nowMs, fmt, vf);
                  return (
                    <tr
                      key={x.id}
                      tabIndex={0}
                      onClick={() => openTask(x.id)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                          e.preventDefault();
                          openTask(x.id);
                        }
                      }}
                      className={`group cursor-pointer border-b border-v2-border transition-colors last:border-b-0 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--v2-brand)] ${waiting ? ROW_TINT.violet : ROW_TINT.hover}`}
                    >
                      <td className="max-w-[360px] py-2.5 pl-4 pr-3">
                        <div className="truncate text-v2-body font-semibold text-v2-text group-hover:underline group-hover:underline-offset-2">{x.title}</div>
                        {subline && <div className="mt-0.5 truncate text-v2-caption font-normal text-v2-text-2">{subline}</div>}
                      </td>
                      {mgr && (
                        <td className="px-3 py-2.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <TaskAvatar name={x.employeeName} />
                            <div className="min-w-0">
                              <div className="truncate text-v2-small text-v2-text">{x.employeeName}</div>
                              {showBranch && <div className="truncate text-v2-caption font-normal text-v2-text-3">{branchName.get(x.branchId) ?? ""}</div>}
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-center">
                        <PriorityBadgeV2 p={x.priority} title={t("Muhimlik {n} · bajarilmasa {fine}", { n: x.priority, fine: money(x.fineAmount) })} />
                      </td>
                      <td className="px-3 py-2.5">
                        <DueCellV2 task={x} nowMs={nowMs} fmt={fmt} vf={vf} graceHours={settings.graceHours} />
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusChipV2 status={x.status} />
                        {x.canManage && isActive(x.status) && <SeenLine seen={!!x.seenAt} />}
                      </td>
                      <td className="py-2.5 pl-1 pr-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {waiting ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setAction({ kind: "approve", task: x })}
                                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-v2-md bg-v2-brand px-3 text-v2-small font-semibold text-v2-on-brand transition-[filter] hover:brightness-95 focus-visible:shadow-v2-focus focus-visible:outline-none"
                              >
                                <Check className="size-4" strokeWidth={2} aria-hidden />
                                {t("Tasdiqlash")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setAction({ kind: "return", task: x })}
                                title={t("Qaytarish")}
                                aria-label={t("Qaytarish")}
                                className="inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md border border-v2-border-strong bg-v2-surface text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:shadow-v2-focus focus-visible:outline-none"
                              >
                                <Undo2 className="size-4" strokeWidth={1.75} />
                              </button>
                            </>
                          ) : quickDone ? (
                            <button
                              type="button"
                              onClick={() => setAction({ kind: "done", task: x })}
                              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-v2-md bg-v2-brand px-3 text-v2-small font-semibold text-v2-on-brand transition-[filter] hover:brightness-95 focus-visible:shadow-v2-focus focus-visible:outline-none"
                            >
                              <Check className="size-4" strokeWidth={2} aria-hidden />
                              {t("Bajardim")}
                            </button>
                          ) : (
                            <ActionMenu items={rowMenu(x)} label={t("Amallar")}>
                              {(trigger, open) => (
                                <button
                                  type="button"
                                  {...trigger}
                                  title={t("Amallar")}
                                  aria-label={t("Amallar")}
                                  className={`inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface hover:text-v2-text focus-visible:shadow-v2-focus focus-visible:outline-none ${open ? "bg-v2-surface text-v2-text" : ""}`}
                                >
                                  <MoreHorizontal className="size-4" strokeWidth={1.75} />
                                </button>
                              )}
                            </ActionMenu>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* 5. Pastki qator */}
        {!loading && rows.length > 0 && (
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-v2-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-v2-small tabular-nums text-v2-text-2">
                <span className="font-semibold text-v2-text">
                  {from}–{to}
                </span>{" "}
                / {t("{n} ta", { n: rows.length })}
              </span>
              {pages > 1 && (
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage(cur - 1)}
                    disabled={cur <= 1}
                    aria-label={t("Oldingi sahifa")}
                    className="inline-flex size-7 items-center justify-center rounded-v2-md border border-v2-border-strong bg-v2-surface text-v2-text-2 hover:bg-v2-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="size-4" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(cur + 1)}
                    disabled={cur >= pages}
                    aria-label={t("Keyingi sahifa")}
                    className="inline-flex size-7 items-center justify-center rounded-v2-md border border-v2-border-strong bg-v2-surface text-v2-text-2 hover:bg-v2-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="size-4" strokeWidth={1.75} />
                  </button>
                </span>
              )}
            </div>
            <p className="min-w-0 text-v2-caption font-normal text-v2-text-2 sm:ml-auto sm:text-right">
              {t("Holat avtomatik o'zgaradi: muddat o'tsa — «Muddati o'tdi», qayta muddat ham o'tsa — «Bajarilmadi» va jarima.")}
            </p>
          </div>
        )}
      </div>

      {/* Batafsil — eski panel (rasmi kelmagan). «Tahrirlash» → yangi oyna. */}
      {drawer?.mode === "detail" && data && (
        <TaskDrawer
          state={drawer}
          listTask={listTask}
          detail={detailFor}
          detailError={detailError}
          branches={data.branches}
          employees={data.employees}
          settings={data.settings}
          nowMs={nowMs}
          fmt={fmt}
          onClose={closeDrawer}
          onMode={(m) => {
            setEditFromList(false);
            setDrawer(m);
          }}
          onAction={(task, kind) => setAction({ kind, task })}
          onCreated={dr.onCreated}
          onUpdated={dr.onUpdated}
        />
      )}

      {drawer?.mode === "form" && data && (drawer.id === null || listTask) && (
        <TaskFormDialogV2
          key={`${drawer.id ?? "new"}`}
          task={drawer.id === null ? null : (detailFor ?? listTask)}
          initialEmployeeIds={drawer.id === null && drawer.employeeId ? [drawer.employeeId] : undefined}
          employees={data.employees}
          branches={data.branches}
          settings={data.settings}
          nowMs={nowMs}
          fmt={fmt}
          onClose={() => (drawer.id === null || editFromList ? closeDrawer() : setDrawer({ mode: "detail", id: drawer.id }))}
          onCreated={dr.onCreated}
          onUpdated={dr.onUpdated}
        />
      )}

      {action && (
        <TaskActionDialogV2
          target={action}
          nowMs={nowMs}
          fmt={fmt}
          onClose={() => setAction(null)}
          onTaskDone={dr.onTaskDone}
          onFineDone={dr.onFineDone}
        />
      )}

      {typesOpen && <TaskTypesManager onClose={() => setTypesOpen(false)} />}
    </div>
  );
}
