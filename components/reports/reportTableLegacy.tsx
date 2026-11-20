"use client";

import ReportTablePage from "@/components/reports/ReportTablePage";
import type { CancelledAttendance, CancelledPayment, PriceDifference } from "@/lib/studentReports";
import { useT } from "@/components/shared/Language";

// ESKI VERSIYA — uchta jadvalli hisobot (20.11.2026 gacha app/(app)/<manzil>/page.tsx ning o'zi edi).
// Kod AYNAN ko'chirildi, ko'rinish va xulq o'zgarmagan: sahifa endi server komponent bo'lib versiyani
// tanlaydi (`currentUiVersion()`), ustunlardagi `render` funksiyalari esa serverdan mijozga props bo'lib
// o'tolmaydi — shuning uchun ular mijoz faylida. Yangi versiya — ./reportTablePages.tsx.
// To'liq yangi versiyaga o'tilganda bu fayl o'chiriladi.

const fmt = (n: number) => n.toLocaleString("ru-RU");
const fmtUZS = (n: number) => n.toLocaleString("ru-RU") + " UZS";

// Hisobotlar → Kurs narxidan farqli to'lovlar (href /reports-diff-payments).
export function DiffPaymentsPageV1() {
  const { t } = useT();
  return (
    <ReportTablePage<PriceDifference>
      kind="price-diff"
      minWidth={1000}
      columns={[
        { key: "name", label: t("O'quvchi"), render: (r) => <span className="font-medium">{r.studentName}</span> },
        {
          key: "type",
          label: t("Turi"),
          render: (r) => (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                r.type === "Chegirma" ? "text-emerald-700 bg-emerald-100" : "text-blue-700 bg-blue-100"
              }`}
            >
              {t(r.type)}
            </span>
          ),
        },
        { key: "group", label: t("Guruh"), render: (r) => r.group },
        { key: "sp", label: t("O'quvchi narxi"), align: "right", render: (r) => fmt(r.studentPrice) },
        { key: "cp", label: t("Kurs narxi"), align: "right", render: (r) => fmt(r.coursePrice) },
        { key: "created", label: t("Yaratildi"), render: (r) => <span className="text-muted-foreground">{r.createdAt}</span> },
      ]}
    />
  );
}

// Hisobotlar → Bekor qilingan to'lovlar (href /reports-cancelled).
export function CancelledPaymentsPageV1() {
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

// Hisobotlar → Davomati bekor qilinganlar analitikasi
// (href /reports-cancelled-attend).
export function CancelledAttendPageV1() {
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
