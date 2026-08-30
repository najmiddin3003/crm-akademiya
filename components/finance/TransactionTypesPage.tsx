"use client";

import { invalidateTransactionTypes } from "@/hooks/useTransactionTypes";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { MAIN_TYPES } from "@/constants/transactionTypes";
import type { TransactionType } from "@/lib/transactionTypes";

// Moliya → Tranzaksiya turi (sidebar: Moliya > Tranzaksiya turi, href
// /finance-tx-types). Loyihaning boshqa Moliya sahifalarida (Bonus/Jarima/
// Kirim-chiqim/Moliya analitikasi) ishlatilgan kategoriyalarning administrativ
// ro'yxati — 4 tab (Kirim/Chiqim/Voucher/Jarima). Qo'shish/tahrirlash —
// alohida sahifa (/finance-tx-types/add, /[id]/edit), o'chirish — standart
// tasdiqlash oynasi.

const TAB_ACTIVE_CLS: Record<string, string> = {
  kirim: "bg-emerald-100 text-emerald-700",
  chiqim: "bg-rose-100 text-rose-700",
  voucher: "bg-blue-100 text-blue-700",
  jarima: "bg-blue-100 text-blue-700",
};

export default function TransactionTypesPage() {
  const { showSuccess, showError } = useToast();
  const [types, setTypes] = useState<TransactionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(MAIN_TYPES[0].key);
  const [deleteTarget, setDeleteTarget] = useState<TransactionType | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/transaction-types")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setTypes(d.types); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => types.filter((t) => t.mainType === tab), [types, tab]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    const t = deleteTarget;
    setDeleting(true);
    try {
      const res = await fetch(`/api/transaction-types/${t.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "O'chirilmadi");
        setDeleting(false);
        return;
      }
      invalidateTransactionTypes();
      setTypes((prev) => prev.filter((x) => x.id !== t.id));
      showSuccess("Tranzaksiya turi o'chirildi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-[18px] font-semibold">Tranzaksiya turi</h1>
        <Link href={`/finance-tx-types/add?type=${tab}`} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
          + Tranzaksiya turini qo&apos;shish
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {MAIN_TYPES.map((m) => (
          <button
            key={m.key}
            onClick={() => setTab(m.key)}
            className={`h-8 px-3.5 rounded-full text-[13px] font-medium ${tab === m.key ? TAB_ACTIVE_CLS[m.key] : "bg-secondary/60 text-muted-foreground hover:bg-secondary"}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="pl-6 border-l-2 border-dashed border-border ml-6 my-3">
          {visible.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 py-3 border-b border-border/50 last:border-b-0 pl-4 -ml-4 relative">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-4 border-t-2 border-dashed border-border" style={{ marginLeft: -16 }} />
              <span className="text-[13px] font-medium">{t.name}</span>
              <div className="flex items-center gap-4 ml-auto">
                <span className="text-[13px] text-muted-foreground w-20 text-right">{t.category}</span>
                <div className="inline-flex items-center gap-1">
                  <Link href={`/finance-tx-types/${t.id}/edit`} className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-primary" title="Tahrirlash">
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button onClick={() => setDeleteTarget(t)} className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500" title="O'chirish">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {visible.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground -ml-4">{loading ? <SpinnerBlock size={22} /> : "Tranzaksiya turi topilmadi"}</div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6">
            <p className="text-center text-[15px] font-semibold">Rostdan ham o&apos;chirmoqchimisiz?</p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
                Yo&apos;q
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
                {deleting ? "O'chirilmoqda…" : "Ha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
