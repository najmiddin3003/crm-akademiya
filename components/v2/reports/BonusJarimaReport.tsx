"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ClipboardList, Clock, Gift, ReceiptText } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT, type TFn } from "@/components/shared/Language";
import V2MonthNav from "@/components/v2/ui/V2MonthNav";
import V2Select from "@/components/v2/ui/V2Select";
import { branchBuildingLabel } from "@/lib/branchPools";
import {
  filterEntries,
  groupEntries,
  totalsOf,
  type BpEmployee,
  type BpEntry,
  type BpKind,
  type BpReport,
  type BpStateFilter,
  type BpTotals,
} from "@/lib/reportBonusPenalty";
import type { ReportDef } from "@/lib/reportsCatalog";
import { CENTER_NAME, DOC_FOOTER, useBranchOptions, useReportData, useReportFmt, useToday } from "./reportHooks";
import { fileSafe, fmtNum, initialsOf, shortPersonName } from "./reportFormat";
import type { ExportDoc } from "./reportExport";
import { ErrorBanner, KpiStrip, NoteLine, ReportShell } from "./reportUi";

// YANGI VERSIYA — HISOBOTLAR → XODIMLAR VA OYLIK → «BONUS VA JARIMALAR» (26-qism, rasmlar
// 45–46 «Bonus va jarimalar · Yorug'/Qorong'i»): oy, Filial, Turi, Holat; Bonuslar ·
// Jarimalar · Kutilmoqda · Bekor qilingan; jadval filial → xodim → yozuv (ochiladigan),
// ustunlar Bonus · Topshiriq jarimasi · Boshqa jarima · Bekor qilingan · Limitdan oshgan ·
// Oylikka ta'siri. Ma'lumot va hisob — /api/reports/bonus-penalty + lib/reportBonusPenalty.ts
// (Oylik sahifasining «Bonus»/«Jarima» manbasi bilan bir xil).
// Rasmdagi «Kechikish jarimasi» ustuni — tizimda bunday jarima yo'q; o'rnida qo'lda yozilgan
// jarimalar («Boshqa jarima», SAVOLLAR D1).

type Resp = BpReport & { ok: true };
type Fmt = ReturnType<typeof useReportFmt>;

const th = "h-9 px-4 text-v2-caption font-medium text-v2-text-2";
const td = "px-4 py-2.5 align-top";
const num = "text-right tabular-nums";

export default function BonusJarimaReport({ report, author }: { report: ReportDef; author: string }) {
  const { t } = useT();
  const f = useReportFmt();
  const today = useToday();
  const cur = today.slice(0, 7);
  const branchOptions = useBranchOptions();
  const [month, setMonth] = useState(cur);
  const [branch, setBranch] = useState("");
  const [kind, setKind] = useState<"" | BpKind>("");
  const [state, setState] = useState<BpStateFilter>("");
  // Ochiq xodimlar; `null` — sukut (birinchi xodim ochiq, rasmdagidek).
  const [openEmp, setOpenEmp] = useState<Set<string> | null>(null);
  const [closedBranch, setClosedBranch] = useState<Set<string>>(() => new Set());

  const { data, loading, stale, error, reload } = useReportData<Resp>(`/api/reports/bonus-penalty?${new URLSearchParams({ month })}`);

  const entries = useMemo(() => (data ? filterEntries(data, { branch, kind, state }) : []), [data, branch, kind, state]);
  const tree = useMemo(() => (data ? groupEntries(data.employees, entries) : []), [data, entries]);
  const tot = useMemo(() => totalsOf(entries), [entries]);
  const empCount = tree.reduce((s, b) => s + b.employees.length, 0);
  const firstEmp = tree[0]?.employees[0]?.emp.key ?? null;
  const opened = openEmp ?? new Set(firstEmp ? [firstEmp] : []);
  const ready = !!data && !stale;

  const branchName = (id: number | null) => {
    if (id === null) return t("Filiali noma'lum");
    const b = data?.branches.find((x) => x.id === id);
    return b ? branchBuildingLabel(b, (n) => t("{n}-bino", { n })) : `#${id}`;
  };
  const branchLabel = branch ? (branchOptions.find((b) => b.value === branch)?.label ?? "") : t("Barcha filiallar");
  const can = data?.can ?? { bonus: true, penalty: true };
  const kindOptions = [
    ...(can.bonus ? [{ value: "bonus", label: t("Bonus") }] : []),
    ...(can.penalty
      ? [
        { value: "task", label: t("Topshiriq jarimasi") },
        { value: "other", label: t("Boshqa jarima") },
      ]
      : []),
  ];
  const stateOptions = [
    { value: "active", label: t("Kuchda") },
    { value: "over", label: t("Limitdan oshgan") },
    { value: "pending", label: t("Kutilmoqda") },
    { value: "cancelled", label: t("Bekor qilingan") },
  ];
  const kindLabel = kind ? (kindOptions.find((o) => o.value === kind)?.label ?? "") : t("Barcha turlar");
  const stateLabel = state ? (stateOptions.find((o) => o.value === state)?.label ?? "") : t("Barcha holatlar");
  const fines = tot.task + tot.other;
  const finesN = tot.taskN + tot.otherN;
  const limit = data?.limitPercent ?? 30;
  const filtered = !!(branch || kind || state);

  const toggleEmp = (key: string) =>
    setOpenEmp(() => {
      const next = new Set(opened);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleBranch = (key: string) =>
    setClosedBranch((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const kpi = {
    bonus: tot.bonus > 0 ? `+${fmtNum(tot.bonus)}` : "0",
    fines: fines > 0 ? fmtNum(-fines) : "0",
    finesSub: tot.over > 0 ? t("{n} ta · {sum} so'mi limitdan oshib ushlanmaydi", { n: finesN, sum: fmtNum(tot.over) }) : t("{n} ta · oylikdan ushlanadi", { n: finesN }),
  };
  const notes = [
    t("Oylikka ta'siri = bonus − ushlangan jarima. Kutilayotgan jarima topshiriq qayta muddatda bajarilsa yozilmaydi."),
    t("Bir oyda okladning {p}% idan ortig'i ushlanmaydi, tarixda qoladi — Sozlamalar → Topshiriqlar. Bonus va jarima yozish — Moliya → Bonus, Jarima.", { p: limit }),
    t("Kechikish uchun jarima tizimda yozilmaydi — «Ishga keldim» faqat xabar beradi. «Boshqa jarima» — Moliya → Jarima'da qo'lda yozilgani."),
  ];

  function getDoc(): ExportDoc | null {
    if (!data) return null;
    const empRows = tree.flatMap((b) =>
      b.employees.map((n) => [
        branchName(b.branchId),
        n.emp.name,
        n.totals.bonus,
        n.totals.task,
        n.totals.other,
        n.totals.cancelled,
        n.totals.over,
        n.totals.pending,
        n.totals.effect,
      ]),
    );
    const empOf = new Map(data.employees.map((e) => [e.key, e]));
    return {
      title: t("{name} hisoboti", { name: t(report.title) }),
      fileBase: `${fileSafe(t(report.title))}-${month}`,
      center: t(CENTER_NAME),
      branchLabel,
      dateLabel: f.fullDate(today),
      author,
      filters: [f.monthTitle(month), branchLabel, kindLabel, stateLabel].join(" · "),
      kpis: [
        { label: t("Bonuslar"), value: `${kpi.bonus} ${t("so'm")}` },
        { label: t("Jarimalar"), value: `${kpi.fines} ${t("so'm")}` },
        { label: t("Kutilmoqda"), value: `${fmtNum(tot.pending)} ${t("so'm")}` },
        { label: t("Bekor qilingan"), value: `${fmtNum(tot.cancelled)} ${t("so'm")}` },
      ],
      sections: [
        {
          title: t("Xodimlar bo'yicha"),
          columns: [
            { label: t("Filial") },
            { label: t("Xodim") },
            { label: t("Bonus"), numeric: true },
            { label: t("Topshiriq jarimasi"), numeric: true },
            { label: t("Boshqa jarima"), numeric: true },
            { label: t("Bekor qilingan"), numeric: true },
            { label: t("Limitdan oshgan"), numeric: true },
            { label: t("Kutilmoqda"), numeric: true },
            { label: t("Oylikka ta'siri"), numeric: true, signed: true },
          ],
          rows: empRows,
          total: [t("Jami"), t("{n} xodim", { n: empCount }), tot.bonus, tot.task, tot.other, tot.cancelled, tot.over, tot.pending, tot.effect],
        },
        {
          title: t("Yozuvlar"),
          columns: [
            { label: t("Sana") },
            { label: t("Xodim") },
            { label: t("Turi") },
            { label: t("Holat") },
            { label: t("Summa, so'm"), numeric: true },
            { label: t("Oylikka ta'siri"), numeric: true, signed: true },
            { label: t("Izoh") },
          ],
          rows: entries.map((e) => {
            const txt = entryText(e, t, f);
            return [
              e.date ? f.stamp(e.date, e.time || undefined) : "—",
              empOf.get(e.emp)?.name ?? "—",
              kindName(e.kind, t),
              stateName(e, t),
              e.amount,
              e.state === "active" ? (e.kind === "bonus" ? e.applied : -e.applied) : null,
              [txt.head, txt.meta, txt.cancel].filter(Boolean).join(" · ") || null,
            ];
          }),
        },
      ],
      notes,
      footer: DOC_FOOTER,
    };
  }

  const header = [
    { key: "n", label: t("Xodim"), cls: "text-left" },
    { key: "b", label: t("Bonus"), cls: "text-right" },
    { key: "t", label: t("Topshiriq jarimasi"), cls: "text-right" },
    { key: "o", label: t("Boshqa jarima"), cls: "text-right" },
    { key: "c", label: t("Bekor qilingan"), cls: "text-right" },
    { key: "l", label: t("Limitdan oshgan"), cls: "text-right" },
    { key: "e", label: t("Oylikka ta'siri"), cls: "text-right" },
  ];

  return (
    <ReportShell
      report={report}
      subtitle={`${t("qolgan oylikka qo'shilgan va ushlangan summalar")} · ${branch ? branchLabel : t("barcha filiallar")}`}
      getDoc={getDoc}
      exportReady={ready}
      filters={
        <>
          <V2MonthNav value={month} onChange={setMonth} current={cur} />
          <V2Select variant="value" label={t("Filial")} emptyLabel="Barchasi" value={branch} onChange={setBranch} options={branchOptions} searchable={false} />
          <V2Select variant="value" label={t("Turi")} emptyLabel="Hammasi" value={kind} onChange={(v) => setKind(v as "" | BpKind)} options={kindOptions} searchable={false} />
          <V2Select variant="value" label={t("Holat")} emptyLabel="Hammasi" value={state} onChange={(v) => setState(v as BpStateFilter)} options={stateOptions} searchable={false} />
        </>
      }
    >
      {error && <ErrorBanner message="Hisobot yuklanmadi" onRetry={reload} />}
      <KpiStrip
        loading={loading}
        cells={[
          { key: "b", label: t("Bonuslar"), value: kpi.bonus, unit: t("so'm"), tone: tot.bonus > 0 ? "success" : undefined, sub: t("{n} ta · qolgan oylikka qo'shiladi", { n: tot.bonusN }) },
          { key: "j", label: t("Jarimalar"), value: kpi.fines, unit: t("so'm"), tone: fines > 0 ? "danger" : undefined, sub: kpi.finesSub },
          {
            key: "k",
            label: t("Kutilmoqda"),
            icon: <Clock className="size-3.5 shrink-0 text-v2-warning" strokeWidth={1.75} aria-hidden />,
            value: fmtNum(tot.pending),
            unit: t("so'm"),
            sub: t("{n} ta · topshiriq qayta muddati tugamagan", { n: tot.pendingN }),
          },
          { key: "x", label: t("Bekor qilingan"), value: fmtNum(tot.cancelled), unit: t("so'm"), sub: t("{n} ta · sababi bilan", { n: tot.cancelledN }) },
        ]}
      />

      <section className={`relative overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm transition-opacity ${stale ? "opacity-60" : ""}`}>
        <div className="relative overflow-x-auto">
          <table className="w-full border-collapse text-v2-body" style={{ minWidth: 980 }}>
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
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="border-b border-v2-border last:border-b-0" aria-hidden>
                    {header.map((h, j) => (
                      <td key={h.key} className={`${td} ${j ? num : ""}`}>
                        <span className={`inline-block h-3 rounded bg-v2-skeleton ${j ? "w-14" : "w-40"}`} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : tree.length === 0 ? (
                <tr>
                  <td colSpan={header.length} className="px-4 py-10 text-center text-v2-small text-v2-text-2">
                    {filtered ? t("Tanlangan filtrlar bo'yicha yozuv yo'q") : t("Bu oyda bonus yoki jarima yo'q")}
                  </td>
                </tr>
              ) : (
                tree.map((b) => {
                  const bKey = String(b.branchId ?? "none");
                  const bOpen = !closedBranch.has(bKey);
                  return (
                    <Fragment key={bKey}>
                      <tr className="border-b border-v2-border bg-v2-surface-2/60">
                        <td className={td}>
                          <button
                            type="button"
                            onClick={() => toggleBranch(bKey)}
                            aria-expanded={bOpen}
                            className="flex min-w-0 items-center gap-2 rounded-v2-sm text-left focus-visible:shadow-v2-focus focus-visible:outline-none"
                          >
                            <Chevron open={bOpen} />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-v2-text">{branchName(b.branchId)}</span>
                              <span className="block text-v2-caption text-v2-text-2">{t("{n} xodim", { n: b.employees.length })}</span>
                            </span>
                          </button>
                        </td>
                        <SumCells totals={b.totals} t={t} strong />
                      </tr>
                      {bOpen &&
                        b.employees.map((n) => {
                          const eOpen = opened.has(n.emp.key);
                          return (
                            <Fragment key={n.emp.key}>
                              <tr className="border-b border-v2-border">
                                <td className={`${td} pl-8`}>
                                  <button
                                    type="button"
                                    onClick={() => toggleEmp(n.emp.key)}
                                    aria-expanded={eOpen}
                                    aria-label={t("{name} yozuvlari", { name: n.emp.name })}
                                    className="flex min-w-0 items-center gap-2 rounded-v2-sm text-left focus-visible:shadow-v2-focus focus-visible:outline-none"
                                  >
                                    <Chevron open={eOpen} />
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2" aria-hidden>
                                      {initialsOf(n.emp.name)}
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate font-medium text-v2-text">{n.emp.name}</span>
                                      <span className="block truncate text-v2-caption text-v2-text-2">{empSub(n.emp, t)}</span>
                                    </span>
                                  </button>
                                </td>
                                <SumCells totals={n.totals} t={t} />
                              </tr>
                              {eOpen && n.entries.map((e) => <EntryRow key={e.key} e={e} t={t} f={f} />)}
                            </Fragment>
                          );
                        })}
                    </Fragment>
                  );
                })
              )}
            </tbody>
            {!loading && tree.length > 0 && (
              <tfoot>
                <tr className="border-t border-v2-border bg-v2-surface-2 font-semibold">
                  <td className={td}>
                    {t("Jami")} · <span className="font-normal text-v2-text-2">{t("{n} xodim", { n: empCount })}</span>
                  </td>
                  <SumCells totals={tot} t={t} strong />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {data && !data.can.bonus && <NoteLine>{t("Bonuslar ko'rsatilmagan — «Moliya → Bonus» bo'limiga ruxsatingiz yo'q.")}</NoteLine>}
      {data && !data.can.penalty && <NoteLine>{t("Jarimalar ko'rsatilmagan — «Moliya → Jarima» bo'limiga ruxsatingiz yo'q.")}</NoteLine>}
      <NoteLine>{notes[0]}</NoteLine>
      <NoteLine>
        {t("Bir oyda okladning {p}% idan ortig'i ushlanmaydi, tarixda qoladi —", { p: limit })} <NoteLink href="/tasks?tab=settings">{t("Sozlamalar → Topshiriqlar")}</NoteLink>.{" "}
        {t("Bonus va jarima yozish —")} <NoteLink href="/finance-bonus">{t("Moliya → Bonus")}</NoteLink>, <NoteLink href="/finance-penalty">{t("Jarima")}</NoteLink>.
      </NoteLine>
      <NoteLine>{notes[2]}</NoteLine>
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

const dash = <span className="text-v2-text-3">—</span>;

/** Filial / xodim / jami qatori: summa va ostida «N ta». */
function SumCells({ totals: x, t, strong }: { totals: BpTotals; t: TFn; strong?: boolean }) {
  const w = strong ? "font-semibold" : "font-medium";
  const cell = (n: number, body: ReactNode, extra?: ReactNode) => (
    <td className={`${td} ${num}`}>
      {n > 0 ? (
        <>
          <span className={`block ${w}`}>{body}</span>
          <span className="block text-v2-caption font-normal text-v2-text-2">{t("{n} ta", { n })}</span>
        </>
      ) : (
        <span className="block">{dash}</span>
      )}
      {extra}
    </td>
  );
  return (
    <>
      {cell(x.bonusN, <span className="text-v2-success">+{fmtNum(x.bonus)}</span>)}
      {cell(
        x.taskN,
        <span className={x.task > 0 ? "text-v2-danger" : "text-v2-text"}>{x.task > 0 ? fmtNum(-x.task) : "0"}</span>,
        x.pendingN > 0 ? <span className="block text-v2-caption font-normal text-v2-warning">{t("kutilmoqda {sum}", { sum: fmtNum(x.pending) })}</span> : null,
      )}
      {cell(x.otherN, <span className="text-v2-danger">{fmtNum(-x.other)}</span>)}
      {cell(x.cancelledN, <span className="text-v2-text-2">{fmtNum(x.cancelled)}</span>)}
      {cell(x.overN, <span className="text-v2-text">{fmtNum(x.over)}</span>)}
      <td className={`${td} ${num}`}>
        <Effect value={x.effect} className={w} />
      </td>
    </>
  );
}

function Effect({ value, className = "" }: { value: number; className?: string }) {
  if (value === 0) return <span className={`text-v2-text-2 ${className}`}>0</span>;
  return <span className={`${value > 0 ? "text-v2-success" : "text-v2-danger"} ${className}`}>{value > 0 ? `+${fmtNum(value)}` : fmtNum(value)}</span>;
}

function Badge({ tone, children }: { tone: "warning" | "neutral"; children: ReactNode }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-v2-sm px-1.5 py-px text-v2-caption font-medium ${tone === "warning" ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-surface-2 text-v2-text-2"}`}>
      {children}
    </span>
  );
}

function EntryRow({ e, t, f }: { e: BpEntry; t: TFn; f: Fmt }) {
  const Icon = e.kind === "bonus" ? Gift : e.kind === "task" ? ClipboardList : ReceiptText;
  const txt = entryText(e, t, f);
  const active = e.state === "active";
  const cancelled = e.state === "cancelled";
  const pending = e.state === "pending";
  const amt = (body: ReactNode) => <span className="text-v2-small">{body}</span>;
  return (
    <tr className="border-b border-v2-border bg-v2-surface-2/30">
      <td className={`${td} pl-[76px]`}>
        <span className="flex min-w-0 items-start gap-2">
          <Icon className={`mt-0.5 size-4 shrink-0 ${pending ? "text-v2-warning" : "text-v2-text-3"}`} strokeWidth={1.75} aria-hidden />
          <span className="min-w-0">
            <span className="block text-v2-small text-v2-text">{txt.head}</span>
            {txt.meta && <span className="block text-v2-caption text-v2-text-2">{txt.meta}</span>}
            {txt.cancel && <span className="block text-v2-caption text-v2-text-2">{txt.cancel}</span>}
          </span>
        </span>
      </td>
      <td className={`${td} ${num}`}>{e.kind === "bonus" && active ? amt(<span className="text-v2-success">+{fmtNum(e.applied)}</span>) : null}</td>
      <td className={`${td} ${num}`}>
        {e.kind === "task" && active ? amt(<span className={e.applied > 0 ? "text-v2-danger" : "text-v2-text-2"}>{e.applied > 0 ? fmtNum(-e.applied) : "0"}</span>) : null}
        {e.kind === "task" && pending ? amt(<span className="text-v2-warning">{fmtNum(e.amount)}</span>) : null}
      </td>
      <td className={`${td} ${num}`}>{e.kind === "other" && active ? amt(<span className="text-v2-danger">{fmtNum(-e.applied)}</span>) : null}</td>
      <td className={`${td} ${num}`}>{cancelled ? amt(<span className="text-v2-text-3 line-through">{fmtNum(e.amount)}</span>) : null}</td>
      <td className={`${td} ${num}`}>{active && e.over > 0 ? amt(<span className="text-v2-text">{fmtNum(e.over)}</span>) : null}</td>
      <td className={`${td} ${num}`}>
        {active ? (
          <Effect value={e.kind === "bonus" ? e.applied : -e.applied} className="text-v2-small" />
        ) : (
          <Badge tone={pending ? "warning" : "neutral"}>{pending ? t("Kutilmoqda") : t("Bekor qilindi")}</Badge>
        )}
      </td>
    </tr>
  );
}

/* ───────────────────────── Matnlar ───────────────────────── */

function kindName(k: BpKind, t: TFn): string {
  return k === "bonus" ? t("Bonus") : k === "task" ? t("Topshiriq jarimasi") : t("Boshqa jarima");
}

function stateName(e: BpEntry, t: TFn): string {
  if (e.state === "pending") return t("Kutilmoqda");
  if (e.state === "cancelled") return t("Bekor qilindi");
  if (e.kind === "bonus") return t("Qo'shiladi");
  if (e.over > 0) return e.applied > 0 ? t("Qisman ushlanadi") : t("Limitdan oshgan");
  return t("Ushlanadi");
}

/** «O'qituvchi · 3 guruh» / «O'qituvchi · Ona tili» / «Moderator · 09:00–18:00». */
function empSub(e: BpEmployee, t: TFn): string {
  if (e.id === null) return t("Xodimlar ro'yxatida topilmadi");
  const role =
    e.turi === "teacher" ? t("O'qituvchi") : e.turi === "moderator" ? t("Moderator") : e.turi === "admin" ? t("Administrator") : e.roleName || t("Xodim");
  const extra = e.turi === "teacher" ? (e.groups > 0 ? t("{n} guruh", { n: e.groups }) : e.subject) : e.workStart && e.workEnd ? `${e.workStart}–${e.workEnd}` : "";
  return [role, extra].filter(Boolean).join(" · ");
}

/** Yozuv qatori: sarlavha, tafsilot, bekor qilish sababi. */
function entryText(e: BpEntry, t: TFn, f: Fmt): { head: string; meta: string; cancel: string } {
  const day = e.date ? `${f.dayMonth(e.date)}, ${f.weekday(e.date)}${e.time ? ` | ${e.time}` : ""}` : t("sanasi yo'q");
  const stamp = e.date ? f.stamp(e.date, e.time || undefined) : t("sanasi yo'q");
  const prio = e.priority ? t("Muhimlik {n}", { n: e.priority }) : "";
  let head: string;
  let meta: string;
  if (e.kind === "task") {
    head = `${t("Topshiriq")} · ${e.title ? `«${e.title}»` : t("nomsiz")}`;
    const when = e.state === "pending" ? t("qayta muddat: {date} gacha", { date: stamp }) : t("bajarilmadi: {date}", { date: stamp });
    meta = [prio, when].filter(Boolean).join(" · ");
  } else if (e.kind === "bonus") {
    head = `${t("Bonus")} · ${e.title || t("izohsiz")}`;
    meta = [day, e.by ? t("bergan: {name}", { name: shortPersonName(e.by) }) : ""].filter(Boolean).join(" · ");
  } else {
    head = `${t("Jarima")} · ${e.title || t("izohsiz")}`;
    meta = day;
  }
  const c = e.cancel;
  const cancel = c
    ? [c.reason ? `«${c.reason}»` : t("sababi yozilmagan"), c.by ? shortPersonName(c.by) : "", c.date ? f.stamp(c.date, c.time || undefined) : ""].filter(Boolean).join(" · ")
    : "";
  return { head, meta, cancel };
}
