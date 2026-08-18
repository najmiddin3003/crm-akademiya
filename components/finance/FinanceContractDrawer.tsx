"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import DatePicker from "@/components/ui/DatePicker";
import MoneyInput from "@/components/ui/MoneyInput";
import type { Order } from "@/lib/ordersData";
import type { FinanceContract, ContractPart } from "@/lib/financeContracts";

// "Shartnoma yaratish" — Moliya → Shartnoma sahifasidagi o'ng tomondan
// ochiladigan panel (skrinshot 3). `contract` berilsa — tahrirlash (PATCH
// /api/finance-contracts/:id), aks holda qo'shish (POST /api/finance-contracts).
// Moderator maydoni manba oynasida yo'q edi — yangi shartnoma har doim
// joriy (demo) moderatorga biriktiriladi (loyihada haqiqiy login/sessiya
// tushunchasi yo'q, shu sabab "joriy foydalanuvchi"ni aniqlab bo'lmaydi).
const DEFAULT_MODERATOR = { id: 2, name: "Husanboy Sotiboldiyev" };

// Formada Qiymat faqat raqamlardan iborat SATR sifatida saqlanadi (MoneyInput
// shuni qaytaradi), saqlashda songa qaytariladi — bazadagi
// ContractPart.amount son bo'lib qoladi (contractPartsTotal shunga tayanadi).
type PartDraft = Omit<ContractPart, "amount"> & { amount: string };

function nextPartId(parts: PartDraft[]): number {
  return parts.reduce((max, p) => Math.max(max, p.id), 0) + 1;
}

export default function FinanceContractDrawer({
  contract,
  orders,
  onClose,
  onSaved,
}: {
  contract?: FinanceContract;
  orders: Order[];
  onClose: () => void;
  onSaved: (c: FinanceContract) => void;
}) {
  useEscapeClose(onClose);
  const { showSuccess, showError } = useToast();

  const studentOptions = useMemo(() => orders.map((o) => `${o.name} — ${o.phone}`), [orders]);
  const initialStudentOption = contract
    ? studentOptions.find((opt) => opt.startsWith(`${contract.studentName} —`)) ?? ""
    : "";

  const [studentOption, setStudentOption] = useState(initialStudentOption);
  const [comment, setComment] = useState(contract?.comment ?? "");
  const [parts, setParts] = useState<PartDraft[]>(
    contract?.parts.map((p) => ({ ...p, amount: p.amount ? String(p.amount) : "" })) ??
      [{ id: 1, amount: "", date: null, comment: "" }],
  );
  const [saving, setSaving] = useState(false);

  function updatePart(id: number, patch: Partial<PartDraft>) {
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function addPart() {
    setParts((prev) => [...prev, { id: nextPartId(prev), amount: "", date: null, comment: "" }]);
  }
  function removePart(id: number) {
    setParts((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  }

  async function save() {
    const order = orders.find((o) => studentOption.startsWith(`${o.name} — ${o.phone}`));
    if (!order) {
      showError("O'quvchini tanlang");
      return;
    }
    setSaving(true);
    const url = contract ? `/api/finance-contracts/${contract.id}` : "/api/finance-contracts";
    const method = contract ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentOrderId: order.id,
          studentName: order.name,
          moderatorId: contract?.moderatorId ?? DEFAULT_MODERATOR.id,
          moderatorName: contract?.moderatorName ?? DEFAULT_MODERATOR.name,
          comment,
          parts: parts.map((p) => ({ ...p, amount: Number(p.amount) || 0 })),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        setSaving(false);
        return;
      }
      onSaved(data.contract as FinanceContract);
      showSuccess(contract ? "Shartnoma yangilandi" : "Shartnoma qo'shildi");
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
          <h3 className="text-[16px] font-semibold flex-1">{contract ? "Shartnomani tahrirlash" : "Shartnoma yaratish"}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <StudentSearchSelect
            label="O'quvchi"
            required
            value={studentOption}
            onChange={setStudentOption}
            options={studentOptions}
            placeholder="O'quvchini tanlang"
          />

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Izoh</label>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              type="text"
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="space-y-4">
            {parts.map((part, i) => (
              <div key={part.id} className="rounded-xl border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-muted-foreground">Shartnoma qismi {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removePart(part.id)}
                    disabled={parts.length <= 1}
                    className="h-7 w-7 rounded-md hover:bg-rose-500/10 hover:text-rose-600 inline-flex items-center justify-center text-muted-foreground disabled:opacity-40 disabled:hover:bg-transparent"
                    title="O'chirish"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-[13px] font-medium mb-1.5">Qiymat</label>
                  <MoneyInput
                    value={part.amount}
                    onChange={(v) => updatePart(part.id, { amount: v })}
                    className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium mb-1.5">Shartnoma sanasi</label>
                  <DatePicker
                    value={part.date ? new Date(part.date) : null}
                    onChange={(d) => {
                      const p2 = (n: number) => String(n).padStart(2, "0");
                      updatePart(part.id, { date: `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` });
                    }}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium mb-1.5">Izoh</label>
                  <input
                    value={part.comment}
                    onChange={(e) => updatePart(part.id, { comment: e.target.value })}
                    type="text"
                    className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addPart}
            className="w-full h-9 rounded-lg border border-dashed border-primary/50 text-primary text-sm font-medium hover:bg-primary/5"
          >
            + Shartnoma qismini qo&apos;shish
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} disabled={saving} className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
            Orqaga
          </button>
          <button onClick={save} disabled={saving} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
