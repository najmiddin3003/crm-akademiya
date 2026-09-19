"use client";

import ReportTablePage from "@/components/reports/ReportTablePage";
import type { CancelledPayment } from "@/lib/studentReports";
import { useT } from "@/components/shared/Language";

// Hisobotlar → Bekor qilingan to'lovlar (href /reports-cancelled).
const fmt = (n: number) => n.toLocaleString("ru-RU");

export default function Page() {
  const { t } = useT();
  return (
    <ReportTablePage<CancelledPayment>
      kind="cancelled-payments"
      minWidth={1100}
      columns={[
        { key: "name", label: t("Ism"), render: (r) => <span className="font-medium">{r.studentName}</span> },
        { key: "lessons", label: t("To'lanmagan darslar soni"), align: "right", render: (r) => r.unpaidLessons },
        { key: "total", label: t("Jami to'lanmagan summa"), align: "right", render: (r) => fmt(r.totalAmount) },
        { key: "teacher", label: t("O'qituvchi"), render: (r) => r.teacher },
        { key: "group", label: t("Guruh"), render: (r) => r.group },
        { key: "note", label: t("Izoh"), render: (r) => <span className="text-muted-foreground">{r.note || "-"}</span> },
      ]}
    />
  );
}
