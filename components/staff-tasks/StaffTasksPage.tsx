"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ListChecks, MoreVertical, Plus, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import TaskTypesDrawer from "@/components/tasks/TaskTypesDrawer";
import { useTaskTypes } from "@/hooks/useTaskTypes";
import type { StaffTask, StaffTaskFine, StaffTaskSettings, StaffTasksPayload } from "@/lib/staffTasks";
import ActionModal, { type ActionTarget } from "./ActionModal";
import FinesView from "./FinesView";
import SettingsView from "./SettingsView";
import StatsView from "./StatsView";
import TaskDrawer, { type DrawerMode } from "./TaskDrawer";
import TaskList, { EMPTY_FILTERS, type TaskFilters } from "./TaskList";
import { api } from "./api";
import { useStaffFmt } from "./format";

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

/** Eski topshiriq turlari paneli — faqat ochilganda yuklanadi. */
function TaskTypesManager({ onClose }: { onClose: () => void }) {
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
  const { showSuccess } = useToast();

  const [data, setData] = useState<StaffTasksPayload | null>(null);
  const [error, setError] = useState("");
  // Server soatiga tekislangan "hozir": mijoz soati adashsa ham muddatlar
  // to'g'ri hisoblansin (TaskInboxProvider dagi usul).
  const [skew, setSkew] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const nowMs = clock + skew;
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    const r = await api<Omit<StaffTasksPayload, "ok">>("/api/staff-tasks");
    if (r.ok) {
      setData(r as StaffTasksPayload);
      setSkew(Date.parse(r.serverNow) - Date.now());
      setClock(Date.now());
      setError("");
    } else {
      setError(r.error);
    }
  }, []);

  useEffect(() => {
    let off = false;
    api<Omit<StaffTasksPayload, "ok">>("/api/staff-tasks").then((r) => {
      if (off) return;
      if (r.ok) {
        setData(r as StaffTasksPayload);
        setSkew(Date.parse(r.serverNow) - Date.now());
        setClock(Date.now());
      } else setError(r.error);
    });
    return () => {
      off = true;
    };
  }, []);

  // Soat har 30 soniyada (nisbiy vaqtlar), ro'yxat har daqiqada yangilanadi
  // — muddat o'tgan topshiriq server avtomatikasi bilan holatini o'zgartiradi.
  useEffect(() => {
    const tick = window.setInterval(() => setClock(Date.now()), 30_000);
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, [load]);

  const viewer = data?.viewer ?? null;
  const role = viewer?.role ?? "xodim";
  const mgr = role !== "xodim";
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
  const [drawer, setDrawer] = useState<DrawerMode | null>(null);
  const [detail, setDetail] = useState<StaffTask | null>(null);
  const [detailErr, setDetailErr] = useState<{ id: number; error: string } | null>(null);
  const [detailNonce, setDetailNonce] = useState(0);
  const [action, setAction] = useState<ActionTarget | null>(null);
  const [typesOpen, setTypesOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Qo'ng'iroqdan kelgan `?open=<id>` — render paytida qabul qilinadi
  // (oldingi holatdan hosil qilish qolipi), manzildan esa effekt olib
  // tashlaydi: shunda o'sha qatorni yana bossangiz ham topshiriq ochiladi.
  const openParam = searchParams.get("open");
  const [handledOpen, setHandledOpen] = useState<string | null>(null);
  if (openParam !== handledOpen) {
    setHandledOpen(openParam);
    const id = Number(openParam);
    if (openParam && Number.isFinite(id)) setDrawer({ mode: "detail", id });
  }
  useEffect(() => {
    if (!openParam) return;
    router.replace(hrefFor(tab), { scroll: false });
  }, [openParam, router, hrefFor, tab]);

  // Batafsil (tarix bilan) — drawer ochilganda. Ijrochi ochsa server
  // «Ko'rildi» deb yozadi (`seen=1`).
  const detailId = drawer && drawer.id !== null ? drawer.id : null;
  useEffect(() => {
    if (detailId === null) return;
    let off = false;
    api<{ task: StaffTask }>(`/api/staff-tasks/${detailId}?seen=1`).then((r) => {
      if (off) return;
      if (r.ok) {
        setDetail(r.task);
        setData((d) => (d ? { ...d, tasks: d.tasks.map((x) => (x.id === r.task.id ? { ...r.task, history: undefined } : x)) } : d));
      } else setDetailErr({ id: detailId, error: r.error });
    });
    return () => {
      off = true;
    };
  }, [detailId, detailNonce]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  const mergeTask = useCallback((task: StaffTask) => {
    setData((d) => (d ? { ...d, tasks: d.tasks.map((x) => (x.id === task.id ? { ...task, history: undefined } : x)) } : d));
    setDetail((cur) => (cur && cur.id === task.id ? task : cur));
  }, []);

  const openTask = useCallback((id: number) => setDrawer({ mode: "detail", id }), []);
  const closeDrawer = useCallback(() => {
    setDrawer(null);
    setDetail(null);
    setDetailErr(null);
  }, []);

  const listTask = drawer && drawer.id !== null ? data?.tasks.find((x) => x.id === drawer.id) ?? null : null;
  const detailFor = drawer && detail && detail.id === drawer.id ? detail : null;
  const detailError = drawer && detailErr && detailErr.id === drawer.id ? detailErr.error : "";

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
          <SettingsView fmt={fmt} onSaved={(s: StaffTaskSettings) => setData((d) => (d ? { ...d, settings: s } : d))} />
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
          onCreated={(tasks) => {
            setData((d) => (d ? { ...d, tasks: [...tasks, ...d.tasks] } : d));
            setReloadKey((k) => k + 1);
            showSuccess(tasks.length === 1 ? t("Topshiriq berildi") : t("{n} ta topshiriq berildi", { n: tasks.length }));
          }}
          onUpdated={(task) => {
            mergeTask(task);
            showSuccess(t("Saqlandi"));
          }}
        />
      )}

      {action && (
        <ActionModal
          target={action}
          nowMs={nowMs}
          fmt={fmt}
          onClose={() => setAction(null)}
          onTaskDone={(task, msg) => {
            mergeTask(task);
            setReloadKey((k) => k + 1);
            showSuccess(msg);
          }}
          onFineDone={(fine: StaffTaskFine, msg) => {
            setReloadKey((k) => k + 1);
            setData((d) =>
              d
                ? {
                    ...d,
                    tasks: d.tasks.map((x) =>
                      x.id === fine.taskId && x.fine ? { ...x, fine: { ...x.fine, status: fine.status, held: fine.held, cancelReason: fine.cancelReason, cancelledBy: fine.cancelledBy, cancelledAt: fine.cancelledAt } } : x,
                    ),
                  }
                : d,
            );
            if (drawer && drawer.id === fine.taskId) setDetailNonce((n) => n + 1);
            showSuccess(msg);
          }}
        />
      )}

      {typesOpen && <TaskTypesManager onClose={() => setTypesOpen(false)} />}
    </div>
  );
}
