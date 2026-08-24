"use client";

import { useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useModerators } from "@/hooks/useModerators";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import type { Cashbox } from "@/lib/cashboxes";

// "Yangi kassa qo'shish" / "Kassani o'zgartirish" — Moliya → Kassalar
// sahifasidagi o'ng tomondan ochiladigan panel. `cashbox` berilsa —
// tahrirlash (PATCH /api/cashboxes/:id) va o'chirish (DELETE, tasdiqlash
// oynasi bilan — TransactionTypesPage'dagi kabi konvensiya), aks holda
// qo'shish (POST /api/cashboxes).
//
// Moderator ro'yxati BAZADAN keladi (/api/moderators — Boshqaruv →
// Xodimlar'dagi `turi: "moderator"` xodimlar). Ilgari bu yerda qattiq
// yozilgan O'QITUVCHILAR ro'yxati (GROUP_TEACHERS) chiqardi — moderator
// maydoni uchun mutlaqo noto'g'ri manba edi.
export default function CashboxDrawer({
  cashbox,
  cashboxes = [],
  onClose,
  onSaved,
  onDeleted,
}: {
  cashbox?: Cashbox;
  /** Barcha kassalar — band moderatorlarni aniqlash uchun. */
  cashboxes?: Cashbox[];
  onClose: () => void;
  onSaved: (c: Cashbox) => void;
  onDeleted?: (id: number) => void;
}) {
  useEscapeClose(onClose);
  const { showSuccess, showError } = useToast();
  const { names: moderatorNames, loading: loadingModerators } = useModerators();
  const [name, setName] = useState(cashbox?.name || "");
  const [moderator, setModerator] = useState(cashbox?.moderator || "");
  const [onlinePayment, setOnlinePayment] = useState(cashbox?.onlinePayment ?? false);
  const [archived, setArchived] = useState(cashbox?.archived ?? false);
  const [saving, setSaving] = useState(false);
  // Bitta moderator bitta kassaga biriktiriladi: boshqa kassada band
  // bo'lganlari ro'yxatda hira turadi va tanlanmaydi (o'zining kassasini
  // tahrirlayotganda o'z moderatori hisobga olinmaydi).
  const takenModerators = cashboxes
    .filter((c) => c.id !== cashbox?.id && c.moderator)
    .map((c) => c.moderator);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      showError("Kassa nomini kiriting");
      return;
    }
    setSaving(true);
    const url = cashbox ? `/api/cashboxes/${cashbox.id}` : "/api/cashboxes";
    const method = cashbox ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, moderator, onlinePayment, archived }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        setSaving(false);
        return;
      }
      onSaved(data.cashbox as Cashbox);
      showSuccess(cashbox ? "Kassa yangilandi" : "Kassa qo'shildi");
      onClose();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  async function confirmDeleteCashbox() {
    if (!cashbox) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/cashboxes/${cashbox.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "O'chirilmadi");
        setDeleting(false);
        return;
      }
      onDeleted?.(cashbox.id);
      showSuccess("Kassa o'chirildi");
      onClose();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-card border-l border-border shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 bg-primary text-white">
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="text-[16px] font-semibold flex-1">{cashbox ? "Kassani o'zgartirish" : "Yangi kassa qo'shish"}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium mb-1.5">Ism</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Moderatorlar BAZADAN (/api/moderators) — qidiruvli tanlov.
              Tanlangan qiymatni tozalash ro'yxat ichidagi "Tozalash" qatori
              orqali. */}
          <StudentSearchSelect
            label="Moderator"
            value={moderator}
            onChange={setModerator}
            options={moderatorNames}
            disabledOptions={takenModerators}
            disabledHint="Bu moderator boshqa kassaga biriktirilgan"
            placeholder={loadingModerators ? "Yuklanmoqda…" : "Moderatorni tanlang"}
            searchPlaceholder="Moderatorni qidirish"
          />
          {!loadingModerators && moderatorNames.length === 0 && (
            <p className="-mt-2 text-[11px] text-muted-foreground">
              Moderator yo&apos;q — Boshqaruv → Xodimlar&apos;da turi
              &quot;moderator&quot; bo&apos;lgan xodim qo&apos;shing.
            </p>
          )}

          <label className="flex items-center gap-2.5 text-[13px] cursor-pointer">
            <input type="checkbox" checked={onlinePayment} onChange={(e) => setOnlinePayment(e.target.checked)} className="rounded border-border w-4 h-4" />
            Onlayn to&apos;lov qabul qiladi
          </label>
          <label className="flex items-center gap-2.5 text-[13px] cursor-pointer">
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} className="rounded border-border w-4 h-4" />
            Kassani arxiv qilish
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} disabled={saving} className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
            Orqaga
          </button>
          {cashbox && (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
              className="h-9 px-5 rounded-lg bg-rose-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              O&apos;chirish
            </button>
          )}
          <button onClick={save} disabled={saving} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setConfirmDelete(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6">
            <p className="text-center text-[15px] font-semibold">Rostdan ham o&apos;chirmoqchimisiz?</p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={() => setConfirmDelete(false)} disabled={deleting} className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
                Yo&apos;q
              </button>
              <button onClick={confirmDeleteCashbox} disabled={deleting} className="h-9 px-6 rounded-lg bg-rose-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
                {deleting ? "O'chirilmoqda…" : "Ha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
