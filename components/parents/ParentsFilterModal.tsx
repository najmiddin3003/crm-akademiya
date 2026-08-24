"use client";

import { useState } from "react";
import { XCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useModerators } from "@/hooks/useModerators";
import { PUPIL_STATUSES } from "@/lib/pupilsData";
import { EMPTY_PARENTS_FILTERS, PARENT_KINDS, type ParentsFilters } from "@/lib/parentsData";

// Ota-ona sahifasining filtr modali.
//
// ILGARI: bu yerda 10 ta <select> va 2 ta sana maydoni bor edi, lekin faqat
// "Moderator" haqiqatan filtrlardi. Qolganlari (Balans oralig'i / Kurs /
// Subkurs / O'qituvchi / Kategoriya / Ranglar bo'yicha / Holati / Ilova
// holati / "Oraliqni tanlang") bo'sh variantli, hech qayerga ulanmagan
// bezak edi — bosilsa ham ro'yxat o'zgarmasdi.
//
// ENDI: har bir maydon HAQIQIY pupils maydoniga ulangan va rostdan ham
// filtrlaydi. Manbasi bo'lmagan tanlovlar (Ranglar bo'yicha, Ilova holati)
// OLIB TASHLANDI — ishlamaydigan boshqaruv qoldirilmaydi. Kurs / Subkurs /
// O'qituvchi ham olib tashlandi: ular o'quvchining o'zida emas, u a'zo
// bo'lgan GURUHda saqlanadi va bu sahifada bunday ustun ko'rinmaydi —
// ko'rinmaydigan ustun bo'yicha filtr chalg'itadi.

const selectCls = "filter-select h-10 w-full appearance-none rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const inputCls = "modal-input h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export interface ParentsFilterModalProps {
  initialFilters: ParentsFilters;
  /** Bazadagi o'quvchilarda HAQIQATDA uchraydigan kategoriyalar. */
  categoryOptions: string[];
  onClose: () => void;
  onApply: (filters: ParentsFilters) => void;
}

export default function ParentsFilterModal({ initialFilters, categoryOptions, onClose, onApply }: ParentsFilterModalProps) {
  const { names: moderatorNames } = useModerators();
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
          <select className={selectCls} value={draft.kind} onChange={(e) => set("kind", e.target.value)}>
            <option value="">Qarindoshligi</option>
            {PARENT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>

          <select className={selectCls} value={draft.moderator} onChange={(e) => set("moderator", e.target.value)}>
            <option value="">Moderator</option>
            {moderatorNames.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>

          <select className={selectCls} value={draft.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">Kategoriya</option>
            {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select className={selectCls} value={draft.status} onChange={(e) => set("status", e.target.value)}>
            <option value="">O&apos;quvchi holati</option>
            {PUPIL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Balans (dan)</span>
            <input
              type="number"
              value={draft.balanceFrom}
              onChange={(e) => set("balanceFrom", e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Balans (gacha)</span>
            <input
              type="number"
              value={draft.balanceTo}
              onChange={(e) => set("balanceTo", e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Ilgari bu ikki sana "Katta yosh" / "Kichik yosh" deb nomlanardi va
              hech narsa qilmasdi. Endi ular farzandning HAQIQIY tug'ilgan
              sanasi (pupils.birthDate) bo'yicha oraliq — nomi ham shunga mos. */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Tug&apos;ilgan (dan)</span>
            <input
              type="date"
              value={draft.birthFrom}
              onChange={(e) => set("birthFrom", e.target.value)}
              className={`${inputCls} date-input`}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Tug&apos;ilgan (gacha)</span>
            <input
              type="date"
              value={draft.birthTo}
              onChange={(e) => set("birthTo", e.target.value)}
              className={`${inputCls} date-input`}
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
