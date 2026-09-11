"use client";

import { useState } from "react";
import { XCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useModerators } from "@/hooks/useModerators";
import { PUPIL_STATUSES } from "@/lib/pupilsData";
import { EMPTY_PARENTS_FILTERS, PARENT_KINDS, type ParentsFilters } from "@/lib/parentsData";
import Select from "@/components/ui/Select";
import DateField from "@/components/ui/DateField";

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
          <Select value={draft.kind} onChange={(v) => set("kind", v)} options={PARENT_KINDS.map((k) => ({ value: k, label: k }))} placeholder="Qarindoshligi" clearable />

          <Select value={draft.moderator} onChange={(v) => set("moderator", v)} options={moderatorNames.map((m) => ({ value: m, label: m }))} placeholder="Moderator" clearable />

          <Select value={draft.category} onChange={(v) => set("category", v)} options={categoryOptions.map((c) => ({ value: c, label: c }))} placeholder="Kategoriya" clearable />

          <Select value={draft.status} onChange={(v) => set("status", v)} options={PUPIL_STATUSES.map((s) => ({ value: s, label: s }))} placeholder="O'quvchi holati" clearable />

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
            <DateField value={draft.birthFrom} onChange={(v) => set("birthFrom", v)} variant="form" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Tug&apos;ilgan (gacha)</span>
            <DateField value={draft.birthTo} onChange={(v) => set("birthTo", v)} variant="form" />
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
