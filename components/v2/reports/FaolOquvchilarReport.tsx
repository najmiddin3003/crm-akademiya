"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, Building2, Calendar, ChevronDown, ChevronRight } from "lucide-react";
import Link from "@/components/ui/Link";
import { useBranch } from "@/components/shared/BranchContext";
import { useT, type TFn } from "@/components/shared/Language";
import V2DateField from "@/components/v2/form/V2DateField";
import { Segmented } from "@/components/v2/form/fields";
import { categoryDotCls } from "@/components/v2/settings/courseBits";
import V2Select from "@/components/v2/ui/V2Select";
import { panelTriggerCls } from "@/components/v2/ui/buttons";
import { branchPool } from "@/lib/branchPools";
import type { ActiveBranchRow, ActiveCounts, ActiveCourseRow, ActiveGroupRow, ActiveStudentsReport, ActiveTeacherRow } from "@/lib/reportStudents";
import type { ReportDef } from "@/lib/reportsCatalog";
import { CENTER_NAME, DOC_FOOTER, useBranchOptions, useReportData, useReportFmt, useToday } from "./reportHooks";
import { dateOfIso, fileSafe, fmtNum, initialsOf, isoOf, shortPersonName } from "./reportFormat";
import type { Cell, ExportColumn, ExportDoc } from "./reportExport";
import { ErrorBanner, KpiStrip, NoteLine, ReportShell } from "./reportUi";

// YANGI VERSIYA — HISOBOTLAR → O'QUVCHILAR OQIMI → «FAOL O'QUVCHILAR» (27-qism, rasmlar 47–50
// «Faol o'quvchilar · Kurs/Guruh · Yorug'/Qorong'i»): tanlangan kun holatiga guruhda
// o'qiyotganlar.
//   • filtrlar — «<kun> holatiga», Filial, Kategoriya; o'ngda Kurs | Guruh | O'qituvchi;
//   • kartalar — Faol o'quvchilar (oy boshidan grafik, +/−), Guruhlar, Sig'im to'lishi,
//     Qarzdorlar (Qarzdorlar hisobotiga havola);
//   • Kurs — kategoriya bo'yicha guruhlangan kurslar; Guruh — filial → guruh (ochiladi);
//     O'qituvchi — filial → o'qituvchi (rasmi yo'q, Guruh qolipida, SAVOLLAR E3).
// Sonlar mavjud sahifalar bilan bir xil: o'quvchilar — «Kelgan va ketgan», qarzdorlar —
// «Qarzdorlar», sig'im — «Bo'sh o'rinlar». Hisob — /api/reports/active-students,
// lib/reportStudents.ts (computeActiveStudents) va lib/reportActiveSeats.ts.

type Resp = ActiveStudentsReport & { ok: true; branch: "all" | number };
export type FaolView = "course" | "group" | "teacher";

/** Kategoriya filtridagi «Kategoriyasiz» (lib/reportStudents.ts → NO_CATEGORY; server faylini mijozga tortmaslik uchun nusxa). */
const NO_CATEGORY = "-";

const th = "h-9 px-4 text-v2-caption font-medium text-v2-text-2 whitespace-nowrap";
const td = "px-4 py-2.5 align-middle";
const num = "text-right tabular-nums";
const dash = <span className="text-v2-text-3">—</span>;

/** Sig'im to'lishi (%) — sig'imi ma'lum guruhlar bo'yicha; yo'q — null. */
const fillPct = (c: ActiveCounts) => (c.capacity ? Math.round((c.capSeats / c.capacity) * 100) : null);

export default function FaolOquvchilarReport({ report, author, initialView = "course" }: { report: ReportDef; author: string; initialView?: FaolView }) {
  const { t, lang } = useT();
  const f = useReportFmt();
  const today = useToday();
  const branchCtx = useBranch();
  const branchOptions = useBranchOptions();
  const [date, setDate] = useState(today);
  const [branch, setBranch] = useState("");
  const [category, setCategory] = useState("");
  const [view, setView] = useState<FaolView>(initialView);
  // Ochiq filiallar (Guruh/O'qituvchi); `null` — sukut: navbar filiali ochiq (rasmdagidek).
  const [openSet, setOpenSet] = useState<Set<number> | null>(null);

  const url = `/api/reports/active-students?${new URLSearchParams({ date, ...(branch ? { branch } : {}), ...(category ? { category } : {}) })}`;
  const { data, loading, stale, error, reload } = useReportData<Resp>(url);

  const asOf = data?.asOf ?? date;
  const mk = data?.month ?? date.slice(0, 7);
  const branchName = branch ? (branchOptions.find((b) => b.value === branch)?.label ?? "") : t("Barcha filiallar");
  const branchLower = branch ? branchName : t("barcha filiallar");
  const asOfText = t("{date} holatiga", { date: f.dayMonth(date) });
  const stampText = t("{date} holatiga", { date: data?.time ? f.stamp(asOf, data.time) : f.dayMonth(asOf) });
  const monthCol = t("{month}da", { month: f.monthName(mk) });
  const categoryOptions = useMemo(() => {
    const list = (data?.categoryOptions ?? []).map((c) => ({ value: c, label: c }));
    if (data?.hasUncategorized) list.push({ value: NO_CATEGORY, label: t("Kategoriyasiz") });
    return list;
  }, [data?.categoryOptions, data?.hasUncategorized, t]);
  const categoryName = category === NO_CATEGORY ? t("Kategoriyasiz") : category || t("Barcha kategoriyalar");

  const tot = data?.totals ?? null;
  const branches = useMemo(() => data?.branches ?? [], [data?.branches]);
  const navPool = branchCtx.branchId !== null ? (branchPool(branchCtx.branchId)[0] ?? branchCtx.branchId) : null;
  const opened = useMemo(() => {
    if (openSet) return openSet;
    if (branches.length === 1) return new Set([branches[0].branchId]);
    const pick = branches.find((b) => b.branchId === navPool) ?? branches[0];
    return new Set(pick ? [pick.branchId] : []);
  }, [openSet, branches, navPool]);
  const toggle = (id: number) =>
    setOpenSet(() => {
      const next = new Set(opened);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pickDate = (d: Date) => {
    let iso = isoOf(d);
    if (iso > today) iso = today;
    if (data?.historyStart && iso < data.historyStart) iso = data.historyStart;
    setDate(iso);
  };
  const dec1 = (v: number) => (lang === "en" ? v.toFixed(1) : v.toFixed(1).replace(".", ","));

  /* ── Ko'rsatkichlar ── */
  const avg = tot && tot.groups > 0 ? dec1(tot.seats / tot.groups) : "0";
  const fill = tot ? fillPct(tot) : null;
  const multiText = (n: number) => t("{n} nafari 2+ guruhda", { n });
  const flowText = (c: { came: number | null; left: number | null }) => (c.came === null || c.left === null ? "—" : `+${fmtNum(c.came)} / −${fmtNum(c.left)}`);
  const activeSub =
    data && data.studentsPrev !== null
      ? `${t("{date}da {n}", { date: f.dayMonth(`${mk}-01`), n: fmtNum(data.studentsPrev) })} · ${t("{month}da {flow}", { month: f.monthLower(mk), flow: flowText(data.totals) })}`
      : t("o'tgan oy bilan taqqoslab bo'lmaydi");

  /* ── Izohlar ── */
  const notes = (): string[] => {
    if (!data || !tot) return [];
    const capNote = `${t("Sig'im — guruh xonasining sig'imi (O'quv bo'limi → Bo'sh o'rinlar bilan bir xil).")}${
      tot.noCapGroups > 0 ? ` ${t("Xonasiga sig'im kiritilmagan {n} ta guruh foizga kirmaydi.", { n: tot.noCapGroups })}` : ""
    }`;
    const out: string[] = [];
    if (view === "course") {
      out.push(t("{multi} o'quvchi bir nechta guruhda o'qiydi, shuning uchun jami {seats} o'rin. O'quvchilar soni ({n}) «Kelgan va ketgan» hisoboti bilan bir xil.", { multi: data.multiGroup, seats: fmtNum(tot.seats), n: fmtNum(data.students) }));
      out.push(t("To'lagan — {month} oxirigacha bo'lgan darslar to'langan. Muddati kelmagan — qarz yo'q, lekin {month}ning qolgan darslari hali to'lanmagan. Qarzdor — o'tgan darslar to'lanmagan yoki qisman to'langan (Qarzdorlar hisoboti qoidasi).", { month: f.monthLower(mk) }));
      out.push(capNote);
    } else if (view === "group") {
      out.push(capNote);
      out.push(t("Guruhni bosing — o'quvchilar ro'yxati va to'lov holati guruh sahifasida ochiladi."));
    } else {
      out.push(capNote);
      out.push(t("O'qituvchi bir nechta filialda dars bersa — har filialda alohida qatorda."));
    }
    if (data.studentsPrev === null) out.push(t("A'zolik tarixi {date} dan yuritiladi — undan oldingi oy bilan taqqoslab bo'lmaydi.", { date: f.fullDate(data.historyStart) }));
    if (tot.unknownPrice > 0) out.push(t("{n} o'rin narxi yoki jadvali kiritilmagan guruhlarda — to'lov holati taxminiy.", { n: tot.unknownPrice }));
    if (data.debtors.inReport > data.debtors.students) {
      out.push(t("Qarzdorlar hisobotida jami {n} nafar — {k} nafari endi guruhda o'qimaydi, qarzi qolgan.", { n: data.debtors.inReport, k: data.debtors.inReport - data.debtors.students }));
    }
    return out;
  };

  /* ── Eksport (faol kesim) ── */
  function getDoc(): ExportDoc | null {
    if (!data || !tot) return null;
    const metricCols: ExportColumn[] = [
      { label: t("O'quvchilar"), numeric: true },
      { label: t("{month}da kelgan", { month: f.monthName(mk) }), numeric: true },
      { label: t("{month}da ketgan", { month: f.monthName(mk) }), numeric: true },
      { label: t("To'lagan"), numeric: true },
      { label: t("Qarzdor"), numeric: true },
      { label: t("Muddati kelmagan"), numeric: true },
      { label: t("Sig'im"), numeric: true },
      { label: t("Sig'im to'lishi") },
    ];
    const metrics = (c: ActiveCounts): Cell[] => {
      const p = fillPct(c);
      return [c.seats, c.came, c.left, c.paid, c.debt, c.notDue, c.capacity, p === null ? null : `${p}%`];
    };
    const catLabel = (c: string) => c || t("Kategoriyasiz");
    const bName = (id: number) => branches.find((b) => b.branchId === id)?.name ?? "";
    const section =
      view === "course"
        ? {
            title: t("Kurs bo'yicha"),
            columns: [{ label: t("Kategoriya") }, { label: t("Kurs") }, { label: t("Guruhlar"), numeric: true }, ...metricCols],
            rows: data.courses.map((c) => [catLabel(c.category), c.course, c.groups, ...metrics(c)]),
            total: [t("Jami"), null, tot.groups, ...metrics(tot)],
          }
        : view === "group"
          ? {
              title: t("Guruh bo'yicha"),
              columns: [{ label: t("Filial") }, { label: t("Guruh") }, { label: t("Kurs") }, { label: t("O'qituvchi") }, ...metricCols],
              rows: [...data.groups]
                .sort((a, b) => a.branchId - b.branchId || Number(a.gone) - Number(b.gone) || b.seats - a.seats)
                .map((g) => [bName(g.branchId), g.gone ? `${g.label} (${t("arxivlangan")})` : g.label, [g.course, g.level].filter(Boolean).join(" · ") || null, g.teacher || null, ...metrics(g)]),
              total: [t("Jami"), t("{n} guruh", { n: tot.groups }), null, null, ...metrics(tot)],
            }
          : {
              title: t("O'qituvchi bo'yicha"),
              columns: [{ label: t("Filial") }, { label: t("O'qituvchi") }, { label: t("Kurslar") }, { label: t("Guruhlar"), numeric: true }, ...metricCols],
              rows: data.teachers.map((x) => [bName(x.branchId), x.teacher, x.courses.join(", ") || null, x.groups, ...metrics(x)]),
              total: [t("Jami"), null, null, tot.groups, ...metrics(tot)],
            };
    const viewName = view === "course" ? t("Kurs") : view === "group" ? t("Guruh") : t("O'qituvchi");
    return {
      title: t("{name} hisoboti", { name: t(report.title) }),
      fileBase: `${fileSafe(t(report.title))}-${fileSafe(viewName)}-${asOf}`,
      center: t(CENTER_NAME),
      branchLabel: branchName,
      dateLabel: f.fullDate(today),
      author,
      filters: [stampText, branchName, categoryName, viewName].join(" · "),
      kpis: [
        { label: t("Faol o'quvchilar"), value: fmtNum(data.students) },
        { label: t("Guruhlar"), value: fmtNum(tot.groups) },
        { label: t("Sig'im to'lishi"), value: fill === null ? "—" : `${fill}% (${fmtNum(tot.capSeats)} / ${fmtNum(tot.capacity ?? 0)})` },
        { label: t("Qarzdorlar"), value: `${t("{n} o'quvchi", { n: data.debtors.students })} · ${t("{n} o'rin", { n: data.debtors.seats })}` },
      ],
      sections: [section],
      notes: notes(),
      footer: DOC_FOOTER,
    };
  }

  const multiLine = data && data.multiGroup > 0 ? ` · ${multiText(data.multiGroup)}` : "";
  const hasRows = !!data && data.groups.length > 0;

  return (
    <ReportShell
      report={report}
      subtitle={`${stampText} · ${branchLower}`}
      getDoc={getDoc}
      exportReady={!!data && !stale}
      filters={
        <>
          <V2DateField
            value={dateOfIso(date)}
            onChange={pickDate}
            trigger={(p, open) => (
              <button type="button" {...p} className={panelTriggerCls(open)}>
                <Calendar className="size-4 text-v2-text-2" strokeWidth={1.75} aria-hidden />
                <span className="whitespace-nowrap font-semibold">{asOfText}</span>
                <ChevronDown className={`size-4 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
              </button>
            )}
          />
          <V2Select variant="value" label={t("Filial")} emptyLabel="Barchasi" value={branch} onChange={(v) => { setBranch(v); setOpenSet(null); }} options={branchOptions} searchable={false} />
          <V2Select variant="value" label={t("Kategoriya")} emptyLabel="Hammasi" value={category} onChange={setCategory} options={categoryOptions} searchable={false} />
        </>
      }
      filtersEnd={
        <div className="w-[300px] max-w-full">
          <Segmented
            value={view}
            onChange={(v) => setView(v as FaolView)}
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
            { key: "s", label: t("Faol o'quvchilar"), value: data ? fmtNum(data.students) : null, spark: data?.spark, sub: <Wrap>{activeSub}</Wrap> },
            {
              key: "g",
              label: t("Guruhlar"),
              value: tot ? fmtNum(tot.groups) : null,
              sub: <Wrap>{`${t("o'rtacha {avg} o'quvchi", { avg })}${multiLine}`}</Wrap>,
            },
            {
              key: "c",
              label: t("Sig'im to'lishi"),
              value: fill === null ? null : `${fill}%`,
              sub: (
                <Wrap>
                  {tot && tot.capacity
                    ? t("{seats} / {cap} o'rin · {free} bo'sh", { seats: fmtNum(tot.capSeats), cap: fmtNum(tot.capacity), free: fmtNum(tot.free) })
                    : t("xonalarga sig'im kiritilmagan")}
                </Wrap>
              ),
            },
            {
              key: "d",
              label: t("Qarzdorlar"),
              icon: <AlertCircle className="size-3.5 shrink-0 text-v2-danger" strokeWidth={1.75} aria-hidden />,
              value: data ? fmtNum(data.debtors.students) : null,
              unit: t("o'quvchi"),
              sub: data ? (
                <Wrap>
                  {t("{n} o'rin", { n: data.debtors.seats })}
                  {data.debtors.multi > 0 ? `: ${t("{n} nafari bir nechta guruhda qarzdor", { n: data.debtors.multi })}` : ""} —{" "}
                  <NoteLink href="/reports/qarzdorlar">{t("Qarzdorlar hisobotida")}</NoteLink>
                </Wrap>
              ) : undefined,
            },
          ]}
        />
      </div>

      <section className={`relative overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm transition-opacity ${stale ? "opacity-60" : ""}`}>
        <div className="relative overflow-x-auto">
          <table className="w-full border-collapse text-v2-body" style={{ minWidth: 960 }}>
            <caption className="sr-only">{t(report.title)}</caption>
            <thead>
              <tr className="border-b border-v2-border bg-v2-surface-2">
                <th scope="col" className={`${th} text-left`}>
                  {view === "course" ? t("Kurs") : view === "group" ? t("Guruh") : t("O'qituvchi")}
                </th>
                <th scope="col" className={`${th} ${view === "group" ? "text-left" : "text-right"}`}>
                  {view === "group" ? t("Kurs") : t("Guruhlar")}
                </th>
                <th scope="col" className={`${th} text-right`}>{t("O'quvchilar")}</th>
                <th scope="col" className={`${th} text-right`}>{monthCol}</th>
                <th scope="col" className={`${th} text-right`}>{t("To'lagan")}</th>
                <th scope="col" className={`${th} text-right`}>{t("Qarzdor")}</th>
                <th scope="col" className={`${th} text-right`}>{t("Muddati kelmagan")}</th>
                <th scope="col" className={`${th} text-right`}>{t("Sig'im to'lishi")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="border-b border-v2-border last:border-b-0" aria-hidden>
                    {Array.from({ length: 8 }, (_, j) => (
                      <td key={j} className={`${td} ${j ? num : ""}`}>
                        <span className={`inline-block h-3 rounded bg-v2-skeleton ${j ? "w-12" : "w-36"}`} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !hasRows ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-v2-small text-v2-text-2">
                    {t("Bu kunda guruhda o'qiyotgan o'quvchi yo'q")}
                  </td>
                </tr>
              ) : view === "course" ? (
                <CourseRows data={data} t={t} />
              ) : view === "group" ? (
                branches.map((b) => (
                  <BranchBlock key={b.branchId} b={b} sub={t("{n} guruh", { n: b.groups })} open={opened.has(b.branchId)} onToggle={() => toggle(b.branchId)} second={null}>
                    {data.groups
                      .filter((g) => g.branchId === b.branchId)
                      .map((g) => (
                        <GroupRow key={g.id} g={g} t={t} />
                      ))}
                  </BranchBlock>
                ))
              ) : (
                branches.map((b) => (
                  <BranchBlock key={b.branchId} b={b} sub={t("{n} o'qituvchi", { n: b.teachers })} open={opened.has(b.branchId)} onToggle={() => toggle(b.branchId)} second={fmtNum(b.groups)}>
                    {data.teachers
                      .filter((x) => x.branchId === b.branchId)
                      .map((x) => (
                        <TeacherRow key={`${x.branchId}|${x.teacher}`} x={x} t={t} />
                      ))}
                  </BranchBlock>
                ))
              )}
            </tbody>
            {!loading && hasRows && tot && data && (
              <tfoot>
                <tr className="border-t border-v2-border bg-v2-surface-2 font-semibold">
                  <td className={`${td} align-top`}>
                    <span className="block text-v2-text">
                      {t("Jami")} · {t("{n} o'quvchi", { n: data.students })}
                    </span>
                    <span className="block text-v2-caption font-normal text-v2-text-2">
                      {t("{n} o'rin", { n: tot.seats })}
                      {multiLine}
                    </span>
                  </td>
                  <td className={`${td} ${view === "group" ? "" : num}`}>{view === "group" ? <span className="font-normal text-v2-text-2">{t("{n} guruh", { n: tot.groups })}</span> : fmtNum(tot.groups)}</td>
                  <MetricCells c={tot} strong />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {notes().map((n, i) => (
        <NoteLine key={i}>{n}</NoteLine>
      ))}
    </ReportShell>
  );
}

/* ───────────────────────── Bo'laklar ───────────────────────── */

/** Karta izohi rasmdagidek ikki qatorga o'tsin (KpiStrip uni bir qatorda kesadi). */
function Wrap({ children }: { children: ReactNode }) {
  return <span className="block whitespace-normal">{children}</span>;
}

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

/** «+14 / −2»: kelgan — yashil, ketgan — qizil, nol — kulrang; tarix yo'q — «—». */
function Flow({ came, left }: { came: number | null; left: number | null }) {
  if (came === null || left === null) return dash;
  return (
    <span className="whitespace-nowrap">
      <span className={came > 0 ? "font-medium text-v2-success" : "text-v2-text-3"}>{came > 0 ? `+${fmtNum(came)}` : "0"}</span>
      <span className="text-v2-text-3"> / </span>
      <span className={left > 0 ? "font-medium text-v2-danger" : "text-v2-text-3"}>{left > 0 ? `−${fmtNum(left)}` : "0"}</span>
    </span>
  );
}

function FillCell({ c }: { c: ActiveCounts }) {
  const { t } = useT();
  const p = fillPct(c);
  if (p === null) return <td className={`${td} ${num}`}>{dash}</td>;
  return (
    <td className={`${td} ${num}`} title={c.noCapGroups > 0 ? t("{n} ta guruhda sig'im noma'lum", { n: c.noCapGroups }) : undefined}>
      <span className="inline-flex items-center justify-end gap-2">
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-v2-brand-bg" aria-hidden>
          <span className="block h-full rounded-full bg-v2-brand" style={{ width: `${Math.min(100, p)}%` }} />
        </span>
        <span className={`w-10 text-right ${p > 100 ? "text-v2-danger" : ""}`}>{p}%</span>
      </span>
    </td>
  );
}

/** O'quvchilar · oy · To'lagan · Qarzdor · Muddati kelmagan · Sig'im to'lishi. */
function MetricCells({ c, strong }: { c: ActiveCounts; strong?: boolean }) {
  const w = strong ? "font-semibold" : "";
  return (
    <>
      <td className={`${td} ${num} font-semibold text-v2-text`}>{fmtNum(c.seats)}</td>
      <td className={`${td} ${num}`}>
        <Flow came={c.came} left={c.left} />
      </td>
      <td className={`${td} ${num} ${w}`}>{fmtNum(c.paid)}</td>
      <td className={`${td} ${num} ${c.debt > 0 ? "font-medium text-v2-danger" : "text-v2-text-3"}`}>{fmtNum(c.debt)}</td>
      <td className={`${td} ${num} ${w}`}>{fmtNum(c.notDue)}</td>
      <FillCell c={c} />
    </>
  );
}

function CourseRows({ data, t }: { data: Resp; t: TFn }) {
  return (
    <>
      {data.categories.map((cat) => {
        const list: ActiveCourseRow[] = data.courses.filter((c) => c.category.toLowerCase() === cat.category.toLowerCase());
        return (
          <Fragment key={cat.category || "-"}>
            <tr className="border-b border-v2-border bg-v2-surface-2/60">
              <td colSpan={8} className="px-4 py-2 text-v2-caption">
                <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
                  <span className={`size-2 shrink-0 rounded-full ${cat.category ? categoryDotCls(cat.category) : "bg-v2-text-3"}`} aria-hidden />
                  <span className="font-semibold text-v2-text">{cat.category || t("Kategoriyasiz")}</span>
                  <span className="text-v2-text-2">
                    · {t("{n} kurs", { n: cat.courses })} · {t("{n} guruh", { n: cat.groups })} · {t("{n} o'rin", { n: cat.seats })}
                  </span>
                </span>
              </td>
            </tr>
            {list.map((c) => (
              <tr key={c.course} className="border-b border-v2-border last:border-b-0">
                <td className={`${td} pl-8`}>
                  <span className="block truncate font-medium text-v2-text">{c.course}</span>
                </td>
                <td className={`${td} ${num}`}>{fmtNum(c.groups)}</td>
                <MetricCells c={c} />
              </tr>
            ))}
          </Fragment>
        );
      })}
    </>
  );
}

/** Filial qatori (ochiladi) va uning ichidagi qatorlar. */
function BranchBlock({
  b,
  sub,
  open,
  onToggle,
  second,
  children,
}: {
  b: ActiveBranchRow;
  sub: string;
  open: boolean;
  onToggle: () => void;
  /** Ikkinchi ustun (O'qituvchi kesimida — guruhlar soni; Guruh kesimida bo'sh). */
  second: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <tr className="border-b border-v2-border bg-v2-surface-2/60">
        <td className={td}>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex min-w-0 items-center gap-2 rounded-v2-sm text-left focus-visible:shadow-v2-focus focus-visible:outline-none"
          >
            <Chevron open={open} />
            <Building2 className="size-4 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-v2-text">{b.name}</span>
              <span className="block text-v2-caption text-v2-text-2">{sub}</span>
            </span>
          </button>
        </td>
        <td className={`${td} ${second === null ? "" : `${num} font-semibold`}`}>{second}</td>
        <MetricCells c={b} strong />
      </tr>
      {open && children}
    </>
  );
}

function GroupRow({ g, t }: { g: ActiveGroupRow; t: TFn }) {
  const title = g.name || g.label;
  return (
    <tr className="border-b border-v2-border">
      <td className={`${td} pl-11`}>
        <span className="flex min-w-0 items-center gap-2.5">
          <span className={`size-2 shrink-0 rounded-full ${g.category ? categoryDotCls(g.category) : "bg-v2-text-3"}`} aria-hidden />
          <span className="min-w-0">
            <Link
              href={`/groups/${g.id}`}
              title={g.label}
              className="block max-w-[220px] truncate rounded-v2-sm font-medium text-v2-text hover:underline focus-visible:shadow-v2-focus focus-visible:outline-none"
            >
              {title}
            </Link>
            <span className="block max-w-[220px] truncate text-v2-caption text-v2-text-2" title={g.teacher || undefined}>
              {g.gone ? t("arxivlangan") : g.teacher ? shortPersonName(g.teacher) : t("O'qituvchisiz")}
            </span>
          </span>
        </span>
      </td>
      <td className={td}>
        <span className="block max-w-[180px] truncate text-v2-text-2">{g.course || "—"}</span>
        {g.level && <span className="block max-w-[180px] truncate text-v2-caption text-v2-text-3">{g.level}</span>}
      </td>
      <MetricCells c={g} />
    </tr>
  );
}

function TeacherRow({ x, t }: { x: ActiveTeacherRow; t: TFn }) {
  const name = x.teacher === "—" ? t("O'qituvchisiz") : x.teacher;
  return (
    <tr className="border-b border-v2-border">
      <td className={`${td} pl-11`}>
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2" aria-hidden>
            {x.teacher === "—" ? "?" : initialsOf(x.teacher)}
          </span>
          <span className="min-w-0">
            <span className="block max-w-[240px] truncate font-medium text-v2-text">{name}</span>
            <span className="block max-w-[240px] truncate text-v2-caption text-v2-text-2" title={x.courses.join(", ") || undefined}>
              {x.courses.join(", ") || "—"}
            </span>
          </span>
        </span>
      </td>
      <td className={`${td} ${num}`}>{fmtNum(x.groups)}</td>
      <MetricCells c={x} />
    </tr>
  );
}

