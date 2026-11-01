"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, GraduationCap, Link2, Moon, RotateCw, SearchX, Sun } from "lucide-react";
import { useLang, useT } from "@/components/shared/Language";
import { useTheme } from "@/components/shared/Theme";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { ScoreBar } from "@/components/v2/imtihon/examBits";
import { CENTER_LOGO, CENTER_NAME } from "@/lib/center";
import { LANGS, type Lang } from "@/lib/i18n";
import { LANGS as LANG_LABELS } from "@/lib/navbar";
import type { PublicExam, PublicExamStudent, PublicGroupResults } from "@/lib/imtihon";
import type { PublicCenterRanking as CenterData } from "@/lib/examRanking";
import PublicCenterRanking from "./PublicCenterRanking";
import { EmptyCard, Pct } from "./publicBits";

// OCHIQ IMTIHON NATIJALARI — BITTA GURUH (01.11.2026). Kirishsiz sahifa: o'quvchi guruhi
// uchun yuborilgan havolani (/natijalar/<kalit>, Sarhisob'dagi «Havolani nusxalash») ochib
// guruh natijalarini JADVALDA ko'radi — o'rin, ism, telefon (faqat oxirgi 4 raqam, serverda
// yashirilgan — lib/imtihon.ts → maskPhoneTail), to'g'ri javoblar va foiz. Tepada — fan, guruh,
// oy tanlovi (guruhda bir necha oy bo'lsa) va sana, ustoz, savollar soni, guruh o'rtachasi.
// Boshqa guruhlar ko'rinmaydi (foydalanuvchi: «har bir guruh alohida chiqsin»).
//
// Oy almashsa — shu yerda (hamma oylar birdan yuklangan), manzildagi `?oy=` ham yangilanadi
// (havolani shu holicha ulashsa bo'ladi). Telefon uchun (Telegram'dan ochiladi): jadval
// tor ekranga sig'adi — telefon ism ostida, ustun keng ekranda.
//
// `view`: "results" — guruh; "center" — markaz reytingi (/natijalar/markaz/<kalit>, 01.11.2026 —
// PublicCenterRanking); "nolink" — kalitsiz /natijalar (avvalgi umumiy havola ham shu yerga
// tushadi); "badlink" — imzo mos emas yoki guruh/filial yo'q (`kind` — qaysi havola); "error" —
// baza yiqildi.

const MONTH_RE = /^(\d{4})-(\d{2})$/;

type LinkKind = "group" | "center";

type Props =
  | { view: "results"; data: PublicGroupResults; month: string | null }
  | { view: "center"; data: CenterData }
  | { view: "badlink"; kind?: LinkKind }
  | { view: "nolink" | "error" };

function dateOfIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** O'rin — teng natija teng o'rin: 90, 85, 85, 70 → 1, 2, 2, 4. */
function ranksOf(students: PublicExamStudent[]): number[] {
  return students.map((s) => 1 + students.filter((x) => x.pct > s.pct).length);
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-v2-full text-v2-caption font-semibold tabular-nums ${
        rank <= 3 ? "bg-v2-brand-bg text-v2-brand-text" : "bg-v2-surface-2 text-v2-text-2"
      }`}
    >
      {rank}
    </span>
  );
}

/** Logotip, til va mavzu. */
function TopBar() {
  const { t } = useT();
  const [lang, setLang] = useLang();
  const [isDark, toggleTheme] = useTheme();
  return (
    <div className="flex items-center justify-between gap-3">
      {/* Logotip /sorovnoma'dagi — OQ, rangli fon uchun chizilgan: v2 «logotip» plashkasida. */}
      {CENTER_LOGO ? (
        <span className="inline-flex h-9 shrink-0 items-center rounded-v2-md bg-v2-logo px-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- statik logotip, o'lchami klassda */}
          <img src={CENTER_LOGO} alt={t(CENTER_NAME)} width={382} height={95} className="h-6 w-auto" />
        </span>
      ) : (
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-logo text-white">
            <GraduationCap className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="truncate text-v2-section text-v2-text">{t(CENTER_NAME)}</span>
        </span>
      )}
      <div className="flex shrink-0 items-center gap-2">
        <div role="group" aria-label={t("Til")} className="flex h-9 items-center gap-0.5 rounded-v2-md border border-v2-border-strong bg-v2-surface p-0.5">
          {LANGS.map((code: Lang) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              aria-pressed={lang === code}
              className={`h-full rounded-v2-sm px-2.5 text-v2-small font-semibold transition-colors focus-visible:shadow-v2-focus focus-visible:outline-none ${
                lang === code ? "bg-v2-brand-bg text-v2-brand-text" : "text-v2-text-2 hover:text-v2-text"
              }`}
            >
              {LANG_LABELS[code].short}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? t("Kunduzgi rejim") : t("Tungi rejim")}
          title={isDark ? t("Kunduzgi rejim") : t("Tungi rejim")}
          className={secondaryIcon}
        >
          {isDark ? <Sun className="size-4" strokeWidth={1.75} aria-hidden /> : <Moon className="size-4" strokeWidth={1.75} aria-hidden />}
        </button>
      </div>
    </div>
  );
}

export default function PublicResultsPage(props: Props) {
  return (
    <div data-ui="v2" className="min-h-dvh bg-v2-bg font-v2 text-v2-text">
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4 px-4 pb-10 pt-4 sm:px-6 sm:pt-6">
        <TopBar />
        {props.view === "results" ? (
          <GroupResults data={props.data} initialMonth={props.month} />
        ) : props.view === "center" ? (
          <PublicCenterRanking data={props.data} />
        ) : (
          <Notice view={props.view} kind={props.view === "badlink" ? props.kind : undefined} />
        )}
      </div>
    </div>
  );
}

/** Natija ko'rinmaydigan holatlar: kalitsiz manzil, noto'g'ri havola, baza yiqildi. */
function Notice({ view, kind = "group" }: { view: "nolink" | "badlink" | "error"; kind?: LinkKind }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <>
      <h1 className="text-v2-page text-v2-text">{kind === "center" ? t("Markaz reytingi") : t("Imtihon natijalari")}</h1>
      {view === "error" ? (
        <EmptyCard icon={<RotateCw className="size-5" strokeWidth={1.75} aria-hidden />} title={t("Natijalarni yuklab bo'lmadi")} text={t("Internet aloqasini tekshirib, qayta urinib ko'ring.")}>
          <button type="button" onClick={() => startTransition(() => router.refresh())} disabled={pending} className={`${primaryBtn} mt-2 disabled:opacity-60`}>
            {t("Qayta urinish")}
          </button>
        </EmptyCard>
      ) : view === "badlink" ? (
        <EmptyCard
          icon={<SearchX className="size-5" strokeWidth={1.75} aria-hidden />}
          title={t("Havola topilmadi")}
          text={
            kind === "center"
              ? t("Havola noto'g'ri yoki eskirgan. Administratordan reyting havolasini qayta so'rang.")
              : t("Havola noto'g'ri yoki eskirgan. O'qituvchingizdan guruh havolasini qayta so'rang.")
          }
        />
      ) : (
        <EmptyCard
          icon={<Link2 className="size-5" strokeWidth={1.75} aria-hidden />}
          title={t("Guruh havolasini oching")}
          text={t("Natijalar har bir guruh uchun alohida havola bilan ochiladi — uni o'qituvchingiz yoki administrator yuboradi.")}
        />
      )}
    </>
  );
}

function GroupResults({ data, initialMonth }: { data: PublicGroupResults; initialMonth: string | null }) {
  const { t, months } = useT();
  const [month, setMonth] = useState(initialMonth);

  const monthLabel = (m: string) => {
    const x = MONTH_RE.exec(m);
    return x ? `${months[Number(x[2]) - 1]} ${x[1]}` : m;
  };
  // Sarhisoblar serverda yangisi birinchi tartiblangan — oylar ham shu tartibda.
  const monthList = useMemo(() => [...new Set(data.exams.map((e) => e.month))], [data.exams]);
  const shown = data.exams.filter((e) => e.month === month);
  const title = /^\d+$/.test(data.groupName) ? t("{n}-guruh", { n: data.groupName }) : data.groupName || data.groupLabel;

  /** Oy shu yerda almashadi; manzil ham (`?oy=`) — havolani shu holicha ulashsa o'sha oy ochiladi. */
  function pickMonth(m: string) {
    if (!m || m === month) return;
    setMonth(m);
    const url = new URL(window.location.href);
    url.searchParams.set("oy", m);
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <>
      <header>
        <h1 className="text-v2-page text-v2-text">{t("Imtihon natijalari")}</h1>
        <p className="mt-1.5 flex min-w-0 items-center gap-2 text-v2-body">
          <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(data.course)]}`} aria-hidden />
          <span className="min-w-0">
            <span className="font-semibold text-v2-text">{data.course}</span>
            <span className="text-v2-text-2">
              {" · "}
              {title}
              {data.level ? ` · ${t(data.level)}` : ""}
            </span>
          </span>
        </p>
      </header>

      {!month ? (
        <EmptyCard icon={<ClipboardList className="size-5" strokeWidth={1.75} aria-hidden />} title={t("Hozircha natijalar yo'q")} text={t("Imtihon natijalari kiritilgach shu yerda ko'rinadi.")} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-v2-section text-v2-text">{t("{month} natijalari", { month: monthLabel(month) })}</h2>
            {monthList.length > 1 && (
              <V2Select
                variant="value"
                label={t("Oy")}
                value={month}
                onChange={pickMonth}
                options={monthList.map((m) => ({ value: m, label: monthLabel(m) }))}
                searchable={false}
                clearable={false}
              />
            )}
          </div>
          {/* Oyda bir nechta sarhisob (boshqa fan yoki qayta topshirish) yoki fani sarlavhadagidan
              boshqa — blok o'z fanini yozadi, aks holda ular bir-biridan ajralmaydi. */}
          {shown.map((exam) => (
            <ExamBlock key={exam.id} exam={exam} showCourse={shown.length > 1 || exam.course !== data.course} />
          ))}
        </>
      )}
    </>
  );
}

/** Bitta sarhisob: to'rt ko'rsatkich va o'quvchilar jadvali (o'rin bo'yicha). */
function ExamBlock({ exam, showCourse }: { exam: PublicExam; showCourse: boolean }) {
  const { t } = useT();
  const [lang] = useLang();
  const d = dateOfIso(exam.date);
  const ranks = ranksOf(exam.students);
  const stats = [
    { label: t("Sana"), value: d ? dayMonthLabel(d, lang) : exam.date },
    { label: t("Ustoz"), value: exam.teacher || "—" },
    { label: t("Savollar soni"), value: String(exam.total) },
    { label: t("Guruh o'rtachasi"), value: `${exam.avgPct}%` },
  ];

  return (
    <section className="flex flex-col gap-3">
      {showCourse && (
        <h3 className="flex items-center gap-2 text-v2-body font-semibold text-v2-text">
          <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(exam.course)]}`} aria-hidden />
          {exam.course}
        </h3>
      )}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border shadow-v2-sm sm:grid-cols-4">
        {stats.map((k) => (
          <div key={k.label} className="min-w-0 bg-v2-surface px-4 py-3">
            <div className="text-v2-small font-medium leading-tight text-v2-text-2">{k.label}</div>
            <div className="mt-1 truncate text-v2-body font-semibold tabular-nums text-v2-text" title={k.value}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
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
                {t("Telefon")}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                {t("To'g'ri javob")}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                {t("Natija")}
              </th>
            </tr>
          </thead>
          <tbody>
            {exam.students.map((s, i) => (
              <tr key={i} className="border-t border-v2-border">
                <td className="px-3 py-2.5 text-center">
                  <RankBadge rank={ranks[i]} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-v2-small font-semibold text-v2-text">{s.name}</div>
                  {s.phone && <div className="mt-0.5 text-v2-caption tabular-nums tracking-wide text-v2-text-2 sm:hidden">{s.phone}</div>}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 text-v2-small tabular-nums tracking-wide text-v2-text-2 sm:table-cell">{s.phone || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-v2-small tabular-nums text-v2-text">
                  {s.correct} / {exam.total}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-2.5">
                    <ScoreBar pct={s.pct} className="hidden w-20 sm:block" />
                    <Pct pct={s.pct} className="w-10 text-right text-v2-small" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
