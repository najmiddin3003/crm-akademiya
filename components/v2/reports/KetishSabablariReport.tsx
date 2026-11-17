"use client";

import { useState } from "react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import V2Select from "@/components/v2/ui/V2Select";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import type { ReportDef } from "@/lib/reportsCatalog";
import type { LeaveReport, LeaveRow } from "@/lib/reportRetention";
import { CENTER_NAME, DOC_FOOTER, useBranchOptions, useReportData, useReportFmt, useToday } from "./reportHooks";
import { fileSafe, fmtNum } from "./reportFormat";
import type { ExportDoc } from "./reportExport";
import { DayRangeFilter, Meter, Panel, pct, useDayRange } from "./report35";
import { ErrorBanner, KpiStrip, NoteLine, ReportShell, ReportTable, type TableCol } from "./reportUi";

// YANGI VERSIYA — HISOBOTLAR → «KETISH SABABLARI» (35-qism, rasm «Ketish sabablari»). Kunlar oralig'i, Filial,
// Kurs, Ustoz; Hammasi / To'lab ketgan / To'lamay ketgan. 4 ko'rsatkich (Ketganlar, Birinchi oyda ketgan,
// To'lamay ketgan, Qaytib keldi); Sabablar, Qachon ketadi, Kurslar bo'yicha; «Ketganlar» jadvali.
// Server: /api/reports/leave-reasons (lib/reportRetention.ts).

type Resp = LeaveReport & { ok: true; branch: "all" | number };
type Seg = "all" | "paid" | "debt";

export default function KetishSabablariReport({ report, author }: { report: ReportDef; author: string }) {
  const { t } = useT();
  const f = useReportFmt();
  const today = useToday();
  const branchOptions = useBranchOptions();
  const { range, setRange, from, to } = useDayRange();
  const [branch, setBranch] = useState("");
  const [course, setCourse] = useState("");
  const [teacher, setTeacher] = useState("");
  const [seg, setSeg] = useState<Seg>("all");
  const url = `/api/reports/leave-reasons?${new URLSearchParams({ from, to, ...(branch ? { branch } : {}), ...(course ? { course } : {}), ...(teacher ? { teacher } : {}) })}`;
  const { data, loading, stale, error, reload } = useReportData<Resp>(url);
  const branchName = branch ? (branchOptions.find((b) => b.value === branch)?.label ?? "") : t("Barcha filiallar");
  const all = data?.rows ?? [];
  const rows = all.filter((r) => seg === "all" || (seg === "debt" ? r.debt > 0 : r.debt <= 0));
  const debtors = all.filter((r) => r.debt > 0);
  const firstMonth = data?.when.first ?? 0;

  const cols: TableCol<LeaveRow>[] = [
    {
      key: "n",
      label: t("O'quvchi"),
      render: (r) => (
        <>
          <div className="font-semibold text-v2-text">{r.name}</div>
          <div className="text-v2-caption text-v2-text-2">
            {f.dayMonth(r.leftAt)} · {t("{n} oy o'qidi", { n: Math.max(0, Math.round(r.months * 10) / 10).toLocaleString("ru-RU") })}
          </div>
        </>
      ),
    },
    {
      key: "g",
      label: t("Guruh · ustoz"),
      render: (r) => (
        <>
          <div className="flex items-center gap-1.5 text-v2-text">
            <span className={`size-2 rounded-[2px] ${FAN_DOT[fanOf(r.course)]}`} aria-hidden />
            {r.group}
          </div>
          <div className="text-v2-caption text-v2-text-2">{[r.teacher, r.branch].filter(Boolean).join(" · ")}</div>
        </>
      ),
    },
    { key: "p", label: t("To'lov"), render: (r) => (r.debt > 0 ? <span className="font-semibold text-v2-danger">{t("Qarz {n}", { n: fmtNum(r.debt) })}</span> : <span className="font-semibold text-v2-success">{t("To'lagan")}</span>) },
    { key: "r", label: t("Sabab"), render: (r) => <span className="inline-flex rounded-full bg-v2-surface-2 px-2 py-0.5 text-v2-small font-semibold text-v2-text">{t(r.reason)}</span> },
    { key: "c", label: t("Izoh"), render: (r) => <span className="text-v2-small text-v2-text-2">{r.comment || "—"}</span> },
    { key: "b", label: t("Keyingi qadam"), render: (r) => (r.returned ? <span className="rounded-full bg-v2-success-bg px-2 py-0.5 text-v2-small font-semibold text-v2-success">{t("Qaytdi")}</span> : <span className="text-v2-text-3">—</span>) },
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
      filters: [f.dayRange(from, to), branchName, course || t("Barcha kurslar"), teacher || t("Barcha ustozlar")].join(" · "),
      kpis: [
        { label: t("Ketganlar"), value: fmtNum(all.length) },
        { label: t("Birinchi oyda ketgan"), value: fmtNum(firstMonth) },
        { label: t("To'lamay ketgan"), value: `${debtors.length} · ${fmtNum(debtors.reduce((a, r) => a + r.debt, 0))}` },
        { label: t("Qaytib keldi"), value: fmtNum(all.filter((r) => r.returned).length) },
      ],
      sections: [
        { title: t("Sabablar"), columns: [{ label: t("Sabab") }, { label: t("Soni"), numeric: true }], rows: data.reasons.map((r) => [t(r.reason), r.count]) },
        {
          title: t("Ketganlar"),
          columns: [{ label: t("O'quvchi") }, { label: t("Ketgan sana") }, { label: t("Guruh") }, { label: t("Ustoz") }, { label: t("Qarz"), numeric: true }, { label: t("Sabab") }, { label: t("Izoh") }],
          rows: rows.map((r) => [r.name, r.leftAt, r.group, r.teacher, r.debt || null, t(r.reason), r.comment]),
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
          <V2Select variant="value" label={t("Kurs")} emptyLabel="Hammasi" value={course} onChange={setCourse} options={(data?.courses_all ?? []).map((c) => ({ value: c, label: c }))} />
          <V2Select variant="value" label={t("Ustoz")} emptyLabel="Hammasi" value={teacher} onChange={setTeacher} options={(data?.teachers ?? []).map((c) => ({ value: c, label: c }))} />
        </>
      }
      filtersEnd={
        <div role="tablist" className="flex rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
          {(
            [
              ["all", t("Hammasi · {n}", { n: all.length })],
              ["paid", t("To'lab ketgan · {n}", { n: all.length - debtors.length })],
              ["debt", t("To'lamay ketgan · {n}", { n: debtors.length })],
            ] as [Seg, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={seg === k} onClick={() => setSeg(k)} className={`h-8 rounded-[6px] px-3 text-v2-small font-semibold ${seg === k ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
              {l}
            </button>
          ))}
        </div>
      }
    >
      {error && <ErrorBanner message="Hisobot yuklanmadi" onRetry={reload} />}
      <div className={stale ? "opacity-60" : ""}>
        <KpiStrip
          loading={loading}
          cells={[
            { key: "a", label: t("Ketganlar"), value: data ? fmtNum(all.length) : null, unit: t("o'quvchi"), sub: f.dayRange(from, to) },
            { key: "b", label: t("Birinchi oyda ketgan"), value: data ? fmtNum(firstMonth) : null, sub: t("{p}% · eng xavfli davr", { p: pct(firstMonth, all.length) }), tone: firstMonth ? "danger" : undefined },
            { key: "c", label: t("To'lamay ketgan"), value: data ? fmtNum(debtors.length) : null, sub: t("qarzi {n} so'm", { n: fmtNum(debtors.reduce((a, r) => a + r.debt, 0)) }), tone: debtors.length ? "danger" : undefined },
            { key: "d", label: t("Qaytib keldi"), value: data ? fmtNum(all.filter((r) => r.returned).length) : null, unit: t("o'quvchi"), sub: t("keyin yana guruhga qo'shilgan"), tone: "success" },
          ]}
        />
      </div>

      <div className={`grid gap-4 lg:grid-cols-3 ${stale ? "opacity-60" : ""}`}>
        <Panel title={t("Sabablar")} sub={t("o'quvchini arxivga o'tkazishda tanlanadi")}>
          <ul className="space-y-2.5 px-4 pb-4">
            {(data?.reasons ?? []).map((r) => (
              <li key={r.reason}>
                <div className="flex justify-between gap-2 text-v2-text">
                  <span className="truncate font-medium">{t(r.reason)}</span>
                  <b className="tabular-nums">{r.count}</b>
                </div>
                <Meter pct={pct(r.count, data!.reasons[0].count)} tone={r.reason === "Sabab yozilmagan" ? "bg-v2-border-strong" : "bg-v2-warning"} />
              </li>
            ))}
            {data && !data.reasons.length && <li className="text-v2-small text-v2-text-3">{t("Bu davrda ketgan o'quvchi yo'q")}</li>}
          </ul>
        </Panel>
        <Panel title={t("Qachon ketadi")} sub={t("guruhga qo'shilgandan keyin")}>
          <ul className="space-y-3 px-4 pb-4">
            {(
              [
                [t("Birinchi oyda"), data?.when.first ?? 0, "bg-v2-danger"],
                [t("2–3-oyda"), data?.when.second ?? 0, "bg-v2-warning"],
                [t("3 oydan keyin"), data?.when.later ?? 0, "bg-v2-border-strong"],
              ] as [string, number, string][]
            ).map(([l, n, c]) => (
              <li key={l}>
                <div className="flex justify-between text-v2-text">
                  <span className="font-medium">{l}</span>
                  <span>
                    <b className="tabular-nums">{n}</b> <span className="text-v2-caption text-v2-text-2">· {pct(n, all.length)}%</span>
                  </span>
                </div>
                <Meter pct={pct(n, all.length)} tone={c} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={t("Kurslar bo'yicha")} sub={t("ketgan · kursdagi o'quvchilardan ulushi")}>
          <ul className="space-y-2 px-4 pb-4">
            {(data?.courses ?? []).map((c) => (
              <li key={c.course} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-v2-text">
                  <span className={`size-2 shrink-0 rounded-[2px] ${FAN_DOT[fanOf(c.course)]}`} aria-hidden />
                  <span className="truncate">{c.course}</span>
                </span>
                <span className="flex items-center gap-2">
                  <b className="tabular-nums text-v2-text">{c.left}</b>
                  <span className="rounded bg-v2-surface-2 px-1.5 text-v2-caption tabular-nums text-v2-text-2">{c.pct}%</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title={t("Ketganlar")}
        sub={t("oxirgilari tepada")}
        right={
          <Link href="/reports/sotuv-voronkasi" className="text-v2-small font-semibold text-v2-brand">
            {t("Lid bosqichida ketganlar — Sotuv voronkasida")} →
          </Link>
        }
      >
        <div className="border-t border-v2-border">
          <ReportTable cols={cols} rows={rows} rowKey={(r) => `${r.pupilId}-${r.leftAt}-${r.group}`} loading={loading} empty={t("Bu davrda ketgan o'quvchi yo'q")} minWidth={980} />
        </div>
      </Panel>
      <NoteLine>{t("Guruh tugaganda chiqqanlar (bitirganlar) bu hisobotga kirmaydi. Sabab — o'quvchini arxivga o'tkazishda yozilgan sabab; qarz — bugungi holat.")}</NoteLine>
    </ReportShell>
  );
}
