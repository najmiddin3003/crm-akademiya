"use client";

import { useState } from "react";
import Modal, { useModalClose } from "@/components/ui/Modal";

// Ported 1:1 from crm-akademiya/index-dev.html's #tablarni-sozlash-modal
// (~line 2592) — opened by the "Ko'proq" tab button. Checkboxes are real
// local state; drag-to-reorder is visual only for now (matches the
// established scope-cut pattern used elsewhere on this page).

export interface TabMeta {
  key: string;
  label: string;
}

export default function TablarniSozlashModal({
  open,
  onClose,
  tabs,
}: {
  open: boolean;
  onClose: () => void;
  tabs: TabMeta[];
}) {
  const modal = useModalClose(onClose, "drawer");
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(tabs.map((t) => [t.key, true]))
  );

  if (!open) return null;

  const visibleCount = tabs.filter((t) => checked[t.key]).length;

  return (
    <Modal onClose={onClose} controller={modal} bare variant="drawer" zIndex={50} panelStyle={{ width: "94%", maxWidth: 720, maxHeight: "90vh" }}>
        <div className="px-6 pt-5 pb-3 flex items-start justify-between flex-shrink-0">
          <div>
            <h3 className="text-[18px] font-bold tracking-tight">Tablarni sozlash</h3>
            <p className="text-[13px] text-muted-foreground mt-0.5">Profil sahifasida tepada ko&apos;rinadigan bo&apos;limlarni tanlang va tartibini o&apos;zgartiring</p>
          </div>
          <button
            type="button"
            onClick={modal.close}
            className="h-8 w-8 rounded-md hover:bg-secondary/60 text-muted-foreground inline-flex items-center justify-center flex-shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-[13px] font-semibold mb-2">
                Ko&apos;rinadigan tablar
                <span className="inline-flex items-center h-5 px-1.5 rounded-md bg-primary/10 text-primary text-[11px] font-medium ml-1">{visibleCount}</span>
              </h4>
              <div className="space-y-1.5">
                {tabs.map((tab) => (
                  <div key={tab.key} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-move group">
                    <input
                      type="checkbox"
                      checked={checked[tab.key] ?? true}
                      onChange={() => setChecked((c) => ({ ...c, [tab.key]: !c[tab.key] }))}
                      className="rounded border-border text-primary"
                    />
                    <span className="text-[13px] flex-1">{tab.label}</span>
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
                      <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" />
                      <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
                      <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
                      <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" />
                      <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" />
                    </svg>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-[13px] font-semibold mb-2">
                Ko&apos;proq ichidagi bo&apos;limlar
                <span className="inline-flex items-center h-5 px-1.5 rounded-md bg-secondary/60 text-muted-foreground text-[11px] font-medium ml-1">{tabs.length - visibleCount}</span>
              </h4>
              <div className="rounded-lg border border-dashed border-border bg-secondary/10 py-12 text-center text-[12px] text-muted-foreground">
                Bu yerga sudrab tashlang
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-border flex-shrink-0">
          <button
            type="button"
            onClick={() => setChecked(Object.fromEntries(tabs.map((t) => [t.key, true])))}
            className="text-[13px] font-medium text-primary hover:underline"
          >
            Default holatga qaytarish
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={modal.close} className="inline-flex items-center h-10 px-5 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary/60">Orqaga</button>
            <button type="button" onClick={modal.close} className="inline-flex items-center h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90">Saqlash</button>
          </div>
        </div>
      </Modal>
  );
}
