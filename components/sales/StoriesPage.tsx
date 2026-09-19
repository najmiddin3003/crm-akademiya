"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Search, Trash2, Upload, X } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import type { Story } from "@/lib/stories";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// Sotuv va marketing → Hikoya (sidebar: Sotuv va marketing > Hikoya,
// href /sales-stories). Ma'lumot HAQIQIY — /api/stories (MongoDB `stories`).
//
// "Fayl" maydoni ilgari ODDIY MATN kiritish edi ("masalan: qabul-2026.jpg"):
// hech qanday yuklash bo'lmasdi, kiritilgan satr jadvalda oddiy matn bo'lib
// turardi — hikoya hech qachon media olib yura olmasdi. Loyihada yuklash
// endpointlari BOR (app/api/upload/image, app/api/upload/video →
// Cloudinary), shu bois maydon endi HAQIQIY fayl tanlaydi va bazaga
// Cloudinary qaytargan URL yoziladi; jadvalda esa u havola bo'lib ochiladi.

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

// Endpointlar shu turlarni qabul qiladi (app/api/upload/*/route.ts):
// rasm — PNG/JPG/WEBP, 5 MB gacha; video — MP4/WEBM/MOV, 50 MB gacha.
const ACCEPT_FILES = "image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime";

/** Saqlangan qiymat haqiqiy havolami (eski yozuvlarda shunchaki fayl nomi turibdi). */
function isUrl(v: string): boolean {
  return /^https?:\/\//i.test(v);
}

/** "https://res.cloudinary.com/.../qabul-2026.jpg" → "qabul-2026.jpg" */
function fileLabel(url: string): string {
  const tail = url.split("?")[0].split("/").pop();
  return tail || url;
}

export default function StoriesPage() {
  const { t } = useT();
  const modal = useModalClose(closeForm);
  const { showSuccess, showError } = useToast();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Story | null>(null);
  const [form, setForm] = useState({ title: "", image: "", file: "" });
  // Tanlangan, lekin hali yuklanmagan fayl. Yuklash "Saqlash" bosilganda
  // bo'ladi — shunda muvaffaqiyatsiz yuklashdan keyin bazada bo'sh havola
  // qolib ketmaydi (PenaltyDrawer'dagi bilan bir xil tartib).
  const [fileUpload, setFileUpload] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Story | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stories")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setStories(d.stories); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stories;
    return stories.filter((s) => s.title.toLowerCase().includes(q));
  }, [stories, query]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  function openAdd() {
    setForm({ title: "", image: "", file: "" });
    setFileUpload(null);
    setAddOpen(true);
  }
  function openEdit(s: Story) {
    setForm({ title: s.title, image: s.image, file: s.file });
    setFileUpload(null);
    setEditTarget(s);
  }
  function closeForm() {
    setAddOpen(false);
    setEditTarget(null);
    setFileUpload(null);
  }

  async function save() {
    const title = form.title.trim();
    if (!title) {
      showError(t("Sarlavhani kiriting"));
      return;
    }
    setSaving(true);
    try {
      // Yangi fayl tanlangan bo'lsa avval yuklanadi; yuklanmasa hikoya
      // umuman saqlanmaydi — aks holda "saqlandi" deyilib, fayl yo'qolardi.
      let fileUrl = form.file;
      if (fileUpload) {
        const isVideo = fileUpload.type.startsWith("video/");
        const fd = new FormData();
        fd.append("file", fileUpload);
        fd.append("folder", "hikoyalar");
        const up = await fetch(isVideo ? "/api/upload/video" : "/api/upload/image", {
          method: "POST",
          body: fd,
        });
        const upData = await up.json().catch(() => null);
        if (!up.ok || !upData?.ok) {
          showError(t(upData?.error || "Fayl yuklanmadi"));
          return;
        }
        fileUrl = upData.url as string;
      }

      const editing = editTarget !== null;
      const res = await fetch(editing ? `/api/stories/${editTarget.id}` : "/api/stories", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, image: form.image, file: fileUrl }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        return;
      }
      if (editing) {
        setStories((prev) => prev.map((x) => (x.id === data.story.id ? data.story : x)));
        showSuccess(t("Hikoya yangilandi"));
      } else {
        setStories((prev) => [data.story, ...prev]);
        showSuccess(t("Hikoya qo'shildi"));
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
      const res = await fetch(`/api/stories/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "O'chirilmadi"));
        return;
      }
      setStories((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      showSuccess(t("Hikoya o'chirildi"));
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
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
          <span>{t("+ Hikoya qo'shish")}</span>
        </button>
        <div className="relative ml-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder={t("Qidirish")}
            className="h-10 w-64 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>{t("Umumiy soni:")}</span>
            <span className="tabular-nums">{filtered.length}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-24">{t("Rasm")}</th>
                <th className="px-5 py-3 text-left">{t("Sarlavha")}</th>
                <th className="px-5 py-3 text-left w-44">{t("Sana")}</th>
                <th className="px-5 py-3 text-left w-56">{t("Fayl")}</th>
                <th className="px-5 py-3 text-right pr-5 w-28">{t("Amallar")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((s) => (
                <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3">
                    {s.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image} alt={t(s.title)} className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-medium">{t(s.title)}</td>
                  <td className="px-5 py-3 tabular-nums text-[12px] text-muted-foreground whitespace-nowrap">{s.createdAt}</td>
                  <td className="px-5 py-3 text-[13px] max-w-[224px]">
                    {/* Yuklangan fayl — ochiladigan havola. Eski yozuvlarda
                        bu maydonda qo'lda yozilgan matn turishi mumkin: u
                        havola emas, shuning uchun havola qilib ko'rsatilmaydi. */}
                    {s.file ? (
                      isUrl(s.file) ? (
                        <a
                          href={s.file}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline truncate block"
                          title={s.file}
                        >
                          {fileLabel(s.file)}
                        </a>
                      ) : (
                        <span className="text-muted-foreground truncate block" title={t("Eski yozuv: bu shunchaki matn, yuklangan fayl emas")}>
                          {s.file}
                        </span>
                      )
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
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
          totalItems={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      {formOpen && (
        <Modal onClose={closeForm} controller={modal} locked={saving} bare zIndex={110} panelClassName="p-6 space-y-4">
            <h3 className="text-[16px] font-semibold">
              {editTarget ? t("Hikoyani tahrirlash") : t("Hikoya qo'shish")}
            </h3>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("Sarlavha")}</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={inputCls}
                placeholder={t("Hikoya sarlavhasi")}
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("Rasm (URL)")}</label>
              <input
                value={form.image}
                onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                className={inputCls}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("Fayl")}</label>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT_FILES}
                className="hidden"
                onChange={(e) => setFileUpload(e.target.files?.[0] ?? null)}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={saving}
                  className="flex-1 h-10 flex items-center justify-between rounded-lg border border-border bg-card px-3 text-sm hover:bg-secondary disabled:opacity-60"
                >
                  <span className={fileUpload || form.file ? "truncate" : "text-muted-foreground"}>
                    {fileUpload?.name || (form.file ? (isUrl(form.file) ? fileLabel(form.file) : form.file) : "Faylni tanlash")}
                  </span>
                  <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
                {(fileUpload || form.file) && (
                  <button
                    type="button"
                    onClick={() => { setFileUpload(null); setForm((f) => ({ ...f, file: "" })); if (fileRef.current) fileRef.current.value = ""; }}
                    disabled={saving}
                    className="h-10 w-10 shrink-0 rounded-lg border border-border bg-card hover:bg-secondary flex items-center justify-center text-muted-foreground disabled:opacity-60"
                    title={t("Faylni olib tashlash")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-[12px] text-muted-foreground mt-1.5">
                {t("Rasm: PNG, JPG yoki WEBP (5 MB gacha). Video: MP4, WEBM yoki MOV (50 MB gacha).")}
              </p>
            </div>
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
