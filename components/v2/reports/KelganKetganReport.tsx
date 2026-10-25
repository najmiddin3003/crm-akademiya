"use client";

import { useMemo, useState } from "react";
import { useT } from "@/components/shared/Language";
import V2Select from "@/components/v2/ui/V2Select";
import type { ReportDef } from "@/lib/reportsCatalog";
import type { FlowMonth, StudentFlowReport } from "@/lib/reportStudents";
import ReportBarChart, { type ChartPoint } from "./ReportBarChart";
import { CENTER_NAME, DOC_FOOTER, useBranchOptions, useReportData, useReportFmt, useToday } from "./reportHooks";
import { fileSafe, fmtNum, fmtSigned, monthRangeLabel, shiftMonth, type MonthRange } from "./reportFormat";
import type { ExportDoc } from "./reportExport";
import { ErrorBanner, KpiStrip, NoteLine, ReportShell, ReportTable, SignedNum, type TableCol } from "./reportUi";
import V2MonthRange from "./V2MonthRange";

// YANGI VERSIYA — HISOBOTLAR → «KELGAN VA KETGAN» (rasm «Kelgan va ketgan · namuna»,
// yorug'/qorong'i, 25.10.2026): oylar oralig'i (sukut — oxirgi 6 oy), Filial, Kurs;
// Kelgan · Ketgan · Sof o'sish · Faol o'quvchilar (chiziqli grafik bilan); «Oyma-oy»
// ustunlari (davom etayotgan oy — och, «*»); jadval: Oy · Kelgan · Ketgan · Sof o'sish ·
// Oy oxirida faol, «Jami». Hisob qoidasi — lib/reportStudents.ts (guruh a'zoligi bo'yicha;
// tarix 20.09.2026 dan — undan oldingi oylar «—»).

type Resp = StudentFlowReport & { ok: true; branch: "all" | number };

export default function KelganKetganReport({ report, author }: { report: ReportDef; author: string }) {
  const { t, lang } = useT();
  const f = useReportFmt();
  const today = useToday();
  const cur = today.slice(0, 7);
  const branchOptions = useBranchOptions();
  const [range, setRange] = useState<MonthRange>({ from: shiftMonth(cur, -5), to: cur });
  const [branch, setBranch] = useState("");
  const [course, setCourse] = useState("");

  const url = `/api/reports/student-flow?${new URLSearchParams({ from: range.from, to: range.to, ...(branch ? { branch } : {}), ...(course ? { course } : {}) })}`;
  const { data, loading, stale, error, reload } = useReportData<Resp>(url);

  const branchName = branch ? (branchOptions.find((b) => b.value === branch)?.label ?? "") : t("Barcha filiallar");
  const courseOptions = useMemo(() => (data?.courses ?? []).map((c) => ({ value: c, label: c })), [data?.courses]);

  const months = data?.months ?? [];
  const known = months.filter((m) => m.came !== null);
  const partialMonth = months.find((m) => m.partial) ?? null;
  const monthLabel = (m: FlowMonth) => (m.partial ? f.partialMonth(m.month, m.endDate) : f.monthName(m.month));
  const unknownBefore = data && months.some((m) => m.activeEnd === null) ? data.historyStart : null;

  const kpiPeriod = known.length ? f.dayRange(`${known[0].month}-01`, known[known.length - 1].endDate) : t("ma'lumot yo'q");
  const activeDelta = data && data.activePrevEnd !== null ? data.activeNow - data.activePrevEnd : null;
  const spark = months.filter((m) => m.activeEnd !== null).map((m) => m.activeEnd as number);

  const points: ChartPoint[] = months.map((m) => ({
    key: m.month,
    tick: `${f.monthShort(m.month)}${m.partial ? "*" : ""}`,
    title: f.monthTitle(m.month),
    values: [m.came, m.left],
    partial: m.partial,
    extra: m.net === null ? undefined : { value: fmtSigned(m.net), label: t("sof o'sish"), tone: m.net < 0 ? "danger" : undefined },
  }));

  const cols: TableCol<FlowMonth>[] = [
    { key: "m", label: t("Oy"), render: (m) => <span className="text-v2-text">{monthLabel(m)}</span> },
    { key: "c", label: t("Guruhga kelgan"), align: "right", render: (m) => (m.came === null ? <span className="text-v2-text-3">—</span> : fmtNum(m.came)) },
    { key: "l", label: t("Guruhdan ketgan"), align: "right", render: (m) => (m.left === null ? <span className="text-v2-text-3">—</span> : fmtNum(m.left)) },
    { key: "n", label: t("Sof o'sish"), align: "right", render: (m) => <SignedNum value={m.net} text={m.net === null ? "" : fmtSigned(m.net)} /> },
    { key: "a", label: t("Oy oxirida faol"), align: "right", render: (m) => (m.activeEnd === null ? <span className="text-v2-text-3">—</span> : fmtNum(m.activeEnd)) },
  ];

  const filtersText = [monthRangeLabel(range, lang), branchName, course || t("Barcha kurslar")].join(" · ");

  function getDoc(): ExportDoc | null {
    if (!data) return null;
    return {
      title: t("{name} hisoboti", { name: t(report.title) }),
      fileBase: `${fileSafe(t(report.title))}-${today}`,
      center: t(CENTER_NAME),
      branchLabel: branchName,
      dateLabel: f.fullDate(today),
      author,
      filters: filtersText,
      kpis: [
        { label: t("Guruhga kelgan"), value: fmtNum(data.totals.came) },
        { label: t("Guruhdan ketgan"), value: fmtNum(data.totals.left) },
        { label: t("Sof o'sish"), value: fmtSigned(data.totals.net) },
        { label: t("Faol o'quvchilar"), value: fmtNum(data.activeNow) },
      ],
      sections: [
        {
          columns: [{ label: t("Oy") }, { label: t("Guruhga kelgan"), numeric: true }, { label: t("Guruhdan ketgan"), numeric: true }, { label: t("Sof o'sish"), numeric: true, signed: true }, { label: t("Oy oxirida faol"), numeric: true }],
          rows: months.map((m) => [monthLabel(m), m.came, m.left, m.net, m.activeEnd]),
          total: [t("Jami"), data.totals.came, data.totals.left, data.totals.net, null],
        },
      ],
      notes: [
        t("Kelgan — oy oxirida guruhda o'qiyotgan, oldingi oy oxirida o'qimagan o'quvchilar; ketgan — aksincha. Boshqa guruhga o'tgan o'quvchi ketgan hisoblanmaydi."),
        ...(unknownBefore ? [t("Guruh a'zoligi tarixi {date} dan yoziladi — undan oldingi oylar uchun ma'lumot yo'q.", { date: f.fullDate(unknownBefore) })] : []),
      ],
      footer: DOC_FOOTER,
    };
  }

  return (
    <ReportShell
      report={report}
      subtitle={branch ? branchName : t("barcha filiallar")}
      getDoc={getDoc}
      exportReady={!!data && !stale}
      filters={
        <>
          <V2MonthRange value={range} onChange={setRange} max={cur} />
          <V2Select variant="value" label={t("Filial")} emptyLabel="Barchasi" value={branch} onChange={setBranch} options={branchOptions} searchable={false} />
          <V2Select variant="value" label={t("Kurs")} emptyLabel="Hammasi" value={course} onChange={setCourse} options={courseOptions} />
        </>
      }
    >
      {error && <ErrorBanner message="Hisobot yuklanmadi" onRetry={reload} />}

      <div className={stale ? "opacity-60 transition-opacity" : ""}>
        <KpiStrip
          loading={loading}
          cells={[
            { key: "c", label: t("Guruhga kelgan"), value: data ? fmtNum(data.totals.came) : null, sub: kpiPeriod },
            { key: "l", label: t("Guruhdan ketgan"), value: data ? fmtNum(data.totals.left) : null, sub: t("barcha guruhlaridan chiqqan") },
            { key: "n", label: t("Sof o'sish"), value: data ? fmtSigned(data.totals.net) : null, sub: t("kelgan − ketgan") },
            {
              key: "a",
              label: t("Faol o'quvchilar"),
              value: data ? fmtNum(data.activeNow) : null,
              sub:
                activeDelta !== null && data
                  ? t("{delta} {month} oxiriga nisbatan", { delta: fmtSigned(activeDelta), month: f.monthLower(data.prevMonth) })
                  : t("hozir guruhda o'qiyotgan"),
              spark,
            },
          ]}
        />
      </div>

      <ReportBarChart
        title={t("Oyma-oy")}
        subtitle={[t("o'quvchilar soni"), partialMonth ? t("* {month} hali tugamagan", { month: f.monthLower(partialMonth.month) }) : ""].filter(Boolean).join(" · ")}
        series={[t("Guruhga kelgan"), t("Guruhdan ketgan")]}
        points={points}
        format={(v) => fmtNum(v)}
        minTop={4}
        loading={loading}
        stale={stale}
        emptyText={t("Bu davrda kelgan yoki ketgan o'quvchi yo'q")}
      />

      <div className={stale ? "opacity-60 transition-opacity" : ""}>
        <ReportTable
          cols={cols}
          rows={months}
          rowKey={(m) => m.month}
          loading={loading}
          empty={t("Bu davrda ma'lumot yo'q")}
          caption={t("Oyma-oy")}
          minWidth={560}
          total={
            data
              ? [
                  t("Jami"),
                  fmtNum(data.totals.came),
                  fmtNum(data.totals.left),
                  <SignedNum key="n" value={data.totals.net} text={fmtSigned(data.totals.net)} />,
                  <span key="a" className="text-v2-text-3">
                    —
                  </span>,
                ]
              : undefined
          }
        />
      </div>

      <div className="space-y-1">
        <NoteLine>{t("Kelgan — oy oxirida guruhda o'qiyotgan, oldingi oy oxirida o'qimagan o'quvchilar; ketgan — aksincha. Boshqa guruhga o'tgan o'quvchi ketgan hisoblanmaydi.")}</NoteLine>
        {unknownBefore && <NoteLine>{t("Guruh a'zoligi tarixi {date} dan yoziladi — undan oldingi oylar uchun ma'lumot yo'q.", { date: f.fullDate(unknownBefore) })}</NoteLine>}
      </div>
    </ReportShell>
  );
}
