"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useBranches } from "@/hooks/useBranches";
import FeedbackFormModal from "./FeedbackFormModal";
import {
  FEEDBACK_FROM_OPTIONS,
  FEEDBACK_TYPES,
  formatFeedbackCreatedAt,
  type FeedbackRecord,
} from "./feedbackTypes";
import Select from "@/components/ui/Select";

// Nazorat > Fikr-mulohaza (sidebar: Nazorat > Fikr-mulohaza, /nazorat-feedback).
//
// ILGARI: sahifa `constants/feedback.js` dagi 8 ta QO'LDA YOZILGAN yozuvni
// ko'rsatardi — bazada `feedback` kolleksiyasi ham, API route ham yo'q edi,
// ya'ni jadval hech qachon haqiqiy fikr-mulohazani ko'rsatolmasdi.
// HOZIR: ma'lumot /api/feedback (MongoDB `feedback`) dan keladi, "Fikr
// qo'shish" tugmasi yangi yozuv yaratadi, bo'sh bo'lsa halol bo'sh holat
// ko'rinadi. Filial ro'yxati ham /api/branches dan (useBranches).

const FB_TYPE_COLORS: Record<string, string> = {
  Shikoyat: "text-rose-700 bg-rose-100",
  Taklif: "text-blue-700 bg-blue-100",
  Maqtov: "text-emerald-700 bg-emerald-100",
  Boshqa: "text-slate-700 bg-slate-100",
};

function typeColor(type: string): string {
  return FB_TYPE_COLORS[type] || "text-slate-700 bg-slate-100";
}

export default function NazoratFeedbackPage() {
  const { showSuccess } = useToast();
  const { branches } = useBranches();

  const [feedbacks, setFeedbacks] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filial, setFilial] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<FeedbackRecord | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/feedback")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setFeedbacks(d.feedbacks); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Filial tanlovi bazadagi filiallardan + yozuvlarda uchragan nomlardan
  // (filial keyinchalik o'chirilgan bo'lsa ham eski yozuv filtrlansin).
  const filialOptions = useMemo(() => {
    const set = new Set<string>(branches.map((b) => b.name));
    for (const f of feedbacks) if (f.filial) set.add(f.filial);
    return [...set].sort();
  }, [branches, feedbacks]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return feedbacks.filter((f) => {
      if (filial && f.filial !== filial) return false;
      if (type && f.type !== type) return false;
      if (from && f.from !== from) return false;
      if (q && !(f.name.toLowerCase().includes(q) || f.phone.includes(q) || f.izoh.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [feedbacks, search, filial, type, from]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  function onSaved(fb: FeedbackRecord) {
    setFeedbacks((prev) => [fb, ...prev]);
    setAdding(false);
    setPage(1);
    showSuccess("Fikr-mulohaza saqlandi");
  }

  return (
    <div className="page-frame container mx-auto max-w-[1700px] p-4 md:p-5 space-y-4">
      {/* Filtrlar/qidirish qatori */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-md min-w-[200px]">
          <svg className="icon icon-sm pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-search" /></svg>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            type="text"
            placeholder="Qidirish (ism, telefon, izoh)"
            className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <Select value={filial} onChange={(v) => { setFilial(v); setPage(1); }} options={filialOptions.map((f) => ({ value: f, label: f }))} placeholder="Filial — barchasi" clearable className="w-44" />
        <Select value={type} onChange={(v) => { setType(v); setPage(1); }} options={FEEDBACK_TYPES.map((t) => ({ value: t, label: t }))} placeholder="Turi — barchasi" clearable className="w-36" />
        <Select value={from} onChange={(v) => { setFrom(v); setPage(1); }} options={FEEDBACK_FROM_OPTIONS.map((o) => ({ value: o, label: o }))} placeholder="Kimdan" clearable className="w-36" />

        <button
          type="button"
          onClick={() => setAdding(true)}
          className="ml-auto inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <Plus className="icon icon-sm" />
          <span>Fikr qo&apos;shish</span>
        </button>
      </div>

      {/* Jadval */}
      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{filtered.length}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[1200px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">Filial</th>
                <th className="px-5 py-3 text-left">Kimdan</th>
                <th className="px-5 py-3 text-left">Ism</th>
                <th className="px-5 py-3 text-left">Telefon raqam</th>
                <th className="px-5 py-3 text-left">Turi</th>
                <th className="px-5 py-3 text-left">Izoh</th>
                <th className="px-5 py-3 text-left pr-5">Yaratilgan sanasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((f, i) => (
                <tr key={f.id} onClick={() => setSelected(f)} className="hover:bg-secondary/30 transition-colors cursor-pointer">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  <td className="px-5 py-3 text-[13px]">{f.filial || "—"}</td>
                  <td className="px-5 py-3 text-[13px]">{f.from || "—"}</td>
                  <td className="px-5 py-3 font-medium">{f.name || "—"}</td>
                  <td className="px-5 py-3 tabular-nums text-[13px]">{f.phone || "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${typeColor(f.type)}`}>{f.type}</span>
                  </td>
                  <td className="px-5 py-3 text-[13px] max-w-xs truncate">{f.izoh}</td>
                  <td className="px-5 py-3 pr-5 tabular-nums text-[12px] text-muted-foreground">{formatFeedbackCreatedAt(f.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {slice.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="h-16 w-16 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
              <svg className="icon" style={{ width: 32, height: 32, opacity: 0.45 }}><use href="#i-archive" /></svg>
            </div>
            <h3 className="text-[15px] font-semibold mb-1">
              {loading ? <Spinner size={22} /> : "Ma'lumotlar topilmadi"}
            </h3>
            {!loading && (
              <p className="text-[13px] text-muted-foreground max-w-sm">
                {feedbacks.length === 0
                  ? "Hozircha fikr-mulohaza yo'q. «Fikr qo'shish» orqali birinchisini qo'shing."
                  : "Ma'lumotlar topilmadi. Filterni o'zgartirib ko'ring."}
              </p>
            )}
          </div>
        )}

        <Pagination
          totalItems={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      {adding && <FeedbackFormModal onClose={() => setAdding(false)} onSaved={onSaved} />}

      {/* Tafsilot modali */}
      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="text-[15px] font-semibold">Fikr-mulohaza tafsilotlari</h3>
              <button type="button" onClick={() => setSelected(null)} className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center">
                <X className="icon icon-sm" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${typeColor(selected.type)}`}>{selected.type}</span>
                <span className="text-[12px] text-muted-foreground tabular-nums">{formatFeedbackCreatedAt(selected.createdAt)}</span>
              </div>
              <div className="space-y-2 pt-2">
                <div className="grid grid-cols-3 gap-2 text-[13px]">
                  <div className="text-muted-foreground">Filial:</div>
                  <div className="col-span-2 font-medium">{selected.filial || "—"}</div>
                  <div className="text-muted-foreground">Kimdan:</div>
                  <div className="col-span-2 font-medium">{selected.from || "—"}</div>
                  <div className="text-muted-foreground">Ism:</div>
                  <div className="col-span-2 font-medium">{selected.name || "—"}</div>
                  <div className="text-muted-foreground">Telefon:</div>
                  <div className="col-span-2 font-medium tabular-nums">{selected.phone || "—"}</div>
                </div>
                <div className="pt-2">
                  <div className="text-muted-foreground text-[13px] mb-1">Izoh:</div>
                  <div className="rounded-lg bg-secondary/30 p-3 text-[13px] leading-relaxed">{selected.izoh}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
