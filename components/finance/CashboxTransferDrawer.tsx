"use client";

import { useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import MoneyInput from "@/components/ui/MoneyInput";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { type Cashbox, type CashboxMethodTotals } from "@/lib/cashboxes";
import { invalidateTransactions } from "@/lib/transactionsClient";

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
  useEscapeClose(onClose);
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
      showError("To'lov turlarini tanlang");
      return;
    }
    if (from === to) {
      showError("Bir xil to'lov turini tanlab bo'lmaydi");
      return;
    }
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      showError("Qiymatni to'g'ri kiriting");
      return;
    }
    if (available != null && amountNum > available) {
      showError("Mablag' yetarli emas");
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
        showError(data.error || "Saqlanmadi");
        setSaving(false);
        return;
      }
      onSaved(data.cashbox as Cashbox);
      showSuccess("Pul ko'chirildi");
      onClose();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
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
          <h3 className="text-[16px] font-semibold flex-1">Ko&apos;chirish</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium mb-1.5">To&apos;lov turi</label>
            <div className="relative">
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                disabled={!!initialFrom}
                className="w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              >
                <option value="">Tanlang</option>
                {paymentMethods.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
              </select>
              <svg className="icon icon-xs pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
            </div>
            {available != null && (
              <div className="text-[12px] text-muted-foreground mt-1">Mavjud: {fmtUZS(available)}</div>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">To&apos;lov turiga</label>
            <div className="relative">
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Tanlang</option>
                {paymentMethods.filter((m) => m.key !== from).map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
              </select>
              <svg className="icon icon-xs pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Qiymat</label>
            <MoneyInput
              value={amount}
              onChange={setAmount}
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} disabled={saving} className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
            Orqaga
          </button>
          <button onClick={save} disabled={saving} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? "Saqlanmoqda…" : "Ko'chirish"}
          </button>
        </div>
      </div>
    </div>
  );
}
