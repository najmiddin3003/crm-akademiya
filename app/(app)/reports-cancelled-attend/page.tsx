"use client";

import ReportTablePage from "@/components/reports/ReportTablePage";
import type { CancelledAttendance } from "@/lib/studentReports";
import { useT } from "@/components/shared/Language";

// Hisobotlar → Davomati bekor qilinganlar analitikasi
// (href /reports-cancelled-attend).
const fmtUZS = (n: number) => n.toLocaleString("ru-RU") + " UZS";

export default function Page() {
  const { t } = useT();
  return (
    <ReportTablePage<CancelledAttendance>
      kind="cancelled-attendance"
      minWidth={1000}
      columns={[
        { key: "name", label: t("O'quvchi"), render: (r) => <span className="font-medium">{r.studentName}</span> },
        { key: "amount", label: t("Miqdori"), align: "right", render: (r) => fmtUZS(r.amount) },
        { key: "group", label: t("Guruh"), render: (r) => r.group },
        { key: "course", label: t("Kurs"), render: (r) => r.course },
        { key: "by", label: t("Kim bekor qildi?"), render: (r) => r.cancelledBy },
        { key: "date", label: t("Sana"), render: (r) => <span className="text-muted-foreground tabular-nums">{r.date}</span> },
      ]}
    />
  );
}
