"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import DeleteConfirmModal from "@/components/offline-courses/DeleteConfirmModal";
import TaskTypeIcon from "@/components/tasks/TaskTypeIcon";
import TaskTypeModal from "@/components/tasks/TaskTypeModal";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import type { TaskType } from "@/lib/taskTypes";

// Topshiriqlar → "⋮ → Topshiriq turi" — CHAP tomondan ochiladigan panel
// (referens: akademiya.edutizim.uz). Turlar bazadan keladi va shu yerdan
// qo'shiladi / tahrirlanadi / o'chiriladi (hooks/useTaskTypes.ts).

export interface TaskTypesDrawerProps {
  types: TaskType[];
  loading: boolean;
  onCreate: (values: Omit<TaskType, "id">) => Promise<string | null>;
  onUpdate: (id: number, values: Omit<TaskType, "id">) => Promise<string | null>;
  onRemove: (id: number) => Promise<string | null>;
  onClose: () => void;
}

export default function TaskTypesDrawer({
  types,
  loading,
  onCreate,
  onUpdate,
  onRemove,
  onClose,
}: TaskTypesDrawerProps) {
  // null — oyna yopiq, undefined — yangi tur, TaskType — tahrirlash.
  const [editing, setEditing] = useState<TaskType | null | undefined>(null);
  const [deleting, setDeleting] = useState<TaskType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();
  useEscapeClose(onClose);

  const handleSave = async (values: { name: string; color: string; icon: string }) => {
    setSaving(true);
    setError(null);
    const err = editing ? await onUpdate(editing.id, values) : await onCreate(values);
    setSaving(false);
    if (err) {
      setError(err);
      showError(err);
      return;
    }
    showSuccess(editing ? "Tur yangilandi" : "Yangi tur qo'shildi");
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const err = await onRemove(deleting.id);
    if (err) showError(err);
    else showSuccess("Tur o'chirildi");
    setDeleting(null);
  };

  return (
    <>
      {/* Ochilish animatsiyasi CSS'da (.st-drawer-left) — JS bilan klass
          qo'shilmaydi, globals.css dagi izohga qarang. */}
      <div className="st-drawer-backdrop instant" onClick={onClose}>
        <div className="st-drawer st-drawer-left" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3 p-5 pb-4 shrink-0">
            <div>
              <h3 className="text-lg font-semibold">Topshiriq turlari</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Topshiriqlar uchun maxsus turlarni boshqarish
              </p>
            </div>
            <button type="button" className="st-drawer-close" onClick={onClose} title="Yopish (Esc)">
              <svg className="icon icon-sm"><use href="#i-x-circle" /></svg>
            </button>
          </div>

          <div className="px-5 pb-4 shrink-0">
            <button
              type="button"
              onClick={() => { setError(null); setEditing(undefined); }}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Topshiriq turi qo&apos;shish
            </button>
          </div>

          <div className="flex items-center justify-between px-5 pb-2 shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mavjud turlar
            </span>
            <span className="text-[13px] font-semibold tabular-nums text-muted-foreground">{types.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
            {types.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                {loading ? "Yuklanmoqda…" : "Hozircha tur yo'q. Yuqoridagi tugma orqali qo'shing."}
              </p>
            ) : (
              types.map((t, i) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm"
                >
                  <span className="w-4 shrink-0 text-[13px] tabular-nums text-muted-foreground">{i + 1}</span>
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: t.color }}
                  >
                    <TaskTypeIcon icon={t.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.name}</span>
                  <button
                    type="button"
                    title="Tahrirlash"
                    onClick={() => { setError(null); setEditing(t); }}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="O'chirish"
                    onClick={() => setDeleting(t)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border p-4 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-secondary"
            >
              <X className="h-4 w-4" />
              Yopish
            </button>
          </div>
        </div>
      </div>

      {editing !== null && (
        <TaskTypeModal
          type={editing ?? null}
          saving={saving}
          error={error}
          onClose={() => { setEditing(null); setError(null); }}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <DeleteConfirmModal
          title="Turni o'chirish"
          message="Ushbu topshiriq turini o'chirmoqchimisiz:"
          name={deleting.name}
          zIndex={1200}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
