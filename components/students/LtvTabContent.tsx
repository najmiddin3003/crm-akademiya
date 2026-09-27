"use client";
import { useT } from "@/components/shared/Language";

// Ported from the real site's LTV tab: a "Jami" totals row followed by a bare
// "Ma'lumotlar topilmadi" line (no icon/subtitle here, unlike the other empty
// states in this page — matches the screenshot).

export default function LtvTabContent() {
  const { t } = useT();
  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="table-box">
        <table className="w-full text-sm">
          <thead className="text-[12px] text-muted-foreground uppercase">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left font-medium">№</th>
              <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Guruh nomi")}</th>
              <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Guruhda o'qigan davri")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Holati")}</th>
              <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Umumiy to'lashi kerak bo'lgan summa")}</th>
              <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Umumiy to'lagan summa")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Qarz")}</th>
              <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("O'qituvchi uchun ajratilgan summa")}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="px-4 py-3 text-[13px] font-medium" colSpan={4}>{t("Jami")}</td>
              <td className="px-4 py-3 text-[13px] tabular-nums">{t("0 UZS")}</td>
              <td className="px-4 py-3 text-[13px] tabular-nums">{t("0 UZS")}</td>
              <td className="px-4 py-3 text-[13px] tabular-nums">{t("0 UZS")}</td>
              <td className="px-4 py-3 text-[13px] tabular-nums">{t("0 UZS")}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="py-10 text-center text-[13px] text-muted-foreground">
        {t("Ma'lumotlar topilmadi")}
      </div>
    </div>
  );
}
