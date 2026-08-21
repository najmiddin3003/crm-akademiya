"use client";

import { useState } from "react";
import { ArrowLeft, Pencil, X } from "lucide-react";
import Link from "next/link";
import MoneyInput, { toDigits } from "@/components/ui/MoneyInput";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import type { TransactionEntry } from "@/lib/transactionEntries";

const TX_TYPE_LABELS: Record<string, string> = { payIn: "Kirim", payOut: "Chiqim", transfer: "Ko'chirish" };
const STATUS_LABELS: Record<string, string> = { "": "Qabul qilingan", waiting: "Kutilmoqda", cancelled: "Bekor qilingan" };

function fmtSignedUZS(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " UZS";
}
function fmtEntryDate(e: TransactionEntry): string {
  const [y, m, d] = e.date.split("-");
  return `${d}.${m}.${y} | ${e.time}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/60 last:border-0">
      <span className="text-[13px] text-muted-foreground shrink-0">{label}</span>
      <span className="text-[13px] font-medium text-right">{children}</span>
    </div>
  );
}

// Kassalar sahifasidagi jadvalda qatorga bosilganda ochiladigan tafsilot
// oynasi (referens saytdagi kabi). Pastda ikkita amal — ikkalasi ham faqat
// Kirim/Chiqim yozuvlari uchun va ikkalasi ham HAQIQIY (kassa balansini
// o'zgartiradi):
//   • qalam tugmasi — miqdorni tahrirlash (/amount route'i, farq miqdoricha),
//   • "Tranzaksiyani bekor qilish" (/cancel route'i, teskari o'zgartiradi).
export default function TransactionDetailDrawer({
  entry,
  cashboxName,
  studentId,
  employeeId,
  onClose,
  onChanged,
}: {
  entry: TransactionEntry;
  cashboxName: string;
  studentId?: number;
  employeeId?: number;
  onClose: () => void;
  /** Bekor qilish yoki miqdor tahriri — yangilangan yozuv qaytariladi. */
  onChanged: (entry: TransactionEntry) => void;
}) {
  useEscapeClose(onClose);
  const { showSuccess, showError } = useToast();
  const [cancelling, setCancelling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [amountDigits, setAmountDigits] = useState("");
  const [editReason, setEditReason] = useState("");
  const [saving, setSaving] = useState(false);

  const canModify = (entry.txType === "payIn" || entry.txType === "payOut") && entry.status !== "cancelled";

  function openEdit() {
    // Maydonga faqat kattaligi kiritiladi — yo'nalish (Kirim/Chiqim)
    // o'zgarmaydi, serverda ham asl yozuvning ishorasi saqlanadi.
    setAmountDigits(toDigits(String(Math.abs(entry.amount))));
    setEditReason("");
    setEditOpen(true);
  }

  async function saveAmount() {
    const value = Number(amountDigits);
    if (!value) {
      showError("Qiymatni to'g'ri kiriting");
      return;
    }
    const reason = editReason.trim();
    if (!reason) {
      showError("Tahrir sababini kiriting");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/transaction-entries/${entry.id}/amount`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, reason }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return;
      }
      onChanged(data.entry as TransactionEntry);
      showSuccess("Miqdor o'zgartirildi");
      setEditOpen(false);
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  async function confirmCancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/transaction-entries/${entry.id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Bekor qilinmadi");
        return;
      }
      onChanged(data.entry as TransactionEntry);
      showSuccess("Tranzaksiya bekor qilindi");
      setConfirmOpen(false);
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setCancelling(false);
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
          <h3 className="text-[16px] font-semibold flex-1">Ma&apos;lumot</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Row label="Sana">{fmtEntryDate(entry)}</Row>
          <Row label="Kim">
            {entry.studentName && studentId ? (
              <Link href={`/student-edit/${studentId}?src=list`} className="text-primary hover:underline">
                {entry.studentName}
              </Link>
            ) : entry.studentName && employeeId ? (
              <Link href={`/management-xodimlar/${employeeId}`} className="text-primary hover:underline">
                {entry.studentName}
              </Link>
            ) : entry.moderator && employeeId ? (
              <Link href={`/management-xodimlar/${employeeId}`} className="text-primary hover:underline">
                {entry.moderator}
              </Link>
            ) : (
              entry.studentName || entry.moderator || "—"
            )}
          </Row>
          <Row label="Kassa">{cashboxName || "—"}</Row>
          <Row label="Izoh">{entry.note || "—"}</Row>
          <Row label="Tranzaksiya nomi">{entry.txName || "—"}</Row>
          <Row label="To'lov turi">{entry.paymentType || "—"}</Row>
          <Row label="Tranzaksiya turi">{TX_TYPE_LABELS[entry.txType] || entry.txType}</Row>
          <Row label="Holati">{STATUS_LABELS[entry.status] || entry.status}</Row>
          <Row label="Miqdori">
            <span className={entry.amount >= 0 ? "text-emerald-600" : "text-rose-600"}>{fmtSignedUZS(entry.amount)}</span>
          </Row>
        </div>

        {canModify && (
          <div className="px-5 py-4 border-t border-border flex items-center gap-2">
            <button
              onClick={openEdit}
              title="Miqdorni tahrirlash"
              className="h-9 w-9 shrink-0 rounded-lg border border-border bg-card hover:bg-secondary inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              className="flex-1 h-9 rounded-lg bg-rose-600 text-white text-sm font-medium hover:opacity-90"
            >
              Tranzaksiyani bekor qilish
            </button>
          </div>
        )}
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setEditOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6">
            <p className="text-center text-[15px] font-semibold">Miqdorni tahrirlash</p>
            <p className="text-center text-[13px] text-muted-foreground mt-1.5">
              Kassa balansi farq miqdoricha o&apos;zgaradi.
            </p>
            <label className="block text-[13px] font-medium mt-4" htmlFor="tx-amount">Miqdori</label>
            <MoneyInput
              id="tx-amount"
              value={amountDigits}
              onChange={setAmountDigits}
              autoFocus
              className="w-full h-10 mt-2 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <label className="block text-[13px] font-medium mt-3" htmlFor="tx-edit-reason">
              Sababi<span className="text-rose-500"> *</span>
            </label>
            <textarea
              id="tx-edit-reason"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              rows={3}
              placeholder="Nima uchun tahrirlanmoqda?"
              className="w-full mt-2 rounded-lg border border-border bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={() => setEditOpen(false)} disabled={saving} className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
                Bekor qilish
              </button>
              <button onClick={saveAmount} disabled={saving} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
                {saving ? "Saqlanmoqda…" : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !cancelling && setConfirmOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6">
            <p className="text-center text-[15px] font-semibold">Tranzaksiyani bekor qilmoqchimisiz?</p>
            <p className="text-center text-[13px] text-muted-foreground mt-1.5">Kassa balansi ham teskari o&apos;zgaradi.</p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={() => setConfirmOpen(false)} disabled={cancelling} className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
                Yo&apos;q
              </button>
              <button onClick={confirmCancel} disabled={cancelling} className="h-9 px-6 rounded-lg bg-rose-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
                {cancelling ? "Bekor qilinmoqda…" : "Ha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
