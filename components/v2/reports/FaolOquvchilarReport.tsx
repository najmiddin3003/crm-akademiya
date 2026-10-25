"use client";

import { useMemo, useState } from "react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { Segmented } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import type { ActiveGroupRow, ActiveStudentsReport } from "@/lib/reportStudents";
import type { ReportDef } from "@/lib/reportsCatalog";
import { CENTER_NAME, DOC_FOOTER, useBranchOptions, useReportData, useReportFmt, useToday } from "./reportHooks";
import { fileSafe, fmtNum } from "./reportFormat";
import type { ExportDoc, ExportSection } from "./reportExport";
import { ErrorBanner, KpiStrip, NoteLine, ReportShell, ReportTable, type TableCol } from "./reportUi";

// YANGI VERSIYA — HISOBOTLAR → «FAOL O'QUVCHILAR» (katalog kartasi «Kurs, guruh va o'qituvchi
// bo'yicha», 25.10.2026; batafsil rasm yo'q — «Kelgan va ketgan» qolipida): bugun guruhda
// o'qiyotganlar. Kesim — Kurs / Guruh / O'qituvchi. Hisob — lib/reportStudents.ts.

type Resp = ActiveStudentsReport & { ok: true; branch: "all" | number };
type View = "course" | "group" | "teacher";

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");

export default function FaolOquvchilarReport({ report, author }: { report: ReportDef; author: string }) {
  const { t } = useT();
  const f = useReportFmt();
  const today = useToday();
  const branchOptions = useBranchOptions();
  const [branch, setBranch] = useState("");
  const [course, setCourse] = useState("");
  const [view, setView] = useState<View>("course");

  const url = `/api/reports/active-students?${new URLSearchParams({ ...(branch ? { branch } : {}), ...(course ? { course } : {}) })}`;
  const { data, loading, stale, error, reload } = useReportData<Resp>(url);
  const branchName = branch ? (branchOptions.find((b) => b.value === branch)?.label ?? "") : t("Barcha filiallar");
  const courseOptions = useMemo(() => (data?.courses ?? []).map((c) => ({ value: c, label: c })), [data?.courses]);

  const groups = (data?.groups ?? []).filter((g) => g.students > 0);
  const emptyGroups = (data?.groups ?? []).length - groups.length;
  const teachers = (data?.byTeacher ?? []).filter((x) => x.students > 0);
  const students = data?.students ?? 0;
  const avg = groups.length ? Math.round(groups.reduce((s, g) => s + g.students, 0) / groups.length) : 0;
  const groupText = (g: ActiveGroupRow) => [g.course, g.level].filter(Boolean).join(" · ") || g.label;

  type CourseRow = Resp["byCourse"][number];
  type TeacherRow = Resp["byTeacher"][number];
  const courseCols: TableCol<CourseRow>[] = [
    { key: "c", label: t("Kurs"), render: (r) => <span className="font-medium text-v2-text">{r.course}</span> },
    { key: "g", label: t("Guruhlar"), align: "right", render: (r) => fmtNum(r.groups) },
    { key: "t", label: t("O'qituvchilar"), align: "right", render: (r) => fmtNum(r.teachers) },
    { key: "s", label: t("O'quvchilar"), align: "right", render: (r) => <span className="font-semibold text-v2-text">{fmtNum(r.students)}</span> },
    { key: "p", label: t("Ulush"), align: "right", render: (r) => <span className="text-v2-text-2">{pct(r.students, students)}</span> },
  ];
  const groupCols: TableCol<ActiveGroupRow>[] = [
    {
      key: "g",
      label: t("Guruh"),
      render: (g) => (
        <Link href={`/groups/${g.id}`} className="block min-w-0 rounded-v2-sm hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus">
          <span className="block truncate font-medium text-v2-text">{groupText(g)}</span>
          <span className="block truncate text-v2-caption text-v2-text-3">{g.label}</span>
        </Link>
      ),
    },
    { key: "t", label: t("O'qituvchi"), render: (g) => <span className="text-v2-text-2">{g.teacher || "—"}</span> },
    { key: "s", label: t("O'quvchilar"), align: "right", render: (g) => <span className="font-semibold text-v2-text">{fmtNum(g.students)}</span> },
  ];
  const teacherCols: TableCol<TeacherRow>[] = [
    { key: "t", label: t("O'qituvchi"), render: (r) => <span className="font-medium text-v2-text">{r.teacher}</span> },
    { key: "c", label: t("Kurslar"), render: (r) => <span className="text-v2-text-2">{r.courses.join(", ") || "—"}</span> },
    { key: "g", label: t("Guruhlar"), align: "right", render: (r) => fmtNum(r.groups) },
    { key: "s", label: t("O'quvchilar"), align: "right", render: (r) => <span className="font-semibold text-v2-text">{fmtNum(r.students)}</span> },
  ];

  const sections = (): ExportSection[] => [
    {
      title: t("Kurs bo'yicha"),
      columns: [{ label: t("Kurs") }, { label: t("Guruhlar"), numeric: true }, { label: t("O'qituvchilar"), numeric: true }, { label: t("O'quvchilar"), numeric: true }, { label: t("Ulush") }],
      rows: (data?.byCourse ?? []).map((r) => [r.course, r.groups, r.teachers, r.students, pct(r.students, students)]),
    },
    {
      title: t("Guruh bo'yicha"),
      columns: [{ label: t("Guruh") }, { label: t("Kurs") }, { label: t("O'qituvchi") }, { label: t("O'quvchilar"), numeric: true }],
      rows: groups.map((g) => [g.label, groupText(g), g.teacher || null, g.students]),
    },
    {
      title: t("O'qituvchi bo'yicha"),
      columns: [{ label: t("O'qituvchi") }, { label: t("Kurslar") }, { label: t("Guruhlar"), numeric: true }, { label: t("O'quvchilar"), numeric: true }],
      rows: teachers.map((r) => [r.teacher, r.courses.join(", "), r.groups, r.students]),
    },
  ];

  function getDoc(): ExportDoc | null {
    if (!data) return null;
    return {
      title: t("{name} hisoboti", { name: t(report.title) }),
      fileBase: `${fileSafe(t(report.title))}-${today}`,
      center: t(CENTER_NAME),
      branchLabel: branchName,
      dateLabel: f.fullDate(today),
      author,
      filters: [t("{date} holatiga", { date: f.dayMonth(today) }), branchName, course || t("Barcha kurslar")].join(" · "),
      kpis: [
        { label: t("Faol o'quvchilar"), value: fmtNum(students) },
        { label: t("Guruhlar"), value: fmtNum(groups.length) },
        { label: t("O'qituvchilar"), value: fmtNum(teachers.length) },
        { label: t("O'rtacha guruh"), value: t("{n} o'quvchi", { n: avg }) },
      ],
      sections: sections(),
      notes: [t("Faol — hozir guruhda o'qiyotgan o'quvchi. Jami sonida bir nechta guruhdagisi bir marta sanaladi, guruhlar ro'yxatida — har guruhida.")],
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
          <V2Select variant="value" label={t("Filial")} emptyLabel="Barchasi" value={branch} onChange={setBranch} options={branchOptions} searchable={false} />
          <V2Select variant="value" label={t("Kurs")} emptyLabel="Hammasi" value={course} onChange={setCourse} options={courseOptions} />
        </>
      }
      filtersEnd={
        <div className="w-[300px] max-w-full">
          <Segmented
            value={view}
            onChange={(v) => setView(v as View)}
            label={t("Kesim")}
            options={[
              { value: "course", label: t("Kurs") },
              { value: "group", label: t("Guruh") },
              { value: "teacher", label: t("O'qituvchi") },
            ]}
          />
        </div>
      }
    >
      {error && <ErrorBanner message="Hisobot yuklanmadi" onRetry={reload} />}
      <div className={stale ? "opacity-60 transition-opacity" : ""}>
        <KpiStrip
          loading={loading}
          cells={[
            { key: "s", label: t("Faol o'quvchilar"), value: fmtNum(students), sub: t("hozir guruhda o'qiyotgan") },
            { key: "g", label: t("Guruhlar"), value: fmtNum(groups.length), sub: emptyGroups > 0 ? t("yana {n} ta guruh bo'sh", { n: emptyGroups }) : t("o'quvchisi bor guruhlar") },
            { key: "t", label: t("O'qituvchilar"), value: fmtNum(teachers.length), sub: t("guruhi bor o'qituvchilar") },
            { key: "a", label: t("O'rtacha guruh"), value: fmtNum(avg), unit: t("o'quvchi"), sub: data && data.multiGroup > 0 ? t("{n} o'quvchi 2+ guruhda", { n: data.multiGroup }) : t("har guruhda") },
          ]}
        />
      </div>

      <div className={stale ? "opacity-60 transition-opacity" : ""}>
        {view === "course" ? (
          <ReportTable
            cols={courseCols}
            rows={(data?.byCourse ?? []).filter((r) => r.students > 0)}
            rowKey={(r) => r.course}
            loading={loading}
            empty={t("Hozir guruhda o'qiyotgan o'quvchi yo'q")}
            minWidth={560}
            total={[t("Jami"), fmtNum(groups.length), fmtNum(teachers.length), fmtNum(students), "100%"]}
          />
        ) : view === "group" ? (
          <ReportTable cols={groupCols} rows={groups} rowKey={(g) => g.id} loading={loading} empty={t("Hozir guruhda o'qiyotgan o'quvchi yo'q")} minWidth={560} total={[t("Jami · {n} ta guruh", { n: groups.length }), null, fmtNum(groups.reduce((s, g) => s + g.students, 0))]} />
        ) : (
          <ReportTable cols={teacherCols} rows={teachers} rowKey={(r) => r.teacher} loading={loading} empty={t("Hozir guruhda o'qiyotgan o'quvchi yo'q")} minWidth={560} total={[t("Jami"), null, fmtNum(groups.length), fmtNum(students)]} />
        )}
      </div>

      <NoteLine>{t("Faol — hozir guruhda o'qiyotgan o'quvchi. Jami sonida bir nechta guruhdagisi bir marta sanaladi, guruhlar ro'yxatida — har guruhida.")}</NoteLine>
    </ReportShell>
  );
}
