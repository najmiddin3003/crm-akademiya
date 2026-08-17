"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Search, Trash2 } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import type { NewsItem } from "@/lib/news";

// Sotuv va marketing → Yangiliklar (sidebar: Sotuv va marketing >
// Yangiliklar, href /sales-news). Ma'lumot HAQIQIY — /api/news
// (MongoDB `news`). Qidiruv sarlavha va kontent bo'yicha ishlaydi.

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function NewsPage() {
  const { showSuccess, showError } = useToast();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<NewsItem | null>(null);
  const [form, setForm] = useState({ title: "", content: "", image: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NewsItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/news")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setItems(d.items); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
    );
  }, [items, query]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  function openAdd() {
    setForm({ title: "", content: "", image: "" });
    setAddOpen(true);
  }
  function openEdit(n: NewsItem) {
    setForm({ title: n.title, content: n.content, image: n.image });
    setEditTarget(n);
  }
  function closeForm() {
    setAddOpen(false);
    setEditTarget(null);
  }

  async function save() {
    const title = form.title.trim();
    if (!title) {
      showError("Sarlavhani kiriting");
      return;
    }
    setSaving(true);
    try {
      const editing = editTarget !== null;
      const res = await fetch(editing ? `/api/news/${editTarget.id}` : "/api/news", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: form.content, image: form.image }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return;
      }
      if (editing) {
        setItems((prev) => prev.map((x) => (x.id === data.item.id ? data.item : x)));
        showSuccess("Yangilik yangilandi");
      } else {
        setItems((prev) => [data.item, ...prev]);
        showSuccess("Yangilik qo'shildi");
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
      const res = await fetch(`/api/news/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "O'chirilmadi");
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      showSuccess("Yangilik o'chirildi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const formOpen = addOpen || editTarget !== null;

  return (
    <div className="page-frame container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <span>+ Yangilik qo&apos;shish</span>
        </button>
        <div className="relative ml-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Qidirish"
            className="h-10 w-64 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{filtered.length}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-24">Rasm</th>
                <th className="px-5 py-3 text-left">Sarlavha</th>
                <th className="px-5 py-3 text-left">Kontent</th>
                <th className="px-5 py-3 text-center w-32">Ko&apos;rilganlar</th>
                <th className="px-5 py-3 text-left w-40">Sana</th>
                <th className="px-5 py-3 text-right pr-5 w-28">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((n) => (
                <tr key={n.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3">
                    {n.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={n.image} alt={n.title} className="h-10 w-16 rounded object-cover" />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-medium">{n.title}</td>
                  <td className="px-5 py-3 text-[13px] text-muted-foreground">
                    <span className="line-clamp-2">{n.content || "-"}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex items-center justify-center gap-1.5 text-muted-foreground tabular-nums">
                      <Eye className="w-4 h-4" />
                      {n.views}
                    </span>
                  </td>
                  <td className="px-5 py-3 tabular-nums text-[12px] text-muted-foreground whitespace-nowrap">{n.createdAt}</td>
                  <td className="px-5 py-3 pr-5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(n)}
                        className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground"
                        title="Tahrirlash"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(n)}
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
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {loading ? <SpinnerBlock size={22} /> : "Yangilik topilmadi"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          totalItems={filtered.length}
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
              {editTarget ? "Yangilikni tahrirlash" : "Yangilik qo'shish"}
            </h3>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Sarlavha</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={inputCls}
                placeholder="Yangilik sarlavhasi"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Rasm (URL)</label>
              <input
                value={form.image}
                onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                className={inputCls}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Kontent</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={5}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
                placeholder="Yangilik matni"
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
