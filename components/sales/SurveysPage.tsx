"use client";

import { useEffect, useState } from "react";
import Link from "@/components/ui/Link";
import { Copy, Settings, TrendingUp, Trash2 } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import type { Survey } from "@/lib/surveys";

// Sotuv va marketing → Marketing (sidebar: Sotuv va marketing > Marketing,
// href /sales-marketing). Ma'lumot HAQIQIY — /api/surveys (MongoDB `surveys`).
//
// Bu lid MANBALARI so'rovnomasi: har manba uchun kod beriladi.
//
// VEB/BOT/TILDA HAVOLALARI USTUNLARI OLIB TASHLANDI. Ular koddan yasalgan
// uchta yolg'on manzil edi: birinchisi bu loyiha KLON qilayotgan begona
// saytga, ikkinchisi mavjud bo'lmagan Telegram botga, uchinchisi umuman
// mavjud bo'lmagan Tilda formasiga ishora qilardi. Ustiga-ustak, loyihada
// `?survey=` kodini qayta o'qiydigan joy yo'q — ommaviy lid formasi ham,
// endpoint ham yo'q — ya'ni manba biriktirish hech qachon ishlamagan
// (batafsil: lib/surveys.ts).
//
// O'rniga HAQIQIY narsa ko'rsatiladi: kodning o'zi. Uni nusxalab
// buyurtmaning "So'rovnoma" maydoniga qo'yish mumkin — buyurtmalar
// ro'yxatidagi so'rovnoma filtri shu qiymat bo'yicha ishlaydi.

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function CodeCell({ value, onCopy }: { value: string; onCopy: (v: string) => void }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="truncate text-[12px] font-medium tabular-nums">{value}</span>
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
      showSuccess("Kod nusxalandi");
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
    <div className="page-frame container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <span>+ So&apos;rovnoma qo&apos;shish</span>
        </button>
        {/* O'quvchilar oqimi — o'quvchi qo'shishdagi "Manba" maydonidan
            yig'iladigan analitika. Sidebarda ham bor, lekin marketing
            ishi shu sahifadan boshlanadi. */}
        <Link
          href="/sales-sources"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary"
        >
          <TrendingUp className="w-4 h-4" />
          <span>O&apos;quvchilar oqimi</span>
        </Link>
      </div>

      {/* Rost izoh: manba havolalari hali yasalmaydi. Ilgari bu yerda uchta
          "tayyor" havola turardi — begona saytga, mavjud bo'lmagan botga va
          mavjud bo'lmagan Tilda formasiga. */}
      <div className="rounded-xl border border-dashed border-border bg-secondary/20 px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
        Manba havolalari (veb / bot / Tilda) hozircha yasalmaydi: bu ilovada lid
        qabul qiladigan ommaviy forma ham, Telegram bot ham, Tilda integratsiyasi
        ham yo&apos;q va <span className="tabular-nums">?survey=</span> kodini
        qayta o&apos;qiydigan joy yo&apos;q. Kod esa haqiqiy — uni nusxalab
        buyurtmaning &quot;So&apos;rovnoma&quot; maydoniga qo&apos;ying, buyurtmalar
        ro&apos;yxatidagi filtr shu bo&apos;yicha ishlaydi.
      </div>

      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="table-scroll">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">Sarlavha</th>
                <th className="px-5 py-3 text-left w-24">Rasm</th>
                <th className="px-5 py-3 text-left w-40">Kod</th>
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
                  <td className="px-5 py-3 max-w-[160px]"><CodeCell value={s.code} onCopy={copy} /></td>
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
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {loading ? <SpinnerBlock size={22} /> : "So'rovnoma topilmadi"}
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
                Manbaning kodi — buyurtmadagi &quot;So&apos;rovnoma&quot; maydoniga
                shu qiymat yoziladi.
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
