"use client";

import ReportTablePage from "@/components/reports/ReportTablePage";
import type { UnpaidStudent } from "@/lib/studentReports";
import { useT } from "@/components/shared/Language";

// Hisobotlar → O'quvchining umumiy to'lanmagani (href /reports-unpaid).
const fmt = (n: number) => n.toLocaleString("ru-RU");

export default function Page() {
  const { t } = useT();
  return (
    <ReportTablePage<UnpaidStudent>
      kind="unpaid"
      minWidth={800}
      columns={[
        { key: "name", label: t("Ism"), render: (r) => <span className="font-medium">{r.studentName}</span> },
        { key: "groups", label: t("Guruhlar"), render: (r) => r.groups },
        { key: "lessons", label: t("To'lanmagan darslar"), align: "right", render: (r) => r.unpaidLessons },
        { key: "total", label: t("Jami to'lanmagan"), align: "right", render: (r) => fmt(r.totalUnpaid) },
      ]}
    />
  );
}
