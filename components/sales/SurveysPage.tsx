"use client";

import { useEffect, useState } from "react";
import { Copy, Settings, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { surveyBotLink, surveyTildaLink, surveyWebLink, type Survey } from "@/lib/surveys";

// Sotuv va marketing → Marketing (sidebar: Sotuv va marketing > Marketing,
// href /sales-marketing). Ma'lumot HAQIQIY — /api/surveys (MongoDB `surveys`).
//
// Bu lid MANBALARI so'rovnomasi: har manba uchun kod, koddan veb/bot/Tilda
// havolalari hosil qilinadi. Har havola yonida nusxalash tugmasi bor
// (referensdagidek), qatordagi sozlama ikonkasi tahrirlash oynasini ochadi.

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function LinkCell({ value, onCopy }: { value: string; onCopy: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="truncate text-[12px] text-muted-foreground">{value}</span>
      <button
        onClick={() => onCopy(value)}
        className="shrink-0 h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground"
        title="Nusxalash"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function SurveysPage() {
  const { showSuccess, showError } = useToast();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Survey | null>(null);
  const [form, setForm] = useState({ title: "", image: "", code: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Survey | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/surveys")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setSurveys(d.surveys); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      showSuccess("Havola nusxalandi");
    } catch {
      showError("Nusxalab bo'lmadi");
    }
  }

  function openAdd() {
    setForm({ title: "", image: "", code: "" });
    setAddOpen(true);
  }
  function openEdit(s: Survey) {
    setForm({ title: s.title, image: s.image, code: s.code });
    setEditTarget(s);
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
      const payload: Record<string, string> = { title, image: form.image };
      // Yangi yozuvda kod bo'sh bo'lsa — backend o'zi keyingi kodni beradi.
      if (form.code.trim() || editing) payload.code = form.code.trim();
      const res = await fetch(editing ? `/api/surveys/${editTarget.id}` : "/api/surveys", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return;
      }
      if (editing) {
        setSurveys((prev) => prev.map((x) => (x.id === data.survey.id ? data.survey : x)));
        showSuccess("So'rovnoma yangilandi");
      } else {
        setSurveys((prev) => [...prev, data.survey]);
        showSuccess("So'rovnoma qo'shildi");
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
      const res = await fetch(`/api/surveys/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "O'chirilmadi");
        return;
      }
      setSurveys((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      showSuccess("So'rovnoma o'chirildi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const formOpen = addOpen || editTarget !== null;

  return (
    <div className="container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <span>+ So&apos;rovnoma qo&apos;shish</span>
        </button>
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1200px]">
            <thead className="bg-secondary/20">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">Sarlavha</th>
                <th className="px-5 py-3 text-left w-24">Rasm</th>
                <th className="px-5 py-3 text-left">Veb havolasi</th>
                <th className="px-5 py-3 text-left">Bot havolasi</th>
                <th className="px-5 py-3 text-left">Tilda havolasi</th>
                <th className="px-5 py-3 text-right pr-5 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {surveys.map((s, i) => (
                <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-5 py-3 font-medium whitespace-nowrap">{s.title}</td>
                  <td className="px-5 py-3">
                    {s.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image} alt={s.title} className="h-8 w-8 rounded object-cover" />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3 max-w-[280px]"><LinkCell value={surveyWebLink(s)} onCopy={copy} /></td>
                  <td className="px-5 py-3 max-w-[280px]"><LinkCell value={surveyBotLink(s)} onCopy={copy} /></td>
                  <td className="px-5 py-3 max-w-[240px]"><LinkCell value={surveyTildaLink(s)} onCopy={copy} /></td>
                  <td className="px-5 py-3 pr-5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(s)}
                        className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground"
                        title="Sozlash"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(s)}
                        className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500"
                        title="O'chirish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {surveys.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {loading ? "Yuklanmoqda…" : "So'rovnoma topilmadi"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && closeForm()} />
          <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
            <h3 className="text-[16px] font-semibold">
              {editTarget ? "So'rovnomani tahrirlash" : "So'rovnoma qo'shish"}
            </h3>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Sarlavha</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={inputCls}
                placeholder="Masalan: Instagram"
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
              <label className="block text-[13px] font-medium mb-1.5">Kod</label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className={inputCls}
                placeholder={editTarget ? "s30" : "Bo'sh qoldirilsa avtomatik beriladi"}
              />
              <p className="text-[12px] text-muted-foreground mt-1.5">
                Havolalar shu koddan hosil qilinadi.
              </p>
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
