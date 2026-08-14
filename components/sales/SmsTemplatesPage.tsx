"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { SMS_AUDIENCES, SMS_PLACEHOLDERS, type SmsTemplate } from "@/lib/smsTemplates";

// Sotuv va marketing → SMS shablonlari (sidebar: Sotuv va marketing >
// SMS shablonlari, href /sales-sms). Ma'lumot HAQIQIY — /api/sms-templates
// (MongoDB `sms_templates`).
//
// Jadvalda SMS matni referensdagidek qisqartirib ko'rsatiladi; to'liq matn
// tahrirlash oynasida. Qo'shish oynasida ruxsat etilgan o'rinbosarlar
// ({name}, {group}, ...) tugma sifatida — bosilsa matn oxiriga qo'shiladi.

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function truncate(s: string, n = 20): string {
  return s.length > n ? s.slice(0, n) + "..." : s;
}

export default function SmsTemplatesPage() {
  const { showSuccess, showError } = useToast();
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SmsTemplate | null>(null);
  const [form, setForm] = useState({ title: "", audience: SMS_AUDIENCES[0], text: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SmsTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sms-templates")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setTemplates(d.templates); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const start = (page - 1) * pageSize;
  const slice = templates.slice(start, start + pageSize);

  function openAdd() {
    setForm({ title: "", audience: SMS_AUDIENCES[0], text: "" });
    setAddOpen(true);
  }
  function openEdit(t: SmsTemplate) {
    setForm({ title: t.title, audience: t.audience, text: t.text });
    setEditTarget(t);
  }
  function closeForm() {
    setAddOpen(false);
    setEditTarget(null);
  }

  async function save() {
    const title = form.title.trim();
    const text = form.text.trim();
    if (!title) {
      showError("Sarlavhani kiriting");
      return;
    }
    if (!text) {
      showError("SMS matnini kiriting");
      return;
    }
    setSaving(true);
    try {
      const editing = editTarget !== null;
      const res = await fetch(editing ? `/api/sms-templates/${editTarget.id}` : "/api/sms-templates", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, audience: form.audience, text }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return;
      }
      if (editing) {
        setTemplates((prev) => prev.map((x) => (x.id === data.template.id ? data.template : x)));
        showSuccess("Shablon yangilandi");
      } else {
        setTemplates((prev) => [...prev, data.template]);
        showSuccess("Shablon qo'shildi");
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
      const res = await fetch(`/api/sms-templates/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "O'chirilmadi");
        return;
      }
      setTemplates((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      showSuccess("Shablon o'chirildi");
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
          <span>+ SMS shablon qo&apos;shish</span>
        </button>
      </div>

      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{templates.length}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">Sarlavha</th>
                <th className="px-5 py-3 text-left w-40">Turi</th>
                <th className="px-5 py-3 text-left">SMS</th>
                <th className="px-5 py-3 text-right pr-5 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((t, i) => (
                <tr key={t.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  <td className="px-5 py-3 font-medium">{t.title}</td>
                  <td className="px-5 py-3 text-[13px]">{t.audience}</td>
                  <td className="px-5 py-3 text-[13px] text-muted-foreground">{truncate(t.text)}</td>
                  <td className="px-5 py-3 pr-5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(t)}
                        className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground"
                        title="Tahrirlash"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(t)}
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
                    {loading ? "Yuklanmoqda…" : "Shablon topilmadi"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          totalItems={templates.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && closeForm()} />
          <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
            <h3 className="text-[16px] font-semibold">
              {editTarget ? "Shablonni tahrirlash" : "SMS shablon qo'shish"}
            </h3>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Sarlavha</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={inputCls}
                placeholder="Masalan: To'lov qiling"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Turi</label>
              <div className="relative">
                <select
                  value={form.audience}
                  onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
                  className="h-10 w-full appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {SMS_AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <svg className="icon icon-xs absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">SMS matni</label>
              <textarea
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                rows={5}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
                placeholder="Hurmatli {name}, ..."
              />
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                <span className="text-[12px] text-muted-foreground">O&apos;rinbosarlar:</span>
                {SMS_PLACEHOLDERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, text: f.text + p }))}
                    className="h-6 px-2 rounded-md bg-secondary hover:bg-secondary/70 text-[12px] font-mono"
                  >
                    {p}
                  </button>
                ))}
              </div>
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
