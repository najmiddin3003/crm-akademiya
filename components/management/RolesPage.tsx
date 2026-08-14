"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { ROLE_LABELS } from "@/constants/employees";
import type { HrEmployee } from "@/lib/hrEmployees";
import type { Role } from "@/lib/roles";

// Boshqaruv → Rollar (sidebar: Boshqaruv > Rollar, href /management-rollar).
// Ma'lumot HAQIQIY — /api/roles (MongoDB `roles`). Qo'shish/tahrirlash —
// oyna, o'chirish — loyihaning standart tasdiqlash oynasi.
//
// "Xodimlar" ustuni saqlanmaydi: /api/hr-employees dan shu rol nomiga mos
// keladigan xodimlar sanaladi (xodimning `turi` yorlig'i bilan solishtirib).
// Loyihada hali mos xodimi yo'q rollar 0 ko'rsatadi — bu to'g'ri, chunki
// hr_employees dagi rol turlari cheklangan ro'yxat.

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function RolesPage() {
  const { showSuccess, showError } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [editTarget, setEditTarget] = useState<Role | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/roles").then((r) => r.json()),
      fetch("/api/hr-employees").then((r) => r.json()),
    ]).then(([rolesRes, empRes]) => {
      if (cancelled) return;
      if (rolesRes.ok) setRoles(rolesRes.roles);
      if (empRes.ok) setEmployees(empRes.employees);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const countByRoleName = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of employees) {
      const label = ROLE_LABELS[e.turi as keyof typeof ROLE_LABELS] ?? e.turi;
      if (!label) continue;
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return map;
  }, [employees]);

  const start = (page - 1) * pageSize;
  const slice = roles.slice(start, start + pageSize);

  function openAdd() {
    setForm({ name: "", description: "" });
    setAddOpen(true);
  }
  function openEdit(r: Role) {
    setForm({ name: r.name, description: r.description });
    setEditTarget(r);
  }
  function closeForm() {
    setAddOpen(false);
    setEditTarget(null);
  }

  async function save() {
    const name = form.name.trim();
    if (!name) {
      showError("Rol nomini kiriting");
      return;
    }
    setSaving(true);
    try {
      const editing = editTarget !== null;
      const res = await fetch(editing ? `/api/roles/${editTarget.id}` : "/api/roles", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: form.description }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return;
      }
      if (editing) {
        setRoles((prev) => prev.map((x) => (x.id === data.role.id ? data.role : x)));
        showSuccess("Rol yangilandi");
      } else {
        setRoles((prev) => [...prev, data.role]);
        showSuccess("Rol qo'shildi");
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
      const res = await fetch(`/api/roles/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "O'chirilmadi");
        return;
      }
      setRoles((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      showSuccess("Rol o'chirildi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
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
          <span>+ Rol qo&apos;shish</span>
        </button>
      </div>

      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{roles.length}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">Nomi</th>
                <th className="px-5 py-3 text-left">Izoh</th>
                <th className="px-5 py-3 text-right">Xodimlar</th>
                <th className="px-5 py-3 text-right pr-5 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((r, i) => (
                <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  <td className="px-5 py-3 font-medium">{r.name}</td>
                  <td className="px-5 py-3 text-[13px] text-muted-foreground">{r.description || "-"}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{countByRoleName.get(r.name) ?? 0}</td>
                  <td className="px-5 py-3 pr-5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(r)}
                        className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground"
                        title="Tahrirlash"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(r)}
                        className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500"
                        title="O'chirish"
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
                    {loading ? "Yuklanmoqda…" : "Rol topilmadi"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          totalItems={roles.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && closeForm()} />
          <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
            <h3 className="text-[16px] font-semibold">
              {editTarget ? "Rolni tahrirlash" : "Rol qo'shish"}
            </h3>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Nomi</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
                placeholder="Masalan: Filial direktori"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Izoh</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className={inputCls}
                placeholder="Rol nima qilishini qisqacha yozing"
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
