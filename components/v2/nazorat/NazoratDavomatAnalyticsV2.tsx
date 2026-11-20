"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Download, Info } from "lucide-react";
import Link from "@/components/ui/Link";
import type { DateRange } from "@/components/ui/DateRangePicker";
import { useT, type TFn } from "@/components/shared/Language";
import { useNazoratAttendance } from "@/components/nazorat/useNazoratAttendance";
import { Segmented } from "@/components/v2/form/fields";
import { Callout, Panel } from "@/components/v2/reports/report35";
import { NoteLine } from "@/components/v2/reports/reportUi";
import { PageHead, PageShell, fmtNum } from "@/components/v2/students/lists/listKit";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import V2DateRange, { rangeLabel } from "@/components/v2/ui/V2DateRange";
import V2Select from "@/components/v2/ui/V2Select";
import { downloadTableCsv } from "@/lib/exportTable";
import { WEEKDAYS_SHORT, type Lang } from "@/lib/i18n";
import { NAZORAT_ATT_SERIES, nazoratAttDays, nazoratAttStartOfMonth, type NazoratAttDay } from "./nazoratAttCalc";

// YANGI VERSIYA — NAZORAT → «DAVOMAT ANALITIKASI» (/nazorat-davomat-analytics, 28-qism, rasmsiz — 34-qism
// Nazorat va 35-qism Hisobotlar qolipida). Eski sahifa (components/nazorat/NazoratDavomatAnalyticsPage.tsx)
// o'zgarmagan; versiya app/(app)/nazorat-davomat-analytics/page.tsx da serverda tanlanadi.
//   • sarlavha + «CSV» (eski fayl bilan aynan bir xil: «davomat-analitikasi.csv», o'sha ustunlar);
//   • filtrlar qatori: sana oralig'i (sukut — oy boshidan bugungacha), Kurs, Guruh, O'qituvchi, Holati;
//   • holatlar kataklari: Jami belgilar + besh holat (son va ulushi);
//   • «Kunlar bo'yicha» — ustunli grafik (holatlar ustma-ust) yoki jadval («Grafik | Jadval»);
//   • izoh: «Davomat qilinmagan» va «Muzlatilgan» kunlik sanalmaydi (eskisidagi «—» kataklar o'rniga).
// Sonlar — eskisi bilan bir xil manba va hisob (./nazoratAttCalc.ts).

type View = "chart" | "table";

const SERIES = NAZORAT_ATT_SERIES;
const TH = "sticky top-0 z-10 whitespace-nowrap bg-v2-surface-2 px-3 py-2.5 text-v2-caption font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";

/** Y o'qi: 1-2-5 × 10^n qadam, ~5 katak; belgi yo'q bo'lsa 0..4 (eskisidagi DvaBarChart qoidasi). */
function niceScale(max: number): { niceMax: number; step: number } {
  if (!Number.isFinite(max) || max <= 0) return { niceMax: 4, step: 1 };
  const rough = max / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = Math.max(1, Math.round((norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag));
  return { niceMax: Math.ceil(max / step) * step, step };
}

const sumOf = (vals: readonly number[]) => vals.reduce((s, v) => s + v, 0);
const share = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default function NazoratDavomatAnalyticsV2() {
  const { t, lang } = useT();
  const { groups, marks, loading } = useNazoratAttendance();

  const [range, setRange] = useState<DateRange>(() => ({ start: nazoratAttStartOfMonth(new Date()), end: new Date() }));
  const [kurs, setKurs] = useState("");
  const [group, setGroup] = useState("");
  const [teacher, setTeacher] = useState("");
  const [holati, setHolati] = useState("");
  const [view, setView] = useState<View>("chart");

  // Tanlov ro'yxatlari — bazadagi guruhlardan (eskisidagidek: guruh NOMI bo'yicha).
  const kursOptions = useMemo(() => [...new Set(groups.map((g) => g.course).filter(Boolean))].sort().map((k) => ({ value: k, label: k })), [groups]);
  const groupOptions = useMemo(() => {
    const names = [...new Set(groups.map((g) => g.name).filter(Boolean))].sort();
    return names.map((n) => {
      const same = groups.filter((g) => g.name === n);
      const hint = same.length === 1 ? [same[0].course, same[0].level].filter(Boolean).join(" · ") : undefined;
      return { value: n, label: n, hint: hint || undefined };
    });
  }, [groups]);
  const teacherOptions = useMemo(() => [...new Set(groups.map((g) => g.teacher).filter(Boolean))].sort().map((x) => ({ value: x, label: x })), [groups]);
  const statusOptions = SERIES.map((s) => ({ value: s.status, label: s.label }));

  const visibleGroupIds = useMemo(
    () =>
      new Set(
        groups
          .filter((g) => {
            if (kurs && g.course !== kurs) return false;
            if (group && g.name !== group) return false;
            if (teacher && g.teacher !== teacher) return false;
            return true;
          })
          .map((g) => g.id),
      ),
    [groups, kurs, group, teacher],
  );

  const days = useMemo(() => nazoratAttDays(marks, visibleGroupIds, range, holati), [marks, visibleGroupIds, range, holati]);
  const totals = useMemo(() => {
    const tv = SERIES.map(() => 0);
    for (const d of days) for (let k = 0; k < tv.length; k++) tv[k] += d.vals[k];
    return tv;
  }, [days]);
  const total = sumOf(totals);
  const period = rangeLabel(range, lang, t);
  const anyFilter = !!(kurs || group || teacher || holati);

  // Eski fayl bilan aynan bir xil: o'sha nom, o'sha (o'zbekcha) sarlavhalar, o'sha qatorlar.
  function exportCsv() {
    downloadTableCsv(
      ["Sana", ...SERIES.map((s) => s.csv), "Jami"],
      days.map((d) => [d.label, ...d.vals, sumOf(d.vals)]),
      "davomat-analitikasi.csv",
    );
  }

  return (
    <PageShell flow>
      <PageHead
        title={t("Davomat analitikasi")}
        subtitle={`${t("Qo'yilgan davomat belgilari — kunlar va holatlar bo'yicha")} · ${period}`}
        actions={
          <button type="button" onClick={exportCsv} disabled={loading} title={t("CSV faylini yuklab olish")} className={`${secondaryBtn} disabled:opacity-50`}>
            <Download className="size-4" strokeWidth={1.75} aria-hidden />
            CSV
          </button>
        }
      />

      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-2">
        <V2DateRange value={range} onChange={setRange} allowAll={false} align="start" />
        <V2Select variant="chip" label={t("Kurs")} value={kurs} onChange={setKurs} options={kursOptions} />
        <V2Select variant="chip" label={t("Guruh")} value={group} onChange={setGroup} options={groupOptions} />
        <V2Select variant="chip" label={t("O'qituvchi")} value={teacher} onChange={setTeacher} options={teacherOptions} />
        <V2Select variant="chip" label={t("Holati")} value={holati} onChange={setHolati} options={statusOptions} searchable={false} />
        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setKurs("");
              setGroup("");
              setTeacher("");
              setHolati("");
            }}
            className="h-9 rounded-v2-md px-2 text-v2-small font-medium text-v2-brand-text hover:underline focus-visible:shadow-v2-focus focus-visible:outline-none"
          >
            {t("Tozalash")}
          </button>
        )}
      </div>

      {/* Holatlar — jami va besh holat (tanlangan davr va filtrlar bo'yicha) */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border shadow-v2-sm min-[40rem]:grid-cols-3 min-[80rem]:grid-cols-6">
        <div className="min-w-0 bg-v2-surface px-4 py-3.5">
          <div className="truncate text-v2-small text-v2-text-2">{t("Jami belgilar")}</div>
          {loading ? (
            <div className="mt-2 h-6 w-16 rounded bg-v2-skeleton" aria-hidden />
          ) : (
            <div className="mt-1 text-[22px] font-semibold leading-8 tabular-nums text-v2-text">{fmtNum(total)}</div>
          )}
          <div className="mt-1.5">
            <span className="flex h-1.5 overflow-hidden rounded-full bg-v2-track" aria-hidden>
              {!loading && SERIES.map((s, k) => (totals[k] > 0 ? <span key={s.status} className={s.bar} style={{ width: `${(totals[k] / Math.max(1, total)) * 100}%` }} /> : null))}
            </span>
          </div>
        </div>
        {SERIES.map((s, k) => {
          const off = !!holati && holati !== s.status;
          return (
            <div key={s.status} className="min-w-0 bg-v2-surface px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-v2-small text-v2-text-2">
                <span className={`size-2.5 shrink-0 rounded-[3px] ${s.bar}`} aria-hidden />
                <span className="truncate">{t(s.label)}</span>
              </div>
              {loading ? (
                <div className="mt-2 h-6 w-12 rounded bg-v2-skeleton" aria-hidden />
              ) : (
                <div className={`mt-1 text-[22px] font-semibold leading-8 tabular-nums ${off ? "text-v2-text-3" : "text-v2-text"}`}>{fmtNum(totals[k])}</div>
              )}
              <div className="mt-0.5 truncate text-v2-caption text-v2-text-2">{loading ? " " : off ? t("filtrda tanlanmagan") : t("{p}% belgilar", { p: share(totals[k], total) })}</div>
            </div>
          );
        })}
      </section>

      <Panel
        title={t("Kunlar bo'yicha")}
        sub={`${t("har kuni qo'yilgan belgilar soni")} · ${period}`}
        right={
          <div className="w-[200px] max-w-full">
            <Segmented
              value={view}
              onChange={(v) => setView(v as View)}
              label={t("Ko'rinish")}
              options={[
                { value: "chart", label: t("Grafik") },
                { value: "table", label: t("Jadval") },
              ]}
            />
          </div>
        }
      >
        {loading ? (
          <div className="mx-4 mb-4 h-56 rounded-v2-md bg-v2-skeleton" aria-hidden />
        ) : total === 0 ? (
          <p className="px-4 pb-10 pt-6 text-center text-v2-small text-v2-text-2">
            {anyFilter ? t("Bu davrda tanlangan filtrlar bo'yicha davomat belgisi yo'q") : t("Bu davrda davomat belgisi yo'q")}
          </p>
        ) : view === "chart" ? (
          <DayChart days={days} lang={lang} t={t} />
        ) : (
          <DayTable days={days} totals={totals} t={t} />
        )}
        {!loading && total > 0 && view === "chart" && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-4 text-v2-small text-v2-text-2">
            {SERIES.map((s) => (
              <span key={s.status} className="inline-flex items-center gap-1.5">
                <span className={`size-2.5 rounded-[3px] ${s.bar}`} aria-hidden />
                {t(s.label)}
              </span>
            ))}
          </div>
        )}
      </Panel>

      <Callout
        icon={<Info className="size-5" strokeWidth={1.75} aria-hidden />}
        title={t("«Davomat qilinmagan» va «Muzlatilgan» bu yerda sanalmaydi")}
        action={
          <Link href="/nazorat-missed-groups" className={secondaryBtn}>
            {t("Davomat qilinmagan guruhlar")}
            <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
          </Link>
        }
      >
        {t(
          "Grafik faqat qo'yilgan belgilarni ko'rsatadi. O'quvchining guruhga qo'shilgan va muzlatilgan sanasi bazada saqlanmaydi — o'tgan kunlardagi guruh ro'yxatini tiklab bo'lmaydi. Qoldirilgan darslar alohida sahifada: u o'quvchi sonini emas, guruh-dars faktini sanaydi.",
        )}
      </Callout>

      <NoteLine>
        {t("Guruh va o'qituvchi kesimida qatnashish foizi —")}{" "}
        <Link href="/reports/davomat-guruhlar" className="rounded-v2-sm text-v2-brand-text underline-offset-2 hover:underline focus-visible:shadow-v2-focus focus-visible:outline-none">
          {t("Hisobotlar → Davomat")}
        </Link>
        .
      </NoteLine>
    </PageShell>
  );
}

/* ───────────────────────── Grafik ───────────────────────── */

const PLOT_H = 200;

function DayChart({ days, lang, t }: { days: NazoratAttDay[]; lang: Lang; t: TFn }) {
  const max = Math.max(0, ...days.map((d) => sumOf(d.vals)));
  const { niceMax, step } = niceScale(max);
  const ticks: number[] = [];
  for (let v = 0; v <= niceMax; v += step) ticks.push(v);
  const wd = WEEKDAYS_SHORT[lang] ?? WEEKDAYS_SHORT.uz;

  return (
    <div className="flex gap-2 px-4 pb-3 pt-1">
      {/* Y o'qi */}
      <div className="relative w-8 shrink-0" style={{ height: PLOT_H, marginTop: 20 }} aria-hidden>
        {ticks.map((v) => (
          <span key={v} className="absolute right-0 translate-y-1/2 text-v2-caption tabular-nums text-v2-text-3" style={{ bottom: `${(v / niceMax) * 100}%` }}>
            {fmtNum(v)}
          </span>
        ))}
      </div>
      {/* Ustunlar — ko'p kunda o'z qutisida suriladi */}
      <div className="min-w-0 flex-1 overflow-x-auto pb-1">
        <div style={{ minWidth: days.length * 34 }}>
          <div className="relative" style={{ height: PLOT_H, marginTop: 20 }}>
            {ticks.map((v) => (
              <span key={v} className="absolute inset-x-0 border-t border-v2-border" style={{ bottom: `${(v / niceMax) * 100}%` }} aria-hidden />
            ))}
            <div className="absolute inset-0 flex gap-1 px-0.5">
              {days.map((d) => {
                const sum = sumOf(d.vals);
                const h = (sum / niceMax) * 100;
                const tip = `${d.label} · ${SERIES.map((s, k) => `${t(s.label)} ${d.vals[k]}`).join(", ")}`;
                return (
                  <div key={d.iso} className="relative flex h-full min-w-0 flex-1 justify-center" title={tip}>
                    {sum > 0 && (
                      <>
                        <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-v2-caption font-medium tabular-nums text-v2-text-2" style={{ bottom: `calc(${h}% + 2px)` }}>
                          {sum}
                        </span>
                        <span className="absolute bottom-0 left-1/2 flex w-full max-w-7 -translate-x-1/2 flex-col-reverse overflow-hidden rounded-t-[4px]" style={{ height: `${h}%` }}>
                          {SERIES.map((s, k) => (d.vals[k] > 0 ? <span key={s.status} className={`${s.bar} shrink-0`} style={{ height: `${(d.vals[k] / sum) * 100}%` }} /> : null))}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-1 px-0.5 pt-2" aria-hidden>
            {days.map((d, i) => {
              const day = Number(d.iso.slice(8, 10));
              const dow = new Date(Number(d.iso.slice(0, 4)), Number(d.iso.slice(5, 7)) - 1, day).getDay();
              const monthStart = i === 0 || day === 1;
              return (
                <div key={d.iso} className="min-w-0 flex-1 text-center leading-tight">
                  <span className={`block text-v2-caption tabular-nums ${dow === 0 ? "text-v2-text-3" : "font-semibold text-v2-text"}`}>{monthStart ? `${day}.${d.iso.slice(5, 7)}` : day}</span>
                  <span className="block text-v2-caption text-v2-text-3">{wd[dow]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Jadval ───────────────────────── */

function DayTable({ days, totals, t }: { days: NazoratAttDay[]; totals: number[]; t: TFn }) {
  const num = "px-3 py-2 text-right tabular-nums";
  return (
    <div className="max-h-[28rem] overflow-auto border-t border-v2-border">
      <table className="w-full min-w-[640px] border-collapse text-v2-body">
        <caption className="sr-only">{t("Kunlar bo'yicha")}</caption>
        <thead>
          <tr>
            <th scope="col" className={`${TH} pl-4 text-left`}>
              {t("Sana")}
            </th>
            {SERIES.map((s) => (
              <th key={s.status} scope="col" className={`${TH} text-right`}>
                <span className="inline-flex items-center gap-1.5">
                  <span className={`size-2 rounded-[2px] ${s.bar}`} aria-hidden />
                  {t(s.label)}
                </span>
              </th>
            ))}
            <th scope="col" className={`${TH} pr-4 text-right`}>
              {t("Jami")}
            </th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const sum = sumOf(d.vals);
            return (
              <tr key={d.iso} className={`border-b border-v2-border ${ROW_TINT.hover}`}>
                <td className="px-3 py-2 pl-4 tabular-nums text-v2-text">{d.label}</td>
                {d.vals.map((v, k) => (
                  <td key={SERIES[k].status} className={`${num} ${v ? "text-v2-text" : "text-v2-text-3"}`}>
                    {v}
                  </td>
                ))}
                <td className={`${num} pr-4 font-semibold ${sum ? "text-v2-text" : "text-v2-text-3"}`}>{sum}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-v2-surface-2 font-semibold">
            <td className="px-3 py-2.5 pl-4 text-v2-text">{t("Jami")}</td>
            {totals.map((v, k) => (
              <td key={SERIES[k].status} className="px-3 py-2.5 text-right tabular-nums text-v2-text">
                {fmtNum(v)}
              </td>
            ))}
            <td className="px-3 py-2.5 pr-4 text-right tabular-nums text-v2-text">{fmtNum(sumOf(totals))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
