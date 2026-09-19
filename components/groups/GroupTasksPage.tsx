"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import TaskModal from "./TaskModal";
import type { GroupTask } from "@/lib/groupTasks";
import PersonLink from "@/components/shared/PersonDirectory";
import Modal from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// Guruh → Barcha vazifalar (crm-akademiya #view-groups-tasks). Barcha guruhlar
// bo'ylab vazifalar (/api/group-tasks). "Imtihon qo'shish" → TaskModal (qo'shish),
// edit ikonka → TaskModal (tahrirlash, oldingi qiymatlar bilan).
const thCls = "text-left px-3 py-3 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

export default function GroupTasksPage() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [tasks, setTasks] = useState<GroupTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTask, setEditTask] = useState<GroupTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupTask | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/group-tasks")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setTasks(d.tasks); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const start = (page - 1) * pageSize;
  const slice = tasks.slice(start, start + pageSize);

  async function confirmDelete() {
    if (!deleteTarget) return;
    const tv = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/group-tasks/${tv.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) { showError(t(data.error || "O'chirilmadi")); return; }
      setTasks((prev) => prev.filter((x) => x.id !== tv.id));
      showSuccess(t("Vazifa o'chirildi"));
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    }
  }

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      {/* i-list sprite (Pagination "qator" ikonkasi uchun) */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <symbol id="i-list" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></symbol>
        </defs>
      </svg>

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
          <Plus className="icon icon-sm" />{t("Imtihon qo'shish")}
        </button>
      </div>

      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-end px-4 py-2.5 border-b border-border">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
            <span className="text-muted-foreground">{t("Umumiy soni:")}</span>
            <span className="font-bold tabular-nums">{tasks.length}</span>
          </div>
        </div>
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className={thCls}>№</th>
                <th className={thCls}>{t("Turi")}</th>
                <th className={thCls}>{t("Nomi")}</th>
                <th className={thCls}>{t("Topshirish muddati")}</th>
                <th className={thCls}>{t("O'qituvchi")}</th>
                <th className={thCls}>{t("Guruh")}</th>
                <th className={thCls}>{t("Maksimal ball")}</th>
                <th className={thCls}>{t("Izoh")}</th>
                <th className={thCls}>{t("Yaratilgan sanasi")}</th>
                <th className={`${thCls} text-right`} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((tv, i) => (
                <tr key={tv.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  <td className="px-3 py-3 text-[13px]">{t(tv.type)}</td>
                  <td className="px-3 py-3"><span className="inline-flex items-center px-2.5 py-1 rounded-md bg-secondary text-[13px] font-medium">{tv.name}</span></td>
                  <td className="px-3 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">{tv.deadline || "—"}</td>
                  <td className="px-3 py-3 text-[13px]"><PersonLink name={tv.teacher} kind="staff" /></td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{tv.groupName || "—"}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{tv.maxScore}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground truncate" style={{ maxWidth: 200 }}>{tv.note || "—"}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">{tv.createdAt}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => setEditTask(tv)} className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground" title={t("Tahrirlash")}><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteTarget(tv)} className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500" title={t("O'chirish")}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">{loading ? <SpinnerBlock size={22} /> : "Vazifa yo'q"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={tasks.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      </div>

      {addOpen && (
        <TaskModal onClose={() => setAddOpen(false)} onSaved={(tv) => setTasks((prev) => [tv, ...prev])} />
      )}
      {editTask && (
        <TaskModal task={editTask} onClose={() => setEditTask(null)} onSaved={(tv) => setTasks((prev) => prev.map((x) => (x.id === tv.id ? tv : x)))} />
      )}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} bare size="sm" zIndex={110} panelClassName="p-6">{(modal) => (<>
            <p className="text-center text-[15px] font-semibold">{t("Vazifani o'chirmoqchimisiz?")}</p>
            <p className="text-center text-[13px] text-muted-foreground mt-1">{deleteTarget.name}</p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={modal.close} className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">{t("Yo'q")}</button>
              <button onClick={confirmDelete} className="h-9 px-6 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700">{t("Ha")}</button>
            </div>
          </>)}</Modal>
      )}
    </div>
  );
}
