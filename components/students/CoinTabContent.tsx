"use client";
import { useT } from "@/components/shared/Language";

// Ported from the real site's Coin tarixi tab (wider than the reference
// crm-akademiya/src/app.js renderStudentEditCoin() placeholder — that one
// only had 5 columns; the live site has 9).

export default function CoinTabContent() {
  const { t } = useT();
  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="flex justify-end p-3 border-b border-border">
        <span className="inline-flex items-center h-7 px-3 rounded-md bg-secondary/50 text-[12px] font-medium tabular-nums">{t("Umumiy soni: 0")}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[12px] text-muted-foreground uppercase">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left font-medium">№</th>
              <th className="px-4 py-3 text-left font-medium">{t("Kim tomonidan")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Turi")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Miqdori")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Avvalgi balans")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Yangi balans")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Yaratildi")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Sababi")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Izoh")}</th>
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
    </div>
  );
}
