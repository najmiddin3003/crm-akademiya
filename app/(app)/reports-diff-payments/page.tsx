"use client";

import ReportTablePage from "@/components/reports/ReportTablePage";
import type { PriceDifference } from "@/lib/studentReports";

// Hisobotlar → Kurs narxidan farqli to'lovlar (href /reports-diff-payments).
const fmt = (n: number) => n.toLocaleString("ru-RU");

export default function Page() {
  return (
    <ReportTablePage<PriceDifference>
      kind="price-diff"
      minWidth={1000}
      columns={[
        { key: "name", label: "O'quvchi", render: (r) => <span className="font-medium">{r.studentName}</span> },
        {
          key: "type",
          label: "Turi",
          render: (r) => (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                r.type === "Chegirma" ? "text-emerald-700 bg-emerald-100" : "text-blue-700 bg-blue-100"
              }`}
            >
              {r.type}
            </span>
          ),
        },
        { key: "group", label: "Guruh", render: (r) => r.group },
        { key: "sp", label: "O'quvchi narxi", align: "right", render: (r) => fmt(r.studentPrice) },
        { key: "cp", label: "Kurs narxi", align: "right", render: (r) => fmt(r.coursePrice) },
        { key: "created", label: "Yaratildi", render: (r) => <span className="text-muted-foreground">{r.createdAt}</span> },
      ]}
    />
  );
}
