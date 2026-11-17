"use client";

import { Building2, Check, CircleAlert, CircleCheck, Clock, Contrast, Gift, MapPin, Minus, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import type { CabinetGroup, CabinetLesson, CabinetMark, StudentCabinet } from "@/lib/studentCabinetTypes";
import {
  addDays,
  Bar,
  Card,
  CardHead,
  Empty,
  FanDot,
  fmtSom,
  initials,
  Pill,
  timeRange,
  weekdayOf,
  useCabinetFmt,
  type CabinetTabProps,
  type Tone,
} from "./bits";
import { NewsFeed, StoriesStrip } from "./CabinetFeed";

// ASOSIY TAB (28-qism, rasmlar 55–56) — kunning qisqa manzarasi: keyingi dars,
// shu hafta, guruhlar; o'ngda pul, davomat, tanga va so'nggi natija.
//
// Telefonda (bitta ustun) tartib MUHIMLIK bo'yicha: keyingi dars → qarz → hafta
// → davomat → tanga → natija → guruhlar. Kengida ikki ustun (rasmdagidek):
// `max-lg:contents` — ustun o'ramlari telefonda «yo'qoladi» va kartalar `order`
// bilan bitta oqimga tiziladi.
//
// Vaqt hisoblari FAQAT serverdagi `cab.today` / `cab.now` (Toshkent) bilan —
// telefon soati noto'g'ri bo'lsa ham «Bugun/Ertaga» adashmaydi.

const MARK: Record<CabinetMark, { label: string; tone: Tone }> = {
  keldi: { label: "Keldi", tone: "success" },
  kechikdi: { label: "Kechikdi", tone: "warning" },
  birinchi: { label: "Birinchi dars", tone: "success" },
  sababli: { label: "Sababli", tone: "warning" },
  sababsiz: { label: "Kelmadi", tone: "danger" },
};

const sameLesson = (a: CabinetLesson, b: CabinetLesson | null) =>
  !!b && a.date === b.date && a.groupId === b.groupId && a.start === b.start;

/** Dars holati yorlig'i: belgi bo'lsa — belgi; aks holda vaqtga qarab. */
function LessonPill({ l, cab }: { l: CabinetLesson; cab: StudentCabinet }) {
  const { t } = useT();
  if (l.mark) {
    const m = MARK[l.mark];
    return (
      <Pill tone={m.tone} dot>
        {t(m.label)}
      </Pill>
    );
  }
  const isToday = l.date === cab.today;
  const ended = l.date < cab.today || (isToday && !!l.end && l.end <= cab.now);
  if (ended) return <Pill tone="neutral">{t("Belgilanmagan")}</Pill>;
  if (isToday && l.start && l.start <= cab.now) return <Pill tone="brand" dot>{t("Hozir")}</Pill>;
  if (isToday) return <Pill tone="brand">{t("Bugun")}</Pill>;
  if (l.date === addDays(cab.today, 1)) return <Pill tone="brand">{t("Ertaga")}</Pill>;
  return null;
}

/** «Du, Chor, Ju 16:00–18:00» — dushanbadan tartiblangan. */
function useGroupSchedule() {
  const { weekdayShortOf } = useCabinetFmt();
  return (g: CabinetGroup): string => {
    const days = g.weekdays.length
      ? [...g.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(weekdayShortOf).join(", ")
      : g.day;
    return [days, timeRange(g.start, g.end)].filter(Boolean).join(" ");
  };
}

// ── Chap ustun ───────────────────────────────────────────────────────

function NextLessonCard({ cab, hasGroups }: { cab: StudentCabinet; hasGroups: boolean }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const up = cab.upcoming;
  const todays = cab.lessons.items.filter((l) => l.date === cab.today && !sameLesson(l, up));
  const when =
    up?.date === cab.today ? t("Bugun") : up?.date === addDays(cab.today, 1) ? t("Ertaga") : up ? fmt.dayMonth(up.date) : "";

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-v2-small font-medium text-v2-text-2">{t("Keyingi dars")}</h2>
        {up ? <Pill tone="brand">{when}</Pill> : null}
      </div>

      {up ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <FanDot course={up.course} className="size-2.5 rounded-[3px]" />
              <span className="truncate text-v2-section text-v2-text sm:text-[1.125rem]">{up.title}</span>
            </div>
            <p className="mt-1 text-v2-small text-v2-text-2">
              {`${fmt.weekdayFull(up.date)}, ${fmt.dayMonth(up.date)}`}
              {up.start ? (
                <>
                  {" · "}
                  <span className="font-semibold tabular-nums text-v2-text">{timeRange(up.start, up.end)}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 text-v2-small text-v2-text-2">
            {up.room ? (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-4 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                {up.room}
              </span>
            ) : null}
            {up.teacher ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-v2-full bg-v2-surface-2 text-[10px] font-semibold text-v2-text-2">
                  {initials(up.teacher)}
                </span>
                <span className="truncate">{up.teacher}</span>
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="py-2 text-v2-body text-v2-text-2">
          {hasGroups ? t("Yaqin uch hafta ichida jadvalda dars yo'q.") : t("Siz hali guruhga qo'shilmagansiz.")}
        </p>
      )}

      {todays.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-v2-border pt-3">
          {todays.map((l) => {
            const m = l.mark;
            const icon =
              m === "keldi" || m === "kechikdi" || m === "birinchi" ? (
                <span className="flex size-6 shrink-0 items-center justify-center rounded-v2-full bg-v2-success-bg text-v2-success">
                  <Check className="size-3.5" strokeWidth={2.25} aria-hidden />
                </span>
              ) : m === "sababli" ? (
                <span className="flex size-6 shrink-0 items-center justify-center rounded-v2-full bg-v2-warning-bg text-v2-warning">
                  <Minus className="size-3.5" strokeWidth={2.25} aria-hidden />
                </span>
              ) : m === "sababsiz" ? (
                <span className="flex size-6 shrink-0 items-center justify-center rounded-v2-full bg-v2-danger-bg text-v2-danger">
                  <X className="size-3.5" strokeWidth={2.25} aria-hidden />
                </span>
              ) : (
                <span className="flex size-6 shrink-0 items-center justify-center rounded-v2-full bg-v2-surface-2 text-v2-text-3">
                  <Clock className="size-3.5" strokeWidth={2} aria-hidden />
                </span>
              );
            return (
              <li key={`${l.groupId}-${l.start}`} className="flex items-center gap-2.5">
                {icon}
                <span className="min-w-0 flex-1 text-v2-small text-v2-text-2">
                  <span className="font-semibold text-v2-text">{`${t("Bugun")} · ${l.title}`}</span>
                  <span className="max-sm:block">
                    <span className="sm:inline max-sm:hidden">{" · "}</span>
                    {[timeRange(l.start, l.end), l.room].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <LessonPill l={l} cab={cab} />
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}

function WeekCard({ cab, go }: { cab: StudentCabinet; go: CabinetTabProps["go"] }) {
  const { t, lang } = useT();
  const fmt = useCabinetFmt();
  const start = addDays(cab.today, -((weekdayOf(cab.today) + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const end = days[6];
  const weekHasLessons = cab.lessons.items.some((l) => l.date >= start && l.date <= end);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const range =
    lang === "en"
      ? sameMonth
        ? `${fmt.dayMonth(start)}–${Number(end.slice(8))}`
        : `${fmt.dayMonth(start)} – ${fmt.dayMonth(end)}`
      : sameMonth
        ? `${Number(start.slice(8))}–${fmt.dayMonth(end)}`
        : `${fmt.dayMonth(start)} – ${fmt.dayMonth(end)}`;

  return (
    <Card>
      <CardHead title={t("Bu hafta")} sub={range} action={t("Darslar")} onAction={() => go("darslar")} />
      {/* Butun hafta bo'sh bo'lsa (guruhsiz o'quvchi) — yetti marta «Dars yo'q» o'rniga bitta gap. */}
      {!weekHasLessons ? (
        <Empty>{t("Bu hafta jadvalda dars yo'q.")}</Empty>
      ) : (
        <ul className="divide-y divide-v2-border">
          {days.map((d) => {
            const isToday = d === cab.today;
            const lessons = cab.lessons.items.filter((l) => l.date === d);
            return (
              <li key={d} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <span
                  className={`flex w-11 shrink-0 flex-col items-center justify-center rounded-v2-md py-1 ${
                    isToday ? "bg-v2-brand-bg text-v2-brand-text ring-1 ring-v2-brand/30" : "bg-v2-surface-2 text-v2-text"
                  }`}
                  aria-current={isToday ? "date" : undefined}
                >
                  <span className="text-v2-body font-semibold tabular-nums leading-tight">{Number(d.slice(8))}</span>
                  <span className={`text-[10px] font-medium leading-tight ${isToday ? "" : "text-v2-text-3"}`}>{fmt.weekdayShort(d)}</span>
                </span>
                {lessons.length === 0 ? (
                  <span className="text-v2-small text-v2-text-3">{t("Dars yo'q")}</span>
                ) : (
                  <div className="min-w-0 flex-1 space-y-2">
                    {lessons.map((l) => (
                      <div key={`${l.groupId}-${l.start}`} className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <FanDot course={l.course} />
                            <span className="truncate text-v2-small font-semibold text-v2-text">{l.title}</span>
                          </div>
                          <div className="mt-0.5 pl-4 text-v2-caption font-normal text-v2-text-3 sm:hidden">
                            {[timeRange(l.start, l.end), l.room].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <span className="hidden w-24 shrink-0 text-v2-small tabular-nums text-v2-text sm:block">{timeRange(l.start, l.end)}</span>
                        <span className="hidden w-20 shrink-0 truncate text-v2-small text-v2-text-2 sm:block">{l.room}</span>
                        <span className="flex w-[84px] shrink-0 justify-end"><LessonPill l={l} cab={cab} /></span>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function GroupsCard({ cab }: { cab: StudentCabinet }) {
  const { t } = useT();
  const schedule = useGroupSchedule();
  return (
    <Card>
      <CardHead title={t("Guruhlarim")} sub={cab.groups.length ? t("{n} ta", { n: cab.groups.length }) : undefined} />
      {cab.groups.length === 0 ? (
        <Empty>{t("Hozircha guruh yo'q.")}</Empty>
      ) : (
        <ul className="divide-y divide-v2-border">
          {cab.groups.map((g) => (
            <li key={g.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-full border border-v2-border bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2">
                {initials(g.teacher || g.title)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <FanDot course={g.course} />
                  <span className="truncate text-v2-small font-semibold text-v2-text">{g.title}</span>
                  {g.status === "gathering" ? <Pill tone="warning">{t("Yig'ilmoqda")}</Pill> : null}
                </div>
                <p className="mt-0.5 text-v2-caption font-normal text-v2-text-3">
                  {[g.teacher, g.room, schedule(g)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="shrink-0 text-right text-v2-small text-v2-text-2">
                {g.monthlyPrice != null ? (
                  <>
                    <span className="font-semibold tabular-nums text-v2-text">{fmtSom(g.monthlyPrice)}</span>
                    <span className="max-sm:block">{` ${t("so'm / oy")}`}</span>
                  </>
                ) : (
                  <span className="text-v2-text-3">{t("Narx yo'q")}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── O'ng ustun ───────────────────────────────────────────────────────

/** «+998 94 111 88 55» uchun tel: havolasi; raqam tanish shaklda bo'lmasa — null. */
function telHref(phone: string): string | null {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length === 9) return `tel:+998${d}`;
  if (d.length === 12 && d.startsWith("998")) return `tel:+${d}`;
  return null;
}

function PayPlace({ cab }: { cab: StudentCabinet }) {
  const { t } = useT();
  const b = cab.branch;
  if (!b.name && !b.address && !b.phone) return null;
  const href = telHref(b.phone);
  return (
    <div className="mt-3 flex gap-2.5 rounded-v2-md bg-v2-surface-2 p-3 text-v2-small text-v2-text-2">
      <MapPin className="mt-0.5 size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
      <p className="min-w-0">
        {t("To'lov filial kassasida qilinadi:")} {[b.name, b.address].filter(Boolean).join(", ")}
        {b.phone ? (
          <>
            {" · "}
            {href ? (
              <a href={href} className="whitespace-nowrap font-medium text-v2-brand-text hover:underline">
                {b.phone}
              </a>
            ) : (
              <span className="whitespace-nowrap">{b.phone}</span>
            )}
          </>
        ) : null}
      </p>
    </div>
  );
}

function DebtCard({ cab, go }: { cab: StudentCabinet; go: CabinetTabProps["go"] }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const d = cab.debt;
  const toPayments = { action: t("To'lovlar"), onAction: () => go("tolovlar") };
  const incompleteNote = d.incomplete ? (
    <p className="mt-3 text-v2-caption font-normal text-v2-text-3">
      {t("Ba'zi guruhlarda narx yoki jadval kiritilmagan — hisob to'liq emas. Aniq summani kassadan so'rang.")}
    </p>
  ) : null;

  if (d.total > 0) {
    const current = cab.months.current;
    const earliest = d.parts.reduce<string | null>((min, p) => (p.since && (!min || p.since < min) ? p.since : min), null);
    const span = earliest && earliest < current ? `${fmt.monthLower(earliest)}–${fmt.monthLower(current)}` : fmt.monthLower(current);
    return (
      <Card>
        <CardHead
          title={t("Qarz")}
          sub={span}
          icon={<CircleAlert className="size-4 shrink-0 text-v2-danger" strokeWidth={2} aria-hidden />}
          {...toPayments}
        />
        <div className="flex items-baseline gap-1.5 text-v2-danger">
          <span className="text-v2-number tabular-nums">{fmtSom(d.total)}</span>
          <span className="text-v2-body font-medium">{t("so'm")}</span>
        </div>
        {d.parts.length > 0 ? (
          <ul className="mt-3 space-y-2.5">
            {d.parts.map((p) => {
              const partial = p.remaining < p.charged;
              const months =
                p.since && p.since < current ? `${fmt.monthLower(p.since)}–${fmt.monthLower(current)}` : fmt.monthLower(p.since ?? current);
              return (
                <li key={p.groupId} className="flex items-center gap-2.5">
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-v2-full ${
                      partial ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-danger-bg text-v2-danger"
                    }`}
                  >
                    {partial ? (
                      <Contrast className="size-3.5" strokeWidth={2} aria-hidden />
                    ) : (
                      <CircleAlert className="size-3.5" strokeWidth={2} aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-v2-small font-semibold text-v2-text">{p.title}</span>
                    <span className="block truncate text-v2-caption font-normal text-v2-text-3">
                      {partial ? `${t("{sum} dan qoldi", { sum: fmtSom(p.charged) })} · ${months}` : months}
                    </span>
                  </span>
                  <span className="shrink-0 text-v2-small font-semibold tabular-nums text-v2-text">{fmtSom(p.remaining)}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
        <PayPlace cab={cab} />
        {incompleteNote}
      </Card>
    );
  }

  if (d.advance > 0) {
    return (
      <Card>
        <CardHead
          title={t("Oldindan to'langan")}
          icon={<CircleCheck className="size-4 shrink-0 text-v2-success" strokeWidth={2} aria-hidden />}
          {...toPayments}
        />
        <div className="flex items-baseline gap-1.5 text-v2-success">
          <span className="text-v2-number tabular-nums">{fmtSom(d.advance)}</span>
          <span className="text-v2-body font-medium">{t("so'm")}</span>
        </div>
        <p className="mt-2 text-v2-small text-v2-text-2">{t("Qarz yo'q. Keyingi darslar shu summadan yopiladi.")}</p>
        {incompleteNote}
      </Card>
    );
  }

  return (
    <Card>
      <CardHead title={t("Qarz")} icon={<CircleCheck className="size-4 shrink-0 text-v2-success" strokeWidth={2} aria-hidden />} {...toPayments} />
      <p className="text-v2-section text-v2-success">{t("Qarz yo'q")}</p>
      <p className="mt-1 text-v2-small text-v2-text-2">{t("{date} holatiga hisob", { date: fmt.dayMonth(d.asOf) })}</p>
      {incompleteNote}
    </Card>
  );
}

function AttendanceCard({ cab, go }: { cab: StudentCabinet; go: CabinetTabProps["go"] }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const a = cab.attendance;
  const tone = a.percent == null ? "brand" : a.percent >= 90 ? "success" : a.percent >= 75 ? "warning" : "danger";
  return (
    <Card>
      <CardHead title={t("Davomat")} sub={fmt.monthLower(a.month)} action={t("Davomat")} onAction={() => go("darslar")} />
      {a.percent == null ? (
        <p className="text-v2-small text-v2-text-3">{t("Bu oyda davomat hali belgilanmagan.")}</p>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-v2-number tabular-nums text-v2-text">{`${a.percent}%`}</span>
            <span className="text-v2-small tabular-nums text-v2-text-2">{t("{came} / {total} dars", { came: a.came, total: a.total })}</span>
          </div>
          <div className="mt-2">
            <Bar value={a.percent} tone={tone} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-v2-small text-v2-text-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="flex size-4 items-center justify-center rounded-v2-full bg-v2-success-bg text-v2-success">
                <Check className="size-2.5" strokeWidth={3} aria-hidden />
              </span>
              <b className="font-semibold tabular-nums text-v2-text">{a.came}</b> {t("keldi")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="flex size-4 items-center justify-center rounded-v2-full bg-v2-warning-bg text-v2-warning">
                <Minus className="size-2.5" strokeWidth={3} aria-hidden />
              </span>
              <b className="font-semibold tabular-nums text-v2-text">{a.excused}</b> {t("sababli")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="flex size-4 items-center justify-center rounded-v2-full bg-v2-danger-bg text-v2-danger">
                <X className="size-2.5" strokeWidth={3} aria-hidden />
              </span>
              <b className="font-semibold tabular-nums text-v2-text">{a.missed}</b> {t("kelmadi")}
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

function CoinsCard({ cab, go }: { cab: StudentCabinet; go: CabinetTabProps["go"] }) {
  const { t } = useT();
  const c = cab.coins;
  if (!c) return null;
  return (
    <Card>
      <CardHead title={t("Tanga")} action={t("Do'kon")} onAction={() => go("tanga")} />
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <span className="text-v2-number tabular-nums text-v2-text">{fmtSom(c.balance)}</span>
        <span className="text-v2-small text-v2-text-2">{t("tanga")}</span>
        {c.monthEarned > 0 ? (
          <span className="text-v2-small text-v2-text-2">
            {"· "}
            {t("bu oy")} <b className="font-semibold tabular-nums text-v2-success">{`+${fmtSom(c.monthEarned)}`}</b>
          </span>
        ) : null}
      </div>
      {c.bestRank ? (
        <p className="mt-0.5 truncate text-v2-small text-v2-text-2">
          <b className="font-semibold text-v2-text">{t("{rank}-o'rin", { rank: c.bestRank.rank })}</b>
          {` · ${c.bestRank.title} · ${t("{n} kishidan", { n: c.bestRank.total })}`}
        </p>
      ) : null}
      {c.wish ? (
        <div className="mt-3 flex items-center gap-3 border-t border-v2-border pt-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand-bg text-v2-brand-text">
            <Gift className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-v2-small font-semibold text-v2-text">{c.wish.title}</span>
            <span className="block truncate text-v2-caption font-normal text-v2-text-3">
              {t("Istak · {price} tanga", { price: fmtSom(c.wish.price) })}
            </span>
          </span>
          {c.wish.ready ? (
            <Pill tone="success">{t("Tanga yetadi")}</Pill>
          ) : (
            <Pill tone="neutral">{t("Yana {n} tanga", { n: fmtSom(Math.max(0, c.wish.price - c.balance)) })}</Pill>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function ResultCard({ cab, go }: { cab: StudentCabinet; go: CabinetTabProps["go"] }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const r = cab.results[0];
  if (!r) return null;
  return (
    <Card>
      <CardHead title={t("So'nggi natija")} sub={t("Sarhisob")} action={t("Natijalar")} onAction={() => go("natijalar")} />
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <FanDot course={r.course} />
            <span className="truncate text-v2-small font-semibold text-v2-text">{r.title}</span>
          </div>
          <p className="mt-0.5 text-v2-caption font-normal text-v2-text-3">
            {[
              fmt.dayMonth(r.date),
              t("{correct} / {total} to'g'ri", { correct: r.correct, total: r.total }),
              t("guruhda {avg}%", { avg: r.groupAvg }),
              r.rank ? t("{rank}-o'rin", { rank: r.rank }) : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span className="shrink-0 text-v2-number tabular-nums text-v2-text">{`${r.pct}%`}</span>
      </div>
      <div className="mt-2.5">
        <Bar value={r.pct} tone="brand" />
      </div>
    </Card>
  );
}

// ── Tab ──────────────────────────────────────────────────────────────

export default function AsosiyTab({ me, cab, go, initData }: CabinetTabProps) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const parent = me.profile.role === "parent";
  const name = cab.firstName || me.profile.fullName.split(/\s+/)[0] || "";
  const branch = cab.branch.name || me.profile.branch;
  const sub = [
    `${fmt.weekdayFull(cab.today)}, ${fmt.dayMonth(cab.today)}`,
    branch,
    cab.groups.length ? t("{n} guruh", { n: cab.groups.length }) : "",
  ].filter(Boolean);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-v2-page text-v2-text">{parent ? me.profile.fullName : t("Salom, {name}!", { name })}</h1>
        <p className="mt-0.5 text-v2-small text-v2-text-2">
          {parent ? `${t("Farzandingiz kabineti")} · ` : ""}
          {sub.join(" · ")}
        </p>
      </div>

      <StoriesStrip items={me.feed?.stories ?? []} initData={initData} />

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-4 max-lg:contents">
          <div className="max-lg:order-1">
            <NextLessonCard cab={cab} hasGroups={cab.groups.length > 0} />
          </div>
          <div className="max-lg:order-3">
            <WeekCard cab={cab} go={go} />
          </div>
          <div className="max-lg:order-7">
            <GroupsCard cab={cab} />
          </div>
          {me.feed?.news.length ? (
            <div className="max-lg:order-8">
              <NewsFeed items={me.feed.news} initData={initData} today={cab.today} />
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-4 max-lg:contents">
          <div className="max-lg:order-2">
            <DebtCard cab={cab} go={go} />
          </div>
          <div className="max-lg:order-4">
            <AttendanceCard cab={cab} go={go} />
          </div>
          {cab.coins ? (
            <div className="max-lg:order-5">
              <CoinsCard cab={cab} go={go} />
            </div>
          ) : null}
          {cab.results.length > 0 ? (
            <div className="max-lg:order-6">
              <ResultCard cab={cab} go={go} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
