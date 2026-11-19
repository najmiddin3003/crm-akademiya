"use client";

import { useState } from "react";
import { AlertTriangle, Bell, ChevronRight, Download, Eye, EyeOff, Inbox, Megaphone, TrendingDown, TrendingUp, Truck, UserX, Wallet } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { methodDot } from "@/components/v2/form/fields";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { downloadCsv, NoticeBar } from "@/components/v2/students/lists/listKit";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { Card, CardTitle } from "@/components/v2/teacher/teacherBits";
import { ApprovalIcon, BranchDot, MoneyBar, nf, Pill, type Tone } from "./ownerBits";

// YANGI VERSIYA — RAHBAR PANELI · UMUMIY KO'RINISH (48-qism, rasm «Rahbar paneli · umumiy ko'rinish», kompyuter va
// telefon). Pul (jami, Rahbar kassasi, filial kassalarida, yo'lda), bugungi tushum, oy tushumi va rejasi; Filiallar
// taqqoslash (34-qismdagi «Filiallar holati» shu yerga ko'chdi); Tasdiq kutmoqda; E'tibor talab qiladi; Xodimlar va
// nazorat · bugun; Foyda va prognoz. Server — /api/owner?view=overview (lib/ownerPanel.ts).

interface Cmp {
  id: number;
  name: string;
  groups: number;
  staff: number;
  revenue: number;
  plan: number;
  planPct: number | null;
  debtors: number;
  debtorsPct: number;
  profit: number;
  forecast: number;
  leads: number;
  convPct: number | null;
  firstPay: number;
  active: number;
  fillPct: number | null;
  attendancePct: number | null;
  rating: number | null;
}
interface Data {
  ok: true;
  today: string;
  now: string;
  month: string;
  monthPct: number;
  day: number;
  daysIn: number;
  branches: { id: number; name: string }[];
  money: { total: number; primary: number; branchCash: number; branchCount: number; staleNote: string; transit: number; inTransit: { from: string; owner: string; amount: number; time: string; date: string }[]; outWaiting: number };
  todayIncome: { total: number; count: number; byMethod: Record<string, number>; byBranch: { id: number; name: string; sum: number }[]; lastTime: string };
  revenue: null | { received: number; plan: number; pct: number | null; pending: number; overdue: number; debtors: number; expectedToDate: number };
  compare: Cmp[];
  approvals: { items: { key: string; kind: string; title: string; sub: string; amount: number; percent?: number | null; badge: { tone: string; text: string } | null }[]; counts: { all: number } };
  alerts: { kind: string; title: string; sub: string; href: string; action?: string }[];
  staff: { id: number; name: string; staff: number; came: number; expected: number; late: number; absent: string[]; unmarked: number; unmarkedList: string[]; overdueTasks: number; unanswered: number; cash: { tone: string; text: string } | null }[];
  profit: { total: number; forecast: number; planIncome: number | null; planExpense: number | null; branches: { id: number; name: string; profit: number; forecast: number; pct: number | null }[]; salary: { avans: number; oylik: number }; cashForecast: number; cashForecastPlus: number };
}

const SHORT = (name: string) => name.replace(/^Akademiya\s+\d+\s+/i, "");

/** Eng yaxshi / e'tibor kerak — ustunlar ichida (rasmdagi yashil va qizil katak). */
function Mark({ v, best, worst, children }: { v: number | null; best: number | null; worst: number | null; children: React.ReactNode }) {
  const cls = v !== null && best !== null && v === best && best !== worst ? "rounded-v2-sm bg-v2-success-bg px-1.5 py-0.5 text-v2-success" : v !== null && worst !== null && v === worst && best !== worst ? "rounded-v2-sm bg-v2-danger-bg px-1.5 py-0.5 text-v2-danger" : "";
  return <span className={`tabular-nums ${cls}`}>{children}</span>;
}

export default function OwnerOverviewV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const { data, error } = useReportData<Data>("/api/owner?view=overview");
  const [hide, setHide] = useState(false);

  if (error) return <NoticeBar>{t("Ma'lumotni yuklab bo'lmadi")}</NoticeBar>;
  if (!data) return <div className="h-96 animate-pulse rounded-v2-lg bg-v2-skeleton" />;
  const d = data;
  const m = d.money;
  const money = (n: number) => (hide ? "• • •" : nf(n));
  const many = d.compare.length > 1;
  const ext = (k: keyof Cmp, dir: "max" | "min" = "max") => {
    const vals = d.compare.map((c) => c[k]).filter((v): v is number => typeof v === "number");
    if (vals.length < 2) return { best: null, worst: null };
    return dir === "max" ? { best: Math.max(...vals), worst: Math.min(...vals) } : { best: Math.min(...vals), worst: Math.max(...vals) };
  };
  const sumOf = (k: keyof Cmp) => d.compare.reduce((a, c) => a + (Number(c[k]) || 0), 0);
  const avgOf = (k: keyof Cmp) => {
    const vals = d.compare.map((c) => c[k]).filter((v): v is number => typeof v === "number");
    return vals.length ? Math.round((vals.reduce((a, v) => a + v, 0) / vals.length) * 10) / 10 : null;
  };
  type Row = { label: string; sub?: string; k: keyof Cmp; dir?: "max" | "min"; show: (c: Cmp) => string; total: string };
  const sections: { title: string; rows: Row[] }[] = [
    {
      title: `${t("Moliya")} · ${fmt.monthLower(d.month)}`,
      rows: [
        { label: t("Tushum"), k: "revenue", show: (c) => nf(c.revenue), total: nf(sumOf("revenue")) },
        { label: t("Tushum rejasi"), sub: t("{d} holatiga", { d: fmt.dayMonth(d.today) }), k: "planPct", show: (c) => (c.planPct === null ? "—" : `${c.planPct}%`), total: d.revenue?.pct != null ? `${d.revenue.pct}%` : "—" },
        { label: t("Qarzdorlar"), sub: t("aktiv o'quvchilardan"), k: "debtorsPct", dir: "min", show: (c) => (c.debtors ? `${c.debtors} · ${String(c.debtorsPct).replace(".", ",")}%` : "0"), total: String(sumOf("debtors")) },
        { label: t("Foyda prognozi"), sub: t("oy oxiriga · hisoblangan usulda"), k: "forecast", show: (c) => nf(c.forecast), total: nf(sumOf("forecast")) },
      ],
    },
    {
      title: `${t("Sotuv")} · ${fmt.monthLower(d.month)}`,
      rows: [
        { label: t("Yangi lidlar"), k: "leads", show: (c) => String(c.leads), total: String(sumOf("leads")) },
        { label: t("Liddan o'quvchiga"), sub: t("lid → birinchi to'lov"), k: "convPct", show: (c) => (c.convPct === null ? "—" : `${c.convPct}%`), total: sumOf("leads") ? `${Math.round((sumOf("firstPay") / sumOf("leads")) * 100)}%` : "—" },
        { label: t("Birinchi to'lov"), k: "firstPay", show: (c) => String(c.firstPay), total: String(sumOf("firstPay")) },
      ],
    },
    {
      title: t("O'quvchilar"),
      rows: [
        { label: t("Aktiv o'quvchilar"), k: "active", show: (c) => String(c.active), total: String(sumOf("active")) },
        { label: t("Guruh to'liqligi"), sub: t("o'quvchi ÷ guruhlar sig'imi"), k: "fillPct", show: (c) => (c.fillPct === null ? "—" : `${c.fillPct}%`), total: avgOf("fillPct") === null ? "—" : `${Math.round(avgOf("fillPct")!)}%` },
        { label: t("O'rtacha davomat"), k: "attendancePct", show: (c) => (c.attendancePct === null ? "—" : `${c.attendancePct}%`), total: avgOf("attendancePct") === null ? "—" : `${Math.round(avgOf("attendancePct")!)}%` },
        { label: t("Ustozlar bahosi"), sub: t("o'quvchilar darsdan keyin"), k: "rating", show: (c) => (c.rating === null ? "—" : String(c.rating).replace(".", ",")), total: avgOf("rating") === null ? "—" : String(avgOf("rating")).replace(".", ",") },
      ],
    },
  ];

  function exportCsv() {
    downloadCsv(
      `rahbar-paneli-${d.today}.csv`,
      [t("Ko'rsatkich"), ...d.compare.map((c) => c.name), t("Jami")],
      sections.flatMap((s) => s.rows.map((r) => [r.label, ...d.compare.map((c) => r.show(c)), r.total])),
    );
  }

  async function remindAll() {
    const ids = d.alerts.find((a) => a.action === "remind") ? await fetch("/api/cashboxes/daily", { cache: "no-store" }).then((r) => r.json()).catch(() => null) : null;
    const cards = (ids?.cards ?? []) as { cashboxId: number; total: number; pending: unknown }[];
    let sent = 0;
    for (const c of cards.filter((x) => x.total > 0 && !x.pending)) {
      const r = await fetch("/api/cashboxes/daily", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remind", cashboxId: c.cashboxId }) }).then((x) => x.json()).catch(() => null);
      sent += Number(r?.sent) || 0;
    }
    if (sent) showSuccess(t("Eslatma yuborildi"));
    else showError(t("Eslatma ketmadi — kassa egasi xodimlar botiga ulanmagan"));
  }

  const ALERT_ICON: Record<string, { Icon: typeof Bell; tone: string }> = {
    loss: { Icon: TrendingDown, tone: "bg-v2-danger-bg text-v2-danger" },
    staff: { Icon: UserX, tone: "bg-v2-danger-bg text-v2-danger" },
    cash: { Icon: Wallet, tone: "bg-v2-warning-bg text-v2-warning" },
    lead: { Icon: Megaphone, tone: "bg-v2-info-bg text-v2-info" },
  };
  const maxProfit = Math.max(1, ...d.profit.branches.map((b) => Math.abs(b.forecast)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("Rahbar paneli")}</h1>
          <p className="text-v2-small text-v2-text-2">
            {fmt.weekday(d.today)}, {fmt.dayMonth(d.today)} · {t("{t} holatiga", { t: d.now })} · {t("barcha filiallar")} · {t("faqat siz ko'rasiz")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportCsv} className={secondaryBtn}>
            <Download className="size-4" strokeWidth={1.75} aria-hidden />
            Excel
          </button>
          <Link href="/owner-transfers" className={secondaryBtn}>
            <Truck className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Ko'chirmalar")}
            {m.inTransit.length ? ` · ${t("{n} yo'lda", { n: m.inTransit.length })}` : ""}
          </Link>
          <Link href="/owner-approvals" className={primaryBtn}>
            <Inbox className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Tasdiqlar")} · {d.approvals.counts.all}
          </Link>
        </div>
      </div>

      {/* Pul · bugungi tushum · oy tushumi */}
      <section className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border shadow-v2-sm lg:grid-cols-3" style={{ gap: 1 }}>
        <div className="bg-v2-surface p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-v2-small font-semibold text-v2-text">{t("Jami pul · barcha kassalar")}</span>
            <button type="button" onClick={() => setHide((v) => !v)} className="text-v2-text-3 hover:text-v2-text" aria-label={hide ? t("Ko'rsatish") : t("Yashirish")}>
              {hide ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
            </button>
          </div>
          <div className="mt-2 text-[1.75rem] font-semibold leading-9 tabular-nums text-v2-text">
            {money(m.total)} <span className="text-v2-small font-normal text-v2-text-2">so&apos;m</span>
          </div>
          <div className="mt-3">
            <MoneyBar parts={[{ key: "p", value: m.primary, cls: "bg-v2-brand" }, { key: "b", value: m.branchCash, cls: "bg-v2-border-strong" }, { key: "t", value: m.transit, cls: "bg-v2-info" }]} />
          </div>
          <ul className="mt-3 space-y-2 text-v2-small">
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-v2-brand" />
              <Link href="/owner-cash" className="flex-1 text-v2-text-2 hover:text-v2-text">{t("Rahbar kassasi")}</Link>
              <b className="tabular-nums text-v2-text">{money(m.primary)}</b>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-2 rounded-full bg-v2-border-strong" />
              <Link href="/owner-transfers" className="min-w-0 flex-1 text-v2-text-2 hover:text-v2-text">
                {t("Filial kassalarida · {n} ta", { n: m.branchCount })}
                {m.staleNote ? <span className="block text-v2-caption text-v2-text-3">{m.staleNote} {t("topshirilmagan")}</span> : null}
              </Link>
              <b className="tabular-nums text-v2-text">{money(m.branchCash)}</b>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-2 rounded-full bg-v2-info" />
              <Link href="/owner-transfers" className="min-w-0 flex-1 text-v2-text-2 hover:text-v2-text">
                {m.inTransit.length ? t("Yo'lda · {from}", { from: m.inTransit.map((x) => SHORT(x.from)).join(", ") }) : t("Yo'lda")}
                {m.inTransit[0] ? <span className="block text-v2-caption text-v2-text-3">{t("{who} olib kelyapti · {t} dan", { who: m.inTransit[0].owner, t: m.inTransit[0].time })}</span> : null}
              </Link>
              <b className="tabular-nums text-v2-text">{money(m.transit)}</b>
            </li>
          </ul>
        </div>

        <div className="bg-v2-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-v2-small font-semibold text-v2-text">{t("Bugungi tushum · {n} to'lov", { n: d.todayIncome.count })}</span>
            {d.todayIncome.lastTime ? <span className="rounded-v2-sm bg-v2-surface-2 px-1.5 py-0.5 text-v2-caption text-v2-text-2">{t("oxirgisi {t}", { t: d.todayIncome.lastTime })}</span> : null}
          </div>
          <div className="mt-2 text-[1.75rem] font-semibold leading-9 tabular-nums text-v2-text">
            {money(d.todayIncome.total)} <span className="text-v2-small font-normal text-v2-text-2">so&apos;m</span>
          </div>
          <div className="mt-3">
            <MoneyBar parts={Object.entries(d.todayIncome.byMethod).map(([k, v]) => ({ key: k, value: v, cls: methodDot(k) }))} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-v2-small">
            {Object.entries(d.todayIncome.byMethod).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1.5 text-v2-text-2">
                <span className={`size-2 rounded-full ${methodDot(k)}`} />
                {k === "naqd" ? t("Naqd") : k === "plastik" ? t("Plastik") : k === "terminal" ? t("Terminal") : k}
                <b className="tabular-nums text-v2-text">{money(v)}</b>
              </span>
            ))}
            {d.todayIncome.count === 0 ? <span className="text-v2-text-3">{t("Bugun hali to'lov yo'q")}</span> : null}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {d.todayIncome.byBranch.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2 rounded-v2-md border border-v2-border px-2.5 py-1.5 text-v2-small">
                <span className="truncate text-v2-text-2">{SHORT(b.name)}</span>
                <b className="tabular-nums text-v2-text">{money(b.sum)}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-v2-surface p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-v2-small font-semibold text-v2-text">
              {t("{m} tushumi · rejaning {p}%", { m: fmt.monthName(d.month), p: d.revenue?.pct ?? "—" })}
            </span>
            {d.revenue && d.revenue.pct !== null ? (
              d.revenue.pct >= d.monthPct ? (
                <Pill tone="success">
                  <TrendingUp className="size-3" aria-hidden />
                  {t("reja bo'yicha oldinda")}
                </Pill>
              ) : (
                <Pill tone="warning">
                  <TrendingDown className="size-3" aria-hidden />
                  {t("rejadan orqada")}
                </Pill>
              )
            ) : null}
          </div>
          <div className="mt-2 text-[1.75rem] font-semibold leading-9 tabular-nums text-v2-text">
            {money(d.revenue?.received ?? 0)} <span className="text-v2-small font-normal text-v2-text-2">so&apos;m / {money(d.revenue?.plan ?? 0)}</span>
          </div>
          <div className="relative mt-3 h-2 rounded-full bg-v2-track">
            <span className="absolute inset-y-0 left-0 rounded-full bg-v2-brand" style={{ width: `${Math.min(100, d.revenue?.pct ?? 0)}%` }} />
            <span className="absolute -top-1 h-4 w-0.5 bg-v2-text" style={{ left: `${d.monthPct}%` }} aria-hidden />
          </div>
          <p className="mt-2 text-v2-caption text-v2-text-3">{t("Chiziq — oyning o'tgan qismi: {a} / {b} kun · {p}%", { a: d.day, b: d.daysIn, p: d.monthPct })}</p>
          <ul className="mt-2 space-y-1.5 text-v2-small">
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-v2-border-strong" />
              <span className="flex-1 text-v2-text-2">{t("Kutilmoqda · to'lov kuni kelmagan")}</span>
              <b className="tabular-nums text-v2-text">{money(d.revenue?.pending ?? 0)}</b>
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-v2-danger" />
              <Link href="/reports-unpaid" className="flex-1 text-v2-text-2 hover:text-v2-text">{t("Muddati o'tgan · {n} qarzdor", { n: d.revenue?.debtors ?? 0 })}</Link>
              <b className="tabular-nums text-v2-danger">{money(d.revenue?.overdue ?? 0)}</b>
              <ChevronRight className="size-4 text-v2-text-3" aria-hidden />
            </li>
          </ul>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Filiallar taqqoslash */}
          <Card className="!p-0 sm:!p-0">
            <div className="flex flex-wrap items-start justify-between gap-2 p-4 sm:p-5">
              <div>
                <h2 className="text-v2-section text-v2-text">{t("Filiallar taqqoslash")}</h2>
                <p className="text-v2-small text-v2-text-3">{t("{n} filial bir xil ko'rsatkichlar bilan · 1–{d}-{m}", { n: d.compare.length, d: d.day, m: fmt.monthLower(d.month) })}</p>
              </div>
              <button type="button" onClick={exportCsv} className={secondaryBtn}>
                <Download className="size-4" strokeWidth={1.75} aria-hidden />
                Excel
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-v2-small">
                <thead>
                  <tr className="border-y border-v2-border bg-v2-surface-2 text-v2-caption text-v2-text-2">
                    <th className="px-4 py-2 text-left font-medium sm:px-5">{t("Ko'rsatkich")}</th>
                    {d.compare.map((c) => (
                      <th key={c.id} className="px-3 py-2 text-right font-medium">
                        <span className="block font-semibold text-v2-text">{SHORT(c.name)}</span>
                        {t("{g} guruh · {s} xodim", { g: c.groups, s: c.staff })}
                      </th>
                    ))}
                    {many ? <th className="bg-v2-surface-2 px-4 py-2 text-right font-semibold text-v2-text sm:px-5">{t("Jami")}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {sections.map((s) => (
                    <FragmentRows key={s.title} title={s.title} cols={d.compare.length + (many ? 2 : 1)}>
                      {s.rows.map((r) => {
                        const e = ext(r.k, r.dir);
                        return (
                          <tr key={r.label} className="border-t border-v2-border">
                            <td className="px-4 py-2.5 sm:px-5">
                              <span className="text-v2-text">{r.label}</span>
                              {r.sub ? <span className="block text-v2-caption text-v2-text-3">{r.sub}</span> : null}
                            </td>
                            {d.compare.map((c) => (
                              <td key={c.id} className={`px-3 py-2.5 text-right ${r.k === "forecast" && c.forecast < 0 ? "text-v2-danger" : "text-v2-text"}`}>
                                <Mark v={typeof c[r.k] === "number" ? (c[r.k] as number) : null} best={e.best} worst={e.worst}>
                                  {r.show(c)}
                                </Mark>
                              </td>
                            ))}
                            {many ? <td className="bg-v2-surface-2 px-4 py-2.5 text-right font-semibold tabular-nums text-v2-text sm:px-5">{r.total}</td> : null}
                          </tr>
                        );
                      })}
                    </FragmentRows>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-v2-border px-4 py-2.5 text-v2-caption text-v2-text-3 sm:px-5">
              <span className="inline-flex items-center gap-3">
                <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm border border-v2-success" />{t("eng yaxshi")}</span>
                <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm border border-v2-danger" />{t("e'tibor kerak")}</span>
              </span>
              <span>{t("Filial nomi bosilsa — o'sha filialning kunlik bosh sahifasi ochiladi")}</span>
            </div>
          </Card>

          {/* Xodimlar va nazorat · bugun */}
          <Card className="!p-0 sm:!p-0">
            <div className="p-4 sm:p-5">
              <CardTitle
                title={t("Xodimlar va nazorat · bugun")}
                sub={t("Nazoratdagi qoidalar bo'yicha · {t} holati", { t: d.now })}
                right={
                  <Link href="/nazorat-davomat" className="inline-flex items-center gap-1 text-v2-small font-medium text-v2-brand-text">
                    {t("Nazorat")}
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                }
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-v2-small">
                <thead>
                  <tr className="border-y border-v2-border bg-v2-surface-2 text-v2-caption text-v2-text-2">
                    <th className="px-4 py-2 text-left font-medium sm:px-5">{t("Filial")}</th>
                    <th className="px-3 py-2 text-center font-medium">{t("Keldi")}</th>
                    <th className="px-3 py-2 text-center font-medium">{t("Kechikdi")}</th>
                    <th className="px-3 py-2 text-center font-medium">{t("Belgilanmagan dars")}</th>
                    <th className="px-3 py-2 text-center font-medium">{t("Muddati o'tgan topshiriq")}</th>
                    <th className="px-3 py-2 text-center font-medium">{t("Javobsiz lid")}</th>
                    <th className="px-4 py-2 text-right font-medium sm:px-5">{t("Kassa")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.staff.map((s, i) => (
                    <tr key={s.id} className="border-t border-v2-border">
                      <td className="px-4 py-2.5 sm:px-5">
                        <span className="flex items-center gap-2.5">
                          <BranchDot n={i + 1} />
                          <span>
                            <span className="block font-semibold text-v2-text">{SHORT(s.name)}</span>
                            <span className="text-v2-caption text-v2-text-3">{t("{n} xodim", { n: s.staff })}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">
                        {s.absent.length ? <Pill tone="danger">{s.came} / {s.expected}</Pill> : `${s.came} / ${s.expected}`}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{s.late ? <Pill tone="warning">{s.late}</Pill> : 0}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{s.unmarked ? <Pill tone="danger">{s.unmarked}</Pill> : 0}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{s.overdueTasks ? <Pill tone="warning">{s.overdueTasks}</Pill> : 0}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{s.unanswered ? <Pill tone="warning">{s.unanswered}</Pill> : 0}</td>
                      <td className="px-4 py-2.5 text-right sm:px-5">{s.cash ? <Pill tone={s.cash.tone as Tone}>{t(s.cash.text)}</Pill> : "—"}</td>
                    </tr>
                  ))}
                  {many ? (
                    <tr className="border-t border-v2-border bg-v2-surface-2 font-semibold">
                      <td className="px-4 py-2.5 sm:px-5">{t("Jami")}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{d.staff.reduce((a, s) => a + s.came, 0)} / {d.staff.reduce((a, s) => a + s.expected, 0)}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{d.staff.reduce((a, s) => a + s.late, 0)}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{d.staff.reduce((a, s) => a + s.unmarked, 0)}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{d.staff.reduce((a, s) => a + s.overdueTasks, 0)}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{d.staff.reduce((a, s) => a + s.unanswered, 0)}</td>
                      <td />
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {d.staff.some((s) => s.absent.length || s.unmarkedList.length) ? (
              <p className="border-t border-v2-border px-4 py-2.5 text-v2-caption text-v2-text-2 sm:px-5">
                {d.staff
                  .filter((s) => s.absent.length || s.unmarkedList.length)
                  .map((s) => `${SHORT(s.name)}: ${[s.absent.length ? t("{who} kelmadi", { who: s.absent.slice(0, 2).join(", ") }) : "", s.unmarkedList.length ? t("{g} davomati belgilanmagan", { g: s.unmarkedList.join(", ") }) : ""].filter(Boolean).join(" · ")}`)
                  .join(" · ")}
              </p>
            ) : null}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {/* Tasdiq kutmoqda */}
          <Card className="!p-0 sm:!p-0">
            <div className="p-4 sm:p-5">
              <CardTitle
                title={`${t("Tasdiq kutmoqda")} · ${d.approvals.counts.all}`}
                sub={t("barcha filiallardan · eng yangisi tepada")}
                right={
                  <Link href="/owner-approvals" className="inline-flex items-center gap-1 text-v2-small font-medium text-v2-brand-text">
                    {t("Hammasi")}
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                }
              />
            </div>
            {d.approvals.items.length === 0 ? <p className="border-t border-v2-border px-5 py-6 text-center text-v2-small text-v2-success">{t("Tasdiq kutayotgan narsa yo'q.")}</p> : null}
            {d.approvals.items.map((a) => (
              <Link key={a.key} href={`/owner-approvals?open=${a.key}`} className="flex items-center gap-3 border-t border-v2-border px-4 py-3 hover:bg-v2-surface-2 sm:px-5">
                <ApprovalIcon kind={a.kind} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-v2-body font-semibold text-v2-text">{a.title}</span>
                  <span className="block truncate text-v2-caption text-v2-text-3">{a.sub}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <b className="tabular-nums text-v2-text">{a.kind === "narx" && a.percent ? `${a.percent}%` : nf(a.amount)}</b>
                  {a.badge ? <Pill tone={a.badge.tone as Tone}>{t(a.badge.text)}</Pill> : null}
                </span>
              </Link>
            ))}
            <div className="border-t border-v2-border p-3 sm:px-5">
              <Link href="/owner-approvals" className={`${secondaryBtn} w-full justify-center`}>
                <Inbox className="size-4" strokeWidth={1.75} aria-hidden />
                {t("Tasdiqlarni ochish")}
              </Link>
            </div>
          </Card>

          {/* E'tibor talab qiladi */}
          <Card className="!p-0 sm:!p-0">
            <div className="p-4 sm:p-5">
              <CardTitle title={`${t("E'tibor talab qiladi")} · ${d.alerts.length}`} sub={t("Nazorat qoidalari bo'yicha · {t}", { t: d.now })} />
            </div>
            {d.alerts.length === 0 ? <p className="border-t border-v2-border px-5 py-6 text-center text-v2-small text-v2-success">{t("Hammasi joyida.")}</p> : null}
            {d.alerts.map((a, i) => {
              const ic = ALERT_ICON[a.kind] ?? { Icon: AlertTriangle, tone: "bg-v2-warning-bg text-v2-warning" };
              return (
                <div key={i} className="flex items-start gap-3 border-t border-v2-border px-4 py-3 sm:px-5">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-v2-md ${ic.tone}`}>
                    <ic.Icon className="size-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-v2-small font-semibold text-v2-text">{a.title}</span>
                    <span className="block text-v2-caption text-v2-text-3">{a.sub}</span>
                  </span>
                  {a.action === "remind" ? (
                    <button type="button" onClick={remindAll} className={`${secondaryBtn} h-8 shrink-0`}>
                      <Bell className="size-3.5" strokeWidth={1.75} aria-hidden />
                      {t("Eslatish")}
                    </button>
                  ) : (
                    <Link href={a.href} className="inline-flex shrink-0 items-center gap-0.5 text-v2-small font-medium text-v2-brand-text">
                      {a.kind === "loss" ? t("Reja") : a.kind === "lead" ? t("Lidlar") : t("Nazorat")}
                      <ChevronRight className="size-4" aria-hidden />
                    </Link>
                  )}
                </div>
              );
            })}
          </Card>

          {/* Foyda va prognoz */}
          <Card>
            <CardTitle
              title={t("Foyda va prognoz")}
              sub={`${fmt.monthLower(d.month)} · ${t("hisoblangan usulda")}`}
              right={
                <Link href="/finance-revenue-plan" className="inline-flex items-center gap-1 text-v2-small font-medium text-v2-brand-text">
                  {t("Moliyaviy reja")}
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              }
            />
            <div className="mt-3 text-[1.75rem] font-semibold leading-9 tabular-nums text-v2-text">
              {money(d.profit.forecast)} <span className="text-v2-small font-normal text-v2-text-2">so&apos;m</span>
            </div>
            <p className="mt-1 text-v2-caption text-v2-text-3">{t("Oy oxiriga prognoz · hozircha {n}", { n: money(d.profit.total) })}</p>
            {d.profit.planIncome !== null ? (
              <p className="mt-1 text-v2-caption text-v2-text-3">{t("Daromad rejasi {a} − xarajat rejasi {b}", { a: money(d.profit.planIncome), b: money(d.profit.planExpense ?? 0) })}</p>
            ) : null}
            <ul className="mt-3 space-y-2.5">
              {d.profit.branches.map((b) => (
                <li key={b.id} className="flex items-center gap-3 text-v2-small">
                  <span className="w-24 shrink-0 truncate text-v2-text">{SHORT(b.name)}</span>
                  <span className="relative h-2 flex-1 rounded-full bg-v2-track">
                    <span className={`absolute inset-y-0 left-0 rounded-full ${b.forecast < 0 ? "bg-v2-danger" : "bg-v2-brand"}`} style={{ width: `${Math.max(3, (Math.abs(b.forecast) / maxProfit) * 100)}%` }} />
                  </span>
                  <span className="w-24 shrink-0 text-right">
                    <b className={`block tabular-nums ${b.forecast < 0 ? "text-v2-danger" : "text-v2-text"}`}>{money(b.forecast)}</b>
                    <span className="text-v2-caption text-v2-text-3">{b.forecast < 0 ? t("zarar") : b.pct !== null ? `${b.pct}%` : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-v2-md border border-v2-border p-3">
                <div className="text-v2-caption text-v2-text-3">{t("Kassa · oy oxiri prognozi")}</div>
                <div className="mt-1 text-v2-body font-semibold tabular-nums text-v2-text">{money(d.profit.cashForecast)}</div>
                <div className="text-v2-caption text-v2-text-3">+{money(d.profit.cashForecastPlus)} · {t("kutilmoqda")}</div>
              </div>
              <div className="rounded-v2-md border border-v2-border p-3">
                <div className="text-v2-caption text-v2-text-3">{t("Oylik fondi · {m}", { m: fmt.monthLower(d.month) })}</div>
                <div className="mt-1 text-v2-body font-semibold tabular-nums text-v2-text">{money(d.profit.salary.avans + d.profit.salary.oylik)}</div>
                <div className="text-v2-caption text-v2-text-3">{t("avans berildi {n}", { n: money(d.profit.salary.avans) })}</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FragmentRows({ title, cols, children }: { title: string; cols: number; children: React.ReactNode }) {
  return (
    <>
      <tr className="border-t border-v2-border">
        <td colSpan={cols} className="bg-v2-surface px-4 pb-1 pt-3 text-v2-caption font-semibold text-v2-text-2 sm:px-5">
          {title}
        </td>
      </tr>
      {children}
    </>
  );
}
