"use client";

import { useMemo, useState } from "react";
import { useLang, useT, type TFn } from "@/components/shared/Language";
import { usePayroll } from "@/components/finance/usePayroll";
import { Segmented } from "@/components/v2/form/fields";
import V2MonthNav from "@/components/v2/ui/V2MonthNav";
import { buildingNo } from "@/lib/branchPools";
import type { Bonus } from "@/lib/bonuses";
import type { Penalty } from "@/lib/penalties";
import type { ReportDef } from "@/lib/reportsCatalog";
import { payrollEarned, payrollPayout, type EmployeePayroll } from "@/lib/salary";
import { CENTER_NAME, DOC_FOOTER, useReportData, useReportFmt, useToday } from "./reportHooks";
import { fileSafe, fmtNum, monthRangeLabel, type MonthRange } from "./reportFormat";
import type { ExportDoc } from "./reportExport";
import { ErrorBanner, KpiStrip, NoteLine, ReportShell, ReportTable, SignedNum, type TableCol } from "./reportUi";
import V2MonthRange from "./V2MonthRange";

// YANGI VERSIYA — HISOBOTLAR → XODIMLAR VA OYLIK (katalog kartalari, 25.10.2026; batafsil rasm
// yo'q — «Kelgan va ketgan» qolipida).
//   • «Oylik va avans» — «Oylik chiqarish» sahifasining AYNAN o'sha ma'lumoti va hisobi
//     (components/finance/usePayroll.ts): Jami oylik · Jami avans · Qolgan oylik kartalari
//     o'sha sahifadagilar bilan bir xil; filial — navbar filiali (1+2 — bino tanlovi).
//   • «Bonus va jarimalar» — Moliya → Bonus va Jarima yozuvlari (bekor qilinganlari
//     sanalmaydi), faqat xodimlarga; topshiriq jarimasi — `source.kind = "staff_task"`.

/* ───────────────────────── Oylik va avans ───────────────────────── */

const typeTagOf = (e: EmployeePayroll, t: TFn) =>
  e.salaryType === "mixed" ? t("Oklad + {percent}%", { percent: e.percent }) : e.salaryType === "foiz" ? t("Foiz {percent}%", { percent: e.percent }) : t("Oklad");

export function OylikAvansReport({ report, author }: { report: ReportDef; author: string }) {
  const { t } = useT();
  const f = useReportFmt();
  const today = useToday();
  const p = usePayroll();
  const branchName = p.allowedBranches.find((b) => b.id === (p.building ?? p.navBranchId))?.name ?? "";
  const rows = useMemo(() => [...p.employees].sort((a, b) => Number(b.configured) - Number(a.configured) || a.name.localeCompare(b.name)), [p.employees]);
  const configured = rows.filter((e) => e.configured);
  const sumAvans = configured.reduce((s, e) => s + e.paidAvans, 0);
  const sumOylik = configured.reduce((s, e) => s + e.paidOylik, 0);
  const given = p.given && p.given.hasCashbox ? p.given.avans : null;
  const ready = !p.loading;

  const cols: TableCol<EmployeePayroll>[] = [
    {
      key: "n",
      label: t("Xodim"),
      render: (e) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-v2-text">{e.name}</span>
          <span className="block truncate text-v2-caption text-v2-text-3">{typeTagOf(e, t)}</span>
        </span>
      ),
    },
    { key: "h", label: t("Hisoblangan"), align: "right", render: (e) => (e.configured ? fmtNum(payrollEarned(e, p.period)) : <span className="text-v2-caption text-v2-text-3">{t("Oylik sozlanmagan")}</span>) },
    { key: "a", label: t("Avans"), align: "right", render: (e) => fmtNum(e.paidAvans) },
    { key: "o", label: t("Berilgan oylik"), align: "right", render: (e) => fmtNum(e.paidOylik) },
    { key: "q", label: t("Qolgan oylik"), align: "right", render: (e) => (e.configured ? <span className="font-semibold text-v2-text">{fmtNum(payrollPayout(e, p.period))}</span> : <span className="text-v2-text-3">—</span>) },
  ];

  function getDoc(): ExportDoc | null {
    if (!ready) return null;
    return {
      title: t("{name} hisoboti", { name: t(report.title) }),
      fileBase: `${fileSafe(t(report.title))}-${p.monthKey}`,
      center: t(CENTER_NAME),
      branchLabel: branchName,
      dateLabel: f.fullDate(today),
      author,
      filters: [f.monthTitle(p.monthKey), branchName].join(" · "),
      kpis: [
        { label: t("Jami oylik"), value: `${fmtNum(p.stats.hisoblangan)} ${t("so'm")}` },
        { label: t("Jami avans"), value: given === null ? "—" : `${fmtNum(given)} ${t("so'm")}` },
        { label: t("Qolgan oylik"), value: `${fmtNum(p.stats.qolgan)} ${t("so'm")}` },
      ],
      sections: [
        {
          columns: [
            { label: t("Xodim") },
            { label: t("Hisoblash") },
            { label: t("Hisoblangan"), numeric: true },
            { label: t("Avans"), numeric: true },
            { label: t("Berilgan oylik"), numeric: true },
            { label: t("Qolgan oylik"), numeric: true },
          ],
          rows: rows.map((e) => [e.name, typeTagOf(e, t), e.configured ? payrollEarned(e, p.period) : null, e.paidAvans, e.paidOylik, e.configured ? payrollPayout(e, p.period) : null]),
          total: [t("Jami"), null, p.stats.hisoblangan, sumAvans, sumOylik, p.stats.qolgan],
        },
      ],
      notes: [t("Oylik chiqarish sahifasi bilan bir xil hisob. «Jami avans» — shu filial kassalaridan berilgani; oylik sozlanmagan xodimlar jamiga kirmaydi.")],
      footer: DOC_FOOTER,
    };
  }

  return (
    <ReportShell
      report={report}
      subtitle={branchName || t(report.subtitle)}
      getDoc={getDoc}
      exportReady={ready}
      filters={
        <>
          <V2MonthNav value={p.monthKey} onChange={p.changeMonth} current={p.currentMonthKey} />
          {p.buildings.length > 1 && (
            <div role="tablist" aria-label={t("Bino")} className="inline-flex h-9 items-center gap-0.5 rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
              {p.buildings.map((id) => {
                const on = (p.building ?? p.navBranchId) === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => p.changeBuilding(id)}
                    className={`h-full rounded-[6px] px-3 text-v2-small font-medium transition-colors ${on ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2 hover:text-v2-text"}`}
                  >
                    {t("{n}-bino", { n: buildingNo(id) ?? id })}
                  </button>
                );
              })}
            </div>
          )}
          <span className="text-v2-small text-v2-text-2">{t("Filial yuqoridagi menyudan almashtiriladi")}</span>
        </>
      }
    >
      <KpiStrip
        loading={p.loading}
        cells={[
          { key: "h", label: t("Jami oylik"), value: fmtNum(p.stats.hisoblangan), unit: t("so'm"), sub: t("{n} xodim", { n: configured.length }) },
          { key: "a", label: t("Jami avans"), value: given === null ? null : fmtNum(given), unit: t("so'm"), sub: given === null ? t("bu filialga kassa biriktirilmagan") : t("shu filial kassalaridan") },
          { key: "q", label: t("Qolgan oylik"), value: fmtNum(p.stats.qolgan), unit: t("so'm"), sub: t("to'lanishi kerak") },
        ]}
      />
      <ReportTable
        cols={cols}
        rows={rows}
        rowKey={(e) => e.id}
        loading={p.loading}
        empty={t("Bu filialda oylik ro'yxatida xodim yo'q")}
        minWidth={760}
        total={[t("Jami"), fmtNum(p.stats.hisoblangan), fmtNum(sumAvans), fmtNum(sumOylik), fmtNum(p.stats.qolgan)]}
      />
      <NoteLine>{t("Oylik chiqarish sahifasi bilan bir xil hisob. «Jami avans» — shu filial kassalaridan berilgani; oylik sozlanmagan xodimlar jamiga kirmaydi.")}</NoteLine>
    </ReportShell>
  );
}

/* ───────────────────────── Bonus va jarimalar ───────────────────────── */

type PenaltyRow = Penalty & { source?: { kind?: string } | null };
type Kind = "bonus" | "task" | "other";
interface Entry {
  key: string;
  date: string;
  time: string;
  name: string;
  kind: Kind;
  amount: number;
  note: string;
}
interface PersonRow {
  name: string;
  bonus: number;
  task: number;
  other: number;
}

/** "25.10.2026 14:05" → { date: "2026-10-25", time: "14:05" }. */
function parseStamp(s: string): { date: string; time: string } | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s*\|?\s*(\d{2}:\d{2}))?/.exec(String(s || "").trim());
  return m ? { date: `${m[3]}-${m[2]}-${m[1]}`, time: m[4] ?? "" } : null;
}

export function BonusJarimaReport({ report, author }: { report: ReportDef; author: string }) {
  const { t } = useT();
  const [lang] = useLang();
  const f = useReportFmt();
  const today = useToday();
  const cur = today.slice(0, 7);
  const [range, setRange] = useState<MonthRange>({ from: cur, to: cur });
  const [view, setView] = useState<"people" | "entries">("people");
  const b = useReportData<{ bonuses: Bonus[] }>("/api/bonuses");
  const pn = useReportData<{ penalties: PenaltyRow[] }>("/api/penalties");

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    const inRange = (date: string) => date.slice(0, 7) >= range.from && date.slice(0, 7) <= range.to;
    for (const x of b.data?.bonuses ?? []) {
      const st = parseStamp(x.createdAt);
      if (!st || x.type !== "employee" || x.status === "cancelled" || !inRange(st.date)) continue;
      out.push({ key: `b${x.id}`, ...st, name: x.recipientName, kind: "bonus", amount: Number(x.amount) || 0, note: x.note || "" });
    }
    for (const x of pn.data?.penalties ?? []) {
      const st = parseStamp(x.createdAt);
      if (!st || x.type !== "employee" || x.status === "cancelled" || !inRange(st.date)) continue;
      out.push({ key: `p${x.id}`, ...st, name: x.recipientName, kind: x.source?.kind === "staff_task" ? "task" : "other", amount: Number(x.amount) || 0, note: x.note || "" });
    }
    return out.sort((a, c) => `${c.date} ${c.time}`.localeCompare(`${a.date} ${a.time}`));
  }, [b.data, pn.data, range]);

  const people = useMemo<PersonRow[]>(() => {
    const by = new Map<string, PersonRow>();
    for (const e of entries) {
      const k = e.name.trim().toLowerCase();
      let r = by.get(k);
      if (!r) by.set(k, (r = { name: e.name.trim() || "—", bonus: 0, task: 0, other: 0 }));
      r[e.kind === "bonus" ? "bonus" : e.kind === "task" ? "task" : "other"] += e.amount;
    }
    return [...by.values()].sort((a, c) => c.task + c.other + c.bonus - (a.task + a.other + a.bonus) || a.name.localeCompare(c.name));
  }, [entries]);

  const sum = (k: Kind) => entries.filter((e) => e.kind === k).reduce((s, e) => s + e.amount, 0);
  const bonusSum = sum("bonus");
  const taskSum = sum("task");
  const otherSum = sum("other");
  const fines = taskSum + otherSum;
  const loading = (!b.data && !b.error) || (!pn.data && !pn.error);
  const ready = !loading && (!!b.data || !!pn.data);
  const kindLabel = (k: Kind) => (k === "bonus" ? t("Bonus") : k === "task" ? t("Topshiriq jarimasi") : t("Jarima"));
  const rangeText = monthRangeLabel(range, lang);

  const personCols: TableCol<PersonRow>[] = [
    { key: "n", label: t("Xodim"), render: (r) => <span className="font-medium text-v2-text">{r.name}</span> },
    { key: "b", label: t("Bonus"), align: "right", render: (r) => (r.bonus ? <span className="text-v2-success">+{fmtNum(r.bonus)}</span> : <span className="text-v2-text-3">0</span>) },
    { key: "t", label: t("Topshiriq jarimasi"), align: "right", render: (r) => (r.task ? <span className="text-v2-danger">−{fmtNum(r.task)}</span> : <span className="text-v2-text-3">0</span>) },
    { key: "o", label: t("Boshqa jarima"), align: "right", render: (r) => (r.other ? <span className="text-v2-danger">−{fmtNum(r.other)}</span> : <span className="text-v2-text-3">0</span>) },
    { key: "s", label: t("Sof"), align: "right", render: (r) => <SignedNum value={r.bonus - r.task - r.other} text={fmtNum(r.bonus - r.task - r.other)} /> },
  ];
  const entryCols: TableCol<Entry>[] = [
    { key: "d", label: t("Sana"), render: (e) => <span className="whitespace-nowrap text-v2-text-2">{f.stamp(e.date, e.time || undefined)}</span> },
    { key: "n", label: t("Xodim"), render: (e) => <span className="font-medium text-v2-text">{e.name}</span> },
    { key: "k", label: t("Turi"), render: (e) => <span className={e.kind === "bonus" ? "text-v2-success" : "text-v2-text-2"}>{kindLabel(e.kind)}</span> },
    { key: "a", label: t("Summa, so'm"), align: "right", render: (e) => <span className={`font-semibold ${e.kind === "bonus" ? "text-v2-success" : "text-v2-danger"}`}>{e.kind === "bonus" ? "+" : "−"}{fmtNum(e.amount)}</span> },
    { key: "i", label: t("Izoh"), render: (e) => <span className="line-clamp-2 text-v2-small text-v2-text-2">{e.note || "—"}</span> },
  ];

  function getDoc(): ExportDoc | null {
    if (!ready) return null;
    return {
      title: t("{name} hisoboti", { name: t(report.title) }),
      fileBase: `${fileSafe(t(report.title))}-${range.to}`,
      center: t(CENTER_NAME),
      branchLabel: t("Barcha filiallar"),
      dateLabel: f.fullDate(today),
      author,
      filters: [rangeText, t("Barcha filiallar")].join(" · "),
      kpis: [
        { label: t("Bonuslar"), value: `${fmtNum(bonusSum)} ${t("so'm")}` },
        { label: t("Jarimalar"), value: `${fmtNum(fines)} ${t("so'm")}` },
        { label: t("Topshiriq jarimalari"), value: `${fmtNum(taskSum)} ${t("so'm")}` },
      ],
      sections: [
        {
          title: t("Xodimlar bo'yicha"),
          columns: [{ label: t("Xodim") }, { label: t("Bonus"), numeric: true }, { label: t("Topshiriq jarimasi"), numeric: true }, { label: t("Boshqa jarima"), numeric: true }, { label: t("Sof"), numeric: true }],
          rows: people.map((r) => [r.name, r.bonus, r.task, r.other, r.bonus - r.task - r.other]),
          total: [t("Jami"), bonusSum, taskSum, otherSum, bonusSum - fines],
        },
        {
          title: t("Yozuvlar"),
          columns: [{ label: t("Sana") }, { label: t("Xodim") }, { label: t("Turi") }, { label: t("Summa, so'm"), numeric: true }, { label: t("Izoh") }],
          rows: entries.map((e) => [f.stamp(e.date, e.time || undefined), e.name, kindLabel(e.kind), e.kind === "bonus" ? e.amount : -e.amount, e.note || null]),
        },
      ],
      notes: [t("Bekor qilingan bonus va jarimalar sanalmaydi. Kechikish uchun jarima tizimda yozilmaydi — «Ishga keldim» faqat xabar beradi.")],
      footer: DOC_FOOTER,
    };
  }

  return (
    <ReportShell
      report={report}
      subtitle={t("barcha filiallar")}
      getDoc={getDoc}
      exportReady={ready}
      filters={<V2MonthRange value={range} onChange={setRange} max={cur} />}
      filtersEnd={
        <div className="w-[240px] max-w-full">
          <Segmented
            value={view}
            onChange={(v) => setView(v as "people" | "entries")}
            label={t("Ko'rinish")}
            options={[
              { value: "people", label: t("Xodimlar") },
              { value: "entries", label: t("Yozuvlar") },
            ]}
          />
        </div>
      }
    >
      {(b.error || pn.error) && (
        <ErrorBanner message={b.error && pn.error ? "Hisobot yuklanmadi" : b.error ? "Bonuslar yuklanmadi — faqat jarimalar ko'rsatilgan" : "Jarimalar yuklanmadi — faqat bonuslar ko'rsatilgan"} onRetry={() => (b.error ? b.reload() : pn.reload())} />
      )}
      <KpiStrip
        loading={loading}
        cells={[
          { key: "b", label: t("Bonuslar"), value: fmtNum(bonusSum), unit: t("so'm"), tone: bonusSum > 0 ? "success" : undefined, sub: t("{n} ta yozuv", { n: entries.filter((e) => e.kind === "bonus").length }) },
          { key: "j", label: t("Jarimalar"), value: fmtNum(fines), unit: t("so'm"), tone: fines > 0 ? "danger" : undefined, sub: t("{n} ta yozuv", { n: entries.filter((e) => e.kind !== "bonus").length }) },
          { key: "t", label: t("Topshiriq jarimalari"), value: fmtNum(taskSum), unit: t("so'm"), sub: t("bajarilmagan topshiriqlar") },
          { key: "x", label: t("Xodimlar"), value: fmtNum(people.length), sub: rangeText },
        ]}
      />
      {view === "people" ? (
        <ReportTable cols={personCols} rows={people} rowKey={(r) => r.name} loading={loading} empty={t("Bu davrda bonus yoki jarima yo'q")} minWidth={640} total={[t("Jami"), fmtNum(bonusSum), fmtNum(taskSum), fmtNum(otherSum), <SignedNum key="s" value={bonusSum - fines} text={fmtNum(bonusSum - fines)} />]} />
      ) : (
        <ReportTable cols={entryCols} rows={entries} rowKey={(e) => e.key} loading={loading} empty={t("Bu davrda bonus yoki jarima yo'q")} minWidth={760} />
      )}
      <NoteLine>{t("Bekor qilingan bonus va jarimalar sanalmaydi. Kechikish uchun jarima tizimda yozilmaydi — «Ishga keldim» faqat xabar beradi.")}</NoteLine>
    </ReportShell>
  );
}
