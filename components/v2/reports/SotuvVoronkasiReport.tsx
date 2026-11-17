"use client";

import { useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import V2Select from "@/components/v2/ui/V2Select";
import type { ReportDef } from "@/lib/reportsCatalog";
import type { FunnelCut, FunnelReport } from "@/lib/reportLeads";
import { CENTER_NAME, DOC_FOOTER, useBranchOptions, useReportData, useReportFmt, useToday } from "./reportHooks";
import { fileSafe, fmtNum } from "./reportFormat";
import type { ExportDoc } from "./reportExport";
import { Callout, DayRangeFilter, Meter, Panel, pct, useDayRange } from "./report35";
import { ErrorBanner, ReportShell, ReportTable, type TableCol } from "./reportUi";

// YANGI VERSIYA — HISOBOTLAR → «SOTUV VORONKASI» (35-qism, rasm «Sotuv voronkasi»). Kunlar oralig'i, Filial,
// Manba, Kurs, Admin. «Bosqichlar» — besh qatorli voronka (chiziq, son, foiz, ostida «−N yopildi · N jarayonda»),
// pastda «Jarayonda» tabletkalari; o'ngda «Nega yopildi» (rad sabablari). «Kesimlar» — Manba / Filial / Admin /
// Kurs jadvali (Lid … To'ladi, «Liddan o'quvchiga» chizig'i). Server: /api/reports/funnel (lib/reportLeads.ts).

type Resp = FunnelReport & { ok: true; branch: "all" | number };
type CutKey = "source" | "branch" | "admin" | "course";
const WAIT_LABEL = ["Bog'lanish navbatida", "O'ylab ko'rmoqda", "Darsi rejada", "To'lov kutilmoqda"];
const WAIT_TONE = ["bg-v2-warning-bg text-v2-warning", "bg-v2-surface-2 text-v2-text-2", "bg-v2-info-bg text-v2-info", "bg-v2-success-bg text-v2-success"];
const STAGE_SUB = ["so'rovnoma, qo'ng'iroq, admin", "birinchi qo'ng'iroq bo'ldi", "sana va guruh belgilandi", "davomatda belgilangan", "o'quvchiga aylandi"];

export default function SotuvVoronkasiReport({ report, author }: { report: ReportDef; author: string }) {
  const { t } = useT();
  const f = useReportFmt();
  const today = useToday();
  const branchOptions = useBranchOptions();
  const { range, setRange, from, to } = useDayRange();
  const [branch, setBranch] = useState("");
  const [source, setSource] = useState("");
  const [course, setCourse] = useState("");
  const [admin, setAdmin] = useState("");
  const [cutKey, setCutKey] = useState<CutKey>("source");
  const url = `/api/reports/funnel?${new URLSearchParams({ from, to, ...(branch ? { branch } : {}), ...(source ? { source } : {}), ...(course ? { course } : {}), ...(admin ? { admin } : {}) })}`;
  const { data, loading, stale, error, reload } = useReportData<Resp>(url);
  // Tanlovlar ro'yxati — filtrsiz javobdan (tanlangan filtr ro'yxatni toraytirmasin).
  const base = useReportData<Resp>(`/api/reports/funnel?${new URLSearchParams({ from, to, ...(branch ? { branch } : {}) })}`).data;
  const opts = (k: CutKey) => (base?.cuts[k] ?? []).map((c) => ({ value: c.key, label: c.key }));
  const branchName = branch ? (branchOptions.find((b) => b.value === branch)?.label ?? "") : t("Barcha filiallar");
  const conv = data && data.total ? pct(data.stages[4].count, data.total) : 0;
  const cutName = (c: FunnelCut) => (cutKey === "branch" ? (data?.branchNames[Number(c.key)] ?? c.key) : t(c.key));

  const cols: TableCol<FunnelCut>[] = [
    { key: "k", label: t({ source: "Manba", branch: "Filial", admin: "Admin", course: "Kurs" }[cutKey]), render: (c) => <span className="font-medium text-v2-text">{cutName(c)}</span> },
    { key: "0", label: t("Lid"), align: "right", render: (c) => fmtNum(c.counts[0]) },
    { key: "1", label: t("Bog'lanildi"), align: "right", render: (c) => fmtNum(c.counts[1]) },
    { key: "2", label: t("1-darsga yozildi"), align: "right", render: (c) => fmtNum(c.counts[2]) },
    { key: "3", label: t("Keldi"), align: "right", render: (c) => fmtNum(c.counts[3]) },
    { key: "4", label: t("To'ladi"), align: "right", render: (c) => <b>{fmtNum(c.counts[4])}</b> },
    {
      key: "c",
      label: t("Liddan o'quvchiga"),
      className: "w-[220px]",
      render: (c) => (
        <span className="flex items-center gap-2">
          <Meter pct={pct(c.counts[4], c.counts[0])} tone="bg-v2-info" />
          <span className="w-10 text-right font-semibold tabular-nums text-v2-text">{pct(c.counts[4], c.counts[0])}%</span>
        </span>
      ),
    },
  ];
  const cuts = data?.cuts[cutKey] ?? [];

  // Filial kesimida «keldi → to'ladi» eng past filial (kamida 3 kishi kelgan).
  const weakest = useMemo(() => {
    const bs = (data?.cuts.branch ?? []).filter((c) => c.counts[3] >= 3);
    if (bs.length < 2) return null;
    return bs.map((c) => ({ name: data?.branchNames[Number(c.key)] ?? c.key, came: c.counts[3], paid: c.counts[4], p: pct(c.counts[4], c.counts[3]) })).sort((a, b) => a.p - b.p)[0];
  }, [data]);

  function getDoc(): ExportDoc | null {
    if (!data) return null;
    return {
      title: t("{name} hisoboti", { name: t(report.title) }),
      fileBase: `${fileSafe(t(report.title))}-${today}`,
      center: t(CENTER_NAME),
      branchLabel: branchName,
      dateLabel: f.fullDate(today),
      author,
      filters: [f.dayRange(from, to), branchName, source || t("Barcha manbalar"), course || t("Barcha kurslar")].join(" · "),
      kpis: data.stages.map((s) => ({ label: t(s.label), value: `${fmtNum(s.count)} · ${pct(s.count, data.total)}%` })),
      sections: [
        { title: t("Bosqichlar"), columns: [{ label: t("Bosqich") }, { label: t("Soni"), numeric: true }, { label: t("Yopildi"), numeric: true }, { label: t("Jarayonda"), numeric: true }], rows: data.stages.map((s) => [t(s.label), s.count, s.closed, s.waiting]) },
        { title: t("Nega yopildi"), columns: [{ label: t("Sabab") }, { label: t("Soni"), numeric: true }], rows: data.reasons.map((r) => [t(r.reason), r.count]) },
        {
          title: t("Kesimlar"),
          columns: [{ label: t("Manba") }, { label: t("Lid"), numeric: true }, { label: t("Bog'lanildi"), numeric: true }, { label: t("1-darsga yozildi"), numeric: true }, { label: t("Keldi"), numeric: true }, { label: t("To'ladi"), numeric: true }, { label: "%", numeric: true }],
          rows: data.cuts.source.map((c) => [c.key, ...c.counts, pct(c.counts[4], c.counts[0])]),
        },
      ],
      footer: DOC_FOOTER,
    };
  }

  return (
    <ReportShell
      report={report}
      subtitle={`${t(report.subtitle)} · ${branchName.toLowerCase()}`}
      getDoc={getDoc}
      exportReady={!!data && !stale}
      filters={
        <>
          <DayRangeFilter range={range} setRange={setRange} />
          <V2Select variant="value" label={t("Filial")} emptyLabel="Barchasi" value={branch} onChange={setBranch} options={branchOptions} searchable={false} />
          <V2Select variant="value" label={t("Manba")} emptyLabel="Hammasi" value={source} onChange={setSource} options={opts("source")} />
          <V2Select variant="value" label={t("Kurs")} emptyLabel="Hammasi" value={course} onChange={setCourse} options={opts("course")} />
          <V2Select variant="value" label={t("Admin")} emptyLabel="Hammasi" value={admin} onChange={setAdmin} options={opts("admin")} />
        </>
      }
    >
      {error && <ErrorBanner message="Hisobot yuklanmadi" onRetry={reload} />}
      <div className={`grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] ${stale ? "opacity-60" : ""}`}>
        <Panel
          title={t("Bosqichlar")}
          sub={t("har bosqich — lidlarning necha foizi yetib keldi")}
          right={
            <span className="text-v2-small text-v2-text-2">
              {t("liddan o'quvchiga")} <b className="text-[20px] text-v2-brand">{conv}%</b>
            </span>
          }
        >
          <ul className="space-y-3 px-4 pb-3">
            {(data?.stages ?? []).map((s, i) => (
              <li key={s.label}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_88px]">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-v2-text">{t(s.label)}</div>
                    <div className="truncate text-v2-caption text-v2-text-2">{t(STAGE_SUB[i])}</div>
                  </div>
                  <span className="col-span-2 row-start-2 block h-6 overflow-hidden rounded-v2-md bg-v2-surface-2 sm:col-span-1 sm:row-start-auto">
                    <span className={`block h-full rounded-v2-md ${i === 4 ? "bg-v2-brand" : "bg-v2-info"}`} style={{ width: `${pct(s.count, data!.total)}%` }} />
                  </span>
                  <span className="text-right">
                    <b className="text-[18px] tabular-nums text-v2-text">{fmtNum(s.count)}</b> <span className="text-v2-caption text-v2-text-2">{pct(s.count, data!.total)}%</span>
                  </span>
                </div>
                {i < 4 && (s.closed > 0 || s.waiting > 0) && (
                  <div className="mt-1 flex gap-2 pl-[192px] text-v2-caption text-v2-text-2 max-sm:pl-0">
                    {s.closed > 0 && <span className="rounded bg-v2-danger-bg px-1.5 font-semibold text-v2-danger">−{s.closed}</span>}
                    <span>
                      {[s.closed ? t("{n} yopildi", { n: s.closed }) : "", s.waiting ? t("{n} tasi {w}", { n: s.waiting, w: t(WAIT_LABEL[i]).toLowerCase() }) : ""].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                )}
              </li>
            ))}
            {!data && !error && <li className="h-40 animate-pulse rounded-v2-md bg-v2-skeleton" aria-hidden />}
          </ul>
          {data && (
            <div className="flex flex-wrap items-center gap-2 border-t border-v2-border px-4 py-3 text-v2-small">
              <span className="font-semibold text-v2-text">{t("Jarayonda · {n}", { n: data.waiting.reduce((a, w) => a + w.count, 0) })}</span>
              {data.waiting.map((w) =>
                w.count ? (
                  <span key={w.stage} className={`rounded-full px-2.5 py-0.5 font-semibold ${WAIT_TONE[w.stage]}`}>
                    {t(WAIT_LABEL[w.stage])} {w.count}
                  </span>
                ) : null,
              )}
            </div>
          )}
        </Panel>

        <Panel title={t("Nega yopildi · {n}", { n: data?.closed ?? 0 })} sub={t("lid yopilganda sabab majburiy")}>
          <ul className="space-y-3 px-4 pb-4">
            {(data?.reasons ?? []).map((r) => (
              <li key={r.reason}>
                <div className="flex justify-between gap-2 font-semibold text-v2-text">
                  <span className="truncate">{t(r.reason)}</span>
                  <span className="tabular-nums">{r.count}</span>
                </div>
                <Meter pct={pct(r.count, data!.reasons[0].count)} tone="bg-v2-warning" />
                <div className="mt-0.5 text-v2-caption text-v2-text-2">
                  {[r.beforeLesson ? t("{n} tasi birinchi darsdan oldin", { n: r.beforeLesson }) : "", r.topSource ? t("{n} tasi {s}", { n: r.topSourceN, s: r.topSource }) : ""].filter(Boolean).join(" · ")}
                </div>
              </li>
            ))}
            {data && !data.reasons.length && <li className="text-v2-small text-v2-text-3">{t("Bu davrda yopilgan lid yo'q")}</li>}
          </ul>
        </Panel>
      </div>

      <Panel
        title={t("Kesimlar")}
        sub={t("har qatorda o'sha manbadan kelgan lidlar yo'li")}
        right={
          <div role="tablist" className="flex rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
            {(["source", "branch", "admin", "course"] as CutKey[]).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={cutKey === k} onClick={() => setCutKey(k)} className={`h-8 rounded-[6px] px-3 text-v2-small font-semibold ${cutKey === k ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
                {t({ source: "Manba", branch: "Filial", admin: "Admin", course: "Kurs" }[k])}
              </button>
            ))}
          </div>
        }
      >
        <div className="border-t border-v2-border">
          <ReportTable
            cols={cols}
            rows={cuts}
            rowKey={(c) => c.key}
            loading={loading}
            empty={t("Bu davrda lid yo'q")}
            minWidth={820}
            total={data ? [t("Jami"), ...data.stages.map((s, i) => (i === 4 ? <b key={i}>{fmtNum(s.count)}</b> : fmtNum(s.count))), <span key="c" className="font-semibold">{conv}%</span>] : undefined}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-v2-border px-4 py-2.5 text-v2-caption text-v2-text-2">
          <span>{t("Konversiya — shu manbadan kelgan lidlarning necha foizi birinchi to'lovni qildi")}</span>
          <Link href="/sales-sources" className="font-semibold text-v2-brand">
            {t("O'quvchilar oqimi")} →
          </Link>
        </div>
      </Panel>

      {weakest && (
        <Callout icon={<Lightbulb className="size-5" aria-hidden />} title={t("{b}: birinchi darsga kelgan {c} kishidan {p} tasi to'ladi ({x}%)", { b: weakest.name, c: weakest.came, p: weakest.paid, x: weakest.p })}>
          {t("Filiallar bo'yicha eng past ko'rsatkich — «Filial» kesimini oching.")}
        </Callout>
      )}
    </ReportShell>
  );
}
