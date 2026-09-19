"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import type { WorkSchedule } from "@/lib/workSchedules";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// Boshqaruv → Ish jadvali (sidebar: Boshqaruv > Ish jadvali, href
// /management-ish-jadvali). Ma'lumot HAQIQIY — /api/work-schedules
// (MongoDB `work_schedules`). Qo'shish/tahrirlash — oyna, o'chirish —
// loyihaning standart tasdiqlash oynasi.

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function WorkSchedulesPage() {
  const { t } = useT();
  const modal = useModalClose(closeForm);
  const { showSuccess, showError } = useToast();
  const [rows, setRows] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkSchedule | null>(null);
  const [form, setForm] = useState({ name: "", code: "", active: true });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkSchedule | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/work-schedules")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setRows(d.schedules); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const start = (page - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);

  function openAdd() {
    setForm({ name: "", code: "", active: true });
    setAddOpen(true);
  }
  function openEdit(s: WorkSchedule) {
    setForm({ name: s.name, code: s.code, active: s.active });
    setEditTarget(s);
  }
  function closeForm() {
    setAddOpen(false);
    setEditTarget(null);
  }

  async function save() {
    const name = form.name.trim();
    if (!name) {
      showError(t("Nomini kiriting"));
      return;
    }
    setSaving(true);
    try {
      const editing = editTarget !== null;
      const res = await fetch(editing ? `/api/work-schedules/${editTarget.id}` : "/api/work-schedules", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code: form.code, active: form.active }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        return;
      }
      if (editing) {
        setRows((prev) => prev.map((x) => (x.id === data.schedule.id ? data.schedule : x)));
        showSuccess(t("Ish jadvali yangilandi"));
      } else {
        setRows((prev) => [...prev, data.schedule]);
        showSuccess(t("Ish jadvali qo'shildi"));
      }
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/work-schedules/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "O'chirilmadi"));
        return;
      }
      setRows((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      showSuccess(t("Ish jadvali o'chirildi"));
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const formOpen = addOpen || editTarget !== null;

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <span>{t("+ Qo'shish")}</span>
        </button>
      </div>

      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>{t("Umumiy soni:")}</span>
            <span className="tabular-nums">{rows.length}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">{t("Nomi")}</th>
                <th className="px-5 py-3 text-left">{t("Kod")}</th>
                <th className="px-5 py-3 text-left">{t("Holati")}</th>
                <th className="px-5 py-3 text-right pr-5 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((s, i) => (
                <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  <td className="px-5 py-3 font-medium">{s.name}</td>
                  <td className="px-5 py-3 text-[13px] font-mono text-muted-foreground">{s.code || "-"}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        s.active ? "text-emerald-700 bg-emerald-100" : "text-muted-foreground bg-secondary"
                      }`}
                    >
                      {s.active ? t("Faol") : t("Nofaol")}
                    </span>
                  </td>
                  <td className="px-5 py-3 pr-5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(s)}
                        className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground"
                        title={t("Tahrirlash")}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(s)}
                        className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500"
                        title={t("O'chirish")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {loading ? <SpinnerBlock size={22} /> : "Ma'lumotlar topilmadi"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          totalItems={rows.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      {formOpen && (
        <Modal onClose={closeForm} controller={modal} locked={saving} bare zIndex={110} panelClassName="p-6 space-y-4">
            <h3 className="text-[16px] font-semibold">
              {editTarget ? t("Ish jadvalini tahrirlash") : t("Ish jadvali qo'shish")}
            </h3>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("Nomi")}</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
                placeholder={t("Masalan: To'liq stavka (09:00 - 18:00)")}
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("Kod")}</label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className={inputCls}
                placeholder={t("Masalan: FULL")}
              />
            </div>
            <label className="flex items-center gap-2 text-[13px] cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="h-4 w-4 rounded border-border accent-[var(--primary)]"
              />
              <span>{t("Faol")}</span>
            </label>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={modal.close}
                disabled={saving}
                className="h-10 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
              >
                {t("Bekor qilish")}
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {saving ? t("Saqlanmoqda…") : t("Saqlash")}
              </button>
            </div>
          </Modal>
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} locked={deleting} bare size="sm" zIndex={120} panelClassName="p-6">{(modal) => (<>
            <p className="text-center text-[15px] font-semibold">{t("Rostdan ham o'chirmoqchimisiz?")}</p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={modal.close}
                disabled={deleting}
                className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
              >
                {t("Yo'q")}
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {deleting ? t("O'chirilmoqda…") : t("Ha")}
              </button>
            </div>
          </>)}</Modal>
      )}
    </div>
  );
}
