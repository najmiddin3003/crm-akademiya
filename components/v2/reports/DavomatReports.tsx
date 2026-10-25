"use client";

import { useMemo, useState } from "react";
import Link from "@/components/ui/Link";
import { useLang, useT } from "@/components/shared/Language";
import type { DateRange } from "@/components/ui/DateRangePicker";
import V2DateRange, { rangeLabel } from "@/components/v2/ui/V2DateRange";
import V2Select from "@/components/v2/ui/V2Select";
import type { AttendanceGroupRow, AttendanceReport, AttendanceTeacherRow } from "@/lib/reportAttendance";
import type { ReportDef } from "@/lib/reportsCatalog";
import { CENTER_NAME, DOC_FOOTER, useBranchOptions, useReportData, useReportFmt, useToday } from "./reportHooks";
import { dateOfIso, fileSafe, fmtNum, isoOf } from "./reportFormat";
import type { ExportDoc } from "./reportExport";
import { ErrorBanner, KpiStrip, NoteLine, ReportShell, ReportTable, type TableCol } from "./reportUi";

// YANGI VERSIYA — HISOBOTLAR → DAVOMAT (katalog kartalari «Qatnashish foizi va qoldirilgan
// darslar», «Belgilangan darslar va dars jurnali», 25.10.2026; batafsil rasm yo'q —
// «Kelgan va ketgan» qolipida). Ma'lumot — `attendance` belgilari (Guruh → Bugungi dars);
// hisob — lib/reportAttendance.ts.

type GroupsResp = Pick<AttendanceReport, "from" | "to" | "historyStart" | "totals" | "courses"> & { ok: true; groups: AttendanceGroupRow[] };
type TeachersResp = Pick<AttendanceReport, "from" | "to" | "historyStart" | "totals" | "courses"> & { ok: true; teachers: AttendanceTeacherRow[] };

const pctText = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

/** Foiz + ingichka chiziq (qatnashish / jurnal). */
function PctBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-v2-text-3">—</span>;
  const p = Math.round(value * 100);
  const tone = p >= 85 ? "bg-v2-success" : p >= 60 ? "bg-v2-warning" : "bg-v2-danger";
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-v2-hover sm:block" aria-hidden>
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.max(4, p)}%` }} />
      </span>
      <span className="w-9 text-right font-semibold tabular-nums text-v2-text">{p}%</span>
    </span>
  );
}

function useAttendanceFilters() {
  const today = useToday();
  const [range, setRange] = useState<DateRange>(() => ({ start: dateOfIso(`${today.slice(0, 7)}-01`), end: dateOfIso(today) }));
  const [branch, setBranch] = useState("");
  const [course, setCourse] = useState("");
  const from = range.start ? isoOf(range.start) : `${today.slice(0, 7)}-01`;
  const rawTo = range.start ? isoOf(range.end ?? range.start) : today;
  const to = rawTo > today ? today : rawTo;
  const qs = new URLSearchParams({ from: from > to ? to : from, to, ...(branch ? { branch } : {}), ...(course ? { course } : {}) }).toString();
  return { today, range, setRange, branch, setBranch, course, setCourse, from, to, qs };
}

function Filters({ s, courses }: { s: ReturnType<typeof useAttendanceFilters>; courses: string[] }) {
  const { t } = useT();
  const branchOptions = useBranchOptions();
  const courseOptions = useMemo(() => courses.map((c) => ({ value: c, label: c })), [courses]);
  return (
    <>
      <V2DateRange value={s.range} onChange={s.setRange} allowAll={false} align="start" />
      <V2Select variant="value" label={t("Filial")} emptyLabel="Barchasi" value={s.branch} onChange={s.setBranch} options={branchOptions} searchable={false} />
      <V2Select variant="value" label={t("Kurs")} emptyLabel="Hammasi" value={s.course} onChange={s.setCourse} options={courseOptions} />
    </>
  );
}

function useDocBase(report: ReportDef, s: ReturnType<typeof useAttendanceFilters>, author: string) {
  const { t } = useT();
  const [lang] = useLang();
  const f = useReportFmt();
  const branchOptions = useBranchOptions();
  const branchName = s.branch ? (branchOptions.find((b) => b.value === s.branch)?.label ?? "") : t("Barcha filiallar");
  const period = rangeLabel(s.range, lang, t);
  const base = {
    title: t("{name} hisoboti", { name: `${t("Davomat")} · ${t(report.title)}` }),
    fileBase: `${fileSafe(`${t("Davomat")} ${t(report.title)}`)}-${s.to}`,
    center: t(CENTER_NAME),
    branchLabel: branchName,
    dateLabel: f.fullDate(s.today),
    author,
    filters: [period, branchName, s.course || t("Barcha kurslar")].join(" · "),
    footer: DOC_FOOTER,
  };
  return { base, branchName, period };
}

/* ───────────────────────── Guruhlar bo'yicha ───────────────────────── */

export function DavomatGuruhlarReport({ report, author }: { report: ReportDef; author: string }) {
  const { t } = useT();
  const f = useReportFmt();
  const s = useAttendanceFilters();
  const { data, loading, stale, error, reload } = useReportData<GroupsResp>(`/api/reports/attendance-groups?${s.qs}`);
  const { base, branchName } = useDocBase(report, s, author);
  const rows = data?.groups ?? [];
  const tot = data?.totals;
  const groupText = (g: AttendanceGroupRow) => [g.course, g.level].filter(Boolean).join(" · ") || g.label;

  const cols: TableCol<AttendanceGroupRow>[] = [
    {
      key: "g",
      label: t("Guruh"),
      render: (g) => (
        <Link href={`/groups/${g.id}?tab=jurnal`} className="block min-w-0 rounded-v2-sm hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus">
          <span className="block truncate font-medium text-v2-text">{groupText(g)}</span>
          <span className="block truncate text-v2-caption text-v2-text-3">{g.label}</span>
        </Link>
      ),
    },
    { key: "t", label: t("O'qituvchi"), render: (g) => <span className="text-v2-text-2">{g.teacher || "—"}</span> },
    { key: "l", label: t("Darslar"), align: "right", render: (g) => <span className="text-v2-text">{fmtNum(g.marked)}<span className="text-v2-text-3"> / {g.noSchedule ? "—" : fmtNum(g.scheduled)}</span></span> },
    { key: "r", label: t("Qatnashish"), align: "right", render: (g) => <PctBar value={g.rate} /> },
    { key: "u", label: t("Sababsiz"), align: "right", render: (g) => (g.unexcused ? <span className="font-semibold text-v2-danger">{fmtNum(g.unexcused)}</span> : <span className="text-v2-text-3">0</span>) },
    { key: "e", label: t("Sababli"), align: "right", render: (g) => fmtNum(g.excused) },
    { key: "k", label: t("Kechikdi"), align: "right", render: (g) => fmtNum(g.late) },
    { key: "n", label: t("Belgilanmagan"), align: "right", render: (g) => (g.unmarked ? <span className="font-medium text-v2-warning">{fmtNum(g.unmarked)}</span> : <span className="text-v2-text-3">0</span>) },
  ];

  function getDoc(): ExportDoc | null {
    if (!data || !tot) return null;
    return {
      ...base,
      kpis: [
        { label: t("O'rtacha qatnashish"), value: pctText(tot.rate) },
        { label: t("Belgilangan darslar"), value: fmtNum(tot.marked) },
        { label: t("Qoldirilgan"), value: fmtNum(tot.excused + tot.unexcused) },
        { label: t("Belgilanmagan darslar"), value: fmtNum(tot.unmarked) },
      ],
      sections: [
        {
          columns: [
            { label: t("Guruh") },
            { label: t("O'qituvchi") },
            { label: t("Belgilangan"), numeric: true },
            { label: t("Rejada"), numeric: true },
            { label: t("Qatnashish") },
            { label: t("Sababsiz"), numeric: true },
            { label: t("Sababli"), numeric: true },
            { label: t("Kechikdi"), numeric: true },
            { label: t("Belgilanmagan"), numeric: true },
          ],
          rows: rows.map((g) => [`${groupText(g)} (${g.label})`, g.teacher || null, g.marked, g.noSchedule ? null : g.scheduled, pctText(g.rate), g.unexcused, g.excused, g.late, g.unmarked]),
          total: [t("Jami"), null, tot.marked, tot.scheduled, pctText(tot.rate), tot.unexcused, tot.excused, tot.late, tot.unmarked],
        },
      ],
      notes: [t("Qatnashish = kelgan, kechikkan va birinchi darsga kelgan belgilar ÷ hamma belgi. Rejadagi dars — guruh jadvali bo'yicha, guruh faol bo'lgan kundan bugungacha.")],
    };
  }

  return (
    <ReportShell report={report} subtitle={s.branch ? branchName : t("barcha filiallar")} getDoc={getDoc} exportReady={!!data && !stale} filters={<Filters s={s} courses={data?.courses ?? []} />}>
      {error && <ErrorBanner message="Hisobot yuklanmadi" onRetry={reload} />}
      <div className={stale ? "opacity-60 transition-opacity" : ""}>
        <KpiStrip
          loading={loading}
          cells={[
            { key: "r", label: t("O'rtacha qatnashish"), value: tot ? pctText(tot.rate) : null, sub: tot ? t("{n} ta belgi", { n: fmtNum(tot.marks) }) : undefined },
            { key: "m", label: t("Belgilangan darslar"), value: tot ? fmtNum(tot.marked) : null, sub: tot ? t("rejada {n} ta", { n: fmtNum(tot.scheduled) }) : undefined },
            { key: "q", label: t("Qoldirilgan"), value: tot ? fmtNum(tot.excused + tot.unexcused) : null, sub: tot ? t("{u} sababsiz · {e} sababli", { u: fmtNum(tot.unexcused), e: fmtNum(tot.excused) }) : undefined },
            { key: "u", label: t("Belgilanmagan darslar"), value: tot ? fmtNum(tot.unmarked) : null, tone: tot && tot.unmarked > 0 ? "danger" : undefined, sub: t("davomat qilinmagan") },
          ]}
        />
      </div>
      <div className={stale ? "opacity-60 transition-opacity" : ""}>
        <ReportTable cols={cols} rows={rows} rowKey={(g) => g.id} loading={loading} empty={t("Bu davrda dars bo'lgan guruh yo'q")} minWidth={900} />
      </div>
      <NoteLine>{t("Qatnashish = kelgan, kechikkan va birinchi darsga kelgan belgilar ÷ hamma belgi. Rejadagi dars — guruh jadvali bo'yicha, guruh faol bo'lgan kundan bugungacha.")}</NoteLine>
      {data && data.historyStart > s.from && <NoteLine>{t("Guruh a'zoligi tarixi {date} dan yoziladi — boshlanish sanasi kiritilmagan guruhlar shu kundan hisoblanadi.", { date: f.fullDate(data.historyStart) })}</NoteLine>}
    </ReportShell>
  );
}

/* ───────────────────────── O'qituvchilar bo'yicha ───────────────────────── */

export function DavomatOqituvchilarReport({ report, author }: { report: ReportDef; author: string }) {
  const { t } = useT();
  const f = useReportFmt();
  const s = useAttendanceFilters();
  const { data, loading, stale, error, reload } = useReportData<TeachersResp>(`/api/reports/attendance-teachers?${s.qs}`);
  const { base, branchName } = useDocBase(report, s, author);
  const rows = data?.teachers ?? [];
  const tot = data?.totals;
  const done = tot ? tot.scheduled - tot.unmarked : 0;

  const cols: TableCol<AttendanceTeacherRow>[] = [
    { key: "t", label: t("O'qituvchi"), render: (r) => <span className="font-medium text-v2-text">{r.teacher}</span> },
    { key: "g", label: t("Guruhlar"), align: "right", render: (r) => fmtNum(r.groups) },
    { key: "s", label: t("Rejada"), align: "right", render: (r) => fmtNum(r.scheduled) },
    { key: "m", label: t("Belgilangan"), align: "right", render: (r) => fmtNum(r.scheduled - r.unmarked) },
    { key: "u", label: t("Belgilanmagan"), align: "right", render: (r) => (r.unmarked ? <span className="font-semibold text-v2-danger">{fmtNum(r.unmarked)}</span> : <span className="text-v2-text-3">0</span>) },
    { key: "j", label: t("Dars jurnali"), align: "right", render: (r) => <PctBar value={r.journal} /> },
    { key: "r", label: t("Qatnashish"), align: "right", render: (r) => <span className="tabular-nums text-v2-text-2">{pctText(r.rate)}</span> },
    { key: "l", label: t("Oxirgi belgilash"), render: (r) => <span className="whitespace-nowrap text-v2-text-2">{r.lastMarked ? f.dayMonth(r.lastMarked) : "—"}</span> },
  ];

  function getDoc(): ExportDoc | null {
    if (!data || !tot) return null;
    return {
      ...base,
      kpis: [
        { label: t("O'qituvchilar"), value: fmtNum(rows.length) },
        { label: t("Rejadagi darslar"), value: fmtNum(tot.scheduled) },
        { label: t("Belgilangan"), value: `${fmtNum(done)} (${pctText(tot.scheduled ? done / tot.scheduled : null)})` },
        { label: t("Belgilanmagan"), value: fmtNum(tot.unmarked) },
      ],
      sections: [
        {
          columns: [
            { label: t("O'qituvchi") },
            { label: t("Guruhlar"), numeric: true },
            { label: t("Rejada"), numeric: true },
            { label: t("Belgilangan"), numeric: true },
            { label: t("Belgilanmagan"), numeric: true },
            { label: t("Dars jurnali") },
            { label: t("Qatnashish") },
            { label: t("Oxirgi belgilash") },
          ],
          rows: rows.map((r) => [r.teacher, r.groups, r.scheduled, r.scheduled - r.unmarked, r.unmarked, pctText(r.journal), pctText(r.rate), r.lastMarked ? f.dayMonth(r.lastMarked) : null]),
          total: [t("Jami"), null, tot.scheduled, done, tot.unmarked, pctText(tot.scheduled ? done / tot.scheduled : null), pctText(tot.rate), null],
        },
      ],
      notes: [t("Dars jurnali = rejadagi darslardan davomati belgilanganlari. Rejadagi dars — guruh jadvali bo'yicha, guruh faol bo'lgan kundan bugungacha.")],
    };
  }

  return (
    <ReportShell report={report} subtitle={s.branch ? branchName : t("barcha filiallar")} getDoc={getDoc} exportReady={!!data && !stale} filters={<Filters s={s} courses={data?.courses ?? []} />}>
      {error && <ErrorBanner message="Hisobot yuklanmadi" onRetry={reload} />}
      <div className={stale ? "opacity-60 transition-opacity" : ""}>
        <KpiStrip
          loading={loading}
          cells={[
            { key: "t", label: t("O'qituvchilar"), value: fmtNum(rows.length), sub: t("guruhi bor o'qituvchilar") },
            { key: "s", label: t("Rejadagi darslar"), value: tot ? fmtNum(tot.scheduled) : null, sub: t("guruh jadvali bo'yicha") },
            { key: "m", label: t("Belgilangan"), value: tot ? fmtNum(done) : null, sub: tot ? t("{p} dars jurnali", { p: pctText(tot.scheduled ? done / tot.scheduled : null) }) : undefined },
            { key: "u", label: t("Belgilanmagan"), value: tot ? fmtNum(tot.unmarked) : null, tone: tot && tot.unmarked > 0 ? "danger" : undefined, sub: t("davomat qilinmagan darslar") },
          ]}
        />
      </div>
      <div className={stale ? "opacity-60 transition-opacity" : ""}>
        <ReportTable cols={cols} rows={rows} rowKey={(r) => r.teacher} loading={loading} empty={t("Bu davrda dars bo'lgan guruh yo'q")} minWidth={860} />
      </div>
      <NoteLine>{t("Dars jurnali = rejadagi darslardan davomati belgilanganlari. Rejadagi dars — guruh jadvali bo'yicha, guruh faol bo'lgan kundan bugungacha.")}</NoteLine>
      {data && data.historyStart > s.from && <NoteLine>{t("Guruh a'zoligi tarixi {date} dan yoziladi — boshlanish sanasi kiritilmagan guruhlar shu kundan hisoblanadi.", { date: f.fullDate(data.historyStart) })}</NoteLine>}
    </ReportShell>
  );
}
