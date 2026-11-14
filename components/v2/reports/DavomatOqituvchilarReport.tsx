"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, ChevronDown, ChevronRight, Clock } from "lucide-react";
import Link from "@/components/ui/Link";
import type { DateRange } from "@/components/ui/DateRangePicker";
import { useBranch } from "@/components/shared/BranchContext";
import { useT, type TFn } from "@/components/shared/Language";
import { Segmented } from "@/components/v2/form/fields";
import V2DateRange, { rangeLabel } from "@/components/v2/ui/V2DateRange";
import V2Select from "@/components/v2/ui/V2Select";
import { branchPool } from "@/lib/branchPools";
import type { TeacherAttReport, TeacherAttRow } from "@/lib/reportAttendanceTeachers";
import type { ReportDef } from "@/lib/reportsCatalog";
import { CENTER_NAME, DOC_FOOTER, useBranchOptions, useReportData, useReportFmt, useToday } from "./reportHooks";
import { dateOfIso, fileSafe, fmtNum, initialsOf, isoOf } from "./reportFormat";
import type { ExportDoc } from "./reportExport";
import { ErrorBanner, KpiStrip, NoteLine, ReportShell } from "./reportUi";

// YANGI VERSIYA — HISOBOTLAR → DAVOMAT → «O'QITUVCHILAR BO'YICHA» (27-qism, rasmlar 53–54
// «Davomat · O'qituvchilar bo'yicha · Yorug'/Qorong'i»): sana oralig'i, Filial, o'ngda
// «Guruhlar bo'yicha | O'qituvchilar bo'yicha»; Darslar · Vaqtida belgilangan · Kechikib yoki
// belgilanmagan · Guruhlarida davomat; jadval filial → o'qituvchi. Hisob —
// /api/reports/attendance-teachers + lib/reportAttendanceTeachers.ts.
//
// RASMDAN FARQ (SAVOLLAR G1–G4): «Jurnal yozilgan» (mavzu va uy vazifasi) — tizimda dars
// mavzusi yozilmaydi, ustun va kartochka o'rnida guruhlardagi qatnashish; muddat — rasmdagi
// 30 emas, «davomat qilinmagan» xabari bilan bir xil (lib/attendanceAlert.ts); 1+2 Chortoq —
// bitta filial (lib/branchPools.ts).
//
// FILTRLAR URL'dan (`?from&to&branch`) — «Guruhlar bo'yicha» bilan almashganda saqlanadi;
// `course` bu sahifada ishlatilmaydi, lekin qaytishda o'sha sahifaga uzatiladi.

type Resp = TeacherAttReport & { ok: true; branch: "all" | number };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const th = "h-9 px-4 text-v2-caption font-medium text-v2-text-2";
const td = "px-4 py-2.5 align-top";
const num = "text-right tabular-nums";

interface Sums {
  groups: number;
  lessons: number;
  onTime: number;
  late: number;
  unknown: number;
  unmarked: number;
  marks: number;
  present: number;
}

interface BranchNode {
  id: number;
  rows: TeacherAttRow[];
  sums: Sums;
}

const ZERO: Sums = { groups: 0, lessons: 0, onTime: 0, late: 0, unknown: 0, unmarked: 0, marks: 0, present: 0 };

function addSums(a: Sums, r: Sums): Sums {
  return {
    groups: a.groups + r.groups,
    lessons: a.lessons + r.lessons,
    onTime: a.onTime + r.onTime,
    late: a.late + r.late,
    unknown: a.unknown + r.unknown,
    unmarked: a.unmarked + r.unmarked,
    marks: a.marks + r.marks,
    present: a.present + r.present,
  };
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

export default function DavomatOqituvchilarReport({ report, author }: { report: ReportDef; author: string }) {
  const { t, lang } = useT();
  const f = useReportFmt();
  const today = useToday();
  const router = useRouter();
  const sp = useSearchParams();
  const branchOptions = useBranchOptions();
  const { branchId: currentBranch } = useBranch();

  const [range, setRange] = useState<DateRange>(() => {
    const qf = sp.get("from") ?? "";
    const qt = sp.get("to") ?? "";
    const end = ISO.test(qt) ? (qt > today ? today : qt) : today;
    const start = ISO.test(qf) && qf <= end ? qf : `${end.slice(0, 7)}-01`;
    return { start: dateOfIso(start), end: dateOfIso(end) };
  });
  const [branch, setBranch] = useState(() => (/^\d+$/.test(sp.get("branch") ?? "") ? String(sp.get("branch")) : ""));
  // Ochiq filiallar; `null` — sukut (joriy filial, bo'lmasa birinchisi).
  const [openSet, setOpenSet] = useState<Set<number> | null>(null);

  const from = range.start ? isoOf(range.start) : `${today.slice(0, 7)}-01`;
  const rawTo = range.start ? isoOf(range.end ?? range.start) : today;
  const to = rawTo > today ? today : rawTo;
  const params = { from: from > to ? to : from, to, ...(branch ? { branch } : {}) };
  const { data, loading, stale, error, reload } = useReportData<Resp>(`/api/reports/attendance-teachers?${new URLSearchParams(params)}`);

  const tree = useMemo<BranchNode[]>(() => {
    const out: BranchNode[] = [];
    for (const r of data?.rows ?? []) {
      let b = out.find((x) => x.id === r.branchId);
      if (!b) out.push((b = { id: r.branchId, rows: [], sums: ZERO }));
      b.rows.push(r);
      b.sums = addSums(b.sums, r);
    }
    return out;
  }, [data]);

  const tot = data?.totals;
  const deadline = data?.deadlineMin ?? 10;
  const ready = !!data && !stale;
  const currentHead = currentBranch != null ? branchPool(currentBranch)[0] : null;
  const defaultOpen = tree.length === 1 ? tree[0].id : (tree.find((b) => b.id === currentHead)?.id ?? tree[0]?.id ?? null);
  const opened = openSet ?? new Set(defaultOpen !== null ? [defaultOpen] : []);

  const branchName = (id: number) => data?.branches.find((b) => b.id === id)?.name || `#${id}`;
  const branchLabel = branch ? (branchOptions.find((b) => b.value === branch)?.label ?? branchName(branchPool(Number(branch))[0])) : t("Barcha filiallar");
  const period = rangeLabel(range, lang, t);
  const teacherName = (r: TeacherAttRow) => r.teacher || t("O'qituvchi biriktirilmagan");

  function toggleBranch(id: number) {
    setOpenSet(() => {
      const next = new Set(opened);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toGroups() {
    const q = new URLSearchParams(params);
    const course = sp.get("course");
    if (course) q.set("course", course);
    router.push(`/reports/davomat-guruhlar?${q}`);
  }

  const kpiLate = tot ? tot.late + tot.unmarked : 0;
  const notes = {
    rule: t("Davomat dars tugagach {m} daqiqa ichida belgilanishi kerak — keyin rahbarga «davomat qilinmagan» xabari ketadi (yoqilgan bo'lsa):", { m: deadline }),
    how: t("Vaqt — darsning birinchi belgisi qo'yilgan payt (davomat tarixi). Muddatdan keyin belgilangan dars «Kechikib», birorta belgisi yo'q dars «Belgilanmagan» bo'ladi."),
    same: t("Darslar va «Guruhlarida davomat» — «Guruhlar bo'yicha» bilan bir xil hisob. O'qituvchi — guruhning hozirgi ustozi."),
    journal: t("Dars mavzusi va uy vazifasi tizimda yozilmaydi — «Jurnal yozilgan» o'rnida guruhlardagi qatnashish."),
    pending: tot && tot.pending > 0 ? t("Bugungi yana {n} dars hali tugamagan yoki {m} daqiqasi o'tmagan — hisobga kirmadi.", { n: tot.pending, m: deadline }) : null,
    unknown:
      tot && tot.unknown > 0
        ? t("{n} darsning qachon belgilangani noma'lum — davomat tarixi {date} dan yoziladi; ular vaqtida ham, kechikib ham hisoblanmadi.", {
            n: tot.unknown,
            date: data?.historyStart ? f.fullDate(data.historyStart) : "—",
          })
        : null,
  };

  function getDoc(): ExportDoc | null {
    if (!data || !tot) return null;
    const rowCells = (r: Sums) => [r.groups, r.lessons, r.onTime, r.late, r.unmarked, r.unknown, r.marks ? Math.round((r.present / r.marks) * 100) : null];
    return {
      title: t("{name} hisoboti", { name: `${t("Davomat")} · ${t(report.title)}` }),
      fileBase: `${fileSafe(`${t("Davomat")} ${t(report.title)}`)}-${params.to}`,
      center: t(CENTER_NAME),
      branchLabel,
      dateLabel: f.fullDate(today),
      author,
      filters: [period, branchLabel].join(" · "),
      kpis: [
        { label: t("Darslar"), value: fmtNum(tot.lessons) },
        { label: t("Vaqtida belgilangan"), value: pct(ratio(tot.onTime, tot.lessons)) },
        { label: t("Kechikib yoki belgilanmagan"), value: fmtNum(kpiLate) },
        { label: t("Guruhlarida davomat"), value: pct(ratio(tot.present, tot.marks)) },
      ],
      sections: [
        {
          columns: [
            { label: t("Filial") },
            { label: t("O'qituvchi") },
            { label: t("Kurslar"), key: "courses" },
            { label: t("Guruhlar"), numeric: true },
            { label: t("Darslar"), numeric: true },
            { label: t("Vaqtida"), numeric: true },
            { label: t("Kechikib"), numeric: true },
            { label: t("Belgilanmagan"), numeric: true },
            { label: t("Vaqti noma'lum"), numeric: true, key: "unknown" },
            { label: t("Guruhlarida davomat, %"), numeric: true },
          ],
          rows: tree.flatMap((b) => b.rows.map((r) => [branchName(b.id), teacherName(r), r.courses.join(", ") || null, ...rowCells(r)])),
          total: [t("Jami"), t("{n} o'qituvchi", { n: tot.teachers }), null, ...rowCells(tot)],
        },
      ],
      notes: [notes.rule, notes.how, notes.same, notes.journal, notes.pending, notes.unknown].filter((x): x is string => !!x),
      footer: DOC_FOOTER,
    };
  }

  const header = [
    { key: "n", label: t("O'qituvchi"), cls: "text-left" },
    { key: "g", label: t("Guruhlar"), cls: "text-right" },
    { key: "l", label: t("Darslar"), cls: "text-right" },
    { key: "v", label: t("Vaqtida"), cls: "text-right" },
    { key: "k", label: t("Kechikib"), cls: "text-right" },
    { key: "b", label: t("Belgilanmagan"), cls: "text-right" },
    { key: "d", label: t("Guruhlarida davomat"), cls: "text-right" },
  ];

  return (
    <ReportShell
      report={report}
      subtitle={`${t("Davomat va dars jurnali o'z vaqtida yozilyaptimi")} · ${branch ? branchLabel : t("barcha filiallar")}`}
      getDoc={getDoc}
      exportReady={ready}
      filters={
        <>
          <V2DateRange value={range} onChange={setRange} allowAll={false} align="start" />
          <V2Select variant="value" label={t("Filial")} emptyLabel="Barchasi" value={branch} onChange={setBranch} options={branchOptions} searchable={false} />
        </>
      }
      filtersEnd={
        <div className="w-[340px] max-w-full">
          <Segmented
            label={t("Davomat hisoboti ko'rinishi")}
            value="teachers"
            onChange={(v) => {
              if (v === "groups") toGroups();
            }}
            options={[
              { value: "groups", label: t("Guruhlar bo'yicha") },
              { value: "teachers", label: t("O'qituvchilar bo'yicha") },
            ]}
          />
        </div>
      }
    >
      {error && <ErrorBanner message="Hisobot yuklanmadi" onRetry={reload} />}
      <KpiStrip
        loading={loading}
        cells={[
          {
            key: "l",
            label: t("Darslar"),
            value: tot ? fmtNum(tot.lessons) : null,
            sub: tot ? t("{a} o'qituvchi · {b} guruh", { a: tot.teachers, b: tot.groups }) : null,
          },
          {
            key: "v",
            label: t("Vaqtida belgilangan"),
            value: tot ? pct(ratio(tot.onTime, tot.lessons)) : null,
            sub: tot ? t("{n} dars · tugagach {m} daqiqa ichida", { n: fmtNum(tot.onTime), m: deadline }) : null,
          },
          {
            key: "k",
            label: t("Kechikib yoki belgilanmagan"),
            icon: <Clock className="size-3.5 shrink-0 text-v2-warning" strokeWidth={1.75} aria-hidden />,
            value: tot ? fmtNum(kpiLate) : null,
            sub: tot ? t("{a} kechikib · {b} belgilanmagan", { a: fmtNum(tot.late), b: fmtNum(tot.unmarked) }) : null,
          },
          {
            key: "d",
            label: t("Guruhlarida davomat"),
            value: tot ? pct(ratio(tot.present, tot.marks)) : null,
            sub: tot ? t("{a} / {b} belgi · darsga kelgan", { a: fmtNum(tot.present), b: fmtNum(tot.marks) }) : null,
          },
        ]}
      />

      <section className={`relative overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm transition-opacity ${stale ? "opacity-60" : ""}`}>
        <div className="relative overflow-x-auto">
          <table className="w-full border-collapse text-v2-body" style={{ minWidth: 920 }}>
            <caption className="sr-only">{t(report.title)}</caption>
            <thead>
              <tr className="border-b border-v2-border bg-v2-surface-2">
                {header.map((h) => (
                  <th key={h.key} scope="col" className={`${th} ${h.cls}`}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="border-b border-v2-border last:border-b-0" aria-hidden>
                    {header.map((h, j) => (
                      <td key={h.key} className={`${td} ${j ? num : ""}`}>
                        <span className={`inline-block h-3 rounded bg-v2-skeleton ${j ? "w-10" : "w-44"}`} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : tree.length === 0 ? (
                <tr>
                  <td colSpan={header.length} className="px-4 py-10 text-center text-v2-small text-v2-text-2">
                    {t("Tanlangan davrda dars yo'q")}
                  </td>
                </tr>
              ) : (
                tree.map((b) => {
                  const bOpen = opened.has(b.id);
                  return (
                    <Fragment key={b.id}>
                      <tr className="border-b border-v2-border bg-v2-surface-2/60">
                        <td className={td}>
                          <button
                            type="button"
                            onClick={() => toggleBranch(b.id)}
                            aria-expanded={bOpen}
                            className="flex min-w-0 items-center gap-2 rounded-v2-sm text-left focus-visible:shadow-v2-focus focus-visible:outline-none"
                          >
                            <Chevron open={bOpen} />
                            <Building2 className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                            <span className="min-w-0">
                              <span className="block font-semibold text-v2-text">{branchName(b.id)}</span>
                              <span className="block text-v2-caption text-v2-text-2">{t("{n} o'qituvchi", { n: b.rows.length })}</span>
                            </span>
                          </button>
                        </td>
                        <NumCells s={b.sums} t={t} strong />
                      </tr>
                      {bOpen &&
                        b.rows.map((r) => (
                          <tr key={r.key} className="border-b border-v2-border">
                            <td className={`${td} pl-10`}>
                              <span className="flex min-w-0 items-start gap-2.5">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2" aria-hidden>
                                  {r.teacher ? initialsOf(r.teacher) : "—"}
                                </span>
                                <span className="min-w-0">
                                  <span className={`block font-medium ${r.teacher ? "text-v2-text" : "text-v2-text-2"}`}>{teacherName(r)}</span>
                                  {r.courses.length > 0 && <span className="block text-v2-caption text-v2-text-2">{r.courses.join(", ")}</span>}
                                </span>
                              </span>
                            </td>
                            <NumCells s={r} t={t} />
                          </tr>
                        ))}
                    </Fragment>
                  );
                })
              )}
            </tbody>
            {!loading && tot && tree.length > 0 && (
              <tfoot>
                <tr className="border-t border-v2-border bg-v2-surface-2 font-semibold">
                  <td className={td}>
                    {t("Jami")} · <span className="font-normal text-v2-text-2">{t("{n} o'qituvchi", { n: tot.teachers })}</span>
                  </td>
                  <NumCells s={tot} t={t} strong />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <p className="flex items-start gap-1.5 text-v2-caption font-normal text-v2-text-2">
        <Clock className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        <span>
          {notes.rule} <NoteLink href="/settings-nazorat">{t("Sozlamalar → Nazorat qoidalari")}</NoteLink>. {notes.how}
        </span>
      </p>
      {notes.pending && <NoteLine>{notes.pending}</NoteLine>}
      {notes.unknown && <NoteLine>{notes.unknown}</NoteLine>}
      <NoteLine>
        {t("Darslar va «Guruhlarida davomat» —")}{" "}
        <NoteLink href={`/reports/davomat-guruhlar?${new URLSearchParams(params)}`}>{t("Guruhlar bo'yicha")}</NoteLink>{" "}
        {t("hisoboti bilan bir xil. O'qituvchi — guruhning hozirgi ustozi.")}
      </NoteLine>
      <NoteLine>{notes.journal}</NoteLine>
    </ReportShell>
  );
}

/* ───────────────────────── Bo'laklar ───────────────────────── */

function NoteLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="rounded-v2-sm text-v2-brand-text underline-offset-2 hover:underline focus-visible:shadow-v2-focus focus-visible:outline-none">
      {children}
    </Link>
  );
}

function Chevron({ open }: { open: boolean }) {
  const Icon = open ? ChevronDown : ChevronRight;
  return <Icon className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />;
}

/** Filial / o'qituvchi / jami qatorining raqam kataklari. */
function NumCells({ s, t, strong }: { s: Sums; t: TFn; strong?: boolean }) {
  const w = strong ? "font-semibold" : "font-medium";
  const count = (n: number, tone: string) => (
    <td className={`${td} ${num}`}>
      <span className={n > 0 ? `${w} ${tone}` : "text-v2-text-3"}>{fmtNum(n)}</span>
    </td>
  );
  return (
    <>
      <td className={`${td} ${num} ${w} text-v2-text`}>{fmtNum(s.groups)}</td>
      <td className={`${td} ${num} ${w} text-v2-text`}>{fmtNum(s.lessons)}</td>
      <td className={`${td} ${num}`}>
        <span className={`${w} text-v2-text`}>{fmtNum(s.onTime)}</span>
        {s.unknown > 0 && <span className="block text-v2-caption font-normal text-v2-text-3">{t("{n} noma'lum", { n: fmtNum(s.unknown) })}</span>}
      </td>
      {count(s.late, "text-v2-warning")}
      {count(s.unmarked, "text-v2-danger")}
      <td className={`${td} ${num}`}>
        <PctBar value={ratio(s.present, s.marks)} />
      </td>
    </>
  );
}

/** Qatnashish: chiziq + foiz — «Guruhlar bo'yicha» bilan bir xil (90% va undan yuqori — asosiy rang, pastrog'i — ogohlantirish). */
function PctBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-v2-text-3">—</span>;
  const p = Math.round(value * 100);
  return (
    <span className="inline-flex items-center justify-end gap-3">
      <span className="block h-1.5 w-[100px] overflow-hidden rounded-full bg-v2-track" aria-hidden>
        <span className={`block h-full rounded-full ${p >= 90 ? "bg-v2-brand" : "bg-v2-warning"}`} style={{ width: `${Math.max(3, Math.min(100, p))}%` }} />
      </span>
      <span className="w-10 text-right font-semibold tabular-nums text-v2-text">{p}%</span>
    </span>
  );
}
