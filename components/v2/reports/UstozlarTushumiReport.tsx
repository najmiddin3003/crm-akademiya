"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import V2MonthNav from "@/components/v2/ui/V2MonthNav";
import V2Select from "@/components/v2/ui/V2Select";
import type { ReportDef } from "@/lib/reportsCatalog";
import type { TeacherRevenueReport, TeacherRevenueRow } from "@/lib/reportResources";
import { CENTER_NAME, DOC_FOOTER, useBranchOptions, useReportData, useReportFmt, useToday } from "./reportHooks";
import { fileSafe, fmtNum } from "./reportFormat";
import type { ExportDoc } from "./reportExport";
import { Callout, Meter, Panel } from "./report35";
import { ErrorBanner, KpiStrip, NoteLine, ReportShell, ReportTable, type TableCol } from "./reportUi";

// YANGI VERSIYA — HISOBOTLAR → «USTOZLAR TUSHUMI» (35-qism, rasm «Ustozlar tushumi»). Oy, Filial; 4 ko'rsatkich
// (Kurs to'lovlari, Ustozlar oyligi, Markazga qoldi, Bog'lanmagan to'lov); jadval Ustoz · Guruh · O'quvchi ·
// Tushum · Oylik · Oylik ulushi (chiziq; 40% dan oshsa `danger`) · Markazga qoldi · 1 o'quvchidan; pastda
// eslatma va «Guruhga bog'lanmagan to'lovlar». Server: /api/reports/teacher-revenue (lib/reportResources.ts).

type Resp = TeacherRevenueReport & { ok: true };
const HIGH = 40;

export default function UstozlarTushumiReport({ report, author }: { report: ReportDef; author: string }) {
  const { t } = useT();
  const f = useReportFmt();
  const today = useToday();
  const cur = today.slice(0, 7);
  const branchOptions = useBranchOptions();
  const [month, setMonth] = useState(cur);
  const [branch, setBranch] = useState("");
  const url = `/api/reports/teacher-revenue?${new URLSearchParams({ month, ...(branch ? { branch } : {}) })}`;
  const { data, loading, stale, error, reload } = useReportData<Resp>(url);
  const branchName = branch ? (branchOptions.find((b) => b.value === branch)?.label ?? "") : t("Barcha filiallar");
  const tot = data?.total;
  const share = tot && tot.revenue ? Math.round((tot.salary / tot.revenue) * 100) : null;
  const high = (data?.rows ?? []).filter((r) => r.share !== null && r.share > HIGH && r.revenue > 0);

  const cols: TableCol<TeacherRevenueRow>[] = [
    { key: "n", label: t("Ustoz"), render: (r) => (<><div className="font-semibold text-v2-text">{r.teacher}</div><div className="text-v2-caption text-v2-text-2">{t(r.salaryNote)}</div></>) },
    { key: "g", label: t("Guruh"), align: "right", render: (r) => r.groups },
    { key: "p", label: t("O'quvchi"), align: "right", render: (r) => r.pupils },
    { key: "r", label: t("Tushum"), align: "right", render: (r) => <b>{fmtNum(r.revenue)}</b> },
    { key: "s", label: t("Oylik"), align: "right", render: (r) => (r.salary === null ? <span className="text-v2-text-3">—</span> : fmtNum(r.salary)) },
    {
      key: "u",
      label: t("Oylik ulushi"),
      className: "w-[200px]",
      render: (r) =>
        r.share === null ? (
          <span className="text-v2-text-3">—</span>
        ) : (
          <span className="flex items-center gap-2">
            <Meter pct={r.share} tone={r.share > HIGH ? "bg-v2-danger" : "bg-v2-info"} />
            <span className={`w-10 text-right font-semibold tabular-nums ${r.share > HIGH ? "text-v2-danger" : "text-v2-text"}`}>{r.share}%</span>
          </span>
        ),
    },
    { key: "c", label: t("Markazga qoldi"), align: "right", render: (r) => <span className={r.center < 0 ? "text-v2-danger" : ""}>{fmtNum(r.center)}</span> },
    { key: "o", label: t("1 o'quvchidan"), align: "right", render: (r) => (r.perPupil === null ? "—" : fmtNum(r.perPupil)) },
  ];

  function getDoc(): ExportDoc | null {
    if (!data || !tot) return null;
    return {
      title: t("{name} hisoboti", { name: t(report.title) }),
      fileBase: `${fileSafe(t(report.title))}-${month}`,
      center: t(CENTER_NAME),
      branchLabel: branchName,
      dateLabel: f.fullDate(today),
      author,
      filters: [f.monthTitle(month), branchName].join(" · "),
      kpis: [
        { label: t("Kurs to'lovlari"), value: fmtNum(tot.revenue) },
        { label: t("Ustozlar oyligi"), value: `${fmtNum(tot.salary)} · ${share ?? "—"}%` },
        { label: t("Markazga qoldi"), value: fmtNum(tot.center) },
        { label: t("Bog'lanmagan to'lov"), value: fmtNum(data.unlinkedSum) },
      ],
      sections: [
        {
          columns: [{ label: t("Ustoz") }, { label: t("Guruh"), numeric: true }, { label: t("O'quvchi"), numeric: true }, { label: t("Tushum"), numeric: true }, { label: t("Oylik"), numeric: true }, { label: t("Ulush, %"), numeric: true }, { label: t("Markazga qoldi"), numeric: true }, { label: t("1 o'quvchidan"), numeric: true }],
          rows: data.rows.map((r) => [r.teacher, r.groups, r.pupils, r.revenue, r.salary, r.share, r.center, r.perPupil]),
          total: [t("Jami"), tot.groups, tot.pupils, tot.revenue, tot.salary, share, tot.center, tot.pupils ? Math.round(tot.revenue / tot.pupils) : null],
        },
      ],
      footer: DOC_FOOTER,
    };
  }

  return (
    <ReportShell
      report={report}
      subtitle={`${t(report.subtitle)} · ${branchName}`}
      getDoc={getDoc}
      exportReady={!!data && !stale}
      filters={
        <>
          <V2MonthNav value={month} onChange={setMonth} current={cur} />
          <V2Select variant="value" label={t("Filial")} emptyLabel="Barchasi" value={branch} onChange={setBranch} options={branchOptions} searchable={false} />
        </>
      }
      filtersEnd={<span className="text-v2-small text-v2-text-2">{t("oylik — «Oylik va avans» bilan bir xil hisob")}</span>}
    >
      {error && <ErrorBanner message="Hisobot yuklanmadi" onRetry={reload} />}
      <div className={stale ? "opacity-60" : ""}>
        <KpiStrip
          loading={loading}
          cells={[
            { key: "r", label: t("Kurs to'lovlari"), value: tot ? fmtNum(tot.revenue) : null, unit: t("so'm"), sub: tot ? t("{a} ustoz · {b} guruh · {c} o'quvchi", { a: data!.rows.length, b: tot.groups, c: tot.pupils }) : "" },
            { key: "s", label: t("Ustozlar oyligi"), value: tot ? fmtNum(tot.salary) : null, sub: share !== null ? t("{p}% · tushumdan ulushi", { p: share }) : t("oylik sozlanmagan") },
            { key: "c", label: t("Markazga qoldi"), value: tot ? fmtNum(tot.center) : null, tone: "success", sub: t("ijara, admin va boshqa xarajatlarga") },
            { key: "u", label: t("Bog'lanmagan to'lov"), value: data ? fmtNum(data.unlinkedSum) : null, sub: t("{n} ta · ustozi yo'q — ulushga tushmadi", { n: data?.unlinked.length ?? 0 }), tone: data?.unlinked.length ? "danger" : undefined },
          ]}
        />
      </div>
      <div className={stale ? "opacity-60" : ""}>
        <ReportTable
          cols={cols}
          rows={data?.rows ?? []}
          rowKey={(r) => r.teacher}
          loading={loading}
          empty={t("Bu oyda ustoz guruhlariga to'lov yo'q")}
          minWidth={980}
          total={tot ? [t("Jami · {n} ustoz", { n: data!.rows.length }), tot.groups, tot.pupils, <b key="r">{fmtNum(tot.revenue)}</b>, fmtNum(tot.salary), <span key="u" className="font-semibold">{share ?? "—"}%</span>, fmtNum(tot.center), tot.pupils ? fmtNum(Math.round(tot.revenue / tot.pupils)) : "—"] : undefined}
        />
      </div>
      <NoteLine>{t("Tushum — shu oyda ustoz guruhlaridagi o'quvchilar to'lagan kurs to'lovlari (to'lovda ustoz ko'rsatilgan); kitob va boshqa kirim kirmaydi · ulush 40% dan oshsa qizil.")}</NoteLine>

      <div className="grid gap-4 lg:grid-cols-2">
        {high.length > 0 ? (
          <Callout icon={<Lightbulb className="size-5" aria-hidden />} title={t("Ulushi yuqori ustozlar")}>
            {high.map((h) => `${h.teacher} — ${h.share}%`).join(", ")}. {t("Guruh to'lsa ulush pasayadi; yoki oklad o'rniga tushumdan foiz qo'llash mumkin.")}
          </Callout>
        ) : (
          <span />
        )}
        <Panel title={t("Guruhga bog'lanmagan to'lovlar · {n}", { n: data?.unlinked.length ?? 0 })} sub={t("ustozga tushmadi — to'lovda ustoz ko'rsatilmagan")}>
          <ul className="divide-y divide-v2-border border-t border-v2-border">
            {(data?.unlinked ?? []).slice(0, 6).map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-v2-text">{u.name}</div>
                  <div className="text-v2-caption text-v2-text-2">{[`${f.dayMonth(u.date)} | ${u.time}`, u.moderator ? t("qabul qildi: {m}", { m: u.moderator }) : ""].filter(Boolean).join(" · ")}</div>
                </div>
                <b className="tabular-nums text-v2-text">{fmtNum(u.amount)}</b>
              </li>
            ))}
            {data && !data.unlinked.length && <li className="px-4 py-3 text-v2-small text-v2-text-3">{t("Hamma to'lov ustozga bog'langan")}</li>}
          </ul>
          {!!data?.unlinked.length && (
            <div className="border-t border-v2-border px-4 py-2.5">
              <Link href="/finance-transactions" className="text-v2-small font-semibold text-v2-brand">
                {t("Tranzaksiyalarda bog'lash")} →
              </Link>
            </div>
          )}
        </Panel>
      </div>
    </ReportShell>
  );
}
