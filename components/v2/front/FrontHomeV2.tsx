"use client";

import { useState } from "react";
import { ArrowUp, HandCoins, Bell, CalendarDays, Check, ChevronRight, Clock, Eye, Loader2, Megaphone, MessageSquare, MinusCircle, Phone, PlusCircle, Wallet, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import AdvanceRequestDialog from "@/components/v2/owner/AdvanceRequestDialog";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { useCreate } from "@/components/v2/shell/CreateContext";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { Card, CardTitle, fmtSum } from "@/components/v2/teacher/teacherBits";

// YANGI VERSIYA — QABUL ADMIN · BOSH SAHIFA (46-qism, rasmlar «Qabul admin · bosh sahifa» kompyuter / telefon).
// 4 ko'rsatkich (javobsiz lid, birinchi dars, qarzdor, kassam), «Bugungi ishlar» — javobsiz lidlar (kutish vaqti),
// birinchi darsga keladiganlar (bugun / ertaga / indinga), 2+ oy qarzdorlar, kassani topshirish; «Rolingiz».
// O'ngda Kassam (balans, to'lov turlari, bugungi amallar, Kirim / Chiqim / Topshirish) va Savdo planim.
// «To'lov qabul qilish» va kassa amali — mavjud oynalar (+ Yangi menyusidagi), lid — lid sahifasi.
// Server — /api/front?view=admin (lib/frontDesk.ts).

interface Data {
  ok: true;
  today: string;
  now: string;
  who: { name: string; preview: boolean };
  branch: string;
  unanswered: { id: number; name: string; course: string; source: string; refName: string; created: { date: string; time: string } | null; waitMin: number }[];
  unansweredTotal: number;
  firstLessons: { id: number; name: string; date: string; time: string; group: string; teacher: string; room: string; refName: string; reminded: boolean }[];
  debtors: { count: number; total: number; old: { id: number; name: string; debt: number; months: number; group: string }[]; oldCount: number };
  cash: null | {
    id: number;
    name: string;
    balance: number;
    byMethod: { key: string; name: string; sum: number }[];
    lastHandover: { date: string; time: string } | null;
    daysSince: number | null;
    since: number;
    today: { id: number; who: string; label: string; method: string; time: string; amount: number }[];
  };
  bonus: null | { month: string; done: number; target: number; bonus: number; forecast: number; kpi: { leads: number; convPct: number | null } | null; perStudent: number; planBonus: number };
  staffTasks: { id: number; title: string; deadline: string }[];
}

export function fmtWait(t: (k: string, v?: Record<string, string | number>) => string, min: number) {
  if (min < 60) return t("{n} daq", { n: min });
  const h = Math.floor(min / 60);
  if (h < 48) return min % 60 ? t("{h} soat {m} daq", { h, m: min % 60 }) : t("{h} soat", { h });
  return t("{n} kun", { n: Math.floor(h / 24) });
}

export default function FrontHomeV2({ as }: { as?: string }) {
  const { t } = useT();
  const [advance, setAdvance] = useState(false);
  const fmt = useProfileFmt();
  const { open } = useCreate();
  const { data: d, error } = useReportData<Data>(`/api/front?view=admin${as ? `&as=${encodeURIComponent(as)}&mode=admin` : ""}`);
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
  const tomorrow = new Date(Date.parse(`${d.today}T00:00:00Z`) + 86400_000).toISOString().slice(0, 10);
  const dayLabel = (iso: string) => (iso === d.today ? t("Bugun") : iso === tomorrow ? t("Ertaga") : fmt.dayMonth(iso));
  const flToday = d.firstLessons.filter((x) => x.date === d.today).length;
  const worksN = d.unanswered.length + d.firstLessons.length + (d.debtors.oldCount ? 1 : 0) + (d.cash && (d.cash.daysSince ?? 0) >= 1 ? 1 : 0);
  const pct = d.bonus && d.bonus.target ? Math.min(100, Math.round((d.bonus.done / d.bonus.target) * 100)) : 0;
  const [y, m] = d.today.split("-").map(Number);
  const monthPct = Math.round((Number(d.today.slice(8, 10)) / new Date(y, m, 0).getDate()) * 100);

  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-bg p-4 font-v2 text-v2-text sm:p-6">
      {d.who.preview ? <NoticeBar icon={Eye}>{t("Rahbar ko'rinishi: {name} bosh sahifasi", { name: d.who.name })}</NoticeBar> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("Bosh sahifa")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">{[`${cap(fmt.weekday(d.today))}, ${fmt.dayMonth(d.today)}`, t("{time} holatiga", { time: d.now }), d.branch].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/orders-list/add" className={secondaryBtn}>
            <PlusCircle className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Yangi lid")}
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
        <Kpi tone="danger" icon={<Megaphone className="size-5" strokeWidth={1.75} />} value={String(d.unansweredTotal)} label={d.unanswered[0] ? t("Javobsiz lid · biri {w}dan oshdi", { w: fmtWait(t, d.unanswered[0].waitMin) }) : t("Javobsiz lid")} />
        <Kpi tone="info" icon={<CalendarDays className="size-5" strokeWidth={1.75} />} value={String(d.firstLessons.length)} label={t("Birinchi dars · bugun {n}, 3 kunda", { n: flToday })} />
        <Kpi tone="warning" icon={<Wallet className="size-5" strokeWidth={1.75} />} value={String(d.debtors.count)} label={t("Qarzdor · {sum} so'm", { sum: fmtSum(d.debtors.total) })} />
        <Kpi tone="neutral" icon={<Wallet className="size-5" strokeWidth={1.75} />} value={d.cash ? fmtSum(d.cash.balance) : "—"} unit={d.cash ? t("so'm") : ""} label={d.cash ? (d.cash.daysSince ? t("Kassam · {n} kun topshirilmagan", { n: d.cash.daysSince }) : t("Kassam")) : t("Kassa biriktirilmagan")} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="!p-0 sm:!p-0">
            <div className="p-4 sm:p-5">
              <CardTitle title={t("Bugungi ishlar")} sub={t("{n} ta · eng shoshilinchi tepada · Lidlar, Birinchi dars, Qarzdorlar va Kassadan", { n: worksN })} />
            </div>
            <Section title={t("Javobsiz lidlar · {n}", { n: d.unansweredTotal })} right={t("birinchi javob ≤ 15 daqiqa")} />
            {d.unanswered.length === 0 ? <Empty>{t("Javobsiz lid yo'q.")}</Empty> : null}
            {d.unanswered.map((l) => (
              <Row
                key={l.id}
                icon={<Megaphone className="size-4" strokeWidth={1.75} aria-hidden />}
                tone={l.waitMin > 60 ? "warning" : "danger"}
                title={l.name}
                sub={[t("Yangi lid"), l.course, l.source, l.created ? `${l.created.date === d.today ? t("bugun") : fmt.dayMonth(l.created.date)} ${l.created.time}` : null, l.refName ? t("taklif qilgan: {n}", { n: l.refName }) : null].filter(Boolean).join(" · ")}
                badge={
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-v2-sm px-2 py-0.5 text-v2-caption font-medium ${l.waitMin > 15 ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-warning-bg text-v2-warning"}`}>
                    <Clock className="size-3.5" strokeWidth={1.75} aria-hidden />
                    {fmtWait(t, l.waitMin)}
                  </span>
                }
                actions={
                  <>
                    <Link href={`/orders-list/${l.id}`} className={secondaryBtn}>
                      <Phone className="size-4" strokeWidth={1.75} aria-hidden />
                      {t("Qo'ng'iroq")}
                    </Link>
                    <Link href={`/orders-list/${l.id}`} className={`${secondaryBtn} max-sm:hidden`}>
                      {t("Birinchi darsga yozish")}
                    </Link>
                  </>
                }
              />
            ))}

            <Section title={t("Birinchi darsga keladiganlar · {n}", { n: d.firstLessons.length })} />
            {d.firstLessons.length === 0 ? <Empty>{t("3 kun ichida birinchi dars yo'q.")}</Empty> : null}
            {d.firstLessons.map((x) => (
              <Row
                key={x.id}
                icon={<CalendarDays className="size-4" strokeWidth={1.75} aria-hidden />}
                tone="info"
                title={`${x.name} — ${dayLabel(x.date).toLowerCase()} ${x.time}`}
                sub={[x.group, x.teacher, x.room ? `${x.room}-xona` : null, x.refName ? t("taklif: {n}", { n: x.refName }) : null].filter(Boolean).join(" · ")}
                badge={<span className="shrink-0 rounded-v2-sm bg-v2-info-bg px-2 py-0.5 text-v2-caption text-v2-info">{dayLabel(x.date)}</span>}
                actions={
                  x.reminded ? (
                    <span className="inline-flex items-center gap-1 text-v2-small text-v2-success">
                      <Check className="size-4" strokeWidth={2} aria-hidden />
                      {t("Eslatildi")}
                    </span>
                  ) : (
                    <Link href={`/orders-list/${x.id}`} className={secondaryBtn}>
                      <Bell className="size-4" strokeWidth={1.75} aria-hidden />
                      {t("Eslatish")}
                    </Link>
                  )
                }
              />
            ))}

            <Section
              title={t("Qarzdorlar · {n} ta, {sum} so'm", { n: d.debtors.count, sum: fmtSum(d.debtors.total) })}
              right={
                <Link href="/reports-unpaid" className="inline-flex items-center gap-1 font-medium text-v2-brand-text">
                  {t("Hammasi")}
                  <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                </Link>
              }
            />
            {d.debtors.oldCount ? (
              <Row
                icon={<Wallet className="size-4" strokeWidth={1.75} aria-hidden />}
                tone="danger"
                title={t("2 oy va undan ko'p: {n} kishi", { n: d.debtors.oldCount })}
                sub={d.debtors.old.map((r) => `${r.name} — ${fmtSum(r.debt)} (${t("{n} oy", { n: r.months })})`).join(" · ")}
                actions={
                  <Link href="/reports-unpaid" className={secondaryBtn}>
                    <MessageSquare className="size-4" strokeWidth={1.75} aria-hidden />
                    {t("Ota-onaga eslatma")}
                  </Link>
                }
              />
            ) : (
              <Empty>{t("2 oydan ortiq qarzdor yo'q.")}</Empty>
            )}

            {d.cash ? (
              <>
                <Section title={t("Kassa")} />
                <Row
                  icon={<Wallet className="size-4" strokeWidth={1.75} aria-hidden />}
                  tone="warning"
                  title={d.cash.daysSince ? t("Kassani topshirish — {n} kun", { n: d.cash.daysSince }) : t("Kassani topshirish")}
                  sub={[`${fmtSum(d.cash.balance)} ${t("so'm")}`, ...d.cash.byMethod.map((x) => `${x.name.toLowerCase()} ${fmtSum(x.sum)}`), d.cash.lastHandover ? t("oxirgi topshiruv {d}", { d: `${fmt.dayMonth(d.cash.lastHandover.date)} ${d.cash.lastHandover.time}` }) : t("hali topshirilmagan")].join(" · ")}
                  actions={
                    <Link href="/finance-handover" className={secondaryBtn}>
                      <ArrowUp className="size-4" strokeWidth={1.75} aria-hidden />
                      {t("Topshirish")}
                    </Link>
                  }
                />
              </>
            ) : null}
          </Card>

          <Card>
            <CardTitle title={t("Rolingiz: Qabul admin")} sub={[d.branch, t("huquqlarni rahbar belgilaydi")].filter(Boolean).join(" · ")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-v2-caption font-semibold text-v2-text-2">{t("Ko'rasiz")}</div>
                {[t("Lidlar, o'quvchilar, to'lovlar"), t("O'z kassangiz: kirim, chiqim, topshiruv"), t("Hisobotlar va nazorat — ko'rish")].map((x) => (
                  <div key={x} className="flex items-center gap-2 py-1 text-v2-small text-v2-text">
                    <Check className="size-4 text-v2-success" strokeWidth={2} aria-hidden />
                    {x}
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-1.5 text-v2-caption font-semibold text-v2-text-2">{t("Ko'rinmaydi")}</div>
                {[t("Rahbar kassasi va boshqa filiallar"), t("Xodimlar oyligi (faqat o'zingizniki)"), t("Sozlamalar va Boshqaruv")].map((x) => (
                  <div key={x} className="flex items-center gap-2 py-1 text-v2-small text-v2-text-2">
                    <X className="size-4 text-v2-text-3" strokeWidth={2} aria-hidden />
                    {x}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {d.cash ? (
            <Card>
              <CardTitle
                title={t("Kassam")}
                sub={t("{name} kassasi · faqat siz", { name: d.cash.name })}
                right={
                  <Link href="/finance-cash" className="inline-flex items-center gap-1 text-v2-small font-medium text-v2-brand-text">
                    {t("Tarix")}
                    <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                  </Link>
                }
              />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[1.75rem] font-semibold tabular-nums text-v2-text">
                  {fmtSum(d.cash.balance)} <span className="text-v2-small font-normal text-v2-text-2">{t("so'm")}</span>
                </span>
                {d.cash.daysSince ? <span className="rounded-v2-sm bg-v2-warning-bg px-2 py-0.5 text-v2-caption text-v2-warning">{t("{n} kun topshirilmagan", { n: d.cash.daysSince })}</span> : null}
              </div>
              {d.cash.lastHandover ? <p className="text-v2-caption text-v2-text-3">{t("Oxirgi topshiruvdan beri tushum {sum} so'm · topshiruv {d}", { sum: fmtSum(d.cash.since), d: `${fmt.dayMonth(d.cash.lastHandover.date)} ${d.cash.lastHandover.time}` })}</p> : null}
              {d.cash.byMethod.length ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {d.cash.byMethod.slice(0, 4).map((x) => (
                    <div key={x.key} className="rounded-v2-md border border-v2-border px-3 py-2">
                      <div className="text-v2-caption text-v2-text-3">{x.name}</div>
                      <div className="text-v2-section font-semibold tabular-nums text-v2-text">{fmtSum(x.sum)}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 text-v2-caption text-v2-text-2">{t("Bugun · {n} amal", { n: d.cash.today.length })}</div>
              <ul className="mt-1 divide-y divide-v2-border">
                {d.cash.today.slice(0, 4).map((o) => (
                  <li key={o.id} className="flex items-start justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-v2-small font-semibold text-v2-text">{o.who || o.label}</div>
                      <div className="text-v2-caption text-v2-text-3">{[o.label, o.method, o.time].filter(Boolean).join(" · ")}</div>
                    </div>
                    <span className={`shrink-0 text-v2-small font-semibold tabular-nums ${o.amount >= 0 ? "text-v2-success" : "text-v2-text"}`}>
                      {o.amount >= 0 ? "+" : "−"}
                      {fmtSum(Math.abs(o.amount))}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => open("payment")} className={`${secondaryBtn} justify-center`}>
                  <PlusCircle className="size-4" strokeWidth={1.75} aria-hidden />
                  {t("Kirim")}
                </button>
                <button type="button" onClick={() => open("cash")} className={`${secondaryBtn} justify-center`}>
                  <MinusCircle className="size-4" strokeWidth={1.75} aria-hidden />
                  {t("Chiqim")}
                </button>
                <Link href="/finance-handover" className={`${secondaryBtn} justify-center`}>
                  <ArrowUp className="size-4" strokeWidth={1.75} aria-hidden />
                  {t("Topshirish")}
                </Link>
              </div>
            </Card>
          ) : null}

          {d.bonus ? (
            <Card>
              <CardTitle title={t("Savdo planim · {m}", { m: fmt.monthLower(d.bonus.month) })} sub={t("Sotuv va marketing → Savdo plani bilan bir xil")} />
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-v2-text">
                  <b className="text-[1.75rem] font-semibold tabular-nums">{d.bonus.done}</b>
                  <span className="text-v2-body text-v2-text-2"> / {t("{n} yangi o'quvchi", { n: d.bonus.target })}</span>
                </span>
                {d.bonus.target ? <span className={`rounded-v2-sm px-2 py-0.5 text-v2-caption ${pct >= monthPct ? "bg-v2-success-bg text-v2-success" : "bg-v2-danger-bg text-v2-danger"}`}>{pct >= monthPct ? t("Rejada") : t("Orqada")}</span> : null}
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-v2-track">
                <div className={`h-full rounded-full ${pct >= monthPct ? "bg-v2-success" : "bg-v2-danger"}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-v2-caption text-v2-text-2">{t("Oyning {p}% i o'tdi · prognoz: {n} ta.", { p: monthPct, n: d.bonus.forecast })}</p>
              {d.bonus.kpi ? (
                <div className="mt-3 grid grid-cols-2 gap-2 text-v2-small">
                  <div>
                    <div className="text-v2-caption text-v2-text-3">{t("Lid")}</div>
                    <div className="font-semibold tabular-nums">{d.bonus.kpi.leads}</div>
                  </div>
                  <div>
                    <div className="text-v2-caption text-v2-text-3">{t("Liddan o'quvchiga")}</div>
                    <div className="font-semibold tabular-nums">{d.bonus.kpi.convPct !== null ? `${d.bonus.kpi.convPct}%` : "—"}</div>
                  </div>
                </div>
              ) : null}
              {d.bonus.bonus ? (
                <p className="mt-3 rounded-v2-md bg-v2-warning-bg px-3 py-2 text-v2-small text-v2-text">
                  {t("Sotuv bonusi hozircha:")} <b>{fmtSum(d.bonus.bonus)} {t("so'm")}</b>
                  {d.bonus.planBonus ? <span className="block text-v2-caption text-v2-text-2">{t("reja bajarilsa yana +{sum}", { sum: fmtSum(d.bonus.planBonus) })}</span> : null}
                </p>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, tone, value, unit, label }: { icon: React.ReactNode; tone: "danger" | "info" | "warning" | "neutral"; value: string; unit?: string; label: string }) {
  const cls = { danger: "bg-v2-danger-bg text-v2-danger", info: "bg-v2-info-bg text-v2-info", warning: "bg-v2-warning-bg text-v2-warning", neutral: "bg-v2-surface-2 text-v2-text-2" }[tone];
  const num = { danger: "text-v2-danger", info: "text-v2-text", warning: "text-v2-text", neutral: "text-v2-text" }[tone];
  return (
    <div className="flex items-center gap-3 bg-v2-surface px-3 py-3 sm:px-4 sm:py-4">
      <span className={`hidden size-10 shrink-0 place-items-center rounded-v2-md sm:grid ${cls}`}>{icon}</span>
      <div className="min-w-0">
        <div className={`text-[1.375rem] font-semibold leading-7 tabular-nums ${value !== "0" ? num : "text-v2-text"}`}>
          {value}
          {unit ? <span className="ml-1 text-v2-small font-normal text-v2-text-2">{unit}</span> : null}
        </div>
        <div className="text-v2-caption text-v2-text-2">{label}</div>
      </div>
    </div>
  );
}

function Section({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-v2-border bg-v2-surface-2 px-4 py-2 text-v2-caption text-v2-text-2 sm:px-5">
      <span className="font-semibold">{title}</span>
      {right ? <span>{right}</span> : null}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="border-t border-v2-border px-4 py-3 text-v2-small text-v2-text-3 sm:px-5">{children}</p>;
}

function Row({ icon, tone, title, sub, badge, actions }: { icon: React.ReactNode; tone: "danger" | "warning" | "info"; title: string; sub: string; badge?: React.ReactNode; actions?: React.ReactNode }) {
  const cls = { danger: "bg-v2-danger-bg text-v2-danger", warning: "bg-v2-warning-bg text-v2-warning", info: "bg-v2-info-bg text-v2-info" }[tone];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-v2-border px-4 py-3 sm:flex-nowrap sm:px-5">
      <span className={`grid size-9 shrink-0 place-items-center rounded-v2-md ${cls}`}>{icon}</span>
      <div className="min-w-0 flex-1 basis-[calc(100%-3rem)] sm:basis-auto">
        <div className="text-v2-body font-semibold text-v2-text">{title}</div>
        <div className="text-v2-caption text-v2-text-3">{sub}</div>
      </div>
      <div className="flex w-full flex-wrap items-center justify-end gap-2 pl-12 sm:w-auto sm:flex-nowrap sm:pl-0">
        {badge}
        {actions}
      </div>
    </div>
  );
}
