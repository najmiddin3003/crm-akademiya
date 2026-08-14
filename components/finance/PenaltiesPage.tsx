"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { PENALTY_CANCEL_REASONS } from "@/constants/penalties";
import PenaltyDrawer from "./PenaltyDrawer";
import type { Penalty } from "@/lib/penalties";

// Moliya → Jarima (sidebar: Moliya > Jarima, href /finance-penalty).
// Ma'lumot /api/penalties dan. "Jarima qo'shish" — PenaltyDrawer. Chapdagi
// trash ikonkasi O'CHIRMAYDI — "bekor qilish": Sababi tanlab "Ha" bosilsa
// yozuv PATCH bilan status="cancelled" qilinadi, jadvalda qoladi (foydalanuvchi
// aniq talabi). Bekor qilingan qatorda amal tugmasi endi ko'rinmaydi.
export default function PenaltiesPage() {
  const { showSuccess, showError } = useToast();
  const [rows, setRows] = useState<Penalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Penalty | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const start = (page - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/penalties")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setRows(d.penalties); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function openCancel(p: Penalty) {
    setCancelReason("");
    setCancelTarget(p);
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    const p = cancelTarget;
    setCancelling(true);
    try {
      const res = await fetch(`/api/penalties/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Bekor qilinmadi");
        setCancelling(false);
        return;
      }
      setRows((prev) => prev.map((x) => (x.id === p.id ? (data.penalty as Penalty) : x)));
      showSuccess("Jarima bekor qilindi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  }

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
          <span>+ Jarima qo&apos;shish</span>
        </button>
      </div>

      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex justify-end px-3 pt-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 text-xs">
            <span className="text-muted-foreground">Umumiy soni:</span>
            <span className="font-bold tabular-nums">{rows.length}</span>
          </div>
        </div>
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">To&apos;liq ismi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Oldingi miqdor</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Miqdori</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Keyingi miqdor</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Izoh</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Sababi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Holati</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Yaratilgan sanasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Rasm</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Harakatlar</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((p, i) => (
                <tr key={p.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  <td className="px-3 py-3 text-[13px] font-medium">{p.recipientName}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{p.before.toLocaleString("ru-RU")}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums font-semibold">{p.amount.toLocaleString("ru-RU")}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{p.after.toLocaleString("ru-RU")}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{p.note || "—"}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{p.reason || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{p.status || "—"}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground tabular-nums whitespace-nowrap">{p.createdAt}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{p.image || "-"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {p.status !== "cancelled" && (
                      <button onClick={() => openCancel(p)} className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500" title="Bekor qilish">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-sm text-muted-foreground">{loading ? "Yuklanmoqda…" : "Jarima topilmadi"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      </div>

      {addOpen && (
        <PenaltyDrawer onClose={() => setAddOpen(false)} onSaved={(p) => setRows((prev) => [p, ...prev])} />
      )}
      {cancelTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !cancelling && setCancelTarget(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
            <p className="text-center text-[15px] font-semibold">Rostdan ham bekor qilmoqchimisiz?</p>
            <div className="relative">
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Sababi</option>
                {PENALTY_CANCEL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <svg className="icon icon-xs pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setCancelTarget(null)} disabled={cancelling} className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
                Yo&apos;q
              </button>
              <button onClick={confirmCancel} disabled={cancelling} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
                {cancelling ? "Bekor qilinmoqda…" : "Ha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
