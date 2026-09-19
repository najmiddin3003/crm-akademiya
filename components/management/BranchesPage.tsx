"use client";

import { invalidateBranches } from "@/hooks/useBranches";
import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import type { ManagementBranch } from "@/lib/managementBranches";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// Boshqaruv → Filiallar (sidebar: Boshqaruv > Filiallar, href
// /management-filiallar). Ma'lumot HAQIQIY — /api/branches (MongoDB
// `branches`). Referensdagidek jadval emas, oddiy ro'yxat: chapda filial
// nomi, o'ngda manzil. Amal tugmalari DOIM ko'rinadi (boshqa ro'yxatlar
// bilan bir xil) — ilgari ular faqat hover'da chiqardi.
//
// TELEGRAM TOPIKLARI (12.09.2026): har filialning lidlari "Lidlar"
// guruhidagi, to'lovlari esa to'lovlar guruhidagi o'z topigiga tushadi
// (lib/leadNotify.ts, lib/sync/dispatch.ts). Topik raqami shu formadan
// kiritiladi — raqam yoki Telegram'dan nusxalangan topik havolasi
// (serverda `parseLeadTopicId` ikkalasini ham tushunadi). Ro'yxatda topigi
// yo'q filial ATAYLAB ko'zga tashlanadi: lid umumiy topikka tushadi yoki
// (u ham bo'lmasa) umuman yuborilmaydi; to'lov umumiy "To'lovlar" topigiga.

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

const emptyForm = { name: "", location: "", leadTopic: "", paymentTopic: "" };

/** Ro'yxatdagi kichik belgi: topik bor — ko'k, yo'q — sariq. */
function TopicBadge({ label, topic, missingTitle }: { label: string; topic: number | null | undefined; missingTitle: string }) {
  const { t } = useT();
  return topic ? (
    <span
      className="shrink-0 rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[12px] font-medium text-sky-600"
      title={t("{label} Telegram'da shu topikka tushadi", { label })}
    >
      {label}: topik {topic}
    </span>
  ) : (
    <span
      className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[12px] font-medium text-amber-700 dark:text-amber-400"
      title={missingTitle}
    >
      {label}: topik yo&apos;q
    </span>
  );
}

export default function BranchesPage() {
  const { t } = useT();
  const modal = useModalClose(closeForm);
  const { showSuccess, showError } = useToast();
  const [branches, setBranches] = useState<ManagementBranch[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ManagementBranch | null>(null);
  const [form, setForm] = useState(emptyForm);
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
    setForm(emptyForm);
    setAddOpen(true);
  }
  function openEdit(b: ManagementBranch) {
    setForm({
      name: b.name,
      location: b.location,
      leadTopic: b.leadTopicId ? String(b.leadTopicId) : "",
      paymentTopic: b.paymentTopicId ? String(b.paymentTopicId) : "",
    });
    setEditTarget(b);
  }
  function closeForm() {
    setAddOpen(false);
    setEditTarget(null);
  }

  async function save() {
    const name = form.name.trim();
    if (!name) {
      showError(t("Filial nomini kiriting"));
      return;
    }
    setSaving(true);
    try {
      const editing = editTarget !== null;
      const res = await fetch(editing ? `/api/branches/${editTarget.id}` : "/api/branches", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        // Topik XOM satr sifatida ketadi (raqam yoki havola) — server
        // tozalaydi va noto'g'ri bo'lsa tushunarli xato qaytaradi.
        body: JSON.stringify({
          name,
          location: form.location,
          leadTopicId: form.leadTopic.trim(),
          paymentTopicId: form.paymentTopic.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        return;
      }
      // Kesh bekor qilinadi: keyin mount bo'ladigan iste'molchilar
      // yangi ro'yxatni oladi (lib/referenceCache.ts).
      invalidateBranches();
      if (editing) {
        setBranches((prev) => prev.map((x) => (x.id === data.branch.id ? data.branch : x)));
        showSuccess(t("Filial yangilandi"));
      } else {
        setBranches((prev) => [...prev, data.branch]);
        showSuccess(t("Filial qo'shildi"));
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
      const res = await fetch(`/api/branches/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "O'chirilmadi"));
        return;
      }
      invalidateBranches();
      setBranches((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      showSuccess(t("Filial o'chirildi"));
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
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
          <span>{t("+ Filial qo'shish")}</span>
        </button>
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
        {branches.map((b) => (
          <div key={b.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-secondary/30 transition-colors">
            <span className="font-medium">{b.name}</span>
            <span className="ml-auto text-[13px] text-muted-foreground">{b.location}</span>
            <TopicBadge
              label={t("Lidlar")}
              topic={b.leadTopicId}
              missingTitle="Bu filialning lidlari umumiy topikka tushadi (u ham bo'lmasa — yuborilmaydi)"
            />
            <TopicBadge
              label={t("To'lovlar")}
              topic={b.paymentTopicId}
              missingTitle="Bu filialning to'lovlari umumiy “To'lovlar” topigiga tushadi"
            />
            {/* Amal tugmalari DOIM ko'rinadi. Ilgari ular
                `opacity-0 group-hover:opacity-100` bilan yashiringan edi —
                sichqonchasiz (sensorli ekran, klaviatura) ularni topib
                bo'lmasdi va sahifada tahrirlash imkoni umuman yo'qdek
                ko'rinardi. Loyihadagi boshqa ro'yxatlar ham tugmalarni
                doim ko'rsatadi (EmployeesListPage, RoomsListPage). */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => openEdit(b)}
                className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground"
                title={t("Tahrirlash")}
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeleteTarget(b)}
                className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500"
                title={t("O'chirish")}
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
        <Modal onClose={closeForm} controller={modal} locked={saving} bare zIndex={110} panelClassName="p-6 space-y-4">
            <h3 className="text-[16px] font-semibold">
              {editTarget ? t("Filialni tahrirlash") : t("Filial qo'shish")}
            </h3>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("Nomi")}</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
                placeholder={t("Masalan: Akademiya 3-filial")}
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("Manzil")}</label>
              <input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className={inputCls}
                placeholder={t("Masalan: Chortoq")}
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("Telegram lid topigi")}</label>
              <input
                value={form.leadTopic}
                onChange={(e) => setForm((f) => ({ ...f, leadTopic: e.target.value }))}
                className={inputCls}
                placeholder={t("Masalan: 45 yoki https://t.me/c/…/45")}
              />
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                Shu filialda qo&apos;shilgan yangi lid &quot;Lidlar&quot; guruhining shu topigiga tushadi.
                Topikdagi xabarga o&apos;ng tugma → &quot;Copy Link&quot; — havolani shu yerga qo&apos;ying.
                Bo&apos;sh qoldirilsa umumiy topik ishlatiladi.
              </p>
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("Telegram to'lov topigi")}</label>
              <input
                value={form.paymentTopic}
                onChange={(e) => setForm((f) => ({ ...f, paymentTopic: e.target.value }))}
                className={inputCls}
                placeholder={t("Masalan: 3 yoki https://t.me/c/…/3")}
              />
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                {t("Shu filial kassalariga tushgan to'lov to'lovlar guruhining shu topigiga ketadi. Bo'sh qoldirilsa umumiy \"To'lovlar\" topigi.")}
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
