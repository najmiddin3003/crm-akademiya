"use client";

import ReportTablePage from "@/components/reports/ReportTablePage";
import type { StudentDiscount } from "@/lib/studentReports";
import { useT } from "@/components/shared/Language";

// Hisobotlar → Umumiy chegirmalar (href /reports-discounts).
// Jadval ustida referensdagi ikkita jamlanma ko'rsatkich turadi.
const fmtUZS = (n: number) => n.toLocaleString("ru-RU") + " UZS";

export default function Page() {
  const { t } = useT();
  return (
    <ReportTablePage<StudentDiscount>
      kind="discounts"
      minWidth={1000}
      summary={(rows) => {
        const bonus = rows.reduce((s, r) => s + r.bonus, 0);
        const discount = rows.reduce((s, r) => s + r.totalDiscount, 0);
        return (
          <div className="flex items-center gap-8 flex-wrap">
            <div>
              <div className="text-[13px] text-muted-foreground">{t("Umumiy bonuslar:")}</div>
              <div className="text-[18px] font-semibold tabular-nums">{fmtUZS(bonus)}</div>
            </div>
            <div>
              <div className="text-[13px] text-muted-foreground">{t("Umumiy chegirmalar:")}</div>
              <div className="text-[18px] font-semibold tabular-nums">{fmtUZS(discount)}</div>
            </div>
          </div>
        );
      }}
      columns={[
        { key: "name", label: t("Ism"), render: (r) => <span className="font-medium">{r.studentName}</span> },
        { key: "course", label: t("Kurs"), render: (r) => r.course },
        { key: "group", label: t("Guruh"), render: (r) => r.group },
        { key: "discount", label: t("Umumiy olgan chegirmasi"), align: "right", render: (r) => fmtUZS(r.totalDiscount) },
        { key: "bonus", label: t("Bonus"), align: "right", render: (r) => fmtUZS(r.bonus) },
      ]}
    />
  );
}
