"use client";

import { invalidateEduCategories } from "@/hooks/useEduCategories";
import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import EduCategoryModal from "./EduCategoryModal";
import type { EduCategory } from "@/lib/eduCategories";
import Modal from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// O'quv bo'limi → Kategoriya (sidebar: O'quv bo'limi > Kategoriya, href
// /edu-category). Ma'lumot /api/edu-categories dan (constants/eduCategories.js
// EDU_CATEGORY_SEED asosida seed qilingan). "Kategoriya qo'shish"/tahrirlash —
// EduCategoryModal, o'chirish — pastdagi oddiy tasdiqlash oynasi (Ha/Yo'q).

export default function EduCategoriesPage() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [categories, setCategories] = useState<EduCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<EduCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EduCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/edu-categories")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setCategories(d.categories); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function confirmDelete() {
    if (!deleteTarget) return;
    const c = deleteTarget;
    setDeleting(true);
    try {
      const res = await fetch(`/api/edu-categories/${c.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "O'chirilmadi"));
        setDeleting(false);
        return;
      }
      invalidateEduCategories();
      setCategories((prev) => prev.filter((x) => x.id !== c.id));
      showSuccess(t("Kategoriya o'chirildi"));
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div>
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
          <Plus className="icon icon-sm" />
          <span>{t("Kategoriya")}</span>
        </button>
      </div>

      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-dashed border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Kategoriya")}</th>
                <th className="px-3 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {categories.map((c, i) => (
                <tr key={c.id} className="border-b border-dashed border-border transition-colors hover:bg-secondary/30">
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{i + 1}</td>
                  <td className="px-3 py-3 text-[13px] font-medium">{c.name}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => setEditCategory(c)} className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground" title={t("Tahrirlash")}>
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(c)} className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500" title={t("O'chirish")}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-10 text-center text-sm text-muted-foreground">{loading ? <SpinnerBlock size={22} /> : "Kategoriya topilmadi"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <EduCategoryModal onClose={() => setAddOpen(false)} onSaved={(c) => setCategories((prev) => [c, ...prev])} />
      )}
      {editCategory && (
        <EduCategoryModal category={editCategory} onClose={() => setEditCategory(null)} onSaved={(c) => setCategories((prev) => prev.map((x) => (x.id === c.id ? c : x)))} />
      )}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} locked={deleting} bare size="sm" zIndex={110} panelClassName="p-6">{(modal) => (<>
            <p className="text-center text-[15px] font-semibold">{t("Rostdan ham o'chirmoqchimisiz?")}</p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={modal.close} disabled={deleting} className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
                {t("Yo'q")}
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
                {deleting ? t("O'chirilmoqda…") : t("Ha")}
              </button>
            </div>
          </>)}</Modal>
      )}
    </div>
  );
}
