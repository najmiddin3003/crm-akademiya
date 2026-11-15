"use client";

import { useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { UB_CFG, type UzbmbExam } from "@/lib/imtihon";
import type { CabinetResult } from "@/lib/studentCabinetTypes";
import { Bar, Card, CardHead, Empty, FanDot, Pill, useCabinetFmt, type CabinetTabProps } from "./bits";
import { PageHead, Pieces, StatStrip, fmtScore } from "./lessonParts";

// O'QUVCHI KABINETI (v2) — «NATIJALAR» TABI. Dizayn rasmi yo'q: Asosiy'dagi
// «So'nggi natija · Sarhisob» kartasining kengaytmasi.
//   tepada: oxirgi / o'rtacha / eng yaxshi natija (To'lovlar'dagi uch katak);
//   Sarhisob (`cab.results`, Imtihon → Sarhisob) — har natija foiz chizig'i
//   va guruh o'rtachasi belgisi bilan; fan bo'yicha filtr (fan 2+ bo'lsa);
//   UzBMB (me.exams.uzbmb) va eski «Oylik imtihonlar» — faqat yozuvi bo'lsa.

export default function NatijalarTab({ me, cab }: CabinetTabProps) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const results = cab.results;
  const uzbmb = me.exams.uzbmb;
  const monthly = me.exams.monthly;

  const courses = useMemo(() => [...new Set(results.map((r) => r.course).filter(Boolean))], [results]);
  const [course, setCourse] = useState("");
  const shown = course ? results.filter((r) => r.course === course) : results;

  const last = results[0] ?? null;
  const avg = results.length ? Math.round(results.reduce((s, r) => s + r.pct, 0) / results.length) : null;
  const best = results.reduce<CabinetResult | null>((b, r) => (b === null || r.pct > b.pct ? r : b), null);

  const nothing = results.length === 0 && uzbmb.length === 0 && monthly.length === 0;

  return (
    <div className="space-y-4">
      <PageHead title={t("Natijalar")} sub={[me.profile.fullName, results.length ? t("{n} ta natija", { n: results.length }) : null].filter(Boolean).join(" · ")} />

      {nothing ? (
        <Card>
          <Empty>{t("Hali natija yo'q. Imtihon natijalari shu yerda chiqadi.")}</Empty>
        </Card>
      ) : null}

      {last && best && avg !== null ? (
        <StatStrip
          items={[
            { key: "last", label: t("Oxirgi natija"), value: `${last.pct}%`, sub: <Pieces items={[last.course || last.title, fmt.dayMonth(last.date)]} /> },
            { key: "avg", label: t("O'rtacha"), value: `${avg}%`, sub: t("{n} ta imtihon bo'yicha", { n: results.length }) },
            {
              key: "best",
              label: t("Eng yaxshi"),
              value: `${best.pct}%`,
              sub: <Pieces items={[best.course || best.title, best.rank ? t("{rank}-o'rin", { rank: best.rank }) : null]} />,
            },
          ]}
        />
      ) : null}

      {results.length ? (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-2">
              <h2 className="text-v2-body font-semibold text-v2-text">{t("Sarhisob")}</h2>
              <span className="text-v2-small text-v2-text-3">{t("oylik imtihon natijalari")}</span>
            </div>
            {courses.length > 1 ? (
              <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1" role="group" aria-label={t("Fan")}>
                {["", ...courses].map((c) => {
                  const on = c === course;
                  return (
                    <button
                      key={c || "all"}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setCourse(c)}
                      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-v2-full border px-2.5 text-v2-caption transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
                        on ? "border-v2-brand bg-v2-brand-bg text-v2-brand-text" : "border-v2-border bg-v2-surface text-v2-text-2 hover:bg-v2-surface-2"
                      }`}
                    >
                      {c ? <FanDot course={c} className="size-1.5" /> : null}
                      {c || t("Hammasi")}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <ul className="divide-y divide-v2-border">
            {shown.map((r) => (
              <ResultRow key={r.examId} r={r} />
            ))}
          </ul>
        </Card>
      ) : null}

      {uzbmb.length ? <UzbmbCard rows={uzbmb} /> : null}

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
                    <div className="pl-4 text-v2-caption font-normal text-v2-text-3">{fmt.monthName(e.month)} {e.month.slice(0, 4)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-v2-body font-semibold tabular-nums text-v2-text">{e.pct}%</div>
                    <div className="text-v2-caption font-normal tabular-nums text-v2-text-3">
                      {e.correct}/{e.total}
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function ResultRow({ r }: { r: CabinetResult }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const diff = r.pct - r.groupAvg;
  const topRank = r.rank !== null && r.rank <= 3;

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <FanDot course={r.course} />
            <span className="truncate text-v2-body font-medium text-v2-text">{r.title}</span>
          </div>
          <div className="mt-0.5 pl-4 text-v2-caption font-normal text-v2-text-3">
            {fmt.dayMonth(r.date)} · {t("{month} sarhisobi", { month: fmt.monthName(r.month) })}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[1.375rem] font-semibold leading-7 tabular-nums text-v2-text">{r.pct}%</span>
          {r.rank !== null ? (
            <Pill tone={topRank ? "brand" : "neutral"}>{t("{rank}-o'rin / {n}", { rank: r.rank, n: r.participants })}</Pill>
          ) : null}
        </div>
      </div>

      {/* Foiz chizig'i + guruh o'rtachasi belgisi. */}
      <div className="relative mt-2 pl-4">
        <Bar value={r.pct} tone="brand" />
        {r.groupAvg > 0 ? (
          <span
            className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-v2-text-2"
            style={{ left: `calc(1rem + (100% - 1rem) * ${Math.max(0, Math.min(100, r.groupAvg)) / 100})` }}
            title={t("Guruh o'rtachasi: {pct}%", { pct: r.groupAvg })}
            aria-hidden
          />
        ) : null}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-4 text-v2-caption font-normal text-v2-text-3">
        <span className="tabular-nums">{t("{correct} / {total} to'g'ri", { correct: r.correct, total: r.total })}</span>
        <span className="tabular-nums">{t("guruhda {pct}%", { pct: r.groupAvg })}</span>
        {r.groupAvg > 0 && diff !== 0 ? (
          <span className={`inline-flex items-center gap-1 font-medium tabular-nums ${diff > 0 ? "text-v2-success" : "text-v2-warning"}`}>
            {diff > 0 ? <TrendingUp className="size-3.5" strokeWidth={1.75} aria-hidden /> : <TrendingDown className="size-3.5" strokeWidth={1.75} aria-hidden />}
            {diff > 0 ? t("o'rtachadan {n}% yuqori", { n: diff }) : t("o'rtachadan {n}% past", { n: -diff })}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function UzbmbCard({ rows }: { rows: UzbmbExam[] }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const sorted = [...rows].sort((a, b) => b.month.localeCompare(a.month) || b.id - a.id);

  const block = (name: string, subject: string, correct: number | null, cert: boolean | undefined, ball: number, max: number) => (
    <div className="min-w-0 rounded-v2-md bg-v2-surface-2 px-2.5 py-2">
      <div className="truncate text-[0.6875rem] leading-4 text-v2-text-3">{name}</div>
      <div className="truncate text-v2-caption text-v2-text-2" title={subject}>
        {subject || "—"}
      </div>
      <div className="mt-0.5 text-v2-body font-semibold tabular-nums text-v2-text">{fmtScore(ball)}</div>
      <div className="truncate text-[0.6875rem] leading-4 tabular-nums text-v2-text-3">
        {cert ? t("sertifikat") : correct !== null ? t("{n} / {max} to'g'ri", { n: correct, max }) : "—"}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHead title={t("UZBMB")} sub={t("{max} balldan", { max: UB_CFG.MAX })} />
      <ul className="divide-y divide-v2-border">
        {sorted.map((e) => (
          <li key={e.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-v2-body font-medium text-v2-text">
                {fmt.monthName(e.month)} {e.month.slice(0, 4)}
              </span>
              <span className="tabular-nums text-v2-text-3">
                <b className="text-[1.375rem] font-semibold leading-7 text-v2-text">{fmtScore(e.total)}</b>
                <span className="text-v2-small"> / {UB_CFG.MAX}</span>
              </span>
            </div>
            <div className="mt-1.5">
              <Bar value={(e.total / UB_CFG.MAX) * 100} tone="brand" />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {block(t("1-blok"), e.b1s, e.b1c, e.b1cert, e.b1, UB_CFG.b1max)}
              {block(t("2-blok"), e.b2s, e.b2c, e.b2cert, e.b2, UB_CFG.b2max)}
              {block(t("Majburiy"), t("3 fan"), e.m1 + e.m2 + e.m3, false, e.maj, UB_CFG.mmax * 3)}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
