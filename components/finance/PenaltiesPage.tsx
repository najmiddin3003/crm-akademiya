"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { PENALTY_CANCEL_REASONS } from "@/constants/penalties";
import PenaltyDrawer from "./PenaltyDrawer";
import type { Penalty } from "@/lib/penalties";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";

// Moliya → Jarima (sidebar: Moliya > Jarima, href /finance-penalty).
// Ma'lumot /api/penalties dan. "Jarima qo'shish" — PenaltyDrawer. Chapdagi
// trash ikonkasi O'CHIRMAYDI — "bekor qilish": Sababi tanlab "Ha" bosilsa
// yozuv PATCH bilan status="cancelled" qilinadi, jadvalda qoladi (foydalanuvchi
// aniq talabi). Bekor qilingan qatorda amal tugmasi endi ko'rinmaydi.

// /api/penalties qaytaradigan qatorning ANIQ shakli.
//
// NIMA O'ZGARDI: "Oldingi/Keyingi miqdor" ilgari `pupils.balance` dan
// (hech qachon yangilanmaydigan maydon) yoki xodim uchun 0 dan kelardi —
// ya'ni jadvalda o'ylab topilgan son odamning balansi deb ko'rsatilardi.
// Endi o'quvchi uchun haqiqiy to'lovlar yig'indisi, manba bo'lmaganda esa
// `null` keladi. lib/penalties.ts (bu guruh egaligida emas) ularni hali
// `number` deb e'lon qiladi — shu bois tur shu yerda kengaytiriladi.
type PenaltyRow = Omit<Penalty, "before" | "after"> & {
  before: number | null;
  after: number | null;
};

export default function PenaltiesPage() {
  const { showSuccess, showError } = useToast();
  const [rows, setRows] = useState<PenaltyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<PenaltyRow | null>(null);
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

  function openCancel(p: PenaltyRow) {
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
      setRows((prev) => prev.map((x) => (x.id === p.id ? (data.penalty as PenaltyRow) : x)));
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
                  {/* Manbasi yo'q balans "—", 0 emas: 0 "balansi nol" degan
                      faktik da'vo bo'lardi. */}
                  <td className="px-3 py-3 text-[13px] tabular-nums">{p.before == null ? "—" : p.before.toLocaleString("ru-RU")}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums font-semibold">{p.amount.toLocaleString("ru-RU")}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{p.after == null ? "—" : p.after.toLocaleString("ru-RU")}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{p.note || "—"}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{p.reason || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{p.status || "—"}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground tabular-nums whitespace-nowrap">{p.createdAt}</td>
                  {/* `image` endi Cloudinary URL (PenaltyDrawer haqiqatan
                      yuklaydi) — ochib ko'rish mumkin. Eski yozuvlarda faqat
                      fayl NOMI turishi mumkin, u havola emas: shuning uchun
                      "http" bilan boshlanmaganini oddiy matn qilib qoldiramiz. */}
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">
                    {p.image
                      ? (p.image.startsWith("http")
                          ? <a href={p.image} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Ko&apos;rish</a>
                          : p.image)
                      : "—"}
                  </td>
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
                  <td colSpan={11} className="px-3 py-10 text-center text-sm text-muted-foreground">{loading ? <SpinnerBlock size={22} /> : "Jarima topilmadi"}</td>
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
        <Modal onClose={() => setCancelTarget(null)} locked={cancelling} bare size="sm" zIndex={110} panelClassName="p-6 space-y-4">{(modal) => (<>
            <p className="text-center text-[15px] font-semibold">Rostdan ham bekor qilmoqchimisiz?</p>
            <Select value={cancelReason} onChange={(v) => setCancelReason(v)} options={PENALTY_CANCEL_REASONS.map((r) => ({ value: r, label: r }))} placeholder="Sababi" clearable />
            <div className="flex items-center justify-center gap-2">
              <button onClick={modal.close} disabled={cancelling} className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
                Yo&apos;q
              </button>
              <button onClick={confirmCancel} disabled={cancelling} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
                {cancelling ? "Bekor qilinmoqda…" : "Ha"}
              </button>
            </div>
          </>)}</Modal>
      )}
    </div>
  );
}
