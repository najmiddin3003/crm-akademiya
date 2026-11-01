"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Search, SearchX } from "lucide-react";
import { useT } from "@/components/shared/Language";
import V2Select from "@/components/v2/ui/V2Select";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { ScoreBar } from "@/components/v2/imtihon/examBits";
import { Podium, RankBadge, RankKpis } from "@/components/v2/imtihon/rankingBits";
import { examGroupTitle, matchesQuery, podiumOf, rankRowOfPublic, type PublicCenterRanking as Data, type RankRow } from "@/lib/examRanking";
import { EmptyCard, Pct } from "./publicBits";

// OCHIQ MARKAZ REYTINGI (01.11.2026, foydalanuvchi: «reytingni ulashish ishlasin, markaz bo'yicha
// reytingni ulashish») — /natijalar/markaz/<kalit> sahifasining tanasi (sarlavha, til va mavzu —
// PublicResultsPage). CRM'dagi Imtihon → Sarhisob → «Markaz reytingi» bilan bir xil qoida va
// ko'rinish (lib/examRanking.ts, components/v2/imtihon/rankingBits.tsx): to'rt ko'rsatkich,
// 1–3-o'rinlar, jadval. Uchlikdagi ismlar bosilmaydi.
//
// FAQAT BELGILANGAN QISMLAR («galochka qo'yilgan qismlar chiqishi kerak holos»): `data.show` —
// havoladagi imzolangan tanlov (lib/centerShare.ts). Yashirilgan ustun, ko'rsatkichlar, uchlik
// yoki jadval chizilmaydi — ma'lumoti serverdan kelmaydi ham (lib/examRanking.ts →
// publicCenterView). O'rin, ism va natija doim bor; telefon — hech qachon.
//
// Oy va fan — SERVERDA: tanlansa `?oy=` / `?fan=` bilan sahifa qayta chiziladi (havolani shu
// holicha ulashsa o'sha oy va fan ochiladi). Ism bo'yicha qidiruv — shu yerda, o'rinni
// o'zgartirmaydi. Jadval 100 qatordan, «Yana ko'rsatish» bilan (telefonda 1 000 qator og'ir).

const STEP = 100;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

/** Tor ekranda ustun yashirinadi va qiymati ism ostiga tushadi: fan — sm, guruh — md, ustoz — lg gacha. */
const HIDE_AT = { sm: "sm:hidden", md: "md:hidden", lg: "lg:hidden" } as const;
type Bp = keyof typeof HIDE_AT;

export default function PublicCenterRanking({ data }: { data: Data }) {
  const { t, months } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const { show } = data;

  // Qatorlar serverda o'rin tartibida (tanlangan fan ichida); jadval yashirin bo'lsa — faqat uchlik.
  const ranked = useMemo(() => data.rows.map(rankRowOfPublic), [data.rows]);
  const podium = useMemo(() => (show.podium ? podiumOf(ranked) : []), [ranked, show.podium]);
  const q = show.table ? query.trim() : "";
  const visible = useMemo(() => (q ? ranked.filter((r) => matchesQuery(r, q)) : ranked), [ranked, q]);

  // Ko'rsatilgan qatorlar soni — oy, fan yoki qidiruv almashsa boshidan (effektsiz: kalit bilan).
  const resetKey = [data.month, data.course, q].join("\u0001");
  const [shownState, setShownState] = useState({ key: resetKey, n: STEP });
  const shown = shownState.key === resetKey ? shownState.n : STEP;
  const rows = visible.slice(0, shown);

  const monthLabel = (m: string) => {
    const x = MONTH_RE.exec(m);
    return x ? `${months[Number(x[2]) - 1]} ${x[1]}` : m;
  };
  const courseOptions = data.courses.map((c) => ({ value: c.name, label: c.name, hint: String(c.n) }));

  /** Guruh ustuni — guruh va/yoki bosqich (ikkalasi ham yashirin bo'lsa ustun yo'q). */
  const groupCol = show.group || show.level;
  const groupText = (r: RankRow) => [examGroupTitle(r, t), r.level ? t(r.level) : ""].filter(Boolean).join(" · ");

  /** Oy yoki fan serverdan keladi — manzil yangilanib sahifa qayta chiziladi (qolgan parametrlar saqlanadi). */
  function go(change: { oy?: string; fan?: string }) {
    const url = new URL(window.location.href);
    if (change.oy !== undefined) url.searchParams.set("oy", change.oy);
    if (change.fan !== undefined) {
      if (change.fan) url.searchParams.set("fan", change.fan);
      else url.searchParams.delete("fan");
    }
    startTransition(() => router.replace(`${url.pathname}${url.search}`, { scroll: false }));
  }

  const toolbar = (data.months.length > 1 ? 1 : 0) + (courseOptions.length > 1 ? 1 : 0) + (show.table ? 1 : 0) > 0;

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
          {toolbar && (
            <div className="flex flex-wrap items-center gap-2">
              {data.months.length > 1 && (
                <V2Select
                  variant="value"
                  label={t("Oy")}
                  value={data.month}
                  onChange={(m) => m && m !== data.month && go({ oy: m })}
                  options={data.months.map((m) => ({ value: m, label: monthLabel(m) }))}
                  searchable={false}
                  clearable={false}
                />
              )}
              {courseOptions.length > 1 && (
                <V2Select variant="chip" label={t("Fan")} value={data.course} onChange={(c) => c !== data.course && go({ fan: c })} options={courseOptions} />
              )}
              {show.table && (
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
              )}
            </div>
          )}

          {/* Oy yoki fan almashayotganda (serverdan) — eski natija xira turadi. */}
          <div aria-busy={pending} className={`flex flex-col gap-4 transition-opacity ${pending ? "opacity-60" : ""}`}>
            {/* Jadval yo'q bo'lsa oy nomi uning sarlavhasida ham yo'q — shu yerda. */}
            {!show.table && <h2 className="text-v2-section text-v2-text">{t("{month} natijalari", { month: monthLabel(data.month) })}</h2>}
            {show.kpis && data.stats && <RankKpis stats={data.stats} />}
            {podium.length > 0 && <Podium places={podium} showCorrect={show.correct} />}
            {!show.table && podium.length === 0 && (
              <EmptyCard icon={<ClipboardList className="size-5" strokeWidth={1.75} aria-hidden />} title={t("Hozircha natijalar yo'q")} text={t("Imtihon natijalari kiritilgach shu yerda ko'rinadi.")} />
            )}

            {show.table && (
              <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3">
                  <h2 className="text-v2-section text-v2-text">{t("{month} natijalari", { month: monthLabel(data.month) })}</h2>
                  <p className="text-v2-small text-v2-text-2">
                    {t("{n} natija", { n: ranked.length })} · {t("foiz bo'yicha, teng natija — teng o'rin")}
                  </p>
                </div>
                {visible.length === 0 ? (
                  <div className="border-t border-v2-border p-4">
                    {q ? (
                      <EmptyCard icon={<SearchX className="size-5" strokeWidth={1.75} aria-hidden />} title={t("Hech narsa topilmadi")} text={t("Ism to'g'ri yozilganini tekshiring.")}>
                        <button type="button" onClick={() => setQuery("")} className={`${secondaryBtn} mt-2`}>
                          {t("Qidiruvni tozalash")}
                        </button>
                      </EmptyCard>
                    ) : (
                      <EmptyCard icon={<ClipboardList className="size-5" strokeWidth={1.75} aria-hidden />} title={t("Hozircha natijalar yo'q")} text={t("Imtihon natijalari kiritilgach shu yerda ko'rinadi.")} />
                    )}
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
                          {show.course && (
                            <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">
                              {t("Fan")}
                            </th>
                          )}
                          {groupCol && (
                            <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">
                              {show.group ? t("Guruh") : t("Bosqich")}
                            </th>
                          )}
                          {show.teacher && (
                            <th scope="col" className="hidden px-3 py-2.5 font-medium lg:table-cell">
                              {t("Ustoz")}
                            </th>
                          )}
                          {show.correct && (
                            <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">
                              {t("To'g'ri javob")}
                            </th>
                          )}
                          <th scope="col" className="px-3 py-2.5 text-right font-medium">
                            {t("Natija")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => {
                          // Tor ekranda yashiringan ustunlar qiymati — ism ostida (bo'lagi o'z ustuni
                          // ko'ringan kenglikda yashirinadi; ajratuvchi oldingi bo'lak bilan birga).
                          const meta: { bp: Bp; text: string }[] = [];
                          if (show.course && r.course) meta.push({ bp: "sm", text: r.course });
                          const g = groupCol ? groupText(r) : "";
                          if (g) meta.push({ bp: "md", text: g });
                          if (show.teacher && r.teacher) meta.push({ bp: "lg", text: t("Ustoz: {teacher}", { teacher: r.teacher }) });
                          return (
                            <tr key={r.key} className="border-t border-v2-border">
                              <td className="px-3 py-2.5 text-center">
                                <RankBadge rank={r.rank} pct={r.pct} />
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="text-v2-small font-semibold text-v2-text">{r.name}</div>
                                {meta.length > 0 && (
                                  <div className={`mt-0.5 text-v2-caption text-v2-text-2 ${HIDE_AT[meta[meta.length - 1].bp]}`}>
                                    {meta.map((m, i) => (
                                      <span key={m.bp} className={HIDE_AT[m.bp]}>
                                        {i > 0 && <span className={HIDE_AT[meta[i - 1].bp]}> · </span>}
                                        {m.text}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              {show.course && <td className="hidden whitespace-nowrap px-3 py-2.5 text-v2-small text-v2-text sm:table-cell">{r.course}</td>}
                              {groupCol && (
                                <td className="hidden px-3 py-2.5 text-v2-small md:table-cell">
                                  {show.group && <span className="text-v2-text">{examGroupTitle(r, t)}</span>}
                                  {r.level ? (
                                    <span className={show.group ? "text-v2-text-3" : "text-v2-text"}>
                                      {show.group ? " · " : ""}
                                      {t(r.level)}
                                    </span>
                                  ) : null}
                                </td>
                              )}
                              {show.teacher && <td className="hidden px-3 py-2.5 text-v2-small text-v2-text lg:table-cell">{r.teacher}</td>}
                              {show.correct && (
                                <td className="hidden whitespace-nowrap px-3 py-2.5 text-right text-v2-small tabular-nums text-v2-text sm:table-cell">
                                  {r.correct} / {r.total}
                                </td>
                              )}
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
            )}
          </div>
        </>
      )}
    </>
  );
}
