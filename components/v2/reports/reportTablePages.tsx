"use client";

import { useT } from "@/components/shared/Language";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import type { CancelledAttendance, CancelledPayment, PriceDifference } from "@/lib/studentReports";
import { fmtNum, fmtSigned } from "./reportFormat";
import ReportTableV2 from "./ReportTableV2";
import { ReportTableDash, ReportTablePill, type ReportTablePillTone } from "./reportTableKit";

// YANGI VERSIYA — uchta jadvalli hisobot (51-qism, 20.11.2026, rasmsiz — /reports/<slug> hisobotlari
// uslubida). Ma'lumot eski sahifalar bilan bitta: /api/student-reports?kind=… (./ReportTableV2.tsx).
// Ko'rsatkichlar — faqat jadvaldagi ustunlarning soni va yig'indisi (yangi formula yo'q); «Farq» —
// qatorning o'zidagi ikki narx ayirmasi. Eski versiya — components/reports/reportTableLegacy.tsx.

const count = <T,>(rows: T[], of: (r: T) => string) => new Set(rows.map(of).filter(Boolean)).size;
const sum = <T,>(rows: T[], of: (r: T) => number) => rows.reduce((s, r) => s + (Number(of(r)) || 0), 0);
/** Katakdagi son; maydoni yo'q eski yozuvda — «—» («NaN» emas). */
const num = (v: number) => (Number.isFinite(v) ? fmtNum(v) : "—");

/* ───────────────────────── Kurs narxidan farqli to'lovlar ───────────────────────── */

const TYPE_TONE: Record<string, ReportTablePillTone> = { Chegirma: "violet", "Qo'shimcha": "info" };

export function DiffPaymentsV2({ author }: { author: string }) {
  const { t } = useT();
  return (
    <ReportTableV2<PriceDifference>
      kind="price-diff"
      minWidth={1000}
      group="finance"
      title={t("Kurs narxidan farqli to'lovlar")}
      subtitle={t("o'quvchi narxi kurs narxidan farq qiladigan to'lovlar — chegirma yoki qo'shimcha")}
      author={author}
      search={(r) => [r.studentName, r.group]}
      searchPlaceholder={t("O'quvchi yoki guruh")}
      segment={(r) => r.type}
      segmentLabel={t("Turi")}
      filters={[{ key: "group", label: t("Guruh"), of: (r) => r.group }]}
      kpis={(rows) => [
        { key: "n", label: t("Yozuvlar"), value: fmtNum(rows.length), sub: t("{a} o'quvchi · {b} guruh", { a: count(rows, (r) => r.studentName), b: count(rows, (r) => r.group) }) },
        { key: "c", label: t("Chegirma"), value: fmtNum(rows.filter((r) => r.type === "Chegirma").length), sub: t("o'quvchi narxi kurs narxidan past") },
        { key: "q", label: t("Qo'shimcha"), value: fmtNum(rows.filter((r) => r.type === "Qo'shimcha").length), sub: t("o'quvchi narxi kurs narxidan yuqori") },
      ]}
      columns={[
        { key: "name", label: t("O'quvchi"), render: (r) => <span className="font-semibold text-v2-text">{r.studentName}</span>, cell: (r) => r.studentName },
        { key: "type", label: t("Turi"), render: (r) => <ReportTablePill tone={TYPE_TONE[r.type] ?? "neutral"}>{t(r.type)}</ReportTablePill>, cell: (r) => t(r.type) },
        { key: "group", label: t("Guruh"), render: (r) => r.group || <ReportTableDash />, cell: (r) => r.group },
        { key: "sp", label: t("O'quvchi narxi"), align: "right", render: (r) => <span className="font-semibold text-v2-text">{num(r.studentPrice)}</span>, cell: (r) => r.studentPrice, numeric: true },
        { key: "cp", label: t("Kurs narxi"), align: "right", render: (r) => num(r.coursePrice), cell: (r) => r.coursePrice, numeric: true },
        {
          key: "diff",
          label: t("Farq"),
          align: "right",
          render: (r) => {
            const d = r.studentPrice - r.coursePrice;
            if (!Number.isFinite(d)) return <ReportTableDash />;
            return <span className={d < 0 ? "text-v2-violet" : d > 0 ? "text-v2-info" : "text-v2-text-3"}>{fmtSigned(d)}</span>;
          },
          cell: (r) => (Number.isFinite(r.studentPrice - r.coursePrice) ? r.studentPrice - r.coursePrice : null),
          numeric: true,
        },
        { key: "created", label: t("Yaratildi"), render: (r) => <span className="tabular-nums text-v2-text-2">{r.createdAt || "—"}</span>, cell: (r) => r.createdAt },
      ]}
      notes={[t("Farq — o'quvchi narxi minus kurs narxi: manfiy — chegirma, musbat — qo'shimcha.")]}
    />
  );
}

/* ───────────────────────── Bekor qilingan to'lovlar ───────────────────────── */

export function CancelledPaymentsV2({ author }: { author: string }) {
  const { t } = useT();
  return (
    <ReportTableV2<CancelledPayment>
      kind="cancelled-payments"
      minWidth={1100}
      group="finance"
      title={t("Bekor qilingan to'lovlar")}
      subtitle={t("to'lanmagan darslar va summa — o'qituvchi va guruh bilan")}
      author={author}
      search={(r) => [r.studentName, r.group, r.teacher, r.note]}
      searchPlaceholder={t("Ism, guruh yoki o'qituvchi")}
      filters={[
        { key: "teacher", label: t("O'qituvchi"), of: (r) => r.teacher },
        { key: "group", label: t("Guruh"), of: (r) => r.group },
      ]}
      kpis={(rows) => [
        { key: "n", label: t("Yozuvlar"), value: fmtNum(rows.length), sub: t("{n} o'quvchi", { n: count(rows, (r) => r.studentName) }) },
        { key: "l", label: t("To'lanmagan darslar soni"), value: fmtNum(sum(rows, (r) => r.unpaidLessons)), unit: t("dars") },
        { key: "s", label: t("Jami to'lanmagan summa"), value: fmtNum(sum(rows, (r) => r.totalAmount)), unit: t("so'm"), tone: "danger" },
      ]}
      columns={[
        { key: "name", label: t("Ism"), render: (r) => <span className="font-semibold text-v2-text">{r.studentName}</span>, cell: (r) => r.studentName },
        { key: "lessons", label: t("To'lanmagan darslar soni"), align: "right", render: (r) => num(r.unpaidLessons), cell: (r) => r.unpaidLessons, numeric: true },
        { key: "total", label: t("Jami to'lanmagan summa"), align: "right", render: (r) => <span className="font-semibold text-v2-text">{num(r.totalAmount)}</span>, cell: (r) => r.totalAmount, numeric: true },
        { key: "teacher", label: t("O'qituvchi"), render: (r) => r.teacher || <ReportTableDash />, cell: (r) => r.teacher },
        { key: "group", label: t("Guruh"), render: (r) => r.group || <ReportTableDash />, cell: (r) => r.group },
        {
          key: "note",
          label: t("Izoh"),
          className: "max-w-[280px]",
          render: (r) => (r.note ? <span className="line-clamp-2 text-v2-text-2" title={r.note}>{r.note}</span> : <ReportTableDash />),
          cell: (r) => r.note || null,
        },
      ]}
    />
  );
}

/* ───────────────────────── Davomati bekor qilinganlar ───────────────────────── */

export function CancelledAttendV2({ author }: { author: string }) {
  const { t } = useT();
  return (
    <ReportTableV2<CancelledAttendance>
      kind="cancelled-attendance"
      minWidth={1000}
      group="attendance"
      title={t("Davomati bekor qilinganlar")}
      subtitle={t("bekor qilingan davomat — miqdori, kim va qachon bekor qilgani")}
      author={author}
      search={(r) => [r.studentName, r.group, r.course, r.cancelledBy]}
      searchPlaceholder={t("O'quvchi, guruh yoki kurs")}
      filters={[
        { key: "course", label: t("Kurs"), of: (r) => r.course },
        { key: "by", label: t("Kim bekor qildi?"), of: (r) => r.cancelledBy },
      ]}
      breakdown={{ filter: "by", title: t("Kim bekor qildi?"), amount: (r) => r.amount }}
      kpis={(rows) => {
        const people = count(rows, (r) => r.cancelledBy);
        return [
          { key: "n", label: t("Yozuvlar"), value: fmtNum(rows.length), sub: t("{n} o'quvchi", { n: count(rows, (r) => r.studentName) }) },
          { key: "s", label: t("Miqdori"), value: fmtNum(sum(rows, (r) => r.amount)), unit: t("so'm"), sub: t("bekor qilingan yozuvlar yig'indisi") },
          { key: "p", label: t("Bekor qilganlar"), value: fmtNum(people), unit: t("xodim"), sub: t("{n} ta kursda", { n: count(rows, (r) => r.course) }) },
        ];
      }}
      columns={[
        { key: "name", label: t("O'quvchi"), render: (r) => <span className="font-semibold text-v2-text">{r.studentName}</span>, cell: (r) => r.studentName },
        { key: "amount", label: t("Miqdori"), align: "right", render: (r) => <span className="font-semibold text-v2-text">{num(r.amount)}</span>, cell: (r) => r.amount, numeric: true },
        { key: "group", label: t("Guruh"), render: (r) => r.group || <ReportTableDash />, cell: (r) => r.group },
        {
          key: "course",
          label: t("Kurs"),
          render: (r) =>
            r.course ? (
              <span className="flex items-center gap-1.5">
                <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(r.course)]}`} aria-hidden />
                <span className="text-v2-text">{r.course}</span>
              </span>
            ) : (
              <ReportTableDash />
            ),
          cell: (r) => r.course,
        },
        { key: "by", label: t("Kim bekor qildi?"), render: (r) => r.cancelledBy || <ReportTableDash />, cell: (r) => r.cancelledBy },
        { key: "date", label: t("Sana"), render: (r) => <span className="tabular-nums text-v2-text-2">{r.date || "—"}</span>, cell: (r) => r.date },
      ]}
    />
  );
}
