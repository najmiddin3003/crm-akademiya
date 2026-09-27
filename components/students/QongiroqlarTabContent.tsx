"use client";
import { useT } from "@/components/shared/Language";

// Ported from crm-akademiya/src/app.js renderStudentEditQongiroqlar() (~line 34572)
// + studentEditEmptyState() (~line 34504).

export default function QongiroqlarTabContent() {
  const { t } = useT();
  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="flex justify-end p-3 border-b border-border">
        <span className="inline-flex items-center h-7 px-3 rounded-md bg-secondary/50 text-[12px] font-medium tabular-nums">{t("Umumiy soni: 0")}</span>
      </div>
      <div className="table-box">
        <table className="w-full text-sm">
          <thead className="text-[12px] text-muted-foreground uppercase">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left font-medium">№</th>
              <th className="px-4 py-3 text-left font-medium">{t("Sana")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Turi")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Xodim")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Davomiyl...")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Audio")}</th>
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
