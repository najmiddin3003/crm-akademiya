"use client";

import { useEffect, useState } from "react";
import { Download, Info, Loader2 } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import V2MonthNav from "@/components/v2/ui/V2MonthNav";
import V2Select from "@/components/v2/ui/V2Select";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { NoticeBar, PageHead, PageShell, TH, downloadCsv } from "@/components/v2/students/lists/listKit";
import {
  PLAN_TABS,
  type ExpensePayload,
  type FlowPayload,
  type PlanPayload,
  type PlanTab,
  type PnlLine,
  type PnlPayload,
  type RevenuePayload,
} from "@/lib/financialPlanTypes";

// YANGI VERSIYA — MOLIYA → «MOLIYAVIY REJA» (32-qism, rasmlar «Moliyaviy reja» × 4 tab + telefon). Oy, filial,
// Excel; tablar: Tushum rejasi (reja / tushdi / kutilmoqda / muddati o'tgan, bajarilish chizig'i, filiallar,
// qarzdorlar), Xarajat rejasi (moddalar: reja, sarflandi, qoldi), Pul oqimi (haftalar ustunlari va jadval,
// prognoz chiziqli), Foyda va zarar (3 oy + joriy oy · reja). Server: /api/financial-plan (lib/financialPlan.ts).

const nf = (n: number) => Math.round(n).toLocaleString("ru-RU");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const mln = (n: number) => `${(Math.round(n / 100_000) / 10).toLocaleString("ru-RU")}`;
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function FinancialPlanV2({ initialTab = "revenue" }: { initialTab?: PlanTab }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const cur = thisMonth();
  const [tab, setTab] = useState<PlanTab>(initialTab);
  const [month, setMonth] = useState(cur);
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [got, setGot] = useState<{ key: string; data: PlanPayload } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    void fetch("/api/branches")
      .then((r) => r.json())
      .then((j) => j?.ok && setBranches(j.branches))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let off = false;
    const p = new URLSearchParams({ tab, month });
    if (branch) p.set("branch", branch);
    const key = p.toString();
    void fetch(`/api/financial-plan?${p}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (off) return;
        if (j?.ok) {
          setGot({ key, data: j });
          setErr("");
        } else setErr(String(j?.error || "Ma'lumot olinmadi"));
      })
      .catch(() => !off && setErr("Tarmoq xatosi"));
    return () => {
      off = true;
    };
  }, [tab, month, branch]);

  function pickTab(k: PlanTab) {
    setTab(k);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("tab", k);
      window.history.replaceState(null, "", u);
    } catch {}
  }

  const reqKey = new URLSearchParams({ tab, month, ...(branch ? { branch } : {}) }).toString();
  const data = got?.key === reqKey ? got.data : null;
  const branchName = branches.find((b) => String(b.id) === branch)?.name ?? t("Barcha filiallar");
  const subtitle: Record<PlanTab, string> = {
    revenue: t("o'quvchi to'lovlari"),
    expense: t("takrorlanuvchi to'lovlar va chiqimlar"),
    flow: t("barcha kassalar · haqiqiy va prognoz"),
    pnl: t("kassa usulida · oxirgi 4 oy"),
  };

  function exportCsv() {
    if (!data) return;
    const f = `moliyaviy-reja-${tab}-${month}.csv`;
    if (data.tab === "revenue")
      downloadCsv(f, ["Filial", "O'quvchi", "Reja", "Tushdi", "Muddati o'tgan", "Kutilmoqda", "Qarzdor"], data.branches.map((b) => [b.name, b.students, b.plan, b.received, b.overdue, b.pending, b.debtors]));
    else if (data.tab === "expense") downloadCsv(f, ["Modda", "Reja", "Sarflandi", "Qoldi", "Chiqimlar"], data.rows.map((r) => [r.name, r.plan ?? "", r.spent, r.plan === null ? "" : Math.max(0, r.plan - r.spent), r.count]));
    else if (data.tab === "flow") downloadCsv(f, ["Hafta", "Boshida", "Kirim", "Chiqim", "Oxirida", "Prognoz"], data.weeks.map((w) => [`${w.from} – ${w.to}`, w.start, w.inflow, w.outflow, w.end, w.forecast ? "ha" : ""]));
    else
      downloadCsv(
        f,
        ["Modda", ...data.months, ...(data.current ? ["Reja"] : [])],
        [...data.income, ...data.expense].map((l) => [l.label, ...l.values, ...(data.current ? [l.plan ?? ""] : [])]),
      );
  }

  return (
    <PageShell flow>
      <PageHead
        title={t("Moliyaviy reja")}
        subtitle={`${branchName} · ${subtitle[tab]} · ${fmt.monthName(month)} ${month.slice(0, 4)}`}
        actions={
          <>
            <V2MonthNav value={month} onChange={setMonth} current={cur} />
            {branches.length > 1 && (
              <V2Select variant="chip" label={t("Filial")} value={branch} onChange={setBranch} placeholder={t("Barchasi")} clearable options={branches.map((b) => ({ value: String(b.id), label: b.name }))} />
            )}
            <button type="button" onClick={exportCsv} disabled={!data} className={`${secondaryBtn} disabled:opacity-50`}>
              <Download className="size-4" strokeWidth={1.75} aria-hidden />
              Excel
            </button>
          </>
        }
      />

      <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto border-b border-v2-border px-1">
        {PLAN_TABS.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={tab === x.key}
            onClick={() => pickTab(x.key)}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-v2-body font-semibold ${tab === x.key ? "border-v2-brand text-v2-text" : "border-transparent text-v2-text-2 hover:text-v2-text"}`}
          >
            {t(x.label)}
          </button>
        ))}
      </div>

      {err && <NoticeBar>{t(err)}</NoticeBar>}
      {!data && !err && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Hisoblanmoqda…")}
        </div>
      )}
      {data?.tab === "revenue" && <Revenue d={data} />}
      {data?.tab === "expense" && <Expense d={data} />}
      {data?.tab === "flow" && <Flow d={data} />}
      {data?.tab === "pnl" && <Pnl d={data} />}
    </PageShell>
  );
}

function Kpi({ label, value, sub, tone, active }: { label: string; value: string; sub: string; tone?: "success" | "danger" | "warning"; active?: boolean }) {
  const subTone = tone === "success" ? "text-v2-success" : tone === "danger" ? "text-v2-danger" : tone === "warning" ? "text-v2-warning" : "text-v2-text-2";
  return (
    <div className={`p-4 ${active ? "bg-v2-brand-bg" : ""}`}>
      <div className={`text-v2-small ${active ? "font-semibold text-v2-brand-text" : "text-v2-text-2"}`}>{label}</div>
      <div className={`mt-1 text-[22px] font-semibold leading-7 tabular-nums ${tone === "danger" ? "text-v2-danger" : "text-v2-text"}`}>
        {value} <span className="text-v2-small font-normal text-v2-text-2">{"so'm"}</span>
      </div>
      <div className={`mt-0.5 text-v2-small ${subTone}`}>{sub}</div>
    </div>
  );
}

const KpiRow = ({ children }: { children: React.ReactNode }) => (
  <section className="grid grid-cols-2 divide-v2-border overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm xl:grid-cols-4 xl:divide-x [&>*:nth-child(odd)]:border-r [&>*:nth-child(odd)]:border-v2-border xl:[&>*:nth-child(odd)]:border-r-0 [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(-n+2)]:border-v2-border xl:[&>*:nth-child(-n+2)]:border-b-0">
    {children}
  </section>
);

const Card = ({ title, sub, right, children, className = "" }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) => (
  <section className={`overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-2 px-5 pt-4 pb-3">
      <div>
        <h2 className="text-v2-section text-v2-text">{title}</h2>
        {sub && <p className="text-v2-small text-v2-text-2">{sub}</p>}
      </div>
      {right}
    </div>
    {children}
  </section>
);

function Bar({ parts, marker }: { parts: { v: number; c: string }[]; marker?: number }) {
  const total = parts.reduce((a, p) => a + p.v, 0) || 1;
  return (
    <div className="relative h-3 overflow-hidden rounded-full bg-v2-surface-2">
      <div className="flex h-full">
        {parts.map((p, i) => (p.v > 0 ? <span key={i} className={p.c} style={{ width: `${(p.v / total) * 100}%` }} /> : null))}
      </div>
      {marker !== undefined && <span className="absolute inset-y-0 w-0.5 bg-v2-text" style={{ left: `${Math.min(100, marker)}%` }} aria-hidden />}
    </div>
  );
}

const STRIPE = "bg-[repeating-linear-gradient(135deg,var(--v2-border-strong)_0_2px,transparent_2px_6px)]";

// ─────────────────────────────── Tushum ───────────────────────────────

function Revenue({ d }: { d: RevenuePayload }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const k = d.totals;
  return (
    <>
      <KpiRow>
        <Kpi active label={t("{m} rejasi", { m: fmt.monthName(d.month) })} value={nf(k.plan)} sub={t("{n} o'quvchi · darslar × narx", { n: k.students })} />
        <Kpi label={t("Tushdi")} value={nf(k.received)} sub={t("{p}% · rejadan", { p: pct(k.received, k.plan) })} tone="success" />
        <Kpi label={t("Kutilmoqda")} value={nf(k.pending)} sub={t("darslari hali o'tmagan")} />
        <Kpi label={t("Muddati o'tgan")} value={nf(k.overdue)} sub={t("{n} qarzdor", { n: k.debtors })} tone="danger" />
      </KpiRow>

      <Card
        title={t("{m} rejasining bajarilishi", { m: fmt.monthName(d.month) })}
        right={
          !d.closed && (
            <span className="text-v2-small text-v2-text-2">
              {t("Bugungacha kutilgan")} <b className="tabular-nums text-v2-text">{nf(k.expectedToDate)}</b> — {t("shundan")} <b className="text-v2-success">{pct(k.received, k.expectedToDate)}%</b> {t("yig'ildi")}
            </span>
          )
        }
      >
        <div className="px-5 pb-4">
          <Bar
            parts={[
              { v: k.received, c: "bg-v2-success" },
              { v: k.overdue, c: "bg-v2-danger" },
              { v: k.pending, c: STRIPE },
            ]}
          />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-v2-small text-v2-text-2">
            <Legend c="bg-v2-success" label={t("Tushdi")} v={k.received} p={pct(k.received, k.plan)} />
            <Legend c="bg-v2-danger" label={t("Muddati o'tgan")} v={k.overdue} p={pct(k.overdue, k.plan)} />
            <Legend c="bg-v2-surface-2 border border-v2-border-strong" label={t("Kutilmoqda")} v={k.pending} p={pct(k.pending, k.plan)} />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-v2-body">
              <thead>
                <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                  <th className={`${TH} pl-5`}>{t("Filial")}</th>
                  <th className={`${TH} text-right`}>{t("Reja")}</th>
                  <th className={`${TH} text-right`}>{t("Tushdi")}</th>
                  <th className={`${TH} text-right`}>{t("Qarz")}</th>
                  <th className={`${TH} text-right`}>{t("Kutilmoqda")}</th>
                  <th className={`${TH} pr-5`}>{t("Bajarilish")}</th>
                </tr>
              </thead>
              <tbody>
                {d.branches.map((b) => (
                  <tr key={b.branchId} className="border-b border-v2-border">
                    <td className="py-3 pl-5 pr-3">
                      <div className="font-semibold text-v2-text">{b.name}</div>
                      <div className="text-v2-small text-v2-text-2">{t("{n} o'quvchi", { n: b.students })}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-v2-text">{nf(b.plan)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-v2-text">{nf(b.received)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <div className={b.overdue ? "text-v2-danger" : "text-v2-text-2"}>{b.overdue ? nf(b.overdue) : "0"}</div>
                      <div className="text-v2-small text-v2-text-2">{b.debtors ? t("{n} qarzdor", { n: b.debtors }) : "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-v2-text">{nf(b.pending)}</td>
                    <td className="py-3 pl-3 pr-5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-v2-surface-2">
                          <div className="h-full bg-v2-success" style={{ width: `${pct(b.received, b.plan)}%` }} />
                        </div>
                        <span className="font-semibold tabular-nums text-v2-text">{pct(b.received, b.plan)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-v2-surface-2 font-semibold">
                  <td className="py-3 pl-5 pr-3 text-v2-text">{t("Jami · {n} o'quvchi", { n: k.students })}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-v2-text">{nf(k.plan)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-v2-text">{nf(k.received)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-v2-danger">{nf(k.overdue)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-v2-text">{nf(k.pending)}</td>
                  <td className="py-3 pl-3 pr-5 tabular-nums text-v2-text">{pct(k.received, k.plan)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <Card title={t("Eng katta qarzdorlar")} right={<span className="text-v2-small text-v2-text-2">{t("{n} ta", { n: k.debtors })}</span>}>
          {d.debtors.length === 0 && <p className="px-5 pb-5 text-v2-small text-v2-text-3">{t("Qarzdor yo'q")}</p>}
          <ul className="divide-y divide-v2-border border-t border-v2-border">
            {d.debtors.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-v2-text">{x.name}</div>
                  <div className="truncate text-v2-small text-v2-text-2">{x.groups}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold tabular-nums text-v2-danger">{nf(x.debt)}</div>
                  {x.months > 0 && <div className="text-v2-small text-v2-text-2">{t("{n} oy", { n: x.months })}</div>}
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-v2-border px-5 py-3">
            <Link href="/reports-unpaid" className="text-v2-small font-semibold text-v2-brand">
              {t("Qarzdorlar · {n}", { n: k.debtors })} →
            </Link>
          </div>
        </Card>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-v2-lg border border-v2-border bg-v2-surface px-5 py-4 shadow-v2-sm">
        <div className="min-w-0">
          <div className="font-semibold text-v2-text">{t("Reja qanday tuziladi")}</div>
          <p className="text-v2-small text-v2-text-2">
            {t("Har bir o'quvchi uchun: shu oyda guruh jadvalidagi darslar × bitta dars narxi (oylik narx ÷ oydagi darslar). Oy ichida qo'shilgan yoki ketgan o'quvchi rejani o'zi o'zgartiradi.")}
            {d.issues > 0 && <span className="text-v2-warning"> {t("{n} ta guruhda narx yoki boshlanish sanasi yo'q — rejaga kirmagan.", { n: d.issues })}</span>}
          </p>
        </div>
      </section>
    </>
  );
}

function Legend({ c, label, v, p }: { c: string; label: string; v: number; p: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2.5 rounded-[3px] ${c}`} aria-hidden />
      {label} <b className="tabular-nums text-v2-text">{nf(v)}</b> · {p}%
    </span>
  );
}

// ─────────────────────────────── Xarajat ───────────────────────────────

function Expense({ d }: { d: ExpensePayload }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const k = d.totals;
  return (
    <>
      <KpiRow>
        <Kpi active label={t("{m} rejasi", { m: fmt.monthName(d.month) })} value={nf(k.plan)} sub={t("{n} modda", { n: k.items })} />
        <Kpi label={t("Sarflandi")} value={nf(k.spent)} sub={t("{p}% · kirim-chiqim bo'yicha", { p: pct(k.spentPlanned, k.plan) })} />
        <Kpi label={t("Qoldi")} value={nf(k.left)} sub={t("rejadagi moddalar bo'yicha")} tone="success" />
        <Kpi label={t("Rejadan tashqari")} value={nf(k.unplanned)} sub={t("rejada yo'q moddalar")} tone={k.unplanned > 0 ? "warning" : undefined} />
      </KpiRow>

      <Card
        title={t("{m} xarajatlari", { m: fmt.monthName(d.month) })}
        sub={t("Rejalashtirilgan xarajatlar va kassadagi chiqimlar — tranzaksiya turi nomi bo'yicha bog'lanadi")}
        right={
          <Link href="/finance-planned" className={secondaryBtn}>
            {t("Rejani tahrirlash")}
          </Link>
        }
      >
        <div className="overflow-x-auto border-t border-v2-border">
          <table className="w-full min-w-[720px] border-collapse text-v2-body">
            <thead>
              <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                <th className={`${TH} pl-5`}>{t("Xarajat")}</th>
                <th className={`${TH} text-right`}>{t("Reja")}</th>
                <th className={TH}>{t("Sarflandi")}</th>
                <th className={`${TH} text-right`}>{t("Qoldi")}</th>
                <th className={`${TH} pr-5`}>{t("Oxirgi chiqim")}</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-v2-small text-v2-text-3">
                    {t("Bu oyda reja ham, chiqim ham yo'q — «Rejani tahrirlash» orqali takrorlanuvchi xarajatlarni kiriting")}
                  </td>
                </tr>
              )}
              {d.rows.map((r) => {
                const p = r.plan ? pct(r.spent, r.plan) : null;
                const over = r.plan !== null && r.spent > r.plan;
                return (
                  <tr key={r.name} className="border-b border-v2-border">
                    <td className="py-3 pl-5 pr-3">
                      <div className="font-semibold text-v2-text">{r.name}</div>
                      <div className="text-v2-small text-v2-text-2">{r.plan === null ? <span className="text-v2-warning">{t("rejada yo'q")}</span> : t(r.planNote)}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-v2-text">{r.plan === null ? "—" : nf(r.plan)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-between gap-3 tabular-nums">
                        <span className="text-v2-text">{nf(r.spent)}</span>
                        {p !== null && <span className={`text-v2-small ${over ? "text-v2-danger" : "text-v2-text-2"}`}>{p}%</span>}
                      </div>
                      {r.plan !== null && (
                        <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-v2-surface-2">
                          <div className={`h-full ${over ? "bg-v2-danger" : "bg-v2-success"}`} style={{ width: `${Math.min(100, p ?? 0)}%` }} />
                        </div>
                      )}
                    </td>
                    <td className={`px-3 py-3 text-right tabular-nums ${over ? "text-v2-danger" : "text-v2-text"}`}>
                      {r.plan === null ? "—" : over ? `−${nf(r.spent - r.plan)}` : nf(r.plan - r.spent)}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-v2-small text-v2-text-2">{r.lastDate ? `${fmt.dayMonth(r.lastDate)} · ${t("{n} ta", { n: r.count })}` : "—"}</td>
                  </tr>
                );
              })}
              {d.rows.length > 0 && (
                <tr className="bg-v2-surface-2 font-semibold">
                  <td className="py-3 pl-5 pr-3 text-v2-text">{t("Jami · {n} modda", { n: d.rows.length })}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-v2-text">{nf(k.plan)}</td>
                  <td className="px-3 py-3 tabular-nums text-v2-text">
                    {nf(k.spent)} · {pct(k.spentPlanned, k.plan)}%
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-v2-success">{nf(k.left)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// ─────────────────────────────── Pul oqimi ───────────────────────────────

function Flow({ d }: { d: FlowPayload }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const max = Math.max(1, ...d.weeks.flatMap((w) => [w.inflow, -w.outflow]));
  const last = d.weeks[d.weeks.length - 1];
  const hasForecast = d.weeks.some((w) => w.forecast);
  return (
    <>
      <KpiRow>
        <Kpi label={t("{d}-qoldig'i", { d: fmt.dayMonth(`${d.month}-01`) })} value={nf(d.opening)} sub={t("barcha kassalarda")} />
        <Kpi label={hasForecast ? t("Bugun, {d}", { d: fmt.dayMonth(d.today) }) : t("Oy oxirida")} value={nf(d.current)} sub={`${d.current - d.opening >= 0 ? "+" : "−"}${nf(Math.abs(d.current - d.opening))} ${t("oy boshidan")}`} tone={d.current >= d.opening ? "success" : "danger"} />
        <Kpi active={hasForecast} label={hasForecast ? t("{d} prognozi", { d: fmt.dayMonth(last.to) }) : t("Oxirgi hafta oxiri")} value={nf(d.forecastEnd)} sub={hasForecast ? t("qarzlarsiz") : ""} />
        <Kpi label={t("Eng past qoldiq")} value={nf(d.lowest.amount)} sub={fmt.dayMonth(d.lowest.date)} tone={d.lowest.amount < 0 ? "danger" : undefined} />
      </KpiRow>

      <Card
        title={t("Haftalar bo'yicha kirim, chiqim va qoldiq")}
        sub={t("mln so'm") + (hasForecast ? ` · ${t("bugundan keyingi kunlar — prognoz")}` : "")}
        right={
          <div className="flex gap-3 text-v2-small text-v2-text-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-v2-info" /> {t("Kirim")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-v2-warning" /> {t("Chiqim")}
            </span>
            {hasForecast && (
              <span className="inline-flex items-center gap-1.5">
                <span className={`size-2.5 rounded-[3px] border border-v2-border-strong ${STRIPE}`} /> {t("Prognoz")}
              </span>
            )}
          </div>
        }
      >
        <div className="flex items-end justify-around gap-2 overflow-x-auto px-5 pb-4 pt-8">
          {d.weeks.map((w) => (
            <div key={w.from} className="flex min-w-[88px] flex-col items-center">
              <span className={`mb-2 rounded-full px-2 py-0.5 text-v2-caption font-semibold tabular-nums ${w.forecast ? "bg-v2-surface-2 text-v2-text-2" : "bg-v2-info-bg text-v2-info"}`}>{mln(w.end)} mln</span>
              <div className="flex h-44 items-end gap-1.5">
                {[
                  { v: w.inflow, c: w.forecast ? "bg-[repeating-linear-gradient(135deg,var(--v2-info)_0_2px,transparent_2px_6px)] border border-v2-info" : "bg-v2-info" },
                  { v: -w.outflow, c: w.forecast ? "bg-[repeating-linear-gradient(135deg,var(--v2-warning)_0_2px,transparent_2px_6px)] border border-v2-warning" : "bg-v2-warning" },
                ].map((b, i) => (
                  <div key={i} className="flex flex-col items-center justify-end">
                    <span className="mb-1 text-v2-caption tabular-nums text-v2-text-2">{mln(b.v)}</span>
                    <div className={`w-7 rounded-t-[4px] ${b.c}`} style={{ height: `${Math.max(2, (b.v / max) * 150)}px` }} />
                  </div>
                ))}
              </div>
              <div className="mt-2 text-v2-small font-semibold text-v2-text">{t(w.label)}</div>
              <div className="text-v2-caption text-v2-text-2">
                {Number(w.from.slice(8))}–{fmt.dayMonth(w.to)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-v2-body">
            <thead>
              <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                <th className={`${TH} pl-5`}>{t("Hafta")}</th>
                <th className={`${TH} text-right`}>{t("Boshida")}</th>
                <th className={`${TH} text-right`}>{t("Kirim")}</th>
                <th className={`${TH} text-right`}>{t("Chiqim")}</th>
                <th className={`${TH} text-right`}>{t("Oxirida")}</th>
                <th className={`${TH} pr-5`}>{t("Asosiy to'lovlar")}</th>
              </tr>
            </thead>
            <tbody>
              {d.weeks.map((w) => (
                <tr key={w.from} className="border-b border-v2-border last:border-b-0">
                  <td className="py-3 pl-5 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-v2-text">{t(w.label)}</span>
                      {w.forecast && <span className="rounded-full border border-v2-border px-2 text-v2-caption text-v2-text-2">{t("prognoz")}</span>}
                    </div>
                    <div className="text-v2-small text-v2-text-2">
                      {Number(w.from.slice(8))}–{fmt.dayMonth(w.to)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-v2-text-2">{nf(w.start)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-v2-success">+{nf(w.inflow)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-v2-danger">{w.outflow ? `−${nf(-w.outflow)}` : "0"}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-v2-text">{nf(w.end)}</td>
                  <td className="py-3 pl-3 pr-5 text-v2-small text-v2-text-2">
                    {w.notes.length ? w.notes.map((n) => `${n.name} ${nf(n.amount)} (${fmt.dayMonth(n.date)})`).join(", ") : w.forecast ? t("rejadagi xarajatlar va kutilayotgan to'lovlar") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="flex items-start gap-2 border-t border-v2-border px-5 py-3 text-v2-small text-v2-text-2">
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          {t("Prognoz = Tushum rejasidagi kutilayotgan to'lovlar − Xarajat rejasidagi qolgan to'lovlar, qolgan kunlarga teng bo'linadi. Qarzlar qo'shilmagan. Kassalar orasidagi ko'chirmalar kirim-chiqimga kirmaydi.")}
        </p>
      </section>
    </>
  );
}

// ─────────────────────────────── Foyda va zarar ───────────────────────────────

function Pnl({ d }: { d: PnlPayload }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const n = d.months.length;
  const last = n - 1;
  const prev = d.totals.profit.slice(0, last);
  const avg3 = prev.length ? Math.round(prev.reduce((a, b) => a + b, 0) / prev.length) : 0;
  const planProfit = d.current && d.totals.planIncome !== null ? d.totals.planIncome - (d.totals.planExpense ?? 0) : null;
  const share = (p: number, i: number) => pct(p, d.totals.income[i]);
  const head = (m: string, i: number) => `${fmt.monthName(m)}${i === last && d.current ? ` · ${t("hozircha")}` : ""}`;
  const prevM = d.months[last - 1];
  return (
    <>
      <KpiRow>
        <Kpi label={t("{m} foydasi", { m: fmt.monthName(prevM) })} value={nf(d.totals.profit[last - 1])} sub={t("{p}% · kassa usulida", { p: share(d.totals.profit[last - 1], last - 1) })} />
        <Kpi active label={d.current ? t("{m} · hozircha", { m: fmt.monthName(d.months[last]) }) : t("{m} foydasi", { m: fmt.monthName(d.months[last]) })} value={nf(d.totals.profit[last])} sub={planProfit !== null ? t("rejada {n}", { n: nf(planProfit) }) : t("{p}%", { p: share(d.totals.profit[last], last) })} />
        <Kpi label={t("3 oy o'rtachasi")} value={nf(avg3)} sub={`${fmt.monthName(d.months[0])} – ${fmt.monthName(prevM)}`} />
        <Kpi label={t("{m} · daromad", { m: fmt.monthName(d.months[last]) })} value={nf(d.totals.income[last])} sub={t("xarajat {n}", { n: nf(d.totals.expense[last]) })} />
      </KpiRow>

      <div className="flex items-start gap-2 rounded-v2-md bg-v2-info-bg px-4 py-2.5 text-v2-small text-v2-text">
        <Info className="mt-0.5 size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
        {t("Kassa usuli: kirim va chiqim tushgan oyiga yoziladi (to'lov qaysi oy uchun ekani tizimda saqlanmaydi). Kassalararo ko'chirmalar kirmaydi.")}
      </div>

      <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-v2-body">
            <thead>
              <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                <th className={`${TH} pl-5`}>{t("Modda")}</th>
                {d.months.map((m, i) => (
                  <th key={m} className={`${TH} text-right`}>
                    {head(m, i)}
                  </th>
                ))}
                {d.current && <th className={`${TH} bg-v2-brand-bg pr-5 text-right text-v2-brand-text`}>{t("{m} · reja", { m: fmt.monthName(d.current) })}</th>}
              </tr>
            </thead>
            <tbody>
              <PnlSection n={n} label={t("Daromad")} />
              {d.income.map((l) => (
                <PnlLineRow key={l.key} l={l} current={!!d.current} />
              ))}
              <PnlTotal current={!!d.current} label={t("Jami daromad")} vals={d.totals.income} plan={d.totals.planIncome} />
              <PnlSection n={n} label={t("Xarajatlar")} />
              {d.expense.length === 0 && (
                <tr className="border-b border-v2-border">
                  <td colSpan={n + 2} className="py-2.5 pl-8 text-v2-small text-v2-text-3">
                    {t("Chiqim yozilmagan")}
                  </td>
                </tr>
              )}
              {d.expense.map((l) => (
                <PnlLineRow key={l.key} l={l} current={!!d.current} />
              ))}
              <PnlTotal current={!!d.current} label={t("Jami xarajat")} vals={d.totals.expense} plan={d.totals.planExpense} />
              <PnlTotal current={!!d.current} strong label={t("Sof foyda")} vals={d.totals.profit} plan={planProfit} />
              <tr>
                <td className="py-3 pl-5 pr-3 text-v2-text-2">{t("Foyda ulushi")}</td>
                {d.totals.profit.map((p, i) => (
                  <td key={i} className="px-3 py-3 text-right tabular-nums text-v2-text-2">
                    {d.totals.income[i] ? `${share(p, i)}%` : "—"}
                  </td>
                ))}
                {d.current && <td className="bg-v2-brand-bg/50 px-3 py-3 pr-5 text-right tabular-nums text-v2-text-2">{planProfit !== null && d.totals.planIncome ? `${pct(planProfit, d.totals.planIncome)}%` : "—"}</td>}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

const ROW = "border-b border-v2-border";

function PnlLineRow({ l, current }: { l: PnlLine; current: boolean }) {
  const { t } = useT();
  return (
    <tr className={ROW}>
      <td className="py-2.5 pl-8 pr-3 text-v2-text">{t(l.label)}</td>
      {l.values.map((v, i) => (
        <td key={i} className="px-3 py-2.5 text-right tabular-nums text-v2-text">
          {nf(v)}
        </td>
      ))}
      {current && <td className="bg-v2-brand-bg/50 px-3 py-2.5 pr-5 text-right tabular-nums text-v2-text">{l.plan === null ? "—" : nf(l.plan)}</td>}
    </tr>
  );
}

function PnlTotal({ label, vals, plan, strong, current }: { label: string; vals: number[]; plan: number | null; strong?: boolean; current: boolean }) {
  return (
    <tr className={`${ROW} ${strong ? "bg-v2-brand-bg" : ""}`}>
      <td className="py-3 pl-5 pr-3 font-semibold text-v2-text">{label}</td>
      {vals.map((v, i) => (
        <td key={i} className={`px-3 py-3 text-right font-semibold tabular-nums ${v < 0 ? "text-v2-danger" : "text-v2-text"}`}>
          {nf(v)}
        </td>
      ))}
      {current && <td className="bg-v2-brand-bg/50 px-3 py-3 pr-5 text-right font-semibold tabular-nums text-v2-text">{plan === null ? "—" : nf(plan)}</td>}
    </tr>
  );
}

function PnlSection({ label, n }: { label: string; n: number }) {
  return (
    <tr className={ROW}>
      <td colSpan={n + 2} className="px-5 pt-4 pb-1.5 text-v2-caption font-semibold uppercase tracking-wide text-v2-text-3">
        {label}
      </td>
    </tr>
  );
}
