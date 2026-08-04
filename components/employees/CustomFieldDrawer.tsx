"use client";

import { useState } from "react";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { CUSTOM_FIELD_TYPES } from "@/constants/employees";
import EmployeeToggle from "./EmployeeToggle";

// "Yangi maydon qo'shish" — xodim qo'shish modalidagi "Maxsus maydon qo'shish"
// tugmasi bosilganda o'ng tomondan ochiladigan drawer (skrinshot 3). Demo:
// Saqlash bosilganda maydon nomini yuqoriga qaytaradi va yopiladi.
export interface CustomFieldDrawerProps {
  onClose: () => void;
  onSave: (name: string) => void;
}

export default function CustomFieldDrawer({ onClose, onSave }: CustomFieldDrawerProps) {
  useEscapeClose(onClose);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [required, setRequired] = useState(false);
  const [inSurvey, setInSurvey] = useState(false);

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
            <label className="block text-[13px] font-medium mb-1.5">Maydon nomi</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium mb-1.5">Maydon turi</label>
            <div className="relative">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Maydon turi</option>
                {CUSTOM_FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
            </div>
          </div>
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
            disabled
            className="h-10 px-5 rounded-lg border border-border bg-card text-sm font-medium text-muted-foreground opacity-50 cursor-not-allowed"
          >
            O&apos;chirish
          </button>
          <button
            type="button"
            onClick={() => onSave(name.trim())}
            className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90"
          >
            Saqlash
          </button>
        </div>
      </div>
    </div>
  );
}
