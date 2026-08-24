"use client";

import { useState } from "react";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useToast } from "@/components/ui/Toast";
import { CUSTOM_FIELD_TYPES } from "@/constants/employees";
import EmployeeToggle from "./EmployeeToggle";

// "Yangi maydon qo'shish" — xodim qo'shish modalidagi "Maxsus maydon qo'shish"
// tugmasi bosilganda o'ng tomondan ochiladigan drawer (skrinshot 3).
//
// NIMA NOTO'G'RI EDI: drawer maydon turini, "majburiy" va "so'rovnomada
// ko'rinishi" toggle'larini yig'ardi, lekin `onSave` faqat NOMNI uzatardi —
// qolgani yo'qolardi. Pastdagi "O'chirish" tugmasi esa doim o'chiq turardi
// (yangi maydon yaratilayotganda o'chiradigan narsa yo'q), ya'ni yolg'on
// boshqaruv edi va olib tashlandi: mavjud maydon modaldagi ro'yxatidan
// o'chiriladi.
//
// "Tanlov (select)" turi variantlarsiz ma'nosiz — shu tur tanlanganda
// variantlar maydoni ochiladi (ilgari variant so'ralmasdi, ya'ni bunday
// maydonni yasab bo'lmasdi).
export interface CustomFieldDraft {
  name: string;
  type: string;
  required: boolean;
  inSurvey: boolean;
  options: string[];
}

export interface CustomFieldDrawerProps {
  onClose: () => void;
  onSave: (draft: CustomFieldDraft) => void;
  /** Sozlamalarga yozilayotgan payt — tugma bloklanadi. */
  saving?: boolean;
}

const SELECT_TYPE = "Tanlov (select)";

export default function CustomFieldDrawer({ onClose, onSave, saving = false }: CustomFieldDrawerProps) {
  useEscapeClose(onClose);
  const { showError } = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [required, setRequired] = useState(false);
  const [inSurvey, setInSurvey] = useState(false);
  const [optionsText, setOptionsText] = useState("");

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      showError("Maydon nomini kiriting");
      return;
    }
    if (!type) {
      showError("Maydon turini tanlang");
      return;
    }
    const options = type === SELECT_TYPE
      ? optionsText.split(",").map((o) => o.trim()).filter(Boolean)
      : [];
    if (type === SELECT_TYPE && options.length === 0) {
      showError("Tanlov variantlarini vergul bilan ajratib kiriting");
      return;
    }
    onSave({ name: trimmed, type, required, inSurvey, options });
  }

  return (
    <div className="fixed inset-0 z-[110]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-card border-l border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-[16px] font-semibold">Yangi maydon qo&apos;shish</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground">
            <svg className="icon icon-sm"><use href="#i-x-circle" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label className="block text-[13px] font-medium mb-1.5">Maydon nomi<span className="text-rose-500">*</span></label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium mb-1.5">Maydon turi<span className="text-rose-500">*</span></label>
            <div className="relative">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Maydon turi</option>
                {CUSTOM_FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
            </div>
          </div>
          {type === SELECT_TYPE && (
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Variantlar (vergul bilan)<span className="text-rose-500">*</span></label>
              <textarea
                rows={2}
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="Birinchi, Ikkinchi, Uchinchi"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}
          <div>
            <div className="text-[13px] font-medium mb-2">Majburiy maydon</div>
            <EmployeeToggle checked={required} onChange={setRequired} />
          </div>
          <div>
            <div className="text-[13px] font-medium mb-2">So&apos;rovnomada ko&apos;rinishi</div>
            <EmployeeToggle checked={inSurvey} onChange={setInSurvey} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
