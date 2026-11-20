"use client";

import { useMemo, useState } from "react";
import { ArrowRight, TriangleAlert } from "lucide-react";
import Link from "@/components/ui/Link";
import { useLang, useT } from "@/components/shared/Language";
import type { DateRange } from "@/components/ui/DateRangePicker";
import V2DateRange, { rangeLabel } from "@/components/v2/ui/V2DateRange";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import V2Select from "@/components/v2/ui/V2Select";
import { useGroups } from "@/hooks/useGroups";
import { useTeachers } from "@/hooks/useTeachers";
import { CENTER_NAME, DOC_FOOTER, useReportData, useReportFmt, useToday } from "./reportHooks";
import { fileSafe, fmtNum } from "./reportFormat";
import type { ExportDoc } from "./reportExport";
import { Callout, Meter } from "./report35";
import { ErrorBanner, KpiStrip, NoteLine } from "./reportUi";
import { ReportTableGrid, ReportTableShell, type ReportTableGridCol } from "./reportTableKit";
import { buildServedReport, servedCurrentMonth, servedIso, type ServedSummaryRow, type ServedTeacherRow } from "./servedReportCalc";

// YANGI VERSIYA — HISOBOTLAR → «O'QUV MARKAZGA ISHLAB BERILGAN» (/reports-served, 51-qism, 20.11.2026,
// rasmsiz — /reports/<slug> hisobotlari uslubida). Eski sahifa (components/reports/ServedReportPage.tsx)
// bilan BIR XIL ma'lumot va hisob: /api/transaction-entries/served-summary (oraliq serverga), /api/groups,
// /api/teachers; hisob — ./servedReportCalc.ts (eski fayldagi bilan aynan bir xil).
//
//   1. yo'l «Hisobotlar › Xodimlar va oylik», sarlavha, Excel / PDF; filtrlar — oraliq (sukut — joriy oy,
//      «Barcha sanalar» ham bor — eskisidagidek), O'qituvchi; o'ngda qo'shni hisobot «Ustozlar tushumi →»
//      (boshqa API va boshqa hisob — o'zi ochadi, raqamlari aralashtirilmaydi);
//   2. ko'rsatkichlar: Jami ishlab berilgan (o'qituvchi bog'lanmagan bo'lsa «—» + ogohlantirish),
//      O'qituvchilar (+ guruhlar soni), O'qituvchisi ko'rsatilmagan kirim (jadvalga tushmaydi);
//   3. jadval O'qituvchi · Guruhlar · O'quvchilar · Ishlab berilgan summa · Ulushi (chiziq — barcha
//      o'qituvchilar jamidan); eng kattasi tepada, sahifalash.

export default function ServedReportV2({ author }: { author: string }) {
  const { t } = useT();
  const [lang] = useLang();
  const f = useReportFmt();
  const today = useToday();
  const { groups, loading: groupsLoading } = useGroups();
  const { names: teacherNames } = useTeachers();
  const [teacher, setTeacher] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>(servedCurrentMonth);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const qs = new URLSearchParams();
  if (dateRange.start) qs.set("from", servedIso(dateRange.start));
  if (dateRange.end) qs.set("to", servedIso(dateRange.end));
  const { data, loading: servedLoading, stale, error, reload } = useReportData<{ rows: ServedSummaryRow[] }>(`/api/transaction-entries/served-summary?${qs}`);
  const loading = groupsLoading || servedLoading;

  const report = useMemo(() => buildServedReport(data?.rows ?? [], groups, teacher), [data, groups, teacher]);
  const { rows, total, unattributedTotal, allTotal } = report;
  const groupCount = rows.reduce((s, r) => s + r.groups, 0);
  /** Oraliqda kirim umuman yo'q — «o'qituvchi ko'rsatilmagan» ogohlantirishi chiqmaydi (summa baribir «—», eskisidagidek). */
  const noEntries = !!data && data.rows.length === 0;
  // Ismdosh o'qituvchilar ro'yxatda bir marta (tanlov qiymati — ism).
  const teacherOptions = useMemo(() => [...new Set(teacherNames)].map((n) => ({ value: n, label: n })), [teacherNames]);

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = Math.min(page, pages);
  const start = (cur - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);

  const period = rangeLabel(dateRange, lang, t);
  const teacherLabel = teacher || t("Barcha o'qituvchilar");
  const share = (r: ServedTeacherRow) => (r.earned !== null && allTotal && allTotal > 0 ? (r.earned / allTotal) * 100 : null);

  const cols: ReportTableGridCol<ServedTeacherRow>[] = [
    { key: "n", label: t("O'qituvchi"), render: (r) => <span className="font-semibold text-v2-text">{r.name}</span> },
    { key: "g", label: t("Guruhlar"), align: "right", render: (r) => fmtNum(r.groups) },
    { key: "s", label: t("O'quvchilar"), align: "right", render: (r) => fmtNum(r.students) },
    {
      key: "e",
      label: t("Ishlab berilgan summa"),
      align: "right",
      render: (r) => (r.earned === null ? <span className="text-v2-text-3">—</span> : <span className="font-semibold text-v2-text">{fmtNum(r.earned)}</span>),
    },
    {
      key: "u",
      label: t("Ulushi"),
      className: "w-[200px]",
      render: (r) => {
        const p = share(r);
        if (p === null) return <span className="text-v2-text-3">—</span>;
        return (
          <span className="flex items-center gap-2">
            <Meter pct={p} tone="bg-v2-brand" />
            <span className="w-12 shrink-0 text-right text-v2-small tabular-nums text-v2-text-2">{p.toFixed(1)}%</span>
          </span>
        );
      },
    },
  ];

  function getDoc(): ExportDoc | null {
    if (!data) return null;
    const title = t("O'quv markazga ishlab berilgan");
    return {
      title: t("{name} hisoboti", { name: title }),
      fileBase: `${fileSafe(title)}-${today}`,
      center: t(CENTER_NAME),
      branchLabel: t("Barcha filiallar"),
      dateLabel: f.fullDate(today),
      author,
      filters: [period, teacherLabel].join(" · "),
      kpis: [
        { label: t("Jami ishlab berilgan"), value: total === null ? "—" : `${fmtNum(total)} ${t("so'm")}` },
        { label: t("O'qituvchilar"), value: fmtNum(rows.length) },
        { label: t("O'qituvchisi ko'rsatilmagan kirim"), value: `${fmtNum(unattributedTotal)} ${t("so'm")}` },
      ],
      sections: [
        {
          columns: [{ label: t("O'qituvchi") }, { label: t("Guruhlar"), numeric: true }, { label: t("O'quvchilar"), numeric: true }, { label: t("Ishlab berilgan summa"), numeric: true }, { label: t("Ulush, %") }],
          rows: rows.map((r) => {
            const p = share(r);
            return [r.name, r.groups, r.students, r.earned, p === null ? null : `${p.toFixed(1)}%`];
          }),
          total: [t("Jami"), groupCount, null, total, null],
        },
      ],
      notes: [t("Guruhlar va O'quvchilar — bugungi holat; summa — tanlangan oraliq bo'yicha.")],
      footer: DOC_FOOTER,
    };
  }

  return (
    <ReportTableShell
      group="staff"
      title={t("O'quv markazga ishlab berilgan")}
      subtitle={t("har bir o'qituvchining o'quvchilari markazga haqiqatda to'lagan pul")}
      getDoc={getDoc}
      exportReady={!!data && !stale && !groupsLoading}
      filters={
        <>
          <V2DateRange
            value={dateRange}
            onChange={(r) => {
              setDateRange(r);
              setPage(1);
            }}
            align="start"
          />
          <V2Select
            variant="value"
            label={t("O'qituvchi")}
            value={teacher}
            onChange={(v) => {
              setTeacher(v);
              setPage(1);
            }}
            options={[{ value: "", label: "Hammasi" }, ...teacherOptions]}
            emptyLabel="Hammasi"
            clearable={false}
          />
        </>
      }
      filtersEnd={
        <Link
          href="/reports/ustozlar-tushumi"
          className="inline-flex items-center gap-1 rounded-v2-sm text-v2-small font-semibold text-v2-brand-text hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus"
        >
          {t("Ustozlar tushumi")}
          <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
        </Link>
      }
    >
      {error && <ErrorBanner message="Hisobot yuklanmadi" onRetry={reload} />}

      <div className={stale ? "opacity-60" : ""}>
        <KpiStrip
          loading={loading}
          cells={[
            {
              key: "t",
              label: t("Jami ishlab berilgan"),
              value: data && total !== null ? fmtNum(total) : null,
              unit: t("so'm"),
              sub: noEntries ? `${period} · ${t("Bu davrda kirim yo'q")}` : `${period} · ${teacherLabel}`,
            },
            { key: "n", label: t("O'qituvchilar"), value: data ? fmtNum(rows.length) : null, sub: t("{n} ta guruh", { n: groupCount }) },
            {
              key: "u",
              label: t("O'qituvchisi ko'rsatilmagan kirim"),
              value: data ? fmtNum(unattributedTotal) : null,
              unit: t("so'm"),
              sub: t("jadvalga tushmaydi"),
              tone: unattributedTotal > 0 ? "danger" : undefined,
            },
          ]}
        />
      </div>

      {data && !loading && total === null && !noEntries && (
        <Callout tone="warning" icon={<TriangleAlert className="size-5" strokeWidth={1.75} aria-hidden />} title={t("O'qituvchi ko'rsatilmagan")}>
          {t("Tanlangan oraliqdagi kirim yozuvlarida o'qituvchi ko'rsatilmagan — summani o'qituvchilarga taqsimlab bo'lmaydi.")}
        </Callout>
      )}

      <div className={stale ? "opacity-60" : ""}>
        <ReportTableGrid
          cols={cols}
          rows={slice}
          rowKey={(r) => r.name}
          startIndex={start}
          loading={loading}
          empty={error ? t("Hisobot yuklanmadi") : t("Ma'lumot topilmadi")}
          minWidth={820}
          caption={t("O'quv markazga ishlab berilgan")}
          footer={
            !loading && rows.length > 0 ? (
              <V2Pagination
                totalItems={rows.length}
                page={cur}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(1);
                }}
              />
            ) : undefined
          }
        />
      </div>

      <div className="flex flex-col gap-1">
        <NoteLine>{t("Summa — tanlangan oraliqda o'qituvchining o'quvchilari markazga to'lagan pul: bekor qilingan to'lovlarsiz, o'quvchiga qaytarilgani ayrilgan.")}</NoteLine>
        <NoteLine>{t("Guruhlar va O'quvchilar — bugungi holat; summa — tanlangan oraliq bo'yicha.")}</NoteLine>
        {total !== null && unattributedTotal > 0 && (
          <NoteLine>{t("Bundan tashqari o'qituvchisi ko'rsatilmagan {s} so'm kirim bor — u jadvalga tushmaydi.", { s: fmtNum(unattributedTotal) })}</NoteLine>
        )}
      </div>
    </ReportTableShell>
  );
}
