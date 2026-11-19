"use client";

import { useState } from "react";
import { ArrowUp, HandCoins, CalendarCheck, Check, ChevronRight, Clock, Eye, Info, Loader2, LogOut, Megaphone, PlusCircle, Target, UserRound, Wallet, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import AdvanceRequestDialog from "@/components/v2/owner/AdvanceRequestDialog";
import { useToast } from "@/components/ui/Toast";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { useCreate } from "@/components/v2/shell/CreateContext";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { Card, CardTitle, fmtSum } from "@/components/v2/teacher/teacherBits";
import { KindIcon, Kpi, deskQs, giftDecision, taskAction, type ApprovalItem } from "./deskBits";

// YANGI VERSIYA — MENEJER · BOSH SAHIFA (47-qism, rasmlar «Menejer · bosh sahifa» kompyuter / telefon). 4 ko'rsatkich
// (tushum, yangi o'quvchi rejasi, davomat, qarzdor), «Tasdiq kutmoqda» (topshiriq, sovg'a so'rovi, rahbarda — ko'rish),
// «Xodimlar · bugun» (Keldim, kechikdi, ketdi), o'ngda Savdo plani, Kassalar, «E'tibor talab qiladi»; «Rolingiz».
// Server — /api/staff-desk?view=manager (lib/staffDesk.ts). Tasdiqlash — mavjud /api/staff-tasks/:id va referal qarori.

interface Data {
  ok: true;
  today: string;
  now: string;
  who: { name: string; preview: boolean };
  branch: string;
  kpi: { revenue: number; payments: number; newDone: number; newTarget: number; attendancePct: number | null; activePupils: number; debtors: number; debt: number; monthPct: number };
  approvals: { items: ApprovalItem[]; counts: { all: number; topshiriq: number; sovga: number; rahbarda: number } };
  staff: { rows: { employeeId: number; name: string; role: string; expected: string | null; why: string | null; enter: string | null; exit: string | null; late: number; state: string }[]; came: number; late: number; left: number };
  plan: null | { total: { target: number; done: number; leads: number; convPct: number | null; forecast: number; expected: number }; rows: { admin: string; target: number; done: number; leads: number; convPct: number | null; forecast: number; behind: boolean; me: boolean }[]; day: number; days: number };
  funnel: { leads: number; booked: number; came: number; paid: number };
  cash: { id: number; name: string; owner: string; balance: number; mine: boolean; days: number | null; methods: string[] }[];
  alerts: { kind: string; title: string; sub: string; href: string }[];
}

export default function ManagerHomeV2({ as }: { as?: string }) {
  const { t } = useT();
  const [advance, setAdvance] = useState(false);
  const fmt = useProfileFmt();
  const { open } = useCreate();
  const { showError, showSuccess } = useToast();
  const { data: d, error, reload } = useReportData<Data>(`/api/staff-desk?view=manager${deskQs(as, "manager")}`);
  const [busy, setBusy] = useState<string | null>(null);
  if (error)
    return (
      <div data-ui="v2" className="p-4">
        <NoticeBar>{t("Ma'lumot yuklanmadi")}</NoticeBar>
      </div>
    );
  if (!d)
    return (
      <div data-ui="v2" className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const approvalsHref = `/approvals${as ? `?as=${encodeURIComponent(as)}` : ""}`;
  const approve = async (a: ApprovalItem) => {
    setBusy(a.key);
    const r = a.kind === "topshiriq" ? await taskAction(a.id, { action: "approve" }) : await giftDecision(a.id, true, "", as);
    setBusy(null);
    if (!r.ok) return showError(r.error ?? t("Saqlanmadi"));
    showSuccess(t("Tasdiqlandi"));
    reload();
  };
  const planPct = d.kpi.newTarget ? Math.round((d.kpi.newDone / d.kpi.newTarget) * 100) : 0;
  const behind = d.kpi.newTarget > 0 && planPct < d.kpi.monthPct;
  const present = d.staff.rows.filter((r) => r.enter && !r.exit);
  const lateRows = d.staff.rows.filter((r) => r.state === "late");
  const leftRows = d.staff.rows.filter((r) => r.exit);
  const stateBadge = (r: Data["staff"]["rows"][number]) =>
    r.state === "late" ? (
      <span className="rounded-v2-sm bg-v2-warning-bg px-2 py-0.5 text-v2-caption text-v2-warning">{t("Kechikdi · {n} daq", { n: r.late })}</span>
    ) : r.state === "absent" ? (
      <span className="rounded-v2-sm bg-v2-danger-bg px-2 py-0.5 text-v2-caption text-v2-danger">{t("Kelmadi")}</span>
    ) : r.state === "waiting" ? (
      <span className="rounded-v2-sm bg-v2-surface-2 px-2 py-0.5 text-v2-caption text-v2-text-2">{t("Vaqti kelmagan")}</span>
    ) : (
      <span className="rounded-v2-sm bg-v2-success-bg px-2 py-0.5 text-v2-caption text-v2-success">{t("Vaqtida")}</span>
    );

  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-bg p-4 font-v2 text-v2-text sm:p-6">
      {d.who.preview ? <NoticeBar icon={Eye}>{t("Rahbar ko'rinishi: {name} bosh sahifasi", { name: d.who.name })}</NoticeBar> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("Bosh sahifa")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">{[`${cap(fmt.weekday(d.today))}, ${fmt.dayMonth(d.today)}`, t("{time} holatiga", { time: d.now }), d.branch].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/tasks" className={secondaryBtn}>
            <PlusCircle className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Topshiriq berish")}
          </Link>
          <button type="button" onClick={() => setAdvance(true)} className={secondaryBtn}>
            <HandCoins className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Avans so'rovi")}
          </button>
          <button type="button" onClick={() => open("payment")} className={primaryBtn}>
            <Wallet className="size-4" strokeWidth={1.75} aria-hidden />
            {t("To'lov qabul qilish")}
          </button>
        </div>
      </div>
      {advance ? <AdvanceRequestDialog onClose={() => setAdvance(false)} /> : null}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border xl:grid-cols-4">
        <Kpi icon={<Wallet className="size-5" strokeWidth={1.75} />} tone="bg-v2-success-bg text-v2-success" value={fmtSum(d.kpi.revenue)} unit={t("so'm")} label={t("Tushum · {m} · {n} ta to'lov", { m: fmt.monthLower(d.today.slice(0, 7)), n: d.kpi.payments })} />
        <Kpi icon={<Target className="size-5" strokeWidth={1.75} />} tone="bg-v2-danger-bg text-v2-danger" value={`${d.kpi.newDone} / ${d.kpi.newTarget}`} danger={behind} label={behind ? t("Yangi o'quvchi · reja orqada") : t("Yangi o'quvchi · rejada")} />
        <Kpi icon={<CalendarCheck className="size-5" strokeWidth={1.75} />} tone="bg-v2-info-bg text-v2-info" value={d.kpi.attendancePct !== null ? `${d.kpi.attendancePct}%` : "—"} label={t("Davomat · {n} o'quvchi", { n: d.kpi.activePupils })} />
        <Kpi icon={<Wallet className="size-5" strokeWidth={1.75} />} tone="bg-v2-warning-bg text-v2-warning" value={String(d.kpi.debtors)} label={t("Qarzdor · {sum} so'm", { sum: fmtSum(d.kpi.debt) })} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="!p-0 sm:!p-0">
            <div className="p-4 sm:p-5">
              <CardTitle
                title={t("Tasdiq kutmoqda · {n}", { n: d.approvals.counts.all })}
                sub={t("eng yangisi tepada · siz tasdiqlaysiz")}
                right={
                  <Link href={approvalsHref} className="inline-flex items-center gap-1 text-v2-small font-medium text-v2-brand-text">
                    {t("Hammasi")}
                    <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                  </Link>
                }
              />
            </div>
            {d.approvals.items.length === 0 ? <p className="border-t border-v2-border px-5 py-4 text-v2-small text-v2-success">{t("Tasdiq kutayotgan narsa yo'q.")}</p> : null}
            {(["topshiriq", "sovga", "rahbarda"] as const).map((kind) => {
              const list = d.approvals.items.filter((a) => a.kind === kind);
              if (!list.length) return null;
              return (
                <div key={kind}>
                  <div className="border-t border-v2-border bg-v2-surface-2 px-4 py-2 text-v2-caption font-semibold text-v2-text-2 sm:px-5">
                    {kind === "topshiriq" ? t("Topshiriqlar · {n}", { n: list.length }) : kind === "sovga" ? t("Sovg'a so'rovi · {n}", { n: list.length }) : t("Rahbarda · siz faqat ko'rasiz")}
                  </div>
                  {list.map((a) => (
                    <div key={a.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-v2-border px-4 py-3 sm:flex-nowrap sm:px-5">
                      <KindIcon kind={a.kind} />
                      <div className="min-w-0 flex-1 basis-[calc(100%-3rem)] sm:basis-auto">
                        <div className="text-v2-body font-semibold text-v2-text">{a.title}</div>
                        <div className="text-v2-caption text-v2-text-3">{a.sub}</div>
                        {a.kind === "topshiriq" && a.detail.doneNote ? <div className="text-v2-caption text-v2-text-2">«{String(a.detail.doneNote)}»</div> : null}
                      </div>
                      <div className="flex w-full justify-end gap-2 pl-12 sm:w-auto sm:pl-0">
                        {a.kind === "rahbarda" ? (
                          <span className="inline-flex items-center gap-1 rounded-v2-sm bg-v2-surface-2 px-2 py-0.5 text-v2-caption text-v2-text-2">{t("Direktorda")}</span>
                        ) : (
                          <>
                            <Link href={`${approvalsHref}${as ? "&" : "?"}open=${a.key}`} className={secondaryBtn}>
                              {a.kind === "topshiriq" ? t("Qaytarish") : t("Rad etish")}
                            </Link>
                            <button type="button" disabled={busy !== null} onClick={() => void approve(a)} className={primaryBtn}>
                              {busy === a.key ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
                              {t("Tasdiqlash")}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </Card>

          <Card className="!p-0 sm:!p-0">
            <div className="p-4 sm:p-5">
              <CardTitle
                title={t("Xodimlar · bugun")}
                sub={t("{a} kishi keldi, {b} tasi kechikdi · hozir filialda {c} kishi", { a: d.staff.came, b: d.staff.late, c: present.length })}
                right={
                  <Link href="/nazorat-turnstile" className="inline-flex items-center gap-1 text-v2-small font-medium text-v2-brand-text">
                    {t("Xodimlar davomati")}
                    <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                  </Link>
                }
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-left text-v2-small">
                <thead>
                  <tr className="border-y border-v2-border bg-v2-surface-2 text-v2-caption text-v2-text-3">
                    <th className="px-5 py-2 font-medium">{t("Hozir filialda · {n}", { n: present.length })}</th>
                    <th className="px-3 py-2 font-medium">{t("Ish vaqti")}</th>
                    <th className="px-3 py-2 font-medium">{t("Keldi")}</th>
                    <th className="px-3 py-2 font-medium">{t("Holat")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.staff.rows
                    .filter((r) => !r.exit)
                    .slice(0, 8)
                    .map((r) => (
                      <tr key={r.employeeId} className="border-b border-v2-border">
                        <td className="px-5 py-2.5">
                          <span className="flex items-center gap-3">
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2">{initialsOf(r.name)}</span>
                            <span>
                              <span className="block font-semibold text-v2-text">{r.name}</span>
                              <span className="block text-v2-caption text-v2-text-3">{[r.role, r.why].filter(Boolean).join(" · ")}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-v2-text-2">{r.expected ?? "—"}</td>
                        <td className="px-3 py-2.5 font-semibold tabular-nums">{r.enter ?? "—"}</td>
                        <td className="px-3 py-2.5">{stateBadge(r)}</td>
                      </tr>
                    ))}
                  {d.staff.rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-4 text-v2-text-3">
                        {t("Bugun xodimlar davomati yozilmagan.")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {lateRows.length ? (
              <div className="flex gap-3 border-b border-v2-border px-5 py-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-v2-warning" strokeWidth={1.75} aria-hidden />
                <div className="text-v2-small">
                  <b className="font-semibold">{t("Kechikdi · {n}", { n: lateRows.length })}</b>
                  <div className="text-v2-caption text-v2-text-2">{lateRows.map((r) => `${r.name} — ${r.late} ${t("daq")}`).join(" · ")}</div>
                </div>
              </div>
            ) : null}
            {leftRows.length ? (
              <div className="flex gap-3 px-5 py-3">
                <LogOut className="mt-0.5 size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                <div className="text-v2-small">
                  <b className="font-semibold">{t("Ketdi · {n}", { n: leftRows.length })}</b>
                  <div className="text-v2-caption text-v2-text-2">{leftRows.map((r) => `${r.name} ${r.exit}`).join(" · ")}</div>
                </div>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardTitle title={t("Rolingiz: Menejer")} sub={[d.branch, t("faqat o'z filialingiz · huquqlarni rahbar belgilaydi")].filter(Boolean).join(" · ")} />
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                [t("Boshqarasiz"), [t("Lidlar, o'quvchilar, guruhlar"), t("Kassa, to'lovlar, tanga"), t("Nazorat va topshiriqlar")], "ok"],
                [t("Faqat ko'rasiz"), [t("Oyliklar va hisobotlar"), t("Xodimlar, rollar, sozlamalar"), t("Amallar jurnali")], "eye"],
                [t("Ko'rinmaydi"), [t("Boshqa filiallar"), t("Rahbar kassasi"), t("Oylik chiqarish")], "no"],
              ].map(([title, list, kind]) => (
                <div key={title as string}>
                  <div className="mb-1.5 text-v2-caption font-semibold text-v2-text-2">{title as string}</div>
                  {(list as string[]).map((x) => (
                    <div key={x} className={`flex items-center gap-2 py-1 text-v2-small ${kind === "no" ? "text-v2-text-2" : "text-v2-text"}`}>
                      {kind === "ok" ? <Check className="size-4 text-v2-success" strokeWidth={2} aria-hidden /> : kind === "eye" ? <Eye className="size-4 text-v2-info" strokeWidth={1.75} aria-hidden /> : <X className="size-4 text-v2-text-3" strokeWidth={2} aria-hidden />}
                      {x}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {d.plan ? (
            <Card>
              <CardTitle
                title={t("Savdo plani · {m}", { m: fmt.monthLower(d.today.slice(0, 7)) })}
                sub={[d.branch, t("{n} kishiga reja", { n: d.plan.rows.length })].filter(Boolean).join(" · ")}
                right={
                  <Link href="/sales-plan" className="inline-flex items-center gap-1 text-v2-small font-medium text-v2-brand-text">
                    {t("Ochish")}
                    <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                  </Link>
                }
              />
              <div className="flex items-baseline justify-between gap-2">
                <span>
                  <b className="text-[1.75rem] font-semibold tabular-nums">{d.plan.total.done}</b>
                  <span className="text-v2-text-2"> / {t("{n} yangi o'quvchi", { n: d.plan.total.target })}</span>
                </span>
                <span className={`rounded-v2-sm px-2 py-0.5 text-v2-caption ${behind ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-success-bg text-v2-success"}`}>{behind ? t("Orqada") : t("Rejada")}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-v2-track">
                <div className={`h-full rounded-full ${behind ? "bg-v2-danger" : "bg-v2-success"}`} style={{ width: `${Math.min(100, planPct)}%` }} />
              </div>
              <p className="mt-2 text-v2-caption text-v2-text-2">{t("Oyning {p}% i o'tdi · kutilgan {e} · prognoz {f}", { p: d.kpi.monthPct, e: d.plan.total.expected, f: d.plan.total.forecast })}</p>
              <ul className="mt-3 divide-y divide-v2-border">
                {d.plan.rows.map((r) => (
                  <li key={r.admin} className="flex items-center gap-3 py-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2">{initialsOf(r.admin)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-v2-small font-semibold text-v2-text">{r.me ? t("Siz · {n}", { n: r.admin }) : r.admin}</div>
                      <div className="text-v2-caption text-v2-text-3">{t("{l} lid · konversiya {c} · prognoz {f}", { l: r.leads, c: r.convPct !== null ? `${r.convPct}%` : "—", f: r.forecast })}</div>
                    </div>
                    <div className="w-16 shrink-0 text-right">
                      <div className="text-v2-small font-semibold tabular-nums">
                        {r.done} <span className="font-normal text-v2-text-3">/ {r.target}</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-v2-track">
                        <div className={`h-full rounded-full ${r.behind ? "bg-v2-danger" : "bg-v2-success"}`} style={{ width: `${r.target ? Math.min(100, (r.done / r.target) * 100) : 0}%` }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-v2-caption font-semibold text-v2-text-2">{t("Liddan o'quvchigacha · {m}", { m: fmt.monthLower(d.today.slice(0, 7)) })}</div>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {(
                  [
                    [d.funnel.leads, t("lid")],
                    [d.funnel.booked, t("yozildi")],
                    [d.funnel.came, t("keldi")],
                    [d.funnel.paid, t("to'ladi")],
                  ] as const
                ).map(([n, l], i) => (
                  <div key={l} className={`rounded-v2-md px-2 py-2 text-center ${i === 3 ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-surface-2"}`}>
                    <div className="text-v2-section font-semibold tabular-nums">{n}</div>
                    <div className="text-v2-caption text-v2-text-2">{l}</div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {d.cash.length ? (
            <Card>
              <CardTitle title={t("Kassalar · bugun topshiriladi")} sub={t("kun — oxirgi topshiruvdan beri")} />
              <ul className="divide-y divide-v2-border">
                {d.cash.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-v2-md bg-v2-warning-bg text-v2-warning">
                      <Wallet className="size-4" strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-v2-small font-semibold text-v2-text">{c.mine ? t("Sizning kassangiz") : c.name}</div>
                      <div className="truncate text-v2-caption text-v2-text-3">{[c.owner, c.methods.join(", ")].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-v2-small font-semibold tabular-nums">{fmtSum(c.balance)}</div>
                      <div className="text-v2-caption text-v2-warning">{c.days === null ? t("topshirilmagan") : t("{n} kun", { n: c.days })}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <Link href="/finance-handover" className={`${primaryBtn} mt-3 w-full justify-center`}>
                <ArrowUp className="size-4" strokeWidth={1.75} aria-hidden />
                {t("Kassalarni topshirish")}
              </Link>
            </Card>
          ) : null}

          <Card>
            <CardTitle title={t("E'tibor talab qiladi · {n}", { n: d.alerts.length })} sub={t("Nazorat qoidalari bo'yicha · {time}", { time: d.now })} />
            {d.alerts.length === 0 ? (
              <p className="text-v2-small text-v2-success">{t("Hammasi joyida.")}</p>
            ) : (
              <ul className="divide-y divide-v2-border">
                {d.alerts.map((a) => (
                  <li key={a.title}>
                    <Link href={a.href} className="flex items-center gap-3 py-2.5">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-v2-md ${a.kind === "lead" ? "bg-v2-danger-bg text-v2-danger" : a.kind === "debt" ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-info-bg text-v2-info"}`}>
                        {a.kind === "lead" ? <Megaphone className="size-4" strokeWidth={1.75} aria-hidden /> : a.kind === "debt" ? <Wallet className="size-4" strokeWidth={1.75} aria-hidden /> : <UserRound className="size-4" strokeWidth={1.75} aria-hidden />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-v2-small font-semibold text-v2-text">{t(a.title)}</span>
                        <span className="block truncate text-v2-caption text-v2-text-3">{a.sub}</span>
                      </span>
                      <ChevronRight className="size-4 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 flex items-start gap-2 text-v2-caption text-v2-text-3">
              <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
              {t("Qoidalar — Sozlamalar → Nazorat qoidalari (siz faqat ko'rasiz).")}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
