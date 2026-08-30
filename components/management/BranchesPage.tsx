"use client";

import { invalidateBranches } from "@/hooks/useBranches";
import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import type { ManagementBranch } from "@/lib/managementBranches";

// Boshqaruv → Filiallar (sidebar: Boshqaruv > Filiallar, href
// /management-filiallar). Ma'lumot HAQIQIY — /api/branches (MongoDB
// `branches`). Referensdagidek jadval emas, oddiy ro'yxat: chapda filial
// nomi, o'ngda manzil. Amal tugmalari qator ustiga kelganda ko'rinadi.

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function BranchesPage() {
  const { showSuccess, showError } = useToast();
  const [branches, setBranches] = useState<ManagementBranch[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ManagementBranch | null>(null);
  const [form, setForm] = useState({ name: "", location: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManagementBranch | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/branches")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setBranches(d.branches); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function openAdd() {
    setForm({ name: "", location: "" });
    setAddOpen(true);
  }
  function openEdit(b: ManagementBranch) {
    setForm({ name: b.name, location: b.location });
    setEditTarget(b);
  }
  function closeForm() {
    setAddOpen(false);
    setEditTarget(null);
  }

  async function save() {
    const name = form.name.trim();
    if (!name) {
      showError("Filial nomini kiriting");
      return;
    }
    setSaving(true);
    try {
      const editing = editTarget !== null;
      const res = await fetch(editing ? `/api/branches/${editTarget.id}` : "/api/branches", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, location: form.location }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return;
      }
      // Kesh bekor qilinadi: keyin mount bo'ladigan iste'molchilar
      // yangi ro'yxatni oladi (lib/referenceCache.ts).
      invalidateBranches();
      if (editing) {
        setBranches((prev) => prev.map((x) => (x.id === data.branch.id ? data.branch : x)));
        showSuccess("Filial yangilandi");
      } else {
        setBranches((prev) => [...prev, data.branch]);
        showSuccess("Filial qo'shildi");
      }
      closeForm();
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/branches/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "O'chirilmadi");
        return;
      }
      invalidateBranches();
      setBranches((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      showSuccess("Filial o'chirildi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const formOpen = addOpen || editTarget !== null;

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <span>+ Filial qo&apos;shish</span>
        </button>
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
        {branches.map((b) => (
          <div key={b.id} className="group flex items-center gap-3 px-5 py-3.5 hover:bg-secondary/30 transition-colors">
            <span className="font-medium">{b.name}</span>
            <span className="ml-auto text-[13px] text-muted-foreground">{b.location}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => openEdit(b)}
                className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground"
                title="Tahrirlash"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeleteTarget(b)}
                className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500"
                title="O'chirish"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {branches.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            {loading ? <SpinnerBlock size={22} /> : "Filial topilmadi"}
          </div>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && closeForm()} />
          <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
            <h3 className="text-[16px] font-semibold">
              {editTarget ? "Filialni tahrirlash" : "Filial qo'shish"}
            </h3>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Nomi</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
                placeholder="Masalan: Akademiya 3-filial"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Manzil</label>
              <input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className={inputCls}
                placeholder="Masalan: Chortoq"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={closeForm}
                disabled={saving}
                className="h-10 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
              >
                Bekor qilish
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Saqlanmoqda…" : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6">
            <p className="text-center text-[15px] font-semibold">Rostdan ham o&apos;chirmoqchimisiz?</p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
              >
                Yo&apos;q
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {deleting ? "O'chirilmoqda…" : "Ha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
