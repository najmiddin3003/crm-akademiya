"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { FEEDBACKS, FB_TYPE_COLORS, FB_FILIALS, FB_TYPES, FB_FROM_OPTIONS } from "@/constants/feedback";
import type { Feedback } from "@/lib/feedback";

// Nazorat > Fikr-mulohaza (crm-akademiya #view-nazorat-feedback,
// app.js renderFeedback()/openFbModal() ~line 28568). Sidebar: Nazorat >
// Fikr-mulohaza, href /nazorat-feedback.

function typeColor(type: string): string {
  return (FB_TYPE_COLORS as Record<string, string>)[type] || "text-slate-700 bg-slate-100";
}

export default function NazoratFeedbackPage() {
  const [search, setSearch] = useState("");
  const [filial, setFilial] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<Feedback | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (FEEDBACKS as Feedback[]).filter((f) => {
      if (filial && f.filial !== filial) return false;
      if (type && f.type !== type) return false;
      if (from && f.from !== from) return false;
      if (q && !(f.name.toLowerCase().includes(q) || f.phone.includes(q) || f.izoh.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [search, filial, type, from]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  return (
    <div className="container mx-auto max-w-[1700px] p-4 md:p-5 space-y-4">
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
        <div className="relative">
          <select value={filial} onChange={(e) => { setFilial(e.target.value); setPage(1); }} className="h-10 w-44 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="">Filial — barchasi</option>
            {FB_FILIALS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
        <div className="relative">
          <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="h-10 w-36 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="">Turi — barchasi</option>
            {FB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
        <div className="relative">
          <select value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-10 w-36 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="">Kimdan</option>
            {FB_FROM_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
      </div>

      {/* Jadval */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{filtered.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1200px]">
            <thead className="bg-secondary/20">
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
                  <td className="px-5 py-3 text-[13px]">{f.filial}</td>
                  <td className="px-5 py-3 text-[13px]">{f.from}</td>
                  <td className="px-5 py-3 font-medium">{f.name}</td>
                  <td className="px-5 py-3 tabular-nums text-[13px]">{f.phone}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${typeColor(f.type)}`}>{f.type}</span>
                  </td>
                  <td className="px-5 py-3 text-[13px] max-w-xs truncate">{f.izoh}</td>
                  <td className="px-5 py-3 pr-5 tabular-nums text-[12px] text-muted-foreground">{f.createdAt}</td>
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
            <h3 className="text-[15px] font-semibold mb-1">Ma&apos;lumotlar topilmadi</h3>
            <p className="text-[13px] text-muted-foreground max-w-sm">Ma&apos;lumotlar topilmadi. Filterni o&apos;zgartirib ko&apos;ring.</p>
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
                <span className="text-[12px] text-muted-foreground tabular-nums">{selected.createdAt}</span>
              </div>
              <div className="space-y-2 pt-2">
                <div className="grid grid-cols-3 gap-2 text-[13px]">
                  <div className="text-muted-foreground">Filial:</div>
                  <div className="col-span-2 font-medium">{selected.filial}</div>
                  <div className="text-muted-foreground">Kimdan:</div>
                  <div className="col-span-2 font-medium">{selected.from}</div>
                  <div className="text-muted-foreground">Ism:</div>
                  <div className="col-span-2 font-medium">{selected.name}</div>
                  <div className="text-muted-foreground">Telefon:</div>
                  <div className="col-span-2 font-medium tabular-nums">{selected.phone}</div>
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
