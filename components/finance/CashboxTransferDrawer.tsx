"use client";

import { useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import MoneyInput from "@/components/ui/MoneyInput";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { type Cashbox, type CashboxMethodTotals } from "@/lib/cashboxes";
import { invalidateTransactions } from "@/lib/cacheKeys";
import Select from "@/components/ui/Select";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

function fmtUZS(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " UZS";
}

// Kassalar sahifasidagi har bir to'lov turi kartochkasining "Ko'chirish"
// havolasi — bitta kassa ichida to'lov turlari orasida (Naqd → Plastik va
// h.k.) pul ko'chiradi. "To'lov turi" (`initialFrom`) qulflangan — foydalanuvchi
// faqat "To'lov turiga"ni tanlaydi. Boshqa KASSAGA ko'chirish uchun
// CashboxTransferToDrawer'ga qarang (asosiy kassa kartochkasining
// "Ko'chirish" tugmasi).
export default function CashboxTransferDrawer({
  cashbox,
  initialFrom,
  onClose,
  onSaved,
}: {
  cashbox: Cashbox;
  initialFrom: string;
  onClose: () => void;
  onSaved: (c: Cashbox) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "drawer");
  // To'lov turlari Sozlamalar → Moliya → To'lov turlaridan (faqat faollari).
  const { active: paymentMethods } = usePaymentMethods();
  const { showSuccess, showError } = useToast();
  const [from, setFrom] = useState<string>(initialFrom || "");
  const [to, setTo] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const available = from ? cashbox.methodTotals[from as keyof CashboxMethodTotals] ?? 0 : null;

  async function save() {
    if (!from || !to) {
      showError(t("To'lov turlarini tanlang"));
      return;
    }
    if (from === to) {
      showError(t("Bir xil to'lov turini tanlab bo'lmaydi"));
      return;
    }
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      showError(t("Qiymatni to'g'ri kiriting"));
      return;
    }
    if (available != null && amountNum > available) {
      showError(t("Mablag' yetarli emas"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/cashboxes/${cashbox.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, amount: amountNum }),
      });
      const data = await res.json();
      invalidateTransactions(); // yangi tranzaksiya yozildi -> kesh bekor
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      onSaved(data.cashbox as Cashbox);
      showSuccess(t("Pul ko'chirildi"));
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} controller={modal} bare variant="drawer" size="sm" zIndex={110}>
        <div className="flex items-center gap-3 px-5 py-4 bg-primary text-white">
          <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="text-[16px] font-semibold flex-1">{t("Ko'chirish")}</h3>
          <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("To'lov turi")}</label>
            <Select value={from} onChange={(v) => setFrom(v)} options={paymentMethods.map((m) => ({ value: m.key, label: m.name }))} placeholder={t("Tanlang")} clearable disabled={!!initialFrom} />
            {available != null && (
              <div className="text-[12px] text-muted-foreground mt-1">Mavjud: {fmtUZS(available)}</div>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("To'lov turiga")}</label>
            <Select value={to} onChange={(v) => setTo(v)} options={paymentMethods.filter((m) => m.key !== from).map((m) => ({ value: m.key, label: m.name }))} placeholder={t("Tanlang")} clearable />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Qiymat")}</label>
            <MoneyInput
              value={amount}
              onChange={setAmount}
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={modal.close} disabled={saving} className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
            {t("Orqaga")}
          </button>
          <button onClick={save} disabled={saving} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? t("Saqlanmoqda…") : t("Ko'chirish")}
          </button>
        </div>
      </Modal>
  );
}
