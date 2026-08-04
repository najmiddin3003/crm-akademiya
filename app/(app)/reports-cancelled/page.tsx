"use client";

import ReportTablePage from "@/components/reports/ReportTablePage";
import type { CancelledPayment } from "@/lib/studentReports";

// Hisobotlar → Bekor qilingan to'lovlar (href /reports-cancelled).
const fmt = (n: number) => n.toLocaleString("ru-RU");

export default function Page() {
  return (
    <ReportTablePage<CancelledPayment>
      kind="cancelled-payments"
      minWidth={1100}
      columns={[
        { key: "name", label: "Ism", render: (r) => <span className="font-medium">{r.studentName}</span> },
        { key: "lessons", label: "To'lanmagan darslar soni", align: "right", render: (r) => r.unpaidLessons },
        { key: "total", label: "Jami to'lanmagan summa", align: "right", render: (r) => fmt(r.totalAmount) },
        { key: "teacher", label: "O'qituvchi", render: (r) => r.teacher },
        { key: "group", label: "Guruh", render: (r) => r.group },
        { key: "note", label: "Izoh", render: (r) => <span className="text-muted-foreground">{r.note || "-"}</span> },
      ]}
    />
  );
}
