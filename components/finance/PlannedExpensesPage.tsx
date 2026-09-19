"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import PlannedExpenseDrawer from "./PlannedExpenseDrawer";
import type { PlannedExpense } from "@/lib/plannedExpenses";
import Modal from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// Moliya → Rejalashtirilgan xarajatlar (sidebar: Moliya > Rejalashtirilgan
// xarajatlar, href /finance-planned). "Qo'shish" — PlannedExpenseDrawer
// (o'ng panel), o'chirish — standart tasdiqlash oynasi. "Umumiy soni" —
// manba skrinshotida 1 ta yozuv "Nofaol" holatda bo'lgani holda 0 ko'rsatgan,
// shuning uchun bu shu yerda FAQAT "Faol" yozuvlar sonini hisoblaydi
// (jami qator sonini emas).
function fmtDate(s: string | null): string {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

export default function PlannedExpensesPage() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [expenses, setExpenses] = useState<PlannedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PlannedExpense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlannedExpense | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/planned-expenses")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setExpenses(d.expenses); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const activeCount = useMemo(() => expenses.filter((e) => e.status === "Faol").length, [expenses]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    const e = deleteTarget;
    setDeleting(true);
    try {
      const res = await fetch(`/api/planned-expenses/${e.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "O'chirilmadi"));
        setDeleting(false);
        return;
      }
      setExpenses((prev) => prev.filter((x) => x.id !== e.id));
      showSuccess(t("Xarajat o'chirildi"));
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-[18px] font-semibold">{t("Rejalashtirilgan xarajatlar")}</h1>
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
          {t("Qo'shish")}
        </button>
      </div>

      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex justify-end px-3 pt-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 text-xs">
            <span className="text-muted-foreground">{t("Umumiy soni:")}</span>
            <span className="font-bold tabular-nums">{activeCount}</span>
          </div>
        </div>
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Nomi")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Miqdori")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Turi")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Boshlanish sanasi")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Tugash sanasi")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Holati")}</th>
                <th className="px-3 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((e, i) => (
                <tr key={e.id} className="border-b border-border/50">
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{i + 1}</td>
                  <td className="px-3 py-3 text-[13px] font-medium">{e.name}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{e.amount.toLocaleString("ru-RU")}</td>
                  <td className="px-3 py-3 text-[13px]">{e.type || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{fmtDate(e.startDate)}</td>
                  <td className="px-3 py-3 text-[13px]">{fmtDate(e.endDate)}</td>
                  <td className="px-3 py-3 text-[13px]">{e.status || "—"}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => setEditTarget(e)} className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-primary" title={t("Tahrirlash")}>
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(e)} className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500" title={t("O'chirish")}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">{loading ? <SpinnerBlock size={22} /> : "Ma'lumot topilmadi"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <PlannedExpenseDrawer onClose={() => setAddOpen(false)} onSaved={(e) => setExpenses((prev) => [e, ...prev])} />
      )}
      {editTarget && (
        <PlannedExpenseDrawer expense={editTarget} onClose={() => setEditTarget(null)} onSaved={(e) => setExpenses((prev) => prev.map((x) => (x.id === e.id ? e : x)))} />
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
