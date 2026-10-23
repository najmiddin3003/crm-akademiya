"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ListChecks, MoreVertical, Plus, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import TaskTypesDrawer from "@/components/tasks/TaskTypesDrawer";
import { useTaskTypes } from "@/hooks/useTaskTypes";
import type { StaffTaskSettings } from "@/lib/staffTasks";
import ActionModal from "./ActionModal";
import FinesView from "./FinesView";
import SettingsView from "./SettingsView";
import StatsView from "./StatsView";
import TaskDrawer from "./TaskDrawer";
import TaskList, { EMPTY_FILTERS, type TaskFilters } from "./TaskList";
import { useStaffFmt } from "./format";
import { useStaffTasksData, useStaffTasksDrawer } from "./useStaffTasksCore";

// TOPSHIRIQLAR (/tasks) — xodim topshiriqlari. Prototip: foydalanuvchining
// "topshiriqlar-prototip v2" fayli (23.09.2026). Tablar ko'rinishga qarab:
//   direktor — Topshiriqlar / Jarimalar / Statistika / Sozlamalar
//   rahbar   — Topshiriqlar / Jarimalar / Statistika
//   xodim    — Topshiriqlarim / Jarimalarim / Statistikam
// Tab manzilda (`?tab=`), navbardagi qo'ng'iroq esa `?open=<id>` bilan
// topshiriqni to'g'ridan-to'g'ri ochadi.
//
// Eski (o'quvchiga bog'langan) topshiriqlar bu sahifada YO'Q — ular
// o'quvchi profilidagi «Vazifa» tabida. O'shalarning TURLARI esa shu
// yerdagi "⋮" menyusidan boshqariladi (avvalgidek).

type TabKey = "list" | "fines" | "stats" | "settings";

/** Eski topshiriq turlari paneli — faqat ochilganda yuklanadi (yangi versiya «⋯» menyusi ham). */
export function TaskTypesManager({ onClose }: { onClose: () => void }) {
  const taskTypes = useTaskTypes();
  return (
    <TaskTypesDrawer
      types={taskTypes.types}
      loading={taskTypes.loading}
      onCreate={taskTypes.create}
      onUpdate={taskTypes.update}
      onRemove={taskTypes.remove}
      onClose={onClose}
    />
  );
}

export default function StaffTasksPage() {
  const fmt = useStaffFmt();
  const { t } = fmt;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Yuklash, soat, rol va drawer holati — umumiy yadro (useStaffTasksCore.ts):
  // yangi versiyadagi Topshiriqlar ham shundan ishlaydi.
  const core = useStaffTasksData();
  const { data, error, nowMs, reloadKey, load, viewer, role, mgr } = core;
  const tabs = useMemo((): { key: TabKey; label: string }[] => {
    if (role === "direktor")
      return [
        { key: "list", label: "Topshiriqlar" },
        { key: "fines", label: "Jarimalar" },
        { key: "stats", label: "Statistika" },
        { key: "settings", label: "Sozlamalar" },
      ];
    if (role === "rahbar")
      return [
        { key: "list", label: "Topshiriqlar" },
        { key: "fines", label: "Jarimalar" },
        { key: "stats", label: "Statistika" },
      ];
    return [
      { key: "list", label: "Topshiriqlarim" },
      { key: "fines", label: "Jarimalarim" },
      { key: "stats", label: "Statistikam" },
    ];
  }, [role]);

  const tabParam = searchParams.get("tab") as TabKey | null;
  const tab: TabKey = tabParam && tabs.some((x) => x.key === tabParam) ? tabParam : "list";
  const hrefFor = useCallback(
    (next: TabKey) => (next === "list" ? pathname : `${pathname}?tab=${next}`),
    [pathname],
  );
  const setTab = (next: TabKey) => router.replace(hrefFor(next), { scroll: false });

  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [typesOpen, setTypesOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const dr = useStaffTasksDrawer({ core, cleanHref: hrefFor(tab), fmt });
  const { drawer, setDrawer, action, setAction, openTask, closeDrawer, listTask, detailFor, detailError } = dr;

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  const sub = !viewer
    ? ""
    : role === "direktor"
      ? t("Direktor, barcha filiallar")
      : role === "rahbar"
        ? t("Rahbar, {branches}", {
            branches: (data?.branches ?? []).filter((b) => viewer.branchIds?.includes(b.id)).map((b) => b.name).join(", "),
          })
        : t("Xodim: {name}", { name: viewer.name || "—" });

  return (
    // `is-framed` — ro'yxat tabida sahifa `main` balandligida qotadi va faqat
    // jadval ichida scroll bo'ladi (thead tepada) — tasks.css izohiga qarang.
    <div className={`stk-page container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4 ${tab === "list" ? "is-framed" : ""}`}>
      <header className="stk-head">
        <div>
          <h1>{t("Topshiriqlar")}</h1>
          <div className="stk-sub">{sub || " "}</div>
        </div>
        <div className="stk-fill" />
        {mgr && (
          <>
            <Button variant="primary" lucideIcon={Plus} onClick={() => setDrawer({ mode: "form", id: null })}>
              <span className="stk-long">{t("Topshiriq qo'shish")}</span>
              <span className="stk-short">{t("Qo'shish")}</span>
            </Button>
            <div className="relative" ref={moreRef}>
              {/* ui/Button `icon` varianti EMAS: undagi asosiy `px-3.5` `px-0` ni
                  bosib ketadi va ikonka 6 px ga siqilib qoladi. */}
              <button
                type="button"
                title={t("Qo'shimcha amallar")}
                onClick={() => setMoreOpen((o) => !o)}
                aria-expanded={moreOpen}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-secondary ${moreOpen ? "bg-secondary" : ""}`}
              >
                <MoreVertical className="h-4 w-4 shrink-0" />
              </button>
              {moreOpen && (
                <div className="ui-pop-in absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      setTypesOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <ListChecks className="h-4 w-4" />
                    </span>
                    <span>{t("O'quvchi vazifalari turlari")}</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        <nav className="stk-tabs" role="tablist">
          {tabs.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={tab === x.key} className={`stk-tab ${tab === x.key ? "is-on" : ""}`} onClick={() => setTab(x.key)}>
              {t(x.label)}
            </button>
          ))}
        </nav>
      </header>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{t(error)}</span>
          <Button variant="outline" lucideIcon={RefreshCw} onClick={() => void load()}>
            {t("Qayta urinish")}
          </Button>
        </div>
      )}

      {viewer && role === "xodim" && viewer.employeeId === null && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {t("Hisobingiz xodimlar ro'yxatiga bog'lanmagan — sizga topshiriq berib bo'lmaydi. Administratorga murojaat qiling.")}
        </div>
      )}

      <div key={tab} className="stk-fade-in stk-tabpane">
        {tab === "list" && (
          <TaskList
            tasks={data?.tasks ?? []}
            viewer={viewer ?? { role: "xodim", name: "", employeeId: null, branchIds: [] }}
            branches={data?.branches ?? []}
            employees={data?.employees ?? []}
            settings={data?.settings ?? { fines: {}, graceHours: 24, limitPercent: 30 }}
            nowMs={nowMs}
            loading={!data && !error}
            filters={filters}
            onFilters={setFilters}
            onOpen={(x) => openTask(x.id)}
            onQuick={(x, kind) => setAction({ kind, task: x })}
            onAdd={() => setDrawer({ mode: "form", id: null })}
            fmt={fmt}
          />
        )}
        {tab === "fines" && viewer && (
          <FinesView viewer={viewer} nowMs={nowMs} fmt={fmt} reloadKey={reloadKey} onOpenTask={openTask} onCancelFine={(fine) => setAction({ kind: "fineCancel", fine })} />
        )}
        {tab === "stats" && viewer && <StatsView viewer={viewer} branches={data?.branches ?? []} fmt={fmt} reloadKey={reloadKey} />}
        {tab === "settings" && role === "direktor" && (
          <SettingsView fmt={fmt} onSaved={(s: StaffTaskSettings) => core.setData((d) => (d ? { ...d, settings: s } : d))} />
        )}
      </div>

      {drawer && data && (
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
          onMode={setDrawer}
          onAction={(task, kind) => setAction({ kind, task })}
          onCreated={dr.onCreated}
          onUpdated={dr.onUpdated}
        />
      )}

      {action && (
        <ActionModal
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
