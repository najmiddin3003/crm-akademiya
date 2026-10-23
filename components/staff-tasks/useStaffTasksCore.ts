"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import type { StaffTask, StaffTaskFine, StaffTasksPayload } from "@/lib/staffTasks";
import type { ActionTarget } from "./ActionModal";
import type { DrawerMode } from "./TaskDrawer";
import { api } from "./api";
import type { StaffFmt } from "./format";

// TOPSHIRIQLAR SAHIFASINING UMUMIY YADROSI — eski sahifa (StaffTasksPage) va yangi
// versiya (components/v2/tasks/TasksV2.tsx) ikkalasi shundan ishlaydi (23.10.2026,
// eski sahifadan AYNAN ko'chirildi — mantiq bitta joyda qolsin).
//
//   useStaffTasksData   — ro'yxatni yuklash, server soatiga tekislangan «hozir»,
//                         har daqiqada yangilash, ko'ruvchining roli;
//   useStaffTasksDrawer — drawer/forma holati, `?open=` (qo'ng'iroqdan) va
//                         `?new=1&employee=` («+ Yangi», xodim profili) parametrlari,
//                         batafsil (tarix bilan) yuklash, amal oynasi holati va
//                         saqlangandan keyingi yangilashlar.

export function useStaffTasksData() {
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

  return { data, setData, error, nowMs, reloadKey, setReloadKey, load, viewer, role, mgr };
}

export type StaffTasksData = ReturnType<typeof useStaffTasksData>;

export function useStaffTasksDrawer({
  core,
  cleanHref,
  fmt,
}: {
  core: StaffTasksData;
  /** `?open=` / `?new=` olib tashlangandan keyingi manzil (joriy tab bilan). */
  cleanHref: string;
  fmt: StaffFmt;
}) {
  const { data, setData, setReloadKey, mgr } = core;
  const { t } = fmt;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess } = useToast();

  const [drawer, setDrawer] = useState<DrawerMode | null>(null);
  const [detail, setDetail] = useState<StaffTask | null>(null);
  const [detailErr, setDetailErr] = useState<{ id: number; error: string } | null>(null);
  const [detailNonce, setDetailNonce] = useState(0);
  const [action, setAction] = useState<ActionTarget | null>(null);

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
    router.replace(cleanHref, { scroll: false });
  }, [openParam, router, cleanHref]);

  // «+ Yangi → Topshiriq» (yangi versiya yuqori paneli) `?new=1` bilan keladi —
  // shakl faqat rahbar/direktorga va u ma'lum bo'lgach (ma'lumot kelgach) bir
  // marta ochiladi; manzildan esa ma'lumot kelgach olib tashlanadi.
  const newParam = searchParams.get("new");
  const [handledNew, setHandledNew] = useState<string | null>(null);
  if (newParam !== handledNew && (newParam === null || mgr)) {
    setHandledNew(newParam);
    // `&employee=<id>` — xodim profilidagi «Topshiriq berish» (yangi versiya, 20.10.2026):
    // shakl o'sha xodim tanlangan holda ochiladi.
    const emp = Number(searchParams.get("employee"));
    if (newParam === "1") setDrawer({ mode: "form", id: null, employeeId: Number.isInteger(emp) && emp > 0 ? emp : undefined });
  }
  useEffect(() => {
    if (newParam === null || !data) return;
    router.replace(cleanHref, { scroll: false });
  }, [newParam, data, router, cleanHref]);

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
  }, [detailId, detailNonce, setData]);

  const mergeTask = useCallback(
    (task: StaffTask) => {
      setData((d) => (d ? { ...d, tasks: d.tasks.map((x) => (x.id === task.id ? { ...task, history: undefined } : x)) } : d));
      setDetail((cur) => (cur && cur.id === task.id ? task : cur));
    },
    [setData],
  );

  const openTask = useCallback((id: number) => setDrawer({ mode: "detail", id }), []);
  const closeDrawer = useCallback(() => {
    setDrawer(null);
    setDetail(null);
    setDetailErr(null);
  }, []);

  const listTask = drawer && drawer.id !== null ? data?.tasks.find((x) => x.id === drawer.id) ?? null : null;
  const detailFor = drawer && detail && detail.id === drawer.id ? detail : null;
  const detailError = drawer && detailErr && detailErr.id === drawer.id ? detailErr.error : "";

  /** Yangi topshiriq(lar) berildi — ro'yxat boshiga, jarimalar/statistika qayta yuklansin. */
  const onCreated = (tasks: StaffTask[]) => {
    setData((d) => (d ? { ...d, tasks: [...tasks, ...d.tasks] } : d));
    setReloadKey((k) => k + 1);
    showSuccess(tasks.length === 1 ? t("Topshiriq berildi") : t("{n} ta topshiriq berildi", { n: tasks.length }));
  };
  const onUpdated = (task: StaffTask) => {
    mergeTask(task);
    showSuccess(t("Saqlandi"));
  };
  const onTaskDone = (task: StaffTask, msg: string) => {
    mergeTask(task);
    setReloadKey((k) => k + 1);
    showSuccess(msg);
  };
  const onFineDone = (fine: StaffTaskFine, msg: string) => {
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
  };

  return {
    drawer,
    setDrawer,
    action,
    setAction,
    openTask,
    closeDrawer,
    listTask,
    detailFor,
    detailError,
    onCreated,
    onUpdated,
    onTaskDone,
    onFineDone,
  };
}
