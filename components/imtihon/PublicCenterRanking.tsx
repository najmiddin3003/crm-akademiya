"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Search, SearchX } from "lucide-react";
import { useT } from "@/components/shared/Language";
import V2Select from "@/components/v2/ui/V2Select";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { ScoreBar } from "@/components/v2/imtihon/examBits";
import { Podium, RankBadge, RankKpis } from "@/components/v2/imtihon/rankingBits";
import { examGroupTitle, matchesQuery, podiumOf, rankRowOfPublic, rankRows, rankStats, type PublicCenterRanking as Data } from "@/lib/examRanking";
import { EmptyCard, Pct } from "./publicBits";

// OCHIQ MARKAZ REYTINGI (01.11.2026, foydalanuvchi: «reytingni ulashish ishlasin, markaz bo'yicha
// reytingni ulashish») — /natijalar/markaz/<kalit> sahifasining tanasi (sarlavha, til va mavzu —
// PublicResultsPage). CRM'dagi Imtihon → Sarhisob → «Markaz reytingi» bilan bir xil qoida va
// ko'rinish (lib/examRanking.ts, components/v2/imtihon/rankingBits.tsx): to'rt ko'rsatkich,
// 1–3-o'rinlar, jadval. O'quvchi va ota-ona uchun: oy, fan va ism bo'yicha qidiruv; fan tanlansa
// o'rin shu fan ichida qayta hisoblanadi, qidiruv o'rinni o'zgartirmaydi. Telefon va ustoz
// ko'rsatilmaydi (serverdan kelmaydi). Uchlikdagi ismlar bosilmaydi.
//
// Oy — serverda (bitta oy yuklanadi): tanlansa `?oy=` bilan sahifa yangilanadi. Fan — shu yerda,
// manzildagi `?fan=` ham yangilanadi (havolani shu holicha ulashsa o'sha fan ochiladi).
// Jadval 100 qatordan, «Yana ko'rsatish» bilan (telefonda 1 000 qatorlik jadval og'ir).

const STEP = 100;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

export default function PublicCenterRanking({ data, initialCourse }: { data: Data; initialCourse: string }) {
  const { t, months } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [course, setCourse] = useState(initialCourse);
  const [query, setQuery] = useState("");

  const all = useMemo(() => data.rows.map(rankRowOfPublic), [data.rows]);
  const courseCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of all) m.set(r.course, (m.get(r.course) ?? 0) + 1);
    return m;
  }, [all]);
  // Tanlangan fan (yoki havoladagi `?fan=`) bu oyda bo'lmasa — barcha fanlar.
  const activeCourse = course && courseCounts.has(course) ? course : "";
  const ranked = useMemo(() => rankRows(activeCourse ? all.filter((r) => r.course === activeCourse) : all), [all, activeCourse]);
  const podium = useMemo(() => podiumOf(ranked), [ranked]);
  const stats = useMemo(() => rankStats(ranked), [ranked]);
  const q = query.trim();
  const visible = useMemo(() => (q ? ranked.filter((r) => matchesQuery(r, q)) : ranked), [ranked, q]);

  // Ko'rsatilgan qatorlar soni — oy, fan yoki qidiruv almashsa boshidan (effektsiz: kalit bilan).
  const resetKey = [data.month, activeCourse, q].join("\u0001");
  const [shownState, setShownState] = useState({ key: resetKey, n: STEP });
  const shown = shownState.key === resetKey ? shownState.n : STEP;
  const rows = visible.slice(0, shown);

  const monthLabel = (m: string) => {
    const x = MONTH_RE.exec(m);
    return x ? `${months[Number(x[2]) - 1]} ${x[1]}` : m;
  };
  const courseOptions = [...courseCounts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, n]) => ({ value, label: value, hint: String(n) }));

  function urlWith(month: string | null, c: string): URL {
    const url = new URL(window.location.href);
    if (month) url.searchParams.set("oy", month);
    else url.searchParams.delete("oy");
    if (c) url.searchParams.set("fan", c);
    else url.searchParams.delete("fan");
    return url;
  }

  /** Oy serverdan keladi — sahifa yangi `?oy=` bilan qayta chiziladi (fan va qidiruv saqlanadi). */
  function pickMonth(m: string) {
    if (!m || m === data.month) return;
    const url = urlWith(m, activeCourse);
    startTransition(() => router.replace(`${url.pathname}${url.search}`, { scroll: false }));
  }

  function pickCourse(c: string) {
    setCourse(c);
    window.history.replaceState(window.history.state, "", urlWith(data.month, c));
  }

  return (
    <>
      <header>
        <h1 className="text-v2-page text-v2-text">{t("Markaz reytingi")}</h1>
        {data.branchName && <p className="mt-1 text-v2-body text-v2-text-2">{data.branchName}</p>}
      </header>

      {!data.month ? (
        <EmptyCard icon={<ClipboardList className="size-5" strokeWidth={1.75} aria-hidden />} title={t("Hozircha natijalar yo'q")} text={t("Imtihon natijalari kiritilgach shu yerda ko'rinadi.")} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {data.months.length > 1 && (
              <V2Select
                variant="value"
                label={t("Oy")}
                value={data.month}
                onChange={pickMonth}
                options={data.months.map((m) => ({ value: m, label: monthLabel(m) }))}
                searchable={false}
                clearable={false}
              />
            )}
            {courseOptions.length > 1 && <V2Select variant="chip" label={t("Fan")} value={activeCourse} onChange={pickCourse} options={courseOptions} />}
            <div className="relative w-full sm:ml-auto sm:w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Ism bo'yicha qidirish")}
                aria-label={t("O'quvchini qidirish")}
                className="h-9 w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
              />
            </div>
          </div>

          {/* Oy almashayotganda (serverdan) — eski natija xira turadi. */}
          <div aria-busy={pending} className={`flex flex-col gap-4 transition-opacity ${pending ? "opacity-60" : ""}`}>
            <RankKpis stats={stats} />
            {podium.length > 0 && <Podium places={podium} />}

            <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3">
                <h2 className="text-v2-section text-v2-text">{t("{month} natijalari", { month: monthLabel(data.month) })}</h2>
                <p className="text-v2-small text-v2-text-2">
                  {t("{n} natija", { n: ranked.length })} · {t("foiz bo'yicha, teng natija — teng o'rin")}
                </p>
              </div>
              {visible.length === 0 ? (
                <div className="border-t border-v2-border p-4">
                  <EmptyCard icon={<SearchX className="size-5" strokeWidth={1.75} aria-hidden />} title={t("Hech narsa topilmadi")} text={t("Ism to'g'ri yozilganini tekshiring.")}>
                    <button type="button" onClick={() => setQuery("")} className={`${secondaryBtn} mt-2`}>
                      {t("Qidiruvni tozalash")}
                    </button>
                  </EmptyCard>
                </div>
              ) : (
                <>
                  <table className="w-full border-collapse text-left">
                    <caption className="sr-only">{t("O'quvchilar natijasi")}</caption>
                    <thead className="bg-v2-surface-2 text-v2-caption font-medium text-v2-text-2">
                      <tr>
                        <th scope="col" className="w-14 px-3 py-2.5 text-center font-medium">
                          {t("O'rin")}
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-medium">
                          {t("O'quvchi")}
                        </th>
                        <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">
                          {t("Fan")}
                        </th>
                        <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">
                          {t("Guruh")}
                        </th>
                        <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">
                          {t("To'g'ri javob")}
                        </th>
                        <th scope="col" className="px-3 py-2.5 text-right font-medium">
                          {t("Natija")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const group = examGroupTitle(r, t);
                        return (
                          <tr key={r.key} className="border-t border-v2-border">
                            <td className="px-3 py-2.5 text-center">
                              <RankBadge rank={r.rank} pct={r.pct} />
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="text-v2-small font-semibold text-v2-text">{r.name}</div>
                              {/* Tor ekranda ustunlar yashirin — fan va guruh ism ostida. */}
                              <div className="mt-0.5 text-v2-caption text-v2-text-2 md:hidden">
                                <span className="sm:hidden">{r.course} · </span>
                                {group}
                              </div>
                            </td>
                            <td className="hidden whitespace-nowrap px-3 py-2.5 text-v2-small text-v2-text sm:table-cell">{r.course}</td>
                            <td className="hidden px-3 py-2.5 text-v2-small md:table-cell">
                              <span className="text-v2-text">{group}</span>
                              {r.level ? <span className="text-v2-text-3"> · {t(r.level)}</span> : null}
                            </td>
                            <td className="hidden whitespace-nowrap px-3 py-2.5 text-right text-v2-small tabular-nums text-v2-text sm:table-cell">
                              {r.correct} / {r.total}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-end gap-2.5">
                                <ScoreBar pct={r.pct} className="hidden w-20 sm:block" />
                                <Pct pct={r.pct} className="w-10 text-right text-v2-small" />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {visible.length > rows.length && (
                    <div className="border-t border-v2-border p-3 text-center">
                      <button type="button" onClick={() => setShownState({ key: resetKey, n: shown + STEP })} className={secondaryBtn}>
                        {t("Yana ko'rsatish ({n} ta qoldi)", { n: visible.length - rows.length })}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
