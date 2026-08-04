"use client";

import { useState } from "react";
import { Calendar, XCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import { useEscapeClose } from "@/hooks/useEscapeClose";

// crm-akademiya #pr-filter-modal (index-dev.html 2448-2490) — 10 ta select/
// tugma + 2 ta sana input, grid-cols-3. Manbada applyPrFilters() hech narsani
// filtrlamaydi (faqat modalni yopib toast chiqaradi) — bu yerda ham faqat
// Moderator maydoni haqiqiy ma'lumotga ega bo'lgani uchun ishlaydi, qolganlari
// (Balans oralig'i/Kurs/Subkurs/O'qituvchi/Kategoriya/Ranglar bo'yicha/Holati/
// Ilova holati/Oraliqni tanlang) manbada ham hech qachon variant/mantiq bilan
// ulanmagan — shu holicha faqat vizual saqlandi.

export interface ParentsFilters {
  moderator: string;
  olderDate: string;
  youngerDate: string;
}
export const EMPTY_PARENTS_FILTERS: ParentsFilters = { moderator: "", olderDate: "", youngerDate: "" };

const MODERATORS = ["Dilmurod Komilov", "Nilufar Sharipova"];
const selectCls = "filter-select h-10 w-full appearance-none rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export interface ParentsFilterModalProps {
  initialFilters: ParentsFilters;
  onClose: () => void;
  onApply: (filters: ParentsFilters) => void;
}

export default function ParentsFilterModal({ initialFilters, onClose, onApply }: ParentsFilterModalProps) {
  const [draft, setDraft] = useState<ParentsFilters>(initialFilters);
  useEscapeClose(onClose);

  function set<K extends keyof ParentsFilters>(key: K, value: ParentsFilters[K]) {
    setDraft((f) => ({ ...f, [key]: value }));
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 overflow-auto"
      style={{ background: "rgba(15,23,42,.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div
        className="modal-window w-full max-w-3xl rounded-2xl bg-card border border-border shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold tracking-tight">Filter</h3>
          <button
            onClick={() => setDraft(EMPTY_PARENTS_FILTERS)}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs"
          >
            <XCircle className="icon icon-xs" />
            <span>Tozalash</span>
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
          <button type="button" className="h-10 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm text-left flex items-center gap-2">
            <Calendar className="icon icon-sm text-muted-foreground" />
            <span className="text-muted-foreground">Oraliqni tanlang</span>
          </button>
          <select className={selectCls} defaultValue="">
            <option value="">Balans oralig&apos;i</option>
          </select>
          <select className={selectCls} defaultValue="">
            <option value="">Kurs</option>
          </select>
          <select className={selectCls} defaultValue="">
            <option value="">Subkurs</option>
          </select>
          <select className={selectCls} defaultValue="">
            <option value="">O&apos;qituvchi</option>
          </select>
          <select className={selectCls} value={draft.moderator} onChange={(e) => set("moderator", e.target.value)}>
            <option value="">Moderator</option>
            {MODERATORS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className={selectCls} defaultValue="">
            <option value="">Kategoriya</option>
          </select>
          <select className={selectCls} defaultValue="">
            <option value="">Ranglar bo&apos;yicha</option>
          </select>
          <select className={selectCls} defaultValue="">
            <option value="">Holati</option>
          </select>
          <select className={selectCls} defaultValue="">
            <option value="">Ilova holati</option>
          </select>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Katta yosh</span>
            <input
              type="date"
              value={draft.olderDate}
              onChange={(e) => set("olderDate", e.target.value)}
              className="modal-input date-input flex-1 h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Kichik yosh</span>
            <input
              type="date"
              value={draft.youngerDate}
              onChange={(e) => set("youngerDate", e.target.value)}
              className="modal-input date-input flex-1 h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Orqaga</Button>
          <Button variant="primary" onClick={() => onApply(draft)}>Saqlash</Button>
        </div>
      </div>
    </div>
  );
}
