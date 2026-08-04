"use client";

import { useState } from "react";

// Ported from crm-akademiya/src/app.js renderStudentEditVazifa() + openTopshiriqModal()
// (~line 34629, ~line 2592 index-dev.html for the modal markup). The status
// picker is a custom dropdown (2 options, checkmark) matching the real site's
// screenshot instead of the source's plain 3-option <select>.

const STATUS_OPTIONS = [
  { key: "jarayonda", label: "Jarayonda" },
  { key: "tugatilgan", label: "Tugatilgan" },
];

export default function VazifaTabContent() {
  const [status, setStatus] = useState("jarayonda");
  const [statusOpen, setStatusOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const statusLabel = STATUS_OPTIONS.find((s) => s.key === status)?.label ?? "";

  return (
    <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
      <div className="text-center">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 text-[14px] font-semibold text-primary hover:underline"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Eslatma qo&apos;shish
        </button>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setStatusOpen((v) => !v)}
          className="w-full h-11 px-3 pr-10 rounded-lg border border-border bg-secondary/30 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {statusLabel}
        </button>
        <svg
          onClick={() => setStatusOpen((v) => !v)}
          className="icon icon-sm absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground cursor-pointer"
        >
          <use href="#i-chevron-down" />
        </svg>

        {statusOpen && (
          <div className="absolute left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg z-10 overflow-hidden">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  setStatus(s.key);
                  setStatusOpen(false);
                }}
                className="flex items-center justify-between w-full text-left px-4 py-2.5 text-sm hover:bg-secondary/40"
              >
                <span className={s.key === status ? "text-primary font-medium" : ""}>{s.label}</span>
                {s.key === status && (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-secondary/20 border border-border py-8 text-center text-[14px] text-muted-foreground">
        Eslatmalar yo&apos;q
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <h3 className="text-[18px] font-bold tracking-tight">Topshiriq</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-8 w-8 rounded-md hover:bg-secondary/60 text-muted-foreground inline-flex items-center justify-center"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="px-5 pb-4 space-y-3">
              <div className="relative">
                <select className="w-full h-11 px-3 pr-10 rounded-lg border border-border bg-secondary/30 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Moderator</option>
                </select>
                <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
              </div>
              <div className="relative">
                <select className="w-full h-11 px-3 pr-10 rounded-lg border border-border bg-secondary/30 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">Topshiriq turi</option>
                </select>
                <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
              </div>
              <div className="relative">
                <input type="text" placeholder="ДД.ММ.ГГГГ" className="w-full h-11 px-3 pr-10 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-calendar" /></svg>
              </div>
              <div className="relative">
                <input type="text" placeholder="HH:mm" className="w-full h-11 px-3 pr-10 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <textarea placeholder="Vazifani yozing..." rows={3} className="w-full px-3 py-2 rounded-lg border border-border bg-secondary/30 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button type="button" onClick={() => setModalOpen(false)} className="inline-flex items-center h-10 px-5 text-sm font-medium text-foreground/70 hover:text-foreground">Orqaga</button>
              <button type="button" onClick={() => setModalOpen(false)} className="inline-flex items-center h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90">Saqlash</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
