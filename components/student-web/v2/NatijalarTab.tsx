"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Clock, Info, MessageSquare } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { fanOf, FAN_BG, FAN_TEXT } from "@/components/v2/ui/fan";
import { UB_CFG, type UzbmbExam } from "@/lib/imtihon";
import { seasonInfo, seasonOf, type SeasonCard } from "@/lib/seasonGradeTypes";
import type { CabinetResult } from "@/lib/studentCabinetTypes";
import type { UzbmbStat } from "@/lib/studentUzbmb";
import { Card, CardHead, Empty, FanDot, useCabinetFmt, type CabinetTabProps } from "./bits";
import { PageHead, fmtScore } from "./lessonParts";

// O'QUVCHI KABINETI (v2) — «NATIJALAR» TABI (44-qism, rasmlar «Kabinet · Natijalar», «Kabinet · UzBMB»,
// «Kabinet · Ota-ona»).
//   SARHISOB: har guruh — alohida karta: oxirgi natija (foiz, to'g'ri/savol), oldingisidan farq (p.p.),
//   Siz / Guruh o'rtachasi / Filial o'rtachasi chiziqlari va «Oylar bo'yicha» ustunlari (oxirgi 5 natija).
//   Joriy oy imtihoni hali bo'lmagan guruhda — izoh. Pastda «Chorak baholari» (me.season, 36-qism):
//   yuborilgan baho — mezonlar va ustoz izohi; baholanmagan guruh — «Ustoz baholamoqda · muddat».
//   UzBMB: yozuvi bo'lsa yuqorida «Sarhisob | UzBMB» tanlovi. Oxirgi test bali, oldingi testdan farq,
//   guruhdagi o'rin; taqqoslash (lib/studentUzbmb.ts), testlar bo'yicha ustunlar, fanlar bo'yicha qatorlar.
//   Ota-ona kabinetida «Siz» o'rniga farzand ismi.

const pillCls = (course: string) => `${FAN_BG[fanOf(course)]} ${FAN_TEXT[fanOf(course)]}`;

export default function NatijalarTab({ me, cab }: CabinetTabProps) {
  const { t } = useT();
  const uzbmb = me.exams.uzbmb;
  const [view, setView] = useState<"sarhisob" | "uzbmb">(cab.results.length === 0 && uzbmb.length > 0 ? "uzbmb" : "sarhisob");
  const parent = me.profile.role === "parent";
  const youLabel = parent ? cab.firstName : t("Siz");

  const sub =
    view === "uzbmb"
      ? [parent ? me.profile.fullName : null, t("UzBMB sinov testlari"), me.profile.branch].filter(Boolean).join(" · ")
      : [parent ? me.profile.fullName : null, t("Sarhisob — har oy o'tkaziladigan imtihon · foiz = to'g'ri javoblar / savollar")].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      <PageHead
        title={t("Natijalar")}
        sub={sub}
        right={
          uzbmb.length ? (
            <div role="tablist" aria-label={t("Natija turi")} className="inline-flex rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
              {(["sarhisob", "uzbmb"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={view === k}
                  onClick={() => setView(k)}
                  className={`h-8 rounded-v2-sm px-3 text-v2-small transition-colors ${view === k ? "bg-v2-surface font-semibold text-v2-text shadow-v2-sm" : "text-v2-text-2 hover:text-v2-text"}`}
                >
                  {k === "uzbmb" ? "UzBMB" : t("Sarhisob")}
                </button>
              ))}
            </div>
          ) : null
        }
      />
      {view === "uzbmb" ? <UzbmbView rows={uzbmb} stats={me.uzbmbStats ?? []} youLabel={youLabel} /> : <SarhisobView me={me} cab={cab} youLabel={youLabel} />}
    </div>
  );
}

/* ───────────────────────── Sarhisob ───────────────────────── */

function SarhisobView({ me, cab, youLabel }: Pick<CabinetTabProps, "me" | "cab"> & { youLabel: string }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const current = cab.today.slice(0, 7);
  // Guruh bo'yicha (yangidan eskiga) — guruh kartalari tartibi: avval hozirgi guruhlar, keyin qolganlari.
  const byGroup = new Map<string, CabinetResult[]>();
  for (const r of cab.results) {
    const key = r.groupId ? `g${r.groupId}` : `c${r.course}`;
    byGroup.set(key, [...(byGroup.get(key) ?? []), r]);
  }
  const order = [...byGroup.keys()].sort((a, b) => {
    const ia = cab.groups.findIndex((g) => `g${g.id}` === a);
    const ib = cab.groups.findIndex((g) => `g${g.id}` === b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const monthly = me.exams.monthly;
  const season = me.season ?? [];

  return (
    <>
      {cab.results.length === 0 && monthly.length === 0 && season.length === 0 ? (
        <Card>
          <Empty>{t("Hali natija yo'q. Imtihon natijalari shu yerda chiqadi.")}</Empty>
        </Card>
      ) : null}

      {order.length ? (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {order.map((k) => (
            <GroupResultCard key={k} list={byGroup.get(k)!} current={current} youLabel={youLabel} />
          ))}
        </div>
      ) : null}

      <SeasonBlock cards={season} cab={cab} />

      {monthly.length ? (
        <Card>
          <CardHead title={t("Oylik imtihonlar")} sub={t("{n} ta", { n: monthly.length })} />
          <ul className="divide-y divide-v2-border">
            {[...monthly]
              .sort((a, b) => b.month.localeCompare(a.month))
              .map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <FanDot course={e.subject} />
                      <span className="truncate text-v2-body font-medium text-v2-text">{[e.subject, e.level].filter(Boolean).join(" · ")}</span>
                    </div>
                    <div className="pl-4 text-v2-caption text-v2-text-3">
                      {fmt.monthName(e.month)} {e.month.slice(0, 4)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-v2-body font-semibold tabular-nums text-v2-text">{e.pct}%</div>
                    <div className="text-v2-caption tabular-nums text-v2-text-3">
                      {e.correct}/{e.total}
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

function CompareRow({ label, value, max, strong, suffix = "%" }: { label: string; value: number | null; max: number; strong?: boolean; suffix?: string }) {
  if (value === null) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-v2-small">
        <span className={strong ? "font-semibold text-v2-text" : "text-v2-text-2"}>{label}</span>
        <span className="font-semibold tabular-nums text-v2-text">
          {suffix === "%" ? value : fmtScore(value)}
          {suffix}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-v2-full bg-v2-track">
        <div className={`h-full rounded-v2-full ${strong ? "bg-v2-brand" : "bg-v2-border-strong"}`} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
      </div>
    </div>
  );
}

function Columns({ items }: { items: { key: string; label: string; value: number; shown: string; on: boolean }[] }) {
  const max = Math.max(1, ...items.map((x) => x.value));
  return (
    <div className="flex h-36 items-end gap-3 border-b border-v2-border">
      {items.map((x, i) => (
        <div key={x.key} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${x.label}: ${x.shown}`}>
          {x.on || i === 0 ? <span className="text-v2-caption font-semibold tabular-nums text-v2-text">{x.shown}</span> : null}
          <span className={`w-full max-w-[2.25rem] rounded-t-v2-sm ${x.on ? "bg-v2-brand" : "bg-v2-border-strong"}`} style={{ height: `${Math.max(6, (x.value / max) * 96)}px` }} />
        </div>
      ))}
    </div>
  );
}

function GroupResultCard({ list, current, youLabel }: { list: CabinetResult[]; current: string; youLabel: string }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const last = list[0];
  const prev = list[1] ?? null;
  const diff = prev ? last.pct - prev.pct : null;
  const series = list.slice(0, 5).reverse();

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className={`rounded-v2-sm px-2 py-0.5 text-v2-caption font-medium ${pillCls(last.course)}`}>{last.title}</span>
        {diff !== null && diff !== 0 ? (
          <span className={`inline-flex items-center gap-1 rounded-v2-sm px-2 py-0.5 text-v2-caption font-semibold ${diff > 0 ? "bg-v2-success-bg text-v2-success" : "bg-v2-warning-bg text-v2-warning"}`}>
            {diff > 0 ? <ArrowUp className="size-3.5" strokeWidth={2} aria-hidden /> : <ArrowDown className="size-3.5" strokeWidth={2} aria-hidden />}
            {t("{n} p.p. {month}dan", { n: `${diff > 0 ? "+" : ""}${diff}`, month: fmt.monthLower(prev!.month) })}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-v2-small text-v2-text-2">
        {[last.teacher, t("{month} imtihoni, {date}", { month: fmt.monthLower(last.month), date: fmt.dayMonth(last.date) })].filter(Boolean).join(" · ")}
      </p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-[2.5rem] font-semibold leading-none tabular-nums text-v2-text">{last.pct}%</span>
        <span className="text-v2-body tabular-nums text-v2-text-2">{t("{correct} / {total} to'g'ri", { correct: last.correct, total: last.total })}</span>
      </div>
      <div className="mt-4 space-y-3">
        <CompareRow label={youLabel} value={last.pct} max={100} strong />
        <CompareRow label={t("Guruh o'rtachasi")} value={last.groupAvg || null} max={100} />
        <CompareRow label={t("Filial o'rtachasi")} value={last.branchAvg} max={100} />
      </div>
      {last.rank !== null && last.participants > 1 ? (
        <p className="mt-3 text-v2-small text-v2-text-2">{t("Guruhda {rank}-o'rin · {n} kishi", { rank: last.rank, n: last.participants })}</p>
      ) : null}
      {series.length > 1 ? (
        <div className="mt-4">
          <h3 className="mb-2 text-v2-small font-medium text-v2-text-2">{t("Oylar bo'yicha")}</h3>
          <Columns items={series.map((r, i) => ({ key: String(r.examId), label: fmt.monthName(r.month), value: r.pct, shown: `${r.pct}%`, on: i === series.length - 1 }))} />
          <div className="mt-1.5 flex gap-3">
            {series.map((r) => (
              <span key={r.examId} className="flex-1 text-center text-v2-caption text-v2-text-3">
                {fmt.monthName(r.month).slice(0, 3)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {last.month < current ? (
        <p className="mt-3 flex items-start gap-2 text-v2-small text-v2-text-2">
          <Info className="mt-0.5 size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          {t("{month} imtihoni hali o'tkazilmagan.", { month: fmt.monthName(current) })}
        </p>
      ) : null}
    </Card>
  );
}

/* ───────────────────────── Chorak baholari ───────────────────────── */

function SeasonBlock({ cards, cab }: { cards: SeasonCard[]; cab: CabinetTabProps["cab"] }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const nowSeason = seasonInfo(seasonOf(cab.today));
  // Joriy chorak bahosi hali yuborilmagan guruhlar — «Ustoz baholamoqda».
  const latest = cards[0]?.season ?? null;
  const pending = latest === nowSeason.key ? cab.groups.filter((g) => !cards.some((c) => c.group.toLowerCase().includes(g.course.toLowerCase()))) : cab.groups;
  if (!cards.length && !cab.groups.length) return null;
  const info = latest ? seasonInfo(latest) : nowSeason;

  return (
    <Card>
      <CardHead title={t("Chorak baholari · {season}", { season: info.short.split(",")[0] })} />
      <p className="-mt-2 mb-3 text-v2-small text-v2-text-3">{t("{label} · ustoz mezonlar bo'yicha baholaydi, ota-onaga ham boradi", { label: info.label.split(" · ").slice(1).join(" · ") })}</p>
      <div className="grid gap-4 md:grid-cols-2 md:divide-x md:divide-v2-border">
        {cards.map((c) => (
          <div key={c.group} className="min-w-0 md:pr-4 md:[&:nth-child(2n)]:pl-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className={`rounded-v2-sm px-2 py-0.5 text-v2-caption font-medium ${pillCls(c.group)}`}>{c.group}</span>
                <p className="mt-1 text-v2-small text-v2-text-2">{[c.teacher, c.sentAt ? fmt.dayMonth(c.sentAt.slice(0, 10)) : null].filter(Boolean).join(" · ")}</p>
              </div>
              {c.avg !== null ? (
                <span className="shrink-0 text-[1.75rem] font-semibold leading-none tabular-nums text-v2-success">
                  {String(c.avg).replace(".", ",")}
                  <span className="text-v2-small font-normal text-v2-text-3"> / 5</span>
                </span>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {c.criteria.map((k) => (
                <div key={k.name} className="flex items-center justify-between gap-2 rounded-v2-md border border-v2-border px-3 py-2 text-v2-small">
                  <span className="truncate text-v2-text">{t(k.name)}</span>
                  <span className={`font-semibold tabular-nums ${k.score >= 5 ? "text-v2-success" : "text-v2-text"}`}>{k.score || "—"}</span>
                </div>
              ))}
            </div>
            {c.note ? (
              <p className="mt-2 flex items-start gap-2 text-v2-small text-v2-text-2">
                <MessageSquare className="mt-0.5 size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />«{c.note}»
              </p>
            ) : null}
          </div>
        ))}
        {pending.map((g) => (
          <div key={g.id} className="min-w-0 md:pr-4 md:[&:nth-child(2n)]:pl-4">
            <span className={`rounded-v2-sm px-2 py-0.5 text-v2-caption font-medium ${pillCls(g.course)}`}>{g.title}</span>
            <p className="mt-1 text-v2-small text-v2-text-2">{g.teacher}</p>
            <div className="mt-3 flex items-start gap-3 rounded-v2-md border border-dashed border-v2-border-strong px-3 py-3">
              <Clock className="mt-0.5 size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
              <div>
                <div className="text-v2-body font-medium text-v2-text">{t("Ustoz baholamoqda")}</div>
                <div className="text-v2-small text-v2-text-2">{t("{date}gacha keladi", { date: fmt.dayMonth(nowSeason.deadline) })}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ───────────────────────── UzBMB ───────────────────────── */

function UzbmbView({ rows, stats, youLabel }: { rows: UzbmbExam[]; stats: UzbmbStat[]; youLabel: string }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const sorted = [...rows].sort((a, b) => b.month.localeCompare(a.month) || b.id - a.id);
  const last = sorted[0];
  const prev = sorted[1] ?? null;
  const st = stats.find((s) => s.examId === last.id) ?? null;
  const diff = prev ? Math.round((last.total - prev.total) * 10) / 10 : null;
  const statOf = (e: UzbmbExam) => stats.find((s) => s.examId === e.id) ?? null;
  const testLabel = (e: UzbmbExam) => {
    const s = statOf(e);
    return s?.testNo ? `№${s.testNo}` : fmt.monthName(e.month).slice(0, 3);
  };
  const series = sorted.slice(0, 6).reverse();
  const lastWhen = st?.date ? fmt.dayMonth(st.date) : `${fmt.monthName(last.month)} ${last.month.slice(0, 4)}`;
  const subjects = [
    { name: last.b1s || t("1-blok"), sub: t("1-blok"), c: last.b1c, q: UB_CFG.b1max, k: UB_CFG.b1k, ball: last.b1, max: 93, cert: last.b1cert },
    { name: last.b2s || t("2-blok"), sub: t("2-blok"), c: last.b2c, q: UB_CFG.b2max, k: UB_CFG.b2k, ball: last.b2, max: 63, cert: last.b2cert },
    { name: t("Ona tili"), sub: t("majburiy"), c: last.m1, q: UB_CFG.mmax, k: UB_CFG.mk, ball: Math.round(last.m1 * UB_CFG.mk * 10) / 10, max: 11 },
    { name: t("Matematika"), sub: t("majburiy"), c: last.m2, q: UB_CFG.mmax, k: UB_CFG.mk, ball: Math.round(last.m2 * UB_CFG.mk * 10) / 10, max: 11 },
    { name: t("O'zbekiston tarixi"), sub: t("majburiy"), c: last.m3, q: UB_CFG.mmax, k: UB_CFG.mk, ball: Math.round(last.m3 * UB_CFG.mk * 10) / 10, max: 11 },
  ];
  const k = (n: number) => String(n).replace(".", ",");

  return (
    <>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-v2-small text-v2-text-2">{[st?.testNo ? t("Sinov testi №{n}", { n: st.testNo }) : st?.testName || t("Sinov testi"), lastWhen].join(" · ")}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[2.5rem] font-semibold leading-none tabular-nums text-v2-text">{fmtScore(last.total)}</span>
            <span className="text-v2-body text-v2-text-2">{t("/ {max} ball", { max: UB_CFG.MAX })}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {diff !== null && diff !== 0 ? (
              <span className={`inline-flex items-center gap-1 rounded-v2-sm px-2 py-0.5 text-v2-caption font-semibold ${diff > 0 ? "bg-v2-success-bg text-v2-success" : "bg-v2-warning-bg text-v2-warning"}`}>
                {diff > 0 ? <ArrowUp className="size-3.5" strokeWidth={2} aria-hidden /> : <ArrowDown className="size-3.5" strokeWidth={2} aria-hidden />}
                {t("{n} oldingi testdan", { n: `${diff > 0 ? "+" : ""}${k(diff)}` })}
              </span>
            ) : null}
            {st?.rank ? <span className="rounded-v2-sm bg-v2-info-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-info">{t("Guruhda {rank}-o'rin · {n} kishi", { rank: st.rank, n: st.groupSize })}</span> : null}
          </div>
          <p className="mt-3 flex items-start gap-2 text-v2-small text-v2-text-2">
            <Info className="mt-0.5 size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
            {t("Ball = to'g'ri javoblar × fan koeffitsienti: {b1} {k1}, {b2} {k2}, majburiy fanlar {km}.", {
              b1: last.b1s || t("1-blok"),
              k1: k(UB_CFG.b1k),
              b2: last.b2s || t("2-blok"),
              k2: k(UB_CFG.b2k),
              km: k(UB_CFG.mk),
            })}
          </p>
        </Card>

        {st && (st.groupAvg !== null || st.branchAvg !== null) ? (
          <Card>
            <CardHead title={t("Taqqoslash")} />
            <p className="-mt-2 mb-3 text-v2-small text-v2-text-3">{t("test {no} · ball, {max} dan", { no: st.testNo ? `№${st.testNo}` : "", max: UB_CFG.MAX })}</p>
            <div className="space-y-3">
              <CompareRow label={youLabel} value={last.total} max={UB_CFG.MAX} strong suffix="" />
              <CompareRow label={t("Guruh o'rtachasi")} value={st.groupAvg} max={UB_CFG.MAX} suffix="" />
              <CompareRow label={t("Filial o'rtachasi")} value={st.branchAvg} max={UB_CFG.MAX} suffix="" />
            </div>
          </Card>
        ) : null}

        {series.length > 1 ? (
          <Card>
            <CardHead title={t("Testlar bo'yicha")} />
            <p className="-mt-2 mb-3 text-v2-small text-v2-text-3">{t("ball, {max} dan", { max: UB_CFG.MAX })}</p>
            <Columns items={series.map((e, i) => ({ key: String(e.id), label: testLabel(e), value: e.total, shown: fmtScore(e.total), on: i === series.length - 1 }))} />
            <div className="mt-1.5 flex gap-3">
              {series.map((e) => {
                const s = statOf(e);
                return (
                  <span key={e.id} className="flex-1 text-center text-v2-caption text-v2-text-3">
                    {testLabel(e)}
                    {s?.date ? ` · ${fmt.dayMonth(s.date)}` : ""}
                  </span>
                );
              })}
            </div>
            <p className="mt-2 text-v2-caption tabular-nums text-v2-text-3">{series.map((e) => fmtScore(e.total)).join(" → ")}</p>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHead title={t("Fanlar bo'yicha")} />
        <p className="-mt-2 mb-3 text-v2-small text-v2-text-3">{[st?.testNo ? t("test №{n}", { n: st.testNo }) : lastWhen, [last.b1s, last.b2s].filter(Boolean).join(" — ")].filter(Boolean).join(" · ")}</p>
        <ul className="divide-y divide-v2-border">
          {subjects.map((s) => (
            <li key={s.name + s.sub} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 py-3 first:pt-0 last:pb-0 md:grid-cols-[13rem_minmax(0,1fr)_6rem]">
              <div className="min-w-0">
                <div className="truncate text-v2-body font-medium text-v2-text">{s.name}</div>
                <div className="text-v2-caption text-v2-text-3">
                  {s.cert ? t("{sub} · milliy sertifikat", { sub: s.sub }) : t("{sub} · {q} × {k} · {c} / {q} to'g'ri", { sub: s.sub, q: s.q, k: k(s.k), c: s.c ?? "—" })}
                </div>
              </div>
              <div className="order-last col-span-2 h-1.5 overflow-hidden rounded-v2-full bg-v2-track md:order-none md:col-span-1">
                <div className="h-full rounded-v2-full bg-v2-brand" style={{ width: `${Math.min(100, (s.ball / s.max) * 100)}%` }} />
              </div>
              <div className="text-right tabular-nums">
                <b className="font-semibold text-v2-text">{k(s.ball)}</b>
                <span className="text-v2-text-3"> / {s.max}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
