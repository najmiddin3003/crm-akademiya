"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, Filter, Plus, Users } from "lucide-react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import SearchInput from "@/components/ui/SearchInput";
import {
  DUE_OPTIONS,
  PRIORITIES,
  STATUSES,
  STATUS_LABEL,
  isActive,
  isLateDone,
  type DueFilter,
  type StaffTask,
  type StaffTaskBranch,
  type StaffTaskEmployee,
  type StaffTaskSettings,
  type StaffTaskViewerInfo,
} from "@/lib/staffTasks";
import { DueCell, PriorityBadge, StatusChip } from "./bits";
import type { StaffFmt } from "./format";
import { useAnimatedRows, useFlipRows } from "@/hooks/useAnimatedRows";
import { CARD_FILTERS, EMPTY_FILTERS, cardOn as cardOnFor, filterTasks, taskCardStats, toggleCard as toggleCardFor, useTaskFilterOptions, type TaskFilters } from "./taskListCore";

// «Topshiriqlar» tabi: filtr-kartalar, qidiruv/filtrlar va jadval.
//
// Kartalar va filtrlar KO'RINADIGAN barcha topshiriqlardan hisoblanadi
// (prototipdagidek); karta bosilsa holat filtri o'rnatiladi, yana bosilsa
// olinadi. Jadval har filtr o'zgarishida animatsiya bilan qayta
// terilishi — useAnimatedRows / useFlipRows. Filtrlash va kartalar hisobi —
// taskListCore.ts (yangi versiya bilan umumiy).

export { EMPTY_FILTERS, type TaskFilters } from "./taskListCore";

interface Props {
  tasks: StaffTask[];
  viewer: StaffTaskViewerInfo;
  branches: StaffTaskBranch[];
  employees: StaffTaskEmployee[];
  settings: StaffTaskSettings;
  nowMs: number;
  loading: boolean;
  filters: TaskFilters;
  onFilters: (f: TaskFilters) => void;
  onOpen: (task: StaffTask) => void;
  onQuick: (task: StaffTask, action: "done" | "approve") => void;
  onAdd: () => void;
  fmt: StaffFmt;
}

interface Card {
  status: string;
  due: DueFilter;
  label: string;
  count: number;
  color: string;
  sub: string;
}

export default function TaskList({ tasks, viewer, branches, employees, settings, nowMs, loading, filters: f, onFilters, onOpen, onQuick, onAdd, fmt }: Props) {
  const { t, rel, dur, money, monthLabel } = fmt;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const set = (patch: Partial<TaskFilters>) => onFilters({ ...f, ...patch });

  const { mgr, branchOptions, showBranch, branchName, empOptions } = useTaskFilterOptions({ tasks, viewer, branches, employees });

  const statusOptions = useMemo(
    () => [{ value: "faol", label: t("Faol topshiriqlar") }, ...STATUSES.map((s) => ({ value: s, label: t(STATUS_LABEL[s]) }))],
    [t],
  );
  const prioOptions = useMemo(() => PRIORITIES.map((p) => ({ value: String(p), label: t("Muhimlik {n}", { n: p }) })), [t]);
  const dueOptions = useMemo(() => DUE_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) })), [t]);

  // ── Kartalar ──
  const cards: Card[] = useMemo(() => {
    const { nowM, faol, wait, over, fail, todayN, nextDl, oldestWait: oldest, nearestOver: nearest, sumFail } = taskCardStats(tasks, nowMs, settings.graceHours);
    const subFaol = !faol.length
      ? t(mgr ? "hozircha yo'q" : "sizga faol topshiriq yo'q")
      : todayN
        ? t("{n} tasi bugun tugaydi", { n: todayN })
        : nextDl !== null
          ? t("eng yaqin deadline {rel}", { rel: rel(nextDl, nowMs) })
          : t("hammasi qayta muddatda");
    const subWait = oldest !== null ? t("eng eskisi {dur} kutmoqda", { dur: dur(nowMs - oldest) }) : t("tekshiriladigan natija yo'q");
    const subOver = nearest !== null ? t("eng yaqin jarima {rel}", { rel: rel(nearest, nowMs) }) : t("qayta muddatdagi topshiriq yo'q");
    const subFail = fail.length ? t("jarima {sum}", { sum: money(sumFail) }) : t("{month} — jarima yo'q", { month: monthLabel(nowM) });
    return [
      { ...CARD_FILTERS[0], label: t("Faol topshiriqlar"), count: faol.length, color: "stk-c-pri", sub: subFaol },
      { ...CARD_FILTERS[1], label: t("Tasdiq kutilmoqda"), count: wait.length, color: "stk-c-vio", sub: subWait },
      { ...CARD_FILTERS[2], label: t("Muddati o'tgan"), count: over.length, color: "stk-c-hot", sub: subOver },
      { ...CARD_FILTERS[3], label: t("Bajarilmadi (shu oy)"), count: fail.length, color: "stk-c-bad", sub: subFail },
    ];
  }, [tasks, nowMs, mgr, settings.graceHours, t, rel, dur, money, monthLabel]);

  const cardOn = (c: Card) => cardOnFor(c, f);
  const toggleCard = (c: Card) => onFilters(toggleCardFor(c, f));

  // ── Filtrlash ──
  const rows = useMemo(() => filterTasks(tasks, f, mgr, nowMs), [tasks, f, mgr, nowMs]);

  const activeCount = [f.status, f.due, mgr && f.emp, mgr && showBranch && f.branch, mgr && f.prio].filter(Boolean).length;
  const anyFilter = activeCount > 0 || !!f.q;
  const signature = `${f.q}|${f.status}|${f.emp}|${f.branch}|${f.prio}|${f.due}`;
  const animated = useAnimatedRows(rows, (x) => x.id, signature);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const els = useRef(new Map<number, HTMLElement>());
  useFlipRows(animated, bodyRef, els);
  // Tartib raqami — ketayotgan (so'nayotgan) qator sanalmaydi.
  const nums = useMemo(() => {
    let n = 0;
    return animated.map((r) => (r.phase === "exit" ? 0 : ++n));
  }, [animated]);

  const cols = mgr ? 7 : 6;
  const empty = !loading && animated.length === 0;

  return (
    <div className="space-y-4 stk-listwrap">
      <div className="stk-kpis">
        {cards.map((c) => (
          <button key={c.status} type="button" className={`stk-kpi ${c.color} ${cardOn(c) ? "is-on" : ""}`} onClick={() => toggleCard(c)} aria-pressed={cardOn(c)}>
            <span className="stk-kpi-lbl">
              {c.label}
              <span className="stk-kpi-check" aria-hidden="true">
                <Check className="h-3 w-3" />
              </span>
            </span>
            <span className="stk-kpi-num">{loading ? "—" : c.count}</span>
            <span className="stk-kpi-sub">{loading ? " " : c.sub}</span>
          </button>
        ))}
      </div>

      <div className="stk-tools">
        <SearchInput className="stk-search" value={f.q} onChange={(q) => set({ q })} placeholder={mgr ? "Sarlavha yoki xodim bo'yicha qidirish" : "Sarlavha bo'yicha qidirish"} />
        <Button variant="outline" className="stk-ftoggle" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} lucideIcon={Filter}>
          {t("Filtrlar")}
          {activeCount > 0 && <span className="stk-ftoggle-count">{activeCount}</span>}
        </Button>
        <div className={`stk-filters-wrap ${filtersOpen ? "is-open" : ""}`}>
          <div className="stk-filters">
            <Select size="sm" clearable className="stk-filter" value={f.status} onChange={(v) => set({ status: v })} options={statusOptions} placeholder={t("Holat: barchasi")} />
            {mgr && (
              <Select size="sm" clearable className="stk-filter-wide" value={f.emp} onChange={(v) => set({ emp: v })} options={empOptions} placeholder={t("Xodim: barchasi")} searchPlaceholder="Xodimni qidirish" />
            )}
            {showBranch && (
              <Select size="sm" clearable className="stk-filter" value={f.branch} onChange={(v) => set({ branch: v })} options={branchOptions} placeholder={t("Filial: barchasi")} />
            )}
            {mgr && (
              <Select size="sm" clearable className="stk-filter" value={f.prio} onChange={(v) => set({ prio: v })} options={prioOptions} placeholder={t("Muhimlik: barchasi")} />
            )}
            <Select size="sm" clearable className="stk-filter" value={f.due} onChange={(v) => set({ due: v as DueFilter })} options={dueOptions} placeholder={t("Muddat: barchasi")} />
          </div>
        </div>
        {anyFilter && (
          <Button variant="outline" className="stk-clear stk-btn-ghost" onClick={() => onFilters({ ...EMPTY_FILTERS })}>
            {t("Filtrlarni tozalash")}
          </Button>
        )}
      </div>

      <div className="stk-card stk-fill">
        <div className="stk-tscroll">
        <table className="stk-tbl stk-tasks">
          <thead>
            <tr>
              <th className="c-num">№</th>
              <th>{t("Topshiriq")}</th>
              {mgr && <th>{t("Xodim")}</th>}
              <th>{t("Muhimlik")}</th>
              <th>{t("Muddat")}</th>
              <th>{t("Holat")}</th>
              <th aria-label={t("Amal")} />
            </tr>
          </thead>
          <tbody ref={bodyRef}>
            {loading && animated.length === 0 && (
              <tr className="stk-empty">
                <td colSpan={cols}>{t("Yuklanmoqda…")}</td>
              </tr>
            )}
            {animated.map((r, i) => {
              const x = r.item;
              const late = isLateDone(x);
              const quick =
                x.isMine && isActive(x.status) ? "done" : x.canManage && x.status === "tasdiq_kutilmoqda" ? "approve" : null;
              return (
                <tr
                  key={r.key}
                  ref={(el) => {
                    if (el) els.current.set(r.key, el);
                    else els.current.delete(r.key);
                  }}
                  className={`stk-row ${r.phase === "enter" ? "stk-row-enter" : r.phase === "exit" ? "stk-row-exit" : ""}`}
                  style={r.phase === "enter" ? ({ "--stk-delay": `${Math.min(r.order, 12) * 22}ms` } as CSSProperties) : undefined}
                  tabIndex={r.phase === "exit" ? -1 : 0}
                  onClick={() => onOpen(x)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                      e.preventDefault();
                      onOpen(x);
                    }
                  }}
                >
                  <td className="c-num">{nums[i] || ""}</td>
                  <td className="c-title">
                    <div className="stk-title">{x.title}</div>
                    {(x.batchSize > 1 || (x.canManage && isActive(x.status) && !x.seenAt)) && (
                      <div className="stk-meta">
                        {x.batchSize > 1 && (
                          <span>
                            <Users className="h-3.5 w-3.5" />
                            {t("{n} xodimga berilgan", { n: x.batchSize })}
                          </span>
                        )}
                        {x.canManage && isActive(x.status) && !x.seenAt && <span className="stk-unseen">{t("Xodim hali ochmagan")}</span>}
                      </div>
                    )}
                  </td>
                  {mgr && (
                    <td className="c-emp">
                      {x.employeeName}
                      <span className="stk-subline">{branchName.get(x.branchId) ?? ""}</span>
                    </td>
                  )}
                  <td className="c-prio">
                    <PriorityBadge p={x.priority} fine={x.fineAmount} fmt={fmt} />
                  </td>
                  <td className="c-due">
                    <DueCell task={x} nowMs={nowMs} fmt={fmt} graceHours={settings.graceHours} />
                  </td>
                  <td className="c-st">
                    <StatusChip status={x.status} fmt={fmt} />
                    {late && <span className="stk-late">{t("kechikib")}</span>}
                  </td>
                  <td className="c-act">
                    {quick === "done" && (
                      <Button variant="primary" className="stk-btn-sm" onClick={(e) => { e.stopPropagation(); onQuick(x, "done"); }}>
                        {t("Bajardim")}
                      </Button>
                    )}
                    {quick === "approve" && (
                      <Button variant="outline" className="stk-btn-sm stk-btn-ok" onClick={(e) => { e.stopPropagation(); onQuick(x, "approve"); }}>
                        {t("Tasdiqlash")}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {empty && (
              <tr className="stk-empty stk-row-enter">
                <td colSpan={cols}>
                  {tasks.length === 0 ? (
                    mgr ? (
                      <>
                        {t("Hali topshiriq yo'q.")}
                        <div className="mt-2.5">
                          <Button variant="primary" className="stk-btn-sm" onClick={onAdd} lucideIcon={Plus}>
                            {t("Birinchi topshiriqni bering")}
                          </Button>
                        </div>
                      </>
                    ) : (
                      t("Sizga hozircha topshiriq berilmagan.")
                    )
                  ) : (
                    <>
                      {t("Filtrga mos topshiriq yo'q.")}
                      <div className="mt-2.5">
                        <Button variant="outline" className="stk-btn-sm" onClick={() => onFilters({ ...EMPTY_FILTERS })}>
                          {t("Filtrlarni tozalash")}
                        </Button>
                      </div>
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
