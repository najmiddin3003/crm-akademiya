"use client";

import { useState } from "react";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// Ported from the real site's Shartnomalar tab: a table (the "Shartnoma turi"
// column really is duplicated on the live site — kept as-is to match) + a
// "Qo'shish" button that opens a right-side slide-over panel (not a centered
// modal, unlike the other tabs' add forms).

export default function ShartnomalarTabContent() {
  const { t } = useT();
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <span className="inline-flex items-center h-7 px-3 rounded-md bg-secondary/50 text-[12px] font-medium tabular-nums">{t("Umumiy soni: 0")}</span>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="inline-flex items-center h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90"
        >
          {t("Qo'shish")}
        </button>
      </div>
      <div className="table-box">
        <table className="w-full text-sm">
          <thead className="text-[12px] text-muted-foreground uppercase">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left font-medium">№</th>
              <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Shartnoma turi")}</th>
              <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Shartnoma turi")}</th>
              <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Yaratilgan sana")}</th>
              <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Yuklab olish")}</th>
            </tr>
          </thead>
        </table>
      </div>
      <div className="py-16 text-center">
        <svg viewBox="0 0 24 24" className="w-12 h-12 mx-auto text-muted-foreground/40 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M8 10h8M8 14h5" />
        </svg>
        <div className="text-[14px] font-medium">{t("Ma'lumotlar topilmadi")}</div>
        <div className="text-[12px] text-muted-foreground mt-0.5">{t("Ma'lumotlar topilmadi. Filterni o'zgartirib ko'ring.")}</div>
      </div>

      {panelOpen && (
        <Modal onClose={() => setPanelOpen(false)} bare variant="drawer" zIndex={50} panelStyle={{ width: "92%", maxWidth: 360 }}>{(modal) => (<>
            <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-shrink-0">
              <h3 className="text-[18px] font-bold tracking-tight">{t("Qo'shish")}</h3>
              <button
                type="button"
                onClick={modal.close}
                className="h-8 w-8 rounded-md hover:bg-secondary/60 text-muted-foreground inline-flex items-center justify-center"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="px-5 pb-4 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-[13px] font-medium mb-1.5">{t("Shartnoma turi")}</label>
                {/* Shartnoma turlari hali sozlanmagan — ro'yxat bo'sh stub. */}
                <Select value="" onChange={() => {}} options={[]} placeholder={t("Tanlang")} size="lg" emptyText={t("Shartnoma turi qo'shilmagan")} />
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1.5">{t("Fayl")}</label>
                <button type="button" className="h-20 w-20 rounded-lg border border-dashed border-border bg-secondary/20 hover:bg-secondary/30 inline-flex items-center justify-center text-muted-foreground">
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border flex-shrink-0">
              <button type="button" onClick={modal.close} className="inline-flex items-center h-10 px-5 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary/60">{t("Bekor qilish")}</button>
              <button type="button" onClick={modal.close} className="inline-flex items-center h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90">{t("Saqlash")}</button>
            </div>
          </>)}</Modal>
      )}
    </div>
  );
}
