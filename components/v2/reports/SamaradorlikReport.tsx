"use client";

import { useState } from "react";
import { AlertTriangle, Clock, Send } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import V2Select from "@/components/v2/ui/V2Select";
import type { ReportDef } from "@/lib/reportsCatalog";
import type { AdminReport, AdminRow } from "@/lib/reportLeads";
import type { TeacherPerfReport, TeacherPerfRow } from "@/lib/reportRetention";
import { CENTER_NAME, DOC_FOOTER, useBranchOptions, useReportData, useReportFmt, useToday } from "./reportHooks";
import { fileSafe, fmtNum } from "./reportFormat";
import type { ExportDoc } from "./reportExport";
import { Callout, DayRangeFilter, Panel, StackBar, pct, useDayRange } from "./report35";
import { ErrorBanner, KpiStrip, NoteLine, ReportShell, ReportTable, type TableCol } from "./reportUi";

// YANGI VERSIYA — HISOBOTLAR → «O'QITUVCHILAR SAMARADORLIGI» va «ADMINISTRATORLAR SAMARADORLIGI» (35-qism, rasmlar
// shu nomlar bilan). Bitta qolip, o'ngda «O'qituvchilar | Administratorlar» almashtirgich (har biri o'z
// hisobotiga havola — ruxsatlar alohida).
//   O'qituvchilar: Davr boshida, Qo'shildi, Ketdi, Davr oxirida; jadval Boshida · Qo'shildi · Ketdi · Bitirdi ·
//   Muzlatildi · Oxirida · Tarkib (segmentli chiziq) · Saqlab qolish (≥90% `success`, <85% `danger`).
//   Administratorlar: Lidlar, O'quvchi bo'ldi, Birinchi javob, Birinchi oyda ketdi; jadval admin bo'yicha
//   voronka; «Birinchi javob tezligi» (15 daq / 15–60 / 1 soatdan ko'p) va «Kechki lidlar».
// Server: /api/reports/teachers (lib/reportRetention.ts), /api/reports/admins (lib/reportLeads.ts).

type TResp = TeacherPerfReport & { ok: true };
type AResp = AdminReport & { ok: true };
const minLabel = (m: number | null, t: (s: string, v?: Record<string, string | number>) => string) => (m === null ? "—" : m < 60 ? t("{n} daq", { n: m }) : t("{h} soat {m} daq", { h: Math.floor(m / 60), m: m % 60 }));

export default function SamaradorlikReport({ report, author, mode }: { report: ReportDef; author: string; mode: "teachers" | "admins" }) {
  const { t } = useT();
  const f = useReportFmt();
  const today = useToday();
  const branchOptions = useBranchOptions();
  const { range, setRange, from, to } = useDayRange();
  const [branch, setBranch] = useState("");
  const [course, setCourse] = useState("");
  const qs = new URLSearchParams({ from, to, ...(branch ? { branch } : {}), ...(course ? { course } : {}) });
  const tq = useReportData<TResp>(mode === "teachers" ? `/api/reports/teachers?${qs}` : null);
  const aq = useReportData<AResp>(mode === "admins" ? `/api/reports/admins?${qs}` : null);
  const courses = useReportData<TResp>(mode === "admins" ? `/api/reports/teachers?${new URLSearchParams({ from, to })}` : null).data?.courses ?? tq.data?.courses ?? [];
  const q = mode === "teachers" ? tq : aq;
  const branchName = branch ? (branchOptions.find((b) => b.value === branch)?.label ?? "") : t("Barcha filiallar");

  const toggle = (
    <div className="flex rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
      {(
        [
          ["teachers", t("O'qituvchilar"), "/reports/oqituvchilar-samaradorligi"],
          ["admins", t("Administratorlar"), "/reports/adminlar-samaradorligi"],
        ] as const
      ).map(([k, l, href]) => (
        <Link key={k} href={href} aria-current={mode === k ? "page" : undefined} className={`inline-flex h-8 items-center rounded-[6px] px-3 text-v2-small font-semibold ${mode === k ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
          {l}
        </Link>
      ))}
    </div>
  );

  // ── O'qituvchilar ──
  const td = tq.data;
  const tCols: TableCol<TeacherPerfRow>[] = [
    { key: "n", label: t("Ustoz"), render: (r) => (<><div className="font-semibold text-v2-text">{r.teacher}</div><div className="text-v2-caption text-v2-text-2">{r.sub}</div></>) },
    { key: "s", label: t("Boshida"), align: "right", render: (r) => fmtNum(r.start) },
    { key: "j", label: t("Qo'shildi"), align: "right", render: (r) => <span className="text-v2-success">+{r.joined}</span> },
    { key: "l", label: t("Ketdi"), align: "right", render: (r) => <span className={r.left ? "text-v2-danger" : "text-v2-text-2"}>{r.left}</span> },
    { key: "f", label: t("Bitirdi"), align: "right", render: (r) => <span className="text-v2-text-2">{r.finished}</span> },
    { key: "z", label: t("Muzlatildi"), align: "right", render: (r) => <span className="text-v2-text-2">{r.frozen}</span> },
    { key: "e", label: t("Oxirida"), align: "right", render: (r) => <b>{fmtNum(r.end)}</b> },
    { key: "b", label: t("Tarkib"), className: "w-[160px]", render: (r) => <StackBar parts={[{ v: Math.max(0, r.end - r.joined), c: "bg-v2-brand" }, { v: r.joined, c: "bg-v2-success" }, { v: r.left, c: "bg-v2-danger" }, { v: r.finished + r.frozen, c: "bg-v2-border-strong" }]} /> },
    { key: "r", label: t("Saqlab qolish"), align: "right", render: (r) => <RetPill v={r.retention} /> },
  ];
  const weak = (td?.rows ?? []).filter((r) => r.retention !== null && r.retention < 85 && r.left >= 2);

  // ── Administratorlar ──
  const ad = aq.data;
  const aCols: TableCol<AdminRow>[] = [
    { key: "n", label: t("Admin"), render: (r) => <span className="font-semibold text-v2-text">{r.admin}</span> },
    { key: "0", label: t("Lid"), align: "right", render: (r) => <b>{r.counts[0]}</b> },
    { key: "1", label: t("Bog'landi"), align: "right", render: (r) => `${r.counts[1]} · ${pct(r.counts[1], r.counts[0])}%` },
    { key: "2", label: t("1-darsga yozdi"), align: "right", render: (r) => r.counts[2] },
    { key: "3", label: t("Keldi"), align: "right", render: (r) => r.counts[3] },
    { key: "4", label: t("O'quvchi bo'ldi"), align: "right", render: (r) => <b>{r.counts[4]}</b> },
    { key: "c", label: t("Konversiya"), align: "right", render: (r) => <ConvPill v={pct(r.counts[4], r.counts[0])} /> },
    { key: "r", label: t("Birinchi javob"), align: "right", render: (r) => <span className={r.avgResponse !== null && r.avgResponse > 30 ? "font-semibold text-v2-warning" : "font-semibold text-v2-success"}>{minLabel(r.avgResponse, t)}</span> },
    { key: "l", label: t("1-oyda ketdi"), align: "right", render: (r) => r.firstMonthLeft },
  ];

  function getDoc(): ExportDoc | null {
    const common = { title: t("{name} hisoboti", { name: t(report.title) }), fileBase: `${fileSafe(t(report.title))}-${today}`, center: t(CENTER_NAME), branchLabel: branchName, dateLabel: f.fullDate(today), author, filters: [f.dayRange(from, to), branchName, course || t("Barcha kurslar")].join(" · "), footer: DOC_FOOTER };
    if (mode === "teachers" && td)
      return {
        ...common,
        kpis: [
          { label: t("Davr boshida"), value: fmtNum(td.total.start) },
          { label: t("Qo'shildi"), value: `+${td.total.joined}` },
          { label: t("Ketdi"), value: fmtNum(td.total.left) },
          { label: t("Davr oxirida"), value: `${fmtNum(td.total.end)} · ${td.total.retention ?? "—"}%` },
        ],
        sections: [{ columns: [{ label: t("Ustoz") }, { label: t("Boshida"), numeric: true }, { label: t("Qo'shildi"), numeric: true }, { label: t("Ketdi"), numeric: true }, { label: t("Bitirdi"), numeric: true }, { label: t("Muzlatildi"), numeric: true }, { label: t("Oxirida"), numeric: true }, { label: t("Saqlab qolish, %"), numeric: true }], rows: td.rows.map((r) => [r.teacher, r.start, r.joined, r.left, r.finished, r.frozen, r.end, r.retention]), total: [t("Jami"), td.total.start, td.total.joined, td.total.left, td.total.finished, td.total.frozen, td.total.end, td.total.retention] }],
      };
    if (mode === "admins" && ad)
      return {
        ...common,
        kpis: [
          { label: t("Lidlar"), value: fmtNum(ad.total.counts[0]) },
          { label: t("O'quvchi bo'ldi"), value: `${ad.total.counts[4]} · ${pct(ad.total.counts[4], ad.total.counts[0])}%` },
          { label: t("Birinchi javob"), value: minLabel(ad.total.avgResponse, t) },
          { label: t("Birinchi oyda ketdi"), value: fmtNum(ad.total.firstMonthLeft) },
        ],
        sections: [{ columns: [{ label: t("Admin") }, { label: t("Lid"), numeric: true }, { label: t("Bog'landi"), numeric: true }, { label: t("1-darsga yozdi"), numeric: true }, { label: t("Keldi"), numeric: true }, { label: t("O'quvchi bo'ldi"), numeric: true }, { label: t("Konversiya, %"), numeric: true }, { label: t("Birinchi javob, daq"), numeric: true }, { label: t("1-oyda ketdi"), numeric: true }], rows: ad.rows.map((r) => [r.admin, ...r.counts, pct(r.counts[4], r.counts[0]), r.avgResponse, r.firstMonthLeft]) }],
      };
    return null;
  }

  return (
    <ReportShell
      report={report}
      subtitle={`${t(report.subtitle)} · ${branchName}`}
      getDoc={getDoc}
      exportReady={!!q.data && !q.stale}
      filters={
        <>
          <DayRangeFilter range={range} setRange={setRange} />
          <V2Select variant="value" label={t("Filial")} emptyLabel="Barchasi" value={branch} onChange={setBranch} options={branchOptions} searchable={false} />
          <V2Select variant="value" label={t("Kurs")} emptyLabel="Hammasi" value={course} onChange={setCourse} options={courses.map((c) => ({ value: c, label: c }))} />
        </>
      }
      filtersEnd={toggle}
    >
      {q.error && <ErrorBanner message="Hisobot yuklanmadi" onRetry={q.reload} />}

      {mode === "teachers" && (
        <>
          <div className={tq.stale ? "opacity-60" : ""}>
            <KpiStrip
              loading={tq.loading}
              cells={[
                { key: "s", label: t("Davr boshida"), value: td ? fmtNum(td.total.start) : null, unit: t("o'quvchi"), sub: t("{d} holatiga", { d: f.dayMonth(from) }) },
                { key: "j", label: t("Qo'shildi"), value: td ? `+${td.total.joined}` : null, tone: "success", sub: t("guruhlarga yangi kelganlar") },
                { key: "l", label: t("Ketdi"), value: td ? fmtNum(td.total.left) : null, tone: "danger", sub: td ? t("yana {a} tasi bitirdi, {b} tasi muzlatildi", { a: td.total.finished, b: td.total.frozen }) : "" },
                { key: "e", label: t("Davr oxirida"), value: td ? fmtNum(td.total.end) : null, sub: td ? t("saqlab qolish {p}% · {d} holatiga", { p: td.total.retention ?? "—", d: f.dayMonth(to) }) : "" },
              ]}
            />
          </div>
          <ul className={`divide-y divide-v2-border overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm sm:hidden ${tq.stale ? "opacity-60" : ""}`}>
            {(td?.rows ?? []).map((r) => (
              <li key={r.teacher} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-v2-text">{r.teacher}</div>
                  <div className="truncate text-v2-caption text-v2-text-2">{r.sub}</div>
                  <div className="text-v2-caption tabular-nums text-v2-text-2">
                    {r.start} → <b className="text-v2-text">{r.end}</b> · <span className="text-v2-success">+{r.joined}</span> · <span className={r.left ? "text-v2-danger" : ""}>{r.left ? t("−{n} ketdi", { n: r.left }) : t("ketgan yo'q")}</span>
                  </div>
                </div>
                <RetPill v={r.retention} />
              </li>
            ))}
          </ul>
          <div className={`hidden sm:block ${tq.stale ? "opacity-60" : ""}`}>
            <ReportTable
              cols={tCols}
              rows={td?.rows ?? []}
              rowKey={(r) => r.teacher}
              loading={tq.loading}
              empty={t("Bu davrda guruhli ustoz yo'q")}
              minWidth={960}
              total={td ? [<span key="n">{t("Jami · {n} ustoz", { n: td.rows.length })}</span>, fmtNum(td.total.start), `+${td.total.joined}`, td.total.left, td.total.finished, td.total.frozen, <b key="e">{fmtNum(td.total.end)}</b>, <StackBar key="b" parts={[{ v: Math.max(0, td.total.end - td.total.joined), c: "bg-v2-brand" }, { v: td.total.joined, c: "bg-v2-success" }, { v: td.total.left, c: "bg-v2-danger" }, { v: td.total.finished + td.total.frozen, c: "bg-v2-border-strong" }]} />, <RetPill key="r" v={td.total.retention} />] : undefined}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-v2-caption text-v2-text-2">
            <span className="flex flex-wrap gap-3">
              {[["bg-v2-brand", "qolgan"], ["bg-v2-success", "qo'shilgan"], ["bg-v2-danger", "ketgan"], ["bg-v2-border-strong", "bitirgan yoki muzlatilgan"]].map(([c, l]) => (
                <span key={l} className="inline-flex items-center gap-1.5">
                  <span className={`size-2 rounded-[2px] ${c}`} /> {t(l)}
                </span>
              ))}
            </span>
            <span>{t("Saqlab qolish = 1 − ketgan ÷ (boshidagi + qo'shilgan) · bitirgan va muzlatilgan ketgan hisoblanmaydi")}</span>
          </div>
          {weak.length > 0 && (
            <Callout
              tone="warning"
              icon={<AlertTriangle className="size-5" aria-hidden />}
              title={`${weak.map((w) => w.teacher).join(", ")} — ${weak.map((w) => `${w.retention}%`).join(", ")}`}
              action={
                <Link href="/nazorat-staff-rating" className="inline-flex h-9 items-center rounded-v2-md border border-v2-border bg-v2-surface px-3 text-v2-small font-semibold text-v2-text">
                  {t("Ustozlar reytingi")}
                </Link>
              }
            >
              {t("Saqlab qolish 85% dan past va kamida 2 o'quvchi ketgan. O'quvchilar bahosini Ustozlar reytingida ko'ring.")}
            </Callout>
          )}
        </>
      )}

      {mode === "admins" && (
        <>
          <div className={aq.stale ? "opacity-60" : ""}>
            <KpiStrip
              loading={aq.loading}
              cells={[
                { key: "l", label: t("Lidlar"), value: ad ? fmtNum(ad.total.counts[0]) : null, sub: t("{d} dan · {n} admin", { d: f.dayMonth(from), n: ad?.rows.length ?? 0 }) },
                { key: "p", label: t("O'quvchi bo'ldi"), value: ad ? `${ad.total.counts[4]}` : null, tone: "success", sub: ad ? t("{p}% · liddan birinchi to'lovgacha", { p: pct(ad.total.counts[4], ad.total.counts[0]) }) : "" },
                { key: "r", label: t("Birinchi javob"), value: ad ? minLabel(ad.total.avgResponse, t) : null, sub: t("o'rtacha · lid yozilgandan birinchi holat o'zgarishigacha") },
                { key: "m", label: t("Birinchi oyda ketdi"), value: ad ? fmtNum(ad.total.firstMonthLeft) : null, tone: ad?.total.firstMonthLeft ? "danger" : undefined, sub: t("admin yozgan o'quvchilardan") },
              ]}
            />
          </div>
          <div className={aq.stale ? "opacity-60" : ""}>
            <ReportTable
              cols={aCols}
              rows={ad?.rows ?? []}
              rowKey={(r) => r.admin}
              loading={aq.loading}
              empty={t("Bu davrda lid yo'q")}
              minWidth={980}
              total={ad ? [t("Jami"), <b key="0">{ad.total.counts[0]}</b>, `${ad.total.counts[1]} · ${pct(ad.total.counts[1], ad.total.counts[0])}%`, ad.total.counts[2], ad.total.counts[3], <b key="4">{ad.total.counts[4]}</b>, <ConvPill key="c" v={pct(ad.total.counts[4], ad.total.counts[0])} />, minLabel(ad.total.avgResponse, t), ad.total.firstMonthLeft] : undefined}
            />
          </div>
          {ad && ad.noLead > 0 && <NoteLine>{t("Lidsiz qo'shilgan: {n} o'quvchi — guruhga to'g'ridan-to'g'ri yozilgan, manbasi noma'lum.", { n: ad.noLead })}</NoteLine>}
          <div className={`grid gap-4 lg:grid-cols-2 ${aq.stale ? "opacity-60" : ""}`}>
            <Panel title={t("Birinchi javob tezligi")} sub={t("lid yozilgandan birinchi holat o'zgarishigacha")}>
              <ul className="space-y-3 px-4 pb-4">
                {(ad?.rows ?? []).map((r) => {
                  const n = r.buckets[0] + r.buckets[1] + r.buckets[2];
                  return (
                    <li key={r.admin}>
                      <div className="flex justify-between text-v2-small">
                        <b className="text-v2-text">{r.admin}</b>
                        <span className="text-v2-text-2">{t("o'rtacha {m}", { m: minLabel(r.avgResponse, t) })}</span>
                      </div>
                      {n ? <StackBar h="h-4" parts={[{ v: r.buckets[0], c: "bg-v2-success" }, { v: r.buckets[1], c: "bg-v2-warning" }, { v: r.buckets[2], c: "bg-v2-danger" }]} /> : <p className="text-v2-caption text-v2-text-3">{t("holat tarixi yo'q")}</p>}
                    </li>
                  );
                })}
                <li className="flex flex-wrap gap-3 text-v2-caption text-v2-text-2">
                  {[["bg-v2-success", "15 daqiqagacha"], ["bg-v2-warning", "15–60 daqiqa"], ["bg-v2-danger", "1 soatdan ko'p"]].map(([c, l]) => (
                    <span key={l} className="inline-flex items-center gap-1.5">
                      <span className={`size-2 rounded-[2px] ${c}`} /> {t(l)}
                    </span>
                  ))}
                </li>
              </ul>
            </Panel>
            <Panel title={<span className="inline-flex items-center gap-2"><Clock className="size-4 text-v2-warning" aria-hidden />{t("Kechki lidlar")}</span>}>
              <div className="grid grid-cols-3 gap-3 px-4 pb-3">
                <div>
                  <div className="text-[22px] font-semibold tabular-nums text-v2-text">{ad?.evening.count ?? "—"}</div>
                  <div className="text-v2-caption text-v2-text-2">{t("18:00 dan keyin yozilgan")}</div>
                </div>
                <div>
                  <div className="text-[22px] font-semibold tabular-nums text-v2-danger">{ad ? `${pct(ad.evening.converted, ad.evening.count)}%` : "—"}</div>
                  <div className="text-v2-caption text-v2-text-2">{t("o'quvchi bo'ldi")}</div>
                </div>
                <div>
                  <div className="text-[22px] font-semibold tabular-nums text-v2-text">{ad?.evening.dayConv !== null && ad ? `${ad.evening.dayConv}%` : "—"}</div>
                  <div className="text-v2-caption text-v2-text-2">{t("kunduzgilardan")}</div>
                </div>
              </div>
              <p className="flex items-start gap-2 border-t border-v2-border px-4 py-3 text-v2-small text-v2-text-2">
                <Send className="mt-0.5 size-4 shrink-0 text-v2-info" aria-hidden />
                {t("Kechki lidga darhol javob — ertalab birinchi navbatda adminga topshiriq (taklif).")}
              </p>
            </Panel>
          </div>
        </>
      )}
    </ReportShell>
  );
}

function RetPill({ v }: { v: number | null }) {
  if (v === null) return <span className="text-v2-text-3">—</span>;
  const c = v >= 90 ? "bg-v2-success-bg text-v2-success" : v < 85 ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-warning-bg text-v2-warning";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-v2-small font-semibold tabular-nums ${c}`}>{v}%</span>;
}
function ConvPill({ v }: { v: number }) {
  const c = v >= 25 ? "bg-v2-success-bg text-v2-success" : "bg-v2-warning-bg text-v2-warning";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-v2-small font-semibold tabular-nums ${c}`}>{v}%</span>;
}
