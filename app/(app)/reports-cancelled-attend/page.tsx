"use client";

import ReportTablePage from "@/components/reports/ReportTablePage";
import type { CancelledAttendance } from "@/lib/studentReports";

// Hisobotlar → Davomati bekor qilinganlar analitikasi
// (href /reports-cancelled-attend).
const fmtUZS = (n: number) => n.toLocaleString("ru-RU") + " UZS";

export default function Page() {
  return (
    <ReportTablePage<CancelledAttendance>
      kind="cancelled-attendance"
      minWidth={1000}
      columns={[
        { key: "name", label: "O'quvchi", render: (r) => <span className="font-medium">{r.studentName}</span> },
        { key: "amount", label: "Miqdori", align: "right", render: (r) => fmtUZS(r.amount) },
        { key: "group", label: "Guruh", render: (r) => r.group },
        { key: "course", label: "Kurs", render: (r) => r.course },
        { key: "by", label: "Kim bekor qildi?", render: (r) => r.cancelledBy },
        { key: "date", label: "Sana", render: (r) => <span className="text-muted-foreground tabular-nums">{r.date}</span> },
      ]}
    />
  );
}
