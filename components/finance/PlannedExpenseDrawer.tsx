"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import DatePicker from "@/components/ui/DatePicker";
import MoneyInput from "@/components/ui/MoneyInput";
import { EXPENSE_TYPES, EXPENSE_STATUSES } from "@/constants/plannedExpenses";
import type { PlannedExpense } from "@/lib/plannedExpenses";
import Select from "@/components/ui/Select";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function fromIso(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// "Xarajat qo'shish" — Moliya → Rejalashtirilgan xarajatlar sahifasidagi
// o'ng tomondan ochiladigan panel. `expense` berilsa — tahrirlash (PATCH),
// aks holda qo'shish (POST).
export default function PlannedExpenseDrawer({
  expense,
  onClose,
  onSaved,
}: {
  expense?: PlannedExpense;
  onClose: () => void;
  onSaved: (e: PlannedExpense) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "drawer");
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState(expense?.name || "");
  const [amount, setAmount] = useState(expense?.amount ? String(expense.amount) : "");
  const [type, setType] = useState(expense?.type || "");
  const [status, setStatus] = useState(expense?.status || "");
  const [startDate, setStartDate] = useState<Date | null>(fromIso(expense?.startDate ?? null));
  const [endDate, setEndDate] = useState<Date | null>(fromIso(expense?.endDate ?? null));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      showError(t("Nomini kiriting"));
      return;
    }
    setSaving(true);
    const url = expense ? `/api/planned-expenses/${expense.id}` : "/api/planned-expenses";
    const method = expense ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          amount: amount ? Number(amount) : 0,
          type,
          status,
          startDate: startDate ? toIso(startDate) : null,
          endDate: endDate ? toIso(endDate) : null,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      onSaved(data.expense as PlannedExpense);
      showSuccess(expense ? t("Xarajat yangilandi") : t("Xarajat qo'shildi"));
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} controller={modal} bare variant="drawer" size="sm" zIndex={110}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-[16px] font-semibold">{expense ? t("Xarajatni tahrirlash") : t("Xarajat qo'shish")}</h3>
          <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Nomi")}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Miqdori")}</label>
            <MoneyInput
              value={amount}
              onChange={setAmount}
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Turi")}</label>
            <Select value={type} onChange={(v) => setType(v)} options={EXPENSE_TYPES.map((tv) => ({ value: tv, label: tv }))} placeholder={t("Tanlang")} clearable />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Holati")}</label>
            <Select value={status} onChange={(v) => setStatus(v)} options={EXPENSE_STATUSES.map((s) => ({ value: s, label: s }))} placeholder={t("Tanlang")} clearable />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Boshlanish sanasi:")}</label>
            <div className="flex items-center gap-2">
              <DatePicker value={startDate} onChange={setStartDate} className="flex-1" />
              {startDate && <button type="button" onClick={() => setStartDate(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Tugash sanasi:")}</label>
            <div className="flex items-center gap-2">
              <DatePicker value={endDate} onChange={setEndDate} className="flex-1" />
              {endDate && <button type="button" onClick={() => setEndDate(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={modal.close} disabled={saving} className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
            {t("Bekor qilish")}
          </button>
          <button onClick={save} disabled={saving} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </div>
      </Modal>
  );
}
