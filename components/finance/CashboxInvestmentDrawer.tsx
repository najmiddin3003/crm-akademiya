"use client";

import { useState } from "react";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import DatePicker from "@/components/ui/DatePicker";
import MoneyInput, { groupNumber } from "@/components/ui/MoneyInput";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { type Cashbox } from "@/lib/cashboxes";
import { invalidateTransactions } from "@/lib/cacheKeys";
import Select from "@/components/ui/Select";
import Modal, { useModalClose } from "@/components/ui/Modal";

function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
interface Row {
  id: number;
  amount: string;
}

// Kassalar sahifasidagi "More" → "Sarmoya" — Divident bilan bir xil oyna
// (Qiymat qatorlari, Umumiy summa, To'lov turi, Sana, Izoh), lekin pul
// harakati Kirim kabi — kassaga pul KIRADI (balans oshadi), aksincha emas.
// /api/cashboxes/:id/adjust (mode: "kirim", category: "Sarmoya") orqali
// HAQIQIY, jurnalga ham yoziladi.
//
// OLIB TASHLANGAN: qatorlardagi majburiy (*) "Oyni tanlang" tanlagichi —
// tanlangan oy hech qayerga yuborilmasdi va saqlanmasdi
// (CashboxAdjustDrawer'dagi bilan bir xil sabab).
export default function CashboxInvestmentDrawer({
  cashbox,
  onClose,
  onSaved,
}: {
  cashbox: Cashbox;
  onClose: () => void;
  onSaved: (c: Cashbox) => void;
}) {
  const modal = useModalClose(onClose, "drawer");
  // To'lov turlari Sozlamalar → Moliya → To'lov turlaridan (faqat faollari).
  const { active: paymentMethods } = usePaymentMethods();
  // TUZATILDI: Sozlamalardagi "Sarmoya va dividentda ko'rsatish" tugmasi
  // (lib/settingsLists.ts → showInInvestment) hech qanday ta'sir qilmasdi —
  // bu oyna uni umuman o'qimasdi, ya'ni ishlamaydigan boshqaruv edi. Endi
  // o'chirilgan turlar ro'yxatga chiqmaydi.
  //
  // Belgi UMUMAN yo'q bo'lsa (seed'dagi va sozlama qo'shilishidan oldingi
  // yozuvlarda u yo'q) tur ko'rsatilaveradi — aks holda ro'yxat butunlay
  // bo'shab qolardi. Faqat aniq `false` yashiradi.
  //
  // `showInInvestment` lib/paymentMethods.ts dagi PaymentMethod
  // interfeysida e'lon qilinmagan (u fayl bu guruh egaligida emas), shu
  // bois shu yerda tor tur bilan o'qiladi.
  const investmentMethods = paymentMethods.filter(
    (m) => (m as { showInInvestment?: boolean }).showInInvestment !== false,
  );
  const { showSuccess, showError } = useToast();
  const [rows, setRows] = useState<Row[]>([{ id: 1, amount: "" }]);
  const [nextRowId, setNextRowId] = useState(2);
  const [method, setMethod] = useState("");
  const [date, setDate] = useState<Date | null>(new Date());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  function addRow() {
    setRows((prev) => [...prev, { id: nextRowId, amount: "" }]);
    setNextRowId((n) => n + 1);
  }
  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }
  function updateRow(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (!total || total <= 0) {
      showError("Qiymatni to'g'ri kiriting");
      return;
    }
    if (!method) {
      showError("To'lov turini tanlang");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/cashboxes/${cashbox.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "kirim",
          method,
          amount: total,
          category: "Sarmoya",
          date: date ? toIso(date) : undefined,
          note,
        }),
      });
      const data = await res.json();
      invalidateTransactions(); // yangi tranzaksiya yozildi -> kesh bekor
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        setSaving(false);
        return;
      }
      onSaved(data.cashbox as Cashbox);
      showSuccess("Sarmoya qo'shildi");
      modal.close();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} controller={modal} bare variant="drawer" size="sm" zIndex={110}>
        <div className="flex items-center gap-3 px-5 py-4 bg-primary text-white">
          <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="text-[16px] font-semibold flex-1">Sarmoya</h3>
          <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div className="space-y-3">
            {rows.map((row, i) => (
              <div key={row.id} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-[13px] font-medium mb-1.5">Qiymat</label>
                  <MoneyInput
                    value={row.amount}
                    onChange={(v) => updateRow(row.id, { amount: v })}
                    placeholder="Qiymat"
                    className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="h-10 w-10 shrink-0 rounded-lg border border-border text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center"
                    title="O'chirish"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addRow}
              className="h-9 w-9 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 inline-flex items-center justify-center"
              title="Qator qo'shish"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Umumiy summa</label>
            <input
              value={groupNumber(total)}
              readOnly
              type="text"
              className="w-full h-10 rounded-lg border border-border bg-secondary/30 px-3 text-sm tabular-nums"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">To&apos;lov turi</label>
            <Select value={method} onChange={(v) => setMethod(v)} options={investmentMethods.map((m) => ({ value: m.key, label: m.name }))} placeholder="Tanlang" clearable />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Sanani tanlang</label>
            <DatePicker value={date} onChange={setDate} className="w-full" />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Izoh</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              type="text"
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={modal.close} disabled={saving} className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
            Orqaga
          </button>
          <button onClick={save} disabled={saving} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </Modal>
  );
}
